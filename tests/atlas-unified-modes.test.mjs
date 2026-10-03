import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ARENA_MODES, hotseatPlayerLimit, modeForOnline, modeForTrial, onlinePlayerLimit } from "../src/games/atlas/modeCatalog.ts";
import { generateMatchQuestions } from "../src/games/atlas/matchQuestions.ts";
import { ATLAS_MULTIPLAYER_MODES, ATLAS_RACE_MODES, applyRaceProgress, isRaceMode, maxPlayersFor, raceComplete, raceScores } from "../src/games/atlas/multiplayer.ts";
import { closestScore, speedRunScore } from "../src/games/atlas/rules.ts";
import { generateQuestions } from "../src/games/atlas/engine.ts";
import { distanceToTerritory } from "../src/games/atlas/territoryDistance.ts";
import { LANGUAGE_GUESSER, languageRound } from "../src/games/atlas/trials/languageGuesser.ts";
import { continentOf, entitiesInFillScope, FILL_SCOPES, SCOPE_FOCUS } from "../src/games/atlas/scopes.ts";
import { battleView, createBattleMatch, nextBattleRound, pickBattleCard, rerollBattleMatchHand, revealBattlePicks } from "../src/games/atlas/trials/battleMatch.ts";
import { buildTrialCountries } from "../src/games/atlas/trials/countryStats.ts";
import { battleCategoryById, chooseOpponentCard, createBattle, playBattleCard, playBattleRound, rerollBattleHand } from "../src/games/atlas/trials/statBattle.ts";
import { seededRandom } from "../src/games/atlas/random.ts";

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const countries = await read("../data/geography/countries.json"), extras = await read("../data/geography/extras.json");
const version = (await read("../data/geography/version.json")).atlasDataVersion;
const pool = buildTrialCountries(countries, extras, "intermediate");
const byId = new Map(buildTrialCountries(countries, extras, "expert").map((country) => [country.id, country]));

test("the menu lists all fifteen modes in the agreed order, each playable three ways", () => {
  assert.deepEqual(ARENA_MODES.map((mode) => mode.title), [
    "Map Battle", "Closest Wins", "Higher or Lower", "Guess the Country", "Flag Battle", "Stat Ranking", "Stat Battle",
    "Region Builder", "Stat Detective", "Guess the Country Mini Edition", "Extreme Geography", "Territory Battle", "Speed Run", "Language Guesser", "Map Fill",
  ]);
  assert.equal(new Set(ARENA_MODES.map((mode) => mode.id)).size, ARENA_MODES.length);
  // Every online mode exists on the server and belongs to exactly one menu entry.
  assert.deepEqual([...ARENA_MODES.map((mode) => mode.online)].sort(), [...ATLAS_MULTIPLAYER_MODES].sort());
  for (const mode of ARENA_MODES) {
    assert.equal(modeForOnline(mode.online), mode);
    assert.ok(mode.rules.goal && mode.rules.play.length && mode.rules.scoring && mode.rules.solo && mode.rules.multiplayer && mode.rules.hotseat, mode.id);
    assert.ok(onlinePlayerLimit(mode) >= 2 && hotseatPlayerLimit(mode) >= 2);
  }
  // The former Atlas Trials keep their personal-best keys and old links.
  assert.equal(modeForTrial("country-guesser")?.id, "guess-country-mini");
  assert.equal(modeForTrial("country-guesser")?.bestId, "country-guesser");
  assert.equal(maxPlayersFor("stat_battle"), 2);
  assert.equal(maxPlayersFor("territory_battle"), 2);
  assert.equal(maxPlayersFor("stat_ranking"), 4);
});

test("Map Fill regions follow the everyday continents and their zoom boxes frame the capitals", () => {
  const members = entitiesInFillScope(countries, "World");
  assert.equal(members.length, 195);
  const south = entitiesInFillScope(countries, "South America"), north = entitiesInFillScope(countries, "North America");
  assert.equal(south.length, 12);
  assert.ok(south.some((entity) => entity.iso3 === "BRA") && !north.some((entity) => entity.iso3 === "BRA"));
  assert.ok(north.some((entity) => entity.iso3 === "MEX") && north.some((entity) => entity.iso3 === "CUB"));
  const regional = FILL_SCOPES.filter((scope) => scope !== "World");
  assert.equal(regional.reduce((total, scope) => total + entitiesInFillScope(countries, scope).length, 0), 195, "every country belongs to one region");
  for (const scope of regional) {
    const [[west, south_], [east, north_]] = SCOPE_FOCUS[scope];
    // Israel has no capital coordinates in the snapshot, so it cannot be checked here.
    const located = entitiesInFillScope(countries, scope).filter((entity) => entity.capitalCoordinates);
    const inside = located.filter((entity) => {
      const [longitude, latitude] = entity.capitalCoordinates;
      return longitude >= west && longitude <= east && latitude >= south_ && latitude <= north_;
    });
    const missing = located.filter((entity) => !inside.includes(entity)).map((entity) => entity.iso3);
    // Only Samoa and Tonga, east of the antimeridian, fall outside a zoom box.
    assert.deepEqual(missing.filter((iso3) => !["WSM", "TON"].includes(iso3)), [], `${scope}: ${missing}`);
    assert.ok(entitiesInFillScope(countries, scope).every((entity) => continentOf(entity) === scope));
  }
});

