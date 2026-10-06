import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, FIELD_DISTRIBUTION, PROPERTY_CONFIG, RULES } from "../src/games/party/config.ts";
import { mapRegistry, mountain, tropical, tilePresentationFor } from "../src/games/party/content/maps.ts";
import { validateMap } from "../src/games/party/content/validate.ts";
import {
  activePlayer,
  advance,
  applyAction,
  createMatch,
  createPlayer,
  legalPaths,
  mapOf,
  resolveTile,
} from "../src/games/party/engine/engine.ts";
import { botAction, transportDecision } from "../src/games/party/engine/bots.ts";
import { eligiblePlutoNodes, spawnPlutos, distanceToPluto } from "../src/games/party/engine/economy.ts";
import {
  edgeKey,
  findShortestPath,
  graphDistances,
  isMapConnected,
} from "../src/games/party/engine/graph.ts";
import {
  activeRestrictions,
  blockConnection,
  blockedRoundsLeft,
  expireBlockedConnections,
  safeBlockableEdges,
} from "../src/games/party/engine/routes.ts";
import { availableTransport, disableTransport, slideDestination } from "../src/games/party/engine/transport.ts";
import { eligibleEvents, eventRegistry, runRandomEvent } from "../src/games/party/events/registry.ts";
import { createItemInstance } from "../src/games/party/items/inventory.ts";
import { falloutBlastNodes } from "../src/games/party/items/rare.ts";
import { cometMelonDamage } from "../src/games/party/items/definitions.ts";
import { createRadiationZone, irradiatedNodeIds } from "../src/games/party/hazards/radiation.ts";
import { summonAnimal, runAnimalPhase } from "../src/games/party/animals/runtime.ts";
import { purchaseProperty, upgradeProperty, resolvePropertyLanding } from "../src/games/party/properties/properties.ts";
import { parseMessage, validSettings } from "../src/games/party/network/protocol.ts";
import { stepMinigameBots } from "../src/games/party/minigames/flow.ts";
import { PartyRooms } from "../server/party/rooms.ts";

// ---- helpers ---------------------------------------------------------------------------------------
// Node ids are `mountain-<index>`; keys follow the table order in content/mountain.ts.
const KEYS = (
  "v0 v1 v2 v3 v4 v5 v6 v7 v8 m0 m1 m2 m3 m4 m5 m6 f0 f1 f2 f3 f4 f5 f6 f7 " +
  "l0 l1 l2 l3 l4 l5 l6 l7 b0 b1 b2 b3 b4 b5 c0 c1 c2 c3 c4 c5 c6 c7 c8 k0 k1 k2 k3 k4 s0 s1 s2 s3 s4 s5 s6 s7"
).split(" ");
const N = (key) => {
  const i = KEYS.indexOf(key);
  assert.ok(i >= 0, `unknown key ${key}`);
  return `mountain-${i}`;
};
const settings = { ...DEFAULT_SETTINGS, mapId: "mountain", victory: "coins", coinTarget: 300 };
const tropicalSettings = { ...DEFAULT_SETTINGS, victory: "coins", coinTarget: 300 };
const players = () => Array.from({ length: 4 }, (_, i) => createPlayer(`p${i}`, `Player ${i}`, i));
const seeded = (seed) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const P = (s, id) => s.players.find((p) => p.id === id);
function started(cfg = settings) {
  let r = 0;
  return advance(createMatch(players(), cfg, () => 0.4), cfg, () => [0.9, 0.7, 0.4, 0.1][r++ % 4]);
}
// Puts the active player on `nodeId` and resolves the landing (one advance per phase).
function land(s, key, rng = () => 0.5, cfg = settings) {
  const state = structuredClone(s);
  activePlayer(state).currentNodeId = N(key);
  state.phase = "RESOLVE_TILE";
  return advance(state, cfg, rng);
}
const give = (s, playerId, itemId) => {
  const item = createItemInstance(s, itemId);
  P(s, playerId).inventory.push(item);
  return item.instanceId;
};
const countType = (map, type) => map.nodes.filter((n) => n.type === type).length;
const edgesOf = (map) => {
  const out = [];
  for (const n of map.nodes) for (const c of n.connections) if (n.id < c) out.push([n.id, c]);
  return out;
};
const T0 = 9_000_000;

// ---- 1. map integrity --------------------------------------------------------------------------------
test("Mountain is registered next to the Tropical map with a unique id and passes generic map validation", () => {
  assert.equal(mapRegistry.get("mountain"), mountain);
  assert.equal(mapRegistry.get("sunspill"), tropical);
  const ids = mapRegistry.all().map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const map of mapRegistry.all()) assert.deepEqual(validateMap(map), [], map.id);
});

test("Mountain has 92 uniquely identified nodes, a Start, valid types and reciprocal links", () => {
  assert.equal(mountain.nodes.length, 92);
  assert.equal(new Set(mountain.nodes.map((n) => n.id)).size, 92);
  assert.ok(mountain.nodes.some((n) => n.id === mountain.start));
  const byId = new Map(mountain.nodes.map((n) => [n.id, n]));
  const valid = new Set(FIELD_DISTRIBUTION.map(([t]) => t));
  for (const n of mountain.nodes) {
    assert.ok(valid.has(n.type), `${n.id} type`);
    for (const c of n.connections) {
      assert.ok(byId.has(c), `${n.id} -> ${c} exists`);
      assert.ok(byId.get(c).connections.includes(n.id), `${n.id} <-> ${c} reciprocal`);
    }
  }
});

test("every Mountain node is reachable from Start and the board has loops, branches and intersections", () => {
  assert.equal(graphDistances(mountain, mountain.start).size, 92);
  const edges = edgesOf(mountain);
  const intersections = mountain.nodes.filter((n) => n.connections.length > 2);
  assert.ok(intersections.length >= 10, `intersections: ${intersections.length}`);
  // Cyclomatic number = independent loops; a single ring would be 1.
  assert.ok(edges.length - mountain.nodes.length + 1 >= 6, "several independent loops");
  assert.ok(edges.length > tropical.nodes.length, "denser than a plain ring");
});

test("Mountain expands its supplies while retaining 6 camps, 1 rare, 1 bank and 1 Nothing", () => {
  for (const [type, count] of FIELD_DISTRIBUTION) assert.equal(countType(mountain, type), mountain.fieldDistribution[type] ?? count, type);
  assert.equal(countType(mountain, "property"), 6);
  assert.equal(countType(mountain, "rare"), 1);
  assert.equal(countType(mountain, "bank"), 1);
  assert.equal(countType(mountain, "empty"), 1);
  assert.equal(mountain.nodes.reduce((n, node) => n + (FIELD_DISTRIBUTION.some(([t]) => t === node.type) ? 1 : 0), 0), 92);
});

