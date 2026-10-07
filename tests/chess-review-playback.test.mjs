import test from 'node:test';
import assert from 'node:assert/strict';
import { isMissedWin, REVIEW_SPEEDS, playbackDelay } from '../src/components/chess/singleplayer/reviewPlayback.ts';

test('review playback scales the move interval at every supported speed', () => {
  assert.deepEqual(REVIEW_SPEEDS.map(playbackDelay), [4400, 2200, 1100, 1100 / 1.5, 550, 275]);
});
test('missing a forced mate is a missed win even while still winning', () => {
  assert.equal(isMissedWin({ missedMate: true, centipawnLoss: 100 }, 10, 10), true);
  assert.equal(isMissedWin({ missedMate: true, centipawnLoss: 400 }, 10, 6), true);
  assert.equal(isMissedWin({ missedMate: false, centipawnLoss: 240 }, 5, 2.6), false);
});
test('missed win requires losing the estimated winning advantage', () => {
  const review = { missedMate: false, centipawnLoss: 425 };
  assert.equal(isMissedWin(review, 5, .75), true);
  assert.equal(isMissedWin(review, 5, .76), false);
  assert.equal(isMissedWin(review, 4.99, 0), false);
  assert.equal(isMissedWin(review, null, 0), false);
  assert.equal(isMissedWin(review, 5, null), false);
  assert.equal(isMissedWin({ missedMate: true, centipawnLoss: 1200 }, 10, -2), true);
});
