import test from "node:test";
import assert from "node:assert/strict";
import { applyGoMove, createInitialGoState } from "../src/games/go/rules.ts";
import { cacheGoRecord, deleteSavedGoGame, getSavedGoGame, listSavedGoGames, saveGoRecord } from "../src/games/go/storage.ts";
import { goMoveQuality } from "../src/games/go/analysis.ts";

test("saved Go records reconstruct ongoing and completed games exactly", () => {
  const entries = new Map();
  const prior = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  try {
    let game = createInitialGoState(13);
    for (const move of [{ type: "place", row: 0, col: 1 }, { type: "place", row: 0, col: 0 }, { type: "place", row: 1, col: 0 }, { type: "pass" }]) game = applyGoMove(game, move);
    const ongoing = saveGoRecord(game, { mode: "hotseat", players: { black: "Black", white: "White" } });
    assert.deepEqual(getSavedGoGame(ongoing.id).game, game);
    const finished = applyGoMove(game, { type: "pass" });
    const saved = saveGoRecord(finished, { mode: "hotseat", players: { black: "Black", white: "White" } });
    assert.equal(saved.game.status, "finished");
    assert.deepEqual(getSavedGoGame(saved.id).game, finished);
    assert.equal(listSavedGoGames().length, 2);
    deleteSavedGoGame(ongoing.id);
    assert.equal(getSavedGoGame(ongoing.id), null);
    assert.deepEqual(getSavedGoGame(saved.id).game, finished);
  } finally { if (prior === undefined) delete globalThis.localStorage; else globalThis.localStorage = prior; }
});

test("saved Go records reject corrupted board snapshots", () => {
  const entries = new Map();
  const prior = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
  try {
    const game = applyGoMove(createInitialGoState(), { type: "place", row: 0, col: 0 });
    game.board[0] = null;
    assert.throws(() => saveGoRecord(game, { mode: "ai", players: { black: "You", white: "KataGo" } }));
  } finally { if (prior === undefined) delete globalThis.localStorage; else globalThis.localStorage = prior; }
});

test("account-owned records stay out of another account's local library", () => {
  const entries = new Map();
  const prior = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); } };
  try {
    const game = applyGoMove(createInitialGoState(), { type: "place", row: 0, col: 0 });
    const own = saveGoRecord(game, { mode: "ai", players: { black: "You", white: "Bot" } }, undefined, "account-a");
    assert.equal(listSavedGoGames("account-b").length, 0);
    assert.equal(getSavedGoGame(own.id, "account-b"), null);
    assert.equal(listSavedGoGames("account-a").length, 1);
    cacheGoRecord(own);
    assert.equal(listSavedGoGames("account-a").length, 1);
  } finally { if (prior === undefined) delete globalThis.localStorage; else globalThis.localStorage = prior; }
});

test("Go review categories use top engine move and score-loss boundaries", () => {
  assert.equal(goMoveQuality(0.3, true), "AI Move");
  assert.deepEqual([0, 1.9, 2, 5, 10].map(loss => goMoveQuality(loss)), ["Good", "Good", "Inaccuracy", "Mistake", "Blunder"]);
});
