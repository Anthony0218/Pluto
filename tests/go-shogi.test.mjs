import test from "node:test";
import assert from "node:assert/strict";
import { applyGoMove, createInitialGoState, getLegalGoMoves, hashGoBoard, isLegalGoMove, scoreGo } from "../src/games/go/rules.ts";
import { goBot } from "../src/games/go/bot.ts";
import { applyShogiMove, createInitialShogiState, getLegalShogiMoves, isInCheck, isLegalShogiMove, mustPromote } from "../src/games/shogi/rules.ts";
import { shogiBot } from "../src/games/shogi/bot.ts";

const goAt = (state, row, col) => row * state.boardSize + col;
test("Go supports all board sizes and legal placement", () => {
  for (const size of [9, 13, 19]) assert.equal(createInitialGoState(size).board.length, size * size);
  const state = createInitialGoState();
  const next = applyGoMove(state, { type: "place", row: 4, col: 4 });
  assert.equal(next.board[40], "black");
  assert.equal(next.currentPlayer, "white");
  assert.equal(isLegalGoMove(next, { type: "place", row: 4, col: 4 }), false);
});
test("Go captures stones and groups", () => {
  const state = createInitialGoState();
  state.board[goAt(state, 0, 0)] = "white";
  state.board[goAt(state, 0, 1)] = "black";
  state.positionHashes = [hashGoBoard(state.board)];
  const next = applyGoMove(state, { type: "place", row: 1, col: 0 });
  assert.equal(next.board[0], null);
  assert.equal(next.captures.black, 1);
  const group = createInitialGoState();
  group.board[0] = group.board[1] = "white";
  group.board[2] = group.board[9] = "black";
  group.positionHashes = [hashGoBoard(group.board)];
  const captured = applyGoMove(group, { type: "place", row: 1, col: 1 });
  assert.equal(captured.board[0], null);
  assert.equal(captured.board[1], null);
  assert.equal(captured.captures.black, 2);
});
test("Go rejects suicide but permits a capturing placement", () => {
  const state = createInitialGoState();
  state.board[1] = state.board[9] = "white";
  state.positionHashes = [hashGoBoard(state.board)];
  assert.equal(isLegalGoMove(state, { type: "place", row: 0, col: 0 }), false);
  state.board.fill(null); state.board[0] = "white"; state.board[1] = "black"; state.positionHashes = [hashGoBoard(state.board)];
  assert.equal(isLegalGoMove(state, { type: "place", row: 1, col: 0 }), true);
});
test("Go superko, passes, history, and deterministic score", () => {
  const state = createInitialGoState();
  const next = applyGoMove(state, { type: "place", row: 0, col: 0 });
  const blocked = { ...state, positionHashes: [...state.positionHashes, hashGoBoard(next.board)] };
  assert.equal(isLegalGoMove(blocked, { type: "place", row: 0, col: 0 }), false);
  const onePass = applyGoMove(state, { type: "pass" });
  const done = applyGoMove(onePass, { type: "pass" });
  assert.equal(done.status, "finished");
  assert.equal(done.moveHistory.length, 2);
  assert.equal(scoreGo(done).white > scoreGo(done).black, true);
});

