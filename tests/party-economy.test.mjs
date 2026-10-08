import { DEFAULT_SETTINGS, advance, applyAction } from "./helpers/party-legacy-fixtures.mjs";
import test from "node:test";
import { irradiatedNodeIds } from "../src/games/party/hazards/radiation.ts";
import assert from "node:assert/strict";
import { RULES } from "../src/games/party/config.ts";
import { tropical } from "../src/games/party/content/maps.ts";
import { activePlayer,
  createMatch,
  createPlayer } from "../src/games/party/engine/engine.ts";
import { distanceToPluto,
  eligiblePlutoNodes,
  rankedPlayers,
  reachableLandings,
  spawnPlutos } from "../src/games/party/engine/economy.ts";
import { botAction } from "../src/games/party/engine/bots.ts";
import { parseMessage } from "../src/games/party/network/protocol.ts";
const players = () =>
  Array.from({ length: 4 }, (_, i) => createPlayer(`p${i}`, `Player ${i}`, i));
function started(settings = DEFAULT_SETTINGS) {
  const state = createMatch(players(), settings, () => 0);
  let r = 0;
  return advance(state, settings, () => [0.9, 0.6, 0.3, 0][r++]);
}
function offer(type = "coin", coins = 20, settings = DEFAULT_SETTINGS) {
  const s = started(settings),
    node = tropical.nodes.find(
      (n) => n.type === type && n.id !== tropical.start,
    );
  s.phase = "RESOLVE_TILE";
  s.players[0].currentNodeId = node.id;
  s.players[0].coins = coins;
  s.plutoNodeIds = [node.id, eligiblePlutoNodes(tropical, [node.id])[0]];
  return advance(s, settings, () => 0);
}
test("two server-randomized distinct Plutos spawn without changing the 60 tile types", () => {
  const original = structuredClone(tropical),
    s = started();
  assert.equal(s.plutoNodeIds.length, 2);
  assert.equal(new Set(s.plutoNodeIds).size, 2);
  assert.ok(
    s.plutoNodeIds.every((id) => eligiblePlutoNodes(tropical).includes(id)),
  );
  assert.notDeepEqual(
    s.plutoNodeIds,
    createMatch(players(), DEFAULT_SETTINGS, () => 0.99).plutoNodeIds,
  );
  assert.deepEqual(tropical, original);
});
test("spawn filtering excludes start, rare, bank, occupied, irradiated and invalid special nodes", () => {
  // Radiation is live match state (match.radiationZones); callers pass irradiated nodes as exclusions.
  const map = structuredClone(tropical),
    normal = map.nodes.filter((n) => n.type === "coin");
  const irradiated = irradiatedNodeIds({
    radiationZones: [{ id: "zone-1", sourcePlayerId: "p0", nodeIds: [normal[0].id], createdRound: 1, expiresAfterRound: 4 }],
  });
  normal[1].plutoEligible = false;
  const excluded = normal[2].id,
    valid = eligiblePlutoNodes(map, [excluded, ...irradiated]);
  for (const n of map.nodes)
    if (
      n.id === map.start ||
      ["rare", "bank"].includes(n.type) ||
      irradiated.has(n.id) ||
      n.plutoEligible === false ||
      n.id === excluded
    )
      assert.ok(!valid.includes(n.id));
  assert.ok(eligiblePlutoNodes(map, [excluded]).includes(normal[0].id));
  assert.throws(
    () => spawnPlutos({ ...map, nodes: [] }, [], 2, () => 0),
    /eligible/,
  );
});
test("landing resolves coin income before offering a Pluto; waiting does not pay again", () => {
  const s = offer("coin", 17);
  assert.equal(s.phase, "PLUTO_OFFER");
  assert.equal(s.players[0].coins, 20);
  assert.equal(
    advance(s, DEFAULT_SETTINGS, () => 0),
    s,
  );
  const bought = applyAction(
    s,
    "p0",
    { type: "BUY_PLUTO" },
    DEFAULT_SETTINGS,
    () => 0.5,
  );
  assert.equal(bought.players[0].coins, 0);
  assert.equal(bought.players[0].goldenPlutos, 1);
  assert.equal(bought.phase, "TURN_END");
});
test("purchase is atomic, costs exactly 20, keeps bank unchanged and respawns only the bought Pluto", () => {
  const s = offer(),
    before = structuredClone(s),
    old = s.players[0].currentNodeId,
    other = s.plutoNodeIds.find((id) => id !== old);
  s.bank = 12;
  const result = applyAction(
    s,
    "p0",
    { type: "BUY_PLUTO" },
    DEFAULT_SETTINGS,
    () => 0.99,
  );
  assert.equal(result.players[0].coins, 3);
  assert.equal(result.players[0].goldenPlutos, 1);
  assert.equal(result.bank, 12);
  assert.equal(result.plutoNodeIds.length, 2);
  assert.ok(result.plutoNodeIds.includes(other));
  assert.ok(!result.plutoNodeIds.includes(old));
  assert.equal(result.plutoSpawn.sequence, 1);
  assert.ok(result.plutoNodeIds.includes(result.plutoSpawn.nodeId));
  assert.deepEqual(s.players, before.players);
  assert.throws(() =>
    applyAction(result, "p0", { type: "BUY_PLUTO" }, DEFAULT_SETTINGS, () => 0),
  );
});
test("insufficient funds, wrong phase, wrong player and missing overlay reject without mutation", () => {
  const s = offer("deposit", 20),
    before = structuredClone(s);
  assert.equal(s.players[0].coins, 17);
  assert.equal(s.bank, 3);
  assert.throws(
    () =>
      applyAction(s, "p0", { type: "BUY_PLUTO" }, DEFAULT_SETTINGS, () => 0),
    /20 coins/,
  );
  assert.deepEqual(s, before);
  assert.throws(
    () =>
      applyAction(s, "p1", { type: "BUY_PLUTO" }, DEFAULT_SETTINGS, () => 0),
    /turn/,
  );
  assert.throws(() =>
    applyAction(
      { ...s, phase: "ITEM_PHASE" },
      "p0",
      { type: "BUY_PLUTO" },
      DEFAULT_SETTINGS,
      () => 0,
    ),
  );
  assert.throws(() =>
    applyAction(
      { ...s, plutoNodeIds: [] },
      "p0",
      { type: "BUY_PLUTO" },
      DEFAULT_SETTINGS,
      () => 0,
    ),
  );
});
test("declining preserves both Plutos and consumes the offer without a second tile resolution", () => {
  const s = offer("coin", 0),
    result = applyAction(
      s,
      "p0",
      { type: "LEAVE_PLUTO" },
      DEFAULT_SETTINGS,
      () => 0,
    );
  assert.equal(result.phase, "TURN_END");
  assert.equal(result.players[0].coins, 3);
  assert.deepEqual(result.plutoNodeIds, s.plutoNodeIds);
  assert.equal(result.plutoSpawn.sequence, 0);
  assert.throws(() =>
    applyAction(
      result,
      "p0",
      { type: "LEAVE_PLUTO" },
      DEFAULT_SETTINGS,
      () => 0,
    ),
  );
});
test("passing through and zero rolls on a Pluto do not offer purchases", () => {
  let s = started();
  s.phase = "PATH_SELECTION";
  s.movesRemaining = 2;
  s.plutoNodeIds = ["space-1", "space-4"];
  s = applyAction(
    s,
    "p0",
    { type: "SELECT_PATH", nodeId: "space-1" },
    DEFAULT_SETTINGS,
    () => 0,
  );
  assert.equal(s.phase, "MOVEMENT");
  s.phase = "ITEM_PHASE";
  s = applyAction(s, "p0", { type: "ROLL_DICE" }, DEFAULT_SETTINGS, () => 0);
  s = advance(s, DEFAULT_SETTINGS, () => 0);
  assert.equal(s.phase, "ZERO_BONUS");
  assert.equal(s.players[0].goldenPlutos, 0);
});
test("KO on a Pluto does not offer purchase at the respawn location", () => {
  const s = started();
  const hazard = tropical.nodes.find((n) => n.type === "hazard");
  s.phase = "RESOLVE_TILE";
  s.players[0].currentNodeId = hazard.id;
  s.players[0].hp = 5;
  s.plutoNodeIds = [hazard.id, "space-1"];
  const result = advance(s, DEFAULT_SETTINGS, () => 0);
  assert.equal(result.phase, "TURN_END");
  assert.equal(result.players[0].currentNodeId, tropical.start);
});
test("target-reaching purchase ends the match immediately and still respawns correctly", () => {
  const s = offer();
  s.players[0].goldenPlutos = DEFAULT_SETTINGS.plutoTarget - 1;
  const result = applyAction(
    s,
    "p0",
    { type: "BUY_PLUTO" },
    DEFAULT_SETTINGS,
    () => 0,
  );
  assert.equal(result.phase, "GAME_OVER");
  assert.equal(result.winner, "p0");
  assert.equal(result.plutoNodeIds.length, 2);
  assert.equal(
    advance(result, DEFAULT_SETTINGS, () => 0),
    result,
  );
  assert.throws(() =>
    applyAction(result, "p0", { type: "ROLL_DICE" }, DEFAULT_SETTINGS, () => 0),
  );
});
test("coin victory resolves before optional purchases, including jackpot and simultaneous event awards", () => {
  const settings = { ...DEFAULT_SETTINGS, victory: "coins", coinTarget: 100 };
  assert.equal(offer("coin", 99, settings).phase, "GAME_OVER");
  const s = started(settings);
  s.phase = "RESOLVE_TILE";
  s.players[0].currentNodeId = tropical.nodes.find((n) => n.type === "bank").id;
  s.bank = 80;
  const won = advance(s, settings, () => 0);
  assert.equal(won.winner, "p0");
  assert.equal(won.bank, 0);
  s.turnIndex = 2;
  s.players.forEach((p) => (p.coins = 99));
  activePlayer(s).currentNodeId = tropical.nodes.find(
    (n) => n.type === "event",
  ).id;
  assert.equal(advance(s, settings, () => 0).winner, "p2");
});
test("results rank by chosen victory, secondary currency and stable order with winner first", () => {
  const s = started();
  s.players[0].coins = 100;
  s.players[1].goldenPlutos = 2;
  s.players[2].goldenPlutos = 2;
  s.players[2].coins = 30;
  assert.deepEqual(
    rankedPlayers(s, DEFAULT_SETTINGS).map((p) => p.id),
    ["p2", "p1", "p0", "p3"],
  );
  assert.equal(
    rankedPlayers(s, { ...DEFAULT_SETTINGS, victory: "coins" })[0].id,
    "p0",
  );
  s.winner = "p1";
  assert.equal(rankedPlayers(s, DEFAULT_SETTINGS)[0].id, "p1");
});
test("bots buy affordable Plutos, decline when poor or pursuing coin victory, and target exact landings", () => {
  assert.equal(botAction(offer(), tropical, () => 0).type, "BUY_PLUTO");
  assert.equal(
    botAction(offer("coin", 0), tropical, () => 0).type,
    "LEAVE_PLUTO",
  );
  assert.equal(
    botAction(offer(), tropical, () => 0, {
      ...DEFAULT_SETTINGS,
      victory: "coins",
    }).type,
    "LEAVE_PLUTO",
  );
  const s = started();
  s.phase = "PATH_SELECTION";
  s.movesRemaining = 1;
  s.plutoNodeIds = ["space-15", "space-40"];
  s.players[0].difficulty = "hard";
  assert.equal(botAction(s, tropical, () => 0).nodeId, "space-15");
  assert.equal(distanceToPluto(tropical, "space-0", ["space-15"]), 1);
  assert.ok(
    !reachableLandings(tropical, "space-15", "space-0", 1).has("space-0"),
  );
});
test("network commands contain intent only; forged prices, node targets and rewards are discarded", () => {
  assert.deepEqual(
    parseMessage({
      type: "ACTION",
      action: {
        type: "BUY_PLUTO",
        price: 0,
        nodeId: "space-10",
        goldenPlutos: 100,
      },
    }),
    { type: "ACTION", action: { type: "BUY_PLUTO" } },
  );
  assert.deepEqual(
    parseMessage({ type: "ACTION", action: { type: "LEAVE_PLUTO" } }),
    { type: "ACTION", action: { type: "LEAVE_PLUTO" } },
  );
});
test("seeded bot matches reach a Golden Pluto victory and preserve spawn and resource invariants", () => {
  for (const startSeed of [7, 41, 123]) {
    let seed = startSeed;
    const rng = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const settings = { ...DEFAULT_SETTINGS, plutoTarget: 3 };
    let s = createMatch(players(), settings, rng);
    let now = 0; // simulated 700 ms authority clock so timed minigame phases progress
    for (let step = 0; step < 20000 && s.phase !== "GAME_OVER"; step++) {
      const action = botAction(s, tropical, rng, settings);
      now += 700;
      s = action
        ? applyAction(s, activePlayer(s).id, action, settings, rng, now)
        : advance(s, settings, rng, now);
      assert.equal(new Set(s.plutoNodeIds).size, 2);
      assert.ok(
        s.plutoNodeIds.every((id) => eligiblePlutoNodes(tropical).includes(id)),
      );
      assert.ok(
        s.players.every(
          (p) =>
            p.coins >= 0 && Number.isInteger(p.coins) && p.goldenPlutos >= 0,
        ),
      );
    }
    assert.equal(s.phase, "GAME_OVER", `seed ${startSeed} should finish`);
    assert.equal(s.players.find((p) => p.id === s.winner).goldenPlutos, 3);
  }
});
