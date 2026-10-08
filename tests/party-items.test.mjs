import { DEFAULT_SETTINGS, advance, applyAction } from "./helpers/party-legacy-fixtures.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { MAX_INVENTORY_SIZE,
  RULES } from "../src/games/party/config.ts";
import { tropical } from "../src/games/party/content/maps.ts";
import { activePlayer,
  createMatch,
  createPlayer,
  rollDie } from "../src/games/party/engine/engine.ts";
import { clampHp,
  damagePlayer,
  healPlayer,
  isKnockedOut } from "../src/games/party/engine/combat.ts";
import { graphDistances } from "../src/games/party/engine/graph.ts";
import { botAction } from "../src/games/party/engine/bots.ts";
import { createItemInstance,
  grantItem } from "../src/games/party/items/inventory.ts";
import { rollBonus } from "../src/games/party/items/dice.ts";
import { itemRegistry } from "../src/games/party/items/registry.ts";
import { parseMessage } from "../src/games/party/network/protocol.ts";

const settings = { ...DEFAULT_SETTINGS, victory: "coins", coinTarget: 300 };
const players = () =>
  Array.from({ length: 4 }, (_, i) => createPlayer(`p${i}`, `Player ${i}`, i));
// Starting rolls 0.9, 0.7, 0.4, 0.1 give a stable order p0, p1, p2, p3.
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
const use = (s, id, itemInstanceId, targetNodeId, random = () => 0) =>
  applyAction(
    s,
    id,
    { type: "USE_ITEM", itemInstanceId, ...(targetNodeId && { targetNodeId }) },
    settings,
    random,
  );
// Finds a node with the requested graph distance from `from`.
const nodeAt = (from, distance, skip = []) =>
  [...graphDistances(tropical, from)]
    .filter(([id, d]) => d === distance && !skip.includes(id))
    .map(([id]) => id)[0];

// ---------- HP ----------
test("players start at 20 HP with a 40 HP maximum", () => {
  const s = started();
  assert.equal(RULES.hp, 20);
  assert.equal(RULES.maxHp, 40);
  for (const p of s.players) {
    assert.equal(p.hp, 20);
    assert.equal(p.maxHp, 40);
  }
});
test("damage reduces HP and healing never exceeds 40", () => {
  const s = started();
  const r = damagePlayer(s, tropical, "p1", 7);
  assert.deepEqual(r, { dealt: 7, knockedOut: false });
  assert.equal(P(s, "p1").hp, 13);
  assert.equal(healPlayer(s, "p1", 100), 27);
  assert.equal(P(s, "p1").hp, 40);
  assert.equal(healPlayer(s, "p1", 5), 0);
  assert.equal(clampHp(99, 40), 40);
  assert.equal(clampHp(-3, 40), 0);
  assert.equal(damagePlayer(s, tropical, "p1", -10).dealt, 0);
  assert.equal(P(s, "p1").hp, 40);
});

// ---------- KO ----------
test("reaching 0 HP knocks out, respawns at Start with 20 HP and moves 5 coins to the bank", () => {
  const s = started();
  const p = P(s, "p1");
  p.hp = 6;
  p.coins = 34;
  p.currentNodeId = "space-25";
  p.previousNodeId = "space-24";
  const r = damagePlayer(s, tropical, "p1", 10);
  assert.equal(r.knockedOut, true);
  assert.equal(p.hp, 20);
  assert.equal(p.currentNodeId, tropical.start);
  assert.equal(p.previousNodeId, null);
  assert.equal(p.coins, 29);
  assert.equal(s.bank, 5);
  assert.ok(s.events.some((e) => e.kind === "KO"));
  assert.ok(s.events.some((e) => e.kind === "RESPAWN"));
  assert.equal(isKnockedOut(p), false);
});
test("a KO with fewer than 5 coins transfers only what the player has", () => {
  const s = started();
  P(s, "p2").hp = 3;
  P(s, "p2").coins = 2;
  damagePlayer(s, tropical, "p2", 50);
  assert.equal(P(s, "p2").coins, 0);
  assert.equal(s.bank, 2);
  assert.equal(P(s, "p2").hp, 20);
});
test("KO from the hazard field uses the shared system and does not skip the next turn", () => {
  const s = started();
  const hazard = tropical.nodes.find((n) => n.type === "hazard");
  s.phase = "RESOLVE_TILE";
  activePlayer(s).currentNodeId = hazard.id;
  activePlayer(s).hp = 5;
  let next = advance(s, settings, () => 0);
  assert.equal(activePlayer(next).hp, 20);
  assert.equal(next.bank, 5);
  assert.equal(next.phase, "TURN_END");
  next = advance(next, settings, () => 0);
  assert.equal(activePlayer(next).id, "p1");
  assert.equal(next.phase, "ITEM_PHASE");
});
test("a player KO'd on someone else's turn still gets their own turn", () => {
  let s = started();
  P(s, "p2").hp = 1;
  damagePlayer(s, tropical, "p2", 5);
  const seen = [];
  for (let i = 0; i < 4; i++) {
    seen.push(activePlayer(s).id);
    s = applyAction(
      s,
      activePlayer(s).id,
      { type: "ROLL_DICE" },
      settings,
      () => 0,
    );
    s = advance(s, settings, () => 0);
    s = applyAction(s, activePlayer(s).id, { type: "ZERO_REWARD", reward: "coins" }, settings, () => 0);
    s = advance(s, settings, () => 0);
  }
  assert.deepEqual(seen, ["p0", "p1", "p2", "p3"]);
});

