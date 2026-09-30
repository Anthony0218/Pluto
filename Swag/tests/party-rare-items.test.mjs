import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, RADIATION_CONFIG, RARE_ITEM_WEIGHTS } from "../src/games/party/config.ts";
import { tropical } from "../src/games/party/content/maps.ts";
import {
  activePlayer,
  advance,
  applyAction,
  createMatch,
  createPlayer,
} from "../src/games/party/engine/engine.ts";
import { botAction } from "../src/games/party/engine/bots.ts";
import { eligiblePlutoNodes } from "../src/games/party/engine/economy.ts";
import { graphDistances } from "../src/games/party/engine/graph.ts";
import { createItemInstance } from "../src/games/party/items/inventory.ts";
import { falloutBlastNodes } from "../src/games/party/items/rare.ts";
import {
  itemRegistry,
  randomRareItemId,
  randomStandardItemId,
} from "../src/games/party/items/registry.ts";
import {
  createRadiationZone,
  irradiatedNodeIds,
  radiationRoundsLeft,
} from "../src/games/party/hazards/radiation.ts";
import { minigameRegistry } from "../src/games/party/minigames/index.ts";
import { parseMessage } from "../src/games/party/network/protocol.ts";
import { PartyRooms } from "../server/party/rooms.ts";

const coinSettings = { ...DEFAULT_SETTINGS, victory: "coins", coinTarget: 300 };
const plutoSettings = { ...DEFAULT_SETTINGS, victory: "plutos", plutoTarget: 5 };
const players = () =>
  Array.from({ length: 4 }, (_, i) => createPlayer(`p${i}`, `Player ${i}`, i));
const seeded = (seed) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
// Stable order p0, p1, p2, p3; p0 is active in ITEM_PHASE of round 1.
function started(settings = coinSettings) {
  let r = 0;
  return advance(createMatch(players(), settings, () => 0.4), settings, () =>
    [0.9, 0.7, 0.4, 0.1][r++ % 4],
  );
}
const give = (s, playerId, itemId) => {
  const item = createItemInstance(s, itemId);
  s.players.find((p) => p.id === playerId).inventory.push(item);
  return item.instanceId;
};
const P = (s, id) => s.players.find((p) => p.id === id);
const has = (s, id, instanceId) => P(s, id).inventory.some((i) => i.instanceId === instanceId);
const radiation = (s, id) => P(s, id).statusEffects.find((e) => e.id === "radiation");
const T0 = 5_000_000;
const RARE_NODE = tropical.nodes.find((n) => n.type === "rare").id;
const use = (s, playerId, action, settings = coinSettings, rng = seeded(4), now = T0) =>
  applyAction(s, playerId, { type: "USE_ITEM", ...action }, settings, rng, now);
// Lands `playerId` (who must be active) on `nodeId` and resolves the tile.
function land(s, nodeId, rng = () => 0, settings = coinSettings) {
  activePlayer(s).currentNodeId = nodeId;
  s.phase = "RESOLVE_TILE";
  s.plutoNodeIds = eligiblePlutoNodes(tropical, [nodeId]).slice(-2);
  return advance(s, settings, rng, T0);
}
// Ends the running duel minigame with `id` as the winner, whichever duel game was drawn.
function forceWin(s, id) {
  const game = s.minigame.state;
  if (s.minigame.minigameId === "paddle-panic") {
    game.scores[id] = 3;
    game.winnerId = id;
    game.finishedAt = game.simTime;
  } else {
    game.runners[id].finishedAt = game.simTime;
    game.runners[id].y = 11.5;
  }
}
function duelResults(s, winnerId, settings = coinSettings) {
  const playing = advance(s, settings, seeded(5), s.minigame.startedAt);
  assert.equal(playing.phase, "DUEL_MINIGAME");
  forceWin(playing, winnerId);
  const results = advance(playing, settings, seeded(5), playing.minigame.startedAt + 50);
  assert.equal(results.phase, "DUEL_RESULTS");
  return results;
}
const leaveResults = (s, settings = coinSettings) =>
  advance(s, settings, seeded(6), s.minigame.resultsEndsAt);
