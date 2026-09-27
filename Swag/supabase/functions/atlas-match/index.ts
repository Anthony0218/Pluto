import { createClient } from "jsr:@supabase/supabase-js@2";
import { geoContains } from "npm:d3-geo@3.1.1";
import { feature } from "npm:topojson-client@3.1.0";
import countriesJson from "../../../data/geography/countries.json" with { type: "json" };
import versionJson from "../../../data/geography/version.json" with { type: "json" };
import topologyJson from "../../../public/data/geography/world-110m.json" with { type: "json" };
import { generateHigherLowerQuestions, generateQuestions } from "../../../src/games/atlas/engine.ts";
import { applyTerritoryRound, createAuthoritativeSubmission, resolveRoundScores, verifyMatchDataset, type AtlasMatchStatus, type AtlasMultiplayerMode, type ServerSubmission } from "../../../src/games/atlas/multiplayer.ts";
import type { AtlasQuestion, GeographicEntity } from "../../../src/games/atlas/types.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const countries = countriesJson as GeographicEntity[];
const ATLAS_VERSION = versionJson.atlasDataVersion;
const topology = topologyJson as { objects: { countries: unknown } };
const countryFeatures = (feature(topology as never, topology.objects.countries as never) as unknown as { features: { id?: string | number; geometry: unknown; type: "Feature" }[] }).features;
const shapeByGeometry = new Map(countryFeatures.map((item) => [String(item.id).padStart(3, "0"), item]));
const modes = new Set<AtlasMultiplayerMode>(["map_battle", "closest_wins", "higher_lower", "territory_battle"]);
type Player = { id: string; name: string; ready: boolean };
type Match = { id: string; room_code: string; mode: AtlasMultiplayerMode; host_id: string; players: Player[]; status: AtlasMatchStatus; dataset_version: string; seed: string; settings: { rounds?: number; allowSteal?: boolean; difficulty?: "beginner" | "intermediate" | "expert" }; round_index: number; round_started_at: string | null; round_ends_at: string | null; resolve_at: string | null; submissions: ServerSubmission[]; scores: Record<string, number>; ownership: Record<string, "player_a" | "player_b">; round_result: Record<string, unknown> | null; version: number };

const nameFor = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 32) || "Player" : "Player";
const roundsFor = (match: Match): AtlasQuestion[] => {
  const count = Math.min(30, Math.max(5, match.settings.rounds || (match.mode === "territory_battle" ? 20 : 10)));
  if (match.mode === "higher_lower") return generateHigherLowerQuestions({ entities: countries, datasetVersion: match.dataset_version, seed: match.seed, difficulty: match.settings.difficulty || "intermediate", stats: ["population", "areaKm2", "neighborCount", "officialLanguageCount"], count });
  const categories = match.mode === "territory_battle" ? ["countries", "capitals", "flags"] as const : ["locations", "countries", "capitals"] as const;
  const base = generateQuestions({ entities: countries, datasetVersion: match.dataset_version, seed: match.seed, difficulty: match.settings.difficulty || "intermediate", categories: [...categories], interaction: "map_click", count });
  if (match.mode !== "closest_wins") return base;
  return base.map((question) => question.interaction === "map_click" && question.targetCoordinates ? { ...question, interaction: "closest_click", answer: question.targetCoordinates, targetCoordinates: question.targetCoordinates } : question);
};
const publicQuestion = (question: AtlasQuestion | undefined) => {
  if (!question) return null;
  const { answer: _answer, ...safe } = question;
  void _answer;
  if (question.interaction === "higher_lower") return { ...safe, stat: { ...question.stat, secondValue: undefined } };
  return safe;
};
const snapshot = (match: Match, userId: string) => {
  const seat = match.players.findIndex((player) => player.id === userId);
  if (seat < 0) throw new Error("You are not a participant in this room.");
  const question = roundsFor(match)[match.round_index];
  const resolved = ["round_resolving", "next_round", "finished"].includes(match.status);
  return { code: match.room_code, mode: match.mode, hostId: match.host_id, players: match.players, seat, status: match.status, datasetVersion: match.dataset_version, settings: match.settings, roundIndex: match.round_index, rounds: roundsFor(match).length, roundStartedAt: match.round_started_at, roundEndsAt: match.round_ends_at, scores: match.scores, ownership: match.ownership, question: publicQuestion(question), submitted: match.submissions.some((item) => item.round === match.round_index && item.userId === userId), opponentSubmitted: match.submissions.some((item) => item.round === match.round_index && item.userId !== userId), roundResult: resolved ? match.round_result : null, version: match.version };
};

function resolveCurrentRound(match: Match, now: number): void {
  const question = roundsFor(match)[match.round_index];
  if (!question) { match.status = "finished"; return; }
  const current = match.submissions.filter((item) => item.round === match.round_index);
  const result = resolveRoundScores({ submissions: current, playerIds: match.players.map((player) => player.id), roundStartedAt: Date.parse(match.round_started_at || new Date(now).toISOString()), roundDurationMs: 15_000, currentScores: match.scores });
  match.scores = result.scores;
  if (match.mode === "territory_battle" && match.players.length === 2) {
    const territory = applyTerritoryRound({ ownership: match.ownership, scores: { player_a: 0, player_b: 0 } }, question.entityId, result.winnerId, [match.players[0].id, match.players[1].id], match.settings.allowSteal !== false);
    match.ownership = territory.ownership;
  }
  match.round_result = { winnerId: result.winnerId, answer: question.answer, entityId: question.entityId, submissions: current.map((item) => ({ userId: item.userId, answer: item.answer, correct: item.correct, distanceKm: item.distanceKm, responseMs: item.submittedAt - Date.parse(match.round_started_at || new Date(now).toISOString()) })) };
  match.status = "round_resolving";
  match.resolve_at = new Date(now + 1800).toISOString();
}

