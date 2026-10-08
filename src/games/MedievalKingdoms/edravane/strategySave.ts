import type { Campaign } from "./types.ts";
import { LAWS, TRAITS, DEMANDS } from "./realm.ts";
import { NATIONS } from "./world.ts";
import { WAR_REASONS } from "./politics.ts";

function check(value: unknown, message: string): asserts value { if (!value) throw Error(`Invalid strategy save: ${message}`); }
const bounded = (n: unknown, max = 100) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max;
const integer = (n: unknown, max = Number.MAX_SAFE_INTEGER) => bounded(n, max) && Number.isSafeInteger(n);
export function validateStrategySave(s: Campaign) {
  if (s.strategyRules === undefined) return;
  check(s.strategyRules === 1, "unsupported rules");
  const house = (id: unknown) => typeof id === "string" && s.houses.some((h) => h.id === id);
  const person = (id: unknown) => typeof id === "string" && s.houses.some((h) => h.family.some((p) => p.id === id));
  const hex = (id: unknown) => typeof id === "string" && s.districts.some((d) => d.id === id);
  const nation = (id: unknown) => NATIONS.some((n) => n.id === id);
  for (const h of s.houses) {
    check(h.successionLaw && Object.hasOwn(LAWS, h.successionLaw), "inheritance law");
    check(h.contract && bounded(h.contract.taxRate, 0.5) && (!h.contract.office || ["marshal", "steward", "chancellor", "spymaster"].includes(h.contract.office)) && (h.contract.protectedTrade === undefined || typeof h.contract.protectedTrade === "boolean") && (!h.contract.grantedEstate || hex(h.contract.grantedEstate)), "feudal contract");
    check(h.prestige === undefined || bounded(h.prestige, 1000), "prestige");
    check(!h.designatedHeir || h.family.some((p) => p.id === h.designatedHeir), "nominated heir");
    check(!h.regent || person(h.regent), "regent");
    check(h.bargains === undefined || Array.isArray(h.bargains) && h.bargains.length <= 4 && new Set(h.bargains).size === h.bargains.length && h.bargains.every((offer) => Object.hasOwn(DEMANDS, offer)), "concessions");
    if (h.demand) check(Object.hasOwn(DEMANDS, h.demand.kind) && ["open", "fulfilled", "broken"].includes(h.demand.status) && integer(h.demand.since) && (h.demand.deadline === undefined || integer(h.demand.deadline)), "vassal demand");
    for (const p of h.family) {
      check(Array.isArray(p.traits) && p.traits.length <= 2 && p.traits.every((t) => Object.hasOwn(TRAITS, t)), "personality");
      check(p.skills && [p.skills.command, p.skills.diplomacy, p.skills.intrigue, p.skills.stewardship].every((n) => integer(n, 30)), "character skills");
      check(p.lastChildYear === undefined || integer(p.lastChildYear), "dynastic history");
      check(p.claims === undefined || Array.isArray(p.claims) && p.claims.every(nation), "inherited claims");
    }
  }
  for (const a of s.armies) check((a.provisions === undefined || integer(a.provisions, 5)) && (a.supplySource === undefined || typeof a.supplySource === "string"), "army provisions");
  for (const d of s.districts) check([d.depot, d.watchtower].every((v) => v === undefined || typeof v === "boolean"), "infrastructure");
  check(Array.isArray(s.treaties) && s.treaties.every((t) => nation(t.from) && nation(t.to) && t.from !== t.to && integer(t.until) && typeof t.access === "boolean" && typeof t.trade === "boolean" && integer(t.tribute, 15) && integer(t.tributeUntil) && (t.tributeRemaining === undefined || integer(t.tributeRemaining, 3))), "treaties");
  check(Array.isArray(s.conflicts) && s.conflicts.every((w) => typeof w.id === "string" && nation(w.from) && nation(w.to) && w.from !== w.to && Object.hasOwn(WAR_REASONS, w.reason) && integer(w.started) && (!w.objective || hex(w.objective))), "war objectives");
  check(Array.isArray(s.sieges) && s.sieges.every((v) => typeof v.id === "string" && s.armies.some((a) => a.id === v.army) && hex(v.hex) && house(v.defender) && integer(v.turns) && integer(v.food, 9) && typeof v.engines === "boolean" && (v.offered === undefined || typeof v.offered === "boolean")), "sieges");
  check(Array.isArray(s.scouts) && s.scouts.every((m) => house(m.house) && hex(m.hex) && integer(m.until)), "scout missions");
  check(s.intelligence && typeof s.intelligence === "object" && !Array.isArray(s.intelligence) && Object.entries(s.intelligence).every(([id, reports]) => house(id) && Array.isArray(reports) && reports.length <= 80 && reports.every((r) => house(r.house) && typeof r.army === "string" && typeof r.name === "string" && hex(r.hex) && integer(r.low) && integer(r.high) && r.high >= r.low && integer(r.seen))), "intelligence");
  check(Array.isArray(s.events) && s.events.length <= 120 && s.events.every((e) => typeof e.id === "string" && integer(e.tick) && integer(e.round) && house(e.house) && (!e.other || house(e.other)) && (!e.hex || hex(e.hex)) && typeof e.title === "string" && typeof e.detail === "string" && ["diplomacy", "succession", "battle", "politics", "siege", "economy"].includes(e.kind)), "chronicle");
  for (const r of s.turns?.pending ?? []) {
    check(!r.partnerHouse || house(r.partnerHouse), "marriage partner house");
    if (r.kind === "surrender") check(s.sieges.some((v) => v.id === r.siege) && hex(r.hex), "pending surrender");
    if (r.terms) check(["white", "recover", "release", "open-trade", "cede", "claimant", "tribute"].includes(r.terms.kind) && (r.terms.coins === undefined || integer(r.terms.coins, 500)) && (r.terms.militaryAccess === undefined || typeof r.terms.militaryAccess === "boolean") && (!r.terms.hex || hex(r.terms.hex)) && (!r.terms.claimant || house(r.terms.claimant)), "pending peace terms");
  }
}