// Moves to `playerId`'s turn start through a real TURN_END of the previous seat (runs turn-start
// effects). Order is p0..p3, so p1–p3 are reached without passing through the Animal Phase.
function turnStartOf(s, playerId, settings = coinSettings) {
  const index = s.order.indexOf(playerId);
  assert.ok(index >= 1);
  s.turnIndex = index - 1;
  s.phase = "TURN_END";
  const next = advance(s, settings, () => 0, T0);
  assert.equal(activePlayer(next).id, playerId);
  assert.equal(next.phase, "ITEM_PHASE");
  return next;
}
const endOwnTurn = (s, settings = coinSettings) => {
  s.phase = "TURN_END";
  return advance(s, settings, () => 0, T0);
};

// ---------- Rare item registry / Rare Item field ----------
test("rare items share the item registry and are categorized by rarity", () => {
  const rare = itemRegistry.all().filter((i) => i.rarity === "rare").map((i) => i.id).sort();
  assert.deepEqual(rare, ["fallout-core", "pocket-duel", "wild-totem"]);
  assert.deepEqual(Object.keys(RARE_ITEM_WEIGHTS).sort(), rare);
  for (const item of itemRegistry.all())
    assert.ok(["common", "uncommon", "rare"].includes(item.rarity));
});

test("the Rare Item field awards one registered rare item chosen by the server's weighted roll", () => {
  const got = (roll) => {
    const s = land(started(), RARE_NODE, () => roll);
    assert.equal(s.phase, "TURN_END");
    assert.equal(P(s, "p0").inventory.length, 1);
    return P(s, "p0").inventory[0].itemId;
  };
  // Equal weights in declaration order: [0, 1/3) pocket, [1/3, 2/3) fallout, [2/3, 1) totem.
  assert.equal(got(0), "pocket-duel");
  assert.equal(got(0.5), "fallout-core");
  assert.equal(got(0.99), "wild-totem");
});

test("the rare pool only yields rare items and the standard pool never yields them", () => {
  const rng = seeded(11);
  for (let i = 0; i < 300; i++) {
    assert.equal(itemRegistry.get(randomRareItemId(rng)).rarity, "rare");
    assert.notEqual(itemRegistry.get(randomStandardItemId(rng)).rarity, "rare");
  }
  // Weights naming standard or unknown items are ignored, so they can never leak into the rare pool.
  for (let i = 0; i < 50; i++)
    assert.equal(randomRareItemId(rng, { "mega-medkit": 100, bogus: 5, "wild-totem": 1 }), "wild-totem");
  // Changing only the config changes the balance.
  for (let i = 0; i < 50; i++)
    assert.equal(randomRareItemId(rng, { "pocket-duel": 0, "fallout-core": 1, "wild-totem": 0 }), "fallout-core");
});

test("a full inventory uses the existing replace/discard flow for a rare item", () => {
  const s = started();
  for (const id of ["mega-medkit", "turbo-boots", "comet-melon"]) give(s, "p0", id);
  const full = land(s, RARE_NODE, () => 0.5);
  assert.equal(full.phase, "ITEM_REPLACE");
  assert.equal(full.pendingItem.itemId, "fallout-core");
  assert.equal(P(full, "p0").inventory.length, 3);
  const replaced = applyAction(
    full,
    "p0",
    { type: "REPLACE_ITEM", replaceInstanceId: P(full, "p0").inventory[1].instanceId },
    coinSettings,
    () => 0,
  );
  assert.deepEqual(P(replaced, "p0").inventory.map((i) => i.itemId), ["mega-medkit", "fallout-core", "comet-melon"]);
  const discarded = applyAction(full, "p0", { type: "DISCARD_NEW_ITEM" }, coinSettings, () => 0);
  assert.ok(!P(discarded, "p0").inventory.some((i) => i.itemId === "fallout-core"));
  assert.equal(discarded.pendingItem, null);
});

test("clients cannot choose their rare item: there is no such action and extra fields are stripped", () => {
  assert.throws(() => parseMessage({ type: "ACTION", action: { type: "CHOOSE_RARE", itemId: "fallout-core" } }));
  const parsed = parseMessage({
    type: "ACTION",
    action: { type: "USE_ITEM", itemInstanceId: "item-1", targetNodeId: "space-4", affectedNodeIds: ["space-1"], animal: "cheetah" },
  });
  assert.deepEqual(parsed.action, { type: "USE_ITEM", itemInstanceId: "item-1", targetNodeId: "space-4" });
});