function advanceByClock(match: Match, now: number): boolean {
  let changed = false;
  if ((match.status === "countdown" || match.status === "next_round") && match.round_started_at && now >= Date.parse(match.round_started_at)) {
    match.status = "round_active"; match.round_ends_at = new Date(now + 15_000).toISOString(); changed = true;
  }
  if (match.status === "round_active" && match.round_ends_at && now >= Date.parse(match.round_ends_at)) { resolveCurrentRound(match, now); changed = true; }
  if (match.status === "round_resolving" && match.resolve_at && now >= Date.parse(match.resolve_at)) {
    if (match.round_index + 1 >= roundsFor(match).length) match.status = "finished";
    else { match.round_index += 1; match.status = "next_round"; match.round_started_at = new Date(now + 1400).toISOString(); match.round_ends_at = null; match.round_result = null; }
    changed = true;
  }
  return changed;
}

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
      if (!modes.has(body.mode as AtlasMultiplayerMode)) throw new Error("Unknown Atlas mode.");
      verifyMatchDataset(ATLAS_VERSION, String(body.datasetVersion || ""));
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => alphabet[byte % alphabet.length]).join("");
        const seed = crypto.randomUUID();
        const player = { id: user.id, name: nameFor(body.name), ready: false };
        const mode = body.mode as AtlasMultiplayerMode;
        const settings = { rounds: mode === "territory_battle" ? 20 : 10, allowSteal: true, difficulty: body.difficulty === "expert" || body.difficulty === "beginner" ? body.difficulty : "intermediate" };
        const { data, error } = await db.from("atlas_matches").insert({ room_code: code, mode, host_id: user.id, players: [player], dataset_version: ATLAS_VERSION, seed, settings, scores: { [user.id]: 0 } }).select().single();
        if (!error) return respond(snapshot(data as Match, user.id));
        if (error.code !== "23505") throw new Error("Could not create Atlas room.");
      }
      throw new Error("Could not allocate a room code.");
    }
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error("Invalid room code.");
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data, error } = await db.from("atlas_matches").select().eq("room_code", code).maybeSingle();
      if (error) throw new Error("Could not load room.");
      if (!data) return respond({ error: "Room not found." }, 404);
      const match = data as Match;
      verifyMatchDataset(match.dataset_version, String(body.datasetVersion || ""));
      const seat = match.players.findIndex((player) => player.id === user.id);
      const now = Date.now();
      let changed = advanceByClock(match, now);
      if (body.op === "join") {
        if (seat < 0) {
          if (match.players.length >= 2 || match.status !== "waiting") throw new Error("This room is already full.");
          match.players.push({ id: user.id, name: nameFor(body.name), ready: false }); match.scores[user.id] = 0; changed = true;
        }
      } else if (seat < 0) return respond({ error: "Join this room first." }, 403);
      else if (body.op === "ready") {
        match.players[seat].ready = true; match.status = "ready"; changed = true;
        if (match.players.length === 2 && match.players.every((player) => player.ready)) { match.status = "countdown"; match.round_started_at = new Date(now + 3000).toISOString(); }
      } else if (body.op === "submit") {
        if (match.status !== "round_active") throw new Error("This round is not accepting answers.");
        if (match.round_ends_at && now > Date.parse(match.round_ends_at)) { resolveCurrentRound(match, now); changed = true; }
        else if (match.submissions.some((item) => item.round === match.round_index && item.userId === user.id)) throw new Error("Answer already submitted.");
        else {
          const question = roundsFor(match)[match.round_index];
          const submission = createAuthoritativeSubmission({ userId: user.id, round: match.round_index, answer: body.answer, mode: match.mode, question, submittedAt: now });
          if (match.mode === "closest_wins" && Array.isArray(submission.answer) && question.interaction === "closest_click" && question.targetGeometryId) {
            const targetShape = shapeByGeometry.get(question.targetGeometryId);
            if (targetShape && geoContains(targetShape as never, submission.answer)) submission.distanceKm = 0;
          }
          match.submissions.push(submission);
          changed = true;
          if (match.submissions.filter((item) => item.round === match.round_index).length === match.players.length) resolveCurrentRound(match, now);
        }
      } else if (body.op === "rematch") {
        if (match.status !== "finished") throw new Error("Finish this match first.");
        match.seed = crypto.randomUUID(); match.players = match.players.map((player) => ({ ...player, ready: false })); match.status = "ready"; match.round_index = 0; match.round_started_at = null; match.round_ends_at = null; match.resolve_at = null; match.submissions = []; match.scores = Object.fromEntries(match.players.map((player) => [player.id, 0])); match.ownership = {}; match.round_result = null; changed = true;
      } else if (body.op !== "get") throw new Error("Unknown operation.");
      if (!changed) return respond(snapshot(match, user.id));
      const { data: updated, error: updateError } = await db.from("atlas_matches").update({ players: match.players, status: match.status, seed: match.seed, round_index: match.round_index, round_started_at: match.round_started_at, round_ends_at: match.round_ends_at, resolve_at: match.resolve_at, submissions: match.submissions, scores: match.scores, ownership: match.ownership, round_result: match.round_result, version: match.version + 1, updated_at: new Date().toISOString() }).eq("id", match.id).eq("version", match.version).select().maybeSingle();
      if (updateError) throw new Error("Could not save match.");
      if (updated) return respond(snapshot(updated as Match, user.id));
      if (body.op !== "get") return respond({ error: "Room changed. Latest state restored." }, 409);
    }
    return respond({ error: "Room is busy. Please retry." }, 409);
  } catch (cause) { return respond({ error: cause instanceof Error ? cause.message : "Request failed." }, 400); }
});
