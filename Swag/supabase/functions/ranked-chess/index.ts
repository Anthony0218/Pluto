import { createClient } from "jsr:@supabase/supabase-js@2";
import { Chess } from "npm:chess.js@1.4.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
type Room = { id: string; code: string; host_id: string; match_kind: string };
type Player = { user_id: string; seat: number; chosen_color: "white" | "black" | null };
type Game = { room_id: string; fen: string; moves: string[]; status: string; winner: string | null; version: number; undo_requested_by: string | null; undo_requested_version: number | null; undo_last_requested_by: string | null; undo_last_requested_version: number | null };
type QueueEntry = { user_id: string; room_code: string; rating: number; joined_at: string; claimed_by: string | null; claimed_at: string | null };
const validCode = (value: unknown) => typeof value === "string" && /^[A-Z0-9]{6}$/.test(value.toUpperCase());
function replay(moves: string[]) {
  const chess = new Chess();
  if (!Array.isArray(moves) || moves.length > 1000) throw new Error("Invalid game history.");
  for (const san of moves) {
    if (typeof san !== "string" || san.length > 20) throw new Error("Invalid move history.");
    try { chess.move(san); } catch { throw new Error("Invalid move history."); }
  }
  return chess;
}
function sideOf(player: Player) { return player.chosen_color === "white" ? "w" : player.chosen_color === "black" ? "b" : null; }

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return response({ error: "POST required." }, 405);
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return response({ error: "Sign in to play ranked chess." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await db.auth.getUser(authorization.slice(7));
    if (authError || !user) return response({ error: "Session expired." }, 401);
    const raw = await request.text();
    if (raw.length > 4096) return response({ error: "Request too large." }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (body.op === "queue" || body.op === "queueStatus" || body.op === "leaveQueue") {
      const userDb = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
      if (body.op === "leaveQueue") {
        const { error } = await db.from("ranked_chess_queue").delete().eq("user_id", user.id);
        if (error) throw new Error(error.message);
        return response({ status: "left" });
      }
      const { data: queued, error: queueError } = await db.from("ranked_chess_queue")
        .select("user_id,room_code,rating,joined_at,claimed_by,claimed_at").eq("user_id", user.id).maybeSingle();
      if (queueError) throw new Error(queueError.message);
      let own = queued as QueueEntry | null;
      if (own && !own.claimed_by && Date.now() - Date.parse(own.joined_at) > 10 * 60_000) {
        await db.from("ranked_chess_queue").delete().eq("user_id", user.id);
        own = null;
      }
      if (own) await db.from("ranked_chess_queue").update({ last_seen_at: new Date().toISOString() }).eq("user_id", user.id);
      if (own?.claimed_by) {
        const { data: matchedRoom } = await db.from("chess_rooms").select("id,status,host_id")
          .eq("code", own.room_code).maybeSingle();
        let startErrorMessage: string | null = null;
        if (matchedRoom) {
          const { count } = await db.from("chess_room_players").select("user_id", { count: "exact", head: true }).eq("room_id", matchedRoom.id);
          if ((count ?? 0) === 2 && matchedRoom.status === "ready") {
            const { error: startError } = await db.rpc("start_queued_ranked_chess_game", { p_room_id: matchedRoom.id });
            if (startError) startErrorMessage = `Could not start match: ${startError.message}`;
          }
          const { data: latestRoom } = await db.from("chess_rooms").select("status").eq("id", matchedRoom.id).single();
          const { data: latestGame, error: latestGameError } = await db.from("chess_games")
            .select("status").eq("room_id", matchedRoom.id).maybeSingle();
          if (latestGameError) throw new Error(latestGameError.message);
          if (latestGame?.status === "finished" || latestRoom?.status === "finished") {
            await db.from("ranked_chess_queue").delete().eq("user_id", user.id);
            return response({ status: "idle" });
          }
          if (latestRoom?.status === "playing" && latestGame?.status === "playing")
            return response({ status: "matched", code: own.room_code });
        }
        if (own.claimed_by === user.id && own.claimed_at && Date.now() - Date.parse(own.claimed_at) > 30_000) {
          await db.from("ranked_chess_queue").update({ claimed_by: null, claimed_at: null }).eq("claimed_by", user.id).neq("user_id", user.id);
          await db.from("ranked_chess_queue").delete().eq("user_id", user.id);
          return response({ status: "idle", error: "The match did not start. Please join the queue again." });
        }
        return response({ status: "found", error: startErrorMessage });
      }
      if (body.op === "queueStatus" && !own) return response({ status: "idle" });
      const { data: ratingRow } = await db.from("chess_ratings").select("rating").eq("user_id", user.id).maybeSingle();
      const rating = ratingRow?.rating ?? 1200;
      const cutoff = new Date(Date.now() - 10_000).toISOString();
      const { data: candidates, error: candidatesError } = await db.from("ranked_chess_queue")
        .select("user_id,room_code,rating,joined_at,claimed_by,claimed_at").is("claimed_by", null)
        .neq("user_id", user.id).gte("last_seen_at", cutoff).order("joined_at").limit(20);
      if (candidatesError) throw new Error(candidatesError.message);
      const candidate = (candidates as QueueEntry[]).find(entry =>
        (!own || Date.parse(entry.joined_at) < Date.parse(own.joined_at)) &&
        Math.abs(entry.rating - rating) <= 250 + Math.floor((Date.now() - Date.parse(entry.joined_at)) / 60_000) * 100);
      if (candidate) {
        const { data: claimed, error: claimError } = await db.from("ranked_chess_queue")
          .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
          .eq("user_id", candidate.user_id).is("claimed_by", null).select("room_code").maybeSingle();
        if (claimError) throw new Error(claimError.message);
        if (claimed) {
          const { data: joined, error: joinError } = await userDb.rpc("join_chess_room", { p_code: candidate.room_code, p_display_name: typeof body.name === "string" ? body.name.trim().slice(0, 30) || "Player" : "Player" });
          if (joinError || !joined) {
            await db.from("ranked_chess_queue").update({ claimed_by: null, claimed_at: null }).eq("user_id", candidate.user_id).eq("claimed_by", user.id);
            throw new Error(joinError?.message ?? "Could not join matched game.");
          }
          const matchedEntry = { user_id: user.id, room_code: candidate.room_code, rating, joined_at: new Date().toISOString(), claimed_by: user.id, claimed_at: new Date().toISOString() };
          const { error: upsertError } = await db.from("ranked_chess_queue").upsert(matchedEntry);
          if (upsertError) throw new Error(upsertError.message);
          const { data: matchedRoom, error: matchedRoomError } = await db.from("chess_rooms").select("id").eq("code", candidate.room_code).single();
          if (matchedRoomError || !matchedRoom) return response({ status: "found", error: "Matched room could not be loaded." });
          const { error: startError } = await db.rpc("start_queued_ranked_chess_game", { p_room_id: matchedRoom.id });
          if (startError) return response({ status: "found", error: `Could not start match: ${startError.message}` });
          return response({ status: "matched", code: candidate.room_code });
        }
      }
      if (own) return response({ status: "waiting" });
      if (body.op === "queueStatus") return response({ status: "idle" });
      const name = typeof body.name === "string" ? body.name.trim().slice(0, 30) || "Player" : "Player";
      const { data: code, error: createError } = await userDb.rpc("create_chess_room", { p_display_name: name });
      if (createError || !validCode(code)) throw new Error(createError?.message ?? "Could not enter ranked queue.");
      const { error: markError } = await db.from("chess_rooms").update({ match_kind: "ranked" }).eq("code", code).eq("host_id", user.id).eq("status", "waiting");
      if (markError) throw new Error(markError.message);
      const { error: insertError } = await db.from("ranked_chess_queue").insert({ user_id: user.id, room_code: code, rating });
      if (insertError) throw new Error(insertError.message);
      return response({ status: "waiting" });
    }
    if (!validCode(body.code)) throw new Error("Invalid room code.");
    const code = (body.code as string).toUpperCase();
    const { data: room, error: roomError } = await db.from("chess_rooms").select("id,code,host_id,match_kind").eq("code", code).maybeSingle();
    if (body.op === "inspect") return roomError || !room ? response({ error: "Room not found." }, 404) : response({ matchKind: room.match_kind });
    if (roomError || !room || (room as Room).match_kind !== "ranked") return response({ error: "Ranked room not found." }, 404);
    const { data: players, error: playersError } = await db.from("chess_room_players").select("user_id,seat,chosen_color").eq("room_id", room.id);
    if (playersError) throw new Error("Could not load players.");
    const player = (players as Player[]).find(entry => entry.user_id === user.id);
    if (!player) return response({ error: "Join the room before playing." }, 403);
    const { data: game, error: gameError } = await db.from("chess_games").select("room_id,fen,moves,status,winner,version,undo_requested_by,undo_requested_version,undo_last_requested_by,undo_last_requested_version").eq("room_id", room.id).maybeSingle();
    if (gameError || !game) throw new Error("Game has not started.");
    const current = game as Game;
    const chess = replay(current.moves);
    if (chess.fen() !== current.fen) throw new Error("Stored position failed verification.");
    if (body.op === "forfeitQuote") {
      if (current.status !== "playing") throw new Error("Game is not active.");
      const opponent = (players as Player[]).find(entry => entry.user_id !== user.id);
      if (!opponent) throw new Error("Opponent not found.");
      const { data: ratings, error: ratingsError } = await db.from("chess_ratings")
        .select("user_id,rating,rated_games").in("user_id", [user.id, opponent.user_id]);
      if (ratingsError) throw new Error(ratingsError.message);
      const mine = ratings?.find(entry => entry.user_id === user.id);
      const theirs = ratings?.find(entry => entry.user_id === opponent.user_id);
      const myRating = mine?.rating ?? 1200;
      const opponentRating = theirs?.rating ?? 1200;
      const k = (mine?.rated_games ?? 0) < 20 ? 32 : 20;
      const nextRating = Math.max(100, Math.floor(myRating - k / (1 + 10 ** ((opponentRating - myRating) / 400)) + 0.5));
      return response({ eloLoss: myRating - nextRating });
    }
    if (body.op === "settle") {
      if (current.status !== "finished") throw new Error("Game is not finished.");
      const { error } = await db.rpc("apply_verified_ranked_chess_result", { p_room_id: room.id });
      if (error) throw new Error(error.message);
      const { error: clearError } = await db.from("ranked_chess_queue").delete().eq("room_code", code);
      if (clearError) throw new Error(clearError.message);
      return response({ ok: true });
    }
    if (current.status !== "playing") throw new Error("Game is not active.");
    if (body.version !== current.version) return response({ error: "Stale position. Refresh the board." }, 409);
    const color = sideOf(player);
    if (!color) throw new Error("Choose a side before playing.");
    let update: Record<string, unknown>;
    if (body.op === "move") {
      if (current.undo_requested_by) throw new Error("Answer the undo request first.");
      if (color !== chess.turn()) throw new Error("It is not your turn.");
      if (typeof body.from !== "string" || typeof body.to !== "string" || !/^[a-h][1-8]$/.test(body.from) || !/^[a-h][1-8]$/.test(body.to)) throw new Error("Invalid move.");
      const promotion = ["q", "r", "b", "n"].includes(String(body.promotion)) ? String(body.promotion) : "q";
      let move;
      try { move = chess.move({ from: body.from, to: body.to, promotion }); } catch { throw new Error("Illegal move."); }
      const finished = chess.isGameOver();
      update = { fen: chess.fen(), moves: [...current.moves, move.san], status: finished ? "finished" : "playing", winner: finished ? chess.isCheckmate() ? chess.turn() === "w" ? "black" : "white" : "draw" : null, end_reason: finished ? chess.isCheckmate() ? "checkmate" : "draw" : null, last_move_from: move.from, last_move_to: move.to, version: current.version + 1 };
    } else if (body.op === "resign") {
      update = { status: "finished", winner: color === "w" ? "black" : "white", end_reason: "resignation", version: current.version + 1, undo_requested_by: null, undo_requested_version: null };
    } else if (body.op === "requestUndo") {
      if (!current.moves.length || current.undo_requested_by) throw new Error("Undo is unavailable.");
      const lastMover = current.moves.length % 2 ? "w" : "b";
      if (color !== lastMover) throw new Error("Only the last mover can request undo.");
      if (current.undo_last_requested_by === user.id && current.undo_last_requested_version === current.version) throw new Error("Undo was already requested for this move.");
      update = { undo_requested_by: user.id, undo_requested_version: current.version, undo_last_requested_by: user.id, undo_last_requested_version: current.version };
    } else if (body.op === "respondUndo") {
      if (!current.undo_requested_by || current.undo_requested_by === user.id || current.undo_requested_version !== current.version) throw new Error("No valid undo request.");
      if (body.accept === true) {
        const previous = replay(current.moves.slice(0, -1));
        const previousMove = previous.history({ verbose: true }).at(-1);
        update = { fen: previous.fen(), moves: current.moves.slice(0, -1), last_move_from: previousMove?.from ?? null, last_move_to: previousMove?.to ?? null, version: current.version + 1, undo_requested_by: null, undo_requested_version: null };
      } else update = { undo_requested_by: null, undo_requested_version: null };
    } else throw new Error("Unknown action.");
    const { data: saved, error: saveError } = await db.from("chess_games").update(update).eq("room_id", room.id).eq("version", current.version).eq("status", "playing").select("room_id,status,winner,version").maybeSingle();
    if (saveError) throw new Error(saveError.message);
    if (!saved) return response({ error: "Another move arrived first. Refresh the board." }, 409);
    if (saved.status === "finished") {
      const { error } = await db.rpc("apply_verified_ranked_chess_result", { p_room_id: room.id });
      if (error) throw new Error(error.message);
      const { error: clearError } = await db.from("ranked_chess_queue").delete().eq("room_code", code);
      if (clearError) throw new Error(clearError.message);
    }
    return response({ ok: true, version: saved.version });
  } catch (cause) { return response({ error: cause instanceof Error ? cause.message : "Ranked request failed." }, 400); }
});
