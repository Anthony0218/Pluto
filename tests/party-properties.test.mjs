import { DEFAULT_SETTINGS, advance, applyAction } from "./helpers/party-legacy-fixtures.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { PROPERTY_CONFIG } from "../src/games/party/config.ts";
import { tropical } from "../src/games/party/content/maps.ts";
import { activePlayer,
  createMatch,
  createPlayer } from "../src/games/party/engine/engine.ts";
import { eligiblePlutoNodes } from "../src/games/party/engine/economy.ts";
import { botAction } from "../src/games/party/engine/bots.ts";
import { parseMessage } from "../src/games/party/network/protocol.ts";
import { isLevel4PlutoStealReady,
  plutoStealRoundsLeft } from "../src/games/party/properties/properties.ts";

const settings = { ...DEFAULT_SETTINGS, victory: "coins", coinTarget: 300 };
const plutoSettings = {
  ...DEFAULT_SETTINGS,
  victory: "plutos",
  plutoTarget: 5,
};
const [A, B] = tropical.nodes.filter((n) => n.type === "property");
const players = () =>
  Array.from({ length: 4 }, (_, i) => createPlayer(`p${i}`, `Player ${i}`, i));
function started() {
  let i = 0;
  const v = [0.9, 0.7, 0.4, 0.1];
  return advance(
    createMatch(players(), settings, () => 0.4),
    settings,
    () => v[i++ % 4],
  );
}
const P = (s, id) => s.players.find((p) => p.id === id);
const prop = (s, node = A) => s.properties.find((p) => p.nodeId === node.id);
// Puts the active player (p0) on a property with the landing about to resolve.
function landing(configure = () => {}, node = A, cfg = settings) {
  const s = started();
  P(s, "p0").currentNodeId = node.id;
  s.phase = "RESOLVE_TILE";
  configure(s);
  return { s: advance(s, cfg, () => 0.4), cfg };
}
const owned =
  (level, owner = "p1", node = A) =>
  (s) => {
    Object.assign(prop(s, node), { ownerPlayerId: owner, level });
  };
const act = (s, action, id = "p0", cfg = settings) =>
  applyAction(s, id, action, cfg, () => 0.4);

test("six properties, all unowned, and none eligible for Golden Plutos", () => {
  const s = started();
  assert.equal(s.properties.length, 6);
  assert.ok(
    s.properties.every((p) => p.ownerPlayerId === null && p.level === 0),
  );
  assert.ok(!eligiblePlutoNodes(tropical).some((id) => id === A.id));
  assert.equal(tropical.propertyName, "Outpost");
});

test("purchase: offer, cost 5, owner and level 1, coins leave the economy", () => {
  const { s } = landing();
  assert.equal(s.phase, "PROPERTY_OFFER");
  const bought = act(s, { type: "BUY_PROPERTY", nodeId: A.id });
  assert.equal(P(bought, "p0").coins, 20 - PROPERTY_CONFIG.purchaseCost);
  assert.equal(prop(bought).ownerPlayerId, "p0");
  assert.equal(prop(bought).level, 1);
  assert.equal(bought.bank, 0);
  assert.equal(bought.phase, "TURN_END");
  assert.equal(bought.events.at(-1).text, "PLAYER 0 CLAIMED AN OUTPOST");
});
test("cannot buy with fewer than 5 coins (no offer is made)", () => {
  const { s } = landing((m) => (P(m, "p0").coins = 4));
  assert.equal(s.phase, "TURN_END");
  assert.equal(prop(s).ownerPlayerId, null);
  const forced = structuredClone(s);
  forced.phase = "PROPERTY_OFFER";
  assert.throws(() => act(forced, { type: "BUY_PROPERTY", nodeId: A.id }));
});
test("declining leaves the property unowned", () => {
  const { s } = landing();
  const left = act(s, { type: "LEAVE_PROPERTY" });
  assert.equal(prop(left).level, 0);
  assert.equal(P(left, "p0").coins, 20);
  assert.equal(left.phase, "TURN_END");
});
test("duplicate purchase and duplicate upgrade fail", () => {
  const { s } = landing();
  const bought = act(s, { type: "BUY_PROPERTY", nodeId: A.id });
  assert.throws(() => act(bought, { type: "BUY_PROPERTY", nodeId: A.id }));
  const up = landing(owned(1, "p0"));
  const upgraded = act(up.s, { type: "UPGRADE_PROPERTY", nodeId: A.id });
  assert.throws(() =>
    act(upgraded, { type: "UPGRADE_PROPERTY", nodeId: A.id }),
  );
  assert.equal(prop(upgraded).level, 2);
});

