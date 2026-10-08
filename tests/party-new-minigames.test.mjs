import { startMinigame, DEFAULT_SETTINGS } from "./helpers/party-legacy-fixtures.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { arrowMemory, arrowCount, DIRECTIONS, quadrantOrigin } from "../src/games/party/minigames/arrowMemory/index.ts";
import { pickupArena, ARENA_BOT_PROFILES } from "../src/games/party/minigames/pickupArena/index.ts";
import { streetRunnerTarget, smoothStreetRunner } from "../src/games/party/minigames/streetCross/presentation.ts";
import { STREET_CROSS_CONFIG } from "../src/games/party/minigames/streetCross/config.ts";
import { ARENA_MAPS, obstructionDistance, collides } from "../src/games/party/minigames/pickupArena/maps.ts";
import { minigameRegistry } from "../src/games/party/minigames/index.ts";
import { applyMinigameInput, finishMinigame, publicMinigameView } from "../src/games/party/minigames/flow.ts";
import { createMatch, createPlayer } from "../src/games/party/engine/engine.ts";

import { parseMessage } from "../src/games/party/network/protocol.ts";
import { PartyRooms } from "../server/party/rooms.ts";

const seeded = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const participants = ["a", "b", "c", "d"].map((id) => ({ id, isBot: false, difficulty: "medium" }));
function create(def, map = 0, seed = 10) {
  const rng = seeded(seed); let first = true;
  return def.create({ participants, startedAt: 0, endsAt: def.durationSeconds * 1000,
    random: () => { if (first) { first = false; return map; } return rng(); } });
}
const control = (fields = {}) => ({ type: "ARENA_CONTROL", forward: 0, strafe: 0, yaw: 0, pitch: 0, fire: false, ...fields });
function memoryMove(state, id, direction = state.sequences[id][state.step]) {
  const input = { type: "MEMORY_STEP", direction, round: state.round, step: state.step };
  arrowMemory.applyInput(state, id, arrowMemory.parseInput(input), state.phaseEndsAt - 1000);
}

