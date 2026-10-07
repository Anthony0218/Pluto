import test from "node:test";
import assert from "node:assert/strict";
import { circleShot, shotOverlap, CIRCLE_SHOT_WINDOW, CIRCLE_SHOT_FLIGHT } from "../src/games/party/minigames/circleShot/index.ts";
import { lavaKnockback, HELL_ISLANDS, onHellIsland, PUNCH_COOLDOWN } from "../src/games/party/minigames/lavaKnockback/index.ts";
import { minigameRegistry } from "../src/games/party/minigames/index.ts";
import { applyMinigameInput, startMinigame, publicMinigameView, finishMinigame } from "../src/games/party/minigames/flow.ts";
import { createMatch, createPlayer } from "../src/games/party/engine/engine.ts";
import { DEFAULT_SETTINGS } from "../src/games/party/config.ts";
import { parseMessage } from "../src/games/party/network/protocol.ts";

const participants = ["a", "b", "c", "d"].map((id, avatarId) => ({ id, avatarId, isBot: false, difficulty: "medium" }));
const rng = (seed = 4) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const make = (def) => def.create({ participants, random: rng(), startedAt: 0, endsAt: def.durationSeconds * 1000 });
const control = (fields = {}) => ({ type: "KNOCKBACK_CONTROL", x: 0, z: 0, yaw: 0, punch: false, jump: false, ...fields });
function fight(s) {
  Object.assign(s.players.a, { x: 0, z: 0, y: 0 });
  Object.assign(s.players.b, { x: 0, z: -1.5, y: 0, vx: 0, vz: 0 });
  Object.assign(s.players.c, { x: -10, z: 0 }); Object.assign(s.players.d, { x: 10, z: 0 });
}

