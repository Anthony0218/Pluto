import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { premoveTargets, resolvePremove } from '../src/games/chess/ranked/premove.ts';

test('premove targets are offered on the opponent\'s turn, including pawn captures onto empty squares', () => {
  const game = new Chess();
  game.move('e4');
  // Black to move; White queues a premove.
  assert.deepEqual(premoveTargets(game.fen(), 'g1', 'w').sort(), ['e2', 'f3', 'h3']);
  assert.deepEqual(premoveTargets(game.fen(), 'e4', 'w').sort(), ['d5', 'e5', 'f5']);
  assert.deepEqual(premoveTargets(game.fen(), 'e7', 'w'), []);
});

test('a premove resolves only while it is legal; promotions become queens', () => {
  const game = new Chess();
  game.move('e4');
  game.move('d5');
  assert.deepEqual(resolvePremove(game.fen(), { from: 'e4', to: 'd5' }), { from: 'e4', to: 'd5', promotion: undefined });
  // The pawn capture premove fails when nothing stands on the square.
  assert.equal(resolvePremove(game.fen(), { from: 'e4', to: 'f5' }), null);
  assert.deepEqual(resolvePremove('7k/P7/8/8/8/8/8/K7 w - - 0 1', { from: 'a7', to: 'a8' }), { from: 'a7', to: 'a8', promotion: 'q' });
});
