import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { seededRandom } from "../src/games/atlas/random.ts";
import { buildTrialCountries, compareCountryStats, formatCountryStat, generateDistractors, getCountryStat, sampleUnique, STATS } from "../src/games/atlas/trials/countryStats.ts";
import { COUNTRY_GUESSER, EXTREME_GEOGRAPHY, REGION_BUILDER, STAT_BATTLE, STAT_RANKING } from "../src/games/atlas/trials/config.ts";
import { createGuesserRun, guesserClues, guesserPoints, nextGuesserRound, revealGuesserClue, submitGuesserGuess } from "../src/games/atlas/trials/countryGuesser.ts";
import { createDetectiveRun, generateDetectiveRound, nextDetectiveRound, submitDetectiveGuess } from "../src/games/atlas/trials/statDetective.ts";
import { REGIONS } from "../src/games/atlas/trials/regions.ts";
import { createRegionRun, generateRegionRound, nextRegionRound, pickRegionCountry, regionById } from "../src/games/atlas/trials/regionBuilder.ts";
import { createRankingRun, generateRankingRound, lockInRanking, reorderRanking, scoreRanking } from "../src/games/atlas/trials/statRanking.ts";
import { answerExtreme, categoryById, createExtremeRun, EXTREME_CATEGORIES, extremeWinner, generateExtremeRound } from "../src/games/atlas/trials/extremeGeography.ts";
import { advanceBattle, battleCategoryById, battleDeckPool, BATTLE_CATEGORIES, chooseOpponentCard, createBattle, playBattleCard, resolveBattle } from "../src/games/atlas/trials/statBattle.ts";

const read = async (file) => JSON.parse(await readFile(new URL(file, import.meta.url), "utf8"));
const entities = await read("../data/geography/countries.json");
const extras = await read("../data/geography/extras.json");
const pool = buildTrialCountries(entities, extras);
const byId = new Map(pool.map((country) => [country.id, country]));
const byIso = new Map(pool.map((country) => [country.iso3, country]));
const unique = (items) => new Set(items).size === items.length;
const seeds = Array.from({ length: 40 }, (_, index) => `seed-${index}`);

test("the adapter only exposes real dataset numbers and formats them per stat", () => {
  assert.ok(pool.length >= 190);
  const france = byIso.get("FRA"), source = entities.find((entity) => entity.iso3 === "FRA");
  assert.equal(getCountryStat(france, "population"), source.population.value);
  assert.equal(getCountryStat(france, "density"), source.population.value / source.areaKm2.value);
  assert.equal(getCountryStat(france, "highestPointM"), extras.highestPoints["country:FRA"].elevationM);
  assert.equal(getCountryStat(byIso.get("GMB"), "highestPointM"), null, "missing stats stay missing");
  assert.equal(byIso.get("BRA").continent, "South America");
  assert.equal(formatCountryStat("areaKm2", 43094), "43,094 km²");
  assert.equal(formatCountryStat("population", null), "—");
  assert.ok(compareCountryStats(byIso.get("CHN"), byIso.get("FRA"), "population") > 0);
  assert.ok(compareCountryStats(byIso.get("CHN"), byIso.get("FRA"), "population", "lowest") < 0);
  for (const stat of Object.values(STATS)) assert.ok(stat.source && stat.extremes.highest && stat.extremes.lowest);
});

test("random selections never contain duplicates", () => {
  for (const seed of seeds) {
    const random = seededRandom(seed);
    assert.ok(unique(sampleUnique(pool, 30, random).map((country) => country.id)));
    const target = pool[Math.floor(random() * pool.length)];
    const distractors = generateDistractors(target, pool, 5, random);
    assert.ok(unique([target, ...distractors].map((country) => country.id)));
    const guesser = createGuesserRun(pool, seed).round;
    assert.ok(guesser.optionIds.length === COUNTRY_GUESSER.options && unique(guesser.optionIds));
    assert.ok(guesser.optionIds.filter((id) => byId.get(id).subregion !== byId.get(guesser.answerId).subregion).length >= 2, "the first regional clue narrows the choices");
    for (const difficulty of ["beginner", "intermediate", "expert"]) {
      const detective = generateDetectiveRound(pool, seed, 0, difficulty);
      assert.ok(unique(detective.optionIds) && detective.optionIds.includes(detective.answerId));
      const ranking = generateRankingRound(pool, seed, 0, difficulty);
      assert.ok(unique(ranking.countryIds) && ranking.countryIds.length === STAT_RANKING.cards[difficulty]);
      const extreme = generateExtremeRound(pool, seed, 4, difficulty);
      assert.ok(unique(extreme.countryIds) && extreme.countryIds.length === EXTREME_GEOGRAPHY.extremeChoices && extreme.extreme);
    }
    const region = generateRegionRound(pool, seed, 7);
    assert.ok(unique(region.optionIds));
  }
  assert.throws(() => sampleUnique([1, 2], 3, Math.random), /unique/);
  assert.deepEqual(generateRankingRound(pool, "same", 3, "expert"), generateRankingRound(pool, "same", 3, "expert"), "rounds are seedable");
});

