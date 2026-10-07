import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ARENA_MODES, modeById } from "../src/games/atlas/modeCatalog.ts";
import { chooseRankedSeries, rankedModes, sanitizeBans } from "../src/games/atlas/ranked.ts";
import { applyRaceAction, createRaceRun, raceCount, raceQuestions, raceView } from "../src/games/atlas/serverRace.ts";
import { buildTrialCountries } from "../src/games/atlas/trials/countryStats.ts";
import { HISTORY_BATTLE, historyDeck, historyPoints, yearLabel } from "../src/games/atlas/trials/historyBattle.ts";

const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const countries = await read("../data/geography/countries.json"), extras = await read("../data/geography/extras.json");
const history = await read("../data/geography/history.json");
const data = { countries, extras, history, version: await read("../data/geography/version.json"), topology: await read("../public/data/geography/world-110m.json") };
const DIFFICULTIES = ["beginner", "intermediate", "expert"];
const pools = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, buildTrialCountries(countries, extras, difficulty)]));
const byId = new Map(pools.expert.map((country) => [country.id, country]));
const entry = (id) => history.countries[id];
const independenceEvents = (id) => entry(id).events.filter((event) => event.from || /independen/i.test(event.label));

test("the history snapshot is a public-domain World Factbook extract keyed to playable countries", async () => {
  assert.match(history.source.name, /World Factbook/);
  assert.match(history.source.license, /public domain/i);
  assert.match(history.source.commit, /^[0-9a-f]{40}$/);
  assert.equal(history.atlasDataVersion, data.version.atlasDataVersion);
  assert.deepEqual((await read("../public/data/geography/history.json")).countries, history.countries);
  const playable = new Set(countries.filter((country) => country.status === "un195").map((country) => country.id));
  const entries = Object.entries(history.countries);
  assert.ok(entries.length >= 180);
  const formerNames = entries.flatMap(([, value]) => value.formerNames);
  assert.equal(new Set(formerNames).size, formerNames.length, "a former name belongs to one country");
  for (const [id, value] of entries) {
    assert.ok(playable.has(id), id);
    assert.ok(value.record && value.events.length + value.formerNames.length > 0, id);
    assert.ok(!/<|&[a-z]+;|\b[A-Z]{5,}\b/.test(`${value.record} ${value.background}`), `${id} has markup or capitalised surnames`);
    for (const event of value.events) {
      assert.ok(Number.isInteger(event.year) && event.year >= 100 && event.year <= HISTORY_BATTLE.latestYear, `${id} ${event.year}`);
      assert.ok(value.record.includes(String(event.year)) || event.date.includes(String(event.year)), `${id} ${event.year}`);
      assert.ok(event.label.split(" ").length >= 2 && !/\d{3,4}/.test(event.label), `${id} ${event.label}`);
      if (event.power) assert.ok(event.from && value.mentions.includes(event.power), `${id} ${event.power}`);
    }
  }
  // Spot checks against the source text.
  assert.deepEqual(entry("country:KEN").events, [{ year: 1963, date: "12 December 1963", label: "independence from the UK", from: "the UK", power: "United Kingdom" }]);
  assert.deepEqual(entry("country:USA").events[0], { year: 1776, date: "4 July 1776", label: "independence declared from Great Britain", from: "Great Britain", power: "United Kingdom", declared: true });
  assert.deepEqual(entry("country:BFA").formerNames, ["Upper Volta"]);
  assert.equal(entry("country:CHE").events[0].label, "founding of the Swiss Confederation");
  assert.equal(entry("country:PSE"), undefined);
});

