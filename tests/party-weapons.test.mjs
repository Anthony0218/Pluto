import { DEFAULT_SETTINGS, advance, applyAction } from "./helpers/party-legacy-fixtures.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { AIM_CONFIG,
  LUCKY_SIX_CONFIG,
  SCATTERBLASTER_CONFIG } from "../src/games/party/config.ts";
import { tropical } from "../src/games/party/content/maps.ts";
import { createMatch,
  createPlayer } from "../src/games/party/engine/engine.ts";
import { graphDistances } from "../src/games/party/engine/graph.ts";
import { botAction } from "../src/games/party/engine/bots.ts";
import { createItemInstance } from "../src/games/party/items/inventory.ts";
import { aimTargetPosition,
  botAimRelease,
  resolveAimRelease } from "../src/games/party/items/aim.ts";
import { itemRegistry } from "../src/games/party/items/registry.ts";
import { scatterBand, scatterblasterDamage } from "../src/games/party/items/weapons.ts";
import { parseMessage } from "../src/games/party/network/protocol.ts";

const settings = { ...DEFAULT_SETTINGS, victory: "coins", coinTarget: 300 };
const players = () =>
  Array.from({ length: 4 }, (_, i) => createPlayer(`p${i}`, `Player ${i}`, i));
// Starting rolls 0.9, 0.7, 0.4, 0.1 give a stable order p0, p1, p2, p3 (p0 is active).
function started() {
  return advance(
    createMatch(players(), settings, () => 0.4),
    settings,
    (() => {
      const v = [0.9, 0.7, 0.4, 0.1];
      let i = 0;
      return () => v[i++ % 4];
    })(),
  );
}
const give = (s, playerId, itemId) => {
  const item = createItemInstance(s, itemId);
  s.players.find((p) => p.id === playerId).inventory.push(item);
  return item.instanceId;
};
const P = (s, id) => s.players.find((p) => p.id === id);
const has = (s, id, instanceId) => P(s, id).inventory.some((i) => i.instanceId === instanceId);
const nodeAt = (from, distance) =>
  [...graphDistances(tropical, from)].find(([, d]) => d === distance)[0];
const T0 = 5_000_000;
const act = (s, id, action, now = T0, random = () => 0.37) =>
  applyAction(s, id, action, settings, random, now);
const aimAt = (s, id, instanceId, targetPlayerId, now = T0) =>
  act(s, id, { type: "USE_ITEM", itemInstanceId: instanceId, targetPlayerId }, now);
// Fires `offset` away from where the target really is at server time `now`.
function fireWithOffset(s, id, offset, now) {
  const elapsedMs = now - s.turn.aim.startedAt,
    target = aimTargetPosition(s.turn.aim, elapsedMs);
  const aimX = Math.max(-1, Math.min(1, target.x + (target.x > 0 ? -offset : offset)));
  return act(s, id, { type: "FIRE_ITEM", aimX, aimY: target.y, elapsedMs }, now);
}
// Moves `id` so that it is exactly `distance` graph steps from p0.
function placeAt(s, id, distance) {
  P(s, id).currentNodeId = nodeAt(P(s, "p0").currentNodeId, distance);
  return s;
}
function shoot(itemId, distance, offset, hp = 40) {
  let s = started();
  const item = give(s, "p0", itemId);
  placeAt(s, "p1", distance);
  P(s, "p1").hp = hp;
  s = aimAt(s, "p0", item, "p1");
  const fired = fireWithOffset(s, "p0", offset, T0 + 1500);
  return { before: s, after: fired, item };
}

// ---------- Scatterblaster ----------
test("Scatterblaster aims only in the active player's Item Phase before rolling", () => {
  let s = started();
  const item = give(s, "p0", "scatterblaster");
  assert.throws(() => aimAt(s, "p1", item, "p0"), /turn/);
  const rolled = act(s, "p0", { type: "ROLL_DICE" });
  assert.throws(() => aimAt(rolled, "p0", item, "p1"), /before you roll/);
  s = aimAt(s, "p0", item, "p1");
  assert.equal(s.phase, "ITEM_AIM");
  assert.ok(has(s, "p0", item), "not consumed while aiming");
  // Nothing else can happen while aiming: no roll, no second item.
  assert.throws(() => act(s, "p0", { type: "ROLL_DICE" }), /Fire or cancel/);
  assert.throws(() => aimAt(s, "p0", item, "p2"), /Fire or cancel/);
  assert.throws(() => act(s, "p1", { type: "FIRE_ITEM", aimX: 0, aimY: 0 }), /turn/);
});

