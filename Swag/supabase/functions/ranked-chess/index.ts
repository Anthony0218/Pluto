import { createClient } from "jsr:@supabase/supabase-js@2";
import { Chess } from "npm:chess.js@1.4.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
type Room = { id: string; code: string; host_id: string; match_kind: string };
type Player = { user_id: string; seat: number; chosen_color: "white" | "black" | null };
type Game = { room_id: string; fen: string; moves: string[]; status: string; winner: string | null; version: number; ranked_round: number; undo_requested_by: string | null; undo_requested_version: number | null; undo_last_requested_by: string | null; undo_last_requested_version: number | null };
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
    if (!authorization?.startsWith("Bearer ")) return response({ error: "Sign in to play multiplayer chess." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await db.auth.getUser(authorization.slice(7));
    if (authError || !user) return response({ error: "Session expired." }, 401);
    const raw = await request.text();
    if (raw.length > 4096) return response({ error: "Request too large." }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (body.op === "queue" || body.op === "queueStatus" || body.op === "leaveQueue") {
      if (typeof body.sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.sessionId)) throw new Error("Invalid queue session.");
      const { data, error } = await db.rpc("ranked_queue_action", {
        p_user: user.id, p_session: body.sessionId, p_op: body.op,
        p_name: typeof body.name === "string" ? body.name : "Player",
      });
      if (error) throw new Error(error.message);
      return response(data);
    }
    if (!validCode(body.code)) throw new Error("Invalid room code.");
    const code = (body.code as string).toUpperCase();
    const { data: room, error: roomError } = await db.from("chess_rooms").select("id,code,host_id,match_kind").eq("code", code).maybeSingle();
    if (body.op === "inspect") return roomError || !room ? response({ error: "Room not found." }, 404) : response({ matchKind: room.match_kind });
    if (roomError || !room || ((room as Room).match_kind !== "ranked" && body.op !== "casualMove")) return response({ error: "Ranked room not found." }, 404);
    const { data: players, error: playersError } = await db.from("chess_room_players").select("user_id,seat,chosen_color").eq("room_id", room.id);
    if (playersError) throw new Error("Could not load players.");
    const player = (players as Player[]).find(entry => entry.user_id === user.id);
    if (!player) return response({ error: "Join the room before playing." }, 403);
    const isRanked = room.match_kind === "ranked";
    if (body.op === "casualMove" && isRanked) throw new Error("Use ranked move validation.");
    let current: Game;
    if (isRanked) {
      const { data: clock, error: gameError } = await db.rpc("ranked_clock_snapshot", { p_room_id: room.id });
      if (gameError || !clock?.game) throw new Error(gameError?.message ?? "Game has not started.");
      if (body.op === "clock") return response(clock);
      current = clock.game as Game;
    } else {
      const { data, error } = await db.from("chess_games").select("*").eq("room_id", room.id).single();
      if (error || !data) throw new Error("Game has not started.");
      current = data as Game;
    }
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
    if (body.version !== current.version || body.round !== current.ranked_round) return response({ error: "Stale position. Refresh the board." }, 409);
    const color = sideOf(player);
    if (!color) throw new Error("Choose a side before playing.");
    let update: Record<string, unknown>;
    if (body.op === "move" || body.op === "casualMove") {
      if (current.undo_requested_by) throw new Error("Answer the undo request first.");
      if (color !== chess.turn()) throw new Error("It is not your turn.");
      if (typeof body.from !== "string" || typeof body.to !== "string" || !/^[a-h][1-8]$/.test(body.from) || !/^[a-h][1-8]$/.test(body.to)) throw new Error("Invalid move.");
      const promotion = ["q", "r", "b", "n"].includes(String(body.promotion)) ? String(body.promotion) : "q";
      let move;
      try { move = chess.move({ from: body.from, to: body.to, promotion }); } catch { throw new Error("Illegal move."); }
      const finished = chess.isGameOver();
      const reason = !finished ? null : chess.isCheckmate() ? "checkmate" : chess.isStalemate() ? "stalemate" : chess.isThreefoldRepetition() ? "threefold repetition" : chess.isInsufficientMaterial() ? "insufficient material" : chess.isDrawByFiftyMoves() ? "50-move rule" : "draw";
      update = { fen: chess.fen(), moves: [...current.moves, move.san], status: finished ? "finished" : "playing", winner: finished ? chess.isCheckmate() ? chess.turn() === "w" ? "black" : "white" : "draw" : null, end_reason: reason, last_move_from: move.from, last_move_to: move.to, version: current.version + 1 };
    } else if (body.op === "resign") {
      update = { status: "finished", winner: color === "w" ? "black" : "white", end_reason: "resignation", version: current.version + 1, undo_requested_by: null, undo_requested_version: null };
    } else if (body.op === "requestUndo") {
      if (!current.moves.length || current.undo_requested_by) throw new Error("Undo is unavailable.");
      const lastMover = current.moves.length % 2 ? "w" : "b";
      if (color !== lastMover) throw new Error("Only the last mover can request undo.");
      if (current.undo_last_requested_by === user.id && current.undo_last_requested_version === current.version) throw new Error("Undo was already requested for this move.");
      // Every state mutation advances the CAS version, including undo prompts.
      // Otherwise a move validated before this request can commit afterwards
      // and leave an unanswerable undo request attached to the next position.
      update = { version: current.version + 1, undo_requested_by: user.id, undo_requested_version: current.version + 1, undo_last_requested_by: user.id, undo_last_requested_version: current.version + 1 };
    } else if (body.op === "respondUndo") {
      if (!current.undo_requested_by || current.undo_requested_by === user.id || current.undo_requested_version !== current.version) throw new Error("No valid undo request.");
      if (body.accept === true) {
        const previous = replay(current.moves.slice(0, -1));
        const previousMove = previous.history({ verbose: true }).at(-1);
        update = { fen: previous.fen(), moves: current.moves.slice(0, -1), last_move_from: previousMove?.from ?? null, last_move_to: previousMove?.to ?? null, version: current.version + 1, undo_requested_by: null, undo_requested_version: null };
      } else update = { version: current.version + 1, undo_requested_by: null, undo_requested_version: null, undo_last_requested_version: current.version + 1 };
    } else throw new Error("Unknown action.");
    const { data: saved, error: saveError } = await db.from("chess_games").update(update).eq("room_id", room.id).eq("version", current.version).eq("ranked_round", current.ranked_round).eq("status", "playing").select("*").maybeSingle();
    if (saveError) throw new Error(saveError.message);
    if (!saved) return response({ error: "Another move arrived first. Refresh the board." }, 409);
    if (saved.status === "finished") {
      const { error } = await db.from("chess_rooms").update({ status: "finished" }).eq("id", room.id);
      if (error) throw new Error(error.message);
    }
    if (isRanked && saved.status === "finished") {
      const { error } = await db.rpc("apply_verified_ranked_chess_result", { p_room_id: room.id });
      if (error) throw new Error(error.message);
      const { error: clearError } = await db.from("ranked_chess_queue").delete().eq("room_code", code);
      if (clearError) throw new Error(clearError.message);
    }
    return response({ ok: true, version: saved.version, game: saved, serverNow: new Date().toISOString() });
  } catch (cause) { return response({ error: cause instanceof Error ? cause.message : "Ranked request failed." }, 400); }
});