test("every deck deals twelve distinct, answerable questions and repeats exactly from its seed", () => {
  for (const difficulty of DIFFICULTIES) for (let seed = 0; seed < 150; seed += 1) {
    const deck = historyDeck(history, pools[difficulty], `deck:${seed}`, difficulty);
    assert.equal(deck.length, HISTORY_BATTLE.rounds);
    assert.deepEqual(deck, historyDeck(history, pools[difficulty], `deck:${seed}`, difficulty));
    assert.equal(new Set(deck.map((round) => round.countryId)).size, deck.length, "no country is asked about twice");
    if (difficulty === "beginner") assert.ok(deck.every((round) => round.kind !== "event"));
    for (const round of deck) {
      assert.equal(round.options.length, HISTORY_BATTLE.options);
      assert.equal(new Set(round.options.map((option) => option.id)).size, HISTORY_BATTLE.options);
      assert.equal(new Set(round.options.map((option) => option.label)).size, HISTORY_BATTLE.options);
      assert.equal(round.options.filter((option) => option.id === round.answerId).length, 1);
      assert.ok(pools[difficulty].some((country) => country.id === round.countryId), "the subject comes from the difficulty's pool");
      assert.ok(round.fact && !round.prompt.includes("undefined"));
    }
  }
});

test("every answer is the one the record supports, and no wrong option is defensible", () => {
  const seen = new Set();
  for (const difficulty of DIFFICULTIES) for (let seed = 0; seed < 250; seed += 1) for (const round of historyDeck(history, pools[difficulty], `truth:${seed}`, difficulty)) {
    seen.add(round.kind);
    const record = entry(round.countryId), name = byId.get(round.countryId).name;
    if (round.kind === "year" || round.kind === "event") {
      const year = Number(round.answerId);
      const event = record.events.find((item) => item.year === year && Boolean(item.from) === (round.kind === "year") && (round.prompt.includes(item.label) || round.prompt.endsWith(`independence from ${item.from}?`)));
      assert.ok(event, round.prompt);
      assert.ok(round.subjectId === round.countryId && round.prompt.includes(name.replace(/^The /, "")));
      const years = round.options.map((option) => Number(option.id));
      assert.deepEqual(years, [...years].sort((left, right) => left - right));
      // None of the country's other recorded dates is offered as a wrong year.
      for (const other of record.events) if (other.year !== year) assert.ok(!years.includes(other.year), round.prompt);
      assert.ok(years.every((value) => value >= 100 && value <= HISTORY_BATTLE.latestYear));
    } else if (round.kind === "power") {
      const event = record.events.find((item) => item.power === round.answerId && round.prompt.includes(String(item.year)));
      assert.ok(event, round.prompt);
      for (const option of round.options) if (option.id !== round.answerId) assert.ok(!record.mentions.includes(option.id) && option.id !== name, `${round.prompt} offers ${option.id}`);
    } else if (round.kind === "member") {
      const power = record.events.find((item) => item.power && round.prompt.endsWith(`${item.power}?`))?.power;
      assert.ok(power && round.answerId === round.countryId, round.prompt);
      for (const option of round.options) {
        assert.ok(option.detail);
        if (option.id !== round.answerId) assert.ok(!entry(option.id).mentions.includes(power), `${round.prompt} offers ${option.label}`);
      }
      if (["Soviet Union", "Ottoman Empire", "Yugoslavia", "Russia"].includes(power)) {
        for (const option of round.options) if (option.id !== round.answerId) assert.ok(!["Europe", "Asia"].includes(byId.get(option.id).continent) && byId.get(option.id).subregion !== "Northern Africa", `${round.prompt} offers ${option.label}`);
      }
    } else if (round.kind === "former") {
      const former = record.formerNames.find((value) => round.prompt.includes(value));
      assert.ok(former && round.answerId === round.countryId, round.prompt);
      for (const option of round.options) if (option.id !== round.answerId) assert.ok(!(entry(option.id)?.formerNames ?? []).some((value) => value.includes(former) || former.includes(value)), round.prompt);
    } else {
      const years = round.options.map((option) => { const events = independenceEvents(option.id); assert.equal(events.length, 1, option.label); assert.equal(option.detail, yearLabel(events[0].year)); return events[0].year; });
      const target = round.prompt.includes("first") ? Math.min(...years) : Math.max(...years);
      assert.equal(years[round.options.findIndex((option) => option.id === round.answerId)], target);
      const sorted = [...years].sort((left, right) => left - right), gap = { beginner: 20, intermediate: 8, expert: 3 }[difficulty];
      for (let index = 1; index < sorted.length; index += 1) assert.ok(sorted[index] - sorted[index - 1] >= gap, round.prompt);
    }
  }
  assert.deepEqual([...seen].sort(), ["event", "former", "member", "order", "power", "year"]);
});

