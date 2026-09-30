import test from "node:test";
import assert from "node:assert/strict";
import { ANIMAL_PHASE_FLOW, DEFAULT_SETTINGS } from "../src/games/party/config.ts";
import { tropical } from "../src/games/party/content/maps.ts";
import {
  activePlayer,
  advance,
  applyAction,
  createMatch,
  createPlayer,
  legalPaths,
} from "../src/games/party/engine/engine.ts";
import { botAction } from "../src/games/party/engine/bots.ts";
import {
  edgeKey,
  findShortestPath,
  graphDistances,
} from "../src/games/party/engine/graph.ts";
import { createItemInstance } from "../src/games/party/items/inventory.ts";
import {
  chooseAnimalTarget,
  runAnimalPhase,
  summonAnimal,
} from "../src/games/party/animals/runtime.ts";
import { createRadiationZone } from "../src/games/party/hazards/radiation.ts";
import { stepMinigameBots } from "../src/games/party/minigames/flow.ts";

const settings = { ...DEFAULT_SETTINGS, victory: "coins", coinTarget: 300 };
const players = () =>
  Array.from({ length: 4 }, (_, i) => createPlayer(`p${i}`, `Player ${i}`, i));
const seeded = (seed) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
function started() {
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
const T0 = 7_000_000;
const connected = (a, b) => tropical.nodes.find((n) => n.id === a).connections.includes(b);
// Board with everyone parked far away on region 3 unless moved.
function board(positions = {}) {
  const s = started();
  for (const p of s.players) p.currentNodeId = positions[p.id] ?? "space-30";
  return s;
}
function withAnimal(s, owner, type, nodeId) {
  return summonAnimal(s, owner, type, nodeId);
}

// ---------- Pathfinding ----------
test("findShortestPath returns a shortest legal path consistent with graph distances", () => {
  for (const [from, to] of [["space-0", "space-5"], ["space-0", "space-33"], ["space-12", "space-57"]]) {
    const path = findShortestPath(tropical, from, to);
    assert.equal(path.length, graphDistances(tropical, from).get(to));
    assert.equal(path.at(-1), to);
    [from, ...path].slice(1).forEach((node, i) => assert.ok(connected([from, ...path][i], node)));
  }
  assert.deepEqual(findShortestPath(tropical, "space-3", "space-3"), []);
});

test("equal-length paths tie-break deterministically by map connection order", () => {
  // space-0 → space-5: two 5-step routes around the ring; the first declared connection (space-1) wins.
  const path = findShortestPath(tropical, "space-0", "space-5");
  assert.deepEqual(path, ["space-1", "space-2", "space-3", "space-4", "space-5"]);
  for (let i = 0; i < 5; i++) assert.deepEqual(findShortestPath(tropical, "space-0", "space-5"), path);
});

test("route restrictions are respected and unreachable or unknown targets are handled safely", () => {
  const open = findShortestPath(tropical, "space-0", "space-15");
  assert.deepEqual(open, ["space-15"]);
  const blocked = new Set([edgeKey("space-0", "space-15")]);
  const detour = findShortestPath(tropical, "space-0", "space-15", blocked);
  assert.ok(detour.length > 1);
  [["space-0"], detour].flat().forEach((node, i, all) => {
    if (i) assert.ok(!blocked.has(edgeKey(all[i - 1], node)));
  });
  assert.equal(graphDistances(tropical, "space-0", Infinity, blocked).get("space-15"), detour.length);
  const island = new Set(tropical.nodes.find((n) => n.id === "space-3").connections.map((c) => edgeKey("space-3", c)));
  assert.equal(findShortestPath(tropical, "space-0", "space-3", island), null);
  assert.equal(findShortestPath(tropical, "space-0", "space-404"), null);
  assert.equal(findShortestPath(tropical, "nowhere", "space-1"), null);
});

// ---------- Wild Totem ----------
test("Wild Totem: the server rolls the animal, spawns it on the owner's space and consumes the item", () => {
  for (const [roll, type, movement, damage] of [[0, "cheetah", 5, 10], [0.99, "crocodile", 2, 20]]) {
    const s = board({ p0: "space-12" });
    const item = give(s, "p0", "wild-totem");
    const after = applyAction(s, "p0", { type: "USE_ITEM", itemInstanceId: item }, settings, () => roll, T0);
    assert.ok(!P(after, "p0").inventory.some((i) => i.instanceId === item));
    assert.deepEqual(after.animals, [
      {
        id: "animal-1",
        type,
        ownerPlayerId: "p0",
        currentNodeId: "space-12",
        remainingRounds: 15,
        movementPerPhase: movement,
        damage,
        sequence: 1,
      },
    ]);
    assert.equal(after.phase, "ITEM_PHASE");
    assert.ok(after.events.some((e) => e.kind === "ANIMAL_SUMMONED" && e.text.includes(type.toUpperCase())));
  }
});

test("Wild Totem is only usable in the owner's item phase before rolling", () => {
  const s = board();
  const item = give(s, "p0", "wild-totem");
  const rolled = applyAction(s, "p0", { type: "ROLL_DICE" }, settings, () => 0.5, T0);
  assert.throws(
    () => applyAction(rolled, "p0", { type: "USE_ITEM", itemInstanceId: item }, settings, () => 0, T0),
    /before you roll/,
  );
  const other = give(s, "p1", "wild-totem");
  assert.throws(
    () => applyAction(s, "p1", { type: "USE_ITEM", itemInstanceId: other }, settings, () => 0, T0),
    /Wait for your turn/,
  );
});

test("an owner with an active animal cannot summon another; the item is kept", () => {
  const s = board();
  withAnimal(s, "p0", "crocodile", "space-30");
  const item = give(s, "p0", "wild-totem");
  assert.throws(
    () => applyAction(s, "p0", { type: "USE_ITEM", itemInstanceId: item }, settings, () => 0, T0),
    /You already have an active summoned animal\./,
  );
  assert.ok(P(s, "p0").inventory.some((i) => i.instanceId === item));
  // Other players may each own one.
  const theirs = give(s, "p1", "wild-totem");
  s.turnIndex = 1;
  const after = applyAction(s, "p1", { type: "USE_ITEM", itemInstanceId: theirs }, settings, () => 0, T0);
  assert.equal(after.animals.length, 2);
});

test("bots never try Wild Totem while they already own an animal", () => {
  for (const difficulty of ["easy", "medium", "hard"])
    for (let seed = 1; seed <= 10; seed++) {
      const s = board();
      s.players.forEach((p) => {
        p.isBot = true;
        p.difficulty = difficulty;
      });
      withAnimal(s, "p0", "cheetah", "space-30");
      give(s, "p0", "wild-totem");
      assert.deepEqual(botAction(s, tropical, seeded(seed), settings, T0), { type: "ROLL_DICE" });
    }
  // Medium always summons when it can.
  const s = board();
  s.players.forEach((p) => (p.isBot = true));
  give(s, "p0", "wild-totem");
  assert.equal(botAction(s, tropical, seeded(1), settings, T0).type, "USE_ITEM");
});

// ---------- Cheetah / Crocodile ----------
test("Cheetah targets the nearest non-owner player, moves up to 5 legal nodes and hits for 10", () => {
  // Owner p0 next to the cheetah; p1 is 7 away, p2 and p3 13 away.
  const s = board({ p0: "space-1", p1: "space-44" });
  const cheetah = withAnimal(s, "p0", "cheetah", "space-0");
  assert.equal(chooseAnimalTarget(s, tropical, cheetah).playerId, "p1");
  runAnimalPhase(s, tropical, T0);
  const step = s.animalPhase.steps[0];
  assert.equal(step.targetPlayerId, "p1");
  assert.equal(step.path.length, 5);
  ["space-0", ...step.path].forEach((node, i, all) => i && assert.ok(connected(all[i - 1], node)));
  assert.equal(s.animals[0].currentNodeId, step.path.at(-1));
  assert.equal(P(s, "p1").hp, 20, "not reached yet");
  runAnimalPhase(s, tropical, T0 + 10_000);
  assert.equal(P(s, "p1").hp, 10);
  assert.equal(s.animals[0].currentNodeId, "space-44", "stops on its target's space");
  assert.equal(P(s, "p0").hp, 20);
});

test("Crocodile moves 2 nodes and deals 20 through the normal KO path", () => {
  const s = board({ p0: "space-30", p1: "space-3", p2: "space-44", p3: "space-44" });
  P(s, "p1").coins = 9;
  const bank = s.bank;
  withAnimal(s, "p0", "crocodile", "space-0");
  runAnimalPhase(s, tropical, T0);
  assert.deepEqual(s.animalPhase.steps[0].path, ["space-1", "space-2"]);
  assert.equal(P(s, "p1").hp, 20);
  runAnimalPhase(s, tropical, T0);
  assert.deepEqual(s.animalPhase.steps[0].hits, [{ playerId: "p1", nodeId: "space-3", damage: 20, knockedOut: true }]);
  // KO: 5 coins to the bank, respawn at Start with 20 HP.
  assert.equal(P(s, "p1").coins, 4);
  assert.equal(s.bank, bank + 5);
  assert.equal(P(s, "p1").currentNodeId, tropical.start);
  assert.equal(P(s, "p1").hp, 20);
});

test("animals never damage their owner, even when passing through or sharing the owner's space", () => {
  const s = board({ p0: "space-1", p1: "space-3", p2: "space-44", p3: "space-44" });
  withAnimal(s, "p0", "cheetah", "space-1");
  runAnimalPhase(s, tropical, T0);
  assert.equal(P(s, "p0").hp, 20);
  assert.equal(P(s, "p1").hp, 10);
  assert.ok(s.animalPhase.steps[0].hits.every((h) => h.playerId !== "p0"));
});

test("contact hits every valid occupant of an entered space, but each player at most once per phase", () => {
  // The cheetah starts on p2's space (10 HP): p2 is hit and KO'd to Start (space-0). It then hunts the
  // nearest player not yet hit, p1 on space-15, via space-0: p2 stands there now but is not hit again.
  const s = board({ p1: "space-15", p2: "space-1", p3: "space-15" });
  P(s, "p2").hp = 10;
  withAnimal(s, "p0", "cheetah", "space-1");
  runAnimalPhase(s, tropical, T0);
  const step = s.animalPhase.steps[0];
  assert.deepEqual(step.path, ["space-0", "space-15"]);
  assert.deepEqual(
    step.hits.map((h) => [h.playerId, h.nodeId]),
    [["p2", "space-1"], ["p1", "space-15"], ["p3", "space-15"]],
  );
  assert.equal(P(s, "p2").hp, 20, "respawned once, not hit again at Start");
  assert.equal(P(s, "p2").currentNodeId, "space-0");
  assert.equal(P(s, "p1").hp, 10);
  assert.equal(P(s, "p3").hp, 10);
});

test("ties go to the earlier seat and target choice is recalculated every phase", () => {
  const s = board({ p0: "space-44", p1: "space-3", p2: "space-7", p3: "space-44" });
  const croc = withAnimal(s, "p0", "crocodile", "space-5");
  assert.equal(chooseAnimalTarget(s, tropical, croc).playerId, "p1");
  P(s, "p2").currentNodeId = "space-6";
  assert.equal(chooseAnimalTarget(s, tropical, croc).playerId, "p2");
});

test("animals respect blocked routes when choosing and following paths", () => {
  const s = board({ p0: "space-44", p1: "space-15", p2: "space-44", p3: "space-44" });
  withAnimal(s, "p0", "cheetah", "space-0");
  const blocked = new Set([edgeKey("space-0", "space-15")]);
  runAnimalPhase(s, tropical, T0, blocked);
  const path = s.animalPhase.steps[0].path;
  assert.ok(!path.includes("space-15") || path.length > 1);
  ["space-0", ...path].forEach((node, i, all) => {
    if (i) {
      assert.ok(connected(all[i - 1], node));
      assert.ok(!blocked.has(edgeKey(all[i - 1], node)));
    }
  });
  assert.equal(P(s, "p1").hp, 20);
});

test("animals do not trigger fields, Plutos, properties, warps or radiation", () => {
  const s = board({ p0: "space-44", p1: "space-10", p2: "space-44", p3: "space-44" });
  // Path space-0 → 15 → 14 → 13 → 12 → 11: coin, hazard, deposit, item and coin spaces.
  createRadiationZone(s, "p1", ["space-15", "space-14"]);
  s.plutoNodeIds = ["space-14", "space-40"];
  const before = structuredClone(s);
  withAnimal(s, "p0", "cheetah", "space-0");
  runAnimalPhase(s, tropical, T0);
  assert.equal(s.animals[0].currentNodeId, "space-11");
  assert.deepEqual(s.plutoNodeIds, before.plutoNodeIds);
  assert.deepEqual(s.properties, before.properties);
  assert.equal(s.bank, before.bank);
  assert.equal(s.nextItemNumber, before.nextItemNumber);
  assert.deepEqual(s.players, before.players);
  assert.deepEqual(Object.keys(s.animals[0]).sort(), ["currentNodeId", "damage", "id", "movementPerPhase", "ownerPlayerId", "remainingRounds", "sequence", "type"]);
});

test("animals are processed in creation order, lifetime drops once per phase and expired animals despawn", () => {
  const s = board({ p0: "space-44", p1: "space-3", p2: "space-44", p3: "space-44" });
  P(s, "p1").hp = 25;
  const cheetah = withAnimal(s, "p2", "cheetah", "space-5");
  const croc = withAnimal(s, "p0", "crocodile", "space-4");
  s.animals.reverse(); // storage order must not matter
  croc.remainingRounds = 1;
  runAnimalPhase(s, tropical, T0);
  assert.deepEqual(s.animalPhase.steps.map((st) => st.animalId), [cheetah.id, croc.id]);
  // Cheetah first (-10 → 15), then crocodile (-20 → KO).
  assert.equal(s.animalPhase.steps[0].hits[0].damage, 10);
  assert.equal(s.animalPhase.steps[1].hits[0].knockedOut, true);
  assert.deepEqual(s.animals.map((a) => [a.id, a.remainingRounds]), [[cheetah.id, 14]]);
  assert.equal(s.animalPhase.steps[1].despawned, true);
  assert.ok(s.events.some((e) => e.kind === "ANIMAL_DESPAWNED" && e.text === "PLAYER 0'S CROCODILE DESPAWNED"));
});

test("a summoned animal lives through exactly 15 Animal Phases", () => {
  const s = board();
  withAnimal(s, "p0", "cheetah", "space-0");
  let phases = 0;
  while (s.animals.length) {
    runAnimalPhase(s, tropical, T0 + phases);
    phases++;
    assert.ok(phases <= 15);
  }
  assert.equal(phases, 15);
});

// ---------- Animal Phase in the round flow ----------
function lastTurnEnded() {
  const s = board({ p0: "space-44", p1: "space-3", p2: "space-44", p3: "space-44" });
  s.turnIndex = 3;
  s.phase = "TURN_END";
  return s;
}
test("last board turn → Animal Phase (all animals processed) → minigame intro afterwards", () => {
  const s = lastTurnEnded();
  withAnimal(s, "p0", "crocodile", "space-5");
  withAnimal(s, "p2", "cheetah", "space-50");
  const animal = advance(s, settings, seeded(1), T0);
  assert.equal(animal.phase, "ANIMAL_PHASE");
  assert.equal(animal.animalPhase, null);
  const resolved = advance(animal, settings, seeded(1), T0);
  assert.equal(resolved.phase, "ANIMAL_PHASE");
  assert.equal(resolved.minigame, null, "no minigame before the animals finish");
  assert.equal(resolved.animalPhase.steps.length, 2);
  assert.equal(resolved.animalPhase.endsAt, T0 + ANIMAL_PHASE_FLOW.baseMs + 2 * ANIMAL_PHASE_FLOW.perAnimalMs);
  assert.deepEqual(resolved.animals.map((a) => a.remainingRounds), [14, 14]);
  // Waiting ticks change nothing (no second move, no second lifetime tick).
  assert.equal(advance(resolved, settings, seeded(1), T0 + 500), resolved);
  const intro = advance(resolved, settings, seeded(1), resolved.animalPhase.endsAt);
  assert.equal(intro.phase, "MINIGAME_INTRO");
  assert.equal(intro.animalPhase, null);
  assert.deepEqual(intro.animals.map((a) => a.remainingRounds), [14, 14]);
  assert.equal(intro.round, 1);
});

test("board actions are rejected during the Animal Phase", () => {
  const s = lastTurnEnded();
  withAnimal(s, "p0", "crocodile", "space-5");
  const resolved = advance(advance(s, settings, seeded(1), T0), settings, seeded(1), T0);
  assert.throws(
    () => applyAction(resolved, activePlayer(resolved).id, { type: "ROLL_DICE" }, settings, () => 0, T0),
    /paused/,
  );
});

test("the normal victory check still runs after the Animal Phase", () => {
  const s = lastTurnEnded();
  withAnimal(s, "p0", "crocodile", "space-5");
  P(s, "p3").coins = settings.coinTarget; // e.g. reached by an earlier rule
  const resolved = advance(advance(s, settings, seeded(1), T0), settings, seeded(1), T0);
  const done = advance(resolved, settings, seeded(1), resolved.animalPhase.endsAt);
  assert.equal(done.phase, "GAME_OVER");
  assert.equal(done.winner, "p3");
});

test("Wild Totem animals wait for the next Animal Phase before moving", () => {
  let s = board({ p0: "space-5", p1: "space-3" });
  s = applyAction(s, "p0", { type: "USE_ITEM", itemInstanceId: give(s, "p0", "wild-totem") }, settings, () => 0, T0);
  s = applyAction(s, "p0", { type: "ROLL_DICE" }, settings, () => 0, T0); // roll 0: no move
  for (let i = 0; i < 5 && s.phase !== "ITEM_PHASE"; i++) s = advance(s, settings, () => 0, T0);
  assert.equal(activePlayer(s).id, "p1");
  assert.equal(s.animals[0].currentNodeId, "space-5");
  assert.equal(P(s, "p1").hp, 20);
});

// ---------- Bots and hazards ----------
function forkState(difficulty) {
  // p0 at space-0 coming from space-15, one move left: choose space-1 (coin) or space-9 (event).
  const s = board({ p0: "space-0" });
  P(s, "p0").previousNodeId = "space-15";
  P(s, "p0").isBot = true;
  P(s, "p0").difficulty = difficulty;
  s.phase = "PATH_SELECTION";
  s.movesRemaining = 1;
  s.plutoNodeIds = ["space-40", "space-50"];
  return s;
}
const pickRate = (difficulty, prepare, choice = "space-1", runs = 300) => {
  let hits = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const s = forkState(difficulty);
    prepare(s);
    const action = botAction(s, tropical, seeded(seed * 13), settings, T0);
    assert.ok(legalPaths(s, tropical).includes(action.nodeId));
    if (action.nodeId === choice) hits++;
  }
  return hits / runs;
};
test("bots avoid irradiated landings more often at higher difficulty, but it is never forbidden", () => {
  const irradiate = (s) => createRadiationZone(s, "p3", ["space-1"]);
  const clean = pickRate("hard", () => {});
  const easy = pickRate("easy", irradiate),
    medium = pickRate("medium", irradiate),
    hard = pickRate("hard", irradiate);
  assert.ok(clean > 0.9, `hard prefers the coin space when clean (${clean})`);
  assert.ok(easy > medium && medium >= hard, `easy ${easy} medium ${medium} hard ${hard}`);
  assert.ok(hard < 0.05);
  assert.ok(easy > 0.2);
});