test("Country Guesser clues come from data, never name the answer, and scoring falls as clues are revealed", () => {
  assert.deepEqual(COUNTRY_GUESSER.pointsByClues.map((_, index) => guesserPoints(index + 1)), [1000, 750, 500, 300, 100]);
  for (let index = 1; index < 5; index += 1) assert.ok(guesserPoints(index) > guesserPoints(index + 1));
  for (const country of pool) {
    const clues = guesserClues(country);
    assert.equal(clues.length, 5);
    for (const clue of clues.slice(0, 4)) assert.ok(!clue.text.toLowerCase().includes(country.name.toLowerCase()), `${country.name}: ${clue.text}`);
  }
  assert.match(guesserClues(byIso.get("PER"), () => .999).find(clue => clue.kind === "region").text, /South America/);
  assert.match(guesserClues(byIso.get("KWT"))[4].text, /shares its name/);
  let run = createGuesserRun(pool, "guess");
  run = revealGuesserClue(revealGuesserClue(run));
  assert.equal(run.revealed, 3);
  const wrong = run.round.optionIds.find((id) => id !== run.round.answerId);
  run = submitGuesserGuess(run, wrong);
  assert.equal(run.lives, COUNTRY_GUESSER.lives - 1);
  assert.equal(run.phase, "guessing", "a wrong guess does not reveal the answer");
  assert.equal(submitGuesserGuess(run, wrong), run, "the same wrong card can't cost a second life");
  run = submitGuesserGuess(run, run.round.answerId);
  assert.equal(run.score, 500);
  assert.equal(submitGuesserGuess(run, run.round.answerId), run, "a solved round can't be scored twice");
  const next = nextGuesserRound(run, pool);
  assert.equal(next.roundIndex, 1);
  assert.notEqual(next.round.answerId, run.round.answerId);
  let doomed = createGuesserRun(pool, "doomed");
  for (const id of doomed.round.optionIds.filter((option) => option !== doomed.round.answerId).slice(0, 3)) doomed = submitGuesserGuess(doomed, id);
  assert.equal(doomed.phase, "over");
});

test("Stat Detective always offers a distinguishable answer and scores once per case", () => {
  for (const seed of seeds) {
    const round = generateDetectiveRound(pool, seed, 2, "expert");
    const answer = byId.get(round.answerId);
    assert.equal(round.statIds.length, 4);
    for (const id of round.optionIds.filter((option) => option !== round.answerId)) {
      const other = byId.get(id);
      assert.ok(round.statIds.some((stat) => stat === "neighborCount" ? getCountryStat(other, stat) !== getCountryStat(answer, stat) : Math.abs(getCountryStat(other, stat) - getCountryStat(answer, stat)) / Math.max(getCountryStat(other, stat), getCountryStat(answer, stat)) >= .2), `${seed}: ${other.name}`);
    }
  }
  let run = createDetectiveRun(pool, "detective", "intermediate");
  run = submitDetectiveGuess(run, run.round.answerId);
  assert.equal(run.score, 500);
  assert.equal(submitDetectiveGuess(run, run.round.answerId), run);
  run = nextDetectiveRound(run, pool);
  run = submitDetectiveGuess(run, run.round.answerId);
  assert.equal(run.score, 500 + 600, "the second case in a streak adds the streak bonus");
});

