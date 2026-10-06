import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import countriesJson from "../../../data/geography/countries.json" with { type: "json" };
import versionJson from "../../../data/geography/version.json" with { type: "json" };
import extrasJson from "../../../data/geography/extras.json" with { type: "json" };
import topologyJson from "../../../public/data/geography/world-110m.json" with { type: "json" };
import { COMPARISON_CATEGORIES, DEFAULT_COMPARISON_STATS, QUESTION_CATEGORIES, parseSelection, usesMapCategories } from "../../../src/games/atlas/categories.ts";
import { generateMatchQuestions } from "../../../src/games/atlas/matchQuestions.ts";
import { chooseRandomModes, gameWinner, seriesComplete, seriesLength } from "../../../src/games/atlas/randomSeries.ts";
import { rankedModes, maxModeBans, sanitizeBans, chooseRankedSeries, RANKED_CONFIG } from "../../../src/games/atlas/ranked.ts";
import { calculateMatchResult, type Rating } from "../../../src/games/atlas/rankedRating.ts";
import { GUESS_SCORING } from "../../../src/games/atlas/config.ts";
import { ATLAS_MULTIPLAYER_MODES, clampPlayers, createAuthoritativeSubmission, isRaceMode, isRoundMode, raceComplete, raceScores, resolveGuessTip, resolveRoundScores, verifyMatchDataset, type AtlasMatchStatus, type AtlasMultiplayerMode, type ServerSubmission } from "../../../src/games/atlas/multiplayer.ts";
import { isFillScope, type FillScope } from "../../../src/games/atlas/scopes.ts";
import { countryShapesFromTopology } from "../../../src/games/atlas/territoryDistance.ts";
import { battleView, createBattleMatch, nextBattleRound, pickBattleCard, rerollBattleMatchHand, revealBattlePicks, type BattleMatchState, type BattleSeat } from "../../../src/games/atlas/trials/battleMatch.ts";
import { buildTrialCountries, type TrialCountry } from "../../../src/games/atlas/trials/countryStats.ts";
import { toPublicQuestion } from "../../../src/games/atlas/publicQuestion.ts";
import { applyRaceAction, createRaceRun, raceQuestions, raceView, raceDuration, type RaceRun } from "../../../src/games/atlas/serverRace.ts";
import { challengeTierFromRating, generateAdvancedQuestions, type ChallengeTier } from "../../../src/games/atlas/advancedQuestions.ts";
import { createTerritoryCampaign, planTerritory, answerTerritory, resolveTerritory, territoryKnowledge, territoryStrategyScores, territoryView, type TerritoryCampaign, type TerritorySeat } from "../../../src/games/atlas/territoryStrategy.ts";
import flagsJson from "./flag-media.json" with { type: "json" };
import type { AtlasCategory, AtlasDifficulty, AtlasExtras, AtlasQuestion, AtlasStatKey, GeographicEntity } from "../../../src/games/atlas/types.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const countries = countriesJson as GeographicEntity[];
const extras = extrasJson as unknown as AtlasExtras;
const ATLAS_VERSION = versionJson.atlasDataVersion;
// Closest Wins measures pins against real borders, so a pin anywhere inside the target country is 0 km.
const shapes = countryShapesFromTopology(topologyJson);
const modes = new Set<AtlasMultiplayerMode>(ATLAS_MULTIPLAYER_MODES);
const ROUND_MS = 20_000, TIP_MS = GUESS_SCORING.tipSeconds * 1000;
// Stat Battle: each player has this long to lay a card face down, then both stay on the table for the reveal.
const PICK_MS = 30_000, REVEAL_MS = 4_200;
const tipDuration=(match:Match)=>match.match_kind==="ranked"?12_000:TIP_MS;
const pickDuration=(match:Match)=>match.match_kind==="ranked"?20_000:PICK_MS;
const trialPools = new Map<AtlasDifficulty, TrialCountry[]>();
const trialPool = (difficulty: AtlasDifficulty) => {
  if (!trialPools.has(difficulty)) trialPools.set(difficulty, buildTrialCountries(countries, extras, difficulty));
  return trialPools.get(difficulty)!;
};
const trialById = () => new Map(trialPool("expert").map((country) => [country.id, country]));
type Player = { id: string; name: string; ready: boolean };
type Match = { id: string; room_code: string; mode: AtlasMultiplayerMode; match_kind: "casual" | "ranked"; created_at: string; host_id: string; players: Player[]; status: AtlasMatchStatus; dataset_version: string; seed: string; settings: { rounds?: number; allowSteal?: boolean; difficulty?: "beginner" | "intermediate" | "expert"; maxPlayers?: number; categories?: AtlasCategory[]; stats?: AtlasStatKey[]; scope?: FillScope; challengeTier?: ChallengeTier; randomBestOf?: 1 | 3 | 5 }; round_index: number; tip_index?: number; round_started_at: string | null; round_ends_at: string | null; resolve_at: string | null; submissions: ServerSubmission[]; scores: Record<string, number>; ownership: Record<string, "player_a" | "player_b">; round_result: Record<string, unknown> | null; state?: MatchState | null; version: number };
/** Live state of the modes that are not question rounds: race standings and the Stat Battle table. */
type RankedSeries = { bans: Record<string, string[]>; order: AtlasMultiplayerMode[]; gameIndex: number; wins: Record<string, number>; results: { mode: AtlasMultiplayerMode; winnerId: string | null; scores: Record<string, number> }[] };
type MatchState = { attempts?:{userId:string;cycle:number;correct:boolean;concept:string;elapsedMs:number}[];  race?: Record<string, RaceRun>; duel?: BattleMatchState; ranked?: RankedSeries; casualSeries?: RankedSeries; strategy?: TerritoryCampaign; tie?: { mode: AtlasMultiplayerMode; attempt: number; baseScores: Record<string,number> }; requests?: Record<string,string[]> };