test("upgrades cost 5 and progress to Level 4, the maximum", () => {
  let s = landing(owned(1, "p0")).s;
  for (const level of [2, 3, 4]) {
    assert.equal(s.phase, "PROPERTY_OFFER");
    s = act(s, { type: "UPGRADE_PROPERTY", nodeId: A.id });
    assert.equal(prop(s).level, level);
    s.phase = "PROPERTY_OFFER";
  }
  assert.equal(P(s, "p0").coins, 20 - 15);
  assert.throws(() => act(s, { type: "UPGRADE_PROPERTY", nodeId: A.id }));
  const max = landing(owned(4, "p0")).s;
  assert.equal(max.phase, "TURN_END");
});
test("non-owner cannot upgrade; poor owner cannot upgrade", () => {
  const forced = landing(owned(1, "p1")).s;
  forced.phase = "PROPERTY_OFFER";
  assert.throws(() => act(forced, { type: "UPGRADE_PROPERTY", nodeId: A.id }));
  const poor = landing((m) => {
    owned(1, "p0")(m);
    P(m, "p0").coins = 4;
  }).s;
  assert.equal(poor.phase, "TURN_END");
  poor.phase = "PROPERTY_OFFER";
  assert.throws(() => act(poor, { type: "UPGRADE_PROPERTY", nodeId: A.id }));
});

for (const [level, toll] of [
  [1, 3],
  [2, 5],
  [3, 10],
]) {
  test(`level ${level} toll: visitor pays ${toll} to owner, no upgrade offered`, () => {
    const { s } = landing(owned(level));
    assert.equal(P(s, "p0").coins, 20 - toll);
    assert.equal(P(s, "p1").coins, 20 + toll);
    assert.equal(s.phase, "TURN_END");
    assert.equal(prop(s).level, level);
  });
}
test("toll caps at the visitor's balance and never goes negative", () => {
  const { s } = landing((m) => {
    owned(3)(m);
    P(m, "p0").coins = 4;
  });
  assert.equal(P(s, "p0").coins, 0);
  assert.equal(P(s, "p1").coins, 24);
});

test("level 4: visitor with a Pluto loses one, owner gains it, cooldown recorded", () => {
  const { s } = landing((m) => {
    owned(4)(m);
    m.round = 10;
    P(m, "p0").goldenPlutos = 2;
    P(m, "p1").goldenPlutos = 1;
  });
  assert.equal(P(s, "p0").goldenPlutos, 1);
  assert.equal(P(s, "p1").goldenPlutos, 2);
  assert.equal(P(s, "p0").coins, 20);
  assert.equal(prop(s).level4LastTriggeredRound, 10);
});
test("level 4: visitor without a Pluto pays up to 15 and does not start cooldown", () => {
  const { s } = landing(owned(4));
  assert.equal(P(s, "p0").coins, 5);
  assert.equal(P(s, "p1").coins, 35);
  assert.equal(prop(s).level4LastTriggeredRound, null);
  const poor = landing((m) => {
    owned(4)(m);
    P(m, "p0").coins = 6;
  }).s;
  assert.equal(P(poor, "p0").coins, 0);
});
test("cooldown boundary: rounds 11 and 12 blocked, round 13 ready", () => {
  const p = { level: 4, level4LastTriggeredRound: 10 };
  assert.deepEqual(
    [10, 11, 12, 13].map((r) => isLevel4PlutoStealReady(p, r)),
    [false, false, false, true],
  );
  assert.equal(plutoStealRoundsLeft(p, 11), 2);
  assert.equal(plutoStealRoundsLeft(p, 13), 0);
});
test("cooling down: visitor pays up to 10 coins and keeps the Pluto", () => {
  const { s } = landing((m) => {
    owned(4)(m);
    m.round = 11;
    prop(m).level4LastTriggeredRound = 10;
    P(m, "p0").goldenPlutos = 1;
  });
  assert.equal(P(s, "p0").goldenPlutos, 1);
  assert.equal(P(s, "p0").coins, 10);
  assert.equal(P(s, "p1").coins, 30);
  const ready = landing((m) => {
    owned(4)(m);
    m.round = 13;
    prop(m).level4LastTriggeredRound = 10;
    P(m, "p0").goldenPlutos = 1;
  }).s;
  assert.equal(P(ready, "p0").goldenPlutos, 0);
  assert.equal(prop(ready).level4LastTriggeredRound, 13);
});
test("cooldown is tracked per property", () => {
  const { s } = landing((m) => {
    owned(4)(m);
    owned(4, "p1", B)(m);
    m.round = 11;
    prop(m).level4LastTriggeredRound = 10;
    P(m, "p0").goldenPlutos = 1;
  }, B);
  assert.equal(P(s, "p0").goldenPlutos, 0);
  assert.equal(prop(s, B).level4LastTriggeredRound, 11);
  assert.equal(prop(s).level4LastTriggeredRound, 10);
});