test("both games are selectable main games with bot controllers", () => {
  for (const def of [circleShot, lavaKnockback]) {
    assert.ok(minigameRegistry.pool("main").includes(def)); assert.ok(def.supportsBots); assert.ok(def.botInputs);
  }
});
test("timing scoring uses actual equal-circle area: 0%, 80% × 3, and 100%", () => {
  assert.equal(shotOverlap(0), 1); assert.equal(shotOverlap(CIRCLE_SHOT_WINDOW), 0);
  assert.equal(shotOverlap(70), shotOverlap(-70));
  let low = 0, high = CIRCLE_SHOT_WINDOW;
  for (let i = 0; i < 60; i++) { const mid = (low + high) / 2; if (shotOverlap(mid) > .8) low = mid; else high = mid; }
  const s = make(circleShot), circle = s.circles[0]; circle.value = 3;
  circleShot.applyInput(s, "a", { type: "CIRCLE_SHOOT", circleId: circle.id }, circle.at + (low + high) / 2);
  assert.ok(Math.abs(s.players.a.score - 2.4) < 1e-10);
  circleShot.applyInput(s, "b", { type: "CIRCLE_SHOOT", circleId: circle.id }, circle.at);
  assert.equal(s.players.b.score, 3);
});
test("all four quadrants see the same current circle; at most one can be falling per seat", () => {
  const s = make(circleShot);
  for (let i = 1; i < s.circles.length; i++) assert.ok(s.circles[i].at - CIRCLE_SHOT_FLIGHT > s.circles[i - 1].at + CIRCLE_SHOT_WINDOW);
  const view = circleShot.publicView(s, s.circles[0].at);
  assert.equal(Object.keys(view.players).length, 4);
  for (const p of Object.values(view.players)) assert.deepEqual(p.circle, s.circles[0]);
  assert.equal(view.circles, undefined); assert.equal(view.bots, undefined);
  assert.ok(s.circles.some((c) => c.value === 1)); assert.ok(s.circles.some((c) => c.value === 3));
});
test("a shot consumes one circle, misses expire, and duplicate or forged inputs cannot change scores", () => {
  const s = make(circleShot), circle = s.circles[0];
  circleShot.applyInput(s, "a", { type: "CIRCLE_SHOOT", circleId: circle.id }, circle.at - 600);
  assert.equal(s.players.a.score, 0); assert.equal(s.players.a.misses, 1);
  const copy = structuredClone(s);
  assert.throws(() => circleShot.applyInput(s, "a", { type: "CIRCLE_SHOOT", circleId: circle.id }, circle.at));
  assert.deepEqual(s, copy);
  circleShot.tick(s, circle.at + CIRCLE_SHOT_WINDOW);
  assert.equal(s.players.b.misses, 1); assert.equal(s.players.b.next, 1);
  assert.equal(circleShot.parseInput({ type: "CIRCLE_SHOOT", circleId: NaN }), null);
  assert.deepEqual(circleShot.parseInput({ type: "CIRCLE_SHOOT", circleId: 1, score: 100000 }), { type: "CIRCLE_SHOOT", circleId: 1 });
  assert.ok(Object.values(circleShot.publicView(s, circle.at + CIRCLE_SHOT_WINDOW).players).every((p) => p.circle === null));
});
test("timing bots hit with imperfect accuracy for every difficulty", () => {
  for (const difficulty of ["easy", "medium", "hard"]) {
    const s = make(circleShot), random = rng(72), bot = { ...participants[0], isBot: true, difficulty };
    for (let now = 0; now < s.endsAt; now += 50) {
      circleShot.tick(s, now);
      for (const { input, at } of circleShot.botInputs(s, bot, now, random)) circleShot.applyInput(s, bot.id, input, at);
    }
    assert.ok(s.players.a.score > 0); assert.ok(s.players.a.score < s.circles.reduce((sum, c) => sum + c.value, 0));
  }
});
test("hell has varied-size islands and every spawn starts safe with 200 HP", () => {
  assert.ok(new Set(HELL_ISLANDS.map((i) => i.radius)).size >= 3);
  const s = make(lavaKnockback);
  for (const p of Object.values(s.players)) { assert.equal(p.hp, 200); assert.ok(onHellIsland(p.x, p.z)); }
});
test("fists deal exactly 10 HP with knockback, a cooldown, and no multi-victim damage", () => {
  const s = make(lavaKnockback); fight(s);
  lavaKnockback.applyInput(s, "a", control({ punch: true }), 0); lavaKnockback.tick(s, 20);
  assert.equal(s.players.b.hp, 190); assert.ok(s.players.b.vz < -8);
  assert.equal(s.players.a.hits, 1); assert.equal(s.hits[0].damage, 10);
  lavaKnockback.tick(s, 100); assert.equal(s.players.b.hp, 190);
  assert.equal(s.players.c.hp, 200); assert.equal(s.players.d.hp, 200);
});
test("punches obey distance, facing and height, with no guns or forged damage", () => {
  for (const fields of [{ z: -5 }, { z: 1.5 }, { y: 2 }]) {
    const s = make(lavaKnockback); fight(s); Object.assign(s.players.b, fields);
    lavaKnockback.applyInput(s, "a", control({ punch: true }), 0); lavaKnockback.tick(s, 20);
    assert.equal(s.players.b.hp, 200); assert.equal(s.hits.length, 0);
  }
  assert.equal(lavaKnockback.parseInput({ type: "ARENA_PICKUP" }), null);
  for (const fields of [{ x: 2 }, { yaw: Infinity }, { z: NaN }, { punch: "yes" }]) assert.equal(lavaKnockback.parseInput(control(fields)), null);
  assert.deepEqual(lavaKnockback.parseInput(control({ damage: 999, hp: 999 })), control());
});
test("lava permanently eliminates even full-health players; late controls cannot revive them", () => {
  const s = make(lavaKnockback); Object.assign(s.players.a, { x: 24, z: 0 });
  lavaKnockback.tick(s, 1000);
  assert.equal(s.players.a.reason, "lava"); assert.equal(s.players.a.hp, 0); assert.ok(s.players.a.eliminatedAt > 0);
  const copy = structuredClone(s); assert.throws(() => lavaKnockback.applyInput(s, "a", control(), 1100)); assert.deepEqual(s, copy);
  lavaKnockback.tick(s, 10000); assert.equal(s.players.a.hp, 0); assert.equal(s.players.a.eliminatedAt, copy.players.a.eliminatedAt);
});
test("twenty fist hits exhaust 200 HP and eliminate without a respawn", () => {
  const s = make(lavaKnockback);
  for (let i = 0; i < 20; i++) {
    lavaKnockback.tick(s, s.simTime + PUNCH_COOLDOWN); fight(s);
    lavaKnockback.applyInput(s, "a", control({ punch: true }), s.simTime); lavaKnockback.tick(s, s.simTime + 20);
  }
  assert.equal(s.players.b.hp, 0); assert.equal(s.players.b.reason, "hp"); assert.equal(s.players.a.hits, 20);
});
test("movement normalizes diagonals, times out, and held Jump cannot jump again in midair", () => {
  const s = make(lavaKnockback); fight(s);
  lavaKnockback.applyInput(s, "a", control({ x: 1, z: 1, jump: true }), 0); lavaKnockback.tick(s, 100);
  assert.ok(Math.abs(Math.hypot(s.players.a.x, s.players.a.z) - .48) < 1e-8); assert.ok(s.players.a.y > 0);
  const vy = s.players.a.vy;
  lavaKnockback.applyInput(s, "a", control({ jump: true }), 100); lavaKnockback.tick(s, 200); assert.ok(s.players.a.vy < vy);
  lavaKnockback.tick(s, 1000); assert.equal(s.players.a.y, 0); assert.ok(s.players.a.grounded);
  const before = s.players.a.x; lavaKnockback.tick(s, 1400); assert.equal(s.players.a.x, before);
});
test("physics catches up in fixed steps; eliminated players rank by survival and survivor wins", () => {
  const s = make(lavaKnockback); fight(s); lavaKnockback.applyInput(s, "a", control({ x: 1 }), 0);
  const other = structuredClone(s); lavaKnockback.tick(s, 1000);
  for (let at = 20; at <= 1000; at += 20) lavaKnockback.tick(other, at);
  assert.deepEqual(s.players, other.players);
  Object.assign(s.players.b, { x: 30 }); lavaKnockback.tick(s, 2000);
  Object.assign(s.players.c, { x: 30 }); lavaKnockback.tick(s, 3000);
  Object.assign(s.players.d, { x: 30 }); lavaKnockback.tick(s, 4000);
  assert.ok(lavaKnockback.isFinished(s)); assert.deepEqual(lavaKnockback.rank(s, participants.map((p) => p.id), rng()), ["a", "d", "c", "b"]);
});
test("all-bot hell matches end with meaningful combat across difficulties", () => {
  for (const difficulty of ["easy", "medium", "hard"]) {
    const s = make(lavaKnockback), random = rng(71);
    for (let at = 0; at < s.endsAt && !lavaKnockback.isFinished(s); at += 100) {
      lavaKnockback.tick(s, at);
      for (const bot of participants) for (const action of lavaKnockback.botInputs(s, { ...bot, difficulty, isBot: true }, at, random)) lavaKnockback.applyInput(s, bot.id, action.input, action.at);
    }
    assert.ok(Object.values(s.players).some((p) => p.hits > 0));
    assert.ok(Object.values(s.players).some((p) => p.eliminatedAt !== null));
    const view = lavaKnockback.publicView(s); assert.equal(view.bots, undefined); assert.equal(view.controls, undefined);
    view.players.a.hp = 999; assert.notEqual(s.players.a.hp, 999);
  }
});
test("both minigames accept protocol intent and use normal rankings and rewards exactly once", () => {
  for (const def of [circleShot, lavaKnockback]) {
    const m = createMatch(participants.map((p, i) => createPlayer(p.id, p.id, i)), DEFAULT_SETTINGS, rng()); m.order = participants.map((p) => p.id);
    startMinigame(m, def.id, rng(), -7000); m.minigame.status = "ACTIVE"; m.phase = "MINIGAME";
    const s = m.minigame.state;
    const at = def === circleShot ? s.circles[0].at : s.startedAt + 100;
    const input = def === circleShot ? { type: "CIRCLE_SHOOT", circleId: 0 } : control({ x: 1 });
    const parsed = parseMessage({ type: "ACTION", action: { type: "MINIGAME_INPUT", input } }); assert.ok(parsed);
    const next = applyMinigameInput(m, "a", parsed.action.input, at);
    assert.equal(publicMinigameView(next.minigame, at).state.bots, undefined);
    const before = next.players.map((p) => p.coins); finishMinigame(next, rng(), s.endsAt);
    assert.deepEqual(next.players.map((p, i) => p.coins - before[i]).sort((a, b) => a - b), [0, 3, 5, 10]);
    const coins = next.players.map((p) => p.coins); finishMinigame(next, rng(), s.endsAt + 100); assert.deepEqual(next.players.map((p) => p.coins), coins);
  }
});
