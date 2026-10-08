import test from "node:test";
import assert from "node:assert/strict";
import { canControl, createCampaign, applyCommand, loadSave, runAutomaticTurns } from "../src/games/MedievalKingdoms/edravane/simulation.ts";
import { armyControl, territoryControl } from "../src/pages/games/MedievalKingdoms/mapPresentation.ts";
import { advanceRealm, campaignRound, commandBonus, councilSkill, growDynasties, ruler, season, successionPreview } from "../src/games/MedievalKingdoms/edravane/realm.ts";
import { feedArmy, routeForecast, strategyView, supplyConnection, updateIntelligence, visibleDistricts } from "../src/games/MedievalKingdoms/edravane/logistics.ts";
import { advanceStrategy, truce, warScore } from "../src/games/MedievalKingdoms/edravane/campaignStrategy.ts";
import { hexDistance, neighbors } from "../src/games/MedievalKingdoms/edravane/world.ts";
import { autoResolve, makeBattle, finishBattle, troopCount } from "../src/games/MedievalKingdoms/edravane/battle.ts";
import { justifiedWarReasons } from "../src/games/MedievalKingdoms/edravane/politics.ts";
import { councilReply, makeCouncil } from "../src/games/MedievalKingdoms/edravane/multiplayer.ts";
import { defendingArmies } from "../src/games/MedievalKingdoms/edravane/turns.ts";

