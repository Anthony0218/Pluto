import { seededRandom } from "../src/games/atlas/random.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateComparisonQuestions, buildComparables } from "../src/games/atlas/comparisons.ts";
import { GUESS_SCORING } from "../src/games/atlas/config.ts";
import { validateAnswer } from "../src/games/atlas/engine.ts";
import { generateFlagQuestions, FLAG_CHOICES } from "../src/games/atlas/flags.ts";
import { countryClues, generateGuessCountryQuestions, scoreGuessTip } from "../src/games/atlas/guessCountry.ts";
import { clampPlayers, createAuthoritativeSubmission, maxPlayersFor, resolveGuessTip } from "../src/games/atlas/multiplayer.ts";

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const countries = await read("../data/geography/countries.json"), extras = await read("../data/geography/extras.json");
const version = (await read("../data/geography/version.json")).atlasDataVersion;
const base = { entities: countries, extras, datasetVersion: version, seed: "party-seed", difficulty: "intermediate" };
const byId = new Map(countries.map((country) => [country.id, country]));

test("extras are pinned to the dataset version and reference real UN members", async () => {
  assert.equal(extras.atlasDataVersion, version);
  assert.deepEqual(await read("../public/data/geography/extras.json"), extras);
  assert.ok(extras.cities.length >= 100);
  for (const city of extras.cities) { assert.equal(byId.get(city.countryId)?.status, "un195", city.name); assert.ok(city.population > 0); }
  assert.ok(Object.keys(extras.highestPoints).length >= 190);
  assert.equal(extras.highestPoints["country:NPL"].name, "Mount Everest");
  assert.ok(Object.values(extras.highestPoints).every((point) => point.elevationM > 0 && point.elevationM < 8900));
});

test("flag quiz alternates flag→name and outline→flag with four unique options", () => {
  const questions = generateFlagQuestions({ ...base, count: 16 });
  assert.deepEqual(questions, generateFlagQuestions({ ...base, count: 16 }));
  questions.forEach((question, index) => {
    assert.equal(question.choices.length, FLAG_CHOICES);
    assert.equal(new Set(question.choices.map((choice) => choice.id)).size, FLAG_CHOICES);
    assert.equal(question.choices.filter((choice) => choice.id === question.answer).length, 1);
    assert.equal(validateAnswer(question, question.answer), true);
    if (index % 2 === 0) { assert.ok(question.promptFlagAsset); assert.equal(question.promptShape, undefined); }
    else {
      // Outline rounds: only the target country is drawn, and the options are anonymous flags.
      assert.equal(question.promptShape.geometryId, byId.get(question.entityId).geometryId);
      assert.ok(question.choices.every((choice) => choice.flagAsset && !choice.id.startsWith("country:") && !choice.label.includes(byId.get(question.entityId).shortName)));
    }
  });
});

test("higher/lower covers countries, cities, continents and subregions with clear gaps", () => {
  for (const difficulty of ["beginner", "intermediate", "expert"]) {
    const questions = generateComparisonQuestions({ ...base, difficulty, count: 80, chain: true });
    assert.equal(questions.length, 80);
    assert.deepEqual(new Set(questions.map((question) => question.first.kind)), new Set(["country", "city", "continent", "subregion"]));
    for (const question of questions) {
      const { firstValue, secondValue } = question.stat;
      assert.equal(question.answer, secondValue > firstValue ? "higher" : "lower");
      assert.ok(Math.abs(secondValue - firstValue) >= { beginner: .3, intermediate: .12, expert: .05 }[difficulty] * Math.max(firstValue, secondValue, 1) - 1e-9, question.id);
      assert.equal(question.first.kind, question.second.kind);
      assert.notEqual(question.first.label, question.second.label);
    }
    // Chained play: most rounds keep the previous challenger as the new reference card.
    const chained = questions.slice(1).filter((question, index) => question.comparisonEntityId === questions[index].entityId).length;
    assert.ok(chained > questions.length / 2, `${difficulty}: ${chained}`);
  }
  const stats = new Set(generateComparisonQuestions({ ...base, count: 200, chain: true }).map((question) => question.stat.key));
  for (const stat of ["population", "areaKm2", "highestPointM", "elevationM", "countryCount"]) assert.ok(stats.has(stat), stat);
});

