import test from "node:test";
import assert from "node:assert/strict";
import { paperCalculation, gradePaperWork } from "../src/data/paperArithmetic.ts";
import { getLessonStages, learningLessons } from "../src/data/learningCatalog.ts";
import { parseLearningToolsProgress, createLearningToolsStore } from "../src/data/learningToolsProgress.ts";

test("written calculations carry and borrow across zeros", () => {
  const cases = [
    [47, 28, "add", 75, [1, 0]],
    [376, 248, "add", 624, [1, 1, 0]],
    [9, 9, "add", 18, [1, 0]],
    [9999, 9999, "add", 19998, [1, 1, 1, 1, 0]],
    [83, 37, "subtract", 46, [7, 13]],
    [302, 178, "subtract", 124, [2, 9, 12]],
    [1000, 1, "subtract", 999, [0, 9, 9, 10]],
    [100, 100, "subtract", 0, [1, 0, 0]],
  ];
  for (const [a, b, operation, answer, marks] of cases) {
    const result = paperCalculation({ a, b, operation });
    assert.equal(Number(result.digits.join("")), answer);
    assert.deepEqual(operation === "add" ? result.carries : result.top, marks);
    assert.equal(result.steps.length, result.width);
    for (const step of result.steps) {
      assert.equal(step.top.reduce((sum, digit, i) => sum + digit * 10 ** (result.width - i - 1), 0), a, "regrouping preserves the original amount");
    }
  }
});

test("written arithmetic agrees with independent numeric calculation", () => {
  for (let a = 0; a <= 9999; a += 37) for (let b = 0; b <= 9999; b += 173) {
    assert.equal(Number(paperCalculation({ a, b, operation: "add" }).digits.join("")), a + b);
    if (a >= b) assert.equal(Number(paperCalculation({ a, b, operation: "subtract" }).digits.join("")), a - b);
  }
});

test("paper practice requires correct intermediate work as well as the answer", () => {
  const addition = { a: 47, b: 28, operation: "add" };
  assert.equal(gradePaperWork(addition, ["1", ""], ["7", "5"]), "correct");
  assert.equal(gradePaperWork(addition, ["", ""], ["7", "5"]), "incorrect");
  assert.equal(gradePaperWork(addition, ["1", "0"], ["7", "4"]), "incorrect");
  assert.equal(gradePaperWork(addition, ["1", ""], ["7", ""]), "invalid");
  assert.equal(gradePaperWork(addition, ["1", "x"], ["7", "5"]), "invalid");
  const subtraction = { a: 302, b: 178, operation: "subtract" };
  assert.equal(gradePaperWork(subtraction, ["2", "9", "12"], ["1", "2", "4"]), "correct");
  assert.equal(gradePaperWork(subtraction, ["2", "", "12"], ["1", "2", "4"]), "incorrect");
  assert.equal(gradePaperWork({ a: 65, b: 23, operation: "subtract" }, ["", ""], ["4", "2"]), "correct");
  assert.equal(gradePaperWork(subtraction, ["2", "9"], ["1", "2", "4"]), "invalid");
  for (const problem of [{ a: -1, b: 0, operation: "add" }, { a: 1.5, b: 1, operation: "add" }, { a: 10000, b: 1, operation: "add" }, { a: 1, b: 2, operation: "subtract" }]) assert.throws(() => paperCalculation(problem), RangeError);
});

test("math check bookmarks resume on practice without losing completion", () => {
  const old = { version: 1, lessons: { "addition-subtraction": { stage: "check", completed: true, updatedAt: 42 }, "getting-started": { stage: "check", completed: false, updatedAt: 1 } }, bookmarks: ["addition-subtraction"], solvedExercises: { "addition-subtraction": ["p1", "c1"] } };
  const parsed = parseLearningToolsProgress(JSON.stringify(old));
  assert.deepEqual(parsed.lessons["addition-subtraction"], { stage: "practice", completed: true, updatedAt: 42 });
  assert.equal(parsed.lessons["getting-started"].stage, "check");
  assert.deepEqual(parsed.bookmarks, ["addition-subtraction"]);
  assert.deepEqual(parsed.solvedExercises["addition-subtraction"], ["p1", "c1"]);
  for (const lesson of learningLessons.filter(item => item.subjectId === "math")) assert.deepEqual(getLessonStages(lesson), ["learn", "explore", "practice"]);
  const store = createLearningToolsStore();
  store.setLessonStage("guest", "addition-subtraction", "check", 99);
  assert.equal(store.read("guest").lessons["addition-subtraction"].stage, "practice");
});
