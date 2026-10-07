import test from "node:test";
import assert from "node:assert/strict";
import {
  createCampaign,
  applyCommand,
  dispatchCommand,
  advanceCampaign,
  loadSave,
  canControl,
} from "../src/games/MedievalKingdoms/edravane/simulation.ts";
import {
  justifiedWarReasons,
  routeBlockers,
  armyLoyalty,
  armyRebellionRisk,
} from "../src/games/MedievalKingdoms/edravane/politics.ts";
import {
  makeBattle,
  troopCount,
  atWar,
} from "../src/games/MedievalKingdoms/edravane/battle.ts";
import { neighbors } from "../src/games/MedievalKingdoms/edravane/world.ts";
const aure = { house: "auremarch-0" },
  cairn = { house: "high-cairn-0" };
const h = (s, id = aure.house) => s.houses.find((h) => h.id === id);
const act = (s, c, actor = aure) => applyCommand(s, actor, c);
function fixture() {
  let s = createCampaign();
  h(s, cairn.house).reasons.push("Human commander");
  s = act(s, { type: "muster", army: "army-auremarch-0", count: 500 });
  const a = s.armies.find((a) => !a.garrison && a.house === aure.house);
  const d = neighbors(s.districts, a.hex).find(
    (d) => d.owner && d.id !== a.hex,
  );
  const enemy = s.armies.find((a) => a.house === cairn.house);
  enemy.hex = d.id;
  enemy.garrison = false;
  enemy.troops = { levies: 1, spearmen: 0, archers: 0, heavy: 0, cavalry: 0 };
  const route = {
    id: "fixture-route",
    house: aure.house,
    from: a.hex,
    to: d.id,
    path: [a.hex, d.id],
    maritime: false,
    resource: "grain",
    capacity: 12,
    cost: 1,
    progress: 0,
    delivered: 0,
    status: "Ready",
  };
  s.routes.push(route);
  return { s, a: a.id, enemy: enemy.id, d: d.id, route: route.id };
}

test("one troop can blockade a neutral route; empty forces and friendly forces cannot", () => {
  const { s, enemy } = fixture(),
    r = s.routes[0],
    e = s.armies.find((a) => a.id === enemy);
  assert.equal(routeBlockers(s, r).length, 0);
  e.blockading = true;
  assert.equal(routeBlockers(s, r).length, 1);
  e.troops.levies = 0;
  assert.equal(routeBlockers(s, r).length, 0);
  e.troops.levies = 1;
  e.house = aure.house;
  assert.equal(routeBlockers(s, r).length, 0);
  e.house = cairn.house;
  e.blockading = false;
  s.wars.push("auremarch|high-cairn");
  assert.equal(routeBlockers(s, r).length, 1);
});

test("coastal armies block adjacent maritime lanes without blocking unrelated distant lanes", () => {
  const s = createCampaign(),
    port = s.districts.find((d) => d.port && d.owner?.startsWith("high-cairn"));
  const sea = neighbors(s.districts, port.id).find((d) => d.biome === "sea");
  const a = s.armies.find((a) => a.house === cairn.house);
  a.hex = port.id;
  a.blockading = true;
  const route = { house: aure.house, maritime: true, path: [sea.id] };
  assert.deepEqual(
    routeBlockers(s, route).map((a) => a.id),
    [a.id],
  );
  route.path = [
    s.districts.find(
      (d) => d.biome === "sea" && !neighbors(s.districts, port.id).includes(d),
    ).id,
  ];
  assert.equal(routeBlockers(s, route).length, 0);
});

test("blockade orders enforce field-force ownership and turn; march orders lift a blockade", () => {
  const { s, a, d } = fixture();
  assert.throws(
    () => act(s, { type: "blockade", army: "army-auremarch-0", enabled: true }),
    /field troop/,
  );
  assert.throws(
    () => act(s, { type: "blockade", army: a, enabled: true }, cairn),
    /not your turn/,
  );
  let next = act(s, { type: "blockade", army: a, enabled: true });
  assert.equal(next.armies.find((v) => v.id === a).blockading, true);
  next = act(next, { type: "move", army: a, hex: d });
  assert.equal(next.armies.find((v) => v.id === a).blockading, false);
});