test("map validation fails for a wrong node count, a one-way link, an unreachable node, a bad slide and a bad edge", () => {
  const broken = (edit) => {
    const map = structuredClone(mountain);
    edit(map);
    return validateMap(map);
  };
  assert.ok(broken((m) => m.nodes.pop()).some((e) => /expected 92 playable nodes/.test(e)));
  assert.ok(
    broken((m) => {
      m.nodes[0].connections = m.nodes[0].connections.slice(1);
    }).some((e) => /reciprocal/.test(e)),
  );
  // Cut the summit ring off from both approaches (reciprocally): its spaces become unreachable.
  const cut = broken((m) => {
    for (const [a, b] of [["k4", "s0"], ["c8", "s3"]]) {
      const na = m.nodes.find((n) => n.id === N(a)),
        nb = m.nodes.find((n) => n.id === N(b));
      na.connections = na.connections.filter((c) => c !== nb.id);
      nb.connections = nb.connections.filter((c) => c !== na.id);
    }
  });
  assert.ok(cut.some((e) => /unreachable from Start/.test(e)));
  assert.ok(broken((m) => (m.slides[0].path = [N("v0"), N("v4")])).some((e) => /not a connection/.test(e)));
  assert.ok(broken((m) => (m.slides[0].path = [N("l1"), N("l2")])).some((e) => /revisits/.test(e)));
  assert.ok(broken((m) => (m.slides[0].path = [N("l1"), N("l6")])).length > 0, "forced-movement destination rejected");
  assert.ok(broken((m) => m.blockableEdges.push([N("v0"), N("s0")])).some((e) => /blockable edge/.test(e)));
  assert.ok(broken((m) => (m.nodes[2].type = "coin")).some((e) => /expected \d+ .* fields/.test(e)));
});

test("the rope bridges are real chokepoints: closing one keeps the map connected, closing both cuts the summit off", () => {
  const west = new Set([edgeKey(N("b0"), N("b1"))]);
  const both = new Set([edgeKey(N("b0"), N("b1")), edgeKey(N("b3"), N("b4"))]);
  assert.equal(isMapConnected(mountain, west), true);
  assert.equal(isMapConnected(mountain, both), false);
  const before = graphDistances(mountain, N("l1")).get(N("s0"));
  const after = graphDistances(mountain, N("l1"), Infinity, west).get(N("s0"));
  assert.ok(after >= before + 4, `detour ${before} -> ${after}`);
});

test("route choices are genuine: short and dangerous versus long and safe", () => {
  // From the lake: the west route (Cliff Path) reaches the summit sooner than the east route (Frozen Cave).
  const west = findShortestPath(mountain, N("l1"), N("s0")).length;
  const east = findShortestPath(mountain, N("l3"), N("s3")).length;
  assert.ok(west < east, `cliff ${west} vs cave ${east}`);
  const types = (from, to) => new Set(findShortestPath(mountain, from, to).map((id) => mountain.nodes.find((n) => n.id === id).type));
  assert.ok(types(N("l1"), N("s0")).has("hazard") && types(N("l1"), N("s0")).has("rare"), "cliff route has the hazard and rare item");
  assert.ok(!types(N("l3"), N("s3")).has("hazard"));
  // Old Mine (shortcut) versus Forest Trail (longer, healing) between the village and the lake.
  const mine = findShortestPath(mountain, N("v3"), N("l0")).length;
  const forest = findShortestPath(mountain, N("v6"), N("l4")).length;
  assert.notEqual(mine, forest);
});

test("placement rules: Start is not beside the bank or rare item, healing and duels are spread out, camps are not all chokepoints", () => {
  const dist = graphDistances(mountain, mountain.start);
  const at = (type) => mountain.nodes.filter((n) => n.type === type);
  assert.ok(dist.get(at("bank")[0].id) >= 6, "bank away from Start");
  assert.ok(dist.get(at("rare")[0].id) >= 10, "rare item is a trek");
  const spread = (nodes, min) => {
    for (const a of nodes) for (const b of nodes) if (a !== b) assert.ok(graphDistances(mountain, a.id).get(b.id) >= min);
  };
  spread(at("heal"), 4);
  spread(at("duel"), 4);
  assert.equal(new Set(at("heal").map((n) => n.region)).size, 3, "healing in three different regions");
  assert.ok(new Set(at("property").map((n) => n.region)).size >= 5, "camps across the map");
  assert.ok(at("property").every((n) => n.region !== 4 && n.region !== 6), "no camp on the rope bridges or the cliff path");
});

// ---- 2. Golden Plutos -----------------------------------------------------------------------------------
test("Tropical still starts with 2 Golden Plutos and Mountain with exactly 1", () => {
  assert.equal(tropical.goldenPlutoCount, 2);
  assert.equal(mountain.goldenPlutoCount, 1);
  assert.equal(createMatch(players(), tropicalSettings, () => 0.3).plutoNodeIds.length, 2);
  const s = createMatch(players(), settings, () => 0.3);
  assert.equal(s.plutoNodeIds.length, 1);
  assert.equal(s.mapId, "mountain");
});

test("buying the Mountain Pluto spawns exactly one replacement elsewhere; the count never reaches 2", () => {
  let s = started();
  for (let i = 0; i < 60; i++) {
    const rng = seeded(i + 1);
    const before = s.plutoNodeIds[0];
    const p = activePlayer(s);
    p.coins = 100;
    p.currentNodeId = before;
    s.phase = "PLUTO_OFFER";
    s = applyAction(s, p.id, { type: "BUY_PLUTO" }, settings, rng);
    assert.equal(s.plutoNodeIds.length, 1);
    assert.notEqual(s.plutoNodeIds[0], before);
    assert.ok(eligiblePlutoNodes(mountain).includes(s.plutoNodeIds[0]));
    s.phase = "TURN_END";
  }
});

test("Pluto spawn excludes Start, rare, bank, properties, warps, boost, stations, slides and irradiated nodes", () => {
  const eligible = new Set(eligiblePlutoNodes(mountain));
  const excluded = [
    mountain.start,
    ...mountain.nodes.filter((n) => ["rare", "bank", "property", "warp", "boost"].includes(n.type)).map((n) => n.id),
    ...mountain.transports.flatMap((t) => t.endpoints),
    ...mountain.slides.map((sl) => sl.nodeId),
  ];
  for (const id of excluded) assert.ok(!eligible.has(id), `${id} must not hold a Pluto`);
  const irradiated = [N("s1"), N("c7"), N("c2")];
  const rng = seeded(4);
  for (let i = 0; i < 200; i++) {
    const [spawn] = spawnPlutos(mountain, [N("s4")], 1, rng, irradiated);
    assert.ok(eligible.has(spawn));
    assert.ok(!irradiated.includes(spawn) && spawn !== N("s4"));
  }
});

test("Mountain replacement Pluto avoids radiation zones (match state) and existing Pluto spawns are spread over the map", () => {
  let s = started();
  createRadiationZone(s, "p1", [N("s1"), N("s0"), N("s2")]);
  const rng = seeded(11);
  const regions = new Set();
  for (let i = 0; i < 150; i++) {
    const p = activePlayer(s);
    p.coins = 100;
    p.currentNodeId = s.plutoNodeIds[0];
    s.phase = "PLUTO_OFFER";
    s = applyAction(s, p.id, { type: "BUY_PLUTO" }, settings, rng);
    assert.ok(!irradiatedNodeIds(s).has(s.plutoNodeIds[0]));
    regions.add(mountain.nodes.find((n) => n.id === s.plutoNodeIds[0]).region);
  }
  assert.ok(regions.size >= 7, `Plutos appeared in ${regions.size} regions`);
});

