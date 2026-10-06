import test from "node:test";
import assert from "node:assert/strict";
import { patternWall, patternLength, PATTERN_BEAT } from "../src/games/party/minigames/patternWall/index.ts";
import { rhythmRush, circleOverlap, RHYTHM_WINDOW } from "../src/games/party/minigames/rhythm/index.ts";
import { trailRun, TRAIL_MAPS, TRAIL_FINISH } from "../src/games/party/minigames/trailRun/index.ts";
import { pickupArena, collectSupplies, moveArenaPlayer } from "../src/games/party/minigames/pickupArena/index.ts";
import { ARENA_MAPS, WEAPONS, collides } from "../src/games/party/minigames/pickupArena/maps.ts";
import { minigameRegistry } from "../src/games/party/minigames/index.ts";
import { applyMinigameInput, publicMinigameView, startMinigame } from "../src/games/party/minigames/flow.ts";
import { createPlayer, createMatch } from "../src/games/party/engine/engine.ts";
import { DEFAULT_SETTINGS } from "../src/games/party/config.ts";
import { parseMessage } from "../src/games/party/network/protocol.ts";
const participants = ["a", "b", "c", "d"].map((id) => ({ id, isBot: false, difficulty: "medium" }));
const rng = (seed = 4) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const make = (def, random = rng()) => def.create({ participants, random, startedAt: 0, endsAt: def.durationSeconds * 1000 });
const control = (fields = {}) => ({ type: "ARENA_CONTROL", forward: 0, strafe: 0, yaw: 0, pitch: 0, fire: false, ...fields });