// ---------- Pocket Duel ----------
test("Pocket Duel rejects self and unknown targets without consuming the item", () => {
  const s = started();
  const item = give(s, "p0", "pocket-duel");
  assert.throws(() => use(s, "p0", { itemInstanceId: item, targetPlayerId: "p0" }), /yourself/);
  assert.throws(() => use(s, "p0", { itemInstanceId: item, targetPlayerId: "ghost" }), /not in this match/);
  assert.throws(() => use(s, "p0", { itemInstanceId: item }), /Choose an opponent/);
  assert.ok(has(s, "p0", item));
  assert.equal(s.duel, null);
});

test("Pocket Duel is consumed when the duel begins, picks a registered duel game and creates no wager", () => {
  const s = started();
  const item = give(s, "p0", "pocket-duel");
  const before = s.players.map((p) => p.coins);
  // A wager sent anyway is ignored: Pocket Duel never escrows anything.
  const duel = use(s, "p0", { itemInstanceId: item, targetPlayerId: "p2", wager: { type: "coins", amount: 10 } });
  assert.equal(duel.phase, "DUEL_INTRO");
  assert.ok(!has(duel, "p0", item));
  assert.equal(duel.duel.kind, "pocket-duel");
  assert.equal(duel.duel.wager, null);
  assert.equal(duel.duel.pot, 0);
  assert.deepEqual(duel.minigame.participants, ["p0", "p2"]);
  assert.equal(minigameRegistry.get(duel.minigame.minigameId).gameType, "duel");
  assert.deepEqual(duel.players.map((p) => p.coins), before);
});

test("Pocket Duel avoids repeating the previous duel game when another exists", () => {
  for (const previous of ["paddle-panic", "street-cross"]) {
    const s = started();
    s.lastDuelMinigameId = previous;
    const duel = use(s, "p0", { itemInstanceId: give(s, "p0", "pocket-duel"), targetPlayerId: "p1" });
    assert.notEqual(duel.minigame.minigameId, previous);
  }
});

test("Pocket Duel: the winner gets exactly +1 new Pluto, the loser loses nothing, and the turn resumes untouched", () => {
  for (const winner of ["p0", "p1"]) {
    const s = started();
    P(s, "p0").goldenPlutos = 1;
    P(s, "p1").goldenPlutos = 2;
    s.turn.bonusMovement = 4;
    s.turn.bonusRolled = true;
    const coins = s.players.map((p) => p.coins),
      order = [...s.order],
      turn = structuredClone(s.turn);
    const duel = use(s, "p0", { itemInstanceId: give(s, "p0", "pocket-duel"), targetPlayerId: "p1" });
    const results = duelResults(duel, winner);
    const loser = winner === "p0" ? "p1" : "p0";
    assert.equal(P(results, winner).goldenPlutos, (winner === "p0" ? 1 : 2) + 1);
    assert.equal(P(results, loser).goldenPlutos, loser === "p0" ? 1 : 2);
    assert.deepEqual(results.duel.payout[winner], { coins: 0, plutos: 1 });
    // No main-minigame placement rewards and no coin movement at all.
    assert.deepEqual(results.players.map((p) => p.coins), coins);
    const back = leaveResults(results);
    assert.equal(back.phase, "ITEM_PHASE");
    assert.equal(activePlayer(back).id, "p0");
    assert.equal(back.round, 1);
    assert.deepEqual(back.order, order);
    assert.deepEqual(back.turn, { ...turn, usedItemThisTurn: true });
    assert.equal(back.duel, null);
    assert.equal(back.minigame, null);
    assert.equal(back.lastMinigameId, null);
  }
});