test("a neutral blockade halts real cargo progress and clearing it resumes delivery", () => {
  const f = fixture();
  let s = f.s;
  s.armies.find((a) => a.id === f.enemy).blockading = true;
  delete s.turns;
  const before = {
    progress: s.routes[0].progress,
    delivered: s.routes[0].delivered,
  };
  s = advanceCampaign(s);
  assert.equal(s.routes[0].progress, before.progress);
  assert.equal(s.routes[0].delivered, before.delivered);
  assert.match(s.routes[0].status, /Blockaded/);
  s.armies.find((a) => a.id === f.enemy).blockading = false;
  s = advanceCampaign(s);
  assert.equal(s.routes[0].progress, 1);
  s = advanceCampaign(s);
  assert.ok(s.routes[0].delivered > 0);
});

test("trade obstruction justifies war with no new realm unrest or loyalty penalty, and informs the recipient", () => {
  const { s, enemy } = fixture();
  s.armies.find((a) => a.id === enemy).blockading = true;
  const before = structuredClone(s);
  assert.deepEqual(justifiedWarReasons(s, h(s), "high-cairn"), [
    "trade-blockade",
    "territorial-conquest",
  ]);
  const next = act(s, {
    type: "war",
    nation: "high-cairn",
    reason: "trade-blockade",
  });
  assert.equal(next.turns.pending[0].reason, "trade-blockade");
  assert.equal(next.warDeclarations[0].reason, "trade-blockade");
  assert.equal(h(next).unjustifiedWars, undefined);
  assert.deepEqual(
    next.districts.map((d) => d.unrest),
    before.districts.map((d) => d.unrest),
  );
  assert.deepEqual(
    next.houses.map((h) => h.loyalty),
    before.houses.map((h) => h.loyalty),
  );
  assert.deepEqual(
    next.armies.map((a) => a.loyalty),
    before.armies.map((a) => a.loyalty),
  );
});

test("fabricated justifications are rejected atomically; a sworn vassal blockade supports the crown", () => {
  const { s, enemy } = fixture(),
    before = JSON.stringify(s);
  assert.throws(
    () =>
      act(s, { type: "war", nation: "high-cairn", reason: "trade-blockade" }),
    /no current evidence/,
  );
  assert.equal(JSON.stringify(s), before);
  s.routes[0].house = "auremarch-1";
  s.armies.find((a) => a.id === enemy).blockading = true;
  assert.ok(
    justifiedWarReasons(s, h(s), "high-cairn").includes("trade-blockade"),
  );
});

test("a second unjustified war lowers vassal loyalty; justified declarations never increment that count", () => {
  const s = createCampaign();
  delete s.turns;
  const v = h(s, "auremarch-1"),
    originalOpinion = v.opinion;
  let next = act(s, {
    type: "war",
    nation: "high-cairn",
    reason: "unjustified",
  });
  assert.equal(h(next).unjustifiedWars, 1);
  assert.equal(h(next, v.id).opinion, originalOpinion);
  assert.ok(
    next.districts
      .filter((d) => h(next, d.owner)?.nation === "auremarch")
      .every((d) => d.unrest === 5),
  );
  next = act(next, { type: "war", nation: "varnesk", reason: "unjustified" });
  assert.equal(h(next).unjustifiedWars, 2);
  assert.equal(h(next, v.id).opinion, originalOpinion - 15);
  assert.ok(h(next, v.id).loyalty < v.loyalty);
  assert.equal(
    next.armies.find((a) => a.id === "army-auremarch-0").loyalty,
    73,
  );
  const d = next.districts.find((d) => d.owner === aure.house);
  d.occupation = "dunwald-0";
  next = act(next, { type: "war", nation: "dunwald", reason: "occupied-land" });
  assert.equal(h(next).unjustifiedWars, 2);
  assert.equal(h(next, v.id).opinion, originalOpinion - 15);
});

