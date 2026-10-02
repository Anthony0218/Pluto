import { createClient } from "jsr:@supabase/supabase-js@2";
import { chooseBotAction } from "../../../src/games/cards/engine/bot.ts";
import { createGame, GameSetupError, getPlayerView, performAction, resolveSettings } from "../../../src/games/cards/engine/GameEngine.ts";
import { parseGameDefinition, validateDefinition } from "../../../src/games/cards/engine/validation.ts";
import type { ActionRequest, GameDefinition, GameState } from "../../../src/games/cards/engine/types.ts";
import { freeSeat, planRoomSeats, ROOM_CODE, roomCode, type RoomSnapshot, type WaitingRoom } from "../../../src/games/cards/rooms.ts";
import { slugify } from "../../../src/games/cards/versioning.ts";

/**
 * Card Builder authority. Every definition is re-validated here with the same
 * engine code the browser uses (only allowlisted condition/effect/action
 * types, size limits), and every move is replayed through performAction —
 * the client is never trusted with game logic.
 *
 * ops: saveDraft, publish, setVisibility, startSession, act, getSession,
 *      createRoom, getRoom, joinRoom, leaveRoom, startRoom
 *
 * Rooms are sessions with a share code: people join while it is 'waiting',
 * the host starts it and empty seats become bots. Player ids are seat ids
 * (`seat-N`), and seat N in card_game_players is state.players[N].
 */

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
/** Bots act on the server until a human has to decide (bounded). */
function runBots(def: GameDefinition, start: GameState): GameState {
  let state = start;
  for (let step = 0; step < 400 && state.status === "playing"; step++) {
    const bot = state.players.find((player) => player.isBot && chooseBotAction(def, state, player.id));
    if (!bot) break;
    const result = performAction(def, state, bot.id, chooseBotAction(def, state, bot.id)!);
    if (!result.ok) break;
    state = result.state;
  }
  return state;
}

const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const MAX_BODY = 300_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Body = {
  op?: string;
  gameId?: string;
  versionId?: string;
  sessionId?: string;
  definition?: unknown;
  visibility?: string;
  settings?: Record<string, unknown>;
  bots?: number;
  request?: ActionRequest;
  revision?: number;
  code?: string;
  players?: number;
  includeDefinition?: boolean;
};