test("solo Closest Wins rewards distance smoothly, and solo/hotseat rounds come from the server generator", () => {
  assert.equal(closestScore(0), 1000);
  assert.equal(closestScore(0.2), 1000);
  assert.ok(Math.abs(closestScore(1000) - 513) <= 1);
  assert.ok(closestScore(5000) < 50);
  assert.equal(closestScore(Number.NaN), 0);
  for (let km = 1; km < 8000; km += 250) assert.ok(closestScore(km) >= closestScore(km + 250));
  const base = { entities: countries, extras, datasetVersion: version, seed: "hotseat", difficulty: "intermediate", categories: ["countries", "capitals", "flags"] };
  const closest = generateMatchQuestions({ ...base, count: 10, mode: "closest_wins" });
  assert.equal(closest.length, 10);
  assert.ok(closest.every((question) => question.interaction === "closest_click" && question.targetCoordinates));
  const territory = generateMatchQuestions({ ...base, count: 20, mode: "territory_battle" });
  assert.equal(territory.length, 20);
  // The second half revisits the first half's countries, so they can be stolen.
  assert.deepEqual(new Set(territory.slice(10).map((question) => question.entityId)), new Set(territory.slice(0, 10).map((question) => question.entityId)));
});

test("capital pin rounds have a city target and zero distance within its radius", () => {
  const questions = generateMatchQuestions({ entities: countries, extras, datasetVersion: version, seed: "city-pins", difficulty: "intermediate", categories: ["capitals"], count: 10, mode: "closest_wins" });
  const city = questions.find((question) => question.interaction === "closest_click" && question.targetRadiusKm === 20);
  assert.ok(city);
  assert.equal(city.targetGeometryId, null);
  assert.equal(distanceToTerritory(city.targetCoordinates, { geometryId: null, point: city.targetCoordinates, radiusKm: city.targetRadiusKm }).distanceKm, 0);
});

test("Speed Run uses choice questions and exact win/loss points", () => {
  const questions = generateQuestions({ entities: countries, datasetVersion: version, seed: "speed-choices", difficulty: "intermediate", categories: ["countries", "locations", "capitals", "flags"], interaction: "choice", count: 16 });
  assert.ok(questions.every((question) => question.interaction === "single_choice"));
  assert.ok(questions.filter((question) => question.category === "countries" || question.category === "locations").every((question) => !question.prompt.includes("highlighted")));
  assert.equal(speedRunScore(true), 150);
  assert.equal(speedRunScore(false), -50);
});

test("Language Guesser deals six distinct choices with one answer", () => {
  for (const difficulty of ["beginner", "intermediate", "expert"]) for (let index = 0; index < LANGUAGE_GUESSER.rounds; index++) {
    const round = languageRound("language-test", index, difficulty);
    assert.equal(round.options.length, 6);
    assert.equal(new Set(round.options).size, 6);
    assert.equal(round.options.filter((option) => option === round.language).length, 1);
    assert.ok(round.sentence.length > 10);
  }
});

test("race progress is validated, final once done, and completes when everybody has finished", () => {
  assert.ok(ATLAS_RACE_MODES.every(isRaceMode));
  assert.equal(isRaceMode("map_battle"), false);
  let race = applyRaceProgress({}, "a", 120, false, 1);
  race = applyRaceProgress(race, "a", 340.6, false, 2);
  assert.equal(race.a.score, 341);
  assert.throws(() => applyRaceProgress(race, "b", -5, false, 3));
  assert.equal(applyRaceProgress(race, "b", -50, false, 3, true).b.score, -50, "Speed Run permits a loss below zero");
  assert.throws(() => applyRaceProgress(race, "b", "100", false, 3));
  assert.throws(() => applyRaceProgress(race, "b", Infinity, false, 3));
  race = applyRaceProgress(race, "a", 500, true, 4);
  assert.deepEqual(race.a, { score: 500, done: true, updatedAt: 4, finishedAt: 4 });
  assert.throws(() => applyRaceProgress(race, "a", 900, true, 5), /already finished/);
  assert.equal(raceComplete(race, ["a", "b"]), false);
  race = applyRaceProgress(race, "b", 0, true, 6);
  assert.equal(raceComplete(race, ["a", "b"]), true);
  assert.deepEqual(raceScores(race, ["a", "b", "c"]), { a: 500, b: 0, c: 0 });
});

