import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { ANALYSIS_DEMO_MOVES, analysisPositions } from "../src/components/chess/singleplayer/analysisDemo.ts";
import { buildVariantPreview } from "../src/games/chess/custom/library/preview.ts";
import { createVariantFromPreset } from "../src/games/chess/custom/engine/presets.ts";
import { summarize } from "../src/games/chess/custom/storage/variantRepository.ts";

test("the analysis demo has 49 full moves, a valid position for every ply and ends in checkmate", () => {
  assert.equal(ANALYSIS_DEMO_MOVES.length, 97);
  const replay = analysisPositions(ANALYSIS_DEMO_MOVES);
  assert.equal(replay.valid, true);
  assert.equal(replay.positions.length, 98);
  const game = new Chess();
  ANALYSIS_DEMO_MOVES.forEach((san, index) => {
    const move = game.move(san);
    assert.equal(replay.positions[index + 1].fen, game.fen());
    assert.deepEqual(replay.positions[index + 1].lastMove, { from: move.from, to: move.to });
  });
  assert.equal(game.isCheckmate(), true);
});

test("empty and unsupported histories cannot start analysis", () => {
  assert.equal(analysisPositions([]).valid, false);
  const invalid = analysisPositions(["e4", "e5", "Qh9"]);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.positions.length, 3);
  assert.equal(analysisPositions(["e4", null]).valid, false);
});

test("library previews preserve each piece's identity, icon, team and royal status", () => {
  const variant = createVariantFromPreset("standard");
  variant.pieces.find(piece => piece.id === "knight").icon = "🐉";
  for (const preview of [buildVariantPreview(variant), summarize(variant).preview]) {
    assert.equal(preview.pieces.length, 32);
    for (let i = 0; i < preview.pieces.length; i++) {
      const placed = variant.setup.pieces[i];
      const definition = variant.pieces.find(piece => piece.id === placed.type);
      assert.equal(preview.pieces[i].type, placed.type);
      assert.equal(preview.pieces[i].icon, definition.icon);
      assert.equal(preview.pieces[i].color, variant.teams.find(team => team.id === placed.team).color);
      assert.equal(Boolean(preview.pieces[i].royal), definition.royal);
    }
  }
});

const line = (score, pv) => ({ multipv: 1, scoreCp: score.cp ?? null, mate: score.mate ?? null, pv });
const after = (fen, uci) => {
  const game = new Chess(fen);
  game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return game.fen();
};

test("a move that skips a mate in 1 is a missed mate, not an excellent move", async () => {
  const { gradePlayedMove } = await import("../src/utils/chessAnalysis.ts");
  // Stockfish: "mate 1" (Rh8#) before, "mate -1" after the waiting move Rh7.
  const fen = "k7/8/1K6/8/8/8/8/7R w - - 0 1";
  const grade = gradePlayedMove(fen, after(fen, "h1h7"), "h1h7", line({ mate: 1 }, ["h1h8"]), line({ mate: -1 }, ["a8b8", "h7h8"]));
  assert.equal(grade.missedMate, true);
  assert.ok(grade.centipawnLoss > 0);
  assert.equal(grade.quality, "Inaccuracy");
});

test("losing a forced mate costs a few pawns, not hundreds", async () => {
  const { gradePlayedMove } = await import("../src/utils/chessAnalysis.ts");
  // Stockfish: Ra8# is mate in 1; after Rb1 Black is only -6.12.
  const fen = "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1";
  const grade = gradePlayedMove(fen, after(fen, "a1b1"), "a1b1", line({ mate: 1 }, ["a1a8"]), line({ cp: -612 }, ["h7h6"]));
  assert.equal(grade.missedMate, true);
  assert.equal(grade.quality, "Blunder");
  assert.ok(grade.centipawnLoss < 1000, `loss ${grade.centipawnLoss}`);
});

test("the shortest mate loses nothing and a slower mate loses a little", async () => {
  const { gradePlayedMove } = await import("../src/utils/chessAnalysis.ts");
  const fen = "k7/8/1K6/8/8/8/8/7R w - - 0 1";
  const fenAfter = after(fen, "h1h7");
  const best = gradePlayedMove(fen, fenAfter, "h1h7", line({ mate: 3 }, ["h1h7"]), line({ mate: -2 }, ["a8b8"]));
  assert.deepEqual([best.quality, best.centipawnLoss, best.missedMate], ["Best", 0, false]);
  const slower = gradePlayedMove(fen, fenAfter, "h1h7", line({ mate: 3 }, ["h1h2"]), line({ mate: -3 }, ["a8b8"]));
  assert.equal(slower.missedMate, false);
  assert.equal(slower.quality, "Excellent");
  assert.ok(slower.centipawnLoss > 0);
});

test("any checkmating move is the best move", async () => {
  const { gradePlayedMove } = await import("../src/utils/chessAnalysis.ts");
  const fen = "k7/8/1K6/8/8/8/8/6RR w - - 0 1";
  const grade = gradePlayedMove(fen, after(fen, "g1g8"), "g1g8", line({ mate: 1 }, ["h1h8"]), undefined);
  assert.deepEqual([grade.quality, grade.centipawnLoss, grade.missedMate], ["Best", 0, false]);
});

test("evaluation scores rank mates above every capped evaluation", async () => {
  const { evaluationScore } = await import("../src/utils/chessAnalysis.ts");
  const order = ["M1", "M2", "M30", "+25.00", "+3.50", "0.00", "-25.00", "-M30", "-M1"].map(evaluationScore);
  assert.deepEqual([...order].sort((a, b) => b - a), order);
  assert.ok(order[2] > order[3]);
  assert.equal(evaluationScore("+25.00"), evaluationScore("+10.00"));
});

test("live coach, backfilled coach and full review all detect opening book moves", async () => {
  const { gradeMove, gradeEarlierMoves, reviewGameMoves } = await import("../src/utils/chessAnalysis.ts");
  const before = new Chess().fen(), afterFen = after(before, "e2e4");
  const analyze = async fen => [line({ cp: 30 }, [new Chess(fen).turn() === "w" ? "e2e4" : "e7e5"])];
  assert.equal((await gradeMove(before, afterFen, "e2e4", "e4", analyze)).quality, "Book");
  assert.equal((await reviewGameMoves(["e4"], analyze))[0].quality, "Book");
  const backfilled = [];
  await gradeEarlierMoves(["e4"], [1], analyze, { stillWanted: () => true, onGrade: grade => backfilled.push(grade) });
  assert.equal(backfilled[0].quality, "Book");
  assert.equal(backfilled[0].openingName, "King's Pawn Game");
});
