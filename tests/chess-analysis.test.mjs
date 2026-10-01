import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { ANALYSIS_DEMO_MOVES, analysisPositions } from "../src/components/chess/singleplayer/analysisDemo.ts";
import { buildVariantPreview } from "../src/games/chess/custom/library/preview.ts";
import { createVariantFromPreset } from "../src/games/chess/custom/engine/presets.ts";
import { summarize } from "../src/games/chess/custom/storage/variantRepository.ts";

test("the analysis demo has 60 full moves with a valid position for every ply", () => {
  assert.equal(ANALYSIS_DEMO_MOVES.length, 120);
  const replay = analysisPositions(ANALYSIS_DEMO_MOVES);
  assert.equal(replay.valid, true);
  assert.equal(replay.positions.length, 121);
  const game = new Chess();
  ANALYSIS_DEMO_MOVES.forEach((san, index) => {
    const move = game.move(san);
    assert.equal(replay.positions[index + 1].fen, game.fen());
    assert.deepEqual(replay.positions[index + 1].lastMove, { from: move.from, to: move.to });
  });
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