test("a Pocket Duel win can end the match immediately on Plutos", () => {
  const s = started(plutoSettings);
  P(s, "p0").goldenPlutos = 4;
  const duel = use(s, "p0", { itemInstanceId: give(s, "p0", "pocket-duel"), targetPlayerId: "p3" }, plutoSettings);
  const results = duelResults(duel, "p0", plutoSettings);
  assert.equal(results.winner, "p0");
  const over = leaveResults(results, plutoSettings);
  assert.equal(over.phase, "GAME_OVER");
  assert.equal(P(over, "p0").goldenPlutos, 5);
});

test("Pocket Duel and Duel Saber settle differently: only Duel Saber takes the loser's Pluto", () => {
  const total = (x) => x.players.reduce((n, p) => n + p.goldenPlutos, 0);
  const base = started(plutoSettings);
  P(base, "p0").goldenPlutos = 1;
  P(base, "p1").goldenPlutos = 1;
  const saber = structuredClone(base);
  const saberDuel = use(
    saber,
    "p0",
    { itemInstanceId: give(saber, "p0", "duel-saber"), targetPlayerId: "p1", wager: { type: "pluto", amount: 1 } },
    plutoSettings,
  );
  const saberDone = duelResults(saberDuel, "p0", plutoSettings);
  assert.equal(P(saberDone, "p1").goldenPlutos, 0);
  assert.equal(total(saberDone), total(base));
  const pocket = structuredClone(base);
  const pocketDuel = use(pocket, "p0", { itemInstanceId: give(pocket, "p0", "pocket-duel"), targetPlayerId: "p1" }, plutoSettings);
  const pocketDone = duelResults(pocketDuel, "p0", plutoSettings);
  assert.equal(P(pocketDone, "p1").goldenPlutos, 1);
  assert.equal(total(pocketDone), total(base) + 1);
});

test("bots pick a legal Pocket Duel opponent at every difficulty", () => {
  for (const difficulty of ["easy", "medium", "hard"])
    for (let seed = 1; seed <= 20; seed++) {
      const s = started(plutoSettings);
      s.players.forEach((p, i) => {
        p.isBot = true;
        p.difficulty = i === 0 ? difficulty : ["easy", "medium", "hard"][i % 3];
        p.goldenPlutos = (seed + i) % 4;
      });
      give(s, "p0", "pocket-duel");
      const action = botAction(s, tropical, seeded(seed), plutoSettings, T0);
      assert.equal(action.type, "USE_ITEM");
      assert.ok(["p1", "p2", "p3"].includes(action.targetPlayerId));
      assert.equal(applyAction(s, "p0", action, plutoSettings, seeded(seed), T0).phase, "DUEL_INTRO");
    }
});

// ---------- Fallout Core ----------
const CENTER = "space-15"; // coin; neighbours space-14, space-16 and space-0 (Start)
test("Fallout Core covers the target and its directly connected nodes only (graph, not distance 2)", () => {
  const blast = falloutBlastNodes(tropical, CENTER).sort();
  assert.deepEqual(blast, ["space-0", "space-14", "space-15", "space-16"]);
  const distances = graphDistances(tropical, CENTER);
  for (const node of tropical.nodes)
    assert.equal(blast.includes(node.id), distances.get(node.id) <= 1, node.id);
  assert.throws(() => falloutBlastNodes(tropical, "space-99"), /Choose a space/);
});

function falloutSetup() {
  const s = started();
  P(s, "p0").currentNodeId = "space-16"; // owner inside the zone
  P(s, "p1").currentNodeId = CENTER;
  P(s, "p2").currentNodeId = "space-14";
  P(s, "p3").currentNodeId = "space-17"; // distance 2
  P(s, "p1").coins = 20;
  P(s, "p2").coins = 3;
  P(s, "p1").hp = 40;
  return s;
}