type SessionRow = { id: string; code: string | null; created_by: string | null; game_version_id: string; state_json: GameState | WaitingRoom; status: RoomSnapshot["status"]; revision: number; card_game_versions: { definition_json: GameDefinition } };
type SeatRow = { seat: number; user_id: string | null; name: string };
const SESSION_COLUMNS = "id,code,created_by,game_version_id,state_json,status,revision,card_game_versions!inner(definition_json)";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return respond({ error: "POST required." }, 405);
  try {
    const authorization = request.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return respond({ error: "Sign in to save card games." }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await db.auth.getUser(authorization.slice(7));
    if (authError || !user) return respond({ error: "Sign in to save card games." }, 401);
    const raw = await request.text();
    if (raw.length > MAX_BODY) return respond({ error: "Request too large." }, 413);
    const body = JSON.parse(raw) as Body;

    const ownGame = async (gameId: string | undefined) => {
      if (!gameId || !UUID.test(gameId)) return null;
      const { data } = await db.from("card_games").select("*").eq("id", gameId).eq("owner_id", user.id).maybeSingle();
      return data as { id: string; name: string } | null;
    };

    /** A published version the user may start a game from (their own, or not private). */
    const playableVersion = async (versionId: string | undefined) => {
      if (!versionId || !UUID.test(versionId)) return null;
      const { data: version } = await db.from("card_game_versions").select("id,status,definition_json,card_games!inner(owner_id,visibility)").eq("id", versionId).maybeSingle();
      const owner = (version as { card_games?: { owner_id: string; visibility: string } } | null)?.card_games;
      if (!version || version.status !== "published" || (owner?.owner_id !== user.id && owner?.visibility === "private")) return null;
      const parsed = parseGameDefinition(version.definition_json);
      return parsed.definition ? { id: version.id as string, def: parsed.definition } : null;
    };

    const displayName = async () => {
      const { data } = await db.from("profiles").select("display_name,username").eq("id", user.id).maybeSingle();
      return String(data?.display_name || data?.username || "Player").trim().slice(0, 40) || "Player";
    };

    const loadSession = async (by: { code?: string; sessionId?: string }) => {
      const query = db.from("card_game_sessions").select(SESSION_COLUMNS);
      const code = by.code?.trim().toUpperCase();
      if (code && ROOM_CODE.test(code)) return (await query.eq("code", code).maybeSingle()).data as unknown as SessionRow | null;
      if (by.sessionId && UUID.test(by.sessionId)) return (await query.eq("id", by.sessionId).maybeSingle()).data as unknown as SessionRow | null;
      return null;
    };

    const loadSeats = async (sessionId: string) => {
      const { data, error } = await db.from("card_game_players").select("seat,user_id,name").eq("session_id", sessionId).order("seat");
      if (error) throw error;
      return (data ?? []) as SeatRow[];
    };

    const snapshot = (session: SessionRow, seats: SeatRow[]): RoomSnapshot => {
      const def = session.card_game_versions.definition_json;
      const mine = seats.find((seat) => seat.user_id === user.id);
      const waiting = "room" in session.state_json ? session.state_json.room : null;
      const state = waiting ? null : (session.state_json as GameState);
      const playerId = state && mine ? (state.players.find((player) => player.seat === mine.seat)?.id ?? null) : null;
      return {
        code: session.code ?? "",
        sessionId: session.id,
        versionId: session.game_version_id,
        status: session.status,
        revision: session.revision,
        capacity: waiting?.capacity ?? state!.players.length,
        settings: waiting?.settings ?? state!.settings,
        seats: seats.map((seat) => ({ seat: seat.seat, name: seat.name, isBot: !seat.user_id, isHost: Boolean(seat.user_id && seat.user_id === session.created_by), isYou: seat.user_id === user.id })),
        youAreHost: session.created_by === user.id,
        member: Boolean(mine),
        playerId,
        // Non-members watch as spectators: only public cards are sent.
        state: state ? getPlayerView(def, state, playerId) : null,
        ...(body.includeDefinition ? { definition: def } : {}),
      };
    };

    if (body.op === "saveDraft") {
      const parsed = parseGameDefinition(body.definition);
      if (!parsed.definition) return respond({ error: "The game definition is not valid.", issues: parsed.issues }, 400);
      const def = parsed.definition;
      let game = body.gameId ? await ownGame(body.gameId) : null;
      if (body.gameId && !game) return respond({ error: "Game not found." }, 404);
      if (!game) {
        const { count } = await db.from("card_games").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
        if ((count ?? 0) >= 100) return respond({ error: "You can keep up to 100 card games — delete one first." }, 409);
        const { data, error } = await db.from("card_games").insert({ owner_id: user.id, name: def.name.trim(), slug: slugify(def.name), description: def.description.slice(0, 600) }).select().single();
        if (error) throw error;
        game = data;
      } else {
        await db.from("card_games").update({ name: def.name.trim(), slug: slugify(def.name), description: def.description.slice(0, 600), updated_at: new Date().toISOString() }).eq("id", game.id);
      }
      const stored: GameDefinition = { ...def, id: game!.id };
      const { data: draft } = await db.from("card_game_versions").select("id,version").eq("game_id", game!.id).eq("status", "draft").maybeSingle();
      if (draft) {
        const { error } = await db.from("card_game_versions").update({ definition_json: stored }).eq("id", draft.id);
        if (error) throw error;
        return respond({ gameId: game!.id, versionId: draft.id, version: draft.version, issues: parsed.issues });
      }
      const { data: latest } = await db.from("card_game_versions").select("version").eq("game_id", game!.id).order("version", { ascending: false }).limit(1).maybeSingle();
      const { data: created, error } = await db.from("card_game_versions").insert({ game_id: game!.id, version: (latest?.version ?? 0) + 1, definition_json: stored, status: "draft" }).select("id,version").single();
      if (error) throw error;
      return respond({ gameId: game!.id, versionId: created.id, version: created.version, issues: parsed.issues });
    }

    if (body.op === "publish") {
      const game = await ownGame(body.gameId);
      if (!game) return respond({ error: "Game not found." }, 404);
      const { data: draft } = await db.from("card_game_versions").select("id,version,definition_json").eq("game_id", game.id).eq("status", "draft").maybeSingle();
      if (!draft) return respond({ error: "There is no draft to publish." }, 409);
      const parsed = parseGameDefinition(draft.definition_json);
      const report = parsed.definition ? validateDefinition(parsed.definition) : null;
      if (!report?.canPublish) return respond({ error: "Fix the validation errors before publishing.", issues: report?.issues ?? parsed.issues }, 400);
      const { error } = await db.from("card_game_versions").update({ status: "published", published_at: new Date().toISOString() }).eq("id", draft.id).eq("status", "draft");
      if (error) throw error;
      return respond({ gameId: game.id, versionId: draft.id, version: draft.version });
    }

    if (body.op === "setVisibility") {
      const game = await ownGame(body.gameId);
      if (!game) return respond({ error: "Game not found." }, 404);
      if (!["private", "unlisted", "public"].includes(body.visibility ?? "")) return respond({ error: "Unknown visibility." }, 400);
      await db.from("card_games").update({ visibility: body.visibility, updated_at: new Date().toISOString() }).eq("id", game.id);
      return respond({ ok: true });
    }

    if (body.op === "startSession") {
      const version = await playableVersion(body.versionId);
      if (!version) return respond({ error: "Version not found." }, 404);
      const def = version.def;
      const bots = Math.max(def.players.min - 1, Math.min(def.players.max - 1, Math.floor(body.bots ?? def.players.min - 1)));
      const { seats, bots: botSeats } = planRoomSeats(1 + bots, [{ seat: 0, name: await displayName() }]);
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const state = runBots(def, createGame(def, { players: seats, settings: body.settings, seed, gameVersionId: version.id }));
      const { data: session, error } = await db.from("card_game_sessions").insert({ game_version_id: version.id, created_by: user.id, state_json: state, status: state.status, revision: state.revision }).select("id").single();
      if (error) throw error;
      await db.from("card_game_players").insert([{ session_id: session.id, user_id: user.id, seat: 0, name: seats[0].name }, ...botSeats.map((bot) => ({ session_id: session.id, user_id: null, seat: bot.seat, name: bot.name }))]);
      return respond({ sessionId: session.id, definition: def, state: getPlayerView(def, state, seats[0].id) });
    }

    if (body.op === "createRoom") {
      const version = await playableVersion(body.versionId);
      if (!version) return respond({ error: "Version not found." }, 404);
      const def = version.def;
      const { count } = await db.from("card_game_sessions").select("id", { count: "exact", head: true }).eq("created_by", user.id).eq("status", "waiting");
      if ((count ?? 0) >= 10) return respond({ error: "You already have 10 open rooms — start or close one first." }, 409);
      const capacity = Math.max(def.players.min, Math.min(def.players.max, Math.floor(body.players ?? def.players.min)));
      const lobby: WaitingRoom = { room: { capacity, settings: resolveSettings(def, body.settings) } };
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: session, error } = await db.from("card_game_sessions").insert({ code: roomCode(), game_version_id: version.id, created_by: user.id, state_json: lobby, status: "waiting", revision: 0 }).select("id").maybeSingle();
        if (error?.code === "23505") continue;
        if (error || !session) throw error ?? new Error("Could not create the room.");
        const { error: seatError } = await db.from("card_game_players").insert({ session_id: session.id, user_id: user.id, seat: 0, name: await displayName() });
        if (seatError) throw seatError;
        const created = await loadSession({ sessionId: session.id });
        return respond(snapshot(created!, await loadSeats(session.id)));
      }
      return respond({ error: "Could not generate a room code. Try again." }, 503);
    }

    if (body.op === "getRoom" || body.op === "joinRoom" || body.op === "leaveRoom" || body.op === "startRoom") {
      const session = await loadSession({ code: body.code });
      if (!session?.code) return respond({ error: "Room not found." }, 404);
      const seats = await loadSeats(session.id);
      const mine = seats.find((seat) => seat.user_id === user.id);

      if (body.op === "joinRoom" && !mine) {
        if (session.status !== "waiting") return respond({ error: "This game has already started." }, 409);
        const { capacity } = (session.state_json as WaitingRoom).room;
        const name = await displayName();
        let taken = seats.map((seat) => seat.seat);
        for (let attempt = 0; attempt < 3; attempt++) {
          const seat = freeSeat(capacity, taken);
          if (seat === null) return respond({ error: "This room is full." }, 409);
          const { error } = await db.from("card_game_players").insert({ session_id: session.id, user_id: user.id, seat, name });
          if (!error) break;
          if (error.code !== "23505") throw error;
          // Someone took that seat a moment ago: look again.
          taken = (await loadSeats(session.id)).map((entry) => entry.seat);
        }
      }

      if (body.op === "leaveRoom") {
        if (!mine) return respond({ error: "You are not in this room." }, 403);
        if (session.status !== "waiting") return respond({ error: "The game has already started." }, 409);
        // The host leaving closes the room for everyone.
        if (session.created_by === user.id) {
          await db.from("card_game_sessions").delete().eq("id", session.id).eq("status", "waiting");
          return respond({ closed: true });
        }
        await db.from("card_game_players").delete().eq("session_id", session.id).eq("user_id", user.id);
        return respond({ left: true });
      }

      if (body.op === "startRoom") {
        if (session.created_by !== user.id) return respond({ error: "Only the host can start the game." }, 403);
        if (session.status !== "waiting") return respond(snapshot(session, seats));
        const def = session.card_game_versions.definition_json;
        const { capacity, settings } = (session.state_json as WaitingRoom).room;
        const { seats: players, bots } = planRoomSeats(capacity, seats.filter((seat) => seat.user_id));
        const seed = crypto.getRandomValues(new Uint32Array(1))[0];
        let state: GameState;
        try {
          state = runBots(def, createGame(def, { players, settings, seed, gameVersionId: session.game_version_id }));
        } catch (error) {
          if (error instanceof GameSetupError) return respond({ error: error.message }, 400);
          throw error;
        }
        const { data: claimed, error } = await db
          .from("card_game_sessions")
          .update({ state_json: state, status: state.status, revision: state.revision, updated_at: new Date().toISOString() })
          .eq("id", session.id)
          .eq("status", "waiting")
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (claimed && bots.length) {
          const { error: botError } = await db.from("card_game_players").insert(bots.map((bot) => ({ session_id: session.id, user_id: null, seat: bot.seat, name: bot.name })));
          if (botError) throw botError;
        }
      }

      const fresh = body.op === "getRoom" ? session : await loadSession({ sessionId: session.id });
      if (!fresh) return respond({ error: "The room was closed." }, 404);
      return respond(snapshot(fresh, body.op === "getRoom" ? seats : await loadSeats(session.id)));
    }

    if (body.op === "act" || body.op === "getSession") {
      const session = await loadSession({ code: body.code, sessionId: body.sessionId });
      if (!session) return respond({ error: "Unknown session." }, 400);
      const { data: seat } = await db.from("card_game_players").select("seat").eq("session_id", session.id).eq("user_id", user.id).maybeSingle();
      if (!seat) return respond({ error: "You are not in this game." }, 403);
      if ("room" in session.state_json) return respond({ error: "The game has not started yet." }, 409);
      const def = session.card_game_versions.definition_json;
      const state = session.state_json;
      const playerId = state.players.find((player) => player.seat === seat.seat)?.id ?? null;
      if (body.op === "getSession") return respond({ definition: def, state: getPlayerView(def, state, playerId) });
      if (!playerId) return respond({ error: "You are not in this game." }, 403);
      if (!body.request || typeof body.request.actionId !== "string") return respond({ error: "Missing action." }, 400);
      const result = performAction(def, state, playerId, body.request, { expectedRevision: body.revision });
      if (!result.ok) return respond({ error: result.error, state: getPlayerView(def, state, playerId) }, 409);
      const next = runBots(def, result.state);
      const { data: updated, error } = await db
        .from("card_game_sessions")
        .update({ state_json: next, status: next.status, revision: next.revision, updated_at: new Date().toISOString() })
        .eq("id", session.id)
        .eq("revision", session.revision)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) return respond({ error: "The game moved on — refresh and try again." }, 409);
      if (session.code) return respond(snapshot({ ...session, state_json: next, status: next.status, revision: next.revision }, await loadSeats(session.id)));
      return respond({ state: getPlayerView(def, next, playerId) });
    }

    return respond({ error: "Unknown operation." }, 400);
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Request failed." }, 400);
  }
});

