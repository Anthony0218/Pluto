import type { Army, Campaign, Command, CouncilOffice, House, PeaceTerms, Reaction, Siege } from "./types.ts";
import { findPath, hexDistance, NATIONS } from "./world.ts";
import { makeBattle, startCombat, troopCount } from "./battle.ts";
import { campaignRound, councilSkill, DEMANDS, event, LAWS, ruler, successionPreview } from "./realm.ts";
import { realmNation, supplyConnection } from "./logistics.ts";

function require(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const warKey = (a: string, b: string) => [a, b].sort().join("|");
const realm = (s: Campaign, h: House) => s.houses.filter((v) => v.id === h.id || v.liege === h.id);
export function truce(s: Campaign, from: string, to: string) {
  return (s.treaties ?? []).find((t) => warKey(t.from, t.to) === warKey(from, to) && t.until >= campaignRound(s));
}
export function warScore(s: Campaign, from: string, to: string) {
  const occupied = (nation: string, occupier: string) => s.districts.filter((d) => s.houses.find((h) => h.id === d.owner)?.nation === nation && s.houses.find((h) => h.id === d.occupation)?.nation === occupier)
    .reduce((n, d) => n + (d.seat === "capital" ? 35 : d.city ? 20 : 12), 0);
  const captive = (nation: string, captor: string) => s.houses.filter((h) => h.nation === nation).flatMap((h) => h.family).filter((p) => p.alive && s.houses.find((h) => h.id === p.imprisonedBy)?.nation === captor).length * 10;
  return Math.max(-100, Math.min(100, occupied(to, from) - occupied(from, to) + captive(to, from) - captive(from, to)));
}
export function peaceDescription(terms?: PeaceTerms) {
  if (!terms) return "End the war without transferring land; a six-round truce follows.";
  return ({ white: "End the war without transferring land; a six-round truce follows.", recover: "Return both realms' occupied estates to their lawful owners.", release: "Release your captured relatives.", "open-trade": "End blockades and protect trade for six rounds.", cede: `Transfer the occupied estate ${terms.hex ?? "you select"} to your house.`, claimant: "Recognize your chosen claimant as the opposing crown.", tribute: "Pay your house 15 coins per round for three rounds." }[terms.kind]) +
    (terms.coins ? ` Pay ${terms.coins} coins in reparations.` : "") + (terms.militaryAccess ? " Grant mutual military access for six rounds." : "");
}
export function validatePeace(s: Campaign, from: House, to: House, terms: PeaceTerms = { kind: "white" }, settling = false) {
  require(terms && ["white", "recover", "release", "open-trade", "cede", "claimant", "tribute"].includes(terms.kind), "Unknown peace terms");
  require(terms.militaryAccess === undefined || typeof terms.militaryAccess === "boolean", "Invalid military access terms");
  require(terms.coins === undefined || Number.isSafeInteger(terms.coins) && terms.coins >= 0 && terms.coins <= 500, "Reparations must be 0–500 coins");
  require(!terms.coins || to.treasury >= terms.coins, "The opposing treasury cannot pay these reparations");
  if (terms.kind === "cede") {
    const d = s.districts.find((d) => d.id === terms.hex);
    require(d?.owner && realm(s, to).some((h) => h.id === d.owner) && realm(s, from).some((h) => h.id === d.occupation), "Select an occupied estate held by your realm");
  }
  if (terms.kind === "claimant") {
    const h = s.houses.find((h) => h.id === terms.claimant);
    require(h && h.nation === to.nation && h.role === "claimant" && h.id !== to.id && ruler(h)?.alive && !ruler(h)?.imprisonedBy, "Select a living free claimant in the opposing realm");
  }
  if (!settling && ["claimant", "tribute"].includes(terms.kind)) require(warScore(s, from.nation, to.nation) >= (terms.kind === "claimant" ? 60 : 20), "Gain more occupation or prisoner leverage before demanding these terms");
}
export function settlePeace(s: Campaign, from: House, to: House, terms: PeaceTerms = { kind: "white" }) {
  validatePeace(s, from, to, terms, true);
  const ours = realm(s, from).map((h) => h.id), theirs = realm(s, to).map((h) => h.id);
  if (terms.kind === "recover") for (const d of s.districts) if ((ours.includes(d.owner ?? "") && theirs.includes(d.occupation ?? "")) || (theirs.includes(d.owner ?? "") && ours.includes(d.occupation ?? ""))) { delete d.occupation; delete d.occupiedAt; }
  if (terms.kind === "release") for (const h of realm(s, from)) for (const p of h.family) if (theirs.includes(p.imprisonedBy ?? "")) delete p.imprisonedBy;
  if (terms.kind === "cede") {
    const d = s.districts.find((d) => d.id === terms.hex)!;
    d.owner = from.id; delete d.occupation; delete d.occupiedAt; d.disputed = true; d.unrest = clamp(d.unrest + 10);
    for (const a of s.armies.filter((a) => a.garrison && a.hex === d.id && theirs.includes(a.house))) { a.garrison = false; a.path = []; }
  }
  if (terms.kind === "claimant") {
    const claimant = s.houses.find((h) => h.id === terms.claimant)!;
    s.titles.find((t) => t.nation === to.nation)!.holder = claimant.id;
    claimant.liege = null; claimant.rebellion = false; claimant.role = "crown"; claimant.legitimacy = Math.max(60, claimant.legitimacy);
    to.role = "claimant";
    to.liege = claimant.id;
    for (const h of s.houses.filter((h) => h.nation === to.nation && h.id !== claimant.id)) h.liege = claimant.id;
    for (const a of s.armies.filter((a) => a.house === claimant.id)) { a.rebel = false; a.pledgedTo = undefined; }
  }
  if (terms.coins) { to.treasury -= terms.coins; from.treasury += terms.coins; }
  for (const a of s.armies.filter((a) => [from.nation, to.nation].includes(realmNation(s, a)))) a.blockading = false;
  s.sieges = (s.sieges ?? []).filter((siege) => {
    const a = s.armies.find((a) => a.id === siege.army), d = s.houses.find((h) => h.id === siege.defender);
    return !a || !d || warKey(realmNation(s, a), d.nation) !== warKey(from.nation, to.nation);
  });
  s.conflicts = (s.conflicts ?? []).filter((w) => warKey(w.from, w.to) !== warKey(from.nation, to.nation));
  const round = campaignRound(s);
  s.treaties = (s.treaties ?? []).filter((t) => warKey(t.from, t.to) !== warKey(from.nation, to.nation));
  s.treaties.push({ from: from.nation, to: to.nation, until: round + 6, access: !!terms.militaryAccess, trade: terms.kind === "open-trade", tribute: terms.kind === "tribute" ? 15 : 0, tributeUntil: round + 3, tributeRemaining: terms.kind === "tribute" ? 3 : 0 });
  event(s, { kind: "diplomacy", house: from.id, other: to.id, hex: terms.hex, title: "A peace treaty is signed", detail: `${from.name} and ${to.name}: ${peaceDescription(terms)}` });
}
function spend(h: House, coins: number) { require(h.treasury >= coins, `Requires ${coins} coins`); h.treasury -= coins; }
export function bargainOpinionBonus(s: Campaign, h: House, v: House, offer: keyof typeof DEMANDS) {
  return (v.demand?.kind === offer ? 20 : 10) + (ruler(v)?.traits?.includes("greedy") && ["lower-taxes", "protect-trade"].includes(offer) ? 5 : 0) + Math.max(0, Math.floor((councilSkill(s, h, "diplomacy") - 8) / 3));
}
function queueSurrender(s: Campaign, siege: Siege, h: House) {
  require(s.turns, "A surrender requires a campaign response");
  require(!siege.offered, "Surrender already proposed; continue the blockade or assault");
  const defender = s.houses.find((v) => v.id === siege.defender)!;
  const controller = defender.liege ?? defender.id;
  s.turns.pending.push({ id: `reaction-${++s.serial}`, created: s.tick, kind: "surrender", from: h.id, to: controller, hex: siege.hex, siege: siege.id });
  siege.offered = true;
}
export function resolveSurrender(s: Campaign, r: Reaction, choice: string) {
  require(choice === "accept" || choice === "decline", "Accept or decline the surrender demand");
  const siege = s.sieges?.find((v) => v.id === r.siege), a = s.armies.find((v) => v.id === siege?.army), d = s.districts.find((v) => v.id === r.hex);
  require(siege && a && d && troopCount(a) > 0, "This siege has ended");
  if (choice === "accept") {
    for (const guard of s.armies.filter((v) => v.hex === d.id && v.house === siege.defender && v.garrison)) { for (const kind of Object.keys(guard.troops) as Array<keyof Army["troops"]>) guard.troops[kind] = 0; guard.wounded = {}; }
    a.hex = d.id; a.path = []; a.blockading = false; d.occupation = a.house; d.occupiedAt = s.tick;
    s.sieges = s.sieges!.filter((v) => v.id !== siege.id);
    event(s, { kind: "siege", house: a.house, other: r.to, hex: d.id, title: `${d.settlement} surrenders`, detail: "The garrison lays down its arms; the estate is occupied without an assault." });
  } else {
    event(s, { kind: "siege", house: r.to, other: a.house, hex: d.id, title: "Surrender refused", detail: `${d.settlement} continues to hold its walls.` });
  }
}
export function strategyCommand(s: Campaign, h: House, cmd: Command): boolean {
  if (!s.strategyRules) return false;
  switch (cmd.type) {
    case "bargain": {
      const v = s.houses.find((v) => v.id === cmd.house);
      require(v && v.liege === h.id && !v.rebellion, "Negotiate with one of your sworn vassals");
      require(Object.hasOwn(DEMANDS, cmd.offer), "Unknown concession");
      require(!(v.bargains ?? []).includes(cmd.offer), "This concession was already granted");
      v.contract ??= { taxRate: 0.2 };
      if (cmd.offer === "lower-taxes") { require(v.contract.taxRate > 0.1, "Taxes are already reduced"); v.contract.taxRate = 0.1; v.obligation += 200; }
      if (cmd.offer === "council-seat") {
        const offices: CouncilOffice[] = ["marshal", "steward", "chancellor", "spymaster"];
        require(cmd.office && offices.includes(cmd.office), "Choose a council office");
        require(!s.houses.some((v) => v.liege === h.id && v.contract?.office === cmd.office), "That council office is already occupied");
        require(!v.contract.office, "This house already has a council office");
        v.contract.office = cmd.office;
      }
      if (cmd.offer === "border-estate") {
        const d = s.districts.find((d) => d.id === cmd.hex);
        require(d && d.owner === h.id && !d.seat && !d.occupation, "Choose one of your unoccupied estates outside the royal seats");
        require(s.districts.filter((d) => d.owner === h.id).length > 1, "Keep at least one royal estate");
        require(s.districts.some((n) => n.nation && n.nation !== h.nation && hexDistance(d, n) === 1), "Choose an estate on a foreign frontier");
        d.owner = v.id; v.contract.grantedEstate = d.id; v.obligation += 300;
        for (const a of s.armies.filter((a) => a.garrison && a.hex === d.id && a.house === h.id)) { a.house = v.id; a.commander = v.ruler; }
      }
      if (cmd.offer === "protect-trade") {
        const route = s.routes.find((r) => r.house === v.id);
        if (!route) {
          const from = s.districts.find((d) => d.owner === v.id), to = s.districts.find((d) => d.owner === h.id && from && findPath(s.districts, from.id, d.id).length);
          require(from && to, "This house needs a connected trading partner first");
          s.routes.push({ id: `route-${++s.serial}`, house: v.id, from: from.id, to: to.id, path: [from.id, ...findPath(s.districts, from.id, to.id)], maritime: false, resource: from.resource, capacity: 12, cost: 1, progress: 0, delivered: 0, status: "Protected by royal promise" });
        }
        spend(h, 40); v.contract.protectedTrade = true;
      }
      const satisfied = v.demand?.kind === cmd.offer;
      const bonus = bargainOpinionBonus(s, h, v, cmd.offer);
      v.opinion = clamp(v.opinion + bonus); v.loyalty = Math.round(v.opinion * 0.55 + v.legitimacy * 0.45);
      (v.bargains ??= []).push(cmd.offer);
      if (satisfied) v.demand = { kind: cmd.offer, status: "fulfilled", since: campaignRound(s), ...(cmd.offer === "protect-trade" ? { deadline: campaignRound(s) + 3 } : {}) };
      v.reasons.push(`Agreed concession: ${cmd.offer}`);
      event(s, { kind: "politics", house: h.id, other: v.id, hex: cmd.offer === "border-estate" ? cmd.hex : undefined, title: `A bargain with House ${v.name}`, detail: `${DEMANDS[cmd.offer]}. +${bonus} opinion${satisfied ? "; their demand is fulfilled" : ""}.` });
      break;
    }
    case "successionLaw": {
      require(Object.hasOwn(LAWS, cmd.law), "Unknown succession law");
      require(h.successionLaw !== cmd.law, "This succession law is already in force");
      require(h.legitimacy >= 50, "Changing inheritance requires 50 legitimacy");
      spend(h, 80); h.successionLaw = cmd.law; h.legitimacy = Math.max(0, h.legitimacy - 10); delete h.designatedHeir;
      for (const v of s.houses.filter((v) => v.liege === h.id)) { v.opinion = clamp(v.opinion - 5); v.loyalty = Math.round(v.opinion * 0.55 + v.legitimacy * 0.45); }
      event(s, { kind: "succession", house: h.id, title: "Inheritance law changed", detail: `${cmd.law}: ${LAWS[cmd.law]} −10 legitimacy and −5 vassal opinion.` });
      break;
    }
    case "nominate": {
      const preview = successionPreview(s, h);
      require(h.successionLaw === "elective" || h.successionLaw === "clan", "Only an elective or clan assembly can nominate an heir");
      require(preview.candidates.some((p) => p.id === cmd.person), "Choose an eligible heir");
      h.designatedHeir = cmd.person;
      event(s, { kind: "succession", house: h.id, person: cmd.person, title: "An heir is nominated", detail: `${h.family.find((p) => p.id === cmd.person)!.name} is nominated. Council and assembly recognition is checked when the crown passes.` });
      break;
    }
    case "infrastructure": {
      const d = s.districts.find((d) => d.id === cmd.hex);
      require(d && d.owner === h.id && !d.occupation && d.biome !== "sea" && d.biome !== "legacy", "Build on an unoccupied estate you own");
      require(["road", "depot", "watchtower"].includes(cmd.building), "Unknown infrastructure");
      require(!d[cmd.building], "This infrastructure already exists");
      const cost = { road: 40, depot: 70, watchtower: 60 }[cmd.building];
      require(h.stock.timber >= 15, "Requires 15 timber"); spend(h, cost); h.stock.timber -= 15; d[cmd.building] = true;
      event(s, { kind: "economy", house: h.id, hex: d.id, title: `A ${cmd.building} is built`, detail: `${d.name}: ${cost} coins and 15 timber.` });
      break;
    }
    case "scout": {
      const d = s.districts.find((d) => d.id === cmd.hex);
      require(d && !["sea", "legacy"].includes(d.biome), "Choose a land district to scout");
      require(s.districts.some((from) => s.houses.find((v) => v.id === from.owner)?.nation === h.nation && hexDistance(from, d) <= 6), "Scouts can travel up to six hexes from your realm");
      require(!(s.scouts ?? []).some((m) => m.house === h.id && m.hex === d.id && m.until >= campaignRound(s)), "Scouts already cover this area");
      spend(h, 25); (s.scouts ??= []).push({ house: h.id, hex: d.id, until: campaignRound(s) + 2 });
      event(s, { kind: "politics", house: h.id, hex: d.id, title: "Scouts dispatched", detail: `Reports around ${d.name} remain current for two rounds.` });
      break;
    }
    case "siege": {
      const a = s.armies.find((a) => a.id === cmd.army), d = s.districts.find((d) => d.id === cmd.hex);
      require(a && !a.rebel && (a.house === h.id || a.pledgedTo === h.id && a.delay === 0 && a.serviceUntil > s.tick) && !a.garrison && !a.voyage && troopCount(a) >= 100, "Select a controlled field host with at least 100 soldiers");
      require(d?.castle && d.owner && hexDistance(s.districts.find((d) => d.id === a.hex)!, d) <= 1, "March next to an enemy castle to besiege it");
      const defender = s.houses.find((v) => v.id === (d.occupation ?? d.owner))!;
      require(s.wars.includes(warKey(h.nation, defender.nation)), "Declare war before laying siege");
      require(["blockade", "assault", "negotiate", "lift"].includes(cmd.stance), "Unknown siege order");
      let siege = s.sieges?.find((v) => v.army === a.id && v.hex === d.id);
      if (cmd.stance === "lift") {
        require(siege, "This host is not besieging that castle"); s.sieges = s.sieges!.filter((v) => v.id !== siege!.id); a.blockading = false; break;
      }
      if (!siege) {
        require(!(s.sieges ?? []).some((v) => v.hex === d.id || v.army === a.id), "This castle or host already has an active siege");
        siege = { id: `siege-${++s.serial}`, army: a.id, hex: d.id, defender: defender.id, turns: 0, food: d.castle.level * 3, engines: false };
        (s.sieges ??= []).push(siege); a.path = []; a.blockading = true;
        event(s, { kind: "siege", house: h.id, other: defender.id, hex: d.id, title: `${d.settlement} is besieged`, detail: "The host blocks the castle's supplies. Relief troops can break the siege." });
      }
      if (cmd.stance === "negotiate") queueSurrender(s, siege, h);
      if (cmd.stance === "assault") {
        const guard = s.armies.filter((v) => v.hex === d.id && v.house === defender.id && troopCount(v) > 0).sort((x, y) => troopCount(y) - troopCount(x))[0];
        const loss = siege.engines ? 0.03 : 0.12;
        for (const k of Object.keys(a.troops) as Array<keyof Army["troops"]>) a.troops[k] = Math.floor(a.troops[k] * (1 - loss));
        a.blockading = false; a.path = [];
        if (guard) {
          const retreatHex = a.hex; a.hex = d.id;
          const battle = makeBattle(s, a, guard, retreatHex);
          battle.stood = [a.id, guard.id]; startCombat(battle); s.battles.push(battle);
        } else { a.hex = d.id; d.occupation = a.house; d.occupiedAt = s.tick; }
        s.sieges = s.sieges!.filter((v) => v.id !== siege!.id);
        event(s, { kind: "siege", house: h.id, other: defender.id, hex: d.id, title: "The walls are assaulted", detail: `${siege.engines ? "Prepared siege engines" : "An unprepared assault"} cost ${Math.round(loss * 100)}% of the attacking troops before combat.` });
      }
      break;
    }
    default: return false;
  }
  return true;
}
export function advanceStrategy(s: Campaign, nation?: string) {
  if (!s.strategyRules) return;
  for (const t of s.treaties ?? []) {
    if (t.tribute && (!nation || nation === t.to) && (t.tributeRemaining !== undefined ? t.tributeRemaining > 0 : campaignRound(s) <= t.tributeUntil)) {
      const payer = s.houses.find((h) => h.id === s.titles.find((v) => v.nation === t.to)?.holder), recipient = s.houses.find((h) => h.id === s.titles.find((v) => v.nation === t.from)?.holder);
      if (payer && recipient) { const amount = Math.min(t.tribute, payer.treasury); payer.treasury -= amount; recipient.treasury += amount; if (t.tributeRemaining !== undefined) t.tributeRemaining--; }
    }
  }
  s.sieges = (s.sieges ?? []).filter((siege) => {
    const a = s.armies.find((a) => a.id === siege.army), d = s.districts.find((d) => d.id === siege.hex), owner = s.houses.find((h) => h.id === siege.defender);
    const valid = a && d && owner && troopCount(a) >= 100 && !a.voyage && hexDistance(s.districts.find((d) => d.id === a.hex)!, d) <= 1 && s.wars.includes(warKey(realmNation(s, a), owner.nation)) && !s.battles.some((b) => b.armies.includes(a.id)) && (d.occupation ?? d.owner) === siege.defender;
    if (!valid) { if (a) a.blockading = false; return false; }
    if (nation && realmNation(s, a) !== nation) return true;
    const h = s.houses.find((h) => h.id === a.house)!;
    siege.turns++; siege.food = Math.max(0, siege.food - 1);
    if (!siege.engines && siege.turns >= 3 && h.stock.timber >= 20 && h.stock.iron >= 10) { siege.engines = true; h.stock.timber -= 20; h.stock.iron -= 10; }
    if (siege.food === 0) for (const g of s.armies.filter((g) => g.hex === siege.hex && g.house === siege.defender)) g.morale = Math.max(15, g.morale - 5);
    if (siege.food <= 1 && !siege.offered && s.turns && !s.turns.pending.length) queueSurrender(s, siege, s.houses.find((h) => h.id === (a.pledgedTo ?? a.house))!);
    if (!supplyConnection(s, a).connected && (a.provisions ?? 0) === 0) a.morale = Math.max(15, a.morale - 3);
    return true;
  });
  if (s.turns) s.turns.pending = s.turns.pending.filter((r) => r.kind !== "surrender" || s.sieges!.some((siege) => siege.id === r.siege));
}
export function objectiveFor(s: Campaign, h: House, target: string, reason: string, hex?: string) {
  if (hex) return hex;
  if (reason === "occupied-land") return s.districts.find((d) => realm(s, h).some((v) => v.id === d.owner) && s.houses.find((v) => v.id === d.occupation)?.nation === target)?.id;
  return s.districts.find((d) => d.nation === target && s.districts.some((n) => n.nation === h.nation && hexDistance(n, d) === 1))?.id ?? NATIONS.find((n) => n.id === target)?.capital;
}