test("Fallout Core KOs everyone else in the blast, irradiates them after respawn and spares the owner", () => {
  const s = falloutSetup();
  const item = give(s, "p0", "fallout-core");
  const bank = s.bank,
    p3 = structuredClone(P(s, "p3"));
  const after = use(s, "p0", { itemInstanceId: item, targetNodeId: CENTER });
  assert.ok(!has(after, "p0", item));
  assert.equal(after.phase, "ITEM_PHASE");
  for (const id of ["p1", "p2"]) {
    assert.equal(P(after, id).currentNodeId, tropical.start);
    assert.equal(P(after, id).hp, 20);
    assert.deepEqual(radiation(after, id), { id: "radiation", remainingTurns: RADIATION_CONFIG.durationTurns });
  }
  // KO penalty: up to 5 coins each to the Central Bank.
  assert.equal(P(after, "p1").coins, 15);
  assert.equal(P(after, "p2").coins, 0);
  assert.equal(after.bank, bank + 5 + 3);
  // Owner immune to the initial blast; distance-2 player untouched.
  assert.equal(P(after, "p0").currentNodeId, "space-16");
  assert.equal(radiation(after, "p0"), undefined);
  assert.deepEqual(P(after, "p3"), p3);
  // One zone with exactly the blast nodes.
  assert.equal(after.radiationZones.length, 1);
  assert.deepEqual([...after.radiationZones[0].nodeIds].sort(), falloutBlastNodes(tropical, CENTER).sort());
  assert.equal(after.radiationZones[0].sourcePlayerId, "p0");
  assert.ok(after.events.some((e) => e.kind === "FALLOUT" && e.nodeId === CENTER));
});

test("Fallout Core rejects missing or invalid nodes without consuming the item", () => {
  const s = falloutSetup();
  const item = give(s, "p0", "fallout-core");
  assert.throws(() => use(s, "p0", { itemInstanceId: item }), /Choose a space/);
  assert.throws(() => use(s, "p0", { itemInstanceId: item, targetNodeId: "space-60" }), /Choose a space/);
  assert.ok(has(s, "p0", item));
  assert.equal(s.radiationZones.length, 0);
  // Consumed exactly once.
  const after = use(s, "p0", { itemInstanceId: item, targetNodeId: CENTER });
  assert.throws(() => use(after, "p0", { itemInstanceId: item, targetNodeId: CENTER }), /do not have that item/);
});

test("Fallout Core leaves an existing Golden Pluto in place; new Plutos never spawn on irradiated nodes", () => {
  const s = falloutSetup();
  s.plutoNodeIds = [CENTER, "space-40"];
  const after = use(s, "p0", { itemInstanceId: give(s, "p0", "fallout-core"), targetNodeId: CENTER });
  assert.deepEqual(after.plutoNodeIds, [CENTER, "space-40"]);
  // Buying the other Pluto: the replacement roll (random 0 → first candidate) skips every irradiated node.
  after.phase = "PLUTO_OFFER";
  P(after, "p0").currentNodeId = "space-40";
  P(after, "p0").coins = 20;
  const zone = new Set(after.radiationZones[0].nodeIds);
  const candidates = eligiblePlutoNodes(tropical, [CENTER, "space-40"]);
  // Make the zone cover the first eligible candidates so the test is meaningful.
  after.radiationZones.push({ id: "zone-x", sourcePlayerId: "p0", nodeIds: candidates.slice(0, 5), createdRound: 1, expiresAfterRound: 4 });
  const bought = applyAction(after, "p0", { type: "BUY_PLUTO" }, coinSettings, () => 0);
  const replacement = bought.plutoNodeIds.find((id) => id !== CENTER);
  assert.ok(!zone.has(replacement) && !candidates.slice(0, 5).includes(replacement));
  assert.ok(bought.plutoNodeIds.includes(CENTER));
});

test("Fallout Core does not change property ownership or level", () => {
  const s = falloutSetup();
  const property = s.properties[0];
  property.ownerPlayerId = "p1";
  property.level = 3;
  P(s, "p1").currentNodeId = property.nodeId;
  const after = use(s, "p0", { itemInstanceId: give(s, "p0", "fallout-core"), targetNodeId: property.nodeId });
  assert.deepEqual(after.properties[0], property);
  assert.ok(irradiatedNodeIds(after).has(property.nodeId));
});