const emptyShogi = () => {
  const state = createInitialShogiState();
  state.board.fill(null);
  state.board[80] = { color: "black", type: "K", promoted: false };
  state.board[8] = { color: "white", type: "K", promoted: false };
  state.hands = { black: {}, white: {} };
  return state;
};
test("Shogi initial state and every piece movement", () => {
  assert.equal(createInitialShogiState().board.filter(Boolean).length, 40);
  const destinations = { P: 31, L: 31, N: 21, S: 30, G: 30, K: 30, R: 31, B: 20 };
  for (const [type, to] of Object.entries(destinations)) {
    const state = emptyShogi();
    state.board[40] = { color: "black", type, promoted: false };
    assert.equal(getLegalShogiMoves(state).some((move) => move.type === "move" && move.from === 40 && move.to === to), true, type);
  }
});
test("Shogi captures add demoted pieces to hand", () => {
  const state = emptyShogi();
  state.board[40] = { color: "black", type: "R", promoted: false };
  state.board[31] = { color: "white", type: "P", promoted: true };
  const next = applyShogiMove(state, { type: "move", from: 40, to: 31, promote: false });
  assert.equal(next.hands.black.P, 1);
  assert.equal(next.board[31].type, "R");
});
test("Shogi check and self-check are enforced", () => {
  const state = emptyShogi();
  state.board[4] = { color: "white", type: "R", promoted: false };
  state.board[76] = { color: "black", type: "K", promoted: false };
  state.board[67] = { color: "black", type: "G", promoted: false };
  assert.equal(isInCheck(state, "black"), false);
  assert.equal(isLegalShogiMove(state, { type: "move", from: 67, to: 66, promote: false }), false);
});
test("Shogi optional and mandatory promotion", () => {
  const state = emptyShogi();
  state.board[13] = { color: "black", type: "P", promoted: false };
  const moves = getLegalShogiMoves(state).filter((move) => move.type === "move" && move.from === 13);
  assert.equal(moves.length, 1);
  assert.equal(moves[0].promote, true);
  assert.equal(mustPromote({ color: "black", type: "N", promoted: false }, 1), true);
  assert.equal(mustPromote({ color: "black", type: "L", promoted: false }, 0), true);
});
test("Shogi drops enforce nifu and dead ranks", () => {
  const state = emptyShogi();
  state.hands.black = { P: 1, L: 1, N: 1 };
  state.board[58] = { color: "black", type: "P", promoted: false };
  const moves = getLegalShogiMoves(state);
  assert.equal(moves.some((move) => move.type === "drop" && move.piece === "P" && move.to % 9 === 4), false);
  assert.equal(moves.some((move) => move.type === "drop" && move.piece === "P" && move.to < 9), false);
  assert.equal(moves.some((move) => move.type === "drop" && move.piece === "L" && move.to < 9), false);
  assert.equal(moves.some((move) => move.type === "drop" && move.piece === "N" && move.to < 18), false);
  assert.equal(moves.some((move) => move.type === "drop" && move.piece === "P" && move.to === 30), true);
});
test("Promoted rook and bishop gain king steps", () => {
  const rook = emptyShogi(); rook.board[40] = { color: "black", type: "R", promoted: true };
  assert.equal(getLegalShogiMoves(rook).some((move) => move.type === "move" && move.from === 40 && move.to === 30), true);
  const bishop = emptyShogi(); bishop.board[40] = { color: "black", type: "B", promoted: true };
  assert.equal(getLegalShogiMoves(bishop).some((move) => move.type === "move" && move.from === 40 && move.to === 31), true);
});
test("Shogi forbids pawn-drop mate and detects an equivalent rook mate", () => {
  const state = emptyShogi();
  state.board[8] = null;
  state.board[4] = { color: "white", type: "K", promoted: false };
  state.board[20] = { color: "black", type: "N", promoted: false };
  state.board[22] = { color: "black", type: "G", promoted: false };
  state.board[24] = { color: "black", type: "N", promoted: false };
  state.hands.black = { P: 1 };
  assert.equal(getLegalShogiMoves(state).some((move) => move.type === "drop" && move.piece === "P" && move.to === 13), false);
  state.board[9] = { color: "black", type: "R", promoted: false };
  const mate = applyShogiMove(state, { type: "move", from: 9, to: 13, promote: false });
  assert.equal(mate.status, "finished");
  assert.equal(mate.winner, "black");
  assert.match(mate.result, /checkmate/);
});
test("Bots return legal moves, reject finished games, and cancel", async () => {
  const go = createInitialGoState();
  const goMove = await goBot.chooseMove(go, "easy");
  assert.equal(isLegalGoMove(go, goMove), true);
  await assert.rejects(() => goBot.chooseMove({ ...go, status: "finished" }, "easy"));
  const controller = new AbortController();
  const pending = goBot.chooseMove(go, "hard", controller.signal); controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  const tactic = createInitialGoState();
  tactic.board[0] = "white"; tactic.board[1] = "black"; tactic.positionHashes = [hashGoBoard(tactic.board)];
  const tacticalMove = await goBot.chooseMove(tactic, "hard");
  assert.deepEqual(tacticalMove, { type: "place", row: 1, col: 0 });
  const shogi = createInitialShogiState();
  const shogiMove = await shogiBot.chooseMove(shogi, "easy");
  assert.equal(isLegalShogiMove(shogi, shogiMove), true);
  await assert.rejects(() => shogiBot.chooseMove({ ...shogi, status: "finished" }, "easy"));
});
