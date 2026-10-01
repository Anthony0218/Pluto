import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMove,
  chooseAiMove,
  createGameState,
  createRectangularBoard,
  createVariantFromPreset,
  getLegalMoves,
  parseVariantJson,
  serializeVariant,
  updateCell,
  validateVariant,
} from "../src/games/chess/custom/engine/index.ts";
import { joinOnlineSeats, onlineSeat, resolveRequestedMove, sameVariantReference, validateOnlineVariant, variantReference } from "../src/games/chess/custom/multiplayer/protocol.ts";
import { createHistory, editorReducer } from "../src/games/chess/custom/editor/editorStore.ts";
import { createPlutoVariant } from "../src/games/chess/custom/library/plutoVariants.ts";

function layered(pieces, sizes = [8, 8, 8]) {
  const variant = createVariantFromPreset("three-level");
  variant.board = createRectangularBoard(sizes[0], sizes[0]);
  variant.board.layers = sizes.slice(1).map((size, index) => ({ ...createRectangularBoard(size, size), id: `layer-${index + 1}`, name: `Layer ${index + 1}`, z: index + 1 }));
  variant.setup = { pieces, startingTeam: "white", turnNumber: 1 };
  variant.settings.royalMode = "none";
  variant.victoryConditions = [{ id: "capture-all", type: "captureAll", enabled: true }];
  return variant;
}

const placed = (type, team, x, y, z = 0) => ({ type, team, x, y, z });

test("standard chess stays on z=0 and the migrated preset matches its old setup", () => {
  const standard = createVariantFromPreset("standard");
  const migrated = createVariantFromPreset("3d-chess");
  assert.equal(migrated.board.width, 8);
  assert.equal(migrated.board.layers?.length ?? 0, 0);
  assert.deepEqual(migrated.setup.pieces, standard.setup.pieces);
  assert.equal(getLegalMoves(standard, createGameState(standard)).length, 20);
  assert.equal(getLegalMoves(migrated, createGameState(migrated)).length, 20);
});

test("vertical slides stop at pieces, then capture the blocker on its layer", () => {
  const variant = layered([placed("rook", "white", 3, 3), placed("pawn", "black", 3, 3, 1), placed("king", "black", 7, 7, 2)]);
  const state = createGameState(variant);
  const rook = state.pieces.find((piece) => piece.type === "rook");
  const moves = getLegalMoves(variant, state, { pieceId: rook.id });
  const upward = moves.filter((move) => move.to.x === 3 && move.to.y === 3 && move.to.z > 0);
  assert.deepEqual(upward.map((move) => move.to.z), [1]);
  assert.equal(upward[0].captureIds.length, 1);
  const after = applyMove(variant, state, upward[0]);
  assert.equal(after.pieces.find((piece) => piece.id === rook.id).z, 1);
  assert.equal(after.pieces.some((piece) => piece.type === "pawn"), false);
});

test("cross-layer leaps, portals, holes and different layer sizes use real coordinates", () => {
  const variant = layered([placed("knight", "white", 1, 1), placed("rook", "black", 3, 2, 1)], [8, 6, 4]);
  let state = createGameState(variant);
  const knight = state.pieces.find((piece) => piece.type === "knight");
  let moves = getLegalMoves(variant, state, { pieceId: knight.id });
  assert.ok(moves.some((move) => move.to.x === 3 && move.to.y === 2 && move.to.z === 1 && move.captureIds.length === 1));
  variant.board = updateCell(variant.board, { x: 3, y: 2, z: 1 }, { enabled: false });
  state = createGameState(variant);
  moves = getLegalMoves(variant, state, { pieceId: state.pieces.find((piece) => piece.type === "knight").id });
  assert.ok(!moves.some((move) => move.to.x === 3 && move.to.y === 2 && move.to.z === 1));
  variant.board = updateCell(variant.board, { x: 3, y: 2, z: 1 }, { enabled: true });
  variant.board = updateCell(variant.board, { x: 2, y: 3, z: 1 }, { tile: "portal", portalTarget: { x: 1, y: 1, z: 2 } });
  state = createGameState(variant);
  moves = getLegalMoves(variant, state, { pieceId: state.pieces.find((piece) => piece.type === "knight").id });
  assert.ok(moves.some((move) => move.to.x === 2 && move.to.y === 3 && move.to.z === 1 && move.landing?.z === 2));
  assert.ok(!moves.some((move) => move.to.x === 8 && move.to.z === 1));
});

