import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { COMPARISON_CATEGORIES, DEFAULT_COMPARISON_STATS, QUESTION_CATEGORIES, parseSelection } from "../src/games/atlas/categories.ts";
import { generateComparisonQuestions } from "../src/games/atlas/comparisons.ts";
import { generateMatchQuestions } from "../src/games/atlas/matchQuestions.ts";
import { applyTerritoryRound, createAuthoritativeSubmission, resolveRoundScores, territoryPlayerScores } from "../src/games/atlas/multiplayer.ts";
import { haversineKm } from "../src/games/atlas/rules.ts";
import { countryShapesFromTopology, distanceToTerritory } from "../src/games/atlas/territoryDistance.ts";

const read = async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), "utf8"));
const entities = await read("../data/geography/countries.json");
const extras = await read("../data/geography/extras.json");
const datasetVersion = (await read("../data/geography/version.json")).atlasDataVersion;
const shapes = countryShapesFromTopology(await read("../public/data/geography/world-110m.json"));
const base = { entities, extras, datasetVersion, seed: "atlas-updates", difficulty: "intermediate", count: 20 };

test("each Higher or Lower category can sustain a full solo streak on every difficulty", () => {
  for (const difficulty of ["beginner", "intermediate", "expert"]) {
    for (const stat of DEFAULT_COMPARISON_STATS) {
      const questions = generateComparisonQuestions({ ...base, difficulty, count: 100, chain: true, stats: [stat] });
      assert.equal(questions.length, 100, `${difficulty}: ${stat}`);
      assert.ok(questions.every((question) => question.stat.key === stat));
      assert.ok(questions.every((question) => question.stat.firstValue !== question.stat.secondValue));
    }
  }
  const options = { ...base, mode: "higher_lower", stats: ["population", "officialLanguageCount"] };
  const questions = generateMatchQuestions(options);
  assert.deepEqual(questions, generateMatchQuestions(options));
  assert.deepEqual(new Set(questions.map((question) => question.stat.key)), new Set(options.stats));
});

test("map multiplayer modes respect chosen question categories", () => {
  for (const mode of ["map_battle", "closest_wins", "territory_battle"]) {
    const questions = generateMatchQuestions({ ...base, mode, categories: ["languages", "population"] });
    assert.equal(questions.length, base.count);
    assert.deepEqual(new Set(questions.map((question) => question.category)), new Set(["languages", "population"]));
    assert.ok(questions.every((question) => question.interaction === (mode === "closest_wins" ? "closest_click" : "map_click")));
  }
});

test("Closest Wins measures arbitrary pins and awards the nearest, even when submitted later", () => {
  const [question] = generateMatchQuestions({ ...base, mode: "closest_wins", count: 1 });
  const submit = (userId, answer, submittedAt) => createAuthoritativeSubmission({ userId, answer, submittedAt, question, mode: "closest_wins", round: 0, shapes });
  const close = submit("close", question.targetCoordinates, 14000);
  const far = submit("far", [0, -80], 100);
  assert.equal(close.distanceKm, 0);
  assert.ok(far.distanceKm > 1000 && far.distanceKm <= haversineKm(far.answer, question.targetCoordinates));
  assert.ok(Math.abs(haversineKm(far.answer, far.nearest) - far.distanceKm) < 1e-6);
  const result = resolveRoundScores({ submissions: [far, close], playerIds: ["far", "close"], roundStartedAt: 0, roundDurationMs: 15000, currentScores: { far: 0, close: 0 } });
  assert.equal(result.winnerId, "close");
  assert.deepEqual(result.scores, { far: 0, close: 1000 });
  for (const answer of [[181, 0], [0, 91], [NaN, 0], [Infinity, 0], "country:FRA", [0]]) {
    assert.throws(() => submit("bad", answer, 1000), /coordinate/i);
  }
  assert.ok(Number.isFinite(haversineKm([0, 0], [180, 0])));
});

test("Territory Battle offers recaptures and scores current ownership after steals", () => {
  const questions = generateMatchQuestions({ ...base, mode: "territory_battle", categories: ["countries"] });
  assert.equal(new Set(questions.map((question) => question.id)).size, 20);
  assert.deepEqual(new Set(questions.slice(0, 10).map((question) => question.entityId)), new Set(questions.slice(10).map((question) => question.entityId)));
  let state = { ownership: {}, scores: { player_a: 0, player_b: 0 } };
  for (const question of questions.slice(0, 10)) state = applyTerritoryRound(state, question.entityId, "a", ["a", "b"], true);
  assert.deepEqual(territoryPlayerScores(state.ownership, ["a", "b"]), { a: 10, b: 0 });
  for (const question of questions.slice(10)) state = applyTerritoryRound(state, question.entityId, "b", ["a", "b"], true);
  assert.deepEqual(territoryPlayerScores(state.ownership, ["a", "b"]), { a: 0, b: 10 });
  assert.deepEqual(applyTerritoryRound(state, questions[0].entityId, null, ["a", "b"], true), state);
  assert.deepEqual(applyTerritoryRound(state, questions[0].entityId, "a", ["a", "b"], false), state);
});

test("room category validation rejects empty or unsupported settings and retains defaults", () => {
  assert.deepEqual(parseSelection(undefined, COMPARISON_CATEGORIES, DEFAULT_COMPARISON_STATS), DEFAULT_COMPARISON_STATS);
  assert.deepEqual(parseSelection(["languages", "languages"], QUESTION_CATEGORIES, ["countries"]), ["languages"]);
  for (const invalid of [[], null, "population", ["unsupported"], ["population", 7]]) {
    assert.throws(() => parseSelection(invalid, QUESTION_CATEGORIES, ["countries"]), /supported category/);
  }
});

test("Closest Wins counts any pin inside the target country as 0 km and measures outside pins to the border", () => {
  const country = (iso3) => entities.find((entity) => entity.iso3 === iso3);
  const target = (iso3) => ({ geometryId: country(iso3).geometryId, point: country(iso3).centroid });
  // The dataset's reference point is the capital (Moscow); a pin deep in Siberia is still inside Russia.
  assert.equal(distanceToTerritory([100, 62], target("RUS"), shapes).distanceKm, 0);
  assert.equal(distanceToTerritory([178, -17.8], target("FJI"), shapes).distanceKm, 0);
  // Lesotho is a hole in South Africa: inside Lesotho, South Africa is a short distance away.
  assert.equal(distanceToTerritory([28, -29.5], target("LSO"), shapes).distanceKm, 0);
  assert.ok(distanceToTerritory([28, -29.5], target("ZAF"), shapes).distanceKm > 0);
  // Kansas lies roughly 1,000 km south of the 49th-parallel border with Canada.
  const kansas = distanceToTerritory([-100, 40], target("CAN"), shapes);
  assert.ok(kansas.distanceKm > 950 && kansas.distanceKm < 1050, String(kansas.distanceKm));
  // Microstates without an outline fall back to their reference point.
  assert.equal(distanceToTerritory([0, 0], target("VAT"), shapes).distanceKm, haversineKm([0, 0], country("VAT").centroid)-15);
  // Every mapped UN member contains its own capital, up to coarse 1:110m coastlines.
  for (const entity of entities.filter((item) => item.playable && item.status === "un195" && item.geometryId && item.capitalCoordinates)) {
    assert.ok(distanceToTerritory(entity.capitalCoordinates, target(entity.iso3), shapes).distanceKm < 160, entity.shortName);
  }
});