// ---- 3. Mountain Camps (existing property system) --------------------------------------------------------
test("Mountain Camps use the unchanged property rules and the Mountain Camp name", () => {
  assert.equal(mountain.propertyName, "Mountain Camp");
  assert.equal(tropical.propertyName, "Outpost");
  const s = started();
  assert.equal(s.properties.length, 6);
  assert.deepEqual(
    s.properties.map((p) => p.nodeId).sort(),
    mountain.nodes.filter((n) => n.type === "property").map((n) => n.id).sort(),
  );
  const camp = N("v5"),
    owner = P(s, "p0"),
    visitor = P(s, "p1");
  owner.currentNodeId = camp;
  visitor.currentNodeId = camp;
  owner.coins = 30;
  visitor.coins = 30;
  purchaseProperty(s, mountain, "p0", camp);
  assert.equal(owner.coins, 30 - PROPERTY_CONFIG.purchaseCost);
  assert.equal(s.properties.find((p) => p.nodeId === camp).level, 1);
  upgradeProperty(s, mountain, "p0", camp);
  upgradeProperty(s, mountain, "p0", camp);
  upgradeProperty(s, mountain, "p0", camp);
  assert.equal(s.properties.find((p) => p.nodeId === camp).level, 4);
  visitor.goldenPlutos = 1;
  const before = owner.goldenPlutos;
  resolvePropertyLanding(s, mountain, "p1", camp);
  assert.equal(owner.goldenPlutos, before + 1, "Level 4 still steals a Golden Pluto");
  assert.match(s.log.join(" "), /MOUNTAIN CAMP/i);
});

test("landing on a Mountain Camp offers it through the normal property phase", () => {
  const s = land(started(), "v5");
  assert.equal(s.phase, "PROPERTY_OFFER");
  const bought = applyAction(s, activePlayer(s).id, { type: "BUY_PROPERTY", nodeId: N("v5") }, settings, () => 0.5);
  assert.equal(bought.properties.find((p) => p.nodeId === N("v5")).ownerPlayerId, activePlayer(s).id);
});

// ---- 4. events and Avalanche -------------------------------------------------------------------------------
test("event eligibility follows allowedMaps: Avalanche is Mountain-only, generic events run anywhere, Tropical keeps its own", () => {
  const s = started();
  const names = (map) => eligibleEvents(s, map).map((e) => e.id);
  assert.ok(names(mountain).includes("avalanche"));
  assert.ok(!names(tropical).includes("avalanche"));
  assert.deepEqual(names(tropical), ["island-breeze"]);
  assert.ok(names(mountain).includes("windfall"));
  assert.ok(!names(mountain).includes("island-breeze"), "Tropical-only event excluded from Mountain");
  // Even if a pool lists a foreign event, allowedMaps still excludes it.
  const cheating = { ...tropical, eventPoolIds: ["island-breeze", "avalanche", "windfall", "mine-collapse"] };
  assert.deepEqual(eligibleEvents(s, cheating).map((e) => e.id).sort(), ["island-breeze", "windfall"]);
  assert.deepEqual(eventRegistry.get("windfall").allowedMaps, undefined);
  assert.deepEqual(eventRegistry.get("avalanche").allowedMaps, ["mountain"]);
});

test("Tropical Random Event behaviour is unchanged: +2 coins for everyone and no random number drawn", () => {
  const s = started(tropicalSettings);
  const before = s.players.map((p) => p.coins);
  const node = tropical.nodes.find((n) => n.type === "event").id;
  s.players[0].currentNodeId = node;
  s.phase = "RESOLVE_TILE";
  const after = advance(s, tropicalSettings, () => {
    throw new Error("no random draw expected");
  });
  assert.deepEqual(after.players.map((p) => p.coins), before.map((c) => c + 2));
  assert.equal(after.blockedConnections.length, 0);
});

test("Avalanche closes exactly one eligible connection for 2 rounds and announces it", () => {
  const s = started();
  s.round = 5;
  const chosen = eventRegistry.get("avalanche");
  chosen.execute(s, { map: mountain, random: () => 0, playerId: "p0" });
  assert.equal(s.blockedConnections.length, 1);
  const [block] = s.blockedConnections;
  assert.ok(mountain.blockableEdges.some(([a, b]) => edgeKey(a, b) === edgeKey(block.fromNodeId, block.toNodeId)));
  assert.equal(block.expiresAfterRound, 6);
  assert.equal(block.source, "avalanche");
  assert.equal(blockedRoundsLeft(s, block), 2);
  assert.ok(s.events.some((e) => e.kind === "AVALANCHE" && /AVALANCHE!/.test(e.text)));
  assert.equal(isMapConnected(mountain, activeRestrictions(s)), true);
});

test("Avalanche is picked by the server from the Random Event field on Mountain, never on Tropical", () => {
  let hits = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const s = started();
    const out = land(s, "v4", seeded(seed));
    if (out.blockedConnections.length) hits++;
    assert.ok(out.blockedConnections.length <= 1);
  }
  assert.ok(hits > 10, `avalanche fired ${hits} times of 80`);
  for (let seed = 1; seed <= 80; seed++) {
    const t = started(tropicalSettings);
    t.players[0].currentNodeId = tropical.nodes.find((n) => n.type === "event").id;
    t.phase = "RESOLVE_TILE";
    assert.equal(advance(t, tropicalSettings, seeded(seed)).blockedConnections.length, 0);
  }
});

test("Avalanche never picks a closure that disconnects the board and does nothing when none is safe", () => {
  const s = started();
  // Close the west bridge; every east-side blockable edge would now cut the upper mountain off.
  blockConnection(s, N("b0"), N("b1"), "test");
  const safe = safeBlockableEdges(s, mountain).map(([a, b]) => edgeKey(a, b));
  for (const east of [["b3", "b4"], ["b4", "b5"], ["b5", "c0"]])
    assert.ok(!safe.includes(edgeKey(N(east[0]), N(east[1]))), `${east} unsafe`);
  assert.ok(!safe.includes(edgeKey(N("b0"), N("b1"))), "already-closed edge not chosen again");
  for (const [a, b] of safeBlockableEdges(s, mountain)) {
    const next = new Set(activeRestrictions(s));
    next.add(edgeKey(a, b));
    assert.equal(isMapConnected(mountain, next), true);
  }
  // A map with no safe edge: Avalanche cannot run, the event field falls back to another event.
  const stuck = { ...mountain, blockableEdges: [[N("b0"), N("b1")]] };
  assert.equal(eventRegistry.get("avalanche").canRun(s, stuck), false);
  const noSafe = { ...stuck, eventPoolIds: ["avalanche"] };
  const before = structuredClone(s.blockedConnections);
  assert.equal(runRandomEvent(s, noSafe, () => 0.5, "p0"), null);
  assert.deepEqual(s.blockedConnections, before);
  const fallback = { ...stuck, eventPoolIds: ["avalanche", "windfall"] };
  assert.equal(runRandomEvent(s, fallback, () => 0.5, "p0").id, "windfall");
});

test("every single Avalanche closure keeps Mountain connected and every space keeps a way out", () => {
  for (const [a, b] of mountain.blockableEdges) {
    const restrictions = new Set([edgeKey(a, b)]);
    assert.equal(isMapConnected(mountain, restrictions), true, `${a}-${b}`);
    for (const node of mountain.nodes) {
      const open = node.connections.filter((c) => !restrictions.has(edgeKey(node.id, c)));
      assert.ok(open.length >= 1, `${node.id} trapped by ${a}-${b}`);
    }
  }
});

