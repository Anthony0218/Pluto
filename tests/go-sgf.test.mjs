import test from "node:test";
import assert from "node:assert/strict";
import { applyGoMove, createInitialGoState, toggleDeadGoGroup } from "../src/games/go/rules.ts";
import { exportGoSgf, importGoSgf } from "../src/games/go/sgf.ts";

test("SGF round-trips passes, result and post-pass dead stones", () => {
  let game = createInitialGoState(9);
  for (const move of [{ type: "place", row: 0, col: 0 }, { type: "place", row: 4, col: 4 }, { type: "pass" }, { type: "pass" }]) game = applyGoMove(game, move);
  game = toggleDeadGoGroup(game, 40);
  const sgf = exportGoSgf(game, { black: "A]lice", white: "Bob\\Smith" });
  assert.match(sgf, /FF\[4\]GM\[1\]/);
  assert.match(sgf, /;B\[aa\];W\[ee\];B\[\];W\[\]/);
  assert.deepEqual(importGoSgf(sgf).game, game);
  assert.deepEqual(importGoSgf(sgf).players, { black: "A]lice", white: "Bob\\Smith" });
});

test("SGF round-trips resignation and follows the first main-line variation", () => {
  let game = applyGoMove(createInitialGoState(13), { type: "place", row: 2, col: 3 });
  game = applyGoMove(game, { type: "resign" });
  assert.deepEqual(importGoSgf(exportGoSgf(game, { black: "Black", white: "White" })).game, game);
  const variation = "(;FF[4]GM[1]SZ[9]KM[6.5]RU[Chinese];B[cc](;W[dd])(;W[ee]))";
  assert.equal(importGoSgf(variation).game.board[3 * 9 + 3], "white");
});

test("SGF rejects incompatible rules and illegal moves", () => {
  assert.throws(() => importGoSgf("(;FF[4]GM[1]SZ[9]KM[6.5]RU[Japanese])"), /Chinese/);
  assert.throws(() => importGoSgf("(;FF[4]GM[1]SZ[9]KM[6.5]RU[Chinese];B[aa];W[aa])"), /Illegal Go move/);
  assert.throws(() => importGoSgf("(;FF[4]GM[1]SZ[9]KM[6.5]RU[Chinese]RE[B+R];B[];W[])"), /conflicts/);
});