test("Region Builder: membership is fixed, the first wrong country ends the run, all correct completes the region", () => {
  for (const region of REGIONS) {
    assert.ok(unique(region.members), region.id);
    for (const iso of [...region.members, ...(region.ambiguous ?? [])]) assert.ok(entities.some((entity) => entity.iso3 === iso), `${region.id}: ${iso}`);
  }
  for (const seed of seeds) for (const roundIndex of [0, 4, 9]) {
    const round = generateRegionRound(pool, seed, roundIndex);
    const region = regionById(round.regionId);
    for (const id of round.optionIds) {
      const iso = byId.get(id).iso3;
      assert.equal(round.targetIds.includes(id), region.members.includes(iso), `${region.id}: ${iso}`);
      assert.ok(!(region.ambiguous ?? []).includes(iso), `${region.id} shows ambiguous ${iso}`);
    }
    assert.ok(round.targetIds.length <= REGION_BUILDER.maxShownMembers && round.targetIds.length >= 3);
  }
  let run = createRegionRun(pool, "regions");
  const [first, ...rest] = run.round.targetIds;
  run = pickRegionCountry(run, first);
  assert.equal(run.found.length, 1);
  assert.equal(pickRegionCountry(run, first), run, "a locked card can't score twice");
  const wrong = run.round.optionIds.find((id) => !run.round.targetIds.includes(id));
  const failed = pickRegionCountry(run, wrong);
  assert.equal(failed.phase, "over");
  assert.equal(failed.wrongId, wrong);
  assert.equal(pickRegionCountry(failed, rest[0]), failed, "nothing can be picked after the first mistake");
  for (const id of rest) run = pickRegionCountry(run, id);
  assert.equal(run.phase, "complete");
  assert.equal(run.score, run.round.targetIds.length * REGION_BUILDER.perCountry + REGION_BUILDER.regionComplete);
  const next = nextRegionRound(run, pool);
  assert.equal(next.phase, "picking");
  assert.notEqual(next.round.regionId, run.round.regionId);
});

test("Stat Ranking scores exact slots, near misses and perfect bonuses", () => {
  const correct = ["a", "b", "c", "d", "e"];
  assert.deepEqual(scoreRanking(correct, correct), { placements: correct.map((id, index) => ({ id, guessedIndex: index, correctIndex: index, points: 100 })), perfect: true, total: 600 });
  assert.equal(scoreRanking(["b", "a", "c", "d", "e"], correct).total, 50 + 50 + 300);
  assert.equal(scoreRanking(["c", "b", "a", "d", "e"], correct).total, 20 + 100 + 20 + 200);
  assert.equal(scoreRanking(["e", "b", "c", "d", "a"], correct).total, 300);
  for (const seed of seeds) {
    const round = generateRankingRound(pool, seed, 1, "beginner");
    const values = round.correctOrder.map((id) => getCountryStat(byId.get(id), round.statId));
    assert.ok(values.every((value, index) => index === 0 || values[index - 1] > value), "highest → lowest without ties");
  }
  let run = createRankingRun(pool, "ranking", "intermediate");
  assert.equal(reorderRanking(run, ["nope"]), run, "foreign orders are rejected");
  run = reorderRanking(run, run.round.correctOrder);
  run = lockInRanking(run);
  assert.equal(run.score, 5 * 100 + 100);
  assert.equal(lockInRanking(run), run, "locking in twice scores once");
  assert.equal(reorderRanking(run, [...run.order].reverse()), run, "no reordering after lock-in");
});

test("Extreme Geography handles highest and lowest categories from configuration", () => {
  assert.ok(EXTREME_CATEGORIES.some((category) => category.direction === "highest") && EXTREME_CATEGORIES.some((category) => category.direction === "lowest"));
  assert.ok(EXTREME_CATEGORIES.some((category) => category.statId === "meanTempC" && category.direction === "lowest"));
  assert.equal(extremeWinner(["RUS", "SWE", "EST", "GIN"].map((iso) => byIso.get(iso)), { statId: "meanTempC", direction: "lowest" }).iso3, "RUS");
  const mixed = ["CHN", "IND", "NRU", "TUV"].map((iso) => byIso.get(iso));
  assert.equal(extremeWinner(mixed, { statId: "population", direction: "highest" }).iso3, "IND");
  assert.equal(extremeWinner(mixed, { statId: "population", direction: "lowest" }).iso3, "TUV");
  assert.equal(extremeWinner(mixed, { statId: "areaKm2", direction: "highest" }).iso3, "CHN");
  assert.equal(extremeWinner(mixed, { statId: "areaKm2", direction: "lowest" }).iso3, "NRU");
  for (const seed of seeds) {
    const round = generateExtremeRound(pool, seed, 0, "intermediate");
    assert.equal(round.answerId, extremeWinner(round.countryIds.map((id) => byId.get(id)), categoryById(round.categoryId)).id);
  }
  let run = createExtremeRun(pool, "extreme", "beginner");
  const answered = answerExtreme(run, run.round.answerId, 0);
  assert.equal(answered.score, 500);
  assert.equal(answerExtreme(answered, answered.round.answerId, 0), answered, "only the first answer counts");
  run = answerExtreme(run, null, EXTREME_GEOGRAPHY.timeLimitMs);
  assert.equal(run.correct, false);
  assert.equal(run.score, 0);
});