test("a blocked connection cannot be walked: movement paths and shortest paths avoid it", () => {
  const s = started();
  const p = activePlayer(s);
  p.currentNodeId = N("l1");
  p.previousNodeId = N("l0");
  assert.deepEqual(legalPaths(s, mountain).sort(), [N("b0"), N("l2")].sort());
  blockConnection(s, N("l1"), N("b0"), "avalanche");
  s.phase = "PATH_SELECTION";
  assert.deepEqual(legalPaths(s, mountain), [N("l2")]);
  assert.throws(
    () => applyAction(s, p.id, { type: "SELECT_PATH", nodeId: N("b0") }, settings, () => 0.5),
    /highlighted connected path/,
  );
  // b0 is only reachable through the closed edge from the lake side; the west bridge is cut.
  const route = findShortestPath(mountain, N("l1"), N("k0"), activeRestrictions(s));
  assert.ok(route && !route.includes(N("b0")), "detour avoids the closed bridge");
});

test("bots respect a blocked route when choosing paths and when measuring distance to a Golden Pluto", () => {
  const s = started();
  const p = activePlayer(s);
  p.currentNodeId = N("l1");
  p.previousNodeId = N("l0");
  p.coins = 30;
  p.difficulty = "hard";
  s.phase = "PATH_SELECTION";
  s.movesRemaining = 3;
  s.plutoNodeIds = [N("b2")];
  const open = botAction(s, mountain, () => 0.5, { ...settings, victory: "plutos" });
  assert.equal(open.nodeId, N("b0"), "hard bot heads for the Pluto over the bridge");
  blockConnection(s, N("l1"), N("b0"), "avalanche");
  const closed = botAction(s, mountain, () => 0.5, { ...settings, victory: "plutos" });
  assert.equal(closed.nodeId, N("l2"));
  assert.ok(
    distanceToPluto(mountain, N("l1"), [N("b2")], activeRestrictions(s)) > distanceToPluto(mountain, N("l1"), [N("b2")]),
  );
});

test("animals respect closures: they walk the detour and never cross a blocked connection", () => {
  const s = started();
  for (const p of s.players) p.currentNodeId = N("v0");
  P(s, "p1").currentNodeId = N("b2");
  P(s, "p0").currentNodeId = N("b0");
  P(s, "p2").currentNodeId = N("b0");
  P(s, "p3").currentNodeId = N("b0");
  const cheetah = summonAnimal(s, "p0", "cheetah", N("l1"));
  const direct = findShortestPath(mountain, N("l1"), N("b2"));
  assert.deepEqual(direct, [N("b0"), N("b1"), N("b2")]);
  blockConnection(s, N("l1"), N("b0"), "avalanche");
  runAnimalPhase(s, mountain, T0, activeRestrictions(s));
  const step = s.animalPhase.steps[0];
  let at = N("l1");
  for (const node of step.path) {
    assert.notEqual(edgeKey(at, node), edgeKey(N("l1"), N("b0")), "no step across the closed connection");
    assert.ok(mountain.nodes.find((n) => n.id === at).connections.includes(node));
    at = node;
  }
  assert.equal(cheetah.movementPerPhase, step.path.length);
  // Through the real phase flow (engine reads the match's closures itself).
  const flow = started();
  for (const p of flow.players) p.currentNodeId = N("v0");
  P(flow, "p1").currentNodeId = N("b2");
  summonAnimal(flow, "p0", "cheetah", N("l1"));
  blockConnection(flow, N("l1"), N("b0"), "avalanche");
  flow.phase = "ANIMAL_PHASE";
  const after = advance(flow, settings, () => 0.5, T0);
  const path = after.animalPhase.steps[0].path;
  assert.ok(!(path[0] === N("b0")), "engine passes the active closures to the animals");
});

test("a closure expires by round: blocked in round 5 for 2 rounds = rounds 5 and 6, open again in round 7", () => {
  const s = started();
  s.round = 5;
  blockConnection(s, N("b3"), N("b4"), "avalanche");
  const blocked = () => activeRestrictions(s).has(edgeKey(N("b3"), N("b4")));
  expireBlockedConnections(s); // ROUND_END of round 5
  assert.equal(blocked(), true);
  s.round = 6;
  assert.equal(blockedRoundsLeft(s, s.blockedConnections[0]), 1);
  expireBlockedConnections(s); // ROUND_END of round 6
  assert.equal(blocked(), false);
  assert.equal(s.blockedConnections.length, 0);
  assert.ok(s.events.some((e) => e.kind === "ROUTE_REOPENED"));
  s.round = 7;
  assert.ok(legalPaths({ ...s, phase: "PATH_SELECTION" }, mountain).length >= 1);
});

test("the real ROUND_END clears closures and outages, then the route can be walked again", () => {
  const s = started();
  s.round = 5;
  blockConnection(s, N("b3"), N("b4"), "avalanche");
  disableTransport(s, "cable-car", "test");
  const toRoundEnd = (state, round) => {
    const x = structuredClone(state);
    x.round = round;
    x.phase = "ROUND_END";
    x.minigame = null;
    return advance(x, settings, () => 0.5, T0);
  };
  const r6 = toRoundEnd(s, 5);
  assert.equal(r6.round, 6);
  assert.equal(r6.blockedConnections.length, 1);
  assert.equal(r6.transportOutages.length, 1);
  const r7 = toRoundEnd(r6, 6);
  assert.equal(r7.round, 7);
  assert.equal(r7.blockedConnections.length, 0);
  assert.equal(r7.transportOutages.length, 0);
});

test("closures are part of the authoritative snapshot so every client sees the blocked route before choosing it", async () => {
  const rooms = new PartyRooms();
  const messages = [];
  const host = rooms.connect(undefined, (m) => messages.push(structuredClone(m)));
  rooms.handle(host, { type: "CREATE", name: "Snowed in", playerName: "Host", public: true });
  const room = rooms.rooms.get(host.room);
  rooms.handle(host, { type: "SETTINGS", settings: { ...room.settings, mapId: "mountain" } });
  rooms.handle(host, { type: "READY", ready: true });
  rooms.handle(host, { type: "START" });
  blockConnection(room.match, N("b3"), N("b4"), "avalanche");
  rooms.broadcast(room);
  const snapshot = messages.at(-1).lobby.match;
  assert.equal(snapshot.mapId, "mountain");
  assert.equal(snapshot.blockedConnections[0].fromNodeId, N("b3"));
});

// ---- 5. Cable Car / Mine Cart transports ------------------------------------------------------------------
test("landing on a Cable Car station offers the ride after the station's own field; other spaces do not", () => {
  const s = land(started(), "f2"); // coin space with a station
  assert.equal(s.phase, "TRANSPORT_OFFER");
  assert.equal(availableTransport(s, mountain, N("f2")).id, "cable-car");
  assert.equal(P(s, activePlayer(s).id).coins, RULES.coins + 3, "the station's coin still paid out");
  for (const key of ["v1", "l3", "s0", "k3"]) assert.notEqual(land(started(), key).phase, "TRANSPORT_OFFER", key);
});

