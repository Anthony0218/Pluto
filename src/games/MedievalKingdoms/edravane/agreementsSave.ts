import type { Campaign } from "./types.ts";
import { ADMINISTRATION, COVENANTS, PROJECTS, REFORMS, projectTotals, validateCargo } from "./agreements.ts";
import { RESOURCES } from "./world.ts";

function check(value: unknown, reason: string): asserts value { if (!value) throw Error(`Invalid realm agreements save: ${reason}`); }
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
const record = (n: unknown): n is Record<string, unknown> => !!n && typeof n === "object" && !Array.isArray(n);
export function validateAgreementsSave(s: Campaign) {
  const a = s.agreements;
  for (const d of s.districts) {
    check(d.development === undefined || integer(d.development, 0, 3), "estate development");
    if (d.integration) check(record(d.integration) && Object.hasOwn(ADMINISTRATION, d.integration.policy) &&
      s.houses.some((h) => h.id === d.integration?.administrator) && s.houses.some((h) => h.id === d.integration?.formerOwner) && integer(d.integration.since), "estate administration");
  }
  if (a === undefined) return;
  check(record(a) && a.version === 1, "rules version");
  const house = (id: unknown) => typeof id === "string" && s.houses.some((h) => h.id === id);
  const hex = (id: unknown) => typeof id === "string" && s.districts.some((d) => d.id === id && d.biome !== "sea" && d.biome !== "legacy");
  check(Array.isArray(a.compacts) && a.compacts.length <= 160 && new Set(a.compacts.map((c) => c.id)).size === a.compacts.length, "compact ledger");
  for (const c of a.compacts) {
    check(record(c) && typeof c.id === "string" && house(c.from) && house(c.to) && c.from !== c.to && Object.hasOwn(COVENANTS, c.covenant) &&
      integer(c.duration, 2, 8) && integer(c.remaining, 0, c.duration) && integer(c.delivered, 0, c.duration) && c.delivered + c.remaining === c.duration &&
      ["offered", "active", "fulfilled", "declined", "broken", "expired"].includes(c.status) && integer(c.offered) && integer(c.lastRound) && typeof c.reason === "string", "compact terms");
    validateCargo(c.give); validateCargo(c.take);
    check(c.status !== "fulfilled" || c.remaining === 0, "fulfilled compact deliveries");
    check(c.status !== "offered" || c.delivered === 0, "unaccepted compact deliveries");
  }
  check(Array.isArray(a.projects) && a.projects.length <= 40 && new Set(a.projects.map((p) => p.id)).size === a.projects.length, "project ledger");
  for (const p of a.projects) {
    check(record(p) && typeof p.id === "string" && Object.hasOwn(PROJECTS, p.kind) && house(p.owner) && hex(p.hex) &&
      ["funding", "complete", "cancelled"].includes(p.status) && typeof p.open === "boolean" && typeof p.maintained === "boolean" && integer(p.lastRound) && record(p.contributions), "project terms");
    for (const [id, cargo] of Object.entries(p.contributions)) { check(house(id), "project contributor"); validateCargo(cargo); }
    if (p.kind === "sea-lane") check(hex(p.destination) && p.destination !== p.hex && s.districts.find((d) => d.id === p.hex)?.port && s.districts.find((d) => d.id === p.destination)?.port, "sea lane ports");
    if (p.kind === "bridge") check(s.districts.find((d) => d.id === p.hex)?.biome === "river", "bridge crossing");
    const total = projectTotals(p), cost = PROJECTS[p.kind].cost;
    check(total.coins <= cost.coins && RESOURCES.every((r) => (total.resources[r] ?? 0) <= (cost.resources[r] ?? 0)), "project overfunding");
    check(p.status !== "complete" || total.coins === cost.coins && RESOURCES.every((r) => (total.resources[r] ?? 0) === (cost.resources[r] ?? 0)), "completed project funding");
  }
  check(Array.isArray(a.memories) && a.memories.length <= 160 && new Set(a.memories.map((m) => m.id)).size === a.memories.length && a.memories.every((m) =>
    record(m) && typeof m.id === "string" && house(m.house) && house(m.other) && s.houses.some((h) => h.family.some((p) => p.id === m.person)) && integer(m.round) &&
    ["honoured", "broken", "aid", "succession"].includes(m.kind) && typeof m.detail === "string" && integer(m.effect, -100, 100) && (m.responsible === undefined || m.responsible === m.house || m.responsible === m.other)), "political memories");
  check(record(a.domestic), "domestic ledger");
  for (const [id, d] of Object.entries(a.domestic)) check(house(id) && record(d) && record(d.approval) &&
    [d.approval.rural, d.approval.merchants, d.approval.scholars].every((n) => integer(n, 0, 100)) && Object.hasOwn(REFORMS, d.reform) &&
    integer(d.levyBurden, 0, 3000) && integer(d.lastReform, -1) && integer(d.lastRound) && integer(d.successions) && integer(d.successionSupport), "domestic interests");
  check(Array.isArray(a.landmarks) && a.landmarks.length <= 24 && new Set(a.landmarks.map((l) => l.hex)).size === a.landmarks.length &&
    a.landmarks.every((l) => hex(l.hex) && ["pass", "harbour", "crossing"].includes(l.kind)), "strategic landmarks");
  check(record(a.calendar) && [a.calendar.baseTick, a.calendar.baseYear, a.calendar.agedYear, a.calendar.bornYear].every((n) => integer(n)) && a.calendar.baseTick <= s.tick, "calendar");
  const c = a.campaign;
  check(record(c) && ["council", "sandbox"].includes(c.kind) && integer(c.startRound, 1) && integer(c.length, 48, 48) &&
    Array.isArray(c.councilHeld) && c.councilHeld.every(house) && new Set(c.councilHeld).size === c.councilHeld.length && record(c.scores), "campaign charter");
  for (const [id, score] of Object.entries(c.scores)) check(house(id) && record(score) && [score.dynasty, score.prosperity, score.diplomacy, score.defence].every((n) => integer(n, 0, 25)) && score.total === score.dynasty + score.prosperity + score.diplomacy + score.defence, "legacy score");
  if (c.result) check(c.kind === "council" && integer(c.result.round, c.startRound + c.length) && Array.isArray(c.result.winners) && c.result.winners.length > 0 &&
    new Set(c.result.winners).size === c.result.winners.length && c.result.winners.every((id) => house(id) && c.scores[id]), "campaign result");
}
