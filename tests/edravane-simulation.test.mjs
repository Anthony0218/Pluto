import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createCampaign as createTurnCampaign,
  applyCommand,
  advanceCampaign,
  advanceTactical,
  canControl,
  heir,
  loadSave as loadTurnSave,
  SAVE_KEY,
} from "../src/games/MedievalKingdoms/edravane/simulation.ts";
import {
  NATIONS,
  BALANCE,
  production,
  neighbors,
  findPath,
} from "../src/games/MedievalKingdoms/edravane/world.ts";
import {
  autoResolve,
  finishBattle,
  makeBattle,
  startCombat,
  troopCount,
} from "../src/games/MedievalKingdoms/edravane/battle.ts";
// Mechanical fixtures deliberately exclude scheduling; turn/response behavior has its own suite.
function createCampaign(...args) {
  const s = createTurnCampaign(...args);
  delete s.turns;
  return s;
}
function loadSave(raw) {
  const s = loadTurnSave(raw);
  if (!JSON.parse(raw).turns) delete s.turns;
  return s;
}
const actor = { house: "auremarch-0" };
const command = (s, c, a = actor) => applyCommand(s, a, c);
test("all eight selectable crowns, 333 land fields across two continents, forty estates, distinct titles and legacy lock", () => {
  for (const n of NATIONS) {
    const s = createCampaign(n.id);
    assert.equal(
      s.houses.find((h) => h.id === `${n.id}-0`).reasons[0],
      "Human commander",
    );
    assert.equal(s.armies.find((a) => a.house === `${n.id}-0`).hex, n.capital);
  }
  const s = createCampaign();
  assert.equal(s.districts.filter((d) => d.nation).length, 333);
  assert.equal(s.houses.length, 40);
  assert.equal(s.titles.length, 8);
  for (const h of s.houses) {
    assert.ok(s.districts.some((d) => d.owner === h.id));
    assert.equal(h.family.length, 3);
    assert.ok(h.ambition);
  }
  for (const d of s.districts.filter((d) => d.nation && d.biome !== "island"))
    assert.ok(
      NATIONS.some((n) => n.capital === d.id || findPath(s.districts, n.capital, d.id).length > 0),
    );
  assert.throws(
    () => command(s, { type: "move", army: "army-auremarch-0", hex: "legacy" }),
    /Raise a mobile|No contiguous/,
  );
  assert.throws(() => createCampaign("invalid"), /Unknown nation/);
  assert.equal(s.districts.find((d) => d.id === "legacy").owner, null);
  assert.ok(!JSON.stringify(s).includes("Aeldren"));
  assert.ok(!JSON.stringify(s).includes("Frostholm"));
});
test("qualified land and origin bonuses are configurable and do not double stack", () => {
  const s = createCampaign();
  for (const [nation, biome, r, m] of [
    ["auremarch", "plains", "grain", BALANCE.grain],
    ["high-cairn", "mountains", "iron", BALANCE.iron],
    ["dunwald", "forest", "timber", BALANCE.timber],
    ["sylvarenne", "forest", "herbs", BALANCE.herbs],
    ["graskor", "steppe", "livestock", BALANCE.livestock],
  ]) {
    const d = s.districts.find(
      (d) => d.nation === nation && d.biome === biome && d.resource === r,
    );
    assert.equal(production(d), 6 * m);
  }
  const a = s.armies[0];
  a.garrison = false; // Winter attrition applies to field troops.
  a.hex = "9:0";
  a.troops = { levies: 1000, spearmen: 0, archers: 0, heavy: 0, cavalry: 0 };
  a.origin = "varnesk";
  const varnesk = advanceCampaign(s);
  a.origin = "auremarch";
  const normal = advanceCampaign(s);
  assert.equal(varnesk.armies.find((b) => b.id === a.id).troops.levies, 952);
  assert.equal(normal.armies.find((b) => b.id === a.id).troops.levies, 940);
});
test("vassal refusal, partial delayed service, bounded pledge control and return", () => {
  let s = createCampaign();
  s = command(s, { type: "summon", house: "auremarch-4" });
  assert.match(s.houses.find((h) => h.id === "auremarch-4").summons, /Refused/);
  assert.throws(
    () => command(s, { type: "move", army: "army-auremarch-2", hex: "7:6" }),
    /not under/,
  );
  s = command(s, { type: "summon", house: "auremarch-2" });
  const contingent = s.armies.find((a) => a.pledgedTo === actor.house);
  assert.equal(troopCount(contingent), 900);
  assert.ok(canControl(s, actor, contingent));
  assert.ok(
    !canControl(
      s,
      actor,
      s.armies.find((a) => a.id === "army-auremarch-2"),
    ),
  );
  assert.throws(
    () => command(s, { type: "summon", house: "auremarch-2" }),
    /Already pledged/,
  );
  s.houses.find((h) => h.id === "auremarch-1").loyalty = 50;
  s = command(s, { type: "summon", house: "auremarch-1" });
  const delayed = s.armies.find(
    (a) => a.house === "auremarch-1" && a.pledgedTo,
  );
  assert.equal(troopCount(delayed), 250);
  assert.ok(!canControl(s, actor, delayed));
  for (let i = 0; i < 3; i++) s = advanceCampaign(s);
  assert.ok(
    canControl(
      s,
      actor,
      s.armies.find((a) => a.id === delayed.id),
    ),
  );
  s.tick = contingent.serviceUntil;
  const original = troopCount(
    s.armies.find((a) => a.id === "army-auremarch-2"),
  );
  s = advanceCampaign(s);
  assert.ok(!s.armies.some((a) => a.id === contingent.id));
  assert.equal(
    troopCount(s.armies.find((a) => a.id === "army-auremarch-2")),
    original + 900,
  );
});
test("land and maritime trade deliver cargo, apply transport costs, blockades, shortages and sea hazards", () => {
  let s = createCampaign("saltmere");
  const a = { house: "saltmere-0" };
  const from = s.districts.find(
    (d) => d.owner === a.house && d.port && d.shipyard,
  );
  assert.ok(from);
  const to = s.districts.filter((d) => d.owner && d.nation !== "saltmere" && d.port)
    .map((d) => ({ d, path: findPath(s.districts, from.id, d.id, true) }))
    .filter(({ path }) => path.length && path.some((id) => s.districts.find((d) => d.id === id).biome === "sea"))
    .sort((a, b) => a.path.length - b.path.length)[0]?.d;
  assert.ok(to);
  s = command(
    s,
    {
      type: "route",
      from: from.id,
      to: to.id,
      resource: "luxury",
      maritime: true,
    },
    a,
  );
  assert.equal(s.houses.find((h) => h.id === a.house).treasury, 420 - 68);
  const land = s.districts.filter((d) => d.owner && d.owner !== a.house)
    .map((d) => ({ d, path: findPath(s.districts, from.id, d.id) }))
    .filter(({ path }) => path.length).sort((a, b) => a.path.length - b.path.length)[0]?.d;
  s = command(
    s,
    {
      type: "route",
      from: from.id,
      to: land.id,
      resource: "luxury",
      maritime: false,
    },
    a,
  );
  s.config.maritimeHazard = 0;
  const travelTurns = Math.max(...s.routes.map((route) => route.path.length)) + 8;
  for (let i = 0; i < travelTurns; i++) s = advanceCampaign(s);
  assert.ok(s.routes[0].delivered > 0);
  assert.ok(s.routes[1].delivered > 0);
  assert.match(s.routes[0].status, /Delivered|transit/);
  const blocker = s.armies.find(
    (b) => b.origin === s.houses.find((h) => h.id === to.owner).nation,
  );
  blocker.hex = s.routes[0].path[1];
  s.wars.push(["saltmere", blocker.origin].sort().join("|"));
  s = advanceCampaign(s);
  assert.match(s.routes[0].status, /war|Blockaded/);
  assert.throws(() =>
    command(
      s,
      {
        type: "route",
        from: "legacy",
        to: to.id,
        resource: "grain",
        maritime: false,
      },
      a,
    ),
  );
});
test("dynasty marriage, legal heirs, council recognition and claimant crown transfer", () => {
  let s = createCampaign();
  assert.equal(heir(s, s.houses[0]).gender, "male");
  assert.equal(
    heir(
      s,
      s.houses.find((h) => h.id === "saltmere-0"),
    ).gender,
    "female",
  );
  s.houses.find((h) => h.id === "sylvarenne-0").legitimacy = 20;
  assert.equal(
    heir(
      s,
      s.houses.find((h) => h.id === "sylvarenne-0"),
    ),
    undefined,
  );
  s = command(s, { type: "marry", house: "high-cairn-0" });
  const h = s.houses[0];
  assert.ok(h.family[1].spouse);
  assert.equal(h.relations["high-cairn-0"], 25);
  const ruler = h.ruler;
  s = command(s, { type: "succession" });
  assert.notEqual(s.houses[0].ruler, ruler);
  assert.equal(s.houses[0].family[0].alive, false);
  s = command(s, { type: "pretender", house: "auremarch-4" });
  const rebel = s.armies.find((a) => a.house === "auremarch-4"),
    royal = s.armies.find((a) => a.house === actor.house);
  const b = makeBattle(s, rebel, royal, rebel.hex);
  s.battles.push(b);
  finishBattle(s, b, rebel.id);
  assert.equal(
    s.titles.find((t) => t.nation === "auremarch").holder,
    "auremarch-4",
  );
  assert.equal(s.houses.find((h) => h.id === "auremarch-4").liege, null);
});
test("encounter triggers on hostile movement, valid withdrawal, queued campaign freeze, persistent results once", () => {
  let s = createCampaign();
  const royal = s.armies.find((a) => a.house === actor.house),
    enemy = s.armies.find((a) => a.house === "high-cairn-0");
  const dest = neighbors(s.districts, royal.hex).find((d) => d.owner);
  royal.garrison = false; // This encounter fixture deploys the seat force.
  enemy.hex = dest.id;
  s = command(s, { type: "war", nation: "high-cairn" });
  s = command(s, { type: "move", army: royal.id, hex: enemy.hex });
  s = advanceCampaign(advanceCampaign(s));
  assert.equal(s.battles.length, 1);
  assert.equal(s.battles[0].phase, "encounter");
  assert.deepEqual(advanceCampaign(s), s);
  assert.throws(
    () => command(s, { type: "challenge", hex: royal.hex }),
    /frozen/,
  );
  const b = structuredClone(s.battles[0]);
  s = command(s, { type: "retreat", battle: b.id, army: royal.id });
  assert.equal(s.battles.length, 0);
  assert.ok(s.armies.find((a) => a.id === royal.id).hex !== b.hex);
  assert.ok(
    troopCount(s.armies.find((a) => a.id === royal.id)) < troopCount(royal),
  );
  const tick = s.tick;
  finishBattle(s, b, enemy.id);
  assert.equal(s.tick, tick);
});
test("real-time combat accepts six orders with authorization and writes losses and captured commanders", () => {
  let s = createCampaign();
  const a = s.armies.find((a) => a.house === actor.house),
    b = s.armies.find((a) => a.house === "high-cairn-0");
  const battle = makeBattle(s, a, b, a.hex);
  s.battles.push(battle);
  s = command(s, { type: "stand", battle: battle.id, army: a.id });
  assert.equal(s.battles[0].phase, "combat");
  const f = s.battles[0].formations.find((f) => f.army === a.id);
  for (const order of ["move", "face", "hold", "attack", "charge", "withdraw"])
    s = command(s, {
      type: "order",
      battle: battle.id,
      formation: f.id,
      order,
      x: 50,
      y: 50,
      width: 12,
      facing: 90,
    });
  assert.throws(
    () =>
      command(s, {
        type: "order",
        battle: battle.id,
        formation: `${b.id}-levies`,
        order: "attack",
        x: 50,
        y: 50,
        width: 12,
        facing: 0,
      }),
    /not under/,
  );
  s = command(s, {
    type: "order",
    battle: battle.id,
    formation: f.id,
    order: "attack",
    x: 50,
    y: 50,
    width: 12,
    facing: 0,
  });
  for (let i = 0; i < 725 && s.battles.length; i++)
    s = advanceTactical(s, 0.25);
  assert.equal(s.battles.length, 0);
  assert.equal(s.appliedResults.length, 1);
  assert.ok(
    s.armies.some((v) => v.id === a.id && troopCount(v) < troopCount(a)),
  );
  const c = createCampaign();
  const x = c.armies[0],
    y = c.armies.find((a) => a.house === "high-cairn-0");
  const encounter = makeBattle(c, x, y, x.hex);
  c.battles.push(encounter);
  encounter.formations
    .filter((f) => f.army === y.id)
    .forEach((f) => (f.count = 0));
  finishBattle(c, encounter, x.id);
  assert.equal(
    c.houses
      .find((h) => h.id === y.house)
      .family.find((p) => p.id === y.commander).imprisonedBy,
    x.house,
  );
});
test("AI-only resolution and tactical pause use compatible aftermath; campaign remains frozen", () => {
  const s = createCampaign("saltmere");
  const a = s.armies[0],
    b = s.armies.find((a) => a.house === "high-cairn-0");
  const encounter = makeBattle(s, a, b, a.hex);
  s.battles.push(encounter);
  autoResolve(s, encounter);
  assert.equal(s.appliedResults.length, 1);
  assert.equal(s.battles.length, 0);
  let p = createCampaign();
  const human = p.armies[0],
    other = p.armies.find((a) => a.house === "high-cairn-0");
  const battle = makeBattle(p, human, other, human.hex);
  p.battles.push(battle);
  startCombat(battle);
  p = command(p, { type: "battlePause", battle: battle.id, approve: true });
  assert.deepEqual(advanceTactical(p), p);
});
test("gold and silver puzzles grant capped one-time rewards, wrong answers and cooldown persist", () => {
  for (const kind of ["gold", "silver"]) {
    let s = createCampaign();
    const hex = s.districts.find((d) => d.owner === actor.house);
    hex.bonus = kind;
    s = command(s, { type: "challenge", hex: hex.id });
    const c = s.challenges[0],
      cash = s.houses[0].treasury,
      strength = troopCount(s.armies[0]);
    s = command(s, { type: "answer", challenge: c.id, choice: c.answer });
    assert.equal(
      kind === "gold"
        ? s.houses[0].treasury - cash
        : troopCount(s.armies[0]) - strength,
      kind === "gold" ? 60 : 20,
    );
    assert.throws(
      () => command(s, { type: "answer", challenge: c.id, choice: c.answer }),
      /unclaimed/,
    );
    assert.throws(
      () => command(s, { type: "challenge", hex: hex.id }),
      /cooldown/,
    );
    const saved = loadSave(JSON.stringify(s));
    assert.deepEqual(saved.rewards, s.rewards);
    for (let i = 0; i < 2; i++) {
      s.tick += 30;
      s = command(s, { type: "challenge", hex: hex.id });
      const next = s.challenges.at(-1);
      s = command(s, {
        type: "answer",
        challenge: next.id,
        choice: next.answer,
      });
    }
    s.tick += 30;
    assert.throws(
      () => command(s, { type: "challenge", hex: hex.id }),
      /limit/,
    );
  }
});
test("versioned saves roundtrip and all legacy assets, saves, and entry points remain", () => {
  const s = createCampaign();
  assert.deepEqual(loadSave(JSON.stringify(s)), JSON.parse(JSON.stringify(s)));
  assert.notEqual(SAVE_KEY, "medieval-kingdoms-campaign-progress-v1");
  assert.throws(
    () => loadSave(JSON.stringify({ ...s, version: 1 })),
    /supported/,
  );
  assert.match(
    readFileSync("src/games/MedievalKingdoms/campaignProgress.ts", "utf8"),
    /medieval-kingdoms-campaign-progress-v1/,
  );
  assert.match(
    readFileSync("src/main.tsx", "utf8"),
    /medieval-kingdoms\/legacy/,
  );
  assert.ok(
    readFileSync("public/MedievalKingdoms/maps/continent.png").length > 1000,
  );
});
test("occupation and conquest change ownership after a held garrison, while regional production provenance is preserved", () => {
  let s = createCampaign();
  const district = s.districts.find(
    (d) => d.nation === "high-cairn" && d.biome === "mountains",
  );
  const original = production(district),
    royal = s.armies[0];
  royal.hex = district.id;
  district.occupation = actor.house;
  district.occupiedAt = 0;
  assert.throws(
    () => command(s, { type: "annex", hex: district.id }),
    /three campaign/,
  );
  s.tick = 3;
  s = command(s, { type: "annex", hex: district.id });
  const annexed = s.districts.find((d) => d.id === district.id);
  assert.equal(annexed.owner, actor.house);
  assert.equal(annexed.occupation, undefined);
  assert.equal(annexed.nation, "high-cairn");
  assert.equal(production({ ...annexed, unrest: 0 }), original);
  assert.ok(annexed.disputed);
  assert.throws(() => command(s, { type: "annex", hex: "legacy" }), /occupied/);
});
test("independent objective requests evaluate loyalty and lower contributions arrive after a delay", () => {
  let s = createCampaign();
  const v = s.houses.find((h) => h.id === "auremarch-1"),
    a = s.armies.find((a) => a.house === v.id);
  a.garrison = false; // Independent field commander fixture.
  s = command(s, { type: "objective", army: a.id, hex: "8:6" });
  assert.ok(s.armies.find((b) => b.id === a.id).path.length);
  assert.match(s.houses.find((h) => h.id === v.id).summons, /accepted/);
  s.houses.find((h) => h.id === v.id).loyalty = 40;
  s = command(s, { type: "objective", army: a.id, hex: "8:6" });
  assert.match(s.houses.find((h) => h.id === v.id).summons, /declined/);
  assert.ok(
    !canControl(
      s,
      actor,
      s.armies.find((b) => b.id === a.id),
    ),
  );
});
test("simultaneous human encounters queue consistently and block result or reward commands on later scenes", () => {
  let s = createCampaign();
  const a = s.armies[0],
    b = s.armies[5],
    c = s.armies[10],
    d = s.armies[15];
  s.houses.find((h) => h.id === c.house).reasons.push("Human commander");
  const first = makeBattle(s, a, b, a.hex),
    second = makeBattle(s, c, d, c.hex);
  s.battles = [first, second];
  assert.deepEqual(advanceCampaign(s), s);
  assert.throws(
    () =>
      command(
        s,
        { type: "stand", battle: second.id, army: c.id },
        { house: c.house },
      ),
    /first queued/,
  );
  finishBattle(s, first, a.id);
  assert.equal(s.battles[0].id, second.id);
  assert.deepEqual(advanceCampaign(s), s);
});
test("invalid commands are atomic, geometry is finite, storms consume bounded cargo, and economy pause freezes rewards", () => {
  let s = createCampaign("saltmere");
  const actor = { house: "saltmere-0" },
    from = s.districts.find(
      (d) => d.owner === actor.house && d.port && d.shipyard,
    ),
    to = s.districts.find(
      (d) =>
        d.owner &&
        d.owner !== actor.house &&
        d.port &&
        findPath(s.districts, from.id, d.id, true).length,
    );
  const cash = s.houses.find((h) => h.id === actor.house).treasury;
  assert.throws(() =>
    applyCommand(s, actor, {
      type: "recruit",
      army: "army-saltmere-0",
      kind: "dragon",
    }),
  );
  assert.equal(s.houses.find((h) => h.id === actor.house).treasury, cash);
  s = applyCommand(s, actor, {
    type: "route",
    from: from.id,
    to: to.id,
    resource: "timber",
    maritime: true,
  });
  s.config.maritimeHazard = 1;
  s.routes[0].progress = s.routes[0].path.length - 1;
  s = advanceCampaign(s);
  assert.equal(s.routes[0].delivered, 0);
  assert.match(s.routes[0].status, /Storm loss/);
  s = applyCommand(s, actor, { type: "pause", paused: true });
  assert.deepEqual(advanceCampaign(s), s);
});
test("reference geography places the southwest and southeast crowns correctly, with actual islands and all extreme hazards", () => {
  const s = createCampaign();
  const ilyr = NATIONS.find((n) => n.id === "ilyr-coast"),
    salt = NATIONS.find((n) => n.id === "saltmere"),
    graskor = NATIONS.find((n) => n.id === "graskor"),
    dun = NATIONS.find((n) => n.id === "dunwald");
  assert.ok(ilyr.anchor[0] < salt.anchor[0]);
  assert.ok(graskor.anchor[1] > dun.anchor[1]);
  const hazards = ["glacier", "volcanic", "desert", "marsh"];
  hazards.forEach((b) => assert.ok(s.districts.some((d) => d.biome === b)));
  assert.equal(s.districts.filter((d) => d.biome === "island").length, 6);
  assert.ok(
    s.districts.some(
      (d) =>
        d.nation === "saltmere" &&
        !findPath(s.districts, NATIONS[0].capital, d.id).length,
    ),
  );
});
test("naval troop transport permits island campaigns, respects ship capacity and persists its passage", () => {
  let s = createCampaign("saltmere");
  const actor = { house: "saltmere-0" };
  s.houses.find((h) => h.id === actor.house).treasury = 1000;
  s.houses.find((h) => h.id === actor.house).stock.timber = 200;
  s = applyCommand(s, actor, {
    type: "muster",
    army: "army-saltmere-0",
    count: 500,
  });
  const a = s.armies.find((a) => a.house === actor.house && !a.garrison);
  const to = s.districts.find(
    (d) =>
      d.port &&
      d.nation !== "saltmere" &&
      d.owner &&
      findPath(s.districts, a.hex, d.id, true).length,
  );
  assert.ok(to);
  assert.ok(!findPath(s.districts, a.hex, to.id).length);
  s = applyCommand(s, actor, { type: "embark", army: a.id, hex: to.id });
  assert.equal(s.armies.find((b) => b.id === a.id).voyage.ships, 7);
  assert.equal(s.houses.find((h) => h.id === actor.house).treasury, 474);
  assert.equal(
    loadSave(JSON.stringify(s)).armies.find((b) => b.id === a.id).voyage
      .destination,
    to.id,
  );
  s.config.maritimeHazard = 0;
  for (let i = 0; i < 35 && s.armies.find((b) => b.id === a.id).voyage; i++)
    s = advanceCampaign(s);
  assert.equal(s.armies.find((b) => b.id === a.id).hex, to.id);
  assert.equal(s.armies.find((b) => b.id === a.id).voyage, undefined);
  assert.throws(
    () => applyCommand(s, actor, { type: "embark", army: a.id, hex: "legacy" }),
    /shipyard|port/,
  );
});
test("import contracts buy food from other houses and internal transfers never mint Ilyr export bonuses", () => {
  let s = createCampaign("saltmere");
  const actor = { house: "saltmere-0" },
    from = s.districts.find((d) => d.owner === actor.house && d.port),
    to = s.districts.find(
      (d) =>
        d.port &&
        d.owner &&
        d.owner !== actor.house &&
        findPath(s.districts, from.id, d.id, true).length,
    );
  s.houses.find((h) => h.id === actor.house).stock.grain = 5;
  s = applyCommand(s, actor, {
    type: "route",
    from: from.id,
    to: to.id,
    resource: "grain",
    maritime: true,
    import: true,
  });
  s.config.maritimeHazard = 0;
  s.routes[0].progress = s.routes[0].path.length - 1;
  s = advanceCampaign(s);
  assert.ok(s.houses.find((h) => h.id === actor.house).stock.grain > 10);
  assert.match(s.routes[0].status, /Imported/);
  let internal = createCampaign("ilyr-coast");
  const h = internal.houses.find((h) => h.id === "ilyr-coast-0"),
    estates = internal.districts.filter((d) => d.owner === h.id);
  const origin = estates.find((d) => d.resource === "luxury"),
    destination = estates.find(
      (d) =>
        d.id !== origin.id &&
        findPath(internal.districts, origin.id, d.id).length,
    );
  internal = applyCommand(
    internal,
    { house: h.id },
    {
      type: "route",
      from: origin.id,
      to: destination.id,
      resource: "luxury",
      maritime: false,
    },
  );
  internal.routes[0].progress = internal.routes[0].path.length - 1;
  const baseline = structuredClone(internal);
  baseline.routes = [];
  const expected = advanceCampaign(baseline),
    result = advanceCampaign(internal);
  assert.ok(result.routes[0].delivered > 0);
  assert.ok(Math.abs(result.houses.find((v) => v.id === h.id).treasury - (expected.houses.find((v) => v.id === h.id).treasury - 1)) < 1e-8);
});
test("queued AI battles drain after a human encounter and expired pledges cannot freeze combat", () => {
  let s = createCampaign();
  const human = s.armies[0],
    opponent = s.armies[5],
    ai = s.armies[10],
    enemy = s.armies[15];
  const first = makeBattle(s, human, opponent, human.hex),
    second = makeBattle(s, ai, enemy, ai.hex);
  s.battles = [first, second];
  s = applyCommand(s, actor, {
    type: "retreat",
    battle: first.id,
    army: human.id,
  });
  assert.equal(s.battles.length, 0);
  assert.equal(s.appliedResults.length, 2);
  const expired = createCampaign();
  const contingent = expired.armies[1],
    other = expired.armies[5];
  contingent.pledgedTo = actor.house;
  contingent.serviceUntil = expired.tick;
  expired.battles.push(makeBattle(expired, contingent, other, contingent.hex));
  const advanced = advanceTactical(expired);
  assert.equal(advanced.battles.length, 0);
  assert.equal(advanced.appliedResults.length, 1);
});
test("formation frontage changes damage and facing limits rear attacks", () => {
  const original = createCampaign(),
    a = original.armies[0],
    b = original.armies[5];
  original.houses.find((h) => h.id === b.house).reasons.push("Human commander");
  const battle = makeBattle(original, a, b, a.hex);
  startCombat(battle);
  battle.seconds = 20;
  battle.formations = battle.formations.filter((f) => f.kind === "levies");
  battle.formations.forEach((f, i) =>
    Object.assign(f, {
      x: i ? 54 : 50,
      y: 50,
      order: "hold",
      count: 100,
      initial: 100,
      facing: i ? 180 : 0,
      reserve: false,
    }),
  );
  original.battles = [battle];
  const narrow = structuredClone(original),
    wide = structuredClone(original),
    rear = structuredClone(original);
  narrow.battles[0].formations[0].width = 4;
  wide.battles[0].formations[0].width = 24;
  rear.battles[0].formations[0].facing = 180;
  const n = advanceTactical(narrow),
    w = advanceTactical(wide),
    r = advanceTactical(rear);
  assert.ok(
    w.battles[0].formations[1].count < n.battles[0].formations[1].count,
  );
  assert.ok(
    r.battles[0].formations[1].count >
      advanceTactical(original).battles[0].formations[1].count,
  );
});
test("every selectable crown begins with reachable gold and silver challenge fields", () => {
  const s = createCampaign();
  for (const nation of NATIONS) {
    const fields = s.districts.filter((d) => d.owner === `${nation.id}-0`);
    assert.ok(fields.some((d) => d.bonus === "gold"));
    assert.ok(fields.some((d) => d.bonus === "silver"));
  }
});

