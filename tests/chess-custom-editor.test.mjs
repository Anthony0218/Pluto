import test from "node:test";
import assert from "node:assert/strict";
import { HISTORY_LIMIT, createHistory, editorReducer } from "../src/games/chess/custom/editor/editorStore.ts";
import { gameplaySignature } from "../src/games/chess/custom/editor/editorUtils.ts";
import { paintSquare, squareRole } from "../src/games/chess/custom/editor/movementBrush.ts";
import { applyMove, createGameState, getLegalMoves, parseSquare, squareName } from "../src/games/chess/custom/engine/index.ts";
import { applyKingBehavior, createVariantFromPreset, matchKingBehavior } from "../src/games/chess/custom/engine/presets.ts";

const rename = (name, coalesceKey) => ({ type: "update", recipe: (variant) => ({ ...variant, name }), coalesceKey });

test("undo/redo walks the history and new edits clear the redo stack", () => {
  let history = createHistory(createVariantFromPreset("standard"));
  history = editorReducer(history, rename("A"));
  history = editorReducer(history, rename("B"));
  history = editorReducer(history, { type: "undo" });
  assert.equal(history.present.variant.name, "A");
  history = editorReducer(history, { type: "redo" });
  assert.equal(history.present.variant.name, "B");
  history = editorReducer(history, { type: "undo" });
  history = editorReducer(history, rename("C"));
  assert.equal(history.future.length, 0);
  assert.equal(editorReducer(history, { type: "redo" }), history, "nothing to redo");
});

test("history is bounded and typing in one field coalesces into one step", () => {
  let history = createHistory(createVariantFromPreset("standard"));
  for (let index = 0; index < HISTORY_LIMIT + 25; index++) history = editorReducer(history, rename(`v${index}`));
  assert.equal(history.past.length, HISTORY_LIMIT);

  let typing = createHistory(createVariantFromPreset("standard"));
  for (const name of ["P", "Po", "Por", "Portal"]) typing = editorReducer(typing, rename(name, "name"));
  assert.equal(typing.past.length, 1);
  assert.equal(editorReducer(typing, { type: "undo" }).present.variant.name, "Standard Chess");
});

test("deleting a piece type removes its placements and promotion options but keeps event references for validation", () => {
  let history = createHistory(createVariantFromPreset("standard"));
  history = editorReducer(history, { type: "removePieceDefinition", id: "queen" });
  const { variant, testSetup } = history.present;
  assert.ok(!variant.pieces.some((piece) => piece.id === "queen"));
  assert.ok(!variant.setup.pieces.some((piece) => piece.type === "queen"));
  assert.ok(!testSetup.pieces.some((piece) => piece.type === "queen"));
  assert.ok(!variant.pieces.find((piece) => piece.id === "pawn").promotion.options.includes("queen"));
  assert.equal(editorReducer(history, { type: "undo" }).present.variant.pieces.length, 6);
});

test("resizing keeps the top army on the top edge", () => {
  let history = createHistory(createVariantFromPreset("standard"));
  history = editorReducer(history, { type: "resizeBoard", width: 10, height: 10 });
  const { variant } = history.present;
  assert.equal(variant.board.cells.length, 100);
  const blackKing = variant.setup.pieces.find((piece) => piece.team === "black" && piece.type === "king");
  const whiteKing = variant.setup.pieces.find((piece) => piece.team === "white" && piece.type === "king");
  assert.equal(blackKing.y, 9);
  assert.equal(whiteKing.y, 0);
  history = editorReducer(history, { type: "resizeBoard", width: 6, height: 6 });
  assert.ok(history.present.variant.setup.pieces.every((piece) => piece.x < 6 && piece.y < 6));
});

test("saving replaces identity without creating an undo step", () => {
  let history = createHistory(createVariantFromPreset("standard"));
  history = editorReducer(history, rename("Edited"));
  const saved = { ...history.present.variant, id: "variant-saved", version: 4 };
  const next = editorReducer(history, { type: "replaceIdentity", variant: saved });
  assert.equal(next.past.length, history.past.length);
  assert.equal(next.present.variant.version, 4);
  assert.equal(editorReducer(next, { type: "undo" }).present.variant.id, "variant-saved", "undo keeps the saved identity");
});

test("gameplay signature ignores cosmetics but tracks rules", () => {
  const variant = createVariantFromPreset("standard");
  const base = gameplaySignature(variant, variant.setup);
  assert.equal(gameplaySignature({ ...variant, name: "Other", theme: { boardTheme: "cyber", pieceSkin: "neon" } }, variant.setup), base);
  assert.notEqual(gameplaySignature({ ...variant, settings: { ...variant.settings, royalMode: "capture" } }, variant.setup), base);
});

