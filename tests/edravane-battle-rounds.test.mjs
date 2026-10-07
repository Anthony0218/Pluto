import test from "node:test";
import assert from "node:assert/strict";
import {
  createCampaign,
  applyCommand,
  advanceCampaign,
  advanceTactical,
  loadSave,
} from "../src/games/MedievalKingdoms/edravane/simulation.ts";
import {
  makeBattle,
  startCombat,
  finishBattle,
  autoResolve,
  troopCount,
  woundedCount,
} from "../src/games/MedievalKingdoms/edravane/battle.ts";
import {
  battleForecast,
  defaultPlan,
  reinforcementSources,
} from "../src/games/MedievalKingdoms/edravane/battleRounds.ts";
function fixture({
  biome = "plains",
  castle,
  city,
  own = { levies: 700, spearmen: 150, archers: 100, heavy: 0, cavalry: 50 },
  enemy = own,
  morale = 85,
} = {}) {
  const s = createCampaign("auremarch");
  const a = s.armies.find((a) => a.house === "auremarch-0");
  const e = s.armies.find((a) => a.house === "high-cairn-0");
  s.houses.find((h) => h.id === e.house).reasons.push("Human commander");
  Object.assign(a, {
    garrison: false,
    troops: structuredClone(own),
    hex: "8:6",
    morale,
  });
  Object.assign(e, {
    garrison: false,
    troops: structuredClone(enemy),
    hex: "7:6",
    morale: 85,
  });
  const d = s.districts.find((d) => d.id === e.hex);
  Object.assign(d, {
    biome,
    castle,
    city,
    road: false,
    owner: e.house,
    occupation: undefined,
  });
  s.armies = [a, e];
  s.wars = ["auremarch|high-cairn"];
  const b = makeBattle(s, a, e, a.hex);
  startCombat(b);
  s.battles = [b];
  return { s, a, e, b, d };
}
function command(s, army, order, positions) {
  const b = s.battles[0];
  const a = s.armies.find((a) => a.id === army);
  return applyCommand(
    s,
    { house: a.house },
    {
      type: "battlePlan",
      battle: b.id,
      army,
      round: b.rounds.round,
      plan: { ...defaultPlan(order), ...(positions ? { positions } : {}) },
    },
  );
}
function round(f, own = "advance", enemy = "advance", positions) {
  let s = command(f.s, f.a.id, own, positions);
  return command(s, f.e.id, enemy);
}
const forces = (kind, count = 1000) => ({
  levies: 0,
  spearmen: 0,
  archers: 0,
  heavy: 0,
  cavalry: 0,
  [kind]: count,
});
test("battle rounds wait for both humans, reject unauthorized, duplicate and stale orders, and never advance on elapsed time", () => {
  const f = fixture();
  const before = JSON.stringify(f.s);
  assert.throws(
    () =>
      applyCommand(
        f.s,
        { house: f.a.house },
        {
          type: "battlePlan",
          battle: f.b.id,
          army: f.e.id,
          round: 1,
          plan: defaultPlan(),
        },
      ),
    /not under/,
  );
  assert.equal(JSON.stringify(f.s), before);
  let s = command(f.s, f.a.id, "hold");
  assert.equal(s.battles[0].rounds.round, 1);
  assert.equal(s.battles[0].formations[0].count, f.b.formations[0].count);
  assert.throws(() => command(s, f.a.id, "flank"), /already committed/);
  assert.deepEqual(advanceTactical(s), s);
  s = command(s, f.e.id, "advance");
  assert.equal(s.battles[0].rounds.round, 2);
  assert.equal(s.tick, f.s.tick);
  assert.throws(
    () =>
      applyCommand(
        s,
        { house: f.a.house },
        {
          type: "battlePlan",
          battle: f.b.id,
          army: f.a.id,
          round: 1,
          plan: defaultPlan(),
        },
      ),
    /stale/,
  );
  assert.throws(
    () =>
      applyCommand(
        s,
        { house: f.a.house },
        {
          type: "battlePlan",
          battle: f.b.id,
          army: f.a.id,
          round: 2,
          plan: { order: "flank", positions: { cavalry: "sky" } },
        },
      ),
    /positions/,
  );
});
test("braced spearmen stop cavalry and the actual combat explains the counter", () => {
  const spear = fixture({ own: forces("cavalry"), enemy: forces("spearmen") });
  const infantry = fixture({ own: forces("cavalry"), enemy: forces("levies") });
  const s = round(spear, "flank", "hold"),
    i = round(infantry, "flank", "hold");
  const loss = (state, id) =>
    1000 - state.battles[0].formations.find((f) => f.army === id).count;
  assert.ok(loss(s, spear.e.id) < loss(i, infantry.e.id));
  assert.ok(loss(s, spear.a.id) > loss(i, infantry.a.id));
  assert.match(s.battles[0].rounds.log[0], /braced spearmen/);
});
test("flanks reach protected archers on open ground but forests and castles stop cavalry", () => {
  const options = {
    own: forces("cavalry"),
    enemy: { ...forces("archers", 400), levies: 600 },
  };
  const open = fixture(options),
    forest = fixture({ ...options, biome: "forest" }),
    castle = fixture({ ...options, castle: { level: 3, guard: 500 } });
  const a = round(open, "flank", "volley"),
    b = round(forest, "flank", "volley"),
    c = round(castle, "flank", "volley");
  const archers = (s) =>
    s.battles[0].formations.find(
      (f) => f.army === open.e.id && f.kind === "archers",
    ).count;
  assert.ok(archers(a) < archers(b));
  assert.ok(archers(a) < archers(c));
  assert.match(a.battles[0].rounds.log[0], /enemy rear/);
  assert.match(b.battles[0].rounds.log[0], /difficult terrain/);
  assert.match(c.battles[0].rounds.log[0], /castle defenses/);
  const braced = fixture({
    own: forces("cavalry"),
    enemy: { ...forces("archers", 400), spearmen: 600 },
  });
  const protectedRear = round(braced, "flank", "hold");
  assert.equal(
    protectedRear.battles[0].formations.find(
      (f) => f.army === braced.e.id && f.kind === "archers",
    ).count,
    400,
  );
  assert.doesNotMatch(
    protectedRear.battles[0].rounds.log.join(" "),
    /archers are exposed/,
  );
});
test("rear archers fight better than exposed front archers and volley gives a real benefit", () => {
  const opts = {
    own: { ...forces("archers", 500), levies: 500 },
    enemy: forces("levies"),
  };
  const rear = fixture(opts),
    front = fixture(opts),
    advance = fixture(opts);
  const a = round(rear, "volley", "hold"),
    b = round(front, "volley", "hold", { archers: "front", levies: "front" }),
    c = round(advance, "advance", "hold");
  const enemy = (s) =>
    s.battles[0].formations.find((f) => f.army === rear.e.id).count;
  assert.ok(enemy(a) < enemy(b));
  assert.ok(enemy(a) < enemy(c));
  assert.match(b.battles[0].rounds.log[0], /exposed in melee/);
});
test("terrain, castle level, morale, fatigue, loyalty and food affect the battle forecast and actual losses", () => {
  const base = fixture({ own: forces("archers"), enemy: forces("spearmen") });
  const low = fixture({
    own: forces("archers"),
    enemy: forces("spearmen"),
    morale: 35,
  });
  low.a.supply = 0.1;
  low.a.fatigue = 85;
  low.a.loyalty = 20;
  assert.ok(
    battleForecast(base.s, base.b).chance > battleForecast(low.s, low.b).chance,
  );
  const hill = fixture({ biome: "hills" }),
    plain = fixture(),
    level2 = fixture({ castle: { level: 2, guard: 500 } }),
    level3 = fixture({ castle: { level: 3, guard: 500 } });
  assert.ok(
    battleForecast(hill.s, hill.b).chance <
      battleForecast(plain.s, plain.b).chance,
  );
  assert.ok(
    battleForecast(level3.s, level3.b).chance <
      battleForecast(level2.s, level2.b).chance,
  );
  const a = round(base, "volley", "hold"),
    b = round(low, "volley", "hold");
  assert.ok(
    a.battles[0].formations.find((f) => f.army === base.e.id).count <
      b.battles[0].formations.find((f) => f.army === low.e.id).count,
  );
});
test("casualties split into wounded and dead without double-counting; retreat preserves and applies results only once", () => {
  const f = fixture();
  let s = round(f);
  const b = s.battles[0];
  for (const formation of b.formations)
    assert.equal(
      formation.count + formation.wounded + formation.dead,
      formation.initial,
    );
  s = command(s, f.a.id, "retreat");
  s = command(s, f.e.id, "hold");
  assert.equal(s.battles.length, 0);
  assert.equal(s.tick, f.s.tick);
  const report = s.battleReports[0];
  for (const side of report.sides)
    assert.equal(side.healthy + side.wounded + side.dead + side.captured, 1000);
  const a = s.armies.find((a) => a.id === f.a.id);
  assert.ok(a);
  assert.ok(woundedCount(a) > 0);
  const before = structuredClone(s);
  finishBattle(s, b, f.e.id);
  assert.deepEqual(s, before);
  assert.equal(s.appliedResults.filter((id) => id === b.id).length, 1);
});
test("wounded recover on their own supplied turn, cities heal faster, wounds cannot fight or disappear", () => {
  function recover(city, supply = true) {
    const f = fixture();
    f.s.battles = [];
    f.s.armies = [f.a];
    Object.assign(f.a, {
      troops: forces("levies", 0),
      wounded: { levies: 100 },
      hex: "8:6",
    });
    const d = f.s.districts.find((d) => d.id === f.a.hex);
    Object.assign(d, {
      owner: f.a.house,
      city,
      castle: undefined,
      occupation: undefined,
    });
    f.s.houses.find((h) => h.id === f.a.house).stock.grain = supply ? 500 : 0;
    if (!supply)
      for (const field of f.s.districts.filter((d) => d.owner === f.a.house))
        field.resource = "iron";
    f.s.turns.ending = "auremarch";
    f.s.turns.prepared = true;
    return advanceCampaign(f.s, "auremarch").armies.find(
      (a) => a.id === f.a.id,
    );
  }
  const city = recover("major"),
    camp = recover(undefined),
    starved = recover("major", false);
  assert.equal(troopCount(city), 25);
  assert.equal(woundedCount(city), 75);
  assert.equal(troopCount(camp), 10);
  assert.equal(woundedCount(camp), 90);
  assert.equal(troopCount(starved), 0);
  assert.equal(woundedCount(starved), 100);
});
test("city reserves reinforce only the friendly defender once, preserving castle guards and paying coins and food", () => {
  const f = fixture({ city: "major" });
  const reserve = structuredClone(f.e);
  reserve.id = "reserve";
  reserve.garrison = true;
  reserve.hex = "7:6";
  reserve.troops = forces("levies", 700);
  f.s.armies.push(reserve);
  assert.equal(reinforcementSources(f.s, f.b, f.a).length, 0);
  const h = f.s.houses.find((h) => h.id === f.e.house),
    food = h.stock.grain,
    coins = h.treasury;
  const cmd = {
    type: "battleReinforce",
    battle: f.b.id,
    army: f.e.id,
    reserve: reserve.id,
  };
  const s = applyCommand(f.s, { house: f.e.house }, cmd);
  assert.equal(troopCount(s.armies.find((a) => a.id === reserve.id)), 600);
  assert.equal(troopCount(s.armies.find((a) => a.id === f.e.id)), 1100);
  const paid = s.houses.find((x) => x.id === h.id);
  assert.equal(paid.treasury, coins - 10);
  assert.equal(paid.stock.grain, food - 10);
  assert.throws(() => applyCommand(s, { house: f.e.house }, cmd), /reserves/);
});
test("bots use the same rounds and casualty accounting; low-morale formations rout and commanders lose morale", () => {
  const f = fixture({ morale: 0 });
  let s = round(f);
  assert.equal(s.battles.length, 0);
  assert.ok(
    s.battleReports[0].log.some((l) => l.includes("breaks and retreats")),
  );
  const hurt = fixture();
  for (const formation of hurt.b.formations.filter(
    (f) => f.army === hurt.a.id,
  )) {
    formation.wounded = Math.floor(formation.initial * 0.65);
    formation.count -= formation.wounded;
  }
  const shaken = round(hurt, "hold", "hold");
  assert.ok(
    (shaken.battles[0]?.rounds.log ?? shaken.battleReports[0].log).some((l) =>
      l.includes("commander is incapacitated"),
    ),
  );
  const ai = fixture();
  ai.s.houses.forEach(
    (h) => (h.reasons = h.reasons.filter((r) => r !== "Human commander")),
  );
  autoResolve(ai.s, ai.b);
  assert.equal(ai.s.battles.length, 0);
  assert.ok(ai.s.battleReports[0].round <= 20);
  for (const side of ai.s.battleReports[0].sides)
    assert.equal(side.healthy + side.wounded + side.dead + side.captured, 1000);
});
test("wounds, pending rounds and reports survive saves; invalid wounded counts reject and old saves retain legacy battles", () => {
  const f = fixture();
  f.a.wounded = { spearmen: 50 };
  let s = command(f.s, f.a.id, "hold");
  assert.deepEqual(loadSave(JSON.stringify(s)), JSON.parse(JSON.stringify(s)));
  const bad = structuredClone(s);
  bad.armies[0].wounded = { levies: -1 };
  assert.throws(() => loadSave(JSON.stringify(bad)), /wounded/);
  s = command(s, f.e.id, "retreat");
  assert.deepEqual(loadSave(JSON.stringify(s)).battleReports, s.battleReports);
  const old = fixture();
  delete old.b.rounds;
  assert.equal(loadSave(JSON.stringify(old.s)).battles[0].rounds, undefined);
});