test("Stat Battle compares values, handles ties, refills hands and never duplicates cards", () => {
  const category = battleCategoryById("population:lowest");
  assert.equal(resolveBattle(byIso.get("TUV"), byIso.get("CHN"), category), "player");
  assert.equal(resolveBattle(byIso.get("CHN"), byIso.get("TUV"), battleCategoryById("population:highest")), "player");
  const borders = battleCategoryById("neighborCount:highest");
  const [same1, same2] = pool.filter((country) => getCountryStat(country, "neighborCount") === 2);
  assert.equal(resolveBattle(same1, same2, borders), "tie");
  assert.ok(BATTLE_CATEGORIES.some((item) => item.direction === "lowest"));

  for (const seed of seeds.slice(0, 15)) for (const level of ["easy", "normal", "hard"]) {
    let state = createBattle(pool, seed, level);
    const total = battleDeckPool(pool).length;
    let rounds = 0;
    while (state.phase !== "finished" && rounds < 200) {
      const cards = [...state.deck, ...state.player, ...state.opponent, ...state.discard];
      assert.equal(cards.length, total);
      assert.ok(unique(cards), "a country is in exactly one place");
      assert.equal(state.player.length, STAT_BATTLE.handSize);
      const card = state.player[0];
      const played = playBattleCard(state, card, byId);
      assert.equal(playBattleCard(played, state.player[1], byId), played, "no second card while the battle resolves");
      const { player, opponent, playerValue, opponentValue, winner } = played.played;
      const direction = battleCategoryById(played.played.categoryId).direction;
      assert.equal(winner, playerValue === opponentValue ? "tie" : (direction === "highest" ? playerValue > opponentValue : playerValue < opponentValue) ? "player" : "opponent");
      assert.equal(played.playerScore + played.opponentScore, state.playerScore + state.opponentScore + Number(winner !== "tie"), "ties award nobody");
      state = advanceBattle(played);
      assert.equal(advanceBattle(state), state);
      if (state.phase === "choose") assert.notEqual(battleCategoryById(state.categoryId).statId, battleCategoryById(played.played.categoryId).statId, "no stat twice in a row");
      assert.ok(state.discard.includes(player) && state.discard.includes(opponent));
      assert.ok(!state.player.includes(player) && !state.opponent.includes(opponent));
      rounds += 1;
    }
    assert.equal(state.phase, "finished");
    assert.ok(Math.max(state.playerScore, state.opponentScore) === STAT_BATTLE.winTarget || !state.player.length);
  }
  assert.equal(playBattleCard(createBattle(pool, "x", "hard"), "country:NOPE", byId).phase, "choose", "cards outside the hand are ignored");

  const hand = ["CHN", "IND", "USA", "MCO", "TUV"].map((iso) => byIso.get(iso).id);
  const hardPicks = Array.from({ length: 100 }, (_, index) => chooseOpponentCard(hand, battleCategoryById("population:highest"), "hard", byId, seededRandom(`ai-${index}`)));
  assert.ok(hardPicks.filter((id) => id === byIso.get("IND").id).length >= 80, "hard plays its strongest card most of the time");
  const easyPicks = new Set(Array.from({ length: 100 }, (_, index) => chooseOpponentCard(hand, battleCategoryById("population:highest"), "easy", byId, seededRandom(`ai-${index}`))));
  assert.ok(easyPicks.size >= 4, "easy spreads its choices");
});