test("both new games enter the main pool and independently randomize maps", () => {
  for (const id of ["arrow-memory", "pickup-arena"]) assert.ok(minigameRegistry.pool("main").some((d) => d.id === id));
  assert.equal(create(arrowMemory, 0).map, "ice"); assert.equal(create(arrowMemory, 0.99).map, "hell");
  assert.equal(create(pickupArena, 0).map, "arcade"); assert.equal(create(pickupArena, 0.99).map, "city");
  assert.deepEqual(create(arrowMemory), create(arrowMemory));
});
test("memory arrow progression matches every requested boundary and keeps growing", () => {
  assert.deepEqual(Array.from({ length: 13 }, (_, i) => arrowCount(i + 1)), [3, 4, 4, 5, 5, 5, 6, 6, 6, 6, 7, 8, 9]);
  assert.equal(arrowCount(30), 26);
});
test("memory stays within 10x10, hides recall answers, restores tiles and advances difficulty", () => {
  const s = create(arrowMemory);
  while (s.level < 3) {
    if (s.phase === "memorize") {
      const view = arrowMemory.publicView(s, s.startedAt, "a");
      assert.equal(view.sequence.length, arrowCount(s.round));
      assert.equal(view.safe, null); assert.equal(view.path, undefined); assert.equal(view.seed, undefined); assert.equal(view.bots, undefined);
      assert.equal(view.paths, undefined); assert.equal(view.sequences, undefined);
      assert.equal(new Set(Object.values(s.sequences).map((arrows) => arrows.join())).size, 4);
      for (const [id, p] of Object.entries(s.players)) {
        const origin = quadrantOrigin(p.quadrant);
        assert.ok(s.paths[id].every((tile) => tile.x >= origin.x && tile.x < origin.x + 5 && tile.z >= origin.z && tile.z < origin.z + 5));
        assert.equal(p.x, origin.x + 2); assert.equal(p.z, origin.z + 2);
      }
    }
    arrowMemory.tick(s, s.phaseEndsAt);
    if (s.phase === "move") {
      assert.deepEqual(arrowMemory.publicView(s, s.phaseEndsAt - 1).sequence, []);
      assert.equal(arrowMemory.publicView(s, 0).safe, null);
      for (const { id } of participants) memoryMove(s, id);
      arrowMemory.tick(s, s.phaseEndsAt);
      assert.equal(s.phase, "hazard");
      for (const { id } of participants) assert.deepEqual(s.safe[id], s.paths[id][s.step]);
      assert.ok(Object.values(s.players).every((p) => p.alive));
      arrowMemory.tick(s, s.phaseEndsAt); assert.equal(s.phase, "restore");
    }
  }
  assert.equal(s.level, 3); assert.ok(s.players.a.totalSteps >= 7); assert.equal(s.players.a.score, 0);
});
test("memory rejects extra steps, stale round packets and input outside recall", () => {
  const s = create(arrowMemory);
  assert.throws(() => memoryMove(s, "a")); arrowMemory.tick(s, s.phaseEndsAt);
  memoryMove(s, "a"); const snapshot = structuredClone(s);
  assert.throws(() => memoryMove(s, "a")); assert.deepEqual(s, snapshot);
  assert.throws(() => arrowMemory.applyInput(s, "b", { type: "MEMORY_STEP", direction: "left", round: 99, step: 0 }, s.phaseEndsAt - 500));
  assert.equal(arrowMemory.parseInput({ type: "MEMORY_STEP", direction: "teleport", round: 1, step: 0 }), null);
  assert.equal(arrowMemory.parseInput({ type: "MEMORY_STEP", direction: "left", round: NaN, step: 0 }), null);
});
test("memory exposes only the viewer's arrows and masks opponents until the hazard", () => {
  const s = create(arrowMemory);
  assert.deepEqual(arrowMemory.publicView(s, 0).sequence, []);
  for (const { id } of participants) assert.deepEqual(arrowMemory.publicView(s, 0, id).sequence, s.sequences[id]);
  arrowMemory.tick(s, s.phaseEndsAt);
  const before = arrowMemory.publicView(s, 0, "b").players.a;
  memoryMove(s, "a");
  assert.deepEqual(arrowMemory.publicView(s, 0, "b").players.a, before);
  assert.equal(arrowMemory.publicView(s, 0, "a").players.a.moved, true);
  assert.deepEqual(arrowMemory.publicView(s, 0, "b").sequence, []);
  for (const id of ["b", "c", "d"]) memoryMove(s, id);
  arrowMemory.tick(s, s.phaseEndsAt);
  assert.deepEqual(arrowMemory.publicView(s, 0, "b").players.a, s.players.a);
  assert.deepEqual(arrowMemory.publicView(s, 0, "b").safe, s.safe);
});
test("memory rejects crossing the divider into another player's quadrant", () => {
  const s = create(arrowMemory); arrowMemory.tick(s, s.phaseEndsAt);
  for (const [id, p] of Object.entries(s.players)) {
    const origin = quadrantOrigin(p.quadrant);
    for (const [x, z, direction] of [[origin.x, origin.z + 2, "left"], [origin.x + 4, origin.z + 2, "right"], [origin.x + 2, origin.z, "up"], [origin.x + 2, origin.z + 4, "down"]]) {
      Object.assign(p, { x, z, moved: false });
      assert.throws(() => memoryMove(s, id, direction), /quadrant/);
      assert.equal(p.moved, false); assert.equal(p.x, x); assert.equal(p.z, z);
    }
  }
});
test("ice and hell award 3/2/1 points in exactly three survival rounds and reset everyone", () => {
  for (const map of [0, 0.99]) {
    const s = create(arrowMemory, map);
    for (let heat = 1; heat <= 3; heat++) {
      assert.equal(s.heat, heat); assert.equal(s.level, 1); assert.ok(Object.values(s.players).every((p) => p.alive));
      arrowMemory.tick(s, s.phaseEndsAt);
      memoryMove(s, "a"); memoryMove(s, "b", DIRECTIONS.find((d) => d !== s.sequences.b[0]));
      arrowMemory.tick(s, s.phaseEndsAt);
      assert.equal(s.players.a.alive, true); assert.equal(s.players.b.alive, false); assert.equal(s.players.c.alive, false);
      assert.equal(s.players.a.score, (heat - 1) * 3); assert.equal(s.phase, "hazard"); assert.throws(() => memoryMove(s, "b"));
      arrowMemory.tick(s, s.phaseEndsAt);
      assert.equal(s.players.a.score, heat * 3); assert.equal(s.heatResults.at(-1).ranking[0], "a");
      assert.deepEqual(Object.values(s.heatResults.at(-1).points).sort(), [0, 1, 2, 3]);
      if (heat < 3) { assert.equal(s.phase, "intermission"); arrowMemory.tick(s, s.phaseEndsAt); }
    }
    assert.equal(arrowMemory.isFinished(s), true); assert.equal(s.heatResults.length, 3);
    assert.equal(arrowMemory.rank(s, ["a", "b", "c", "d"], seeded(2))[0], "a");
  }
});
test("memory bots recall imperfect visible sequences and bot matches finish without stalling", () => {
  let correct = 0;
  for (const seed of [4, 8, 15, 16]) {
    const rng = seeded(seed), s = create(arrowMemory, 0, seed);
    for (let now = 100; now < 3_600_000 && !arrowMemory.isFinished(s); now += 100) {
      arrowMemory.tick(s, now);
      for (const [i, p] of participants.entries()) for (const { input, at } of arrowMemory.botInputs(s, { ...p, isBot: true, difficulty: i === 0 ? "easy" : "hard" }, now, rng)) {
        try { arrowMemory.applyInput(s, p.id, arrowMemory.parseInput(input), at); } catch { /* a mistaken recollection can leave the grid */ }
      }
    }
    assert.ok(arrowMemory.isFinished(s)); correct += Math.max(...Object.values(s.players).map((p) => p.score));
    assert.equal(s.heatResults.length, 3); assert.ok(s.heatResults.some((r) => r.ranking.length === 4));
  }
  assert.ok(correct > 10);
});
test("shooter starts unarmed, validates bounded intent, and strips forged outcomes", () => {
  const s = create(pickupArena);
  assert.ok(Object.values(s.players).every((p) => p.weapon === null && p.hp === 100 && !p.kills));
  const parsed = parseMessage({ type: "ACTION", action: { type: "MINIGAME_INPUT", input: control(), score: 999 } });
  assert.deepEqual(parsed.action.input, control());
  assert.equal(pickupArena.parseInput(control({ forward: 2 })), null);
  assert.equal(pickupArena.parseInput(control({ yaw: Infinity })), null);
  assert.equal(pickupArena.parseInput(control({ fire: "yes" })), null);
  assert.equal(pickupArena.parseInput({ type: "KILL", playerId: "b" }), null);
  assert.equal(pickupArena.publicView(s, 0).controls, undefined); assert.equal(pickupArena.publicView(s, 0).bots, undefined);
  assert.ok(JSON.stringify(pickupArena.publicView(s, 0)).includes('"lastShotAt":-10000'));
});
test("pickups equip knives and guns, consume availability, replenish ammo, and reappear in ten seconds", () => {
  const s = create(pickupArena, 0.99), map = ARENA_MAPS[s.map];
  const knife = map.pickups.findIndex((p) => p.weapon === "knife"); Object.assign(s.players.a, map.pickups[knife]);
  pickupArena.tick(s, 50); assert.equal(s.players.a.weapon, "knife"); assert.equal(s.players.a.ammo, -1);
  assert.equal(s.pickups[knife].availableAt, 10050);
  assert.throws(() => pickupArena.applyInput(s, "a", { type: "ARENA_PICKUP" }, 100));
  const rifle = map.pickups.findIndex((p) => p.weapon === "rifle"); Object.assign(s.players.a, map.pickups[rifle]);
  pickupArena.applyInput(s, "a", { type: "ARENA_PICKUP" }, 100); assert.equal(s.players.a.weapon, "rifle"); assert.equal(s.players.a.ammo, 40);
  Object.assign(s.players.b, map.pickups[knife]); pickupArena.tick(s, 10100); assert.equal(s.players.b.weapon, "knife");
});
test("authoritative fire awards exactly one kill, consumes ammo, limits cadence and respawns unarmed", () => {
  const s = create(pickupArena, 0.99);
  Object.assign(s.players.a, { x: 0, y: 0, z: 0, protectedUntil: 0, weapon: "pistol", ammo: 18 });
  Object.assign(s.players.b, { x: 0, y: 0, z: -5, protectedUntil: 0 });
  pickupArena.applyInput(s, "a", control({ fire: true, pitch: -0.13 }), 0); pickupArena.tick(s, 100);
  assert.equal(s.players.b.hp, 66); assert.equal(s.players.a.ammo, 17);
  assert.equal(s.hits[0].damage, 34); assert.equal(s.hits[0].hpAfter, 66);
  pickupArena.tick(s, 300); assert.equal(s.players.b.hp, 66);
  for (const at of [400, 800]) { pickupArena.applyInput(s, "a", control({ fire: true, pitch: -0.13 }), at); pickupArena.tick(s, at + 50); }
  assert.equal(s.players.a.kills, 1); assert.equal(s.players.b.deaths, 1); assert.equal(s.players.b.hp, 0);
  assert.equal(s.feed.length, 1); assert.equal(pickupArena.scores(s).a, 3);
  assert.equal(s.hits.at(-1).damage, 32); assert.equal(s.hits.at(-1).hpAfter, 0);
  assert.equal(pickupArena.publicView(s, 850).hits.at(-1).victim, "b");
  pickupArena.tick(s, s.players.b.respawnAt); assert.equal(s.players.b.hp, 100); assert.equal(s.players.b.weapon, null);
  assert.equal(s.players.b.ammo, 0); assert.ok(s.players.b.protectedUntil > s.simTime); assert.equal(s.players.a.kills, 1);
  assert.deepEqual(s.hits, []);
});
test("both maps offer knife, shotgun and Desert Eagle; the Eagle deals 50 damage per confirmed shot", () => {
  for (const map of Object.values(ARENA_MAPS)) for (const weapon of ["knife", "shotgun", "desert-eagle"]) assert.ok(map.pickups.some((p) => p.weapon === weapon));
  const s = create(pickupArena, 0.99), eagle = ARENA_MAPS.city.pickups.findIndex((p) => p.weapon === "desert-eagle");
  Object.assign(s.players.a, ARENA_MAPS.city.pickups[eagle]); pickupArena.tick(s, 50);
  assert.equal(s.players.a.weapon, "desert-eagle"); assert.equal(s.players.a.ammo, 7);
  Object.assign(s.players.a, { x: 0, y: 0, z: 0, protectedUntil: 0 });
  Object.assign(s.players.b, { x: 0, y: 0, z: -5, protectedUntil: 0 });
  pickupArena.applyInput(s, "a", control({ fire: true, pitch: -0.13 }), 50); pickupArena.tick(s, 100);
  assert.equal(s.players.b.hp, 50); assert.equal(s.hits[0].damage, 50); assert.equal(s.players.a.ammo, 6);
  pickupArena.applyInput(s, "a", control({ fire: true, pitch: -0.13 }), 750); pickupArena.tick(s, 800);
  assert.equal(s.players.b.hp, 0); assert.equal(s.players.a.kills, 1);
});
test("weapons cannot hit through city cover, between arcade floors, outside knife range, or through spawn shields", () => {
  const s = create(pickupArena, 0.99);
  Object.assign(s.players.a, { x: -12, y: 0, z: 0, weapon: "rifle", ammo: 40, protectedUntil: 0 });
  Object.assign(s.players.b, { x: 0, y: 0, z: 0, protectedUntil: 0 });
  pickupArena.applyInput(s, "a", control({ yaw: Math.PI / 2, fire: true }), 0); pickupArena.tick(s, 300);
  assert.equal(s.players.b.hp, 100);
  assert.ok(obstructionDistance(ARENA_MAPS.arcade, { x: 0, y: 1.55, z: 0 }, { x: 0, y: 1, z: 0 }) < 3);
  Object.assign(s.players.a, { x: 0, y: 0, z: 0, weapon: "knife", ammo: -1 });
  Object.assign(s.players.b, { x: 0, y: 0, z: -4 });
  pickupArena.applyInput(s, "a", control({ fire: true, pitch: -0.13 }), 400); pickupArena.tick(s, 500); assert.equal(s.players.b.hp, 100);
  s.players.b.z = -2; s.players.b.protectedUntil = 5000;
  pickupArena.applyInput(s, "a", control({ fire: true, pitch: -0.13 }), 1000); pickupArena.tick(s, 1050); assert.equal(s.players.b.hp, 100);
  assert.deepEqual(s.hits, []);
  s.players.b.protectedUntil = 0;
  pickupArena.applyInput(s, "a", control({ fire: true, pitch: -0.13 }), 1600); pickupArena.tick(s, 1650); assert.equal(s.players.b.hp, 45);
});
test("shooter bots allow reaction time and pause between bursts on every difficulty", () => {
  for (const difficulty of ["easy", "medium", "hard"]) {
    const s = create(pickupArena, 0.99), bot = { ...participants[0], isBot: true, difficulty };
    Object.assign(s.players.a, { x: 0, y: 0, z: 0, protectedUntil: 0, weapon: "pistol", ammo: 18 });
    Object.assign(s.players.b, { x: 0, y: 0, z: -5, protectedUntil: 0 }); s.players.c.hp = s.players.d.hp = 0;
    const shots = [];
    for (let now = 0; now <= 5000; now += 150) {
      const input = pickupArena.botInputs(s, bot, now, () => 0.5)[0]?.input;
      if (input?.fire) shots.push(now);
    }
    const profile = ARENA_BOT_PROFILES[difficulty];
    assert.ok(shots.length >= 2); assert.ok(shots[0] >= profile.reactionMs);
    for (let i = 1; i < shots.length; i++) assert.ok(shots[i] - shots[i - 1] >= profile.shotPauseMs);
  }
});