const nameFor = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 32) || "Player" : "Player";
const maxPlayers = (match: Match) => match.settings.maxPlayers || 2;
const deckCache = new Map<string,AtlasQuestion[]>();
const raceCache = new Map<string,ReturnType<typeof raceQuestions>>();
const data = { countries, extras, topology:topologyJson, version:versionJson };
const generation = (match:Match) => `${match.id}:${match.state?.ranked?.gameIndex ?? match.state?.casualSeries?.gameIndex ?? 0}:${match.mode}:${match.round_started_at}`;
const questionKey = (match:Match) => `${generation(match)}:${match.round_index}:${match.tip_index ?? 0}`;
const raceDeck = (match:Match) => {
  if (!isRaceMode(match.mode)) throw new Error("This mode has no race deck.");
  const key = match.seed;
  if (!raceCache.has(key)) { if(raceCache.size >= 32)raceCache.delete(raceCache.keys().next().value!); raceCache.set(key,raceQuestions(data,match.mode,match.seed,match.settings.difficulty||"intermediate",match.settings.scope,match.settings.categories,match.settings.challengeTier)); }
  return raceCache.get(key)!;
};
const roundsFor = (match: Match): AtlasQuestion[] => {
  if (!isRoundMode(match.mode)||match.mode==="territory_battle") return [];
  const count = match.state?.tie ? 3 : Math.min(30, Math.max(match.match_kind==="ranked"?3:5, match.settings.rounds || (match.mode === "guess_country" ? 4 : 8)));
  const key=`${match.seed}:${match.mode}:${count}:${match.settings.challengeTier}`;
  if(deckCache.has(key))return deckCache.get(key)!;
  const tier=match.settings.challengeTier||"standard";
  const advanced=tier!=="standard" && ["map_battle","closest_wins"].includes(match.mode);
  const deck = advanced ? generateAdvancedQuestions(countries,match.seed,count,tier,true) : generateMatchQuestions({ entities: countries, extras, datasetVersion: match.dataset_version, seed: match.seed,
    difficulty: match.settings.difficulty || "intermediate", count, mode: match.mode,
    categories: match.settings.categories, stats: match.settings.stats });
  const converted=advanced&&match.mode==="closest_wins"?deck.map(q=>{if(q.interaction!=="map_click"||!q.targetCoordinates)throw new Error("Missing target");return {...q,interaction:"closest_click" as const,answer:q.targetCoordinates,targetCoordinates:q.targetCoordinates};}):deck;
  if(deckCache.size>=64)deckCache.delete(deckCache.keys().next().value!);
  deckCache.set(key,converted);return converted;
};
// Inline media removes ISO filenames and SVG metadata from mystery flags. No answer seed or target IDs go on the wire.
const media = (path:string|null|undefined) => path ? (flagsJson as Record<string,string>)[path] ?? null : null;
const safeMedia = <T extends ReturnType<typeof toPublicQuestion>>(safe:T):T => {
  if("flagAsset"in safe)safe.flagAsset=media(safe.flagAsset);
  if(safe.interaction==="single_choice") { safe.promptFlagAsset=media(safe.promptFlagAsset);safe.choices=safe.choices.map(c=>({...c,flagAsset:media(c.flagAsset)})); }
  if(safe.interaction==="guess_country")safe.clues=safe.clues.map(c=>({...c,flagAsset:media(c.flagAsset)}));
  return safe;
};
const publicQuestion=(question:AtlasQuestion|undefined,match:Match,resolved:boolean)=>question&&["round_active","round_resolving","finished"].includes(match.status)?safeMedia(toPublicQuestion(question,questionKey(match),resolved,match.tip_index||0)):null;
const safeRaceView=(run:RaceRun,match:Match)=>{const view=raceView(run,raceDeck(match),generation(match));if(view.question&&view.question.interaction!=="ordering"&&view.question.interaction!=="clues")view.question=safeMedia(view.question);return view;};
const tipOf = (submission: ServerSubmission) => submission.tip ?? 0;
const snapshot = (match: Match, userId: string) => {
  const seat = match.players.findIndex((player) => player.id === userId);
  if (seat < 0) throw new Error("You are not a participant in this room.");
  const series = match.state?.ranked ?? match.state?.casualSeries;
  const question = roundsFor(match)[match.round_index];
  const resolved = ["round_resolving", "next_round", "finished"].includes(match.status);
  const tip = match.tip_index || 0;
  const thisTip = match.submissions.filter((item) => item.round === match.round_index && tipOf(item) === tip);
  // Earlier missed guesses of this country are public: they narrow the field for everyone.
  const missedGuesses = match.mode === "guess_country" ? match.submissions.filter((item) => item.round === match.round_index && (tipOf(item) < tip || resolved)).map((item) => ({ userId: item.userId, tip: tipOf(item), answer: String(item.answer), correct: resolved ? item.correct : false })) : [];
  return { id: match.id, code: match.room_code, mode: match.mode, ranked: match.match_kind === "ranked", series: series ? { ...series, bans: match.status === "draft" ? { [userId]: series.bans[userId] ?? [] } : series.bans, submittedCount: Object.keys(series.bans).length } : undefined, hostId: match.host_id, players: match.players, seat, maxPlayers: maxPlayers(match), status: match.status, datasetVersion: match.dataset_version, settings: match.settings, roundIndex: match.round_index, rounds: match.mode==="territory_battle" ? 6 : roundsFor(match).length, tipIndex: tip, tipCount: question?.interaction === "guess_country" ? question.clues.length : 1, roundStartedAt: match.round_started_at, roundEndsAt: match.round_ends_at, scores: match.scores, ownership: match.ownership, question: publicQuestion(question, match, resolved), submitted: thisTip.some((item) => item.userId === userId), submittedAnswer: thisTip.find((item) => item.userId === userId)?.answer ?? null, opponentSubmitted: thisTip.some((item) => item.userId !== userId), submittedIds: thisTip.map((item) => item.userId), guesses: missedGuesses, roundResult: resolved ? match.round_result : null, version: match.version,
    // Only this participant’s current race question and card hand are exposed.
    ...(isRaceMode(match.mode) ? { race: Object.fromEntries(Object.entries(match.state?.race??{}).map(([id,run])=>[id,{score:run.score,done:run.done,updatedAt:run.updatedAt,finishedAt:run.finishedAt}])), run:match.state?.race?.[userId] ? safeRaceView(match.state.race[userId],match) : null } : {}),
    ...(match.mode==="territory_battle"&&match.state?.strategy ? { strategy: territoryView(match.state.strategy,seat===0?"player_a":"player_b",countries,match.settings.difficulty||"intermediate",generation(match),resolved) } : {}),
    tiebreak:match.state?.tie ? {attempt:match.state.tie.attempt,mode:match.state.tie.mode} : undefined,
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
    if (!guess.solved && tip + 1 < question.clues.length) { match.tip_index = tip + 1; match.round_started_at = new Date(now).toISOString(); match.round_ends_at = new Date(now + tipDuration(match)).toISOString(); return; }
    match.scores = guess.scores;
    match.round_result = { winnerId: guess.awards[0]?.userId ?? null, answer: question.answer, entityId: question.entityId, tip, awards: guess.awards, submissions: tipSubmissions.map((item) => ({ userId: item.userId, answer: item.answer, correct: item.correct, responseMs: item.submittedAt - Date.parse(match.round_started_at || new Date(now).toISOString()) })) };
    match.status = "round_resolving";
    match.resolve_at = new Date(now + 4500).toISOString();
    return;
  }
  const result = resolveRoundScores({ submissions: current, playerIds: match.players.map((player) => player.id), roundStartedAt: Date.parse(match.round_started_at || new Date(now).toISOString()), roundDurationMs: ROUND_MS, currentScores: match.scores });
  match.scores = match.state?.tie ? Object.fromEntries(match.players.map(p=>[p.id,(match.scores[p.id]??0)+(current.find(s=>s.userId===p.id)?.correct?1000:0)])) : result.scores;
  const previousOwner: string | null = null;
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
  // Ranked rooms require both players to confirm readiness. If either disappears
  // before the first round, the room expires without any rating change.
  // During play the existing round clocks continue: a disconnected player can
  // reconnect to the same room, but unanswered rounds earn no points. There is
  // no client-declared forfeit or rating change on a transport error.
  if (match.match_kind === "ranked" && ["waiting", "draft", "ready"].includes(match.status) && !match.state?.ranked?.results.length && now - Date.parse(match.created_at) > RANKED_CONFIG.prestartTimeoutMs * 4) {
    match.status = "cancelled";
    return true;
  }
  if ((match.status === "countdown" || match.status === "next_round") && match.round_started_at && now >= Date.parse(match.round_started_at)) {
    match.status = "round_active"; changed = true;
    if (isRaceMode(match.mode)) { match.state = { ...match.state, race: Object.fromEntries(match.players.map(p=>[p.id,createRaceRun(now)])) }; match.round_ends_at = new Date(now + raceDuration(match.mode)).toISOString(); }
    else if(match.mode === "territory_battle") { match.state = {...match.state,strategy:createTerritoryCampaign(countries,match.seed)};match.round_ends_at=new Date(now+40_000).toISOString(); }
    else if (match.mode === "stat_battle") { match.state = { ...match.state, duel: createBattleMatch(trialPool(match.settings.difficulty || "intermediate"), match.seed) }; syncDuelScores(match); match.round_ends_at = new Date(now + pickDuration(match)).toISOString(); }
    else match.round_ends_at = new Date(now + (match.mode === "guess_country" ? tipDuration(match) : ROUND_MS)).toISOString();
  }
  if(match.status==="intermission" && match.resolve_at && now>=Date.parse(match.resolve_at)) {
    match.status="countdown";match.round_started_at=new Date(now+3000).toISOString();match.resolve_at=null;return true;
  }
  if(match.mode==="territory_battle" && match.state?.strategy) {
    if(match.status==="round_active"&&match.round_ends_at&&now>=Date.parse(match.round_ends_at)) {
      let strategy=match.state.strategy;
      for(const seat of ["player_a","player_b"] as TerritorySeat[]) {
        if(!strategy.plans[seat])strategy=planTerritory(strategy,seat,strategy.homes[seat]);
        if(strategy.plans[seat]!.correct===undefined) strategy={...strategy,plans:{...strategy.plans,[seat]:{...strategy.plans[seat]!,correct:false}}};
      }
      finishStrategyCycle(match,strategy,now);changed=true;
    }
    if(match.status==="round_resolving"&&match.resolve_at&&now>=Date.parse(match.resolve_at)) {
      if(match.state.strategy.done)match.status="finished";
      else {match.status="round_active";match.round_index=match.state.strategy.cycle;match.round_started_at=new Date(now).toISOString();match.round_ends_at=new Date(now+40_000).toISOString();}
      match.resolve_at=null;changed=true;
    }
    return changed;
  }
  if (isRaceMode(match.mode)) {
    // Out of time: the race closes with whatever scores were reported.
    if (match.status === "round_active" && match.round_ends_at && now >= Date.parse(match.round_ends_at)) { match.state={...match.state,race:Object.fromEntries(Object.entries(match.state?.race??{}).map(([id,run])=>[id,{...run,done:true,finishedAt:run.finishedAt??now}]))};match.status = "finished"; changed = true; }
    return changed;
  }
  if (match.mode === "stat_battle") {
    if (match.status === "round_active" && match.round_ends_at && now >= Date.parse(match.round_ends_at)) changed = revealDuel(match, now, true) || changed;
    if (match.status === "round_resolving" && match.resolve_at && now >= Date.parse(match.resolve_at) && match.state?.duel) {
      match.state = { ...match.state, duel: nextBattleRound(match.state.duel) };
      syncDuelScores(match);
      if (match.state.duel!.battle.phase === "finished" || (match.match_kind==="ranked" && match.round_index>=7)) match.status = "finished";
      else { match.status = "round_active"; match.round_index += 1; match.round_ends_at = new Date(now + pickDuration(match)).toISOString(); }
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

function finishStrategyCycle(match:Match,strategy:TerritoryCampaign,now:number) {
  const next=resolveTerritory(strategy);match.state={...match.state,strategy:next};
  const score=territoryStrategyScores(next);match.scores={[match.players[0].id]:score.player_a,[match.players[1].id]:score.player_b};
  match.status="round_resolving";match.resolve_at=new Date(now+4000).toISOString();match.round_ends_at=null;
}
function advanceRankedSeries(match: Match): void {
  const series = match.state?.ranked;
  if (match.match_kind !== "ranked" || match.status !== "finished" || !series || series.order.length !== 3 || series.results.length > series.gameIndex) return;
  const [a,b]=match.players.map(p=>p.id), scoreA=match.scores[a]??0,scoreB=match.scores[b]??0;
  const tie=match.state?.tie;
  if(scoreA===scoreB && (!tie || tie.attempt<2)) {
    match.state={ranked:series,tie:{mode:tie?.mode??match.mode,attempt:(tie?.attempt??0)+1,baseScores:tie?.baseScores??{...match.scores}}};
    match.mode="map_battle";match.seed=crypto.randomUUID();match.status="countdown";
    match.round_index=0;match.tip_index=0;match.round_started_at=new Date(Date.now()+3000).toISOString();match.round_ends_at=null;match.resolve_at=null;
    match.submissions=[];match.scores={[a]:0,[b]:0};match.round_result=null;return;
  }
  const winnerId=scoreA===scoreB?null:scoreA>scoreB?a:b;
  series.results.push({mode:tie?.mode??match.mode,winnerId,scores:tie?.baseScores??{...match.scores}});
  if(winnerId)series.wins[winnerId]=(series.wins[winnerId]??0)+1;
  if((winnerId&&series.wins[winnerId]>=2)||series.results.length===3) {
    match.scores={[a]:series.wins[a]??0,[b]:series.wins[b]??0};return;
  }
  series.gameIndex+=1;match.mode=series.order[series.gameIndex];
  match.settings={...match.settings,rounds:match.mode==="guess_country"?4:8,maxPlayers:2};
  match.seed=crypto.randomUUID();match.status="intermission";
  match.players=match.players.map(p=>({...p,ready:false}));match.round_index=0;match.tip_index=0;
  match.round_started_at=null;match.round_ends_at=null;match.resolve_at=new Date(Date.now()+45_000).toISOString();
  match.submissions=[];match.scores={[a]:0,[b]:0};match.ownership={};match.round_result=null;match.state={ranked:series};
}

/** Casual random series use server scores and retain every game's result across mode changes. */
function advanceCasualSeries(match: Match): void {
  const series = match.state?.casualSeries;
  if (match.match_kind !== "casual" || match.status !== "finished" || !series || series.results.length !== series.gameIndex) return;
  const scores = { ...match.scores }, winnerId = gameWinner(scores);
  series.results.push({ mode: match.mode, winnerId, scores });
  if (winnerId) series.wins[winnerId] = (series.wins[winnerId] ?? 0) + 1;
  if (seriesComplete(series.order.length, series.results)) {
    match.scores = Object.fromEntries(match.players.map(player => [player.id, series.wins[player.id] ?? 0]));
    return;
  }
  series.gameIndex += 1;
  match.mode = series.order[series.gameIndex];
  match.settings = { ...match.settings, rounds: match.mode === "guess_country" ? 8 : 10 };
  match.seed = crypto.randomUUID(); match.status = "intermission";
  match.players = match.players.map(player => ({ ...player, ready: false }));
  match.round_index = 0; match.tip_index = 0; match.round_started_at = null; match.round_ends_at = null;
  match.resolve_at = new Date(Date.now() + 45_000).toISOString();
  match.submissions = []; match.scores = Object.fromEntries(match.players.map(player => [player.id, 0]));
  match.ownership = {}; match.round_result = null; match.state = { casualSeries: series };
}

async function settleRanked(db: SupabaseClient, match: Match): Promise<void> {
  if (match.match_kind !== "ranked" || match.status !== "finished" || match.players.length !== 2 || !match.state?.ranked || (match.state.ranked.results.length < 3 && Math.max(0,...Object.values(match.state.ranked.wins)) < 2)) return;
  const [a, b] = match.players.map((player) => player.id);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: existing, error: existingError } = await db.from("atlas_ranked_results").select("match_id").eq("match_id", match.id).maybeSingle();
    if (existingError) throw new Error("Could not check Ranked result.");
    if (existing) return;
    const { data: profiles, error } = await db.from("atlas_ranked_profiles").select("*").in("user_id", [a, b]);
    if (error) throw new Error("Could not load Ranked ratings.");
    const asRating = (id: string): Rating => {
      const row = profiles?.find((item) => item.user_id === id);
      return row ? { rating: row.rating, deviation: row.deviation, volatility: row.volatility, matchesPlayed: row.matches_played } : { rating: 1500, deviation: 350, volatility: 0.06, matchesPlayed: 0 };
    };
    const beforeA = asRating(a), beforeB = asRating(b);
    const result = (match.scores[a] ?? 0) > (match.scores[b] ?? 0) ? "a" : (match.scores[a] ?? 0) < (match.scores[b] ?? 0) ? "b" : "draw";
    const after = calculateMatchResult(beforeA, beforeB, result);
    const { error: applyError } = await db.rpc("atlas_apply_ranked_result", { p_match: match.id, p_before_a: beforeA, p_after_a: after.a, p_before_b: beforeB, p_after_b: after.b });
    if (!applyError) return;
    if (!applyError.message.includes("STALE_RATING")) throw new Error("Could not save Ranked result.");
  }
  throw new Error("Ranked rating changed during settlement. Retry loading the room.");
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
    if (body.op === "rankedProfile" || body.op === "rankedBans") {
      const { error: createError } = await db.from("atlas_ranked_profiles").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
      if (createError) throw new Error("Could not initialize Ranked profile.");
      if (body.op === "rankedBans") {
        if (!Array.isArray(body.bans) || !body.bans.every((item) => typeof item === "string")) throw new Error("Invalid mode bans.");
        const bans = sanitizeBans(body.bans);
        if (body.bans.length !== bans.length || bans.length > maxModeBans()) throw new Error(`Choose up to ${maxModeBans()} Ranked mode bans.`);
        const { error } = await db.from("atlas_ranked_profiles").update({ mode_bans: bans, updated_at: new Date().toISOString() }).eq("user_id", user.id);
        if (error) throw new Error("Could not save mode bans.");
      }
      const { data, error } = await db.from("atlas_ranked_profiles").select("*").eq("user_id", user.id).single();
      if (error) throw new Error("Could not load Ranked profile.");
      return respond(data);
    }
    if (body.op === "rankedQueue") {
      if (!['queue', 'status', 'leave'].includes(String(body.action))) throw new Error("Invalid queue action.");
      if (typeof body.session !== "string" || !/^[0-9a-f-]{36}$/i.test(body.session)) throw new Error("Invalid queue session.");
      verifyMatchDataset(ATLAS_VERSION, String(body.datasetVersion || ""));
      const { data, error } = await db.rpc("atlas_ranked_queue_action", {
        p_user: user.id, p_session: body.session, p_op: body.action, p_name: nameFor(body.name),
        p_modes: rankedModes().map((mode) => mode.online), p_dataset: ATLAS_VERSION,
      });
      if (error) throw new Error(`Could not update Ranked queue: ${error.message}`);
      return respond(data);
    }
    if (body.op === "create") {
      if (!modes.has(body.mode as AtlasMultiplayerMode)) throw new Error("Unknown Atlas mode.");
      verifyMatchDataset(ATLAS_VERSION, String(body.datasetVersion || ""));
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => alphabet[byte % alphabet.length]).join("");
        const seed = crypto.randomUUID();
        const player = { id: user.id, name: nameFor(body.name), ready: false };
        const mode = body.mode as AtlasMultiplayerMode;
        const randomBestOf = body.randomBestOf === undefined ? undefined : seriesLength(body.randomBestOf);
        if (randomBestOf !== undefined && body.randomBestOf !== randomBestOf) throw new Error("Choose one game, best of 3 or best of 5.");
        const order = randomBestOf ? chooseRandomModes(ATLAS_MULTIPLAYER_MODES, randomBestOf, mode, () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) as AtlasMultiplayerMode[] : undefined;
        const settings = { rounds: mode === "territory_battle" ? 20 : mode === "guess_country" ? 8 : 10, allowSteal: true, difficulty: body.difficulty === "expert" || body.difficulty === "beginner" ? body.difficulty : "intermediate", maxPlayers: randomBestOf ? 2 : clampPlayers(mode, body.maxPlayers), ...(randomBestOf ? { randomBestOf } : {}),
          ...(usesMapCategories(mode) || randomBestOf ? { categories: parseSelection(body.categories, QUESTION_CATEGORIES, QUESTION_CATEGORIES.map(({ id }) => id)) } : {}),
          ...(mode === "map_fill" || randomBestOf ? { scope: body.scope === undefined ? "Europe" : isFillScope(body.scope) ? body.scope : (() => { throw new Error("Unknown map region."); })() } : {}),
          ...(mode === "higher_lower" || randomBestOf ? { stats: parseSelection(body.stats, COMPARISON_CATEGORIES, DEFAULT_COMPARISON_STATS) } : {}),
        };
        const { data, error } = await db.from("atlas_matches").insert({ room_code: code, mode, host_id: user.id, players: [player], dataset_version: ATLAS_VERSION, seed, settings, ...(order ? { state: { casualSeries: { bans: {}, order, gameIndex: 0, wins: {}, results: [] } } } : {}), scores: { [user.id]: 0 } }).select().single();
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
      if(match.dataset_version!==ATLAS_VERSION) throw new Error("This room belongs to an older Arena version. Start a new room.");
      verifyMatchDataset(match.dataset_version, String(body.datasetVersion || ""));
      const seat = match.players.findIndex((player) => player.id === user.id);
      const now = Date.now();
      if (seat < 0 && body.op !== "join") return respond({error:"Join this room first."},403);
      if (seat < 0 && match.match_kind === "ranked") return respond({error:"Ranked rooms are assigned by matchmaking."},403);
      if (typeof body.requestId === "string" && match.state?.requests?.[user.id]?.includes(body.requestId)) return respond(snapshot(match,user.id));
      let changed = advanceByClock(match, now);
      if (changed && match.status === "cancelled") {
        const { data: cancelled, error: cancelError } = await db.from("atlas_matches").update({ status: "cancelled", version: match.version + 1, updated_at: new Date().toISOString() }).eq("id", match.id).eq("version", match.version).select().maybeSingle();
        if (cancelError) throw new Error("Could not cancel expired Ranked match.");
        if (cancelled) return respond(snapshot(cancelled as Match, user.id));
        continue;
      }
      if (body.op === "join") {
        if (match.match_kind === "ranked" && seat < 0) throw new Error("Ranked rooms are assigned by matchmaking.");
        if (seat < 0) {
          if (match.players.length >= maxPlayers(match) || !["waiting", "ready"].includes(match.status)) throw new Error("This room is already full.");
          match.players.push({ id: user.id, name: nameFor(body.name), ready: false }); match.scores[user.id] = 0; changed = true;
        }
      } else if (seat < 0) return respond({ error: "Join this room first." }, 403);
      else if (body.op === "ban") {
        if (match.match_kind !== "ranked" || match.status !== "draft" || !match.state?.ranked) throw new Error("Mode bans are closed.");
        if (match.state.ranked.bans[user.id]) throw new Error("Your bans are already locked.");
        if (!Array.isArray(body.bans) || !body.bans.every((item) => typeof item === "string")) throw new Error("Invalid mode bans.");
        const bans = sanitizeBans(body.bans);
        if (bans.length !== body.bans.length || bans.length > maxModeBans()) throw new Error(`Choose up to ${maxModeBans()} mode bans.`);
        match.state.ranked.bans[user.id] = bans;
        if (Object.keys(match.state.ranked.bans).length === 2) {
          const [a, b] = match.players.map((player) => player.id);
          const order = chooseRankedSeries(rankedModes().map((item) => item.online), match.state.ranked.bans[a], match.state.ranked.bans[b], () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) as AtlasMultiplayerMode[];
          match.state.ranked.order = order;
          match.mode = order[0];
          const {data:ratings,error:ratingError}=await db.from("atlas_ranked_profiles").select("rating").in("user_id",[a,b]);
          if(ratingError)throw new Error("Could not calibrate Ranked questions.");
          const tier=challengeTierFromRating((ratings??[]).reduce((sum,row)=>sum+row.rating,0)/2);
          match.settings = { challengeTier:tier, rounds: match.mode === "guess_country" ? 4 : 8, allowSteal: true, difficulty: match.settings.difficulty || "intermediate", maxPlayers: 2 };
          match.status = "ready";
        }
        changed = true;
      } else if (body.op === "ready") {
        if (!["waiting", "ready", "intermission"].includes(match.status)) throw new Error("This room is not waiting for players.");
        match.players[seat].ready = true; if (match.status !== "intermission") match.status = "ready"; changed = true;
        if (match.players.length === maxPlayers(match) && match.players.every((player) => player.ready)) { match.status = "countdown"; match.round_started_at = new Date(now + 3000).toISOString(); }
      } else if (body.op === "start") {
        // The host may begin a 3–4 seat room early once everybody present is ready.
        if (match.host_id !== user.id) throw new Error("Only the host can start early.");
        if (!["waiting", "ready"].includes(match.status) || match.players.length < 2 || !match.players.every((player) => player.ready)) throw new Error("Everyone in the room must be ready first.");
        match.status = "countdown"; match.round_started_at = new Date(now + 3000).toISOString(); changed = true;
      } else if (body.op === "progress") {
        throw new Error("Client scores are not accepted. Submit an answer instead.");
      } else if(body.op === "race") {
        if(!isRaceMode(match.mode)||match.status!=="round_active")throw new Error("The run is not accepting answers.");
        const run=match.state?.race?.[user.id];if(!run)throw new Error("Run not initialized.");
        const next=applyRaceAction(run,raceDeck(match),generation(match),match.mode,body.action,body.questionId,body.answer,now);
        const race={...match.state?.race,[user.id]:next};match.state={...match.state,race};
        match.scores=raceScores(race,match.players.map(p=>p.id));
        if(raceComplete(race,match.players.map(p=>p.id)))match.status="finished";
        changed=true;
      } else if(body.op === "strategy") {
        if(match.mode!=="territory_battle"||match.status!=="round_active"||!match.state?.strategy)throw new Error("Wait for the next strategy cycle.");
        const side:TerritorySeat=seat===0?"player_a":"player_b";
        const view=territoryView(match.state.strategy,side,countries,match.settings.difficulty||"intermediate",generation(match));
        if(body.cycle!==match.state.strategy.cycle)throw new Error("This strategy cycle changed.");
        let strategy=match.state.strategy;
        if(body.action==="plan"&&typeof body.target==="string")strategy=planTerritory(strategy,side,body.target);
        else if(body.action==="answer"&&view.question?.id===body.questionId)strategy=answerTerritory(strategy,side,territoryKnowledge(strategy,side,countries,match.settings.difficulty||"intermediate"),body.answer as string|string[]);
        else throw new Error("Invalid or stale strategy order.");
        if(body.action==="answer") {
          const q=territoryKnowledge(match.state.strategy,side,countries,match.settings.difficulty||"intermediate");
          match.state={...match.state,attempts:[...(match.state.attempts??[]),{userId:user.id,cycle:strategy.cycle,correct:strategy.plans[side]!.correct!,concept:`territory:${q.category}`,elapsedMs:now-Date.parse(match.round_started_at!)}]};
        }
        match.state={...match.state,strategy};
        if(strategy.plans.player_a?.correct!==undefined&&strategy.plans.player_b?.correct!==undefined)finishStrategyCycle(match,strategy,now);
        changed=true;
      } else if (body.op === "finish") {
        // The host can close a race when someone has left; unfinished runs keep their last reported score.
        if (!isRaceMode(match.mode)) throw new Error("Only races can be closed early.");
        if (match.host_id !== user.id) throw new Error("Only the host can end the race.");
        if (match.status !== "round_active" || match.match_kind === "ranked") throw new Error("This race cannot be ended early.");
        match.status = "finished"; changed = true;
      } else if (body.op === "reroll") {
        if(body.roundIndex!==match.round_index)throw new Error("This card round changed.");
        if (match.mode !== "stat_battle" || !match.state?.duel) throw new Error("This room has no card table.");
        if (match.status !== "round_active" || seat > 1) throw new Error("Wait for your next turn.");
        match.state = { ...match.state, duel: rerollBattleMatchHand(match.state.duel, seat as BattleSeat) };
        changed = true;
      } else if (body.op === "play") {
        if(body.roundIndex!==match.round_index)throw new Error("This card round changed.");
        if (match.mode !== "stat_battle" || !match.state?.duel) throw new Error("This room has no card table.");
        if (match.status !== "round_active") throw new Error("Wait for the next round.");
        if (seat > 1) throw new Error("Only the two duelists can play cards.");
        if (typeof body.card !== "string") throw new Error("Choose a card.");
        match.state = { ...match.state, duel: pickBattleCard(match.state.duel, seat as BattleSeat, body.card) };
        revealDuel(match, now, false);
        changed = true;
      } else if (body.op === "submit") {
        if (!isRoundMode(match.mode)||match.mode==="territory_battle") throw new Error("This room does not take round answers.");
        if(body.questionId!==questionKey(match))throw new Error("This question or tip changed. Latest state restored.");
        if (match.status !== "round_active") throw new Error("This round is not accepting answers.");
        if (match.round_ends_at && now > Date.parse(match.round_ends_at)) { resolveCurrentRound(match, now); changed = true; }
        else if (match.submissions.some((item) => item.round === match.round_index && tipOf(item) === (match.tip_index || 0) && item.userId === user.id)) throw new Error("Answer already submitted.");
        else {
          const question = roundsFor(match)[match.round_index];
          const submission = createAuthoritativeSubmission({ userId: user.id, round: match.round_index, answer: body.answer, mode: match.mode, question, submittedAt: now, shapes });
          submission.concept=`${match.mode}:${question.category}:${question.property??""}`;submission.elapsedMs=Math.max(0,now-Date.parse(match.round_started_at!));
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
        if (match.match_kind === "ranked") throw new Error("Queue again for a new Ranked match.");
        if (match.status !== "finished") throw new Error("Finish this match first.");
        match.seed = crypto.randomUUID(); match.players = match.players.map((player) => ({ ...player, ready: false })); match.status = "ready"; match.round_index = 0; match.tip_index = 0; match.round_started_at = null; match.round_ends_at = null; match.resolve_at = null; match.submissions = []; match.scores = Object.fromEntries(match.players.map((player) => [player.id, 0])); match.ownership = {}; match.round_result = null; match.state = {};
        if (match.settings.randomBestOf) {
          const order = chooseRandomModes(ATLAS_MULTIPLAYER_MODES, match.settings.randomBestOf) as AtlasMultiplayerMode[];
          match.mode = order[0]; match.settings.rounds = match.mode === "guess_country" ? 8 : 10;
          match.state = { casualSeries: { bans: {}, order, gameIndex: 0, wins: {}, results: [] } };
        }
        changed = true;
      } else if (body.op === "cancel") {
        if (match.match_kind !== "ranked" || !["waiting", "draft", "ready", "countdown"].includes(match.status) || match.state?.ranked?.results.length) throw new Error("This match has already started.");
        match.status = "cancelled"; changed = true;
      } else if (body.op !== "get") throw new Error("Unknown operation.");
      if (match.status === "finished" && match.match_kind === "ranked" && match.state?.ranked && match.state.ranked.results.length === match.state.ranked.gameIndex) { advanceRankedSeries(match); changed = true; }
      if (match.status === "finished" && match.state?.casualSeries && match.state.casualSeries.results.length === match.state.casualSeries.gameIndex) { advanceCasualSeries(match); changed = true; }
      if (!changed) { await settleRanked(db, match); return respond(snapshot(match, user.id)); }
      if(typeof body.requestId==="string"&&body.requestId.length<=64&&body.op!=="get")match.state={...match.state,requests:{...match.state?.requests,[user.id]:[...(match.state?.requests?.[user.id]??[]),body.requestId].slice(-16)}};
      const { data: updated, error: updateError } = await db.from("atlas_matches").update({ mode: match.mode, settings: match.settings, players: match.players, status: match.status, seed: match.seed, round_index: match.round_index, tip_index: match.tip_index || 0, round_started_at: match.round_started_at, round_ends_at: match.round_ends_at, resolve_at: match.resolve_at, submissions: match.submissions, scores: match.scores, ownership: match.ownership, round_result: match.round_result, state: match.state ?? {}, version: match.version + 1, updated_at: new Date().toISOString() }).eq("id", match.id).eq("version", match.version).select().maybeSingle();
      if (updateError) throw new Error("Could not save match.");
      if (updated) { await settleRanked(db, updated as Match); return respond(snapshot(updated as Match, user.id)); }
      // Reads and race scores are safe to re-apply on the fresh row; anything else must be retried by the player.
      // Re-read and validate the generation again after a compare-and-swap collision.
    }
    return respond({ error: "Room is busy. Please retry." }, 409);
  } catch (cause) { return respond({ error: cause instanceof Error ? cause.message : "Request failed." }, 400); }
});