test("Scatterblaster rejects self and unknown targets without consuming the item", () => {
  const s = started();
  const item = give(s, "p0", "scatterblaster");
  assert.throws(() => aimAt(s, "p0", item, "p0"), /yourself/);
  assert.throws(() => aimAt(s, "p0", item, "ghost"), /not in this match/);
  assert.throws(() => act(s, "p0", { type: "USE_ITEM", itemInstanceId: item }), /Choose an opponent/);
  assert.ok(has(s, "p0", item));
  assert.equal(s.phase, "ITEM_PHASE");
});

test("Scatterblaster range bands come from shortest graph distance", () => {
  assert.equal(scatterBand(0).band, "close");
  assert.equal(scatterBand(1).band, "close");
  assert.equal(scatterBand(2).band, "medium");
  assert.equal(scatterBand(3).band, "medium");
  assert.equal(scatterBand(4).band, "long");
  assert.equal(scatterBand(5).band, "long");
  assert.equal(scatterBand(6), null);
  for (const [distance, band] of [[1, "close"], [3, "medium"], [5, "long"]]) {
    let s = started();
    const item = give(s, "p0", "scatterblaster");
    placeAt(s, "p1", distance);
    s = aimAt(s, "p0", item, "p1");
    assert.equal(s.turn.aim.band, band);
    assert.equal(s.turn.aim.distance, distance);
  }
});

test("Scatterblaster uses graph distance, not pixels: a pixel-nearer pawn can be out of range", () => {
  const px = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let found = null;
  for (const from of tropical.nodes) {
    const distances = graphDistances(tropical, from.id);
    const inRange = tropical.nodes.filter((n) => distances.get(n.id) <= 5);
    const outOfRange = tropical.nodes.filter((n) => distances.get(n.id) > 5);
    const far = inRange.reduce((a, b) => (px(from, a) > px(from, b) ? a : b));
    const near = outOfRange.reduce((a, b) => (px(from, a) < px(from, b) ? a : b));
    if (px(from, near) < px(from, far)) found = { from: from.id, near: near.id, far: far.id };
  }
  assert.ok(found, "some out-of-range space is closer on screen than an in-range one");
  const s = started();
  const item = give(s, "p0", "scatterblaster");
  P(s, "p0").currentNodeId = found.from;
  P(s, "p1").currentNodeId = found.near;
  P(s, "p2").currentNodeId = found.far;
  assert.throws(() => aimAt(s, "p0", item, "p1"), /out of Scatterblaster range/);
  assert.ok(has(s, "p0", item));
  assert.equal(aimAt(s, "p0", item, "p2").phase, "ITEM_AIM");
});

test("out-of-range target is rejected and no shot happens", () => {
  const s = started();
  const item = give(s, "p0", "scatterblaster");
  placeAt(s, "p1", 7);
  const hp = P(s, "p1").hp;
  assert.throws(() => aimAt(s, "p0", item, "p1"), /range/);
  assert.equal(P(s, "p1").hp, hp);
});

test("Scatterblaster damage: close centered 20, close partial 15, medium 10, long 5, miss 0", () => {
  const close = SCATTERBLASTER_CONFIG.bands[0];
  const cases = [
    [1, 0, 20],
    [0, (close.centerRadius + close.hitRadius) / 2, 15],
    [2, 0.02, 10],
    [3, SCATTERBLASTER_CONFIG.bands[1].hitRadius - 0.02, 10],
    [4, 0, 5],
    [1, close.hitRadius + 0.1, 0],
    [5, SCATTERBLASTER_CONFIG.bands[2].hitRadius + 0.05, 0],
  ];
  for (const [distance, offset, damage] of cases) {
    const { after } = shoot("scatterblaster", distance, offset);
    assert.equal(40 - P(after, "p1").hp, damage, `distance ${distance}, offset ${offset}`);
    assert.equal(after.phase, "ITEM_PHASE");
  }
  assert.equal(scatterblasterDamage("close", "centered"), 20);
  assert.equal(scatterblasterDamage("close", "partial"), 15);
  assert.equal(scatterblasterDamage("medium", "centered"), 10);
  assert.equal(scatterblasterDamage("long", "partial"), 5);
  assert.equal(scatterblasterDamage("close", "miss"), 0);
});

test("a miss deals zero damage and says so", () => {
  const { after } = shoot("scatterblaster", 1, 0.9);
  assert.equal(P(after, "p1").hp, 40);
  assert.ok(after.events.some((e) => e.kind === "MISS" && /SCATTERBLASTER MISSED/.test(e.text)));
});

test("Scatterblaster damage goes through the generic KO system", () => {
  const { before, after } = shoot("scatterblaster", 1, 0, 15);
  assert.equal(P(after, "p1").hp, 20);
  assert.equal(P(after, "p1").currentNodeId, tropical.start);
  assert.equal(P(after, "p1").coins, P(before, "p1").coins - 5);
  assert.equal(after.bank, before.bank + 5);
  assert.ok(after.events.some((e) => e.kind === "KO"));
});