test("Street Cross predicts normalized movement, respects stuns and caps stale snapshots", () => {
  const runner = { x: 4, y: 4.5, dx: 1, dy: 1, hits: 0, finishedAt: null, stunnedUntil: 0 };
  const target = streetRunnerTarget(runner, 1000, 1100);
  assert.ok(Math.abs(Math.hypot(target.x - runner.x, target.y - runner.y) - STREET_CROSS_CONFIG.player.speed * .1) < 1e-9);
  assert.deepEqual(streetRunnerTarget(runner, 1000, 5000), streetRunnerTarget(runner, 1000, 1150));
  runner.stunnedUntil = 1080;
  assert.deepEqual(streetRunnerTarget(runner, 1000, 1070), { x: 4, y: 4.5 });
  const recovery = streetRunnerTarget(runner, 1000, 1100);
  assert.ok(Math.abs(Math.hypot(recovery.x - 4, recovery.y - 4.5) - STREET_CROSS_CONFIG.player.speed * .02) < 1e-9);
  runner.finishedAt = 1100;
  assert.deepEqual(streetRunnerTarget(runner, 1000, 1150), { x: 4, y: 4.5 });
});
test("Street Cross blends snapshot corrections without delaying checkpoint hits or finishes", () => {
  const runner = { hits: 0, finishedAt: null }, previous = { x: 4, y: 5, ...runner }, target = { x: 4, y: 5.2 };
  const display = smoothStreetRunner(previous, runner, target, 1 / 60);
  assert.ok(display.y > 5 && display.y < 5.2);
  assert.deepEqual(smoothStreetRunner(display, { hits: 1, finishedAt: null }, { x: 4, y: 4.5 }, 1 / 60), { x: 4, y: 4.5, hits: 1, finishedAt: null });
  assert.deepEqual(smoothStreetRunner(display, { hits: 0, finishedAt: 1000 }, target, 1 / 60), { ...target, hits: 0, finishedAt: 1000 });
});
test("movement stops on missing heartbeat, normalizes diagonals and cannot tunnel through cover", () => {
  const s = create(pickupArena, 0.99);
  Object.assign(s.players.a, { x: 0, y: 0, z: 0 });
  pickupArena.applyInput(s, "a", control({ forward: 1, strafe: 1 }), 0); pickupArena.tick(s, 1000);
  assert.ok(Math.hypot(s.players.a.x, s.players.a.z) <= 2.11);
  const position = { x: s.players.a.x, z: s.players.a.z }; pickupArena.tick(s, 2000);
  assert.deepEqual({ x: s.players.a.x, z: s.players.a.z }, position);
  Object.assign(s.players.a, { x: -11, y: 0, z: 0 });
  for (let now = 2100; now < 5100; now += 100) { pickupArena.applyInput(s, "a", control({ strafe: 1 }), now); pickupArena.tick(s, now + 100); }
  assert.ok(s.players.a.x < -7.5); assert.equal(collides(ARENA_MAPS.city, s.players.a.x, s.players.a.y, s.players.a.z), false);
});
test("the arcade has three reachable floors connected by four climbable and descendable stairs", () => {
  const map = ARENA_MAPS.arcade; assert.equal(map.floors, 3); assert.equal(map.stairs.length, 4);
  for (const stair of map.stairs) {
    const s = create(pickupArena);
    Object.assign(s.players.a, { x: stair.x, y: stair.base, z: stair.z - stair.length / 2 - 1 });
    for (let now = 0; now < 1700; now += 100) { pickupArena.applyInput(s, "a", control({ forward: -1 }), now); pickupArena.tick(s, now + 100); }
    assert.equal(s.players.a.y, stair.base + stair.rise, `climb at ${stair.x}, ${stair.base}`);
    for (let now = 1700; now < 3400; now += 100) { pickupArena.applyInput(s, "a", control({ forward: 1 }), now); pickupArena.tick(s, now + 100); }
    assert.equal(s.players.a.y, stair.base, `descend at ${stair.x}, ${stair.base}`);
  }
});
test("shooter bots find weapons and score through validated controls on both maps", () => {
  for (const choice of [0, 0.99]) {
    const s = create(pickupArena, choice), rng = seeded(7);
    for (let now = 100; now < 40000; now += 100) {
      pickupArena.tick(s, now);
      for (const p of participants) for (const { input, at } of pickupArena.botInputs(s, { ...p, isBot: true, difficulty: "hard" }, now, rng)) {
        const parsed = pickupArena.parseInput(input); assert.ok(parsed);
        pickupArena.applyInput(s, p.id, parsed, at);
      }
    }
    assert.ok(Object.values(s.players).some((p) => p.kills > 0), `${s.map}: bots scored`);
    assert.equal(Object.values(s.players).reduce((n, p) => n + p.kills, 0), Object.values(s.players).reduce((n, p) => n + p.deaths, 0));
  }
});
test("shooter bots can pursue an opponent through both flights to the third floor", () => {
  const s = create(pickupArena), rng = seeded(5);
  Object.assign(s.players.a, { x: 13, y: 0, z: -11, weapon: "knife", ammo: -1, protectedUntil: 0 });
  Object.assign(s.players.b, { x: 13, y: 8, z: 12, protectedUntil: 0 });
  s.players.c.hp = s.players.d.hp = 0;
  let highest = 0;
  for (let now = 100; now < 20000; now += 100) {
    pickupArena.tick(s, now); highest = Math.max(highest, s.players.a.y);
    for (const { input, at } of pickupArena.botInputs(s, { ...participants[0], isBot: true, difficulty: "hard" }, now, rng))
      pickupArena.applyInput(s, "a", pickupArena.parseInput(input), at);
  }
  assert.ok(highest >= 7.5, `bot reached height ${highest}`);
});
test("new minigames integrate with main rewards, public snapshots and server phase validation", () => {
  for (const def of [arrowMemory, pickupArena]) {
    const m = createMatch(participants.map((p, i) => createPlayer(p.id, p.id, i)), DEFAULT_SETTINGS, seeded(1));
    m.order = participants.map((p) => p.id); startMinigame(m, def.id, seeded(3), 0);
    assert.throws(() => applyMinigameInput(m, "a", def === arrowMemory ? { type: "MEMORY_STEP", direction: "left", round: 1, step: 0 } : control(), m.minigame.startedAt));
    const view = publicMinigameView(m.minigame, 0); assert.equal(view.state.bots, undefined);
    m.minigame.status = "ACTIVE"; m.phase = "MINIGAME";
    finishMinigame(m, seeded(1), m.minigame.endsAt);
    assert.equal(new Set(m.minigame.results.map((p) => p.playerId)).size, 4);
    assert.equal(Object.values(m.minigame.rewards).reduce((a, b) => a + b), 18);
    assert.equal(m.phase, "MINIGAME_RESULTS");
  }
});