test("hard bots chase a Pluto through radiation in Pluto mode", () => {
  const plutoSettings = { ...DEFAULT_SETTINGS, victory: "plutos" };
  let hits = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const s = forkState("hard");
    createRadiationZone(s, "p3", ["space-1"]);
    s.plutoNodeIds = ["space-1", "space-40"];
    P(s, "p0").coins = 25;
    if (botAction(s, tropical, seeded(seed), plutoSettings, T0).nodeId === "space-1") hits++;
  }
  assert.ok(hits > 90, `${hits}`);
});

test("bots steer away from spaces near hostile animals, but ignore their own", () => {
  // Crocodile on space-3: the coin fork (space-1) is 2 away, the other fork (space-9) is 4 away.
  const near = (s) => withAnimal(s, "p2", "crocodile", "space-3");
  assert.ok(pickRate("hard", near) < pickRate("easy", near));
  assert.ok(pickRate("hard", near) < 0.1);
  const own = (s) => withAnimal(s, "p0", "crocodile", "space-3");
  assert.ok(pickRate("hard", own) > 0.9);
});

test("seeded all-bot matches with rare items keep every animal move legal and every invariant intact", () => {
  for (const seed of [5, 21, 64]) {
    const rng = seeded(seed);
    let s = createMatch(players().map((p) => ({ ...p, isBot: true })), settings, rng);
    let now = 0,
      phases = 0,
      summons = 0,
      blasts = 0;
    for (let step = 0; step < 30_000 && s.phase !== "GAME_OVER" && s.round < 6; step++) {
      now += 100;
      const active = activePlayer(s);
      if (s.phase === "ITEM_PHASE" && !s.turn.usedItemThisTurn && active.inventory.length === 0)
        give(s, active.id, ["fallout-core", "wild-totem", "pocket-duel"][Math.floor(rng() * 3)]);
      const before = s;
      const action = botAction(s, tropical, rng, settings, now);
      s = action
        ? applyAction(s, active.id, action, settings, rng, now)
        : stepMinigameBots(advance(s, settings, rng, now), now, rng).match;
      if (s.radiationZones.length > before.radiationZones.length) blasts++;
      if (s.animals.length > before.animals.length) summons++;
      if (s.animalPhase && s.animalPhase !== before.animalPhase && !before.animalPhase) {
        phases++;
        for (const st of s.animalPhase.steps)
          [st.fromNodeId, ...st.path].forEach((node, i, all) => i && assert.ok(connected(all[i - 1], node)));
      }
      for (const p of s.players) {
        assert.ok(p.hp > 0 && p.hp <= p.maxHp && p.coins >= 0);
        assert.ok(p.statusEffects.filter((e) => e.id === "radiation").length <= 1);
        assert.ok(s.animals.filter((a) => a.ownerPlayerId === p.id).length <= 1);
      }
    }
    assert.ok(phases >= 1 && summons >= 1 && blasts >= 1, `seed ${seed}: ${phases} phases, ${summons} summons, ${blasts} blasts`);
  }
});
