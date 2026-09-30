import test from "node:test";
import assert from "node:assert/strict";
import { didYouKnowFacts, dailyFacts } from "../src/data/didYouKnow.ts";
import { puzzleQuestProgress } from "../src/data/questProgress.ts";

test("fact catalog has sixty distinct enabled entries and rotates by UTC date", () => {
  assert.equal(didYouKnowFacts.length, 60);
  assert.equal(new Set(didYouKnowFacts.map(fact => fact.id)).size, 60);
  assert.deepEqual(dailyFacts("2026-09-28"), dailyFacts("2026-09-28"));
  assert.notDeepEqual(dailyFacts("2026-09-28").map(fact => fact.id), dailyFacts("2026-09-29").map(fact => fact.id));
});

test("perfect Really Hard puzzle requires zero mistakes and today's completion", () => {
  const quest = { title: "Really Hard precision", description: "", target: 1, progress: 0, expires_at: "2026-09-29T00:00:00.000Z", difficulty: "Really Hard", progress_type: "puzzle_perfect" };
  const entry = (difficulty, mistakes, completedAt = "2026-09-28T12:00:00.000Z") => ({ puzzle: { category: "Endgame", difficulty }, mistakes, completedAt });
  assert.equal(puzzleQuestProgress(quest, [entry("Really Hard", 0)]), 1);
  assert.equal(puzzleQuestProgress(quest, [entry("Really Hard", 1)]), 0);
  assert.equal(puzzleQuestProgress(quest, [entry("Advanced", 0)]), 0);
  assert.equal(puzzleQuestProgress(quest, [entry("Really Hard", 0, "2026-09-27T12:00:00.000Z")]), 0);
});

test("puzzle category quest counts distinct categories", () => {
  const quest = { title: "Categories", description: "", target: 2, progress: 0, expires_at: "2026-09-29T00:00:00.000Z", progress_type: "puzzle_categories" };
  const completedAt = "2026-09-28T12:00:00.000Z";
  const completions = ["Endgame", "Endgame", "Tactic"].map(category => ({ puzzle: { category, difficulty: "Beginner" }, mistakes: 0, completedAt }));
  assert.equal(puzzleQuestProgress(quest, completions), 2);
});