test("new campaigns start with 5,000 royal capital troops, 2,000 secondary/minor troops, guarded castles and no mobile clutter", () => {
  const s = createCampaign();
  assert.equal(s.armies.filter((a) => !a.garrison).length, 0);
  for (const h of s.houses) {
    const capital = s.districts.find(
      (d) => d.owner === h.id && d.seat === "capital",
    );
    assert.ok(capital);
    assert.equal(capital.city, "major");
    assert.equal(capital.castle.level, 2);
    assert.equal(
      troopCount(
        s.armies.find((a) => a.house === h.id && a.hex === capital.id),
      ),
      h.role === "crown" ? 5000 : 2000,
    );
    const secondary = s.districts.find(
      (d) => d.owner === h.id && d.seat === "secondary",
    );
    assert.equal(!!secondary, h.role === "crown");
    if (secondary)
      assert.equal(
        troopCount(
          s.armies.find((a) => a.house === h.id && a.hex === secondary.id),
        ),
        2000,
      );
  }
  for (const d of s.districts.filter((d) => d.castle && !d.seat)) {
    assert.equal(
      troopCount(s.armies.find((a) => a.hex === d.id && a.garrison)),
      500,
    );
    assert.ok(d.city || neighbors(s.districts, d.id).some((n) => n.city));
  }
  const next = advanceCampaign(s);
  assert.ok(next.armies.every((a) => a.garrison));
  assert.equal(
    troopCount(next.armies.find((a) => a.id === "army-varnesk-0")),
    5000,
    "stationary guards do not suffer marching attrition",
  );
});

