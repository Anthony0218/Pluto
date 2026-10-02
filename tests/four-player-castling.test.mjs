import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFourPlayerMove, createInitialFourPlayerState, getFourPlayerLegalMoves } from '../src/games/chess/variants/fourPlayerChess.ts';

// King square, king-side rook, queen-side rook and the pieces between them, per army.
const layouts = {
  red: { king: [13, 7], between: [[13, 8], [13, 9], [13, 4], [13, 5], [13, 6]], kingLand: [13, 9], kingRook: [13, 8], queenLand: [13, 5], queenRook: [13, 6] },
  yellow: { king: [0, 6], between: [[0, 5], [0, 4], [0, 7], [0, 8], [0, 9]], kingLand: [0, 4], kingRook: [0, 5], queenLand: [0, 8], queenRook: [0, 7] },
  blue: { king: [7, 0], between: [[8, 0], [9, 0], [4, 0], [5, 0], [6, 0]], kingLand: [9, 0], kingRook: [8, 0], queenLand: [5, 0], queenRook: [6, 0] },
  green: { king: [6, 13], between: [[5, 13], [4, 13], [7, 13], [8, 13], [9, 13]], kingLand: [4, 13], kingRook: [5, 13], queenLand: [8, 13], queenRook: [7, 13] },
};
const sq = ([row, column]) => ({ row, column });
const has = (moves, [row, column]) => moves.some((move) => move.row === row && move.column === column);

function cleared() {
  const state = createInitialFourPlayerState();
  for (const layout of Object.values(layouts)) for (const [row, column] of layout.between) state.board[row][column] = null;
  return state;
}

test('every army can castle on both sides once the path is clear', () => {
  for (const [color, layout] of Object.entries(layouts)) {
    const state = cleared();
    state.turn = color;
    const moves = getFourPlayerLegalMoves(state, sq(layout.king));
    assert.ok(has(moves, layout.kingLand), `${color} king side`);
    assert.ok(has(moves, layout.queenLand), `${color} queen side`);
    for (const side of ['king', 'queen']) {
      const next = applyFourPlayerMove(state, sq(layout.king), sq(layout[`${side}Land`]));
      const [kr, kc] = layout[`${side}Land`];
      const [rr, rc] = layout[`${side}Rook`];
      assert.deepEqual(next.board[kr][kc], { color, type: 'k' });
      assert.deepEqual(next.board[rr][rc], { color, type: 'r' }, `${color} ${side} rook jumps over`);
      assert.equal(next.lastMove.castle, side);
      assert.deepEqual(next.castling[color], { king: false, queen: false });
    }
  }
});

test('no castling with pieces in the way, after the king moved, or through check', () => {
  const blocked = createInitialFourPlayerState();
  assert.ok(!has(getFourPlayerLegalMoves(blocked, sq(layouts.red.king)), layouts.red.kingLand));

  const state = cleared();
  // King steps out and back: rights are gone even though it stands at home again.
  let next = applyFourPlayerMove(state, sq([13, 7]), sq([13, 8]));
  next.turn = 'red';
  next = applyFourPlayerMove(next, sq([13, 8]), sq([13, 7]));
  next.turn = 'red';
  assert.ok(!has(getFourPlayerLegalMoves(next, sq([13, 7])), layouts.red.kingLand));
  assert.ok(!has(getFourPlayerLegalMoves(next, sq([13, 7])), layouts.red.queenLand));

  // A yellow rook covers [13, 8], the square the red king crosses when castling king side.
  const attacked = cleared();
  attacked.board[12][8] = null;
  attacked.board[6][8] = { color: 'yellow', type: 'r' };
  const moves = getFourPlayerLegalMoves(attacked, sq([13, 7]));
  assert.ok(!has(moves, layouts.red.kingLand), 'cannot pass through an attacked square');
  assert.ok(has(moves, layouts.red.queenLand), 'the other side is unaffected');
});

test('states saved before castling existed still castle when king and rook are home', () => {
  const legacy = cleared();
  delete legacy.castling;
  assert.ok(has(getFourPlayerLegalMoves(legacy, sq(layouts.red.king)), layouts.red.kingLand));
  const next = applyFourPlayerMove(legacy, sq(layouts.red.king), sq(layouts.red.kingLand));
  assert.equal(next.lastMove.castle, 'king');
  assert.deepEqual(next.castling.red, { king: false, queen: false });
  assert.deepEqual(next.castling.blue, { king: true, queen: true });
});
