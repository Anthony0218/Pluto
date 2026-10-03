import { createClient } from "jsr:@supabase/supabase-js@2";
import countriesJson from "../../../data/geography/countries.json" with { type: "json" };
import versionJson from "../../../data/geography/version.json" with { type: "json" };
import extrasJson from "../../../data/geography/extras.json" with { type: "json" };
import topologyJson from "../../../public/data/geography/world-110m.json" with { type: "json" };
import { COMPARISON_CATEGORIES, DEFAULT_COMPARISON_STATS, QUESTION_CATEGORIES, parseSelection, usesMapCategories } from "../../../src/games/atlas/categories.ts";
import { generateMatchQuestions } from "../../../src/games/atlas/matchQuestions.ts";
import { GUESS_SCORING } from "../../../src/games/atlas/config.ts";
import { ATLAS_MULTIPLAYER_MODES, RACE_LIMIT_MS, applyRaceProgress, applyTerritoryRound, clampPlayers, createAuthoritativeSubmission, isRaceMode, isRoundMode, raceComplete, raceScores, resolveGuessTip, resolveRoundScores, territoryPlayerScores, verifyMatchDataset, type AtlasMatchStatus, type AtlasMultiplayerMode, type RaceEntry, type ServerSubmission } from "../../../src/games/atlas/multiplayer.ts";
import { isFillScope, type FillScope } from "../../../src/games/atlas/scopes.ts";
import { countryShapesFromTopology } from "../../../src/games/atlas/territoryDistance.ts";
import { battleView, createBattleMatch, nextBattleRound, pickBattleCard, rerollBattleMatchHand, revealBattlePicks, type BattleMatchState, type BattleSeat } from "../../../src/games/atlas/trials/battleMatch.ts";
import { buildTrialCountries, type TrialCountry } from "../../../src/games/atlas/trials/countryStats.ts";
import type { AtlasCategory, AtlasDifficulty, AtlasExtras, AtlasQuestion, AtlasStatKey, GeographicEntity } from "../../../src/games/atlas/types.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const countries = countriesJson as GeographicEntity[];
const extras = extrasJson as unknown as AtlasExtras;
const ATLAS_VERSION = versionJson.atlasDataVersion;
// Closest Wins measures pins against real borders, so a pin anywhere inside the target country is 0 km.
const shapes = countryShapesFromTopology(topologyJson);
const modes = new Set<AtlasMultiplayerMode>(ATLAS_MULTIPLAYER_MODES);
const ROUND_MS = 15_000, TIP_MS = GUESS_SCORING.tipSeconds * 1000;
// Stat Battle: each player has this long to lay a card face down, then both stay on the table for the reveal.
const PICK_MS = 30_000, REVEAL_MS = 4_200;
const trialPools = new Map<AtlasDifficulty, TrialCountry[]>();
const trialPool = (difficulty: AtlasDifficulty) => {
  if (!trialPools.has(difficulty)) trialPools.set(difficulty, buildTrialCountries(countries, extras, difficulty));
  return trialPools.get(difficulty)!;
};
const trialById = () => new Map(trialPool("expert").map((country) => [country.id, country]));
type Player = { id: string; name: string; ready: boolean };
type Match = { id: string; room_code: string; mode: AtlasMultiplayerMode; host_id: string; players: Player[]; status: AtlasMatchStatus; dataset_version: string; seed: string; settings: { rounds?: number; allowSteal?: boolean; difficulty?: "beginner" | "intermediate" | "expert"; maxPlayers?: number; categories?: AtlasCategory[]; stats?: AtlasStatKey[]; scope?: FillScope }; round_index: number; tip_index?: number; round_started_at: string | null; round_ends_at: string | null; resolve_at: string | null; submissions: ServerSubmission[]; scores: Record<string, number>; ownership: Record<string, "player_a" | "player_b">; round_result: Record<string, unknown> | null; state?: MatchState | null; version: number };
/** Live state of the modes that are not question rounds: race standings and the Stat Battle table. */
type MatchState = { race?: Record<string, RaceEntry>; duel?: BattleMatchState };

