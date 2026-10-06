import test from "node:test";
import assert from "node:assert/strict";
import { reviewMoveAnnotations, liveCoachAnnotations } from "../src/components/chess/singleplayer/boardAnnotations.ts";

test("support markup matters for a checker the king could capture", () => {
  const fen = "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4";
  const marks = reviewMoveAnnotations({ from: "h5", to: "f7", quality: "Best", fenAfter: fen });
  assert.ok(marks.badges.some(badge => badge.square === "f7"));
  assert.ok(marks.marks.some(mark => mark.square === "c4"));
  assert.ok(liveCoachAnnotations({ to: "f7", quality: "Best", fenAfter: fen }).badges.length);
});

test("a distant mating queen needs no shield or protector border", () => {
  const fen = "Q5k1/5ppp/2B5/8/8/8/5PPP/6K1 b - - 0 1";
  const marks = reviewMoveAnnotations({ from: "a1", to: "a8", quality: "Best", fenAfter: fen });
  assert.deepEqual(marks.badges, []);
  assert.ok(!marks.marks.some(mark => mark.square === "c6"));
  assert.deepEqual(liveCoachAnnotations({ to: "a8", quality: "Best", fenAfter: fen }).badges, []);
});