test("occupied realm land, captured family and an attacked marriage ally provide distinct verified reasons", () => {
  const s = createCampaign(),
    own = h(s),
    enemy = h(s, cairn.house),
    ally = h(s, "saltmere-0");
  s.districts.find((d) => d.owner === "auremarch-1").occupation = enemy.id;
  own.family[1].imprisonedBy = enemy.id;
  own.family[2].spouse = ally.family[1].id;
  ally.family[1].spouse = own.family[2].id;
  s.wars.push("high-cairn|saltmere");
  assert.deepEqual(justifiedWarReasons(s, own, enemy.nation), [
    "occupied-land",
    "captive-family",
    "territorial-conquest",
  ]);
  s.warDeclarations.push({
    from: enemy.nation,
    to: ally.nation,
    reason: "unjustified",
    tick: 0,
  });
  assert.deepEqual(justifiedWarReasons(s, own, enemy.nation), [
    "occupied-land",
    "captive-family",
    "defend-ally",
    "territorial-conquest",
  ]);
  s.wars = [];
  assert.ok(!justifiedWarReasons(s, own, enemy.nation).includes("defend-ally"));
});

test("hex attack atomically declares war, supplies target information and waits before entry", () => {
  const f = fixture();
  let s = f.s;
  s.districts.find((d) => d.id === f.d).owner = cairn.house;
  const initialHex = s.armies.find((a) => a.id === f.a).hex;
  const before = JSON.stringify(s);
  assert.throws(
    () => act(s, { type: "attack", army: f.a, hex: "legacy" }),
    /playable/,
  );
  assert.equal(JSON.stringify(s), before);
  s = act(s, { type: "attack", army: f.a, hex: f.d });
  assert.equal(s.turns.pending[0].kind, "war");
  assert.equal(s.turns.pending[0].hex, f.d);
  assert.equal(s.armies.find((a) => a.id === f.a).hex, initialHex);
  s = act(
    s,
    { type: "respond", reaction: s.turns.pending[0].id, choice: "defend" },
    cairn,
  );
  s = act(s, { type: "endTurn" });
  assert.equal(s.turns.pending[0].kind, "attack");
  assert.equal(s.turns.pending[0].hex, f.d);
  assert.equal(s.armies.find((a) => a.id === f.a).hex, initialHex);
  assert.equal(s.districts.find((d) => d.id === f.d).occupation, undefined);
  s = act(
    s,
    { type: "respond", reaction: s.turns.pending[0].id, choice: "withdraw" },
    cairn,
  );
  assert.equal(s.armies.find((a) => a.id === f.a).hex, f.d);
});

test("vassal loyalty and personal army loyalty both boost morale and tactical starting morale", () => {
  const s = createCampaign();
  delete s.turns;
  const own = s.armies.find((a) => a.house === aure.house),
    vassal = s.armies.find((a) => a.house === "auremarch-1");
  own.loyalty = 95;
  vassal.loyalty = 95;
  h(s, vassal.house).loyalty = 20;
  assert.equal(armyLoyalty(s, own), 95);
  assert.equal(armyLoyalty(s, vassal), 20);
  const enemy = s.armies.find((a) => a.house === cairn.house);
  const high = makeBattle(s, own, enemy, own.hex).formations.filter(
    (f) => f.army === own.id,
  )[0].morale;
  const low = makeBattle(s, vassal, enemy, vassal.hex).formations.filter(
    (f) => f.army === vassal.id,
  )[0].morale;
  assert.ok(high > low);
  const clone = structuredClone(s);
  h(clone, vassal.house).opinion = 10;
  h(clone, vassal.house).legitimacy = 10;
  const next = advanceCampaign(clone);
  assert.ok(
    next.armies.find((a) => a.id === own.id).morale >
      next.armies.find((a) => a.id === vassal.id).morale,
  );
});