test("riding the Cable Car moves to the paired station, is free, is not dice movement and does not retrigger the destination", () => {
  let s = land(started(), "f2");
  const me = activePlayer(s).id;
  const coins = P(s, me).coins,
    hp = P(s, me).hp;
  const bank = s.bank;
  s = applyAction(s, me, { type: "RIDE_TRANSPORT", transportId: "cable-car" }, settings, () => 0.5);
  assert.equal(P(s, me).currentNodeId, N("k4"));
  assert.equal(P(s, me).coins, coins, "free, and the destination coin space did not pay");
  assert.equal(P(s, me).hp, hp);
  assert.equal(s.bank, bank);
  assert.equal(s.phase, "TURN_END");
  assert.equal(s.movesRemaining, 0);
  assert.equal(s.forcedMove.kind, "cable-car");
  assert.deepEqual(s.forcedMove.path, [N("k4")]);
  assert.equal(s.forcedMove.pending, false);
  // The return trip from the upper station works the same way.
  let back = land(started(), "k4");
  assert.equal(back.phase, "TRANSPORT_OFFER");
  back = applyAction(back, activePlayer(back).id, { type: "RIDE_TRANSPORT", transportId: "cable-car" }, settings, () => 0.5);
  assert.equal(activePlayer(back).currentNodeId, N("f2"));
});

test("the ride is validated by the server: wrong phase, wrong station, unknown ride, repeated request, closed service", () => {
  const fresh = started();
  const me = activePlayer(fresh).id;
  const ride = (state, transportId = "cable-car", who = me) =>
    applyAction(state, who, { type: "RIDE_TRANSPORT", transportId }, settings, () => 0.5);
  assert.throws(() => ride(fresh), /no ride on offer/);
  const offered = land(fresh, "f2");
  assert.throws(() => ride(offered, "mine-cart"), /not available from here/);
  assert.throws(() => ride(offered, "nope"), /not available from here/);
  assert.throws(() => ride(offered, "cable-car", "p3"), /Wait for your turn/);
  const once = ride(offered);
  assert.throws(() => ride(once), /no ride on offer/, "no repeated teleport during one landing");
  assert.throws(
    () => applyAction(once, me, { type: "DECLINE_TRANSPORT" }, settings, () => 0.5),
    /no ride on offer/,
  );
  // Out of service: no offer at all, and a forged request is rejected.
  const closed = started();
  disableTransport(closed, "cable-car", "test");
  assert.equal(land(closed, "f2").phase, "TURN_END");
  const forged = structuredClone(offered);
  disableTransport(forged, "cable-car", "test");
  assert.throws(() => ride(forged), /not available from here/);
  // A player who is not at a station cannot be offered one even in the offer phase.
  const bogus = structuredClone(offered);
  activePlayer(bogus).currentNodeId = N("v1");
  assert.throws(() => ride(bogus), /not available from here/);
});

test("declining keeps the pawn where it is and ends the landing", () => {
  const s = land(started(), "f2");
  const after = applyAction(s, activePlayer(s).id, { type: "DECLINE_TRANSPORT" }, settings, () => 0.5);
  assert.equal(activePlayer(after).currentNodeId, N("f2"));
  assert.equal(after.phase, "TURN_END");
});

test("the Mine Cart uses the same transport system between the mine entrance and exit", () => {
  let s = land(started(), "m0");
  assert.equal(s.phase, "TRANSPORT_OFFER");
  assert.equal(availableTransport(s, mountain, N("m0")).kind, "mine-cart");
  s = applyAction(s, activePlayer(s).id, { type: "RIDE_TRANSPORT", transportId: "mine-cart" }, settings, () => 0.5);
  assert.equal(activePlayer(s).currentNodeId, N("m6"));
  assert.equal(s.forcedMove.kind, "mine-cart");
  assert.ok(graphDistances(mountain, N("m6")).has(N("m0")), "never strands the player in a disconnected part");
});

test("transport stations are on connected, normal spaces and the paired destination is reachable by walking", () => {
  for (const t of mountain.transports) {
    const [a, b] = t.endpoints;
    assert.ok(graphDistances(mountain, a).has(b));
    assert.ok(graphDistances(mountain, a).get(b) >= 3, "a real shortcut");
    for (const id of t.endpoints) {
      const node = mountain.nodes.find((n) => n.id === id);
      assert.equal(node.plutoEligible, false);
      assert.notEqual(node.type, "property");
    }
  }
});

test("transport breakdown events close a transport for 2 rounds and it reopens", () => {
  const s = started();
  s.round = 3;
  eventRegistry.get("cable-breakdown").execute(s, { map: mountain, random: () => 0, playerId: "p0" });
  assert.equal(s.transportOutages[0].transportId, "cable-car");
  assert.equal(s.transportOutages[0].expiresAfterRound, 4);
  assert.equal(eventRegistry.get("cable-breakdown").canRun(s, mountain), false, "already closed");
  assert.equal(availableTransport(s, mountain, N("f2")), null);
  eventRegistry.get("mine-collapse").execute(s, { map: mountain, random: () => 0, playerId: "p0" });
  assert.equal(availableTransport(s, mountain, N("m0")), null);
  const tropicalState = started(tropicalSettings);
  assert.equal(eventRegistry.get("mine-collapse").canRun(tropicalState, tropical), false, "no mine on Tropical");
});

test("bots decide on rides legally: easy is random, medium follows the objective, hard also weighs hazards", () => {
  const offer = (difficulty, prep = () => {}) => {
    const s = land(started(), "f2");
    activePlayer(s).difficulty = difficulty;
    prep(s);
    return s;
  };
  const decide = (s, rng = () => 0.5) => transportDecision(s, mountain, rng, settings).type;
  // Pluto beyond the upper station: riding brings the bot closer.
  const near = (s) => (s.plutoNodeIds = [N("s0")]);
  const far = (s) => (s.plutoNodeIds = [N("f6")]);
  assert.equal(decide(offer("medium", near)), "RIDE_TRANSPORT");
  assert.equal(decide(offer("medium", far)), "DECLINE_TRANSPORT");
  assert.equal(decide(offer("hard", near)), "RIDE_TRANSPORT");
  assert.equal(decide(offer("hard", far)), "DECLINE_TRANSPORT");
  // Hard bots avoid landing in radiation next to the objective; medium does not care.
  const irradiated = (s) => {
    near(s);
    createRadiationZone(s, "p3", [N("k4")]);
  };
  assert.equal(decide(offer("hard", irradiated)), "RIDE_TRANSPORT", "a modest penalty does not outweigh a huge gain");
  assert.equal(decide(offer("easy"), () => 0.1), "RIDE_TRANSPORT");
  assert.equal(decide(offer("easy"), () => 0.9), "DECLINE_TRANSPORT");
  // Every decision passes the authority's validation.
  for (const difficulty of ["easy", "medium", "hard"])
    for (const prep of [near, far, irradiated]) {
      const s = offer(difficulty, prep);
      const action = botAction(s, mountain, seeded(3), settings);
      assert.doesNotThrow(() => applyAction(s, activePlayer(s).id, action, settings, seeded(3)));
    }
});

// ---- 6. Frozen Slide ---------------------------------------------------------------------------------------
test("slide configuration: forced paths follow connections and end on ordinary spaces", () => {
  assert.equal(mountain.slides.length, 2);
  for (const slide of mountain.slides) {
    assert.equal(slide.path.length, 2);
    let previous = slide.nodeId;
    for (const step of slide.path) {
      assert.ok(mountain.nodes.find((n) => n.id === previous).connections.includes(step));
      previous = step;
    }
    assert.equal(slideDestination(mountain, slide.nodeId), slide.path[1]);
    assert.ok(!mountain.slides.some((o) => o.nodeId === slide.path[1]), "no slide ends on a slide");
    assert.ok(!mountain.transports.some((t) => t.endpoints.includes(slide.path[1])));
    assert.notEqual(mountain.nodes.find((n) => n.id === slide.path[1]).type, "warp");
  }
});

