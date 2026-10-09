import { createClient } from "jsr:@supabase/supabase-js@2";
import { applyGoMove, createInitialGoState, isLegalGoMove, type GoMove, type GoState } from "../../../src/games/go/rules.ts";
import { applyShogiMove, createInitialShogiState, isLegalShogiMove, type ShogiMove, type ShogiState } from "../../../src/games/shogi/rules.ts";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
type Player = { id: string; name: string };
type Room = { id: string; room_code: string; game_type: "go" | "shogi"; host_id: string; players: Player[]; settings: Record<string, unknown>; game_state: GoState | ShogiState | null; version: number };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const nameFor = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 32) || "Player" : "Player";
const snapshot = (room: Room, userId: string) => {
  const seat = room.players.findIndex((player) => player.id === userId);
  if (seat < 0) throw new Error("You are not a participant in this room.");
  return { code: room.room_code, gameType: room.game_type, hostId: room.host_id, players: room.players, side: seat === 0 ? "black" : "white", settings: room.settings, state: room.game_state, version: room.version };
};
const initialState = (gameType: Room["game_type"], settings: Record<string, unknown>) => gameType === "go"
  ? createInitialGoState(settings.boardSize === 13 || settings.boardSize === 19 ? settings.boardSize : 9)
  : createInitialShogiState();

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return respond({ error: "POST required." }, 405);
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return respond({ error: "Sign in to play multiplayer." }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await db.auth.getUser(authorization.slice(7));
    if (authError || !user) return respond({ error: "Session expired. Please sign in again." }, 401);
    const raw = await request.text();
    if (raw.length > 16_384) return respond({ error: "Request too large." }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (body.op === "create") {
      if (body.gameType !== "go" && body.gameType !== "shogi") throw new Error("Unknown game.");
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const bytes = crypto.getRandomValues(new Uint8Array(6));
        const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
        const settings = body.gameType === "go" ? { boardSize: body.boardSize === 13 || body.boardSize === 19 ? body.boardSize : 9, komi: 6.5 } : {};
        const { data, error } = await db.from("strategy_matches").insert({ room_code: code, game_type: body.gameType, host_id: user.id, players: [{ id: user.id, name: nameFor(body.name) }], settings }).select().single();
        if (!error) return respond(snapshot(data as Room, user.id));
        if (error.code !== "23505") throw new Error("Could not create room.");
      }
      throw new Error("Could not allocate a room code.");
    }
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error("Invalid room code.");
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data, error } = await db.from("strategy_matches").select().eq("room_code", code).maybeSingle();
      if (error) throw new Error("Could not load room.");
      if (!data) return respond({ error: "Room not found." }, 404);
      const room = data as Room;
      const seat = room.players.findIndex((player) => player.id === user.id);
      if (body.op === "leave") {
        // Joining starts the game, so a room that has not started holds only its host and is removed with them.
        // A running game keeps both seats for reconnecting.
        const left = seat >= 0 && !room.game_state;
        if (left) {
          const { error: removeError } = await db.from("strategy_matches").delete().eq("id", room.id).eq("version", room.version);
          if (removeError) throw new Error("Could not leave room.");
        }
        return respond({ left });
      }
      if (body.op === "get") {
        if (seat < 0) return respond({ error: "Join this room first." }, 403);
        return respond(snapshot(room, user.id));
      }
      if (body.op === "join") {
        if (seat >= 0) return respond(snapshot(room, user.id));
        if (room.players.length >= 2 || room.game_state) throw new Error("This room is already full.");
        room.players.push({ id: user.id, name: nameFor(body.name) });
        room.game_state = initialState(room.game_type, room.settings);
      } else if (body.op === "move") {
        if (seat < 0) return respond({ error: "You are not a participant." }, 403);
        if (body.version !== room.version) return respond({ error: "Stale position. The latest state has been restored." }, 409);
        if (!room.game_state || room.game_state.status !== "playing") throw new Error("This match is not active.");
        const side = seat === 0 ? "black" : "white";
        if (room.game_state.currentPlayer !== side) throw new Error("It is not your turn.");
        if (room.game_type === "go") {
          const state = room.game_state as GoState, move = body.move as GoMove;
          if (!isLegalGoMove(state, move)) throw new Error("Illegal Go move.");
          room.game_state = applyGoMove(state, move);
        } else {
          const state = room.game_state as ShogiState, move = body.move as ShogiMove;
          if (!isLegalShogiMove(state, move)) throw new Error("Illegal Shogi move.");
          room.game_state = applyShogiMove(state, move);
        }
      } else throw new Error("Unknown operation.");
      const { data: updated, error: updateError } = await db.from("strategy_matches").update({ players: room.players, game_state: room.game_state, version: room.version + 1, updated_at: new Date().toISOString() }).eq("id", room.id).eq("version", room.version).select().maybeSingle();
      if (updateError) throw new Error("Could not save match.");
      if (updated) return respond(snapshot(updated as Room, user.id));
      if (body.op !== "join") return respond({ error: "Another move arrived first. State has been refreshed." }, 409);
    }
    return respond({ error: "Room is busy. Please retry." }, 409);
  } catch (cause) {
    return respond({ error: cause instanceof Error ? cause.message : "Request failed." }, 400);
  }
});