test("low loyalty raises actual mutiny risk; a rebel royal host cannot be commanded and fights its own crown", () => {
  const f = fixture(),
    s = f.s,
    a = s.armies.find((a) => a.id === f.a);
  a.loyalty = 0;
  a.morale = 15;
  assert.equal(armyRebellionRisk(s, a), 0.2);
  a.loyalty = 80;
  assert.equal(armyRebellionRisk(s, a), 0);
  a.loyalty = 0;
  for (const d of s.districts.filter((d) => d.owner === aure.house))
    d.resource = "timber";
  h(s).stock.grain = 0;
  for (let seed = 0; seed < 10000; seed++)
    if (((Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296 < 0.2) {
      s.rng = seed;
      break;
    }
  const next = act(s, { type: "endTurn" }),
    rebel = next.armies.find((v) => v.id === a.id);
  assert.equal(rebel.rebel, true);
  assert.equal(canControl(next, aure, rebel), false);
  assert.equal(
    atWar(
      next,
      rebel,
      next.armies.find((v) => v.id === "army-auremarch-0"),
    ),
    true,
  );
});

test("new loyalty, blockade and war history persist while old saves remain lossless and invalid fields are rejected", () => {
  const f = fixture();
  f.s.armies.find((a) => a.id === f.a).blockading = true;
  f.s.armies.find((a) => a.id === f.a).loyalty = 43;
  let s = act(f.s, { type: "war", nation: "high-cairn" });
  const saved = loadSave(JSON.stringify(s));
  assert.deepEqual(saved, JSON.parse(JSON.stringify(s)));
  delete s.warDeclarations;
  for (const a of s.armies) {
    delete a.loyalty;
    delete a.blockading;
  }
  const troops = s.armies.map(troopCount),
    coins = h(s).treasury;
  const old = loadSave(JSON.stringify(s));
  assert.deepEqual(old.armies.map(troopCount), troops);
  assert.equal(h(old).treasury, coins);
  s.armies[0].loyalty = Infinity;
  assert.throws(() => loadSave(JSON.stringify(s)), /Invalid army loyalty/);
});

test("withdrawal does not silently bypass another hostile crown defending the same field", () => {
  const f = fixture();
  let s = f.s;
  s.districts.find((d) => d.id === f.d).owner = cairn.house;
  const third = s.armies.find((a) => a.house === "varnesk-0");
  third.hex = f.d;
  s.wars.push("auremarch|varnesk");
  s = act(s, { type: "attack", army: f.a, hex: f.d });
  s = act(
    s,
    { type: "respond", reaction: s.turns.pending[0].id, choice: "defend" },
    cairn,
  );
  s = act(s, { type: "endTurn" });
  s = act(
    s,
    { type: "respond", reaction: s.turns.pending[0].id, choice: "withdraw" },
    cairn,
  );
  assert.equal(s.districts.find((d) => d.id === f.d).occupation, undefined);
  assert.equal(s.turns.pending[0].to, "varnesk-0");
  assert.equal(s.turns.pending[0].hex, f.d);
});

test("a blockader already on your own hex can be attacked without moving or occupying your own estate", () => {
  const f = fixture();
  let s = f.s;
  const field = s.armies.find((a) => a.id === f.a).hex;
  const enemy = s.armies.find((a) => a.id === f.enemy);
  enemy.hex = field;
  enemy.blockading = true;
  s = act(s, {
    type: "attack",
    army: f.a,
    hex: field,
    reason: "trade-blockade",
  });
  assert.equal(s.turns.pending[0].to, cairn.house);
  s = act(
    s,
    { type: "respond", reaction: s.turns.pending[0].id, choice: "defend" },
    cairn,
  );
  s = act(s, { type: "endTurn" });
  assert.equal(s.turns.pending[0].kind, "attack");
  assert.equal(s.turns.pending[0].hex, field);
  s = act(
    s,
    { type: "respond", reaction: s.turns.pending[0].id, choice: "withdraw" },
    cairn,
  );
  assert.equal(s.districts.find((d) => d.id === field).occupation, undefined);
  assert.equal(s.armies.find((a) => a.id === f.a).hex, field);
});

test("mutineers block their former realm’s trade and respond as bots instead of obeying their former commander", () => {
  const f = fixture();
  let s = f.s;
  const army = s.armies.find((a) => a.id === f.a);
  const rebel = {
    ...structuredClone(army),
    id: "mutiny-test",
    name: "Mutineers",
    rebel: true,
  };
  s.armies.push(rebel);
  assert.ok(routeBlockers(s, s.routes[0]).some((a) => a.id === rebel.id));
  s = act(s, { type: "attack", army: army.id, hex: army.hex });
  s = dispatchCommand(s, aure, { type: "endTurn" });
  assert.equal(s.turns.pending.length, 0);
  assert.equal(s.battles[0].phase, "combat");
  assert.equal(
    canControl(
      s,
      aure,
      s.armies.find((a) => a.id === rebel.id),
    ),
    false,
  );
  const formation = s.battles[0].formations.find((f) => f.army === rebel.id);
  assert.throws(
    () =>
      act(s, {
        type: "order",
        battle: s.battles[0].id,
        formation: formation.id,
        order: "withdraw",
        x: 0,
        y: 0,
        facing: 0,
        width: 12,
      }),
    /not under/,
  );
});