test("bots only target Fallout Core zones that contain an opponent, and the server accepts them", () => {
  for (const difficulty of ["easy", "medium", "hard"])
    for (let seed = 1; seed <= 30; seed++) {
      const rng = seeded(seed * 7 + 1);
      const s = started();
      s.players.forEach((p) => {
        p.isBot = true;
        p.difficulty = difficulty;
        p.currentNodeId = tropical.nodes[Math.floor(rng() * 60)].id;
      });
      give(s, "p0", "fallout-core");
      const action = botAction(s, tropical, rng, coinSettings, T0);
      if (action.type !== "USE_ITEM") continue;
      const zone = falloutBlastNodes(tropical, action.targetNodeId);
      assert.ok(
        s.players.some((p) => p.id !== "p0" && zone.includes(p.currentNodeId)),
        `${difficulty} bot blasted an empty zone`,
      );
      applyAction(s, "p0", action, coinSettings, rng, T0);
    }
});

// ---------- Radiation zone lifetime ----------
function roundEnd(s) {
  s.phase = "ROUND_END";
  s.minigame = null;
  return advance(s, coinSettings, () => 0, T0);
}
test("a radiation zone lasts the rest of its round plus 3 full rounds, then expires at ROUND_END", () => {
  let s = started();
  s.round = 5;
  createRadiationZone(s, "p0", ["space-4", "space-5"]);
  assert.equal(s.radiationZones[0].expiresAfterRound, 8);
  assert.equal(radiationRoundsLeft(s, "space-4"), 4);
  for (const round of [5, 6, 7]) {
    s = roundEnd(s);
    assert.equal(s.round, round + 1);
    assert.equal(s.radiationZones.length, 1, `still active in round ${s.round}`);
  }
  assert.equal(radiationRoundsLeft(s, "space-4"), 1);
  s = roundEnd(s); // end of round 8
  assert.equal(s.round, 9);
  assert.equal(s.radiationZones.length, 0);
  assert.equal(radiationRoundsLeft(s, "space-4"), 0);
  assert.ok(s.events.some((e) => e.kind === "RADIATION_FADED"));
  // Landing there now is harmless.
  const safe = land(s, "space-4");
  assert.equal(radiation(safe, activePlayer(safe).id), undefined);
});

// ---------- Radiation status ----------
test("landing on an irradiated node applies Radiation, then the field still resolves once", () => {
  const s = started();
  createRadiationZone(s, "p3", ["space-4"]); // a coin space
  const coins = P(s, "p0").coins;
  const after = land(s, "space-4");
  assert.deepEqual(radiation(after, "p0"), { id: "radiation", remainingTurns: 3 });
  assert.equal(P(after, "p0").coins, coins + 3);
  // Landing does not hurt by itself; damage comes at turn start.
  assert.equal(P(after, "p0").hp, 20);
});

test("passing through radiation does nothing; only the landing node counts", () => {
  let s = started();
  createRadiationZone(s, "p3", ["space-1"]);
  P(s, "p0").currentNodeId = "space-0";
  P(s, "p0").previousNodeId = "space-15";
  s.phase = "PATH_SELECTION";
  s.movesRemaining = 2;
  s = applyAction(s, "p0", { type: "SELECT_PATH", nodeId: "space-1" }, coinSettings, () => 0);
  while (s.phase === "MOVEMENT") s = advance(s, coinSettings, () => 0, T0);
  assert.equal(P(s, "p0").currentNodeId, "space-2");
  s = advance(s, coinSettings, () => 0, T0);
  assert.equal(radiation(s, "p0"), undefined);
});

test("Radiation deals 10 at the start of each affected turn, locks items, and expires after 3 turns", () => {
  let s = started();
  s.players.forEach((p) => (p.hp = 40));
  P(s, "p1").statusEffects = [{ id: "radiation", remainingTurns: 3 }];
  const medkit = give(s, "p1", "mega-medkit");
  const expected = [30, 20, 10];
  for (let turn = 0; turn < 3; turn++) {
    s = turnStartOf(s, "p1");
    assert.equal(P(s, "p1").hp, expected[turn]);
    assert.equal(radiation(s, "p1").remainingTurns, 2 - turn);
    // Server rejects item use for the whole affected turn, whatever the client shows.
    assert.throws(
      () => applyAction(s, "p1", { type: "USE_ITEM", itemInstanceId: medkit }, coinSettings, () => 0, T0),
      /ITEMS DISABLED — RADIATION/,
    );
    s = endOwnTurn(s);
  }
  assert.equal(radiation(s, "p1"), undefined, "removed at the end of the third affected turn");
  s = turnStartOf(s, "p1");
  assert.equal(P(s, "p1").hp, 10, "no fourth tick");
  const healed = applyAction(s, "p1", { type: "USE_ITEM", itemInstanceId: medkit }, coinSettings, () => 0, T0);
  assert.equal(P(healed, "p1").hp, 30);
});

