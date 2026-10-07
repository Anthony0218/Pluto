import test from "node:test";
import assert from "node:assert/strict";
import { createLearningToolsStore, parseLearningToolsProgress } from "../src/data/learningToolsProgress.ts";
import { learningSubjects, learningPaths, learningLessons, pathRoute, subjectRoute } from "../src/data/learningCatalog.ts";
import { toolApps, toolRoute } from "../src/data/toolCatalog.ts";

const memoryStorage = () => {
  const entries = new Map();
  return { entries, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
};

test("reading state, bookmarks, and app preferences survive reload without crossing accounts", () => {
  const storage = memoryStorage();
  const first = createLearningToolsStore(storage);
  first.setLessonStage("alice", "getting-started", "practice", 123);
  first.toggleBookmark("alice", "getting-started");
  first.toggleFavoriteTool("alice", "day-planner");
  first.visitTool("alice", "day-planner");
  const restored = createLearningToolsStore(storage);
  assert.deepEqual(restored.read("alice").lessons["getting-started"], { stage: "practice", completed: false, updatedAt: 123 });
  assert.deepEqual(restored.read("alice").bookmarks, ["getting-started"]);
  assert.deepEqual(restored.read("alice").favoriteTools, ["day-planner"]);
  assert.deepEqual(restored.read("alice").recentTools, ["day-planner"]);
  for (const account of ["bob", "guest"]) assert.deepEqual(restored.read(account), { version: 1, lessons: {}, bookmarks: [], favoriteTools: [], recentTools: [], solvedExercises: {} });
  restored.setLessonCompleted("alice", "getting-started", true, 456);
  restored.setLessonStage("alice", "getting-started", "check", 789);
  assert.equal(restored.read("alice").lessons["getting-started"].completed, true);
});

test("unknown lessons and apps cannot create progress for unpublished content", () => {
  const store = createLearningToolsStore(memoryStorage());
  const initial = store.read("guest");
  store.setLessonStage("guest", "math-foundations", "learn");
  store.setLessonCompleted("guest", "unpublished", true);
  store.toggleBookmark("guest", "unpublished");
  store.toggleFavoriteTool("guest", "not-an-app");
  store.visitTool("guest", "not-an-app");
  assert.equal(store.read("guest"), initial);
});

test("corrupt, incompatible, or tampered storage is sanitized", () => {
  for (const raw of ["broken", "null", "[]", '{"version":2}', '{"version":1,"lessons":null}']) assert.deepEqual(parseLearningToolsProgress(raw).lessons, {});
  const parsed = parseLearningToolsProgress(JSON.stringify({ version: 1,
    lessons: { "getting-started": { stage: "check", completed: "true", updatedAt: 10 }, fake: { stage: "check", completed: true, updatedAt: 10 } },
    bookmarks: ["getting-started", "getting-started", null, "fake"], favoriteTools: ["day-planner", "fake"], recentTools: ["day-planner", "day-planner", 7],
  }));
  assert.deepEqual(parsed.lessons, { "getting-started": { stage: "check", completed: false, updatedAt: 10 } });
  assert.deepEqual(parsed.bookmarks, ["getting-started"]);
  assert.deepEqual(parsed.favoriteTools, ["day-planner"]);
  assert.deepEqual(parsed.recentTools, ["day-planner"]);
  for (const value of [{ stage: "invalid", completed: true, updatedAt: 1 }, { stage: "learn", completed: true, updatedAt: -1 }]) assert.deepEqual(parseLearningToolsProgress(JSON.stringify({ version: 1, lessons: { "getting-started": value } })).lessons, {});
});

test("recent apps stay unique and bounded, and revisiting moves an app to the front", () => {
  const store = createLearningToolsStore(memoryStorage());
  for (const app of toolApps) store.visitTool("guest", app.id);
  assert.equal(store.read("guest").recentTools.length, 6);
  const id = store.read("guest").recentTools[4];
  store.visitTool("guest", id);
  assert.equal(store.read("guest").recentTools[0], id);
  assert.equal(new Set(store.read("guest").recentTools).size, 6);
  const snapshot = store.read("guest");
  store.visitTool("guest", id);
  assert.equal(store.read("guest"), snapshot);
});

test("blocked storage and full storage retain usable session state and stable snapshots", () => {
  for (const storage of [null, { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } }, { getItem() { return null; }, setItem() { throw Error("full"); } }]) {
    const store = createLearningToolsStore(storage);
    assert.equal(store.read("guest"), store.read("guest"));
    store.toggleFavoriteTool("guest", "day-planner");
    store.setLessonStage("guest", "getting-started", "explore", 10);
    store.setLessonCompleted("guest", "getting-started", true, 20);
    assert.deepEqual(store.read("guest").favoriteTools, ["day-planner"]);
    assert.equal(store.read("guest").lessons["getting-started"].completed, true);
    assert.equal(store.read("guest"), store.read("guest"));
    assert.deepEqual(store.read("another-account").favoriteTools, []);
  }
});

test("same-browser subscribers and other tabs see updates and cleared storage", () => {
  const storage = memoryStorage();
  const tabA = createLearningToolsStore(storage);
  const tabB = createLearningToolsStore(storage);
  tabB.read("alice");
  let aliceUpdates = 0;
  let bobUpdates = 0;
  const unsubscribe = tabB.subscribe("alice", () => aliceUpdates++);
  tabB.read("bob");
  tabB.subscribe("bob", () => bobUpdates++);
  tabA.toggleFavoriteTool("alice", "day-planner");
  tabB.syncFromStorage("pluto-learning-tools-v1:alice");
  assert.deepEqual(tabB.read("alice").favoriteTools, ["day-planner"]);
  assert.equal(aliceUpdates, 1);
  assert.equal(bobUpdates, 0);
  tabB.toggleBookmark("alice", "getting-started");
  assert.equal(aliceUpdates, 2);
  storage.entries.clear();
  tabB.syncFromStorage(null);
  assert.deepEqual(tabB.read("alice").favoriteTools, []);
  assert.deepEqual(tabB.read("alice").bookmarks, []);
  unsubscribe();
  tabB.toggleFavoriteTool("alice", "day-planner");
  assert.equal(aliceUpdates, 3);
});

test("catalog routes are unique and all learning/tool cross-links resolve", () => {
  const routes = [...learningSubjects.map(subject => subjectRoute(subject.id)), ...learningPaths.map(pathRoute), ...learningLessons.map(lesson => lesson.route), ...toolApps.map(tool => toolRoute(tool.id))];
  assert.equal(new Set(routes).size, routes.length);
  for (const path of learningPaths) {
    assert.ok(learningSubjects.some(subject => subject.id === path.subjectId));
    for (const id of path.relatedTools ?? []) assert.ok(toolApps.some(tool => tool.id === id));
  }
  for (const tool of toolApps) if (tool.relatedPath) assert.ok(learningPaths.some(path => path.id === tool.relatedPath.id && path.subjectId === tool.relatedPath.subjectId));
  for (const lesson of learningLessons) if (lesson.subjectId) assert.ok(learningPaths.some(path => path.subjectId === lesson.subjectId && path.id === lesson.pathId));
});