test("musters transfer troops, spend both coins and food, preserve guards and enforce the mobile army cap", () => {
  let s = createCampaign(),
    start = s.houses[0];
  s = command(s, { type: "muster", army: "army-auremarch-0", count: 500 });
  const host = s.armies.find((a) => !a.garrison);
  assert.equal(troopCount(host), 500);
  assert.equal(troopCount(s.armies[0]), 4500);
  assert.equal(s.houses[0].treasury, start.treasury - 50);
  assert.equal(s.houses[0].stock.grain, start.stock.grain - 20);
  assert.throws(
    () => command(s, { type: "move", army: s.armies[0].id, hex: "7:6" }),
    /mobile army/,
  );
  assert.throws(
    () => command(s, { type: "muster", army: "army-auremarch-1", count: 500 }),
    /not under/,
  );
  for (const count of [NaN, Infinity, -500, 2500, 500.5])
    assert.throws(
      () => command(s, { type: "muster", army: s.armies[0].id, count }),
      /between/,
    );
  const noFood = structuredClone(s);
  noFood.houses[0].stock.grain = 0;
  assert.throws(
    () => command(noFood, { type: "muster", army: s.armies[0].id, count: 500 }),
    /food/,
  );
  assert.equal(noFood.houses[0].treasury, s.houses[0].treasury);
  s = command(s, { type: "muster", army: s.armies[0].id, count: 500 });
  s = command(s, { type: "muster", army: s.armies[0].id, count: 500 });
  assert.throws(
    () => command(s, { type: "muster", army: s.armies[0].id, count: 500 }),
    /Three mobile/,
  );
  const minor = createCampaign();
  const raised = applyCommand(
    minor,
    { house: "auremarch-1" },
    { type: "muster", army: "army-auremarch-1", count: 1500 },
  );
  assert.equal(
    troopCount(raised.armies.find((a) => a.id === "army-auremarch-1")),
    500,
  );
  assert.throws(
    () =>
      applyCommand(
        raised,
        { house: "auremarch-1" },
        { type: "muster", army: "army-auremarch-1", count: 100 },
      ),
    /500 soldiers/,
  );
});