test("repeated exposure refreshes Radiation to 3 instead of stacking", () => {
  const s = started();
  createRadiationZone(s, "p3", ["space-4"]);
  P(s, "p0").statusEffects = [{ id: "radiation", remainingTurns: 1 }];
  const after = land(s, "space-4");
  assert.equal(P(after, "p0").statusEffects.length, 1);
  assert.equal(radiation(after, "p0").remainingTurns, 3);
  // A player in the last affected turn (0 left) is refreshed too and keeps the effect past TURN_END.
  const last = started();
  createRadiationZone(last, "p3", ["space-4"]);
  P(last, "p0").statusEffects = [{ id: "radiation", remainingTurns: 0 }];
  const landed = land(last, "space-4");
  const ended = advance(landed, coinSettings, () => 0, T0);
  assert.equal(radiation(ended, "p0").remainingTurns, 3);
});

test("Radiation damage can KO with the normal penalty and the KO does not cleanse Radiation", () => {
  let s = started();
  P(s, "p2").hp = 10;
  P(s, "p2").coins = 12;
  P(s, "p2").currentNodeId = "space-33";
  P(s, "p2").statusEffects = [{ id: "radiation", remainingTurns: 3 }];
  const bank = s.bank;
  s = turnStartOf(s, "p2");
  assert.equal(P(s, "p2").hp, 20);
  assert.equal(P(s, "p2").currentNodeId, tropical.start);
  assert.equal(P(s, "p2").coins, 7);
  assert.equal(s.bank, bank + 5);
  assert.equal(radiation(s, "p2").remainingTurns, 2);
  assert.equal(s.phase, "ITEM_PHASE", "the turn continues after a radiation KO");
});

test("an irradiated client cannot bypass the item lock through the server", () => {
  const rooms = new PartyRooms();
  const messages = [];
  const host = rooms.connect(undefined, (m) => messages.push(m));
  rooms.handle(host, { type: "CREATE", name: "Rad room", playerName: "Host", public: true });
  const room = rooms.rooms.get(host.room);
  rooms.handle(host, { type: "READY", ready: true });
  rooms.handle(host, { type: "START" });
  const m = room.match;
  m.order = m.players.map((p) => p.id);
  m.turnIndex = 0;
  m.phase = "ITEM_PHASE";
  const me = m.players.find((p) => p.id === host.id);
  me.statusEffects = [{ id: "radiation", remainingTurns: 2 }];
  me.hp = 10;
  const item = give(m, host.id, "mega-medkit");
  const raw = parseMessage({ type: "ACTION", action: { type: "USE_ITEM", itemInstanceId: item } });
  assert.throws(() => rooms.handle(host, raw), /RADIATION/);
  assert.ok(me.inventory.some((i) => i.instanceId === item));
  // Fallout Core through the server: the snapshot carries the authoritative zone.
  me.statusEffects = [];
  const core = give(m, host.id, "fallout-core");
  rooms.handle(host, parseMessage({ type: "ACTION", action: { type: "USE_ITEM", itemInstanceId: core, targetNodeId: "space-30" } }));
  const snapshot = messages.at(-1).lobby.match;
  assert.deepEqual([...snapshot.radiationZones[0].nodeIds].sort(), falloutBlastNodes(tropical, "space-30").sort());
});

test("bots do not try to use items while irradiated", () => {
  const s = started();
  s.players.forEach((p) => (p.isBot = true));
  P(s, "p0").hp = 5;
  P(s, "p0").statusEffects = [{ id: "radiation", remainingTurns: 2 }];
  give(s, "p0", "mega-medkit");
  give(s, "p0", "fallout-core");
  assert.deepEqual(botAction(s, tropical, seeded(1), coinSettings, T0), { type: "ROLL_DICE" });
});