test("landing on a Frozen Slide slides exactly 2 spaces with no input, then resolves only the final space once", () => {
  const s0 = started();
  const me = activePlayer(s0).id,
    coins = P(s0, me).coins;
  const phases = [];
  let s = structuredClone(s0);
  activePlayer(s).currentNodeId = N("l6");
  s.phase = "RESOLVE_TILE";
  const before = s.eventSeq;
  for (let i = 0; i < 3 && s.phase !== "TURN_END"; i++) {
    s = advance(s, settings, () => 0.5);
    phases.push(s.phase);
  }
  assert.ok(!phases.includes("PATH_SELECTION"), "no route selection while sliding");
  assert.equal(P(s, me).currentNodeId, N("l4"), "slid l6 -> l5 -> l4");
  assert.equal(P(s, me).coins, coins + 3 + 3, "origin coin once + final coin once (l5 is not resolved)");
  assert.equal(s.phase, "TURN_END");
  assert.equal(s.forcedMove.kind, "slide");
  assert.deepEqual(s.forcedMove.path, [N("l5"), N("l4")]);
  assert.equal(s.forcedMove.pending, false);
  assert.equal(s.events.filter((e) => e.id > before && e.kind === "SLIDE").length, 1);
});

test("intermediate slide spaces never resolve (l2 -> l1 -> l0 skips the event on l1)", () => {
  let s = started();
  const me = activePlayer(s).id;
  P(s, me).inventory = [];
  const coins = P(s, me).coins;
  s = land(s, "l2"); // origin coin, then the slide is performed
  assert.equal(P(s, me).currentNodeId, N("l0"));
  assert.equal(s.phase, "RESOLVE_TILE", "destination resolves on the next step");
  assert.ok(s.forcedMove.pending);
  assert.equal(s.blockedConnections.length, 0, "the event space in the middle did not run");
  s = advance(s, settings, () => 0.5);
  assert.equal(P(s, me).inventory.length, 1, "item space l0 resolved once");
  assert.equal(P(s, me).coins, coins + 3);
  assert.equal(s.phase, "TURN_END");
});

test("a forced arrival cannot chain another slide, warp or ride and clears its pending flag", () => {
  let s = started();
  const me = activePlayer(s).id;
  activePlayer(s).currentNodeId = N("l2"); // a slide origin reached by a forced move
  s.forcedMove = { sequence: 1, kind: "slide", playerId: me, fromNodeId: N("l3"), path: [N("l2")], pending: true };
  s.forcedMoveSeq = 1;
  s.phase = "RESOLVE_TILE";
  s = advance(s, settings, () => 0.5);
  assert.equal(P(s, me).currentNodeId, N("l2"), "no second slide");
  assert.equal(s.forcedMove.pending, false);
  assert.equal(s.phase, "TURN_END");
  // Same for a warp field reached that way.
  let w = started();
  activePlayer(w).currentNodeId = N("c5");
  w.forcedMove = { sequence: 1, kind: "slide", playerId: activePlayer(w).id, fromNodeId: N("c4"), path: [N("c5")], pending: true };
  w.phase = "RESOLVE_TILE";
  w = advance(w, settings, () => 0.5);
  assert.equal(activePlayer(w).currentNodeId, N("c5"));
});

test("the slide destination is a fixed forced path, so it can never trap a player or recurse", () => {
  for (const slide of mountain.slides) {
    let s = started();
    s = land(s, mountain.nodes.find((n) => n.id === slide.nodeId) && KEYS[Number(slide.nodeId.split("-")[1])]);
    let guard = 0;
    while (s.phase === "RESOLVE_TILE" && guard++ < 5) s = advance(s, settings, () => 0.5);
    assert.ok(guard < 5);
    assert.equal(activePlayer(s).currentNodeId, slide.path[1]);
    assert.ok(graphDistances(mountain, activePlayer(s).currentNodeId).size === 92);
  }
});

test("bots value a Frozen Slide space by where the slide really ends", () => {
  const s = started();
  const p = activePlayer(s);
  p.currentNodeId = N("l1");
  p.previousNodeId = N("b0");
  p.coins = 30;
  p.difficulty = "hard";
  s.phase = "PATH_SELECTION";
  s.movesRemaining = 1;
  s.plutoNodeIds = [N("l0")];
  const pick = botAction(s, mountain, () => 0, { ...settings, victory: "plutos" });
  // l0 (the Pluto itself) or l2 (slide ending on l0): the slide-aware score sees the Pluto at the end.
  assert.equal(pick.nodeId, N("l2"));
  assert.ok(legalPaths(s, mountain).includes(N("l0")), "the direct route exists too");
});

// ---- 7. map-specific fields -------------------------------------------------------------------------------
test("Mountain fields are themed but use the generic rules: Falling Rocks -5 HP, tunnel warp, Nothing field toast", () => {
  const rocks = land(started(), "k3");
  assert.equal(activePlayer(rocks).hp, RULES.hp - RULES.hazard);
  assert.match(rocks.log.join(" "), /falling rocks/);
  assert.equal(tilePresentationFor(mountain).hazard.label, "Falling rocks · lose 5 HP");
  assert.equal(tilePresentationFor(tropical).hazard.label, "Ember vent · lose 5 HP");

  const tunnel = land(started(), "m2");
  assert.equal(activePlayer(tunnel).currentNodeId, N("c5"));
  assert.equal(activePlayer(tunnel).previousNodeId, null);
  const back = land(started(), "c5");
  assert.equal(activePlayer(back).currentNodeId, N("m2"));

  const view = land(started(), "v0");
  assert.match(view.log.join(" "), /beautiful view/);
  assert.ok(view.events.some((e) => /BEAUTIFUL VIEW/.test(e.text)));
  assert.equal(activePlayer(view).coins, RULES.coins, "the Nothing field gives no reward");
});

test("Tropical warps still go to the next island", () => {
  const s = started(tropicalSettings);
  const warp = tropical.nodes.find((n) => n.type === "warp");
  s.players[0].currentNodeId = warp.id;
  s.phase = "RESOLVE_TILE";
  const after = advance(s, tropicalSettings, () => 0.5);
  assert.equal(after.players[0].currentNodeId, tropical.nodes.find((n) => n.region === (warp.region + 1) % 6).id);
});

// ---- 8. items, radiation, animals on Mountain ---------------------------------------------------------------
test("Comet Melon damage uses Mountain graph distance, not pixels", () => {
  let s = started();
  const me = activePlayer(s).id;
  const target = N("l3");
  const distances = graphDistances(mountain, target);
  // b3 is 1 step from l3 but far in pixels from l7, which is 4 steps away on the ring.
  P(s, "p1").currentNodeId = N("b3");
  P(s, "p2").currentNodeId = N("l7");
  P(s, "p3").currentNodeId = N("l4");
  const hp = Object.fromEntries(s.players.map((p) => [p.id, p.hp]));
  const id = give(s, me, "comet-melon");
  s = applyAction(s, me, { type: "USE_ITEM", itemInstanceId: id, targetNodeId: target }, settings, () => 0.5);
  for (const pid of ["p1", "p2", "p3"]) {
    const expected = cometMelonDamage(distances.get(P(s, pid).currentNodeId));
    assert.equal(hp[pid] - P(s, pid).hp, expected, pid);
  }
  assert.equal(hp.p1 - P(s, "p1").hp, 10);
  assert.equal(hp.p2 - P(s, "p2").hp, 0);
});