// ---------- Inventory ----------
test("inventory accepts three items and never silently adds a fourth", () => {
  const s = started();
  assert.equal(MAX_INVENTORY_SIZE, 3);
  for (const id of ["mega-medkit", "turbo-boots", "comet-melon"])
    assert.equal(grantItem(s, "p0", id), "added");
  assert.equal(grantItem(s, "p0", "mega-medkit"), "pending");
  assert.equal(P(s, "p0").inventory.length, 3);
  assert.equal(s.pendingItem.itemId, "mega-medkit");
  const ids = P(s, "p0").inventory.map((i) => i.instanceId);
  assert.equal(new Set([...ids, s.pendingItem.instanceId]).size, 4);
});
function fullInventoryLanding() {
  const s = started();
  for (const id of ["turbo-boots", "turbo-boots", "comet-melon"])
    give(s, "p0", id);
  s.phase = "RESOLVE_TILE";
  activePlayer(s).currentNodeId = tropical.nodes.find(
    (n) => n.type === "item",
  ).id;
  return advance(s, settings, () => 0); // random 0 awards the first registered item
}
test("Random Item field awards an item, or asks for a replacement when full", () => {
  const s = started();
  s.phase = "RESOLVE_TILE";
  activePlayer(s).currentNodeId = tropical.nodes.find(
    (n) => n.type === "item",
  ).id;
  const got = advance(s, settings, () => 0);
  assert.equal(P(got, "p0").inventory.length, 1);
  assert.equal(P(got, "p0").inventory[0].itemId, "mega-medkit");
  assert.equal(got.phase, "TURN_END");
  const full = fullInventoryLanding();
  assert.equal(full.phase, "ITEM_REPLACE");
  assert.equal(full.pendingItem.itemId, "mega-medkit");
  assert.equal(P(full, "p0").inventory.length, 3);
});
test("replacement swaps the chosen slot, discard drops the new item, both validated by the server", () => {
  const full = fullInventoryLanding();
  const target = P(full, "p0").inventory[1].instanceId;
  const replaced = applyAction(
    full,
    "p0",
    { type: "REPLACE_ITEM", replaceInstanceId: target },
    settings,
    () => 0,
  );
  assert.equal(replaced.pendingItem, null);
  assert.equal(replaced.phase, "TURN_END");
  assert.equal(P(replaced, "p0").inventory[1].itemId, "mega-medkit");
  assert.equal(P(replaced, "p0").inventory.length, 3);
  const discarded = applyAction(
    full,
    "p0",
    { type: "DISCARD_NEW_ITEM" },
    settings,
    () => 0,
  );
  assert.equal(discarded.pendingItem, null);
  assert.deepEqual(P(discarded, "p0").inventory, P(full, "p0").inventory);
  const before = structuredClone(full);
  assert.throws(
    () =>
      applyAction(
        full,
        "p0",
        { type: "REPLACE_ITEM", replaceInstanceId: "item-999" },
        settings,
        () => 0,
      ),
    /replace/,
  );
  assert.throws(
    () =>
      applyAction(full, "p1", { type: "DISCARD_NEW_ITEM" }, settings, () => 0),
    /turn/,
  );
  assert.throws(() =>
    applyAction(
      started(),
      "p0",
      { type: "DISCARD_NEW_ITEM" },
      settings,
      () => 0,
    ),
  );
  assert.throws(() =>
    applyAction(full, "p0", { type: "ROLL_DICE" }, settings, () => 0),
  );
  assert.deepEqual(full, before);
});
test("a full-inventory decision on a Golden Pluto space still leads to the offer", () => {
  const full = fullInventoryLanding();
  full.plutoNodeIds = [activePlayer(full).currentNodeId, "space-1"];
  const next = applyAction(
    full,
    "p0",
    { type: "DISCARD_NEW_ITEM" },
    settings,
    () => 0,
  );
  assert.equal(next.phase, "PLUTO_OFFER");
});
test("invalid item instances are rejected without mutation", () => {
  const s = started();
  give(s, "p1", "mega-medkit");
  P(s, "p0").hp = 10;
  const before = structuredClone(s);
  assert.throws(() => use(s, "p0", "item-404"), /do not have/);
  assert.throws(
    () => use(s, "p0", P(s, "p1").inventory[0].instanceId),
    /do not have/,
  );
  assert.deepEqual(s, before);
});