test("AI chooses only engine legal moves and layered JSON round-trips", () => {
  const variant = layered([placed("rook", "white", 3, 3), placed("pawn", "black", 3, 3, 1), placed("king", "black", 7, 7)], [8, 8]);
  const state = createGameState(variant);
  const legal = getLegalMoves(variant, state);
  for (const kind of ["random", "greedy", "strategist"]) {
    const chosen = chooseAiMove(variant, state, kind, () => 0.25);
    assert.ok(legal.some((move) => move.pieceId === chosen.pieceId && JSON.stringify(move.to) === JSON.stringify(chosen.to)));
  }
  const parsed = parseVariantJson(serializeVariant(variant));
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.variant.board.layers[0].z, 1);
  assert.equal(validateVariant(parsed.variant).filter((issue) => issue.severity === "error").length, 0);
});

test("online move validation rejects illegal coordinates and mismatched rulebooks", async () => {
  const variant = layered([placed("rook", "white", 3, 3), placed("pawn", "black", 3, 3, 1)], [8, 8]);
  const state = createGameState(variant);
  const rook = state.pieces.find((piece) => piece.type === "rook");
  const allowed = resolveRequestedMove(variant, state, { pieceId: rook.id, from: { x: 3, y: 3, z: 0 }, to: { x: 3, y: 3, z: 1 } });
  assert.ok(allowed);
  assert.equal(resolveRequestedMove(variant, state, { pieceId: rook.id, from: { x: 3, y: 3, z: 0 }, to: { x: 3, y: 3, z: 2 } }), null);
  const first = await variantReference(variant);
  const reordered = JSON.parse(JSON.stringify(variant));
  reordered.theme = { pieceSkin: reordered.theme.pieceSkin, boardTheme: reordered.theme.boardTheme };
  assert.ok(sameVariantReference(first, await variantReference(reordered)));
  reordered.pieces.find((piece) => piece.id === "rook").movement.pop();
  assert.ok(!sameVariantReference(first, await variantReference(reordered)));
  assert.deepEqual(validateOnlineVariant(variant), []);
});

test("four-player Pluto editions assign one online seat per team and wait for all four players", () => {
  for (const id of ["pluto-team-chess", "pluto-team-chess-long"]) {
    const variant = createPlutoVariant(id);
    assert.deepEqual(validateOnlineVariant(variant), []);
    let players = ["host"];
    for (const user of ["red-player", "black-player", "blue-player"]) {
      players = joinOnlineSeats(players, user, variant.teams.length);
      assert.equal(onlineSeat(players, user), players.length - 1);
      assert.equal(variant.teams[onlineSeat(players, user)].id, ["white", "red", "black", "blue"][players.length - 1]);
    }
    assert.deepEqual(joinOnlineSeats(players, "red-player", 4), players, "rejoining keeps the same seat");
    assert.equal(joinOnlineSeats(players, "fifth-player", 4), null, "a full room rejects another player");

    const state = createGameState(variant);
    const move = getLegalMoves(variant, state)[0];
    assert.ok(move);
    assert.equal(state.turn, variant.teams[0].id);
    assert.equal(applyMove(variant, state, move).turn, variant.teams[1].id);
  }
});

test("reordering and deleting layers update positions and portal destinations", () => {
  const variant = layered([placed("rook", "white", 1, 1, 1), placed("pawn", "black", 2, 2, 2)]);
  variant.board = updateCell(variant.board, { x: 3, y: 3, z: 0 }, { tile: "portal", portalTarget: { x: 1, y: 1, z: 1 } });
  let history = createHistory(variant);
  history = editorReducer(history, { type: "swapLayers", a: 1, b: 2 });
  assert.equal(history.present.variant.setup.pieces[0].z, 2);
  assert.equal(history.present.testSetup.pieces[1].z, 1);
  assert.equal(history.present.variant.board.cells.find((cell) => cell.x === 3 && cell.y === 3).portalTarget.z, 2);
  history = editorReducer(history, { type: "deleteLayer", z: 2 });
  assert.equal(history.present.variant.setup.pieces.some((piece) => piece.z === 2), false);
  assert.equal(history.present.variant.board.cells.find((cell) => cell.x === 3 && cell.y === 3).tile, "normal");
});

test("a reconnect snapshot preserves the moved piece, board layers, and turn", () => {
  const variant = layered([placed("rook", "white", 3, 3), placed("pawn", "black", 3, 3, 1), placed("king", "black", 7, 7)], [8, 8]);
  const before = createGameState(variant);
  const move = getLegalMoves(variant, before).find((entry) => entry.to.x === 3 && entry.to.y === 3 && entry.to.z === 1);
  const after = applyMove(variant, before, move);
  const restored = JSON.parse(JSON.stringify({ variant, state: after, history: [{ move }] }));
  assert.equal(restored.state.pieces.find((piece) => piece.id === move.pieceId).z, 1);
  assert.equal(restored.state.board.layers[0].z, 1);
  assert.equal(restored.state.turn, "black");
  assert.equal(restored.history[0].move.to.z, 1);
});