const nameFor = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 32) || "Player" : "Player";
const maxPlayers = (match: Match) => match.settings.maxPlayers || 2;
const roundsFor = (match: Match): AtlasQuestion[] => {
  if (!isRoundMode(match.mode)) return [];
  const count = Math.min(30, Math.max(5, match.settings.rounds || (match.mode === "territory_battle" ? 20 : 10)));
  return generateMatchQuestions({ entities: countries, extras, datasetVersion: match.dataset_version, seed: match.seed,
    difficulty: match.settings.difficulty || "intermediate", count, mode: match.mode,
    categories: match.settings.categories, stats: match.settings.stats });
};
const publicQuestion = (question: AtlasQuestion | undefined, match: Match, resolved: boolean) => {
  if (!question) return null;
  const { answer: _answer, ...safe } = question;
  void _answer;
  if (question.interaction === "higher_lower") return resolved ? safe : { ...safe, stat: { ...question.stat, secondValue: undefined }, second: question.second && { ...question.second, note: undefined } };
  if (question.interaction === "closest_click" && !resolved) return { ...safe, targetCoordinates: undefined, targetGeometryId: undefined };
  // Unrevealed tips stay on the server.
  if (question.interaction === "guess_country") return { ...safe, clues: resolved ? question.clues : question.clues.slice(0, (match.tip_index || 0) + 1) };
  return safe;
};
const tipOf = (submission: ServerSubmission) => submission.tip ?? 0;
const snapshot = (match: Match, userId: string) => {
  const seat = match.players.findIndex((player) => player.id === userId);
  if (seat < 0) throw new Error("You are not a participant in this room.");
  const question = roundsFor(match)[match.round_index];
  const resolved = ["round_resolving", "next_round", "finished"].includes(match.status);
  const tip = match.tip_index || 0;
  const thisTip = match.submissions.filter((item) => item.round === match.round_index && tipOf(item) === tip);
  // Earlier missed guesses of this country are public: they narrow the field for everyone.
  const missedGuesses = match.mode === "guess_country" ? match.submissions.filter((item) => item.round === match.round_index && (tipOf(item) < tip || resolved)).map((item) => ({ userId: item.userId, tip: tipOf(item), answer: String(item.answer), correct: resolved ? item.correct : false })) : [];
  return { code: match.room_code, mode: match.mode, hostId: match.host_id, players: match.players, seat, maxPlayers: maxPlayers(match), status: match.status, datasetVersion: match.dataset_version, settings: match.settings, roundIndex: match.round_index, rounds: roundsFor(match).length, tipIndex: tip, tipCount: question?.interaction === "guess_country" ? question.clues.length : 1, roundStartedAt: match.round_started_at, roundEndsAt: match.round_ends_at, scores: match.scores, ownership: match.ownership, question: publicQuestion(question, match, resolved), submitted: thisTip.some((item) => item.userId === userId), submittedAnswer: thisTip.find((item) => item.userId === userId)?.answer ?? null, opponentSubmitted: thisTip.some((item) => item.userId !== userId), submittedIds: thisTip.map((item) => item.userId), guesses: missedGuesses, roundResult: resolved ? match.round_result : null, version: match.version,
    // Races play client-side from the shared seed; Stat Battle shows each seat only its own hand.
    ...(isRaceMode(match.mode) ? { seed: match.seed, race: match.state?.race ?? {} } : {}),
    ...(match.mode === "stat_battle" && match.state?.duel && seat < 2 ? { battle: battleView(match.state.duel, seat as BattleSeat) } : {}) };
};

