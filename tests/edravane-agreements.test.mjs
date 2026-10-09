import test from "node:test";
import assert from "node:assert/strict";
import { createCampaign, applyCommand, loadSave, advanceCampaign } from "../src/games/MedievalKingdoms/edravane/simulation.ts";
import { advanceAgreements, administrationPressure, compactAccess, economicFactors, initializeAgreements, legacyScore, noteLevies, PROJECTS, routeBenefits, updateCampaignOutcome, agreementBotCommands } from "../src/games/MedievalKingdoms/edravane/agreements.ts";
import { calendarYear } from "../src/games/MedievalKingdoms/edravane/calendar.ts";
import { strategyView } from "../src/games/MedievalKingdoms/edravane/logistics.ts";
import { successionPreview } from "../src/games/MedievalKingdoms/edravane/realm.ts";
import { findPath } from "../src/games/MedievalKingdoms/edravane/world.ts";

const crown = (s, id = "auremarch-0") => s.houses.find(h => h.id === id);
function command(s, cmd, id = "auremarch-0") {
  s.turns.index = s.turns.order.indexOf(crown(s, id).nation);
  return applyCommand(s, { house: id }, cmd);
}
const totals = s => s.houses.reduce((n, h) => ({ coins: n.coins + h.treasury, grain: n.grain + h.stock.grain, iron: n.iron + h.stock.iron }), { coins: 0, grain: 0, iron: 0 });
function offer(s, terms = {}) {
  return command(s, { type: "offerCompact", house: "high-cairn-0", give: { coins: 0, resources: { grain: 10 } }, take: { coins: 0, resources: { iron: 5 } }, duration: 2, covenant: "access", ...terms });
}
function sealed() {
  let s = offer(createCampaign("auremarch"));
  return command(s, { type: "answerCompact", compact: s.agreements.compacts[0].id, accept: true }, "high-cairn-0");
}