test("continent and subregion aggregates sum their UN members", () => {
  const items = buildComparables(countries, extras, "expert");
  const europe = items.find((item) => item.id === "continent:Europe");
  const members = countries.filter((country) => country.status === "un195" && country.continent === "Europe");
  assert.equal(europe.stats.countryCount.value, members.length);
  assert.equal(europe.stats.population.value, members.reduce((sum, country) => sum + (country.population?.value || 0), 0));
  assert.equal(items.find((item) => item.id === "continent:Asia").stats.highestPointM.value, extras.highestPoints["country:NPL"].elevationM);
});

test("guess-the-country clues never name the country and end with its flag", () => {
  const questions = generateGuessCountryQuestions({ ...base, difficulty: "expert", count: 195 });
  for (const question of questions) {
    const country = byId.get(question.entityId);
    assert.ok(question.clues.length === 5, country.shortName);
    assert.equal(question.clues.at(-1).flagAsset, country.flagAsset);
    for (const clue of question.clues) assert.ok(!clue.text.toLowerCase().includes(country.shortName.toLowerCase()), `${country.shortName}: ${clue.text}`);
  }
  const kenya = Array.from({ length: 30 }, (_, index) => countryClues(byId.get("country:KEN"), extras, seededRandom(`kenya-${index}`))).flat();
  assert.ok(kenya.some((clue) => clue.kind === "phrase" && clue.text.includes("Habari")));
  assert.ok(!kenya.some((clue) => /Mount Kenya/.test(clue.text)));
});

test("guess scoring: first solver 3, later solvers 2, early-tip bonuses +2/+1", () => {
  assert.deepEqual(scoreGuessTip([{ userId: "b", submittedAt: 20 }, { userId: "a", submittedAt: 10 }], 0).map(({ userId, total, first }) => [userId, total, first]), [["a", 5, true], ["b", 4, false]]);
  assert.deepEqual(scoreGuessTip([{ userId: "a", submittedAt: 1 }], 1).map((award) => award.total), [GUESS_SCORING.first + 1]);
  assert.deepEqual(scoreGuessTip([{ userId: "a", submittedAt: 1 }, { userId: "c", submittedAt: 2 }], 3).map((award) => award.total), [3, 2]);
  const [question] = generateGuessCountryQuestions({ ...base, count: 1 });
  const guess = (userId, answer, submittedAt, tip) => ({ ...createAuthoritativeSubmission({ userId, round: 0, answer, mode: "guess_country", question, submittedAt }), tip });
  const missed = resolveGuessTip({ submissions: [guess("a", "country:ZZZ", 1, 0), guess("b", "country:YYY", 2, 0)], tip: 0, currentScores: { a: 1, b: 0 } });
  assert.equal(missed.solved, false); assert.deepEqual(missed.scores, { a: 1, b: 0 });
  const solved = resolveGuessTip({ submissions: [guess("a", "country:ZZZ", 1, 0), guess("c", question.answer, 9, 1), guess("b", question.answer, 5, 1), guess("d", "country:ZZZ", 3, 1)], tip: 1, currentScores: { a: 1, b: 0, c: 0, d: 0 } });
  assert.equal(solved.solved, true);
  assert.deepEqual(solved.scores, { a: 1, b: 4, c: 3, d: 0 });
});

test("rooms seat two to four players; Territory Battle stays one-on-one", () => {
  assert.equal(maxPlayersFor("guess_country"), 4);
  assert.equal(maxPlayersFor("territory_battle"), 2);
  assert.equal(clampPlayers("flag_battle", 3), 3);
  assert.equal(clampPlayers("flag_battle", 9), 4);
  assert.equal(clampPlayers("territory_battle", 4), 2);
  assert.equal(clampPlayers("higher_lower", "nonsense"), 2);
});

test("Atlas Edge Function keeps unrevealed tips and hidden values on the server", async () => {
  const source = await readFile(new URL("../supabase/functions/atlas-match/index.ts", import.meta.url), "utf8");
  assert.match(source, /question\.clues\.slice\(0, \(match\.tip_index \|\| 0\) \+ 1\)/);
  assert.match(source, /secondValue: undefined/);
  assert.match(source, /resolveGuessTip/);
  const migration = await readFile(new URL("../supabase/migrations/20261013000000_atlas_party_modes.sql", import.meta.url), "utf8");
  assert.match(migration, /between 1 and 4/);
  assert.match(migration, /'flag_battle', 'guess_country'/);
});