test("mustering and summoning transfer healthy troops without duplicating wounded soldiers", () => {
  let s = createCampaign("auremarch");
  const capital = s.armies.find(
    (a) => a.house === "auremarch-0" && a.garrison && a.hex === "8:6",
  );
  capital.wounded = { levies: 80, spearmen: 20 };
  s = applyCommand(
    s,
    { house: "auremarch-0" },
    { type: "muster", army: capital.id, count: 500 },
  );
  assert.equal(
    s.armies.reduce((n, a) => n + woundedCount(a), 0),
    100,
  );
  const v = s.armies.find((a) => a.house === "auremarch-1" && a.garrison);
  v.wounded = { levies: 100 };
  s = applyCommand(
    s,
    { house: "auremarch-0" },
    { type: "summon", house: v.house },
  );
  assert.equal(
    s.armies.reduce((n, a) => n + woundedCount(a), 0),
    200,
  );
});
test("encounter withdrawal preserves casualty accounting and a disconnected opponent completes committed rounds as a bot", () => {
  const f = fixture();
  f.b.phase = "encounter";
  const retreated = applyCommand(
    f.s,
    { house: f.a.house },
    { type: "retreat", battle: f.b.id, army: f.a.id },
  );
  const side = retreated.battleReports[0].sides.find((a) => a.army === f.a.id);
  assert.equal(side.healthy + side.wounded + side.dead + side.captured, 1000);
  assert.ok(side.dead + side.wounded <= 25);
  const waiting = fixture();
  let s = command(waiting.s, waiting.a.id, "advance");
  s.houses.find((h) => h.id === waiting.e.house).reasons = [];
  s = advanceTactical(s);
  assert.equal(s.battles[0].rounds.round, 2);
  assert.equal(s.tick, 0);
});
