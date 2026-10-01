import { createClient } from "jsr:@supabase/supabase-js@2";
import { createGameState, applyMove, moveNotation } from "../../../src/games/chess/custom/engine/game.ts";
import { parseVariantJson } from "../../../src/games/chess/custom/engine/serialization.ts";
import type { GameState, GameVariant } from "../../../src/games/chess/custom/engine/types.ts";
import { resolveRequestedMove, sameVariantReference, validateOnlineVariant, variantReference, type MultiplayerVariantReference, type VariantMoveRequest } from "../../../src/games/chess/custom/multiplayer/protocol.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

type Match = {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  variant_id: string;
  schema_version: number;
  revision: number;
  configuration_hash: string;
  variant: GameVariant;
  state: GameState;
  history: Array<{ move: VariantMoveRequest; notation: string; team: string }>;
  status: "waiting" | "playing" | "finished";
  version: number;
};

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function roomCode() {
  const random = crypto.getRandomValues(new Uint8Array(6));
  return [...random].map((byte) => codeAlphabet[byte % codeAlphabet.length]).join("");
}
function reference(match: Match): MultiplayerVariantReference {
  return { variantId: match.variant_id, schemaVersion: match.schema_version, revision: match.revision, configurationHash: match.configuration_hash };
}
function snapshot(match: Match, userId: string) {
  return { code: match.code, role: match.host_id === userId ? "host" : "guest", status: match.status, version: match.version, variantReference: reference(match), variant: match.variant, state: match.state, history: match.history, players: { host: match.host_id, guest: match.guest_id } };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: cors });
  if (request.method !== "POST") return respond({ error: "POST required." }, 405);
  try {
    const authorization = request.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return respond({ error: "Sign in to play online." }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: authError } = await db.auth.getUser(authorization.slice(7));
    if (authError || !user) return respond({ error: "Sign in to play online." }, 401);
    const body = await request.json() as { op?: string; code?: string; variant?: unknown; variantReference?: MultiplayerVariantReference; move?: VariantMoveRequest };

    if (body.op === "create") {
      const raw = JSON.stringify(body.variant ?? null);
      if (raw.length > 500_000) return respond({ error: "Variant is too large for an online room." }, 400);
      const parsed = parseVariantJson(raw, { keepIdentity: true });
      if (!parsed.variant || parsed.errors.length) return respond({ error: parsed.errors.join(" ") || "Invalid variant." }, 400);
      const variant = parsed.variant;
      const errors = validateOnlineVariant(variant);
      if (errors.length) return respond({ error: errors.join(" "), validationErrors: errors }, 400);
      const state = createGameState(variant);
      const ref = await variantReference(variant);
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data, error } = await db.from("chess_custom_matches").insert({ code: roomCode(), host_id: user.id, variant_id: ref.variantId, schema_version: ref.schemaVersion, revision: ref.revision, configuration_hash: ref.configurationHash, variant, state, status: "waiting" }).select().single();
        if (data) return respond(snapshot(data as Match, user.id));
        if (error?.code !== "23505") throw error ?? new Error("Could not create room.");
      }
      return respond({ error: "Could not generate a room code. Try again." }, 503);
    }

    const code = body.code?.trim().toUpperCase() ?? "";
    if (!/^[A-Z2-9]{6}$/.test(code)) return respond({ error: "Enter a six-character room code." }, 400);
    const { data: existing, error: fetchError } = await db.from("chess_custom_matches").select().eq("code", code).maybeSingle();
    if (fetchError) throw fetchError;
    if (!existing) return respond({ error: "Room not found." }, 404);
    const match = existing as Match;

    if (body.op === "preview") {
      return respond({ code: match.code, status: match.status, variant: match.variant, host: match.host_id });
    }

    if (body.op === "join") {
      if (match.host_id === user.id || match.guest_id === user.id) return respond(snapshot(match, user.id));
      if (match.status !== "waiting" || match.guest_id) return respond({ error: "This room is already full." }, 409);
      const { data: joined, error } = await db.from("chess_custom_matches").update({ guest_id: user.id, status: "playing", version: match.version + 1, updated_at: new Date().toISOString() }).eq("id", match.id).eq("version", match.version).is("guest_id", null).select().maybeSingle();
      if (error) throw error;
      return joined ? respond(snapshot(joined as Match, user.id)) : respond({ error: "The room changed. Try joining again." }, 409);
    }

    if (match.host_id !== user.id && match.guest_id !== user.id) return respond({ error: "You are not a player in this room." }, 403);
    if (body.op === "get") return respond(snapshot(match, user.id));
    if (body.op !== "move") return respond({ error: "Unknown room action." }, 400);
    if (match.status !== "playing") return respond({ error: "This game is not accepting moves." }, 409);
    if (!body.variantReference || !sameVariantReference(reference(match), body.variantReference)) return respond({ error: "Variant version mismatch. Reload the room." }, 409);
    const actualReference = await variantReference(match.variant);
    if (!sameVariantReference(reference(match), actualReference)) return respond({ error: "Stored variant configuration does not match its hash." }, 409);
    const team = match.variant.teams[match.host_id === user.id ? 0 : 1]?.id;
    if (!team || match.state.turn !== team) return respond({ error: "It is not your turn." }, 409);
    if (!body.move || typeof body.move.pieceId !== "string" || !body.move.from || !body.move.to) return respond({ error: "Move coordinates are required." }, 400);
    const move = resolveRequestedMove(match.variant, match.state, body.move);
    if (!move) return respond({ error: "That move is not legal in this variant." }, 400);
    const state = applyMove(match.variant, match.state, move);
    const history = [...match.history, { move: { pieceId: move.pieceId, from: move.from, to: move.to, promotionPieceId: move.promotion }, notation: moveNotation(match.variant, match.state, move, state), team }];
    const { data: updated, error: updateError } = await db.from("chess_custom_matches").update({ state, history, status: state.result ? "finished" : "playing", version: match.version + 1, updated_at: new Date().toISOString() }).eq("id", match.id).eq("version", match.version).select().maybeSingle();
    if (updateError) throw updateError;
    return updated ? respond(snapshot(updated as Match, user.id)) : respond({ error: "The position changed. Reload the room." }, 409);
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "Room request failed." }, 400);
  }
});