test("room memory snapshots and reconnects contain each session's own challenge only", () => {
  const rooms = new PartyRooms(), aMessages = [], bMessages = [];
  const a = rooms.connect(undefined, (m) => aMessages.push(structuredClone(m)));
  const b = rooms.connect(undefined, (m) => bMessages.push(structuredClone(m)));
  rooms.handle(a, { type: "CREATE", name: "Private quadrants", playerName: "A", public: true });
  rooms.handle(b, { type: "JOIN", code: a.room, playerName: "B" });
  rooms.handle(a, { type: "READY", ready: true }); rooms.handle(b, { type: "READY", ready: true });
  rooms.handle(a, { type: "START" });
  const room = rooms.rooms.get(a.room), now = Date.now(); room.match.order = room.match.players.map((p) => p.id);
  startMinigame(room.match, arrowMemory.id, seeded(3), now - 7000);
  room.match.phase = "MINIGAME"; room.match.minigame.status = "ACTIVE"; rooms.broadcast(room, now);
  const state = room.match.minigame.state;
  const view = (messages) => messages.at(-1).lobby.match.minigame.state;
  assert.deepEqual(view(aMessages).sequence, state.sequences[a.id]);
  assert.deepEqual(view(bMessages).sequence, state.sequences[b.id]);
  assert.notDeepEqual(view(aMessages).sequence, view(bMessages).sequence);
  assert.equal(view(bMessages).sequences, undefined); assert.equal(view(bMessages).paths, undefined);
  rooms.disconnect(b); const resumed = []; rooms.connect(b.token, (m) => resumed.push(structuredClone(m)));
  assert.deepEqual(view(resumed).sequence, state.sequences[b.id]);
  arrowMemory.tick(state, state.phaseEndsAt); memoryMove(state, a.id);
  rooms.broadcast(room, state.phaseEndsAt - 500);
  assert.equal(view(aMessages).players[a.id].moved, true); assert.equal(view(resumed).players[a.id].moved, false);
  assert.deepEqual({ x: view(resumed).players[a.id].x, z: view(resumed).players[a.id].z }, state.safe[a.id]);
});