test("scoring rewards streaks up to a cap", () => {
  assert.equal(historyPoints(0), 250);
  assert.equal(historyPoints(1), 300);
  assert.equal(historyPoints(5), 500);
  assert.equal(historyPoints(40), 500);
  assert.equal(yearLabel(301), "AD 301");
  assert.equal(yearLabel(1963), "1963");
});

test("online History Battle is server-graded and reveals the record only with the result", () => {
  const questions = raceQuestions(data, "history_battle", "online", "intermediate");
  assert.equal(questions.length, raceCount("history_battle"));
  assert.deepEqual(questions.map((question) => question.prompt), historyDeck(history, pools.intermediate, "online", "intermediate").map((round) => round.prompt));
  let run = createRaceRun(0);
  const view = raceView(run, questions, "gen");
  assert.deepEqual(Object.keys(view.question).sort(), ["category", "choices", "difficulty", "id", "interaction", "prompt", "promptFlagAsset", "promptShape", "sourceMetadata"]);
  assert.deepEqual(view.question.sourceMetadata, [{ source: "The World Factbook (final edition, 2026)" }]);
  assert.throws(() => applyRaceAction(run, questions, "gen", "history_battle", "answer", view.question.id, "not-an-option", 1), /Invalid answer/);
  run = applyRaceAction(run, questions, "gen", "history_battle", "answer", view.question.id, questions[0].answer, 1);
  assert.equal(run.score, 1000);
  assert.match(run.feedback.explanation, /The World Factbook$/);
  assert.match(run.ledger[0].concept, /^history_battle:clues:(year|event|power|member|former|order)$/);
  // Master and Grandmaster rooms always play the expert deck.
  assert.deepEqual(raceQuestions(data, "history_battle", "tier", "beginner", "Europe", undefined, "master").map((question) => question.prompt), historyDeck(history, pools.expert, "tier", "expert").map((round) => round.prompt));
});

test("History Battle replaces Territory Battle in the menu and in Ranked", async () => {
  const mode = modeById("history-battle");
  assert.equal(ARENA_MODES.length, 15);
  assert.equal(ARENA_MODES.findIndex((item) => item.id === "history-battle"), 11, "it takes Territory Battle's slot");
  assert.equal(modeById("territory-battle"), undefined);
  assert.ok(mode.rules.play.some((step) => step.includes("The World Factbook")));
  const ranked = rankedModes().map((item) => item.online);
  assert.ok(ranked.includes("history_battle") && !ranked.includes("territory_battle"));
  assert.deepEqual(sanitizeBans(["territory_battle", "history_battle"]), ["history_battle"]);
  assert.deepEqual(chooseRankedSeries(["history_battle", "map_battle", "flag_battle", "speed_run"], ["speed_run"], [], () => 0), ["history_battle", "map_battle", "flag_battle"]);
  // Nothing under src or the match function still refers to the removed mode.
  for (const file of ["../src/games/atlas/modeCatalog.ts", "../src/games/atlas/multiplayer.ts", "../src/pages/games/AtlasArena/useArenaStore.ts", "../src/pages/games/AtlasArena/AtlasMultiplayerPage.tsx", "../src/pages/games/AtlasArena/AtlasHotseatPage.tsx", "../src/pages/games/AtlasArena/AtlasSoloPage.tsx", "../src/components/atlas/AtlasSoloGame.tsx", "../supabase/functions/atlas-match/index.ts"]) {
    assert.ok(!/territory[_ -]battle|TerritoryCampaign|territoryStrategy/i.test(await readFile(new URL(file, import.meta.url), "utf8")), file);
  }
});