test("main pool contains all seven games and never picks Target Panic", () => {
  const ids = minigameRegistry.pool("main").map((d) => d.id);
  assert.deepEqual(ids, ["arrow-memory", "pickup-arena", "pattern-wall", "trail-run", "rhythm-rush", "circle-shot", "lava-knockback"]);
  assert.equal(minigameRegistry.get("target-panic").selectable, false);
});
test("Echo Wall follows all difficulty boundaries", () => {
  assert.deepEqual(Array.from({ length: 11 }, (_, i) => patternLength(i + 1)), [3, 4, 4, 5, 5, 5, 5, 6, 7, 8, 9]);
});
test("wall broadcasts only the currently lit square and keeps recall/order and other taps private", () => {
  const s = make(patternWall);
  const first = patternWall.publicView(s, 700, "a"), blank = patternWall.publicView(s, 1250, "b");
  assert.equal(first.lit, s.pattern[0]); assert.equal(blank.lit, null);
  assert.equal(first.pattern, undefined); assert.equal(first.seed, undefined); assert.equal(first.bots, undefined);
  assert.equal(patternWall.publicView(s, 700 + PATTERN_BEAT, "b").lit, s.pattern[1]);
  patternWall.tick(s, s.phaseEndsAt); const at = s.phaseStartedAt + 200;
  patternWall.applyInput(s, "a", { type: "PATTERN_TAP", tile: s.pattern[0], round: 1, step: 0 }, at);
  assert.equal(patternWall.publicView(s, at, "a").players.a.flashed, s.pattern[0]);
  assert.equal(patternWall.publicView(s, at, "b").players.a.flashed, null);
  assert.equal(patternWall.publicView(s, at, "a").lit, null);
});
test("wall rejects duplicates, wrong rounds and impossible squares; errors cannot rewrite scores", () => {
  const s = make(patternWall); patternWall.tick(s, s.phaseEndsAt); const at = s.phaseStartedAt + 100;
  const input = { type: "PATTERN_TAP", tile: s.pattern[0], round: 1, step: 0 };
  patternWall.applyInput(s, "a", input, at);
  const copy = structuredClone(s); assert.throws(() => patternWall.applyInput(s, "a", input, at + 100)); assert.deepEqual(s, copy);
  assert.equal(patternWall.parseInput({ ...input, tile: 9 }), null); assert.equal(patternWall.parseInput({ ...input, step: Infinity }), null);
  patternWall.applyInput(s, "b", { ...input, tile: (s.pattern[0] + 1) % 9 }, at);
  assert.equal(s.players.b.alive, false); assert.equal(s.players.b.score, 0);
});
test("wall grows after all players finish, and stops when nobody survives", () => {
  const s = make(patternWall); patternWall.tick(s, s.phaseEndsAt);
  for (const { id } of participants) for (let step = 0; step < s.pattern.length; step++) patternWall.applyInput(s, id, { type: "PATTERN_TAP", tile: s.pattern[step], round: s.round, step }, s.phaseStartedAt + 200 + step * 200);
  patternWall.tick(s, s.phaseStartedAt + 1000); assert.equal(s.phase, "break");
  patternWall.tick(s, s.phaseEndsAt); assert.equal(s.round, 2); assert.equal(s.pattern.length, 4);
  patternWall.tick(s, s.phaseEndsAt); patternWall.tick(s, s.phaseEndsAt); patternWall.tick(s, s.phaseEndsAt);
  assert.ok(patternWall.isFinished(s)); assert.ok(Object.values(s.players).every((p) => p.score === 3));
});
test("rhythm scores the exact circle intersection and note value, including 80% × 3", () => {
  assert.equal(circleOverlap(0), 1); assert.equal(circleOverlap(RHYTHM_WINDOW), 0); assert.equal(circleOverlap(-70), circleOverlap(70));
  let low = 0, high = RHYTHM_WINDOW;
  for (let i = 0; i < 60; i++) { const mid = (low + high) / 2; if (circleOverlap(mid) > .8) low = mid; else high = mid; }
  const s = make(rhythmRush), note = s.notes[0]; note.value = 3;
  rhythmRush.applyInput(s, "a", { type: "RHYTHM_TAP", lane: note.lane }, note.at + (low + high) / 2);
  assert.ok(Math.abs(s.players.a.score - 2.4) < .0001);
  assert.ok(Math.abs(s.players.a.last.overlap - .8) < 1e-8);
});
test("rhythm players receive identical upcoming notes, score once, and cannot submit forged points", () => {
  const s = make(rhythmRush), note = s.notes[0];
  assert.deepEqual(rhythmRush.publicView(s, note.at - 1000, "a").notes, rhythmRush.publicView(s, note.at - 1000, "b").notes);
  rhythmRush.applyInput(s, "a", { type: "RHYTHM_TAP", lane: note.lane }, note.at);
  const score = s.players.a.score; rhythmRush.applyInput(s, "a", { type: "RHYTHM_TAP", lane: note.lane }, note.at + 100);
  assert.equal(s.players.a.score, score); assert.equal(s.players.a.hits, 1);
  assert.equal(rhythmRush.publicView(s, note.at, "b").judged.length, 0);
  assert.equal(rhythmRush.parseInput({ type: "RHYTHM_TAP", lane: NaN }), null);
  assert.deepEqual(rhythmRush.parseInput({ type: "RHYTHM_TAP", lane: 2, points: 999 }), { type: "RHYTHM_TAP", lane: 2 });
  rhythmRush.tick(s, note.at + RHYTHM_WINDOW); assert.equal(s.players.b.misses, 1);
});
test("rhythm chart has common, occasional and rare notes, and bots play without perfect scores", () => {
  const s = make(rhythmRush), bot = { ...participants[0], isBot: true, difficulty: "medium" }, random = rng(29);
  assert.ok(s.notes.some((n) => n.value === 3)); assert.ok(s.notes.some((n) => n.value === 1));
  for (let now = 0; now < s.endsAt; now += 50) {
    for (const { input, at } of rhythmRush.botInputs(s, bot, now, random)) rhythmRush.applyInput(s, bot.id, input, at);
    rhythmRush.tick(s, now);
  }
  assert.ok(s.players.a.score > 0); assert.ok(s.players.a.score < s.notes.reduce((n, note) => n + note.value, 0));
});
test("Trail Run uses three different courses and awards exactly three sets of placement points", () => {
  const s = make(trailRun), random = rng(19), visited = new Set();
  for (let now = 0; now <= s.endsAt && !trailRun.isFinished(s); now += 100) {
    visited.add(s.theme);
    for (const p of participants) for (const { input, at } of trailRun.botInputs(s, { ...p, difficulty: "hard", isBot: true }, now, random)) {
      trailRun.applyInput(s, p.id, input, at);
    }
    trailRun.tick(s, now + 100);
  }
  assert.deepEqual([...visited], ["ice", "jungle", "sky"]); assert.ok(trailRun.isFinished(s)); assert.equal(s.results.length, 3);
  for (const result of s.results) assert.deepEqual(Object.values(result.points).sort(), [0, 1, 2, 3]);
  assert.equal(Object.values(s.players).reduce((n, p) => n + p.score, 0), 18);
  assert.ok(Object.values(s.players).some((p) => p.furthest >= TRAIL_FINISH.sky), "cloud course is finishable with bot controls");
});
test("trail input cannot teleport, duplicate jumps in midair, or act in an old round; falling uses checkpoints", () => {
  const s = make(trailRun); assert.equal(trailRun.parseInput({ type: "RUN_CONTROL", forward: 100, jump: true, round: 1 }), null);
  trailRun.applyInput(s, "a", { type: "RUN_CONTROL", forward: 1, jump: true, round: 1 }, 0); trailRun.tick(s, 100);
  assert.ok(s.players.a.y > 0); const vy = s.players.a.vy;
  trailRun.applyInput(s, "a", { type: "RUN_CONTROL", forward: 1, jump: true, round: 1 }, 100); trailRun.tick(s, 200);
  assert.ok(s.players.a.vy < vy); assert.throws(() => trailRun.applyInput(s, "a", { type: "RUN_CONTROL", forward: 1, jump: true, round: 2 }, 200));
  Object.assign(s.players.a, { y: -5, checkpoint: 3 }); trailRun.tick(s, 220);
  assert.equal(s.players.a.x, TRAIL_MAPS.ice[3].x); assert.equal(s.players.a.falls, 1);
  assert.equal(trailRun.publicView(s, 220).controls, undefined);
});
test("arcade spawns cover all floors and every seat can start on every floor over seeded matches", () => {
  assert.equal(ARENA_MAPS.arcade.spawns.length, 12);
  const seen = Object.fromEntries(participants.map((p) => [p.id, new Set()]));
  for (let seed = 1; seed <= 100; seed++) {
    const random = rng(seed); let first = true; const s = make(pickupArena, () => { if (first) { first = false; return 0; } return random(); });
    for (const p of participants) { seen[p.id].add(s.players[p.id].y); assert.equal(collides(ARENA_MAPS.arcade, s.players[p.id].x, s.players[p.id].y, s.players[p.id].z), false); }
  }
  for (const floors of Object.values(seen)) assert.deepEqual([...floors].sort(), [0, 4, 8]);
});
test("headshots double every gun's damage; Desert Eagle eliminates in one shot; body hits stay normal", () => {
  for (const [weapon, spec] of Object.entries(WEAPONS).filter(([id]) => id !== "knife")) for (const headshot of [true, false]) {
    const s = make(pickupArena, () => .99);
    Object.assign(s.players.a, { x: 0, y: 0, z: 0, weapon, ammo: spec.ammo, protectedUntil: 0 });
    Object.assign(s.players.b, { x: 0, y: 0, z: -5, protectedUntil: 0, avatarId: 2 });
    Object.assign(s.players.c, { x: 20, z: 20 }); Object.assign(s.players.d, { x: -20, z: 20 });
    pickupArena.applyInput(s, "a", control({ fire: true, pitch: headshot ? 0 : -.13 }), 0); pickupArena.tick(s, 50);
    assert.equal(s.hits[0].headshot, headshot); assert.equal(s.hits[0].damage, Math.min(100, spec.damage * (headshot ? 2 : 1)));
    if (weapon === "desert-eagle" && headshot) { assert.equal(s.players.b.hp, 0); assert.equal(s.players.a.kills, 1); assert.equal(s.feed[0].headshot, true); }
  }
});
test("health and ammo packs obey proximity, ceilings, availability and respawn, on every floor", () => {
  for (const map of Object.values(ARENA_MAPS)) for (let floor = 0; floor < map.floors; floor++) {
    const s = make(pickupArena, () => map.id === "arcade" ? 0 : .99), p = s.players.a;
    const health = map.supplies.findIndex((v) => v.kind === "health" && v.y === floor * 4);
    const ammo = map.supplies.findIndex((v) => v.kind === "ammo" && v.y === floor * 4);
    Object.assign(p, map.supplies[health], { hp: 95 }); assert.ok(collectSupplies(s, "a", 50)); assert.equal(p.hp, 100); assert.equal(s.supplies[health].availableAt, 12050);
    p.hp = 1; assert.equal(collectSupplies(s, "a", 100), false); assert.ok(collectSupplies(s, "a", 12050)); assert.equal(p.hp, 41);
    Object.assign(p, map.supplies[ammo], { weapon: "desert-eagle", ammo: 0 }); assert.ok(collectSupplies(s, "a", 50)); assert.equal(p.ammo, 7);
    assert.equal(collectSupplies(s, "a", 51), false); p.ammo = 21; assert.equal(collectSupplies(s, "a", 13000), false);
    assert.ok(pickupArena.publicView(s, 13000).supplies.length > 0);
  }
});
test("shared shooter movement used for prediction respects cover, diagonal speed and stairs", () => {
  const p = { x: 0, y: 0, z: 0 }; moveArenaPlayer(ARENA_MAPS.city, p, control({ forward: 1, strafe: 1 }), .05);
  assert.ok(Math.abs(Math.hypot(p.x, p.z) - .3) < 1e-8);
  const stair = ARENA_MAPS.arcade.stairs[0], q = { x: stair.x, y: 0, z: -10 };
  for (let i = 0; i < 28; i++) moveArenaPlayer(ARENA_MAPS.arcade, q, control({ forward: -1 }), .05);
  assert.ok(q.y > 3.7);
});
test("all three new games use normal authority flow and accept mobile button intent", () => {
  for (const def of [patternWall, trailRun, rhythmRush]) {
    const m = createMatch(participants.map((p, i) => createPlayer(p.id, p.id, i)), DEFAULT_SETTINGS, rng()); m.order = participants.map((p) => p.id);
    startMinigame(m, def.id, rng(), -7000); m.minigame.status = "ACTIVE"; m.phase = "MINIGAME";
    const s = m.minigame.state; let input, at;
    if (def === patternWall) { def.tick(s, s.phaseEndsAt); at = s.phaseStartedAt + 100; input = { type: "PATTERN_TAP", tile: s.pattern[0], round: 1, step: 0 }; }
    else if (def === trailRun) { at = 100; input = { type: "RUN_CONTROL", forward: 1, jump: true, round: 1 }; }
    else { at = s.notes[0].at; input = { type: "RHYTHM_TAP", lane: s.notes[0].lane }; }
    const parsed = parseMessage({ type: "ACTION", action: { type: "MINIGAME_INPUT", input } }); assert.ok(parsed);
    const next = applyMinigameInput(m, "a", parsed.action.input, at); assert.equal(next.phase, "MINIGAME");
    const view = publicMinigameView(next.minigame, at, undefined, "a"); assert.equal(view.state.bots, undefined);
  }
});