test("Fallout Core on Mountain blasts the target and its direct neighbours, KOs, irradiates and expires", () => {
  let s = started();
  const me = activePlayer(s).id;
  const center = N("l3");
  const blast = falloutBlastNodes(mountain, center);
  assert.deepEqual(blast.sort(), [center, ...mountain.nodes.find((n) => n.id === center).connections].sort());
  P(s, "p1").currentNodeId = N("b3");
  P(s, "p2").currentNodeId = N("l4");
  P(s, "p3").currentNodeId = N("l5"); // distance 2: safe
  const id = give(s, me, "fallout-core");
  s = applyAction(s, me, { type: "USE_ITEM", itemInstanceId: id, targetNodeId: center }, settings, () => 0.5);
  assert.equal(P(s, "p1").currentNodeId, mountain.start);
  assert.equal(P(s, "p2").currentNodeId, mountain.start);
  assert.notEqual(P(s, "p3").currentNodeId, mountain.start);
  assert.ok(P(s, "p1").statusEffects.some((e) => e.id === "radiation"));
  assert.deepEqual([...irradiatedNodeIds(s)].sort(), blast.sort());
  s.round = s.radiationZones[0].expiresAfterRound;
  s.phase = "ROUND_END";
  s.minigame = null;
  const after = advance(s, settings, () => 0.5, T0);
  assert.equal(after.radiationZones.length, 0);
});

test("Wild Totem animals hunt on the Mountain graph and never use the Cable Car", () => {
  let s = started();
  const me = activePlayer(s).id;
  for (const p of s.players) p.currentNodeId = N("v0");
  P(s, me).currentNodeId = N("f2");
  P(s, "p1").currentNodeId = N("k4"); // one Cable Car ride away, far on foot
  const walking = findShortestPath(mountain, N("f2"), N("k4")).length;
  assert.ok(walking > 8);
  const id = give(s, me, "wild-totem");
  s = applyAction(s, me, { type: "USE_ITEM", itemInstanceId: id }, settings, () => 0.99); // crocodile or cheetah
  const animal = s.animals[0];
  s.phase = "ANIMAL_PHASE";
  const after = advance(s, settings, () => 0.5, T0);
  const step = after.animalPhase.steps[0];
  assert.ok(step.path.length <= animal.movementPerPhase);
  assert.notEqual(after.animals[0].currentNodeId, N("k4"), "did not teleport to the target");
  let at = N("f2");
  for (const node of step.path) {
    assert.ok(mountain.nodes.find((n) => n.id === at).connections.includes(node));
    at = node;
  }
});

test("Duel Saber starts a normal duel on Mountain", () => {
  let s = started();
  const me = activePlayer(s).id;
  const id = give(s, me, "duel-saber");
  s = applyAction(
    s,
    me,
    { type: "USE_ITEM", itemInstanceId: id, targetPlayerId: "p1", wager: { type: "coins", amount: 5 } },
    settings,
    () => 0.5,
    T0,
  );
  assert.equal(s.phase, "DUEL_INTRO");
  assert.equal(s.duel.challengerPlayerId, me);
  assert.equal(s.mapId, "mountain");
});

test("Turbo Boots movement follows Mountain intersections with normal path choices", () => {
  let s = started();
  const me = activePlayer(s).id;
  const id = give(s, me, "turbo-boots");
  s = applyAction(s, me, { type: "USE_ITEM", itemInstanceId: id }, settings, () => 0);
  const bonus = s.turn.bonusMovement;
  s = applyAction(s, me, { type: "ROLL_DICE" }, settings, () => 0.5); // roll 5
  const total = 5 + bonus;
  assert.equal(s.movesRemaining, total);
  const rng = seeded(21);
  let steps = 0,
    sawChoice = false;
  while (s.phase !== "TURN_END" && s.phase !== "ITEM_REPLACE" && steps++ < 200) {
    if (s.phase === "PATH_SELECTION") {
      sawChoice = true;
      const options = legalPaths(s, mountain);
      s = applyAction(s, me, { type: "SELECT_PATH", nodeId: options[Math.floor(rng() * options.length)] }, settings, rng);
    } else s = advance(s, settings, rng, T0);
    const node = mountain.nodes.find((n) => n.id === P(s, me).currentNodeId);
    assert.ok(node);
  }
  assert.ok(s.phase === "TURN_END" || s.phase === "ITEM_REPLACE" || s.phase === "PLUTO_OFFER" || s.phase === "PROPERTY_OFFER" || s.phase === "TRANSPORT_OFFER" || s.phase === "RESOLVE_TILE");
  assert.ok(sawChoice || total < 4);
});

test("Scatterblaster range bands are read from Mountain graph distance", () => {
  let s = started();
  const me = activePlayer(s).id;
  P(s, me).currentNodeId = N("l3");
  P(s, "p1").currentNodeId = N("b3"); // 1 step
  P(s, "p2").currentNodeId = N("v0"); // far
  P(s, "p3").currentNodeId = N("v0");
  const id = give(s, me, "scatterblaster");
  const near = applyAction(s, me, { type: "USE_ITEM", itemInstanceId: id, targetPlayerId: "p1" }, settings, () => 0.5, T0);
  assert.equal(near.phase, "ITEM_AIM");
  assert.equal(near.turn.aim.band, "close");
  assert.throws(
    () => applyAction(s, me, { type: "USE_ITEM", itemInstanceId: id, targetPlayerId: "p2" }, settings, () => 0.5, T0),
    /range|reach/i,
  );
});

// ---- 9. map selection and authority --------------------------------------------------------------------------
test("settings validation accepts registered maps only and clients cannot smuggle a map through actions", () => {
  assert.ok(validSettings({ ...DEFAULT_SETTINGS, mapId: "mountain" }));
  assert.ok(validSettings({ ...DEFAULT_SETTINGS, mapId: "sunspill" }));
  assert.equal(validSettings({ ...DEFAULT_SETTINGS, mapId: "atlantis" }), false);
  assert.equal(validSettings({ ...DEFAULT_SETTINGS, mapId: 7 }), false);
  assert.throws(() => parseMessage({ type: "SETTINGS", settings: { ...DEFAULT_SETTINGS, mapId: "atlantis" } }));
  assert.equal(parseMessage({ type: "SETTINGS", settings: { ...DEFAULT_SETTINGS, mapId: "mountain" } }).settings.mapId, "mountain");
  const parsed = parseMessage({ type: "ACTION", action: { type: "ROLL_DICE", mapId: "mountain" } });
  assert.deepEqual(parsed.action, { type: "ROLL_DICE" });
  assert.deepEqual(
    parseMessage({ type: "ACTION", action: { type: "RIDE_TRANSPORT", transportId: "cable-car", destination: "x" } }).action,
    { type: "RIDE_TRANSPORT", transportId: "cable-car" },
  );
  assert.deepEqual(parseMessage({ type: "ACTION", action: { type: "DECLINE_TRANSPORT" } }).action, { type: "DECLINE_TRANSPORT" });
  assert.throws(() => createMatch(players(), { ...DEFAULT_SETTINGS, mapId: "atlantis" }, () => 0.5));
});