test("Pluto theft can win the match immediately", () => {
  const { s } = landing(
    (m) => {
      owned(4)(m);
      P(m, "p0").goldenPlutos = 1;
      P(m, "p1").goldenPlutos = 4;
    },
    A,
    plutoSettings,
  );
  assert.equal(s.winner, "p1");
  assert.equal(s.phase, "GAME_OVER");
});
test("coin toll can win a coin match immediately", () => {
  const { s } = landing(
    (m) => {
      owned(2)(m);
      P(m, "p1").coins = 298;
    },
    A,
    { ...settings, coinTarget: 300 },
  );
  assert.equal(s.winner, "p1");
  assert.equal(s.phase, "GAME_OVER");
});
test("tolls do no HP damage", () => {
  const { s } = landing(owned(3));
  assert.equal(P(s, "p0").hp, 20);
});

test("server validation: wrong node, wrong phase, wrong turn, forged fields", () => {
  const { s } = landing();
  assert.throws(() => act(s, { type: "BUY_PROPERTY", nodeId: B.id }));
  assert.throws(() => act(s, { type: "UPGRADE_PROPERTY", nodeId: A.id }));
  assert.throws(() => act(s, { type: "BUY_PROPERTY", nodeId: A.id }, "p1"));
  const other = started();
  assert.throws(() => act(other, { type: "BUY_PROPERTY", nodeId: A.id }));
  assert.throws(() => act(other, { type: "LEAVE_PROPERTY" }));
  const bought = act(s, { type: "BUY_PROPERTY", nodeId: A.id });
  const owner = structuredClone(bought);
  owner.phase = "PROPERTY_OFFER";
  P(owner, "p0").coins = 20;
  Object.assign(prop(owner), { ownerPlayerId: "p2", level: 2 });
  assert.throws(() => act(owner, { type: "BUY_PROPERTY", nodeId: A.id }));
  assert.deepEqual(
    parseMessage({
      type: "ACTION",
      action: {
        type: "BUY_PROPERTY",
        nodeId: A.id,
        cost: 0,
        level: 4,
        owner: "x",
      },
    }),
    { type: "ACTION", action: { type: "BUY_PROPERTY", nodeId: A.id } },
  );
  assert.throws(() =>
    parseMessage({ type: "ACTION", action: { type: "BUY_PROPERTY" } }),
  );
});

test("bots decide by difficulty", () => {
  const decide = (difficulty, coins, random = () => 0.9, level = 0) => {
    const { s } = landing((m) => {
      P(m, "p0").difficulty = difficulty;
      P(m, "p0").coins = coins;
      if (level) owned(level, "p0")(m);
    });
    return botAction(s, tropical, random, settings).type;
  };
  assert.equal(
    decide("easy", 20, () => 0.1),
    "BUY_PROPERTY",
  );
  assert.equal(
    decide("easy", 20, () => 0.9),
    "LEAVE_PROPERTY",
  );
  assert.equal(decide("medium", 10), "BUY_PROPERTY");
  assert.equal(decide("medium", 9), "LEAVE_PROPERTY");
  assert.equal(decide("extreme", 8), "BUY_PROPERTY");
  assert.equal(
    decide("medium", 10, () => 0, 2),
    "UPGRADE_PROPERTY",
  );
  assert.equal(
    decide("medium", 9, () => 0, 2),
    "LEAVE_PROPERTY",
  );
});

test("duplicate offers never double-resolve: active player resolves once", () => {
  const { s } = landing(owned(2));
  assert.equal(P(s, "p0").coins, 15);
  assert.equal(advance(s, settings, () => 0.4).phase, "ITEM_PHASE");
  assert.equal(activePlayer(s).id, "p0");
});