test("the AI duel still plays exactly as before through the shared two-card round", () => {
  const state = createBattle(pool, "same-seed", "normal");
  const card = state.player[2];
  const category = battleCategoryById(state.categoryId);
  const aiCard = chooseOpponentCard(state.opponent, category, state.level, byId, seededRandom(`${state.seed}:battle-ai:${state.round}`));
  assert.deepEqual(playBattleCard(state, card, byId), playBattleRound(state, card, aiCard, byId));
  assert.equal(playBattleRound(state, card, state.player[0], byId), state, "a card from the wrong hand is refused");
});

test("Stat Battle replaces all hand cards and limits each seat to three rerolls per game", () => {
  let solo = createBattle(pool, "reroll-solo", "normal");
  const firstHand = solo.player;
  solo = rerollBattleHand(solo, 0);
  assert.equal(solo.player.length, firstHand.length);
  assert.ok(solo.player.every((id) => !firstHand.includes(id)), "fresh deck cards replace the whole hand");
  assert.ok(solo.player.every((id) => !solo.opponent.includes(id)), "opponent cards stay private and unique");
  const allCards = [...solo.player, ...solo.opponent, ...solo.deck, ...solo.discard];
  assert.equal(new Set(allCards).size, allCards.length, "reroll neither loses nor duplicates cards");
  solo = rerollBattleHand(rerollBattleHand(solo, 0), 0);
  assert.equal(solo.rerolls[0], 3);
  assert.equal(rerollBattleHand(solo, 0), solo);
  assert.equal(solo.rerolls[1], 0);

  let match = createBattleMatch(pool, "reroll-duel");
  match = rerollBattleMatchHand(match, 1);
  assert.equal(battleView(match, 1).rerollsLeft, 2);
  assert.equal(battleView(match, 0).rerollsLeft, 3);
  match = pickBattleCard(match, 1, match.battle.opponent[0]);
  assert.throws(() => rerollBattleMatchHand(match, 1), /already on the table/);
});

test("two-player Stat Battle hides hands and picks until both cards are down", () => {
  let match = createBattleMatch(pool, "duel-seed");
  const first = battleView(match, 0), second = battleView(match, 1);
  assert.equal(first.hand.length, 5);
  assert.equal(second.opponentCards, 5);
  assert.ok(first.hand.every((id) => !second.hand.includes(id)), "hands never share a card");
  assert.throws(() => pickBattleCard(match, 0, second.hand[0]), /not in your hand/);
  match = pickBattleCard(match, 0, first.hand[1]);
  assert.throws(() => pickBattleCard(match, 0, first.hand[2]), /already played/);
  assert.equal(revealBattlePicks(match, byId), match, "one card down reveals nothing");
  assert.equal(battleView(match, 1).opponentPicked, true);
  assert.equal(battleView(match, 1).played, null);
  match = revealBattlePicks(pickBattleCard(match, 1, second.hand[0]), byId);
  assert.equal(match.battle.phase, "reveal");
  const mine = battleView(match, 0).played, theirs = battleView(match, 1).played;
  assert.equal(mine.mine, first.hand[1]);
  assert.equal(theirs.mine, second.hand[0]);
  assert.equal(mine.myValue, theirs.theirValue);
  assert.equal(mine.winner === "tie", theirs.winner === "tie");
  if (mine.winner !== "tie") assert.notEqual(mine.winner, theirs.winner);
  assert.equal(battleView(match, 0).myScore + battleView(match, 0).theirScore, mine.winner === "tie" ? 0 : 1);
  match = nextBattleRound(match);
  assert.equal(match.battle.round, 2);
  assert.equal(battleView(match, 0).hand.length, 5, "hands are refilled");
  // A timeout plays the first card of whoever has not chosen.
  const forced = revealBattlePicks(match, byId, true);
  assert.equal(forced.battle.played.player, match.battle.player[0]);
  assert.equal(forced.battle.played.opponent, match.battle.opponent[0]);
  // Played to the end, the duel finishes with one side on the target (or the deck runs dry).
  let game = createBattleMatch(pool, "full-duel");
  for (let guard = 0; game.battle.phase !== "finished" && guard < 80; guard += 1) game = nextBattleRound(revealBattlePicks(game, byId, true));
  assert.equal(game.battle.phase, "finished");
});