test("square brushes: paint a knight that moves normally but captures one square diagonally", () => {
  const variant = createVariantFromPreset("standard");
  let knight = variant.pieces.find((piece) => piece.id === "knight");
  for (const offset of [{ x: 1, y: 2 }, { x: 2, y: 1 }, { x: -1, y: 2 }, { x: -2, y: 1 }, { x: 1, y: -2 }, { x: 2, y: -1 }, { x: -1, y: -2 }, { x: -2, y: -1 }]) knight = paintSquare(knight, offset, "move");
  for (const offset of [{ x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 }]) knight = paintSquare(knight, offset, "capture");
  assert.equal(knight.captureSameAsMove, false);
  assert.deepEqual(squareRole(knight, { x: 2, y: 1 }), { move: true, capture: false, firstMove: false });
  assert.deepEqual(squareRole(knight, { x: 1, y: 1 }), { move: false, capture: true, firstMove: false });

  variant.pieces = variant.pieces.map((piece) => (piece.id === "knight" ? knight : piece));
  const sq = (name) => parseSquare(name);
  variant.setup = { pieces: [{ type: "knight", team: "white", ...sq("d4") }, { type: "pawn", team: "black", ...sq("e5"), moved: true }, { type: "pawn", team: "black", ...sq("f5"), moved: true }, { type: "king", team: "white", ...sq("a1") }, { type: "king", team: "black", ...sq("h8") }], startingTeam: "white", turnNumber: 1 };
  const state = createGameState(variant);
  const moves = getLegalMoves(variant, state, { pieceId: state.pieces.find((piece) => piece.type === "knight").id });
  assert.deepEqual(moves.filter((move) => move.captureIds.length).map((move) => squareName(move.to)), ["e5"]);
  assert.ok(!moves.some((move) => squareName(move.to) === "f5"), "an L-square holding an enemy is not a capture");
});

test("square brushes: first-move squares, removing them, slide lines and erasing", () => {
  const variant = createVariantFromPreset("standard");
  let rook = variant.pieces.find((piece) => piece.id === "rook");
  rook = paintSquare(rook, { x: 0, y: 3 }, "erase");
  assert.ok(!rook.movement[0].offsets.some((offset) => offset.x === 0 && offset.y === 1), "erasing a slid square removes that ray");
  rook = paintSquare(rook, { x: 0, y: 2 }, "line");
  assert.ok(squareRole(rook, { x: 0, y: 5 }).move, "the ray is back");

  let pawn = variant.pieces.find((piece) => piece.id === "pawn");
  pawn = paintSquare(pawn, { x: 0, y: 3 }, "firstMove");
  assert.deepEqual(squareRole(pawn, { x: 0, y: 3 }), { move: true, capture: false, firstMove: true });
  pawn = paintSquare(pawn, { x: 0, y: 2 }, "clearFirstMove");
  assert.equal(squareRole(pawn, { x: 0, y: 2 }).firstMove, false, "the double step is now always allowed");
  variant.pieces = variant.pieces.map((piece) => (piece.id === "pawn" ? pawn : piece));
  let state = createGameState(variant);
  const e2 = state.pieces.find((piece) => piece.type === "pawn" && piece.team === "white" && piece.x === 4);
  const triple = getLegalMoves(variant, state, { pieceId: e2.id }).find((move) => squareName(move.to) === "e5");
  assert.ok(triple, "first-move triple step");
  state = applyMove(variant, state, triple);
  assert.ok(!getLegalMoves(variant, state, { pieceId: e2.id, asTeam: "white" }).some((move) => squareName(move.to) === "e8"), "first-move square no longer available");
});

test("king behavior presets round-trip and generate their consequence events", () => {
  const variant = createVariantFromPreset("standard");
  for (const id of ["standard", "capturable", "none", "multiple", "respawning", "successor"]) {
    const next = applyKingBehavior(variant, id);
    assert.equal(matchKingBehavior(next.settings), id);
    assert.equal(next.events.filter((event) => event.source === "kingConsequence").length >= 1, true);
  }
  const successor = applyKingBehavior(variant, "successor");
  const event = successor.events.find((entry) => entry.source === "kingConsequence");
  assert.equal(event.trigger.type, "kingCaptured");
  assert.equal(event.actions[0].type, "transformPiece");
  assert.equal(event.elseActions[0].target, "highestValue");
});

test("teams: add, reorder, arrange armies on every side, and remove with cascade", async () => {
  const { createTeam, sideOf } = await import("../src/games/chess/custom/engine/teams.ts");
  let history = createHistory(createVariantFromPreset("standard"));
  const red = createTeam(history.present.variant.teams);
  assert.equal(sideOf(red), "left", "a new team takes the first free side");
  history = editorReducer(history, { type: "addTeam", team: red });
  history = editorReducer(history, { type: "updateBoard", board: (await import("../src/games/chess/custom/engine/teams.ts")).createCrossBoard(14, 3) });
  history = editorReducer(history, { type: "arrangeArmies" });
  const { variant } = history.present;
  for (const team of variant.teams) assert.equal(variant.setup.pieces.filter((piece) => piece.team === team.id).length, 16, `${team.name} gets a full army`);
  assert.ok(variant.setup.pieces.filter((piece) => piece.team === red.id).every((piece) => piece.x <= 1), "the left team stands on the left edge");

  history = editorReducer(history, { type: "moveTeam", id: red.id, delta: -1 });
  assert.deepEqual(history.present.variant.teams.map((team) => team.id), ["white", red.id, "black"]);

  history = editorReducer(history, { type: "update", recipe: (current) => ({ ...current, setup: { ...current.setup, startingTeam: red.id }, victoryConditions: [{ id: "w", type: "captureAll", enabled: true, team: red.id }] }) });
  history = editorReducer(history, { type: "removeTeam", id: red.id });
  const after = history.present.variant;
  assert.equal(after.teams.length, 2);
  assert.ok(!after.setup.pieces.some((piece) => piece.team === red.id));
  assert.equal(after.setup.startingTeam, "white");
  assert.equal(after.victoryConditions[0].team, "any");
  assert.equal(editorReducer(history, { type: "removeTeam", id: "black" }), history, "two teams is the minimum");
});