test("compacts require recipient consent, conserve cargo, grant access and deliver once per sender round", () => {
  const initial = createCampaign("auremarch"), reserves = totals(initial);
  let s = offer(initial), id = s.agreements.compacts[0].id;
  assert.deepEqual(totals(s), reserves);
  assert.equal(compactAccess(s, "auremarch", "high-cairn"), false);
  assert.throws(() => command(s, { type: "answerCompact", compact: id, accept: true }), /recipient/);
  s = command(s, { type: "answerCompact", compact: id, accept: true }, "high-cairn-0");
  assert.deepEqual(totals(s), reserves);
  assert.equal(crown(s).stock.grain, crown(initial).stock.grain - 10);
  assert.equal(compactAccess(s, "auremarch", "high-cairn"), true);
  s.turns.round = 2;
  advanceAgreements(s, "high-cairn");
  assert.equal(s.agreements.compacts[0].delivered, 1);
  advanceAgreements(s, "auremarch");
  advanceAgreements(s, "auremarch");
  assert.equal(s.agreements.compacts[0].delivered, 2);
  assert.equal(s.agreements.compacts[0].status, "active");
  s.turns.round = 3; advanceAgreements(s, "auremarch");
  assert.equal(s.agreements.compacts[0].status, "fulfilled");
  assert.equal(compactAccess(s, "auremarch", "high-cairn"), false);
  assert.ok(s.agreements.memories.some(m => m.kind === "honoured" && m.effect === 8));
});
test("undeliverable offers and malformed cargo fail atomically; war breaks remembered promises", () => {
  let s = offer(createCampaign("auremarch"));
  crown(s, "high-cairn-0").stock.iron = 0;
  const before = JSON.stringify(s);
  assert.throws(() => command(s, { type: "answerCompact", compact: s.agreements.compacts[0].id, accept: true }, "high-cairn-0"), /cannot deliver/);
  // Scheduler fixture changes only the active player; the failed exchange leaves balances untouched.
  assert.deepEqual(totals(s), totals(JSON.parse(before)));
  for (const give of [{ coins: -1, resources: {} }, { coins: 0, resources: { grain: 1.5 } }, { coins: 0, resources: { invented: 5 } }, { coins: Infinity, resources: {} }]) assert.throws(() => offer(s, { give }), /Cargo/);
  s = sealed(); const relation = crown(s).relations["high-cairn-0"];
  s.wars.push("auremarch|high-cairn"); advanceAgreements(s, "high-cairn");
  assert.equal(s.agreements.compacts[0].status, "broken");
  assert.equal(crown(s).relations["high-cairn-0"], relation - 15);
  assert.ok(s.agreements.memories.some(m => m.kind === "broken"));
});
test("other crowns cannot see private compacts, memories, domestic interests or compact chronicle entries", () => {
  const s = sealed(), view = strategyView(s, "saltmere-0");
  assert.equal(view.agreements.compacts.length, 0);
  assert.equal(view.agreements.memories.length, 0);
  assert.equal(view.agreements.domestic["auremarch-0"], undefined);
  assert.equal(view.events.some(e => e.title === "A compact is sealed"), false);
  assert.equal(strategyView(s, "high-cairn-0").agreements.compacts.length, 1);
});
function project() {
  let s = createCampaign("auremarch");
  const d = s.districts.find(d => d.owner === "auremarch-0" && (d.farm || d.city));
  s = command(s, { type: "foundProject", kind: "granary", hex: d.id });
  return s;
}
test("shared projects debit real contributions, reject overfunding, refund cancellation and enforce ownership", () => {
  let s = project(), id = s.agreements.projects[0].id, before = crown(s).treasury;
  s = command(s, { type: "fundProject", project: id, cargo: { coins: 30, resources: { timber: 20 } } });
  assert.equal(crown(s).treasury, before - 30);
  assert.throws(() => command(s, { type: "fundProject", project: id, cargo: { coins: 60, resources: {} } }), /still needed/);
  assert.throws(() => command(s, { type: "cancelProject", project: id }, "high-cairn-0"), /founder/);
  s = command(s, { type: "cancelProject", project: id });
  assert.equal(crown(s).treasury, before);
  assert.equal(s.agreements.projects[0].status, "cancelled");
});
test("completed granaries benefit actual contributors once, charge upkeep and remember closed access", () => {
  let s = project(), id = s.agreements.projects[0].id;
  s = command(s, { type: "fundProject", project: id, cargo: { coins: 40, resources: { grain: 60, timber: 30 } } });
  s = command(s, { type: "fundProject", project: id, cargo: { coins: 40, resources: { grain: 60, timber: 30 } } }, "high-cairn-0");
  assert.equal(s.agreements.projects[0].status, "complete");
  assert.equal(s.districts.find(d => d.id === s.agreements.projects[0].hex).depot, true);
  const coins = crown(s).treasury, food = crown(s).stock.grain;
  advanceAgreements(s, "auremarch"); advanceAgreements(s, "auremarch");
  assert.equal(crown(s).treasury, coins - PROJECTS.granary.upkeep);
  assert.equal(crown(s).stock.grain, food + 8);
  s = command(s, { type: "projectAccess", project: id, open: false });
  assert.ok(s.agreements.memories.some(m => m.kind === "broken" && m.effect === -12));
  s.turns.round = 2; const partnerFood = crown(s, "high-cairn-0").stock.grain;
  advanceAgreements(s, "high-cairn"); assert.equal(crown(s, "high-cairn-0").stock.grain, partnerFood);
  crown(s).treasury = 0; advanceAgreements(s, "auremarch");
  assert.equal(s.agreements.projects[0].maintained, false);
});
test("mobilisation depresses farm output; reforms and estate development have enforced costs and effects", () => {
  let s = createCampaign("auremarch");
  const d = s.districts.find(d => d.owner === "auremarch-0" && d.farm), baseline = economicFactors(s, crown(s), d).output;
  noteLevies(s, crown(s), 900);
  assert.ok(economicFactors(s, crown(s), d).output < baseline);
  const coins = crown(s).treasury;
  s = command(s, { type: "reform", reform: "charter" });
  assert.equal(crown(s).treasury, coins - 60);
  assert.equal(routeBenefits(s, crown(s).id, d.id, d.id, false).cost, .7);
  assert.throws(() => command(s, { type: "reform", reform: "learning" }), /One different/);
  const wood = crown(s).stock.timber;
  s = command(s, { type: "develop", hex: d.id, building: "farm" });
  assert.equal(s.districts.find(x => x.id === d.id).development, 1);
  assert.equal(crown(s).stock.timber, wood - 20);
});
test("conquest policies separate ownership and administration; autonomy can relieve overstretch", () => {
  let s = createCampaign("auremarch"), d = s.districts.find(d => d.owner === "high-cairn-0" && d.biome !== "legacy");
  d.occupation = "auremarch-0"; d.occupiedAt = 0; s.tick = 3;
  s.armies.find(a => a.house === "auremarch-0").hex = d.id;
  s = command(s, { type: "integrate", hex: d.id, policy: "direct" });
  d = s.districts.find(x => x.id === d.id);
  assert.equal(d.owner, "auremarch-0"); assert.equal(d.integration.formerOwner, "high-cairn-0");
  assert.equal(administrationPressure(s, crown(s)).used, 3);
  const unrest = d.unrest;
  s = command(s, { type: "integrate", hex: d.id, policy: "autonomy" });
  d = s.districts.find(x => x.id === d.id);
  assert.equal(d.integration.administrator, "high-cairn-0");
  assert.equal(administrationPressure(s, crown(s)).used, 0);
  assert.equal(d.unrest, Math.max(0, unrest - 15));
  assert.equal(economicFactors(s, crown(s), d).income, .5);
});
test("one calendar advances ages once a year and migrates old saves without changing geography", () => {
  const initial = createCampaign("auremarch"), old = structuredClone(initial);
  delete old.agreements; old.tick = 40; old.turns.round = 6; old.turns.index = 0;
  initializeAgreements(old);
  assert.deepEqual(old.districts, initial.districts);
  assert.equal(calendarYear(old), 0);
  old.tick = 96; assert.equal(calendarYear(old), 1);
  initial.tick = 95; initial.turns.round = 12; initial.turns.ending = "auremarch";
  const age = crown(initial).family.find(p => p.id === crown(initial).ruler).age;
  let s = advanceCampaign(initial, "auremarch");
  assert.equal(calendarYear(s), 1);
  assert.equal(crown(s).family.find(p => p.id === crown(s).ruler).age, age + 1);
  s = advanceCampaign(s, "auremarch");
  assert.equal(crown(s).family.find(p => p.id === crown(s).ruler).age, age + 1);
});
test("bounded chronicles score four capped paths, hold succession councils and finish with resumable solo sandbox", () => {
  let s = createCampaign("auremarch", "single", "council");
  s.turns.round = 25; advanceAgreements(s, "auremarch");
  assert.equal(s.agreements.domestic["auremarch-0"].successions, 1);
  advanceAgreements(s, "auremarch"); assert.equal(s.agreements.domestic["auremarch-0"].successions, 1);
  const score = legacyScore(s, crown(s));
  assert.equal(score.total, score.dynasty + score.prosperity + score.diplomacy + score.defence);
  assert.ok(Object.values(score).every(n => n >= 0 && n <= 100));
  s.turns.round = 48; updateCampaignOutcome(s); assert.equal(s.agreements.campaign.result, undefined);
  s.turns.round = 49; updateCampaignOutcome(s); assert.ok(s.agreements.campaign.result.winners.length);
  assert.throws(() => command(s, { type: "reform", reform: "charter" }), /ended/);
  s = command(s, { type: "continueSandbox" });
  assert.equal(s.agreements.campaign.kind, "sandbox"); assert.equal(s.agreements.campaign.result, undefined);
});
test("new ledgers roundtrip; corrupt deliveries, project funding and development are rejected", () => {
  const s = sealed();
  assert.deepEqual(loadSave(JSON.stringify(s)), JSON.parse(JSON.stringify(s)));
  for (const mutate of [s => s.agreements.compacts[0].remaining = 8, s => s.agreements.landmarks.push(s.agreements.landmarks[0]), s => s.districts[0].development = -1, s => s.agreements.domestic["auremarch-0"].approval.rural = NaN]) {
    const bad = structuredClone(s); mutate(bad); assert.throws(() => loadSave(JSON.stringify(bad)), /Invalid realm/);
  }
  let p = project(); p = command(p, { type: "fundProject", project: p.agreements.projects[0].id, cargo: PROJECTS.granary.cost });
  assert.deepEqual(loadSave(JSON.stringify(p)), JSON.parse(JSON.stringify(p)));
  p.agreements.projects[0].contributions["auremarch-0"].coins++;
  assert.throws(() => loadSave(JSON.stringify(p)), /overfunding/);
});
test("bots accept affordable fair offers and decline overpriced demands", () => {
  let s = offer(createCampaign("auremarch"));
  assert.equal(agreementBotCommands(s, crown(s, "high-cairn-0"))[0].accept, true);
  s = offer(createCampaign("auremarch"), { give: { coins: 1, resources: {} }, take: { coins: 500, resources: {} }, covenant: "none" });
  assert.equal(agreementBotCommands(s, crown(s, "high-cairn-0"))[0].accept, false);
});
test("low merchant and scholar approval has consequences, and victims do not lose legacy for another crown's withdrawal", () => {
  let s = sealed();
  const domestic = s.agreements.domestic["auremarch-0"];
  domestic.approval.merchants = 20; domestic.approval.scholars = 20;
  assert.equal(routeBenefits(s, "auremarch-0", "", "", false).cost, 1.2);
  const legitimacy = crown(s).legitimacy;
  advanceAgreements(s, "auremarch"); assert.equal(crown(s).legitimacy, legitimacy - 1);
  s = command(s, { type: "breakCompact", compact: s.agreements.compacts[0].id });
  assert.ok(s.agreements.memories.filter(m => m.kind === "broken").every(m => m.responsible === "auremarch-0"));
  const withBlame = legacyScore(s, crown(s, "high-cairn-0")).diplomacy;
  s.agreements.memories = s.agreements.memories.filter(m => m.kind !== "broken");
  assert.equal(legacyScore(s, crown(s, "high-cairn-0")).diplomacy, withBlame);
});
test("completed bridges raise local production and protected sea lanes reduce only contributor route cost and hazard", () => {
  let s = createCampaign("auremarch"), river = s.districts.find(d => d.owner === "auremarch-0" && d.biome === "river");
  const baseline = economicFactors(s, crown(s), river).output;
  s = command(s, { type: "foundProject", hex: river.id, kind: "bridge" });
  s = command(s, { type: "fundProject", project: s.agreements.projects[0].id, cargo: PROJECTS.bridge.cost });
  assert.ok(Math.abs(economicFactors(s, crown(s), s.districts.find(d => d.id === river.id)).output - baseline * 1.2) < 1e-10);
  const port = s.districts.find(d => d.owner === "auremarch-0" && d.port);
  const dest = s.districts.find(d => d.port && d.owner !== port.owner && findPath(s.districts, port.id, d.id, true).length);
  crown(s).treasury = 500; crown(s).stock.timber = 200; crown(s).stock.iron = 200;
  s = command(s, { type: "foundProject", hex: port.id, destination: dest.id, kind: "sea-lane" });
  const lane = s.agreements.projects[1].id;
  s = command(s, { type: "fundProject", project: lane, cargo: PROJECTS["sea-lane"].cost });
  assert.deepEqual(routeBenefits(s, "auremarch-0", port.id, dest.id, true), { cost: .7, hazard: .5 });
  assert.deepEqual(routeBenefits(s, "high-cairn-0", port.id, dest.id, true), { cost: 1, hazard: 1 });
  assert.deepEqual(routeBenefits(s, "auremarch-0", port.id, dest.id, false), { cost: 1, hazard: 1 });
  s = command(s, { type: "projectAccess", project: lane, open: false });
  assert.deepEqual(routeBenefits(s, "auremarch-0", port.id, dest.id, true), { cost: 1, hazard: 1 });
});
test("a sworn heir-support compact adds the recipient to actual succession support", () => {
  let s = offer(createCampaign("auremarch"), { covenant: "heir-support" });
  assert.equal(successionPreview(s, crown(s)).supporters.some(h => h.id === "high-cairn-0"), false);
  s = command(s, { type: "answerCompact", compact: s.agreements.compacts[0].id, accept: true }, "high-cairn-0");
  assert.equal(successionPreview(s, crown(s)).supporters.some(h => h.id === "high-cairn-0"), true);
});