// ---------- Timing ----------
test("the active player can use an item before rolling, and it is consumed", () => {
  const s = started();
  const id = give(s, "p0", "mega-medkit");
  const after = use(s, "p0", id);
  assert.equal(P(after, "p0").inventory.length, 0);
  assert.equal(after.phase, "ITEM_PHASE");
  assert.equal(after.turn.usedItemThisTurn, true);
  assert.equal(after.turn.hasRolled, false);
});
test("item use is rejected after the normal roll and in later phases", () => {
  let s = started();
  const id = give(s, "p0", "mega-medkit");
  s = applyAction(s, "p0", { type: "ROLL_DICE" }, settings, () => 0.5);
  assert.equal(s.turn.hasRolled, true);
  assert.throws(() => use(s, "p0", id), /before you roll/);
  s = advance(s, settings, () => 0);
  assert.throws(() => use(s, "p0", id), /before you roll/);
});
test("a non-active player cannot use an item, even during the item phase", () => {
  const s = started();
  const id = give(s, "p1", "mega-medkit");
  P(s, "p1").hp = 10;
  assert.throws(() => use(s, "p1", id), /turn/);
  assert.equal(P(s, "p1").inventory.length, 1);
  assert.equal(P(s, "p1").hp, 10);
});

// ---------- Mega Medkit ----------
test("Mega Medkit heals 20, caps at 40, and is consumed", () => {
  for (const [start, end] of [
    [20, 40],
    [35, 40],
    [10, 30],
  ]) {
    const s = started();
    P(s, "p0").hp = start;
    const after = use(s, "p0", give(s, "p0", "mega-medkit"));
    assert.equal(P(after, "p0").hp, end);
    assert.equal(P(after, "p0").inventory.length, 0);
    const heal = after.events.find((e) => e.kind === "HEAL");
    assert.equal(heal.amount, end - start);
  }
});
test("Mega Medkit cannot be used at full HP and is not consumed", () => {
  const s = started();
  P(s, "p0").hp = 40;
  const id = give(s, "p0", "mega-medkit");
  assert.throws(() => use(s, "p0", id), /cannot be used/);
  assert.equal(P(s, "p0").inventory.length, 1);
});

