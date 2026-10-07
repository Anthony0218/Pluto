import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { entitiesForDifficulty, entitiesForScope, generateHigherLowerQuestions, generateQuestions, statValue, validateAnswer } from "../src/games/atlas/engine.ts";
import { createAuthoritativeSubmission, verifyMatchDataset } from "../src/games/atlas/multiplayer.ts";
import { applyMapFillSelection, createMapFillState, haversineKm } from "../src/games/atlas/rules.ts";

const countries = JSON.parse(await readFile(new URL("../data/geography/countries.json", import.meta.url), "utf8"));
const version = JSON.parse(await readFile(new URL("../data/geography/version.json", import.meta.url), "utf8")).atlasDataVersion;
const base = { entities: countries, datasetVersion: version, seed: "atlas-test-seed", difficulty: "intermediate", scope: "un195", categories: ["countries", "capitals", "flags", "population", "area", "continents", "languages", "borders", "currency"], count: 24 };

test("Atlas question generation is deterministic from dataset version and seed", () => {
  assert.deepEqual(generateQuestions({ ...base, interaction: "mixed" }), generateQuestions({ ...base, interaction: "mixed" }));
  assert.notDeepEqual(generateQuestions({ ...base, seed: "different", interaction: "mixed" }).map((question) => question.entityId), generateQuestions({ ...base, interaction: "mixed" }).map((question) => question.entityId));
});

test("map click validation uses canonical entity IDs", () => {
  const [question] = generateQuestions({ ...base, categories: ["locations"], interaction: "map_click", count: 1 });
  assert.equal(question.interaction, "map_click");
  assert.equal(validateAnswer(question, question.entityId), true);
  assert.equal(validateAnswer(question, "country:ZZZ"), false);
});

test("population and area higher/lower compare normalized sourced values", () => {
  for (const category of ["population", "area"]) {
    const [question] = generateQuestions({ ...base, categories: [category], interaction: "mixed", count: 1 });
    assert.equal(question.interaction, "higher_lower");
    assert.equal(question.answer, question.stat.secondValue > question.stat.firstValue ? "higher" : "lower");
    assert.ok(question.sourceMetadata.some((metadata) => metadata.year));
  }
  const germany = countries.find((country) => country.iso3 === "DEU");
  assert.equal(statValue(germany, "neighborCount"), germany.neighbors.length);
});

test("generic higher/lower registry generates all initial stats", () => {
  const questions = generateHigherLowerQuestions({ entities: countries, datasetVersion: version, seed: "stats", difficulty: "expert", stats: ["population", "areaKm2", "neighborCount", "officialLanguageCount"], count: 8 });
  assert.deepEqual(new Set(questions.map((question) => question.stat.key)), new Set(["population", "areaKm2", "neighborCount", "officialLanguageCount"]));
  assert.ok(questions.every((question) => validateAnswer(question, question.stat.secondValue > question.stat.firstValue ? "higher" : "lower")));
});

test("border multi-select requires exactly the displayed correct set", () => {
  const questions = generateQuestions({ ...base, categories: ["borders"], interaction: "mixed", count: 30 });
  const question = questions.find((candidate) => candidate.interaction === "multi_select" && candidate.answer.length > 0);
  assert.ok(question);
  assert.equal(validateAnswer(question, [...question.answer].reverse()), true);
  assert.equal(validateAnswer(question, question.answer.slice(1)), false);
});

test("country scopes and difficulty filters remain explicit", () => {
  const un195 = entitiesForScope(countries, "un195");
  assert.equal(un195.length, 195);
  assert.ok(un195.every((country) => country.playable && country.status === "un195"));
  assert.ok(entitiesForScope(countries, "territories").every((country) => country.status === "territory"));
  assert.ok(entitiesForDifficulty(un195, "beginner").length < entitiesForDifficulty(un195, "expert").length);
  assert.ok(entitiesForDifficulty(un195, "expert").some((country) => country.iso3 === "VAT"));
});

test("choice questions contain no duplicates and one correct answer", () => {
  const questions = generateQuestions({ ...base, interaction: "mixed", count: 80 });
  for (const question of questions.filter((candidate) => candidate.interaction === "single_choice")) {
    const ids = question.choices.map((choice) => choice.id);
    assert.equal(new Set(ids).size, ids.length, question.id);
    assert.equal(ids.filter((id) => id === question.answer).length, 1, question.id);
  }
});

test("Map Fill reaches completion and tracks mistakes and streak", () => {
  let state = createMapFillState(["country:FRA", "country:DEU"]);
  state = applyMapFillSelection(state, "country:ESP", "country:FRA");
  assert.equal(state.mistakes, 1);
  state = applyMapFillSelection(state, "country:FRA", "country:FRA");
  state = applyMapFillSelection(state, "country:DEU", "country:DEU");
  assert.equal(state.complete, true);
  assert.equal(state.found.length, 2);
  assert.equal(state.bestStreak, 2);
});

test("Haversine returns proper great-circle distance", () => {
  const londonToNewYork = haversineKm([-0.1276, 51.5072], [-74.006, 40.7128]);
  assert.ok(londonToNewYork > 5500 && londonToNewYork < 5650);
  assert.equal(haversineKm([10, 20], [10, 20]), 0);
});

test("multiplayer submission ignores client score and same seed yields same rounds", () => {
  const [question] = generateQuestions({ ...base, categories: ["locations"], interaction: "map_click", count: 1 });
  const submission = createAuthoritativeSubmission({ userId: "player-a", round: 0, answer: question.entityId, mode: "map_battle", question, submittedAt: 1000, score: 999999 });
  assert.equal("score" in submission, false);
  assert.equal(submission.correct, true);
  const first = generateQuestions({ ...base, interaction: "map_click" });
  const second = generateQuestions({ ...base, interaction: "map_click" });
  assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id));
});

test("dataset version mismatch is rejected", () => {
  assert.doesNotThrow(() => verifyMatchDataset(version, version));
  assert.throws(() => verifyMatchDataset(version, "old-snapshot"), /dataset mismatch/i);
});

test("the Edge Function never reads a client-supplied score", async () => {
  const source=await readFile(new URL("../supabase/functions/atlas-match/index.ts",import.meta.url),"utf8");
  assert.ok(!source.includes("body.score"));
});
