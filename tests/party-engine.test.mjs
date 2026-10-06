import test from "node:test";
import assert from "node:assert/strict";
import { tropical } from "../src/games/party/content/maps.ts";
import { DEFAULT_SETTINGS } from "../src/games/party/config.ts";
import {
  activePlayer,
  advance,
  applyAction,
  createMatch,
  createPlayer,
  detectWinner,
  legalPaths,
  rollDie,
} from "../src/games/party/engine/engine.ts";
import { parseMessage } from "../src/games/party/network/protocol.ts";
import { botAction } from "../src/games/party/engine/bots.ts";
const players = () =>
  Array.from({ length: 4 }, (_, i) => createPlayer(`p${i}`, `Player ${i}`, i));
const settings = { ...DEFAULT_SETTINGS, victory: "coins" };
const values = (...v) => {
  let i = 0;
  return () => v[i++ % v.length];
};
function started() {
  return advance(
    createMatch(players(), settings, () => 0.4),
    settings,
    values(0.9, 0.7, 0.4, 0.1),
  );
}
function landing(type) {
  const s = started();
  s.phase = "RESOLVE_TILE";
  activePlayer(s).currentNodeId = tropical.nodes.find(
    (n) => n.type === type,
  ).id;
  return s;
}
test("tropical graph has 96 connected spaces, correct distribution and reciprocal links", () => {
  assert.equal(tropical.nodes.length, 96);
  assert.equal(new Set(tropical.nodes.map((n) => n.id)).size, 96);
  const reached = new Set(),
    queue = [tropical.start];
  while (queue.length) {
    const id = queue.pop();
    if (reached.has(id)) continue;
    reached.add(id);
    const n = tropical.nodes.find((n) => n.id === id);
    for (const other of n.connections) {
      assert.ok(
        tropical.nodes.find((n) => n.id === other).connections.includes(id),
      );
      queue.push(other);
    }
  }
  assert.equal(reached.size, 96);
  assert.ok(tropical.nodes.filter((n) => n.connections.length > 2).length >= 8);
  assert.deepEqual(
    Object.fromEntries(
      [...new Set(tropical.nodes.map((n) => n.type))].map((t) => [
        t,
        tropical.nodes.filter((n) => n.type === t).length,
      ]),
    ),
    {
      empty: 1,
      coin: 30,
      item: 18,
      rare: 1,
      event: 12,
      deposit: 12,
      bank: 1,
      property: 6,
      heal: 9,
      duel: 2,
      warp: 2,
      hazard: 1,
      boost: 1,
    },
  );
});
test("dice include 0 and 10 and stay inside bounds", () => {
  assert.equal(
    rollDie(() => 0),
    0,
  );
  assert.equal(
    rollDie(() => 0.99999),
    10,
  );
  for (let n = 0; n < 10000; n++) assert.ok(rollDie(() => n / 10000) <= 10);
});
test("initial player resources and four-slot requirement", () => {
  const p = players()[0];
  assert.equal(p.coins, 20);
  assert.equal(p.hp, 20);
  assert.equal(p.maxHp, 40);
  assert.deepEqual(p.inventory, []);
  assert.throws(() => createMatch(players().slice(1), settings, () => 0.4));
});
test("only tied starting groups reroll, preserving higher groups", () => {
  let s = advance(
    createMatch(players(), settings, () => 0.4),
    settings,
    values(0.9, 0.5, 0.5, 0.1),
  );
  assert.equal(s.phase, "START_ROLL");
  assert.equal(s.startingRolls.length, 4);
  s = advance(s, settings, values(0.1, 0.8));
  assert.deepEqual(s.order, ["p0", "p2", "p1", "p3"]);
  assert.equal(s.startingRolls.length, 6);
  assert.equal(s.phase, "ITEM_PHASE");
});
test("multiple tied groups stay in descending groups across repeated rerolls", () => {
  let s = advance(
    createMatch(players(), settings, () => 0.4),
    settings,
    values(0.8, 0.8, 0.2, 0.2),
  );
  s = advance(s, settings, values(0.1, 0.1, 0.9, 0.3));
  assert.equal(s.phase, "START_ROLL");
  s = advance(s, settings, values(0.3, 0.6));
  assert.deepEqual(s.order, ["p1", "p0", "p2", "p3"]);
  assert.equal(s.startingRolls.length, 10);
});
test("reject out-of-turn, duplicate rolls and impossible phase transitions without mutation", () => {
  const s = started(),
    before = structuredClone(s);
  assert.throws(() =>
    applyAction(s, "p1", { type: "ROLL_DICE" }, settings, () => 0),
  );
  const rolled = applyAction(
    s,
    "p0",
    { type: "ROLL_DICE" },
    settings,
    () => 0.5,
  );
  assert.throws(() =>
    applyAction(rolled, "p0", { type: "ROLL_DICE" }, settings, () => 0),
  );
  assert.throws(() =>
    applyAction(
      s,
      "p0",
      { type: "SELECT_PATH", nodeId: "space-1" },
      settings,
      () => 0,
    ),
  );
  assert.deepEqual(s, before);
});
test("zero roll skips landing rewards and ends turn", () => {
  const s = landing("coin");
  s.phase = "ITEM_PHASE";
  let result = applyAction(s, "p0", { type: "ROLL_DICE" }, settings, () => 0);
  result = advance(result, settings, () => 0);
  assert.equal(result.phase, "TURN_END");
  assert.equal(activePlayer(result).coins, 20);
});
test("movement pauses at forks, rejects teleport and backwards moves, consumes one move", () => {
  let s = started();
  s = applyAction(s, "p0", { type: "ROLL_DICE" }, settings, () => 0.5);
  s = advance(s, settings, () => 0);
  s = advance(s, settings, () => 0);
  assert.equal(s.phase, "PATH_SELECTION");
  assert.throws(() =>
    applyAction(
      s,
      "p0",
      { type: "SELECT_PATH", nodeId: "space-30" },
      settings,
      () => 0,
    ),
  );
  const id = legalPaths(s, tropical)[0],
    remaining = s.movesRemaining;
  s = applyAction(
    s,
    "p0",
    { type: "SELECT_PATH", nodeId: id },
    settings,
    () => 0,
  );
  assert.equal(activePlayer(s).currentNodeId, id);
  assert.equal(s.movesRemaining, remaining - 1);
  assert.ok(!legalPaths(s, tropical).includes("space-0"));
});
test("coin, deposit, jackpot, healing and hazard resolve once with caps", () => {
  let s = advance(landing("coin"), settings, () => 0);
  assert.equal(activePlayer(s).coins, 23);
  assert.equal(s.phase, "TURN_END");
  const deposit = landing("deposit");
  activePlayer(deposit).coins = 1;
  s = advance(deposit, settings, () => 0);
  assert.equal(s.bank, 1);
  assert.equal(activePlayer(s).coins, 0);
  const bank = landing("bank");
  bank.bank = 42;
  s = advance(bank, settings, () => 0);
  assert.equal(s.bank, 0);
  assert.equal(activePlayer(s).coins, 62);
  const heal = landing("heal");
  activePlayer(heal).hp = 38;
  s = advance(heal, settings, () => 0);
  assert.equal(activePlayer(s).hp, 40);
  const hazard = landing("hazard");
  activePlayer(hazard).hp = 5;
  s = advance(hazard, settings, () => 0);
  assert.equal(activePlayer(s).hp, 20);
  assert.equal(activePlayer(s).currentNodeId, tropical.start);
  assert.equal(s.bank, 5);
});
// Milestone 6: the round no longer rolls over after the 4th turn; it continues into the Animal Phase and
// minigame (round advancement is covered in party-minigame.test.mjs).
test("four turns keep order and hand over to the animal phase", () => {
  let s = started();
  const seen = [];
  for (let i = 0; i < 4; i++) {
    const id = activePlayer(s).id;
    seen.push(id);
    s = applyAction(s, id, { type: "ROLL_DICE" }, settings, () => 0);
    s = advance(s, settings, () => 0);
    s = advance(s, settings, () => 0);
  }
  assert.deepEqual(seen, ["p0", "p1", "p2", "p3"]);
  assert.equal(s.phase, "ANIMAL_PHASE");
  assert.equal(s.round, 1);
});
test("coin victory ends immediately and future Pluto win rule is isolated", () => {
  const s = landing("coin");
  activePlayer(s).coins = 199;
  const won = advance(s, settings, () => 0);
  assert.equal(won.phase, "GAME_OVER");
  assert.equal(won.winner, "p0");
  s.players[1].goldenPlutos = 5;
  assert.equal(detectWinner(s, DEFAULT_SETTINGS), "p1");
});
test("network parser rejects forged rewards, client ticks, invalid settings and malformed actions", () => {
  for (const v of [
    null,
    {},
    [],
    { type: "FINISH_MINIGAME", coins: 100 },
    { type: "ACTION", action: { type: "TICK" } },
    { type: "SETTINGS", settings: { ...settings, coinTarget: "200" } },
    { type: "SETTINGS", settings: { ...settings, mapId: "fake" } },
    { type: "READY", ready: "true" },
  ])
    assert.throws(() => parseMessage(v));
  assert.deepEqual(
    parseMessage({ type: "ACTION", action: { type: "ROLL_DICE", value: 10 } }),
    { type: "ACTION", action: { type: "ROLL_DICE" } },
  );
});
test("bots make legal decisions and 3000 authority steps preserve invariants", () => {
  let s = started();
  let seed = 231;
  const rng = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let now = 0; // simulated server clock: 700 ms per authority step, like the real tick
  for (let i = 0; i < 3000 && s.phase !== "GAME_OVER"; i++) {
    const action = botAction(s, tropical, rng);
    now += 700;
    s = action
      ? applyAction(s, activePlayer(s).id, action, settings, rng, now)
      : advance(s, settings, rng, now);
    for (const p of s.players) {
      assert.ok(p.coins >= 0);
      assert.ok(p.hp > 0 && p.hp <= p.maxHp);
      assert.ok(tropical.nodes.some((n) => n.id === p.currentNodeId));
    }
    assert.ok(s.movesRemaining >= 0);
  }
  assert.ok(s.round > 5);
});
