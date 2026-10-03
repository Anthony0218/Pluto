import { createClient } from "jsr:@supabase/supabase-js@2";
import { applyGoMove, createInitialGoState, isLegalGoMove, type GoMove, type GoState } from "../../../src/games/go/rules.ts";
import { GO_RANKED_DEFAULT_MODE, GO_RANKED_BOARD_SIZE, GO_RANKED_KOMI, isGoTimeControl } from "../../../src/games/go/ranked/config.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return respond({ error: "POST required." }, 405);
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return respond({ error: "Sign in to play ranked Go." }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await db.auth.getUser(authorization.slice(7));
    if (authError || !user) return respond({ error: "Session expired." }, 401);
    const raw = await request.text();
    if (raw.length > 4096) return respond({ error: "Request too large." }, 413);
    const body = JSON.parse(raw) as Record<string, unknown>;
    if (["queue", "queueStatus", "leaveQueue"].includes(String(body.op))) {
      if (typeof body.sessionId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.sessionId)) throw new Error("Invalid queue session.");
      const control = body.timeControl ?? GO_RANKED_DEFAULT_MODE;
      if (!isGoTimeControl(control)) throw new Error("Unknown time control.");
      const { data, error } = await db.rpc("go_ranked_queue_action", { p_user: user.id, p_session: body.sessionId, p_op: body.op, p_name: typeof body.name === "string" ? body.name : "Player", p_time_control: control, p_initial_state: createInitialGoState(GO_RANKED_BOARD_SIZE, GO_RANKED_KOMI) });
      if (error) throw new Error(error.message);
      return respond(data);
    }
    if (typeof body.code !== "string" || !/^[A-Z0-9]{12}$/i.test(body.code)) throw new Error("Invalid game code.");
    const { data: game, error: loadError } = await db.from("go_ranked_games").select("id,black_id,white_id").eq("code", body.code.toUpperCase()).maybeSingle();
    if (loadError) throw new Error(loadError.message);
    if (!game) return respond({ error: "Game not found." }, 404);
    if (user.id !== game.black_id && user.id !== game.white_id) return respond({ error: "Only the matched players can access this game." }, 403);
    if (!["snapshot", "ready", "move", "resign", "abandon"].includes(String(body.op))) throw new Error("Unknown game operation.");
    const { data: snapshot, error: clockError } = await db.rpc("go_ranked_action", { p_game_id: game.id, p_user: user.id, p_op: body.op === "ready" ? "ready" : "snapshot" });
    if (clockError) throw new Error(clockError.message);
    let result = snapshot;
    if (["move", "resign", "abandon"].includes(String(body.op)) && ["ready", "playing"].includes(snapshot.game.status)) {
      let next: GoState | null = null;
      let reason: string | null = null;
      if (body.op === "move") {
        const state = snapshot.game.state as GoState;
        if (snapshot.game.status !== "playing") throw new Error("Waiting for both players.");
        if (user.id !== (state.currentPlayer === "black" ? game.black_id : game.white_id)) throw new Error("Not your turn.");
        const move = body.move as GoMove | undefined;
        if (!move || !["place", "pass"].includes(move.type) || (move.type === "place" && (!Number.isInteger(move.row) || !Number.isInteger(move.col))) || !isLegalGoMove(state, move)) throw new Error("Illegal Go move.");
        next = applyGoMove(state, move);
        reason = next.status === "finished" ? next.winner === "draw" ? "jigo" : "area score" : null;
      }
      if (body.op !== "abandon" && !Number.isInteger(body.version)) throw new Error("Invalid game version.");
      const { data, error } = await db.rpc("go_ranked_action", { p_game_id: game.id, p_user: user.id, p_op: body.op, p_version: body.version ?? null, p_state: next, p_reason: reason });
      if (error) return respond({ error: error.message }, error.message.includes("Stale") ? 409 : 400);
      result = data;
    }
    const ids = [game.black_id, game.white_id];
    const [{ data: profiles, error: profilesError }, { data: ratings, error: ratingsError }] = await Promise.all([
      db.from("profiles").select("id,username,display_name,avatar_id").in("id", ids),
      db.from("go_ratings").select("user_id,rating").in("user_id", ids).eq("time_control", result.game.time_control),
    ]);
    if (profilesError || ratingsError) throw new Error(profilesError?.message ?? ratingsError?.message);
    return respond({ ...result, players: ids.map(id => {
      const profile = profiles?.find(p => p.id === id);
      return { user_id: id, color: id === game.black_id ? "black" : "white", username: profile?.display_name || profile?.username || "Player", avatar_id: profile?.avatar_id ?? "m1", rating: ratings?.find(r => r.user_id === id)?.rating ?? 1200 };
    }) });
  } catch (error) { return respond({ error: error instanceof Error ? error.message : "Ranked Go request failed." }, 400); }
});