function resolveCurrentRound(match: Match, now: number): void {
  const question = roundsFor(match)[match.round_index];
  if (!question) { match.status = "finished"; return; }
  const current = match.submissions.filter((item) => item.round === match.round_index);
  if (question.interaction === "guess_country") {
    const tip = match.tip_index || 0, tipSubmissions = current.filter((item) => tipOf(item) === tip);
    const guess = resolveGuessTip({ submissions: tipSubmissions, tip, currentScores: match.scores });
    // Nobody solved it: reveal the next tip and keep the round open.
    if (!guess.solved && tip + 1 < question.clues.length) { match.tip_index = tip + 1; match.round_ends_at = new Date(now + TIP_MS).toISOString(); return; }
    match.scores = guess.scores;
    match.round_result = { winnerId: guess.awards[0]?.userId ?? null, answer: question.answer, entityId: question.entityId, tip, awards: guess.awards, submissions: tipSubmissions.map((item) => ({ userId: item.userId, answer: item.answer, correct: item.correct, responseMs: item.submittedAt - Date.parse(match.round_started_at || new Date(now).toISOString()) })) };
    match.status = "round_resolving";
    match.resolve_at = new Date(now + 4500).toISOString();
    return;
  }
  const result = resolveRoundScores({ submissions: current, playerIds: match.players.map((player) => player.id), roundStartedAt: Date.parse(match.round_started_at || new Date(now).toISOString()), roundDurationMs: ROUND_MS, currentScores: match.scores });
  match.scores = result.scores;
  let previousOwner: string | null = null;
  if (match.mode === "territory_battle" && match.players.length === 2) {
    const owner = match.ownership[question.entityId];
    previousOwner = owner ? match.players[owner === "player_a" ? 0 : 1].id : null;
    const territory = applyTerritoryRound({ ownership: match.ownership, scores: { player_a: 0, player_b: 0 } }, question.entityId, result.winnerId, [match.players[0].id, match.players[1].id], match.settings.allowSteal !== false);
    match.ownership = territory.ownership;
    match.scores = territoryPlayerScores(match.ownership, [match.players[0].id, match.players[1].id]);
  }
  match.round_result = { winnerId: result.winnerId, answer: question.answer, entityId: question.entityId, previousOwner, submissions: current.map((item) => ({ userId: item.userId, answer: item.answer, correct: item.correct, distanceKm: item.distanceKm, nearest: item.nearest, responseMs: item.submittedAt - Date.parse(match.round_started_at || new Date(now).toISOString()) })) };
  match.status = "round_resolving";
  match.resolve_at = new Date(now + 1800).toISOString();
}

const duelIds = (match: Match): [string, string] => [match.players[0].id, match.players[1]?.id ?? ""];
function syncDuelScores(match: Match): void {
  const battle = match.state?.duel?.battle;
  if (!battle) return;
  const [first, second] = duelIds(match);
  match.scores = { [first]: battle.playerScore, [second]: battle.opponentScore };
}
/** Puts both Stat Battle cards on the table; `force` plays the first card for anyone out of time. */
function revealDuel(match: Match, now: number, force: boolean): boolean {
  const duel = match.state?.duel;
  if (!duel) return false;
  const next = revealBattlePicks(duel, trialById(), force);
  if (next === duel) return false;
  match.state = { ...match.state, duel: next };
  syncDuelScores(match);
  match.status = "round_resolving"; match.resolve_at = new Date(now + REVEAL_MS).toISOString(); match.round_ends_at = null;
  return true;
}

