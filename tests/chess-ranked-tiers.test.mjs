import { test } from "node:test";
import assert from "node:assert/strict";
import { getChessRank } from "../src/games/chess/ranked/tiers.ts";

test("rank boundaries match the published ladder", () => {
  const thresholds = [
    [0, "Bronze V"], [399, "Bronze V"], [400, "Bronze IV"], [700, "Bronze I"],
    [800, "Silver V"], [1299, "Silver I"], [1300, "Gold V"], [1799, "Gold I"],
    [1800, "Platinum V"], [2299, "Platinum I"], [2300, "Diamond V"],
    [2549, "Diamond I"], [2550, "Master"], [2699, "Master"], [2700, "Grandmaster"],
  ];
  for (const [rating, name] of thresholds) assert.equal(getChessRank(rating).name, name, `${rating} Elo`);
});

test("progress reaches the next rank boundary and caps at Grandmaster", () => {
  assert.equal(getChessRank(400).nextAt, 500);
  assert.equal(getChessRank(2500).nextAt, 2550);
  assert.equal(getChessRank(2700).nextAt, null);
  assert.ok(getChessRank(2450).progress >= 0 && getChessRank(2450).progress <= 1);
});