test("the host picks Mountain in the lobby; the server starts it, everyone sees it and settings lock once it runs", () => {
  const rooms = new PartyRooms();
  const hostMsgs = [],
    guestMsgs = [];
  const host = rooms.connect(undefined, (m) => hostMsgs.push(structuredClone(m)));
  const guest = rooms.connect(undefined, (m) => guestMsgs.push(structuredClone(m)));
  rooms.handle(host, { type: "CREATE", name: "Alps", playerName: "Host", public: true });
  const room = rooms.rooms.get(host.room);
  rooms.handle(guest, { type: "JOIN", code: room.code, playerName: "Guest" });
  assert.throws(
    () => rooms.handle(guest, { type: "SETTINGS", settings: { ...room.settings, mapId: "mountain" } }),
    /host/i,
  );
  assert.equal(room.settings.mapId, "sunspill");
  rooms.handle(host, { type: "SETTINGS", settings: { ...room.settings, mapId: "mountain" } });
  assert.equal(room.settings.mapId, "mountain");
  assert.ok(room.players.every((p) => !p.ready || p.isBot), "changing the map resets readiness");
  rooms.handle(host, { type: "READY", ready: true });
  rooms.handle(guest, { type: "READY", ready: true });
  rooms.handle(host, { type: "START" });
  for (const messages of [hostMsgs, guestMsgs]) {
    const match = messages.at(-1).lobby.match;
    assert.equal(match.mapId, "mountain");
    assert.equal(match.plutoNodeIds.length, 1);
    assert.ok(match.players.every((p) => p.currentNodeId === mountain.start));
    assert.equal(match.log.at(-1), mountain.flavor.welcome);
  }
  assert.throws(
    () => rooms.handle(host, { type: "SETTINGS", settings: { ...room.settings, mapId: "sunspill" } }),
    /locked/i,
  );
  assert.equal(mapOf(room.match), mountain);
  const listed = [];
  const watcher = rooms.connect(undefined, (m) => listed.push(m));
  rooms.handle(host, { type: "LEAVE" });
  rooms.handle(watcher, { type: "LIST", query: "" });
});

test("a Mountain room with bots plays through the server tick into round 2 and its first minigame", () => {
  const rooms = new PartyRooms();
  const host = rooms.connect(undefined, () => {});
  rooms.handle(host, { type: "CREATE", name: "Bot climb", playerName: "Host", public: true });
  const room = rooms.rooms.get(host.room);
  rooms.handle(host, { type: "SETTINGS", settings: { ...room.settings, mapId: "mountain", victory: "coins", coinTarget: 300 } });
  rooms.handle(host, { type: "READY", ready: true });
  rooms.handle(host, { type: "START" });
  // Turn the host into a bot so the tick drives the whole table.
  room.players.find((p) => p.id === host.id).isBot = true;
  room.players.forEach((p) => (p.isBot = true));
  room.match.players.forEach((p) => (p.isBot = true));
  const seen = new Set();
  let now = Date.now();
  for (let i = 0; i < 4000 && room.match.round < 2; i++) {
    now += 700;
    // The tick only runs rooms that still have a connected human.
    room.players[0].isBot = false;
    room.match.players[0].isBot = false;
    room.players[0].connected = true;
    // Human seat is auto-played by the test through the same bot logic.
    const active = activePlayer(room.match);
    if (active.id === room.players[0].id && room.match.phase !== "START_ROLL" && !["ANIMAL_PHASE", "MINIGAME_INTRO", "MINIGAME", "MINIGAME_RESULTS", "ROUND_END"].includes(room.match.phase)) {
      const action = botAction(room.match, mapOf(room.match), seeded(i + 1), room.settings, now);
      if (action) {
        try {
          room.match = applyAction(room.match, active.id, action, room.settings, seeded(i + 1), now);
        } catch {
          /* rejected -> tick continues */
        }
        room.players = room.match.players;
      }
    }
    rooms.tick(now);
    rooms.fastTick(now);
    seen.add(room.match.phase);
    if (room.match.phase === "MINIGAME") {
      const bots = stepMinigameBots(room.match, now, seeded(i + 2));
      room.match = bots.match;
    }
  }
  assert.ok(room.match.round >= 2, `round ${room.match.round}, phase ${room.match.phase}`);
  assert.ok(seen.has("MINIGAME_INTRO"));
  assert.equal(room.match.mapId, "mountain");
});

// ---- 10. whole-match simulations ----------------------------------------------------------------------------
test("seeded all-bot Mountain matches keep every invariant: legal movement, closures respected, one Pluto, no stuck players", () => {
  let rides = 0,
    slides = 0,
    avalanches = 0;
  for (const seed of [3, 7, 19]) {
    const rng = seeded(seed);
    const cfg = { ...settings, victory: "plutos", plutoTarget: 5 };
    let s = createMatch(players().map((p, i) => ({ ...p, difficulty: ["easy", "medium", "hard", "hard"][i], isBot: true })), cfg, rng);
    let now = T0,
      last = null;
    for (let i = 0; i < 12000 && s.phase !== "GAME_OVER" && s.round < 9; i++) {
      now += 700;
      const action = botAction(s, mountain, rng, cfg, now);
      const previous = s;
      s = action ? applyAction(s, activePlayer(s).id, action, cfg, rng, now) : stepMinigameBots(advance(s, cfg, rng, now), now, rng).match;
      // Movement: a step uses an open connection.
      if (action?.type === "SELECT_PATH" || (previous.phase === "MOVEMENT" && s.phase !== previous.phase)) {
        const before = previous.players.find((p) => p.id === activePlayer(previous).id).currentNodeId,
          after = s.players.find((p) => p.id === activePlayer(previous).id).currentNodeId;
        if (before !== after && previous.movesRemaining > s.movesRemaining) {
          assert.ok(mountain.nodes.find((n) => n.id === before).connections.includes(after));
          assert.ok(!activeRestrictions(previous).has(edgeKey(before, after)), "walked through a closed route");
        }
      }
      if (s.forcedMove && s.forcedMove.sequence !== last) {
        last = s.forcedMove.sequence;
        if (s.forcedMove.kind === "slide") slides++;
        else rides++;
      }
      avalanches = Math.max(avalanches, s.nextBlockNumber - 1);
      assert.equal(s.plutoNodeIds.length, 1);
      assert.ok(s.plutoNodeIds.every((id) => eligiblePlutoNodes(mountain).includes(id) || s.players.some((p) => p.currentNodeId === id)));
      assert.equal(new Set(s.plutoNodeIds).size, 1);
      assert.ok(isMapConnected(mountain, activeRestrictions(s)));
      for (const p of s.players) assert.ok(mountain.nodes.some((n) => n.id === p.currentNodeId));
      assert.ok(s.blockedConnections.every((b) => b.expiresAfterRound >= s.round));
    }
    assert.ok(s.round >= 4 || s.phase === "GAME_OVER", `seed ${seed} stalled at round ${s.round} phase ${s.phase}`);
  }
  assert.ok(slides + rides + avalanches > 0, "the Mountain mechanics were exercised");
});

test("resolveTile stays usable directly for a Mountain landing (public API unchanged)", () => {
  const s = started();
  activePlayer(s).currentNodeId = N("v1");
  const coins = activePlayer(s).coins;
  resolveTile(s, mountain, () => 0.5);
  assert.equal(activePlayer(s).coins, coins + 3);
});