test("aimed items are consumed after a valid shot (hit or miss), not when cancelled", () => {
  for (const offset of [0, 0.9]) {
    const { after, item } = shoot("scatterblaster", 1, offset);
    assert.ok(!has(after, "p0", item));
    assert.equal(after.turn.aim, null);
    assert.equal(after.turn.usedItemThisTurn, true);
  }
  let s = started();
  const item = give(s, "p0", "scatterblaster");
  s = aimAt(s, "p0", item, "p1");
  s = act(s, "p0", { type: "CANCEL_AIM" });
  assert.equal(s.phase, "ITEM_PHASE");
  assert.ok(has(s, "p0", item));
  // The turn is intact: the player can still roll.
  assert.equal(act(s, "p0", { type: "ROLL_DICE" }).phase, "DICE_ROLL");
});

test("duplicate fire or use requests do not execute twice", () => {
  const { after, item } = shoot("scatterblaster", 1, 0);
  const hp = P(after, "p1").hp;
  assert.throws(() => act(after, "p0", { type: "FIRE_ITEM", aimX: 0, aimY: 0 }, T0 + 1600), /not aiming/);
  assert.throws(() => aimAt(after, "p0", item, "p1", T0 + 1600), /do not have/);
  assert.equal(P(after, "p1").hp, hp);
});

test("an unreleased shot times out as a miss after the window and grace", () => {
  let s = started();
  const item = give(s, "p0", "scatterblaster");
  s = aimAt(s, "p0", item, "p1");
  const deadline = s.turn.aim.expiresAt + AIM_CONFIG.expiryGraceMs;
  assert.equal(advance(s, settings, () => 0, deadline), s, "still waiting at the deadline");
  const timedOut = advance(s, settings, () => 0, deadline + 1);
  assert.equal(timedOut.phase, "ITEM_PHASE");
  assert.ok(!has(timedOut, "p0", item));
  assert.equal(P(timedOut, "p1").hp, P(s, "p1").hp);
  assert.ok(timedOut.events.some((e) => e.kind === "MISS" && /TIMED OUT/.test(e.text)));
  // A release after the window is also a miss even if perfectly aimed.
  const late = fireWithOffset(s, "p0", 0, s.turn.aim.expiresAt + 200);
  assert.equal(P(late, "p1").hp, P(s, "p1").hp);
});

// ---------- Aim authority ----------
test("the server scores the release at its own time; a forged early timestamp is ignored", () => {
  let s = started();
  const item = give(s, "p0", "lucky-six");
  s = aimAt(s, "p0", item, "p1");
  const aim = s.turn.aim;
  // Find a moment where the target is far from where it started.
  const serverElapsed = [...Array(40)].map((_, i) => 500 + i * 100).find((ms) => {
    const a = aimTargetPosition(aim, 0),
      b = aimTargetPosition(aim, ms);
    return Math.hypot(a.x - b.x, a.y - b.y) > 0.3;
  });
  const start = aimTargetPosition(aim, 0);
  // Claims it released at t=0 (aimed perfectly there), but the server received it much later.
  const forged = act(
    s,
    "p0",
    { type: "FIRE_ITEM", aimX: start.x, aimY: start.y, elapsedMs: 0 },
    aim.startedAt + serverElapsed,
  );
  // p1 has 20 HP, so a Lucky Six hit would be a KO.
  assert.ok(!forged.events.some((e) => e.kind === "KO"), "scored at server time, so it missed");
  assert.equal(P(forged, "p1").hp, 20);
  // A release time within the latency tolerance is honoured.
  const lagged = serverElapsed - (AIM_CONFIG.latencyToleranceMs - 50);
  const at = aimTargetPosition(aim, lagged);
  const honest = act(
    s,
    "p0",
    { type: "FIRE_ITEM", aimX: at.x, aimY: at.y, elapsedMs: lagged },
    aim.startedAt + serverElapsed,
  );
  assert.ok(honest.events.some((e) => e.kind === "KO"), "hit → 20 damage → KO");
  const geometry = itemRegistry.get("lucky-six").aim.geometry("global");
  assert.equal(
    resolveAimRelease(aim, geometry, 5, -5, undefined, aim.startedAt + 100).offset,
    resolveAimRelease(aim, geometry, 1, -1, undefined, aim.startedAt + 100).offset,
    "positions are clamped to the field",
  );
});