// ---------- Turbo Boots ----------
test("Turbo Boots bonus is server-generated between 0 and 5", () => {
  assert.equal(
    rollBonus(() => 0),
    0,
  );
  assert.equal(
    rollBonus(() => 0.99999),
    5,
  );
  const seen = new Set();
  for (let n = 0; n < 6000; n++) {
    const b = rollBonus(() => n / 6000);
    assert.ok(Number.isInteger(b) && b >= 0 && b <= 5);
    seen.add(b);
  }
  assert.equal(seen.size, 6);
  for (let n = 0; n < 2200; n++) assert.ok(rollDie(() => n / 2200) <= 10);
});
test("Turbo Boots adds the bonus to the normal roll, is consumed, and cannot stack", () => {
  let s = started();
  const boots = give(s, "p0", "turbo-boots");
  const second = give(s, "p0", "turbo-boots");
  s = use(s, "p0", boots, undefined, () => 0.7); // bonus 4
  assert.equal(s.turn.bonusMovement, 4);
  assert.equal(P(s, "p0").inventory.length, 1);
  assert.throws(() => use(s, "p0", second), /cannot be used/);
  s = applyAction(s, "p0", { type: "ROLL_DICE" }, settings, () => 0.65); // roll 7
  assert.equal(s.lastRoll, 7);
  assert.equal(s.movesRemaining, 11);
  assert.equal(s.phase, "DICE_ROLL");
});
test("Turbo Boots still moves you when the normal roll is zero", () => {
  let s = started();
  s = use(s, "p0", give(s, "p0", "turbo-boots"), undefined, () => 0.5); // bonus 3
  s = applyAction(s, "p0", { type: "ROLL_DICE" }, settings, () => 0);
  assert.equal(s.movesRemaining, 3);
  assert.equal(advance(s, settings, () => 0).phase, "MOVEMENT");
});
test("temporary bonus is turn state and resets when the next turn begins", () => {
  let s = started();
  s = use(s, "p0", give(s, "p0", "turbo-boots"), undefined, () => 0.99);
  assert.equal(s.turn.bonusMovement, 5);
  assert.ok(!("bonusMovement" in P(s, "p0")));
  s = applyAction(s, "p0", { type: "ROLL_DICE" }, settings, () => 0);
  s = advance(s, settings, () => 0); // DICE_ROLL -> MOVEMENT
  for (let i = 0; i < 40 && activePlayer(s).id === "p0"; i++) {
    if (s.phase === "PATH_SELECTION")
      s = applyAction(
        s,
        "p0",
        { type: "SELECT_PATH", nodeId: tropicalPath(s) },
        settings,
        () => 0,
      );
    else s = advance(s, settings, () => 0);
  }
  assert.equal(activePlayer(s).id, "p1");
  assert.deepEqual(s.turn, {
    hasRolled: false,
    bonusMovement: 0,
    bonusRolled: false,
    usedItemThisTurn: false,
    aim: null,
  });
  const noBonus = applyAction(
    s,
    "p1",
    { type: "ROLL_DICE" },
    settings,
    () => 0.5,
  );
  assert.equal(noBonus.movesRemaining, noBonus.lastRoll);
});
function tropicalPath(s) {
  const p = activePlayer(s);
  const node = tropical.nodes.find((n) => n.id === p.currentNodeId);
  return node.connections.find((id) => id !== p.previousNodeId);
}