test("manual harvest enforces ownership, regrowth, occupation and pause; grain imports remain usable", () => {
  let s = createCampaign();
  s.houses[0].stock.grain = 20;
  const d = s.districts.find((d) => d.id === "8:6");
  s = command(s, { type: "harvest", hex: d.id });
  assert.equal(s.houses[0].stock.grain, 52);
  assert.throws(() => command(s, { type: "harvest", hex: d.id }), /regrowing/);
  const foreign = s.districts.find((d) => d.owner === "high-cairn-0");
  assert.throws(
    () => command(s, { type: "harvest", hex: foreign.id }),
    /your unoccupied/,
  );
  s.paused = true;
  assert.deepEqual(advanceCampaign(s), s);
  assert.throws(() => command(s, { type: "harvest", hex: d.id }), /regrowing/);
  s.tick += 6;
  s = command(s, { type: "harvest", hex: d.id });
  assert.equal(s.houses[0].stock.grain, 84);
  s.districts.find((x) => x.id === d.id).occupation = "high-cairn-0";
  s.tick += 6;
  assert.throws(() => command(s, { type: "harvest", hex: d.id }), /unoccupied/);
});

test("recruiting lets minor houses grow beyond 2,000 and requires food and coins atomically", () => {
  let s = createCampaign();
  const a = { house: "auremarch-1" },
    id = "army-auremarch-1";
  s = applyCommand(s, a, {
    type: "recruit",
    army: id,
    kind: "levies",
    count: 100,
  });
  assert.equal(troopCount(s.armies.find((a) => a.id === id)), 2100);
  const h = s.houses.find((h) => h.id === a.house);
  assert.equal(h.treasury, 50);
  assert.equal(h.stock.grain, 150);
  assert.throws(
    () =>
      applyCommand(s, a, {
        type: "recruit",
        army: id,
        kind: "levies",
        count: 100,
      }),
    /coins/,
  );
  h.treasury = 1000;
  h.stock.grain = 0;
  assert.throws(
    () =>
      applyCommand(s, a, {
        type: "recruit",
        army: id,
        kind: "levies",
        count: 100,
      }),
    /food shortage/,
  );
  assert.equal(h.treasury, 1000);
  assert.equal(troopCount(s.armies.find((a) => a.id === id)), 2100);
});