test("clients cannot send damage, accuracy or hit quality", () => {
  const parsed = parseMessage({
    type: "ACTION",
    action: { type: "FIRE_ITEM", aimX: 0.1, aimY: -0.2, elapsedMs: 900, damage: 20, hitQuality: "perfect", accuracy: 1 },
  });
  assert.deepEqual(parsed.action, { type: "FIRE_ITEM", aimX: 0.1, aimY: -0.2, elapsedMs: 900 });
  const use = parseMessage({
    type: "ACTION",
    action: { type: "USE_ITEM", itemInstanceId: "item-1", targetPlayerId: "p1", damage: 99, quality: "centered" },
  });
  assert.deepEqual(use.action, { type: "USE_ITEM", itemInstanceId: "item-1", targetPlayerId: "p1" });
  for (const bad of [
    { type: "FIRE_ITEM", aimX: "0", aimY: 0 },
    { type: "FIRE_ITEM", aimX: 0, aimY: 9 },
    { type: "FIRE_ITEM", aimX: Number.NaN, aimY: 0 },
    { type: "FIRE_ITEM", aimX: 0, aimY: 0, elapsedMs: -5 },
    { type: "FIRE_ITEM" },
  ])
    assert.throws(() => parseMessage({ type: "ACTION", action: bad }));
});

// ---------- Lucky Six ----------
test("Lucky Six targets any opponent on the board, never yourself", () => {
  let s = started();
  const item = give(s, "p0", "lucky-six");
  placeAt(s, "p1", 9);
  assert.throws(() => aimAt(s, "p0", item, "p0"), /yourself/);
  s = aimAt(s, "p0", item, "p1");
  assert.equal(s.turn.aim.band, "global");
});

test("Lucky Six: accurate hit deals 20, a miss deals 0, and there is no partial damage", () => {
  assert.equal(40 - P(shoot("lucky-six", 8, 0).after, "p1").hp, 20);
  assert.equal(40 - P(shoot("lucky-six", 8, LUCKY_SIX_CONFIG.hitRadius - 0.01).after, "p1").hp, 20);
  const missed = shoot("lucky-six", 8, LUCKY_SIX_CONFIG.hitRadius + 0.02).after;
  assert.equal(P(missed, "p1").hp, 40);
  assert.ok(missed.events.some((e) => e.text === "LUCKY SIX MISSED!"));
});

test("Lucky Six KO uses the shared KO rules and the item is consumed either way", () => {
  const { before, after, item } = shoot("lucky-six", 3, 0, 20);
  assert.equal(P(after, "p1").hp, 20);
  assert.equal(P(after, "p1").currentNodeId, tropical.start);
  assert.equal(after.bank, before.bank + 5);
  assert.ok(!has(after, "p0", item));
  assert.ok(!has(shoot("lucky-six", 3, 0.9).after, "p0", item));
});

test("Lucky Six cannot be used after the normal dice roll", () => {
  const s = started();
  const item = give(s, "p0", "lucky-six");
  const rolled = act(s, "p0", { type: "ROLL_DICE" });
  assert.throws(() => aimAt(rolled, "p0", item, "p1"), /before you roll/);
});

// ---------- Bots ----------
test("bot aim varies by difficulty: hard beats easy, but hard Lucky Six still misses sometimes", () => {
  let seed = 11;
  const rng = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const hits = {};
  for (const difficulty of ["easy", "medium", "hard"]) {
    hits[difficulty] = 0;
    for (let i = 0; i < 400; i++) {
      const aim = {
        startedAt: 0,
        expiresAt: 5000,
        motion: { ax: 0.6, ay: 0.55, fx: 0.5 + rng() * 0.2, fy: 0.5, px: rng() * 6, py: rng() * 6 },
      };
      const now = 600 + Math.floor(rng() * 3000);
      const release = botAimRelease(aim, difficulty, now, rng);
      const geometry = itemRegistry.get("lucky-six").aim.geometry("global");
      if (resolveAimRelease(aim, geometry, release.aimX, release.aimY, release.elapsedMs, now).quality !== "miss")
        hits[difficulty]++;
    }
  }
  assert.ok(hits.hard > hits.medium && hits.medium > hits.easy, JSON.stringify(hits));
  assert.ok(hits.hard < 400, "hard is not perfect");
});

test("bots fire a legal, validated shot and prefer a Scatterblaster target they can knock out", () => {
  let s = started();
  P(s, "p0").isBot = true;
  P(s, "p0").difficulty = "hard";
  give(s, "p0", "scatterblaster");
  placeAt(s, "p1", 1);
  placeAt(s, "p2", 1);
  P(s, "p1").hp = 38;
  P(s, "p2").hp = 12;
  placeAt(s, "p3", 9);
  const use = botAction(s, tropical, () => 0.5, settings, T0);
  assert.equal(use.type, "USE_ITEM");
  assert.equal(use.targetPlayerId, "p2");
  s = act(s, "p0", use, T0);
  assert.equal(botAction(s, tropical, () => 0.5, settings, T0 + 100), null, "takes a moment to aim");
  const fire = botAction(s, tropical, () => 0.5, settings, T0 + 900);
  assert.equal(fire.type, "FIRE_ITEM");
  const after = act(s, "p0", fire, T0 + 900);
  assert.equal(after.phase, "ITEM_PHASE");
  assert.equal(after.turn.aim, null);
});
