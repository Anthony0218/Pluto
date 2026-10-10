import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { gradeMove } from "../src/utils/chessAnalysis.ts";

// A quiet endgame, far from any opening book.
const START = "4k3/8/8/3p4/8/2N5/PPP5/4K3 w - - 0 30";
const after = (san) => { const game = new Chess(START); game.move(san); return game.fen(); };
// A scripted engine: each call returns the next prepared set of lines (cp scores are from the side to move).
const engine = (...answers) => { const calls = []; const analyze = async (fen, options) => { calls.push({ fen, options }); return answers[calls.length - 1] ?? []; }; analyze.calls = calls; return analyze; };
const line = (uci, scoreCp, mate = null) => ({ multipv: 1, scoreCp, mate, pv: [uci] });

test("the move the coach showed first is Best, even when the grading search would have picked another", async () => {
  const shown = [{ uci: "c3e4", san: "Ne4", evaluation: "+0.35" }, { uci: "c3b5", san: "Nb5", evaluation: "+0.30" }];
  const analyze = engine();
  const review = await gradeMove(START, after("Ne4"), "c3e4", "Ne4", analyze, 400, () => shown);
  assert.equal(review.quality, "Best");
  assert.equal(review.centipawnLoss, 0);
  assert.equal(analyze.calls.length, 0, "no second opinion is needed");
});

test("a lower coach suggestion loses exactly the evaluation the coach gave it", async () => {
  const shown = [{ uci: "c3e4", san: "Ne4", evaluation: "+0.50" }, { uci: "c3b5", san: "Nb5", evaluation: "+0.40" }, { uci: "c3a4", san: "Na4", evaluation: "-0.20" }];
  const second = await gradeMove(START, after("Nb5"), "c3b5", "Nb5", engine(), 400, () => shown);
  assert.equal(second.quality, "Excellent");
  const third = await gradeMove(START, after("Na4"), "c3a4", "Na4", engine(), 400, () => shown);
  assert.equal(third.centipawnLoss, 70);
  assert.equal(third.quality, "Inaccuracy");
});

test("without a hint, a move among the grading search's own top lines is graded from that search", async () => {
  const lines = [line("c3e4", 40), { ...line("c3b5", 30), multipv: 2 }, { ...line("a2a4", 10), multipv: 3 }];
  // The position after the move is searched at a different depth and would say -80 for White: ignored.
  const analyze = engine(lines, [line("e8e7", 80)]);
  const review = await gradeMove(START, after("Nb5"), "c3b5", "Nb5", analyze, 400);
  assert.equal(review.quality, "Excellent");
  assert.equal(review.centipawnLoss, 10);
  assert.equal(analyze.calls.length, 1);
});

test("a move outside the top lines is still compared with the position after it", async () => {
  const lines = [line("c3e4", 40), { ...line("c3b5", 30), multipv: 2 }, { ...line("a2a4", 10), multipv: 3 }];
  const review = await gradeMove(START, after("a3"), "a2a3", "a3", engine(lines, [line("e8e7", 400)]), 400);
  assert.equal(review.quality, "Blunder");
});

test("a hint for another position is not used", async () => {
  const shown = [{ uci: "c3e4", san: "Ne4", evaluation: "+0.35" }];
  const lines = [line("c3b5", 40), { ...line("c3e4", 35), multipv: 2 }];
  const analyze = engine(lines);
  const review = await gradeMove(START, after("Ne4"), "c3e4", "Ne4", analyze, 400, () => undefined);
  assert.equal(analyze.calls.length, 1);
  assert.equal(review.quality, "Excellent");
  assert.equal(shown.length, 1);
});

test("letting a forced mate go is never better than an inaccuracy", async () => {
  const shown = [{ uci: "c3e4", san: "Ne4", evaluation: "M3" }, { uci: "c3b5", san: "Nb5", evaluation: "+9.90" }];
  const review = await gradeMove(START, after("Nb5"), "c3b5", "Nb5", engine(), 400, () => shown);
  assert.equal(review.missedMate, true);
  assert.notEqual(review.quality, "Best");
  assert.notEqual(review.quality, "Excellent");
});