test("room authority broadcasts new games, hides recall paths, and restores shooter scores on reconnect", () => {
  const rooms = new PartyRooms(), messages = [];
  const host = rooms.connect(undefined, (m) => messages.push(structuredClone(m)));
  rooms.handle(host, { type: "CREATE", name: "New minigames", playerName: "Host", public: true });
  rooms.handle(host, { type: "READY", ready: true }); rooms.handle(host, { type: "START" });
  const room = rooms.rooms.get(host.room), now = Date.now();
  room.match.order = room.match.players.map((p) => p.id);
  startMinigame(room.match, arrowMemory.id, seeded(3), now - 7000);
  room.match.phase = "MINIGAME"; room.match.minigame.status = "ACTIVE";
  rooms.fastTick(now + 1100);
  const memory = messages.at(-1).lobby.match.minigame.state;
  assert.equal(memory.map, "ice"); assert.equal(memory.sequence.length, 3);
  assert.equal(memory.path, undefined); assert.equal(memory.seed, undefined); assert.equal(memory.bots, undefined);
  startMinigame(room.match, pickupArena.id, () => 0.99, now - 7000);
  room.match.phase = "MINIGAME"; room.match.minigame.status = "ACTIVE";
  const s = room.match.minigame.state, victim = room.match.players.find((p) => p.id !== host.id).id;
  Object.assign(s.players[host.id], { x: 0, y: 0, z: 0, weapon: "pistol", ammo: 18, protectedUntil: 0 });
  Object.assign(s.players[victim], { x: 0, y: 0, z: -5, hp: 34, protectedUntil: 0 });
  rooms.handle(host, { type: "ACTION", action: { type: "MINIGAME_INPUT", input: control({ fire: true, pitch: -0.13 }) } });
  rooms.fastTick(now + 100);
  assert.equal(room.match.minigame.state.players[host.id].kills, 1);
  const network = messages.at(-1).lobby.match.minigame;
  assert.equal(network.state.map, "city"); assert.equal(network.state.controls, undefined); assert.equal(network.state.bots, undefined);
  rooms.disconnect(host);
  const restored = []; rooms.connect(host.token, (m) => restored.push(structuredClone(m)));
  const state = restored.find((m) => m.type === "STATE").lobby.match.minigame;
  assert.equal(state.state.players[host.id].kills, 1); assert.equal(state.endsAt, room.match.minigame.endsAt);
});