function advanceByClock(match: Match, now: number): boolean {
  let changed = false;
  if ((match.status === "countdown" || match.status === "next_round") && match.round_started_at && now >= Date.parse(match.round_started_at)) {
    match.status = "round_active"; changed = true;
    if (isRaceMode(match.mode)) { match.state = { race: {} }; match.round_ends_at = new Date(now + RACE_LIMIT_MS).toISOString(); }
    else if (match.mode === "stat_battle") { match.state = { duel: createBattleMatch(trialPool(match.settings.difficulty || "intermediate"), match.seed) }; syncDuelScores(match); match.round_ends_at = new Date(now + PICK_MS).toISOString(); }
    else match.round_ends_at = new Date(now + (match.mode === "guess_country" ? TIP_MS : ROUND_MS)).toISOString();
  }
  if (isRaceMode(match.mode)) {
    // Out of time: the race closes with whatever scores were reported.
    if (match.status === "round_active" && match.round_ends_at && now >= Date.parse(match.round_ends_at)) { match.status = "finished"; changed = true; }
    return changed;
  }
  if (match.mode === "stat_battle") {
    if (match.status === "round_active" && match.round_ends_at && now >= Date.parse(match.round_ends_at)) changed = revealDuel(match, now, true) || changed;
    if (match.status === "round_resolving" && match.resolve_at && now >= Date.parse(match.resolve_at) && match.state?.duel) {
      match.state = { ...match.state, duel: nextBattleRound(match.state.duel) };
      syncDuelScores(match);
      if (match.state.duel!.battle.phase === "finished") match.status = "finished";
      else { match.status = "round_active"; match.round_index += 1; match.round_ends_at = new Date(now + PICK_MS).toISOString(); }
      match.resolve_at = null; changed = true;
    }
    return changed;
  }
  if (match.status === "round_active" && match.round_ends_at && now >= Date.parse(match.round_ends_at)) { resolveCurrentRound(match, now); changed = true; }
  if (match.status === "round_resolving" && match.resolve_at && now >= Date.parse(match.resolve_at)) {
    if (match.round_index + 1 >= roundsFor(match).length) match.status = "finished";
    else { match.round_index += 1; match.tip_index = 0; match.status = "next_round"; match.round_started_at = new Date(now + 1400).toISOString(); match.round_ends_at = null; match.round_result = null; }
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
        const settings = { rounds: mode === "territory_battle" ? 20 : mode === "guess_country" ? 8 : 10, allowSteal: true, difficulty: body.difficulty === "expert" || body.difficulty === "beginner" ? body.difficulty : "intermediate", maxPlayers: clampPlayers(mode, body.maxPlayers),
          ...(usesMapCategories(mode) ? { categories: parseSelection(body.categories, QUESTION_CATEGORIES, mode === "territory_battle" ? ["countries", "capitals", "flags"] : mode === "speed_run" ? ["countries", "locations", "capitals", "flags"] : ["locations", "countries", "capitals"]) } : {}),
          ...(mode === "map_fill" ? { scope: body.scope === undefined ? "Europe" : isFillScope(body.scope) ? body.scope : (() => { throw new Error("Unknown map region."); })() } : {}),
          ...(mode === "higher_lower" ? { stats: parseSelection(body.stats, COMPARISON_CATEGORIES, DEFAULT_COMPARISON_STATS) } : {}),
        };
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
          if (match.players.length >= maxPlayers(match) || !["waiting", "ready"].includes(match.status)) throw new Error("This room is already full.");
          match.players.push({ id: user.id, name: nameFor(body.name), ready: false }); match.scores[user.id] = 0; changed = true;
        }
      } else if (seat < 0) return respond({ error: "Join this room first." }, 403);
      else if (body.op === "ready") {
        match.players[seat].ready = true; match.status = "ready"; changed = true;
        if (match.players.length === maxPlayers(match) && match.players.every((player) => player.ready)) { match.status = "countdown"; match.round_started_at = new Date(now + 3000).toISOString(); }
      } else if (body.op === "start") {
        // The host may begin a 3–4 seat room early once everybody present is ready.
        if (match.host_id !== user.id) throw new Error("Only the host can start early.");
        if (!["waiting", "ready"].includes(match.status) || match.players.length < 2 || !match.players.every((player) => player.ready)) throw new Error("Everyone in the room must be ready first.");
        match.status = "countdown"; match.round_started_at = new Date(now + 3000).toISOString(); changed = true;
      } else if (body.op === "progress") {
        if (!isRaceMode(match.mode)) throw new Error("This room is not a race.");
        if (match.status !== "round_active") throw new Error("The race is not running.");
        const race = applyRaceProgress(match.state?.race ?? {}, user.id, body.score, body.done, now, match.mode === "speed_run");
        match.state = { ...match.state, race };
        match.scores = raceScores(race, match.players.map((player) => player.id));
        if (raceComplete(race, match.players.map((player) => player.id))) match.status = "finished";
        changed = true;
      } else if (body.op === "finish") {
        // The host can close a race when someone has left; unfinished runs keep their last reported score.
        if (!isRaceMode(match.mode)) throw new Error("Only races can be closed early.");
        if (match.host_id !== user.id) throw new Error("Only the host can end the race.");
        if (match.status !== "round_active") throw new Error("The race is not running.");
        match.status = "finished"; changed = true;
      } else if (body.op === "reroll") {
        if (match.mode !== "stat_battle" || !match.state?.duel) throw new Error("This room has no card table.");
        if (match.status !== "round_active" || seat > 1) throw new Error("Wait for your next turn.");
        match.state = { ...match.state, duel: rerollBattleMatchHand(match.state.duel, seat as BattleSeat) };
        changed = true;
      } else if (body.op === "play") {
        if (match.mode !== "stat_battle" || !match.state?.duel) throw new Error("This room has no card table.");
        if (match.status !== "round_active") throw new Error("Wait for the next round.");
        if (seat > 1) throw new Error("Only the two duelists can play cards.");
        if (typeof body.card !== "string") throw new Error("Choose a card.");
        match.state = { ...match.state, duel: pickBattleCard(match.state.duel, seat as BattleSeat, body.card) };
        revealDuel(match, now, false);
        changed = true;
      } else if (body.op === "submit") {
        if (!isRoundMode(match.mode)) throw new Error("This room does not take answers.");
        if (match.status !== "round_active") throw new Error("This round is not accepting answers.");
        if (match.round_ends_at && now > Date.parse(match.round_ends_at)) { resolveCurrentRound(match, now); changed = true; }
        else if (match.submissions.some((item) => item.round === match.round_index && tipOf(item) === (match.tip_index || 0) && item.userId === user.id)) throw new Error("Answer already submitted.");
        else {
          const question = roundsFor(match)[match.round_index];
          const submission = createAuthoritativeSubmission({ userId: user.id, round: match.round_index, answer: body.answer, mode: match.mode, question, submittedAt: now, shapes });
          if (match.mode === "guess_country") {
            submission.tip = match.tip_index || 0;
            // The first correct guess starts a short last call for everyone else on this tip.
            const firstCorrect = submission.correct && !match.submissions.some((item) => item.round === match.round_index && tipOf(item) === submission.tip && item.correct);
            if (firstCorrect && match.round_ends_at) match.round_ends_at = new Date(Math.min(Date.parse(match.round_ends_at), now + GUESS_SCORING.afterFirstCorrectSeconds * 1000)).toISOString();
          }
          match.submissions.push(submission);
          changed = true;
          if (match.submissions.filter((item) => item.round === match.round_index && tipOf(item) === (match.tip_index || 0)).length === match.players.length) resolveCurrentRound(match, now);
        }
      } else if (body.op === "rematch") {
        if (match.status !== "finished") throw new Error("Finish this match first.");
        match.seed = crypto.randomUUID(); match.players = match.players.map((player) => ({ ...player, ready: false })); match.status = "ready"; match.round_index = 0; match.tip_index = 0; match.round_started_at = null; match.round_ends_at = null; match.resolve_at = null; match.submissions = []; match.scores = Object.fromEntries(match.players.map((player) => [player.id, 0])); match.ownership = {}; match.round_result = null; match.state = {}; changed = true;
      } else if (body.op !== "get") throw new Error("Unknown operation.");
      if (!changed) return respond(snapshot(match, user.id));
      const { data: updated, error: updateError } = await db.from("atlas_matches").update({ players: match.players, status: match.status, seed: match.seed, round_index: match.round_index, tip_index: match.tip_index || 0, round_started_at: match.round_started_at, round_ends_at: match.round_ends_at, resolve_at: match.resolve_at, submissions: match.submissions, scores: match.scores, ownership: match.ownership, round_result: match.round_result, state: match.state ?? {}, version: match.version + 1, updated_at: new Date().toISOString() }).eq("id", match.id).eq("version", match.version).select().maybeSingle();
      if (updateError) throw new Error("Could not save match.");
      if (updated) return respond(snapshot(updated as Match, user.id));
      // Reads and race scores are safe to re-apply on the fresh row; anything else must be retried by the player.
      if (body.op !== "get" && body.op !== "progress") return respond({ error: "Room changed. Latest state restored." }, 409);
    }
    return respond({ error: "Room is busy. Please retry." }, 409);
  } catch (cause) { return respond({ error: cause instanceof Error ? cause.message : "Request failed." }, 400); }
});
