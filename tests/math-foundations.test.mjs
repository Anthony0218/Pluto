import test from "node:test";
import assert from "node:assert/strict";
import { foundationActivities, foundationLessons, fractionDisplay, gradeMathAnswer, parseMathAnswer } from "../src/data/mathFoundations.ts";
import { createLearningToolsStore, parseLearningToolsProgress } from "../src/data/learningToolsProgress.ts";

test("equivalent exact answers accept fractions, decimal comma, and signed values", () => {
  for (const value of ["1/2", "2/4", "-2/-4", "0.5", "0,50", ".5", ",5", " +0.500 "]) assert.equal(gradeMathAnswer(value, "1/2"), "correct", value);
  for (const value of ["−5", "-10/2", "10/-2", "-5.0", "-5,000"]) assert.equal(gradeMathAnswer(value, "-5"), "correct", value);
  assert.equal(gradeMathAnswer("0.3", "3/10"), "correct");
  assert.equal(gradeMathAnswer("0.333333", "1/3"), "incorrect");
  assert.equal(gradeMathAnswer("0.500000000001", "1/2"), "incorrect");
  assert.equal(gradeMathAnswer("-0", "0"), "correct");
});

test("fraction comparison remains exact across equivalent representations", () => {
  for (let numerator = -20; numerator <= 20; numerator++) for (let denominator = 1; denominator <= 17; denominator++) {
    const expected = `${numerator}/${denominator}`;
    assert.equal(gradeMathAnswer(`${numerator * 13}/${denominator * 13}`, expected), "correct");
    assert.equal(gradeMathAnswer(`${numerator * 13 + 1}/${denominator * 13}`, expected), "incorrect");
  }
  assert.equal(gradeMathAnswer("999999999999/999999999998", "999999999999/999999999998"), "correct");
  assert.equal(gradeMathAnswer("999999999998/999999999997", "999999999999/999999999998"), "incorrect");
});

test("malformed answers, expressions, zero denominators, and excessive input are rejected", () => {
  for (const value of ["", " ", "1/0", "0/0", "1/-0", "NaN", "Infinity", "1e3", "2+2", "1/2/3", "1.2.3", "1,000.5", "€5", "5 km", "--2", "1 2", "1234567890123", "0.1234567890123", "9".repeat(1000), "(() => alert(1))()", "1.5/3"]) {
    assert.equal(parseMathAnswer(value), null, value);
    assert.equal(gradeMathAnswer(value, "1"), "invalid");
  }
  assert.equal(gradeMathAnswer("1", "1/0"), "invalid");
});

test("fraction visual labels distinguish terminating and repeating decimals", () => {
  assert.deepEqual(fractionDisplay(0, 8), { fraction: "0/1", decimal: "0", approximate: false });
  assert.deepEqual(fractionDisplay(6, 8), { fraction: "3/4", decimal: "0.75", approximate: false });
  assert.deepEqual(fractionDisplay(7, 4), { fraction: "7/4", decimal: "1.75", approximate: false });
  assert.deepEqual(fractionDisplay(1, 3), { fraction: "1/3", decimal: "0.333333", approximate: true });
  for (let denominator = 1; denominator <= 12; denominator++) for (let numerator = 0; numerator <= 12; numerator++) {
    const value = fractionDisplay(numerator, denominator);
    assert.equal(gradeMathAnswer(value.fraction, `${numerator}/${denominator}`), "correct");
    if (!value.approximate) assert.equal(gradeMathAnswer(value.decimal, value.fraction), "correct");
  }
  assert.throws(() => fractionDisplay(1, 0), RangeError);
});

test("all 50 course questions have independently audited answers and unique IDs", () => {
  const expected = [
    [75, 46, 31.25, 4.05, 43, 100, 624, 124, 74, 85],
    [56, 12, 37.5, 7.5, 0, 84, 66, 102],
    [5, -5, -2, -21, 4, 8, -21, -4],
    ["1/2", "5/8", "1/2", "3/2", "55/100", "7/4", "5/6", 1],
    [18, 30, 8, 9, 20, 9, 14, 40],
    [600, 1000, 17, 53, 3.15, 35, 24.75, 2520],
  ];
  assert.equal(foundationLessons.length, 6);
  foundationActivities.forEach((activity, index) => {
    const exercises = [...activity.practice, ...activity.checks];
    assert.equal(exercises.length, index === 0 ? 10 : 8);
    assert.equal(new Set(exercises.map(item => item.id)).size, exercises.length);
    exercises.forEach((item, question) => {
      assert.equal(gradeMathAnswer(item.answer, String(expected[index][question])), "correct", `${activity.id}/${item.id}`);
      assert.ok(item.hint && item.solution && item.verification);
    });
    assert.equal(foundationLessons[index].id, activity.id);
  });
});

test("exercise progress survives reload, stays separate from reading, and resets per lesson/account", () => {
  const entries = new Map();
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  const store = createLearningToolsStore(storage);
  const lesson = foundationActivities[0].id;
  store.toggleBookmark("alice", lesson);
  store.setLessonStage("alice", lesson, "practice", 12);
  store.recordSolvedExercise("alice", lesson, "p1");
  store.recordSolvedExercise("alice", lesson, "c1");
  store.recordSolvedExercise("alice", lesson, "p1");
  store.recordSolvedExercise("alice", lesson, "fake");
  store.recordSolvedExercise("alice", "getting-started", "p1");
  const restored = createLearningToolsStore(storage);
  assert.deepEqual(restored.read("alice").solvedExercises, { [lesson]: ["p1", "c1"] });
  assert.equal(restored.read("alice").lessons[lesson].completed, false);
  assert.deepEqual(restored.read("guest").solvedExercises, {});
  assert.deepEqual(restored.read("bob").solvedExercises, {});
  restored.setLessonCompleted("alice", lesson, true, 14);
  restored.recordSolvedExercise("alice", foundationActivities[1].id, "p2");
  restored.recordSolvedExercise("bob", lesson, "p2");
  restored.resetLessonExercises("alice", lesson);
  assert.equal(restored.read("alice").solvedExercises[lesson], undefined);
  assert.deepEqual(restored.read("alice").solvedExercises[foundationActivities[1].id], ["p2"]);
  assert.equal(restored.read("alice").lessons[lesson].completed, true);
  assert.deepEqual(restored.read("alice").bookmarks, [lesson]);
  assert.deepEqual(restored.read("bob").solvedExercises[lesson], ["p2"]);
});

test("older snapshots still load and tampered exercise records are sanitized", () => {
  const old = { version: 1, lessons: { "getting-started": { stage: "check", completed: true, updatedAt: 3 } }, bookmarks: ["getting-started"] };
  const parsedOld = parseLearningToolsProgress(JSON.stringify(old));
  assert.equal(parsedOld.lessons["getting-started"].completed, true);
  assert.deepEqual(parsedOld.solvedExercises, {});
  const parsed = parseLearningToolsProgress(JSON.stringify({ ...old, solvedExercises: { "addition-subtraction": ["p1", "p1", "fake", null, "c1"], "getting-started": ["p1"], unknown: ["p1"], "negative-numbers": "p2", "fractions-decimals": ["fake"] } }));
  assert.deepEqual(parsed.solvedExercises, { "addition-subtraction": ["p1", "c1"] });
});