test("cities increase trade capacity and tax income, including food imports", () => {
  let s = createCampaign();
  const from = s.districts.find((d) => d.id === "8:6");
  const to = s.districts.find(
    (d) =>
      d.city &&
      d.owner !== actor.house &&
      findPath(s.districts, from.id, d.id).length,
  );
  s = command(s, {
    type: "route",
    from: from.id,
    to: to.id,
    resource: "grain",
    import: true,
    maritime: false,
  });
  assert.equal(s.routes[0].capacity, 36);
  const withoutCity = structuredClone(s);
  delete withoutCity.districts.find((d) => d.id === from.id).city;
  const urban = advanceCampaign(s),
    rural = advanceCampaign(withoutCity);
  assert.equal(urban.houses[0].treasury - rural.houses[0].treasury, 4);
  s.config.maritimeHazard = 0;
  s.routes[0].progress = s.routes[0].path.length - 1;
  s = advanceCampaign(s);
  assert.match(s.routes[0].status, /Imported/);
  assert.ok(s.routes[0].delivered > 0);
});

test("level 3 castle upgrade spends building resources, improves combat defense and cannot be replayed or stolen", () => {
  let s = createCampaign();
  s = command(s, { type: "upgradeCastle", hex: "8:6" });
  assert.equal(s.districts.find((d) => d.id === "8:6").castle.level, 3);
  assert.equal(s.houses[0].treasury, 120);
  assert.equal(s.houses[0].stock.timber, 65);
  assert.equal(s.houses[0].stock.iron, 75);
  assert.throws(
    () => command(s, { type: "upgradeCastle", hex: "8:6" }),
    /already level 3/,
  );
  assert.throws(
    () => command(s, { type: "upgradeCastle", hex: NATIONS[1].capital }),
    /own unoccupied/,
  );
  const weaker = structuredClone(s);
  weaker.districts.find((d) => d.id === "8:6").castle.level = 2;
  const original = s,
    a = original.armies[5],
    b = original.armies[0];
  original.houses.find((h) => h.id === a.house).reasons.push("Human commander");
  const battle = makeBattle(original, a, b, "8:6");
  startCombat(battle);
  battle.seconds = 20;
  battle.formations = battle.formations.filter((f) => f.kind === "levies");
  battle.formations.forEach((f, i) =>
    Object.assign(f, {
      x: i ? 54 : 50,
      y: 50,
      order: "hold",
      count: 100,
      initial: 100,
      facing: i ? 180 : 0,
      reserve: false,
    }),
  );
  original.battles = [battle];
  weaker.battles = [structuredClone(battle)];
  const strong = advanceTactical(original),
    weak = advanceTactical(weaker);
  assert.ok(
    strong.battles[0].formations[1].count > weak.battles[0].formations[1].count,
    "fortified defenders suffer fewer casualties",
  );
  const automated = (level) => {
    const s = createCampaign();
    const d = s.districts.find((d) => d.id === "8:6");
    d.castle.level = level;
    d.biome = "plains";
    const a = s.armies[5],
      b = s.armies[0];
    a.troops = { levies: 600, spearmen: 0, archers: 0, heavy: 0, cavalry: 0 };
    b.troops = { levies: 500, spearmen: 0, archers: 0, heavy: 0, cavalry: 0 };
    const encounter = makeBattle(s, a, b, d.id);
    s.battles = [encounter];
    autoResolve(s, encounter);
    return s.districts.find((x) => x.id === d.id).occupation;
  };
  assert.equal(automated(1), "high-cairn-0");
  assert.equal(
    automated(3),
    undefined,
    "defending own castle liberates it rather than self-occupying",
  );
});

test("older campaign migration preserves mobile troops, money and save keys while adding usable seats", () => {
  const old = createCampaign();
  delete old.estateRules;
  old.armies = old.armies.filter((a) => a.id.startsWith("army-"));
  old.armies.forEach((a) => {
    delete a.garrison;
    a.troops = { levies: 210, spearmen: 0, archers: 0, heavy: 0, cavalry: 0 };
  });
  old.districts.forEach((d) => {
    delete d.seat;
    delete d.castle;
    delete d.city;
    delete d.farm;
  });
  old.houses[0].treasury = 777;
  const upgraded = loadSave(JSON.stringify(old));
  assert.equal(upgraded.houses[0].treasury, 777);
  assert.equal(
    upgraded.armies
      .filter((a) => !a.garrison)
      .reduce((n, a) => n + troopCount(a), 0),
    8400,
  );
  assert.equal(
    upgraded.districts.filter((d) => d.seat === "capital").length,
    40,
  );
  assert.equal(
    upgraded.armies
      .filter((a) => a.garrison)
      .reduce((n, a) => n + troopCount(a), 0),
    0,
  );
  assert.deepEqual(loadSave(JSON.stringify(upgraded)), upgraded);
});
