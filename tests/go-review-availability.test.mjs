import test from "node:test";
import assert from "node:assert/strict";
import { applyGoMove, createInitialGoState } from "../src/games/go/rules.ts";
import { canReviewGoGame } from "../src/games/go/reviewAvailability.ts";
import { loadGoGame, saveGoGame } from "../src/games/go/storage.ts";

test("Go review unlocks only after resignation or the second pass", () => {
  const start = createInitialGoState();
  const firstPass = applyGoMove(start, { type: "pass" });
  const secondPass = applyGoMove(firstPass, { type: "pass" });
  const resignation = applyGoMove(start, { type: "resign" });
  assert.equal(canReviewGoGame(start), false);
  assert.equal(canReviewGoGame(firstPass), false);
  assert.equal(canReviewGoGame(secondPass), true);
  assert.equal(canReviewGoGame(resignation), true);
});

test("The analysis route loads the latest completed game while a new game is underway", () => {
  const entries = new Map();
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
  };
  try {
    const start = createInitialGoState();
    const playing = applyGoMove(start, { type: "place", row: 0, col: 0 });
    saveGoGame(playing);
    assert.equal(canReviewGoGame(loadGoGame()), false);

    const finished = applyGoMove(playing, { type: "resign" });
    saveGoGame(finished);
    assert.deepEqual(loadGoGame(), finished);

    saveGoGame(applyGoMove(createInitialGoState(), { type: "pass" }));
    assert.deepEqual(loadGoGame(), finished);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});

test("Ranked timeout and off-turn resignation remain reviewable from the Go menu after replay", () => {
  const entries = new Map();
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  try {
    const position = applyGoMove(createInitialGoState(), { type: "place", row: 4, col: 4 });
    for (const reason of ["timeout", "resignation"]) {
      const finished = { ...position, status: "finished", winner: "white", result: `white wins by ${reason}` };
      saveGoGame(finished);
      assert.deepEqual(loadGoGame(), finished);
      assert.equal(canReviewGoGame(loadGoGame()), true);
    }
    const invalid = { ...position, board: ["corrupt"], status: "finished", winner: "white", result: "white wins by timeout" };
    saveGoGame(invalid);
    assert.deepEqual(loadGoGame().board, position.board);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
