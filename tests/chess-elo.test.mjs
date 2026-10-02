import test from "node:test";
import assert from "node:assert/strict";
import { expectedScore, kFactor, ratedPair } from "../src/games/chess/ranked/elo.ts";

test("equal ratings yield symmetric wins and losses", () => {
  assert.equal(expectedScore(1200, 1200), 0.5);
  assert.deepEqual(ratedPair(1200, 1200, 0, 0, "white"), { white: 1216, black: 1184 });
  assert.deepEqual(ratedPair(1200, 1200, 0, 0, "black"), { white: 1184, black: 1216 });
  assert.deepEqual(ratedPair(1200, 1200, 0, 0, "draw"), { white: 1200, black: 1200 });
});

test("expected score accounts for opponent strength", () => {
  assert.ok(expectedScore(1400, 1200) > 0.5);
  assert.ok(expectedScore(1200, 1400) < 0.5);
  const upset = ratedPair(1200, 1400, 20, 20, "white");
  const expected = ratedPair(1400, 1200, 20, 20, "white");
  assert.ok(upset.white - 1200 > expected.white - 1400);
  assert.equal(kFactor(19), 32);
  assert.equal(kFactor(20), 20);
});