const actor = { house: "auremarch-0" }, other = { house: "high-cairn-0" };
const house = (s, id = actor.house) => s.houses.find((h) => h.id === id);
const act = (s, c, a = actor) => applyCommand(s, a, c);
test("loyal vassals muster independent task hosts from real reserves and retain castle guards", () => {
  const s = createCampaign(), v = house(s, "auremarch-1"), reserve = s.armies.find((a) => a.house === v.id && a.garrison);
  v.loyalty = 80;
  const troops = troopCount(reserve), coins = v.treasury, food = v.stock.grain;
  const destination = s.districts.find((d) => d.owner === actor.house && d.seat).id;
  const next = act(s, { type: "objective", army: reserve.id, hex: destination });
  const host = next.armies.find((a) => a.house === v.id && !a.garrison);
  assert.ok(host && host.path.length);
  assert.equal(host.objective, destination);
  assert.equal(canControl(next, actor, host), false);
  assert.equal(armyControl(next, house(next), host), "vassal");
  assert.equal(troopCount(next.armies.find((a) => a.id === reserve.id)) + troopCount(host), troops);
  assert.ok(troopCount(next.armies.find((a) => a.id === reserve.id)) >= 500);
  assert.equal(house(next, v.id).treasury, coins - Math.ceil(troopCount(host) * .1));
  assert.equal(house(next, v.id).stock.grain, food - Math.ceil(troopCount(host) * .04));
  assert.throws(() => act(next, { type: "move", army: host.id, hex: reserve.hex }), /command|control/i);
  const held = act(next, { type: "objective", army: reserve.id, hex: host.hex });
  assert.equal(held.armies.filter((a) => a.house === v.id && !a.garrison).length, 1);
  assert.deepEqual(held.armies.find((a) => a.id === host.id).path, []);
});
test("disloyal vassals refuse without spending supplies, raising troops, or replacing old orders", () => {
  const s = createCampaign(), v = house(s, "auremarch-1"), a = s.armies.find((a) => a.house === v.id);
  v.loyalty = 40; a.objective = a.hex; a.path = [a.hex];
  const next = act(s, { type: "objective", army: a.id, hex: s.districts.find((d) => d.owner === actor.house && d.seat).id });
  assert.deepEqual(next.armies, s.armies);
  assert.equal(house(next, v.id).treasury, v.treasury);
  assert.deepEqual(house(next, v.id).stock, v.stock);
  assert.match(house(next, v.id).summons, /declined/);
});
test("territory and army presentation follow occupation, rebellion and actual pledge authority", () => {
  const s = createCampaign(), h = house(s), v = house(s, "auremarch-1");
  const d = s.districts.find((d) => d.owner === v.id), a = s.armies.find((a) => a.house === v.id);
  assert.equal(territoryControl(s, h, d), "vassal");
  d.occupation = "high-cairn-0"; assert.equal(territoryControl(s, h, d), "foreign");
  d.occupation = h.id; assert.equal(territoryControl(s, h, d), "domain");
  a.pledgedTo = h.id; a.serviceUntil = s.tick + 2; a.delay = 0;
  assert.equal(armyControl(s, h, a), "pledged");
  a.delay = 1; assert.equal(armyControl(s, h, a), "awaiting");
  assert.throws(() => act(s, { type: "objective", army: a.id, hex: a.hex }), /independent/);
  a.delay = 0;
  a.serviceUntil = s.tick; assert.equal(armyControl(s, h, a), "vassal");
  v.rebellion = true; assert.equal(armyControl(s, h, a), "foreign");
  a.rebel = true; assert.equal(armyControl(s, h, a), "hostile");
});
function warFixture() {
  let s = createCampaign();
  s = act(s, { type: "war", nation: "high-cairn", reason: "territorial-conquest" });
  s = act(s, { type: "respond", reaction: s.turns.pending[0].id, choice: "defend" }, other);
  return s;
}
function siegeFixture() {
  let s = warFixture();
  s = act(s, { type: "muster", army: "army-auremarch-0", count: 1000 });
  const a = s.armies.find((a) => a.house === actor.house && !a.garrison);
  const castle = s.districts.find((d) => d.owner === other.house && d.castle);
  a.hex = neighbors(s.districts, castle.id).find((d) => d.owner).id;
  return { s, a, castle };
}
test("personalities are deterministic, advisers affect skills, and brave commanders affect combat", () => {
  const s = createCampaign(), again = createCampaign();
  assert.deepEqual(house(s).family.map((p) => p.traits), house(again).family.map((p) => p.traits));
  const a = s.armies[0]; ruler(house(s)).skills.command = 8; ruler(house(s)).traits = ["cautious"];
  assert.equal(commandBonus(s, a), 1);
  ruler(house(s)).traits = ["brave"]; assert.equal(commandBonus(s, a), 1.04);
});
test("chancellors improve bargains and spymasters extend actual scouting range", () => {
  const s = createCampaign(); ruler(house(s)).skills.diplomacy = 12;
  const base = act(s, { type: "bargain", house: "auremarch-1", offer: "lower-taxes" });
  house(s, "auremarch-2").contract.office = "chancellor"; ruler(house(s, "auremarch-2")).skills.diplomacy = 12;
  assert.equal(councilSkill(s, house(s), "diplomacy"), 16);
  const advised = act(s, { type: "bargain", house: "auremarch-1", offer: "lower-taxes" });
  assert.ok(house(advised, "auremarch-1").opinion > house(base, "auremarch-1").opinion);
  const target = s.districts.find((d) => d.nation === "saltmere");
  s.scouts = [{ house: actor.house, hex: target.id, until: 3 }];
  const before = visibleDistricts(s, house(s)); ruler(house(s)).skills.intrigue = 12;
  house(s, "auremarch-3").contract.office = "spymaster"; ruler(house(s, "auremarch-3")).skills.intrigue = 12;
  assert.ok(visibleDistricts(s, house(s)).size > before.size);
});
test("tax bargains change actual obligations and transfer actual income once, with atomic permission checks", () => {
  let s = createCampaign(); const id = "auremarch-1", before = house(s, id).obligation;
  const saved = structuredClone(s);
  assert.throws(() => act(s, { type: "bargain", house: "high-cairn-1", offer: "lower-taxes" }), /sworn vassals/);
  assert.deepEqual(s, saved);
  s = act(s, { type: "bargain", house: id, offer: "lower-taxes" });
  assert.equal(house(s, id).obligation, before + 200);
  assert.equal(house(s, id).contract.taxRate, 0.1);
  assert.equal(house(s, id).demand.status, "fulfilled");
  assert.throws(() => act(s, { type: "bargain", house: id, offer: "lower-taxes" }), /already granted/);
  const cash = house(s).treasury, vassalCash = house(s, id).treasury;
  advanceRealm(s, "auremarch"); assert.ok(house(s).treasury > cash); assert.ok(house(s, id).treasury < vassalCash);
});
test("council appointments secure succession support and cannot duplicate an office", () => {
  let s = createCampaign();
  s = act(s, { type: "bargain", house: "auremarch-4", offer: "council-seat", office: "marshal" });
  assert.ok(successionPreview(s, house(s)).supporters.some((h) => h.id === "auremarch-4"));
  assert.throws(() => act(s, { type: "bargain", house: "auremarch-2", offer: "council-seat", office: "marshal" }), /already occupied/);
});
test("border grants move estate ownership and its real reserves without minting troops", () => {
  let s = createCampaign();
  const d = s.districts.find((d) => d.owner === actor.house && !d.seat && s.districts.some((n) => n.nation && n.nation !== "auremarch" && hexDistance(d, n) === 1));
  assert.ok(d); const count = s.armies.reduce((n, a) => n + troopCount(a), 0);
  s = act(s, { type: "bargain", house: "auremarch-2", offer: "border-estate", hex: d.id });
  assert.equal(s.districts.find((v) => v.id === d.id).owner, "auremarch-2");
  assert.equal(s.armies.reduce((n, a) => n + troopCount(a), 0), count);
  assert.ok(s.armies.filter((a) => a.garrison && a.hex === d.id).every((a) => a.house === "auremarch-2"));
});
test("protected trade remembers a broken promise and a blockade costs opinion", () => {
  let s = createCampaign();
  s = act(s, { type: "bargain", house: "auremarch-3", offer: "protect-trade" });
  const v = house(s, "auremarch-3"), opinion = v.opinion;
  assert.ok(s.routes.some((r) => r.house === v.id));
  s.routes.find((r) => r.house === v.id).status = "Blockaded by enemy troops";
  advanceRealm(s, "high-cairn"); assert.equal(v.demand.status, "fulfilled");
  advanceRealm(s, "auremarch"); assert.equal(v.demand.status, "broken"); assert.equal(v.opinion, opinion - 20);
  assert.ok(s.events.some((e) => e.title === "A trade promise is broken"));
});
test("elective succession requires actual council support and nomination is restricted", () => {
  let s = createCampaign("sylvarenne"); const a = { house: "sylvarenne-0" }, h = house(s, a.house);
  for (const v of s.houses.filter((v) => v.liege === h.id)) { v.loyalty = 20; ruler(v).traits = ["ambitious"]; }
  assert.equal(successionPreview(s, h).recognized, false);
  assert.throws(() => act(s, { type: "succession" }, a), /recognized/);
  s = act(s, { type: "nominate", person: h.family[2].id }, a);
  assert.equal(house(s, a.house).designatedHeir, h.family[2].id);
  assert.throws(() => act(createCampaign(), { type: "nominate", person: "auremarch-0-h1" }), /elective/);
});
test("partition creates a cadet estate with unique people and conserved stocks and soldiers", () => {
  let s = createCampaign("varnesk"); const a = { house: "varnesk-0" };
  s = act(s, { type: "successionLaw", law: "partition" }, a);
  const h = house(s, a.house), before = { ...h.stock }, count = s.armies.reduce((n, a) => n + troopCount(a), 0);
  s = act(s, { type: "succession" }, a);
  const cadet = s.houses.find((h) => h.id.startsWith("cadet-")); assert.ok(cadet);
  assert.ok(s.districts.some((d) => d.owner === cadet.id));
  for (const resource of Object.keys(before)) assert.equal(house(s, a.house).stock[resource] + cadet.stock[resource], before[resource]);
  const people = s.houses.flatMap((h) => h.family.map((p) => p.id)); assert.equal(new Set(people).size, people.length);
  assert.equal(s.armies.reduce((n, a) => n + troopCount(a), 0), count);
  assert.deepEqual(loadSave(JSON.stringify(s)), JSON.parse(JSON.stringify(s)));
});
test("a minor can inherit under a regency, and marriage births carry both parents' claims", () => {
  let s = createCampaign(); const h = house(s); h.family[2].age = 12;
  s = act(s, { type: "succession" }); assert.ok(house(s).regent); assert.equal(ruler(house(s)).age, 12);
  const mother = house(s).family[1], father = house(s, other.house).family[2];
  mother.spouse = father.id; father.spouse = mother.id; s.tick = 120;
  growDynasties(s);
  const child = house(s).family.find((p) => p.id.startsWith("child-")); assert.ok(child);
  assert.deepEqual(new Set(child.claims), new Set(["auremarch", "high-cairn"]));
  child.age = 18; mother.alive = false;
  assert.ok(justifiedWarReasons(s, house(s), "high-cairn").includes("dynastic-claim"));
});
test("marriages to a human crown's vassal require the crown's consent", () => {
  let s = createCampaign();
  s = act(s, { type: "marry", house: "high-cairn-1" });
  assert.equal(s.turns.pending[0].to, other.house);
  s = act(s, { type: "respond", reaction: s.turns.pending[0].id, choice: "accept" }, other);
  assert.equal(house(s).family[1].spouse, "high-cairn-1-h1");
});
test("cut supply corridors consume carried stores only on the controlling realm's turn", () => {
  const s = createCampaign(), a = s.armies[0]; a.garrison = false;
  const isolated = s.districts.find((d) => d.nation === "graskor" && !neighbors(s.districts, d.id).some((n) => n.nation === "auremarch"));
  a.hex = isolated.id; a.provisions = 2;
  assert.equal(supplyConnection(s, a).connected, false);
  feedArmy(s, a, 5, "high-cairn"); assert.equal(a.provisions, 2);
  assert.equal(feedArmy(s, a, 5, "auremarch"), 1); assert.equal(a.provisions, 1);
  feedArmy(s, a, 5, "auremarch"); assert.equal(feedArmy(s, a, 5, "auremarch"), 0);
  const destination = s.districts.find((d) => d.nation === "graskor" && routeForecast(s, a, d.id).path.length >= 2);
  assert.ok(destination); assert.equal(routeForecast(s, a, destination.id).risk, true);
});
test("watchtowers and scouts reveal nearby enemies; old contacts persist without future orders leaking", () => {
  let s = createCampaign(); const enemy = s.armies.find((a) => a.house === "saltmere-0"); enemy.garrison = false;
  const distant = enemy.hex;
  updateIntelligence(s); assert.ok(!strategyView(s, actor.house).armies.some((a) => a.id === enemy.id));
  const watch = s.districts.find((d) => d.owner === actor.house); watch.watchtower = true;
  enemy.hex = watch.id; enemy.path = [distant]; updateIntelligence(s);
  let visible = strategyView(s, actor.house); assert.equal(visible.armies.find((a) => a.id === enemy.id).path.length, 0);
  const target = s.districts.find((d) => d.nation === "high-cairn" && s.districts.some((ours) => ours.owner === actor.house && hexDistance(ours, d) <= 6));
  s = act(s, { type: "scout", hex: target.id }); assert.ok(visibleDistricts(s, house(s)).has(target.id));
  assert.throws(() => act(s, { type: "scout", hex: target.id }), /already cover/);
  const hiddenArea = s.districts.find((d) => d.nation && !visibleDistricts(s, house(s)).has(d.id));
  const tracked = s.armies.find((a) => a.id === enemy.id); tracked.hex = hiddenArea.id;
  s.scouts.push({ house: actor.house, hex: hiddenArea.id, until: s.turns.round }); updateIntelligence(s);
  s.turns.round++; updateIntelligence(s); visible = strategyView(s, actor.house);
  assert.ok(!visible.armies.some((a) => a.id === enemy.id)); assert.ok(visible.intelligence[actor.house].some((r) => r.army === enemy.id));
});
test("multiplayer snapshots strip other players' intelligence and hidden armies", () => {
  const room = makeCouncil("TEST", "host", { nation: "auremarch" }, 0); room.state = createCampaign("auremarch", "multi");
  const hidden = room.state.armies.find((a) => a.house === "saltmere-0"); hidden.garrison = false; updateIntelligence(room.state);
  const before = JSON.stringify(room.state), reply = councilReply(room, "host");
  assert.ok(!reply.room.state.armies.some((a) => a.id === hidden.id));
  assert.deepEqual(Object.keys(reply.room.state.intelligence), [actor.house]);
  assert.equal(JSON.stringify(room.state), before);
});
test("a negotiated cession transfers the selected occupied estate and creates an enforced truce", () => {
  let s = warFixture(); const d = s.districts.find((d) => d.owner === other.house);
  d.occupation = actor.house; d.occupiedAt = s.tick;
  s = act(s, { type: "peace", nation: "high-cairn", terms: { kind: "cede", hex: d.id, coins: 25, militaryAccess: true } });
  const cash = house(s).treasury;
  s = act(s, { type: "respond", reaction: s.turns.pending[0].id, choice: "accept" }, other);
  assert.equal(s.districts.find((v) => v.id === d.id).owner, actor.house); assert.equal(house(s).treasury, cash + 25);
  assert.ok(truce(s, "auremarch", "high-cairn").access);
  assert.throws(() => act(s, { type: "war", nation: "high-cairn" }), /truce/);
  s.turns.round += 7; assert.equal(truce(s, "auremarch", "high-cairn"), undefined);
});
test("invalid or unaffordable peace terms are rejected atomically; declined terms transfer nothing", () => {
  let s = warFixture(), original = structuredClone(s);
  assert.throws(() => act(s, { type: "peace", nation: "high-cairn", terms: { kind: "cede", hex: "legacy" } }), /occupied estate/);
  assert.throws(() => act(s, { type: "peace", nation: "high-cairn", terms: { kind: "white", coins: -50 } }), /0–500/);
  assert.deepEqual(s, original);
  s = act(s, { type: "peace", nation: "high-cairn", terms: { kind: "white", coins: 25 } });
  s = act(s, { type: "respond", reaction: s.turns.pending[0].id, choice: "decline" }, other);
  assert.equal(house(s).treasury, house(original).treasury); assert.equal(s.wars.length, 1);
});
test("occupation leverage supports tribute; accepted tribute pays only on the debtor's turn", () => {
  let s = warFixture();
  for (const d of s.districts.filter((d) => d.owner === other.house).slice(0, 3)) d.occupation = actor.house;
  assert.ok(warScore(s, "auremarch", "high-cairn") >= 20);
  s = act(s, { type: "peace", nation: "high-cairn", terms: { kind: "tribute" } });
  s = act(s, { type: "respond", reaction: s.turns.pending[0].id, choice: "accept" }, other);
  const cash = house(s).treasury; advanceStrategy(s, "auremarch"); assert.equal(house(s).treasury, cash);
  advanceStrategy(s, "high-cairn"); assert.equal(house(s).treasury, cash + 15);
  for (let round = 0; round < 5; round++) { s.turns.round++; advanceStrategy(s, "high-cairn"); }
  assert.equal(house(s).treasury, cash + 45, "Tribute stops after exactly three debtor turns");
});
test("sieges need an adjacent controlled host, prepare engines, and surrender requires consent", () => {
  let { s, a, castle } = siegeFixture();
  s = act(s, { type: "siege", army: a.id, hex: castle.id, stance: "blockade" });
  assert.equal(s.sieges.length, 1);
  const stocks = { ...house(s).stock };
  for (let i = 0; i < 3; i++) advanceStrategy(s, "auremarch");
  assert.equal(s.sieges[0].engines, true); assert.equal(house(s).stock.timber, stocks.timber - 20); assert.equal(house(s).stock.iron, stocks.iron - 10);
  if (!s.turns.pending.length) s = act(s, { type: "siege", army: a.id, hex: castle.id, stance: "negotiate" });
  assert.equal(s.districts.find((d) => d.id === castle.id).occupation, undefined);
  s = act(s, { type: "respond", reaction: s.turns.pending[0].id, choice: "accept" }, other);
  assert.equal(s.districts.find((d) => d.id === castle.id).occupation, actor.house);
  assert.equal(s.sieges.length, 0);
  assert.ok(s.armies.filter((a) => a.garrison && a.hex === castle.id).every((a) => troopCount(a) === 0));
});
test("an unprepared assault loses troops and starts a real tactical battle; lifting a siege restores movement", () => {
  let { s, a, castle } = siegeFixture();
  s = act(s, { type: "siege", army: a.id, hex: castle.id, stance: "assault" });
  assert.ok(troopCount(s.armies.find((v) => v.id === a.id)) < troopCount(a)); assert.equal(s.battles.length, 1); assert.ok(s.battles[0].rounds);
  const second = siegeFixture();
  let blocked = act(second.s, { type: "siege", army: second.a.id, hex: second.castle.id, stance: "blockade" });
  assert.throws(() => act(blocked, { type: "move", army: second.a.id, hex: "8:6" }), /Lift.*siege/);
  blocked = act(blocked, { type: "siege", army: second.a.id, hex: second.castle.id, stance: "lift" });
  assert.equal(blocked.sieges.length, 0); assert.equal(blocked.armies.find((v) => v.id === second.a.id).blockading, false);
});
test("kingdom rules affect winter provisions and clan recognition after actual battle victories", () => {
  const s = createCampaign("graskor"), h = house(s, "graskor-0"), a = s.armies.find((a) => a.house === h.id), enemy = s.armies.find((a) => a.house === other.house);
  const battle = makeBattle(s, a, enemy, a.hex); s.battles.push(battle);
  const legitimacy = h.legitimacy; finishBattle(s, battle, a.id);
  assert.equal(h.prestige, 10); assert.equal(h.legitimacy, Math.min(100, legitimacy + 5));
  assert.equal(createCampaign("varnesk").armies.find((a) => a.house === "varnesk-0").provisions, 4);
  s.turns.round = 10; assert.equal(season(s), "Winter"); assert.equal(campaignRound(s), 10);
});
test("legacy saves migrate without losing troops, progress, balances or battles; corrupt strategy saves reject", () => {
  const old = createCampaign(); delete old.strategyRules; delete old.events; delete old.intelligence; delete old.scouts; delete old.sieges; delete old.treaties; delete old.conflicts;
  for (const h of old.houses) { delete h.contract; delete h.demand; delete h.successionLaw; for (const p of h.family) { delete p.traits; delete p.skills; delete p.claims; } }
  const fresh = loadSave(JSON.stringify(old)); assert.equal(fresh.strategyRules, 1); assert.deepEqual(fresh.armies, old.armies); assert.equal(house(fresh).treasury, house(old).treasury);
  const corrupt = structuredClone(fresh); corrupt.houses[0].family[0].skills.command = Infinity;
  assert.throws(() => loadSave(JSON.stringify(corrupt)), /character skills/);
  assert.deepEqual(loadSave(JSON.stringify(fresh)), JSON.parse(JSON.stringify(fresh)));
});
test("new commands remain subject to turn authority and bots complete the turn without stalls", () => {
  const s = createCampaign();
  assert.throws(() => act(s, { type: "scout", hex: "8:6" }, other), /not your turn/);
  const next = runAutomaticTurns(act(s, { type: "endTurn" }));
  assert.equal(next.turns.round, 2); assert.equal(next.turns.pending.length, 0); assert.equal(next.turns.order[next.turns.index], "auremarch");
});
test("installing a claimant changes actual crown authority; losing the last human crown stops automatic play", () => {
  let s = warFixture();
  for (const d of s.districts.filter((d) => house(s, d.owner)?.nation === "high-cairn")) d.occupation = actor.house;
  s = act(s, { type: "peace", nation: "high-cairn", terms: { kind: "claimant", claimant: "high-cairn-4" } });
  s = act(s, { type: "respond", reaction: s.turns.pending[0].id, choice: "accept" }, other);
  assert.equal(s.titles.find((t) => t.nation === "high-cairn").holder, "high-cairn-4");
  assert.equal(house(s, "high-cairn-4").role, "crown"); assert.equal(house(s, other.house).role, "claimant");
  assert.equal(house(s, other.house).liege, "high-cairn-4");
  s.titles.find((t) => t.nation === "auremarch").holder = "auremarch-4";
  assert.equal(runAutomaticTurns(s), s);
});
test("long campaigns preserve valid saves across bot wars, negotiations, seasons and battle aftermath", () => {
  let s = createCampaign();
  for (let step = 0; step < 150 && s.turns.round < 18; step++) {
    if (s.battles[0]) autoResolve(s, s.battles[0]);
    else if (s.turns.pending[0]) {
      const r = s.turns.pending[0];
      s = act(s, { type: "respond", reaction: r.id, choice: r.kind === "war" ? "defend" : r.kind === "attack" ? defendingArmies(s, r).length ? "defend" : "withdraw" : "accept" }, { house: r.to });
    } else s = act(s, { type: "endTurn" }, { house: s.titles.find((t) => t.nation === s.turns.order[s.turns.index]).holder });
    s = runAutomaticTurns(s);
    assert.doesNotThrow(() => loadSave(JSON.stringify(s)));
    assert.ok(s.houses.every((h) => h.treasury >= 0 && Object.values(h.stock).every((n) => Number.isFinite(n) && n >= 0)));
  }
  assert.ok(s.turns.round >= 18, "Campaign should keep advancing through bot responses and battles");
});