// ---------- Comet Melon ----------
function meloned() {
  const s = started();
  const target = "space-25";
  const one = nodeAt(target, 1),
    two = nodeAt(target, 2),
    three = nodeAt(target, 3);
  P(s, "p1").currentNodeId = target;
  P(s, "p2").currentNodeId = one;
  P(s, "p3").currentNodeId = two;
  P(s, "p0").currentNodeId = three;
  return { s, target, one, two, three };
}
test("Comet Melon deals 15 / 10 / 5 by graph distance, never hits the owner, and is consumed", () => {
  const { s, target } = meloned();
  const after = use(s, "p0", give(s, "p0", "comet-melon"), target);
  assert.equal(P(after, "p1").hp, 5);
  assert.equal(P(after, "p2").hp, 10);
  assert.equal(P(after, "p3").hp, 15);
  assert.equal(P(after, "p0").hp, 20);
  assert.equal(P(after, "p0").inventory.length, 0);
  assert.ok(after.log.some((l) => l.includes("PLAYER 0 HIT PLAYER 1 FOR 15")));
  assert.ok(
    after.events.some((e) => e.kind === "EXPLOSION" && e.nodeId === target),
  );
});
test("players farther than two connections away take no damage", () => {
  const { s, target, three } = meloned();
  P(s, "p1").currentNodeId = three;
  P(s, "p2").currentNodeId = nodeAt(target, 4) ?? three;
  const after = use(s, "p0", give(s, "p0", "comet-melon"), target);
  assert.equal(P(after, "p1").hp, 20);
  assert.equal(P(after, "p2").hp, 20);
});
test("the owner standing on the target is exempt from self-damage", () => {
  const { s, target } = meloned();
  P(s, "p0").currentNodeId = target;
  const after = use(s, "p0", give(s, "p0", "comet-melon"), target);
  assert.equal(P(after, "p0").hp, 20);
});
test("Comet Melon distance follows connections, not pixels", () => {
  // space-7 and space-53 sit on opposite sides of the map yet share a bridge edge.
  const s = started();
  P(s, "p1").currentNodeId = "space-53";
  const pixel = (a, b) =>
    Math.hypot(
      tropical.nodes[a].x - tropical.nodes[b].x,
      tropical.nodes[a].y - tropical.nodes[b].y,
    );
  assert.ok(pixel(7, 53) > 500);
  const after = use(s, "p0", give(s, "p0", "comet-melon"), "space-7");
  assert.equal(P(after, "p1").hp, 10);
});
test("Comet Melon KO respawns victims at Start and moves coins to the bank", () => {
  const { s, target } = meloned();
  P(s, "p1").hp = 12;
  P(s, "p1").coins = 3;
  P(s, "p2").hp = 10;
  const after = use(s, "p0", give(s, "p0", "comet-melon"), target);
  assert.equal(P(after, "p1").hp, 20);
  assert.equal(P(after, "p1").currentNodeId, tropical.start);
  assert.equal(P(after, "p1").coins, 0);
  assert.equal(P(after, "p2").hp, 20);
  assert.equal(P(after, "p2").coins, 15);
  assert.equal(after.bank, 8);
  assert.equal(P(after, "p3").hp, 15);
  assert.equal(activePlayer(after).id, "p0");
  assert.equal(after.phase, "ITEM_PHASE");
});
test("Comet Melon rejects missing or unknown targets without consuming the item", () => {
  const { s } = meloned();
  const id = give(s, "p0", "comet-melon");
  const before = structuredClone(s);
  assert.throws(() => use(s, "p0", id), /space/);
  assert.throws(() => use(s, "p0", id, "space-999"), /space/);
  assert.deepEqual(s, before);
});
test("clients cannot supply damage, healing or bonus values", () => {
  assert.deepEqual(
    parseMessage({
      type: "ACTION",
      action: {
        type: "USE_ITEM",
        itemInstanceId: "item-1",
        targetNodeId: "space-3",
        damage: 999,
        heal: 999,
        bonusRoll: 5,
      },
    }),
    {
      type: "ACTION",
      action: {
        type: "USE_ITEM",
        itemInstanceId: "item-1",
        targetNodeId: "space-3",
      },
    },
  );
  assert.deepEqual(
    parseMessage({
      type: "ACTION",
      action: { type: "USE_ITEM", itemInstanceId: "item-1", bonusRoll: 5 },
    }),
    { type: "ACTION", action: { type: "USE_ITEM", itemInstanceId: "item-1" } },
  );
  assert.deepEqual(
    parseMessage({
      type: "ACTION",
      action: { type: "DISCARD_NEW_ITEM", x: 1 },
    }),
    {
      type: "ACTION",
      action: { type: "DISCARD_NEW_ITEM" },
    },
  );
  for (const bad of [
    { type: "USE_ITEM" },
    { type: "USE_ITEM", itemInstanceId: 5 },
    { type: "USE_ITEM", itemInstanceId: "a", targetNodeId: 5 },
    { type: "REPLACE_ITEM" },
  ])
    assert.throws(() => parseMessage({ type: "ACTION", action: bad }));
});
test("registry contains exactly the Milestone 4, 7 and 8 items", () => {
  assert.deepEqual(
    itemRegistry
      .all()
      .map((i) => i.id)
      .sort(),
    [
      "comet-melon",
      "duel-saber",
      "fallout-core",
      "lucky-six",
      "mega-medkit",
      "pocket-duel",
      "scatterblaster",
      "turbo-boots",
      "wild-totem",
    ],
  );
});
test("seeded bot matches with items preserve HP, inventory and coin invariants", () => {
  for (const startSeed of [3, 19, 77]) {
    let seed = startSeed;
    const rng = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const cfg = { ...DEFAULT_SETTINGS, victory: "coins", coinTarget: 300 };
    let s = createMatch(players(), cfg, rng);
    const used = new Set();
    let now = 0; // simulated 700 ms authority clock so timed minigame phases progress
    for (let step = 0; step < 6000 && s.phase !== "GAME_OVER"; step++) {
      now += 700;
      const action = botAction(s, tropical, rng, cfg);
      if (action?.type === "USE_ITEM")
        used.add(
          activePlayer(s).inventory.find(
            (i) => i.instanceId === action.itemInstanceId,
          ).itemId,
        );
      s = action
        ? applyAction(s, activePlayer(s).id, action, cfg, rng, now)
        : advance(s, cfg, rng, now);
      for (const p of s.players) {
        assert.ok(p.hp > 0 && p.hp <= p.maxHp);
        assert.ok(p.inventory.length <= 3 && p.coins >= 0);
      }
      assert.ok(s.turn.bonusMovement >= 0 && s.turn.bonusMovement <= 5);
      assert.equal(s.phase === "ITEM_REPLACE", s.pendingItem !== null);
    }
    assert.ok(used.size >= 2, `seed ${startSeed} used ${[...used]}`);
  }
});
