import type { Campaign, Command, District, House } from "./types.ts";
import type { Administration, Cargo, Compact, Covenant, LegacyScore, ProjectKind, RealmProject, Reform } from "./agreementsTypes.ts";
import { campaignRound, event, ruler, succeed, successionPreview } from "./realm.ts";
import { NATIONS, RESOURCES, findPath, neighbors, production } from "./world.ts";

const clamp = (n: number) => Math.max(0, Math.min(100, n));
function require(value: unknown, reason: string): asserts value { if (!value) throw Error(reason); }
const emptyCargo = (): Cargo => ({ coins: 0, resources: {} });
export const COVENANTS: Record<Covenant, string> = {
  none: "Resource exchange", access: "Mutual military access", protection: "Protect each other's trade",
  "heir-support": "Recipient supports the sender's heir", "low-tolls": "Mutual reduced transport tolls",
};
export const REFORMS: Record<Reform, { title: string; detail: string; cost: number }> = {
  balanced: { title: "Balanced obligations", detail: "Normal taxes and transport; all groups slowly recover approval.", cost: 0 },
  tolls: { title: "Royal tolls", detail: "+20% estate income; merchants lose 2 approval each own turn.", cost: 30 },
  charter: { title: "Merchant charter", detail: "−30% route costs; −15% estate income; merchants gain 2 approval each own turn; nobles lose 8 opinion on enactment.", cost: 60 },
  learning: { title: "Schools and healers", detail: "Costs 8 coins each own turn; scholars gain 2 approval; legitimacy gains 1; nobles lose 5 opinion on enactment.", cost: 80 },
};
export const ADMINISTRATION: Record<Administration, { title: string; yield: number; unrest: number; pressure: number; detail: string }> = {
  "local-rule": { title: "Retain the local ruler", yield: .7, unrest: 8, pressure: 1, detail: "70% revenue and production; +8 initial unrest; one administration point. The former ruler administers your holding." },
  governor: { title: "Appoint a governor", yield: .85, unrest: 15, pressure: 2, detail: "85% output; +15 initial unrest; two administration points. A loyal vassal administers the holding." },
  autonomy: { title: "Grant autonomy", yield: .5, unrest: 0, pressure: 0, detail: "50% output; no new unrest or administration burden; the former ruler keeps local authority." },
  direct: { title: "Integrate directly", yield: 1, unrest: 25, pressure: 3, detail: "Full output; +25 initial unrest; three administration points; the crown governs directly." },
};
export const PROJECTS: Record<ProjectKind, { title: string; cost: Cargo; upkeep: number; detail: string }> = {
  bridge: { title: "Common bridge", cost: { coins: 120, resources: { timber: 80, iron: 30 } }, upkeep: 6, detail: "Road at a river crossing; +20% output and +2 coins per contributor each own turn while open and maintained." },
  granary: { title: "Winter granary", cost: { coins: 80, resources: { grain: 120, timber: 60 } }, upkeep: 4, detail: "A supply depot; contributors receive 8 food each own turn, or 16 in winter, while open and maintained." },
  "sea-lane": { title: "Protected sea lane", cost: { coins: 180, resources: { timber: 100, iron: 20 } }, upkeep: 10, detail: "Connect two ports; matching contributor routes have half the storm risk and −30% transport cost." },
};
export const SPECIALISATIONS: Record<string, { resource: string; detail: string }> = {
  auremarch: { resource: "grain", detail: "Fertile grain exports; iron and equipment depend on neighbours." },
  "high-cairn": { resource: "iron", detail: "Mountain iron and guarded passes; construction needs imported timber." },
  saltmere: { resource: "luxury", detail: "Ports and shipping; limited farmland makes grain agreements valuable." },
  dunwald: { resource: "timber", detail: "Woodland timber exports; iron imports support development." },
  varnesk: { resource: "horses", detail: "Hardy horses and winter logistics; grain becomes scarce in winter." },
  sylvarenne: { resource: "herbs", detail: "Herbs and learning; heavy industry depends on trading partners." },
  "ilyr-coast": { resource: "luxury", detail: "Luxury exports and diplomatic ports; imported grain supports growth." },
  graskor: { resource: "livestock", detail: "Livestock and mobile hosts; timber and iron enable settled expansion." },
};
export function initializeAgreements(s: Campaign, kind: "council" | "sandbox" = "sandbox") {
  if (!s.agreements) {
    const year = Math.floor(s.tick / 120);
    const landmarks = NATIONS.flatMap((n) => {
      const fields = s.districts.filter((d) => d.nation === n.id);
      const chosen = [fields.find((d) => d.biome === "river"), fields.find((d) => d.port), fields.find((d) => ["mountains", "hills"].includes(d.biome))];
      return chosen.flatMap((d, i) => d && !chosen.slice(0, i).some((earlier) => earlier?.id === d.id) ? [{ hex: d.id, kind: (["crossing", "harbour", "pass"] as const)[i] }] : []);
    });
    s.agreements = { version: 1, compacts: [], projects: [], memories: [], domestic: {}, landmarks,
      calendar: { baseTick: Math.max(0, s.tick - (((campaignRound(s) - 1) % 12) * (s.turns?.order.length ?? 8) + (s.turns?.index ?? 0))), baseYear: year, agedYear: year, bornYear: year },
      campaign: { kind, startRound: campaignRound(s), length: 48, councilHeld: [], scores: {} } };
  }
  for (const h of s.houses) s.agreements.domestic[h.id] ??= {
    approval: { rural: 65, merchants: 60, scholars: 55 }, reform: "balanced", lastReform: -1,
    levyBurden: 0, lastRound: 0, successions: 0, successionSupport: 0,
  };
}
export function validateCargo(value: Cargo) {
  require(value && typeof value === "object" && Number.isSafeInteger(value.coins) && value.coins >= 0 && value.coins <= 500,
    "Cargo coins must be a whole number from 0 to 500");
  require(value.resources && typeof value.resources === "object" && !Array.isArray(value.resources) &&
    Object.entries(value.resources).every(([r, n]) => RESOURCES.includes(r as typeof RESOURCES[number]) && Number.isSafeInteger(n) && n >= 0 && n <= 200),
    "Cargo resources must be known goods with whole amounts from 0 to 200");
}
export function cargoDescription(c: Cargo) {
  return [c.coins ? `${c.coins} coins` : "", ...Object.entries(c.resources).filter(([, n]) => n).map(([r, n]) => `${n} ${r}`)].filter(Boolean).join(" + ") || "Political commitment";
}
function canPay(h: House, c: Cargo) { return h.treasury >= c.coins && Object.entries(c.resources).every(([r, n]) => h.stock[r as keyof House["stock"]] >= n); }
function pay(h: House, c: Cargo, multiplier = -1) {
  h.treasury += c.coins * multiplier;
  for (const r of RESOURCES) h.stock[r] += (c.resources[r] ?? 0) * multiplier;
}
function exchangeProblem(a: House, b: House, give: Cargo, take: Cargo) {
  if (!canPay(a, give)) return `${a.name} cannot deliver the promised cargo`;
  if (!canPay(b, take)) return `${b.name} cannot deliver the promised cargo`;
  if (RESOURCES.some((r) => a.stock[r] - (give.resources[r] ?? 0) + (take.resources[r] ?? 0) > 999 || b.stock[r] - (take.resources[r] ?? 0) + (give.resources[r] ?? 0) > 999)) return "Recipient stores are full; use or trade stock first";
  return "";
}
const war = (s: Campaign, a: House, b: House) => s.wars.includes([a.nation, b.nation].sort().join("|"));
export function remember(s: Campaign, a: House, b: House, detail: string, effect: number, kind: "honoured" | "broken" | "aid" | "succession", responsible?: string) {
  if (!s.agreements) return;
  for (const [owner, other] of [[a, b], [b, a]]) {
    owner.relations[other.id] = Math.max(-100, Math.min(100, (owner.relations[other.id] ?? 0) + effect));
    s.agreements.memories.unshift({ id: `memory-${++s.serial}`, house: owner.id, other: other.id, person: owner.ruler,
      round: campaignRound(s), kind, detail, effect, responsible });
  }
  s.agreements.memories = s.agreements.memories.slice(0, 160);
  event(s, { kind: "politics", house: a.id, other: b.id, title: detail, detail: `${a.name} and ${b.name}: ${effect > 0 ? "+" : ""}${effect} relations.` });
}
function breakPromise(s: Campaign, c: Compact, reason: string, responsible?: string) {
  c.status = "broken"; c.reason = reason;
  const a = s.houses.find((h) => h.id === c.from)!, b = s.houses.find((h) => h.id === c.to)!;
  remember(s, a, b, reason, -15, "broken", responsible);
}
function deliver(s: Campaign, c: Compact) {
  const a = s.houses.find((h) => h.id === c.from)!, b = s.houses.find((h) => h.id === c.to)!;
  const problem = exchangeProblem(a, b, c.give, c.take);
  require(!problem, problem);
  pay(a, c.give); pay(b, c.take); pay(a, c.take, 1); pay(b, c.give, 1);
  c.delivered++; c.remaining--; c.lastRound = campaignRound(s);
}
export function projectTotals(p: RealmProject): Cargo {
  const total = emptyCargo();
  for (const c of Object.values(p.contributions)) { total.coins += c.coins; for (const r of RESOURCES) total.resources[r] = (total.resources[r] ?? 0) + (c.resources[r] ?? 0); }
  return total;
}
export function projectRemainder(p: RealmProject): Cargo {
  const total = projectTotals(p), cost = PROJECTS[p.kind].cost;
  return { coins: Math.max(0, cost.coins - total.coins), resources: Object.fromEntries(Object.entries(cost.resources).map(([r, n]) => [r, Math.max(0, n - (total.resources[r as keyof Cargo["resources"]] ?? 0))])) };
}
export function compactAccess(s: Campaign, from: string, to: string) {
  return !s.wars.includes([from, to].sort().join("|")) && (s.agreements?.compacts ?? []).some((c) => c.status === "active" && c.covenant === "access" &&
    [s.houses.find((h) => h.id === c.from)?.nation, s.houses.find((h) => h.id === c.to)?.nation].includes(from) &&
    [s.houses.find((h) => h.id === c.from)?.nation, s.houses.find((h) => h.id === c.to)?.nation].includes(to));
}
export function administrationPressure(s: Campaign, h: House) {
  const used = s.districts.filter((d) => d.owner === h.id && d.integration).reduce((n, d) => n + ADMINISTRATION[d.integration!.policy].pressure, 0);
  const capacity = 6 + Math.floor((ruler(h)?.skills?.stewardship ?? 8) / 2);
  return { used, capacity, excess: Math.max(0, used - capacity) };
}
export function economicFactors(s: Campaign, h: House, d: District, specialist = true) {
  const domestic = s.agreements?.domestic[h.id], integration = d.integration ? ADMINISTRATION[d.integration.policy].yield : 1;
  const burden = domestic ? Math.min(.35, domestic.levyBurden / 3000) : 0;
  const bridge = s.agreements?.projects.some((p) => p.hex === d.id && p.kind === "bridge" && p.status === "complete" && p.open && p.maintained) ? 1.2 : 1;
  const specialised = specialist && SPECIALISATIONS[h.nation]?.resource === d.resource ? 1.15 : 1;
  return { output: integration * (1 + (d.development ?? 0) * .1) * bridge * specialised * (d.farm ? 1 - burden : 1),
    income: integration * (domestic?.reform === "tolls" ? 1.2 : domestic?.reform === "charter" ? .85 : 1) };
}
export function routeBenefits(s: Campaign, house: string, from: string, to: string, maritime: boolean) {
  const tollAgreement = s.agreements?.compacts.some((c) => c.status === "active" && c.covenant === "low-tolls" &&
    [c.from, c.to].includes(house) && [c.from, c.to].includes(s.districts.find((d) => d.id === to)?.owner ?? ""));
  const lane = maritime && s.agreements?.projects.some((p) => p.kind === "sea-lane" && p.status === "complete" && p.open && p.maintained && p.contributions[house] &&
    ((p.hex === from && p.destination === to) || (p.hex === to && p.destination === from)));
  return { cost: (s.agreements?.domestic[house]?.reform === "charter" ? .7 : 1) * ((s.agreements?.domestic[house]?.approval.merchants ?? 60) < 35 ? 1.2 : 1) * (tollAgreement ? .7 : 1) * (lane ? .7 : 1), hazard: lane ? .5 : 1 };
}
export function noteLevies(s: Campaign, h: House, count: number) {
  const domestic = s.agreements?.domestic[h.id];
  if (!domestic) return;
  domestic.levyBurden = Math.min(3000, domestic.levyBurden + count);
  domestic.approval.rural = clamp(domestic.approval.rural - Math.ceil(count / 100));
}
export function integrateTerritory(s: Campaign, h: House, hex: string, policy: Administration, administrator?: string) {
  require(Object.hasOwn(ADMINISTRATION, policy), "Unknown administration policy");
  const d = s.districts.find((d) => d.id === hex);
  const recharter = d?.owner === h.id && d.integration && !d.occupation;
  require(d?.owner && (recharter || d.occupation === h.id) && d.biome !== "legacy", "Select an occupied foreign estate or your integrated holding");
  require(!recharter || d.integration?.policy !== policy, "Choose a different estate charter");
  if (!recharter) {
    require(s.tick >= (d.occupiedAt ?? s.tick) + 3, "Hold occupation for three campaign ticks");
    require(s.armies.some((a) => a.house === h.id && a.hex === hex && !a.rebel && Object.values(a.troops).some((n) => n > 0)), "Your host must hold the occupied estate");
  }
  const former = s.houses.find((v) => v.id === (d.integration?.formerOwner ?? d.owner))!;
  const governor = policy === "governor" ? s.houses.find((v) => v.id === administrator && v.liege === h.id && !v.rebellion && v.loyalty >= 55) : undefined;
  require(policy !== "governor" || governor, "Choose a loyal sworn vassal as governor");
  require(h.treasury >= 50, "Administration requires 50 coins");
  h.treasury -= 50;
  d.integration = { policy, formerOwner: former.id, administrator: governor?.id ?? (policy === "direct" ? h.id : former.id), since: campaignRound(s) };
  d.owner = h.id; delete d.occupation; delete d.occupiedAt;
  d.disputed = policy === "direct" || policy === "governor";
  d.unrest = clamp(d.unrest + ADMINISTRATION[policy].unrest);
  if (recharter && policy === "autonomy") d.unrest = clamp(d.unrest - 15);
  if (governor) { governor.opinion = clamp(governor.opinion + 10); governor.loyalty = Math.round(governor.opinion * .55 + governor.legitimacy * .45); }
  if (policy === "autonomy" || policy === "local-rule") remember(s, h, former, `Local authority preserved at ${d.name}`, 8, "aid");
  event(s, { kind: "politics", house: h.id, other: former.id, hex, title: "A conquered estate receives a charter", detail: `${ADMINISTRATION[policy].title}. ${ADMINISTRATION[policy].detail}` });
}
export function agreementCommand(s: Campaign, h: House, cmd: Command): boolean {
  const a = s.agreements!;
  const round = campaignRound(s);
  switch (cmd.type) {
    case "offerCompact": {
      validateCargo(cmd.give); validateCargo(cmd.take);
      require(Object.hasOwn(COVENANTS, cmd.covenant) && Number.isSafeInteger(cmd.duration) && cmd.duration >= 2 && cmd.duration <= 8, "Choose a known covenant lasting 2–8 rounds");
      const partner = s.houses.find((v) => v.id === cmd.house);
      require(partner && partner.id !== h.id && s.titles.some((t) => t.holder === partner.id), "Negotiate with another crown holder");
      require(!war(s, h, partner), "Make peace before offering a compact");
      require(cmd.covenant !== "none" || cmd.give.coins + cmd.take.coins + Object.values(cmd.give.resources).reduce((n, x) => n + x, 0) + Object.values(cmd.take.resources).reduce((n, x) => n + x, 0) > 0, "Offer resources, coins or a political covenant");
      require(a.compacts.filter((c) => ["offered", "active"].includes(c.status) && [c.from, c.to].includes(h.id)).length < 6, "Six open or active compacts per house");
      require(a.compacts.length < 160, "The compact ledger is full");
      require(canPay(h, cmd.give), "You cannot supply your first delivery");
      a.compacts.push({ id: `compact-${++s.serial}`, from: h.id, to: partner.id, give: structuredClone(cmd.give), take: structuredClone(cmd.take), covenant: cmd.covenant,
        duration: cmd.duration, remaining: cmd.duration, delivered: 0, status: "offered", offered: round, lastRound: 0, reason: "Awaiting the recipient's own turn and consent" });
      return true;
    }
    case "answerCompact": {
      const c = a.compacts.find((c) => c.id === cmd.compact);
      require(c?.status === "offered" && c.to === h.id, "Only the recipient can answer an open compact");
      require(typeof cmd.accept === "boolean", "Accept or decline the compact");
      if (!cmd.accept) { c.status = "declined"; c.reason = `${h.name} declined`; return true; }
      const sender = s.houses.find((v) => v.id === c.from)!;
      require(!war(s, sender, h), "Make peace before accepting a compact");
      require(a.compacts.filter((v) => v.status === "active" && [v.from, v.to].includes(h.id)).length < 6, "Six active compacts per house");
      deliver(s, c); c.status = "active"; c.reason = "First delivery exchanged; obligations continue on the sender's turn";
      remember(s, sender, h, "A compact is sealed", 2, "honoured");
      return true;
    }
    case "breakCompact": {
      const c = a.compacts.find((c) => c.id === cmd.compact);
      require(c && [c.from, c.to].includes(h.id) && ["offered", "active"].includes(c.status), "Only a compact party can withdraw");
      if (c.status === "offered") { c.status = "declined"; c.reason = "Offer withdrawn before acceptance"; }
      else breakPromise(s, c, `${h.name} withdrew from a sworn compact`, h.id);
      return true;
    }
    case "foundProject": {
      require(Object.hasOwn(PROJECTS, cmd.kind), "Unknown joint project");
      const d = s.districts.find((d) => d.id === cmd.hex), dest = s.districts.find((d) => d.id === cmd.destination);
      require(d?.owner === h.id && !d.occupation && d.biome !== "legacy", "Found a project on an unoccupied royal estate");
      require(cmd.kind !== "bridge" || d.biome === "river", "A bridge needs a river crossing");
      require(cmd.kind !== "granary" || d.farm || d.city, "A granary needs farmland or a city");
      if (cmd.kind === "sea-lane") {
        require(d.port && dest?.port && dest.id !== d.id && dest.owner, "A sea lane connects two distinct owned ports");
        require(!war(s, h, s.houses.find((v) => v.id === dest.owner)!), "Make peace with the destination owner");
        require(findPath(s.districts, d.id, dest.id, true).length, "No sea route between these ports");
      }
      require(a.projects.filter((p) => p.owner === h.id && p.status !== "cancelled").length < 4 && a.projects.length < 40, "Four joint projects per crown");
      require(!a.projects.some((p) => p.hex === d.id && p.kind === cmd.kind && p.status !== "cancelled"), "This estate already has that joint project");
      a.projects.push({ id: `project-${++s.serial}`, kind: cmd.kind, hex: d.id, destination: cmd.kind === "sea-lane" ? cmd.destination : undefined, owner: h.id, status: "funding", contributions: {}, open: true, maintained: true, lastRound: 0 });
      return true;
    }
    case "fundProject": {
      validateCargo(cmd.cargo);
      const p = a.projects.find((p) => p.id === cmd.project);
      require(p?.status === "funding", "Fund an unfinished project");
      const owner = s.houses.find((v) => v.id === p.owner)!;
      require(!war(s, h, owner) && s.districts.find((d) => d.id === p.hex)?.owner === p.owner, "The project must remain in its founder's peaceful domain");
      const left = projectRemainder(p);
      require(cmd.cargo.coins <= left.coins && RESOURCES.every((r) => (cmd.cargo.resources[r] ?? 0) <= (left.resources[r] ?? 0)), "Contribute only goods and coins still needed");
      require(cmd.cargo.coins + Object.values(cmd.cargo.resources).reduce((n, x) => n + x, 0) > 0, "Choose a positive contribution");
      require(canPay(h, cmd.cargo), "Not enough resources for this contribution");
      pay(h, cmd.cargo); const contribution = p.contributions[h.id] ??= emptyCargo();
      contribution.coins += cmd.cargo.coins;
      for (const r of RESOURCES) contribution.resources[r] = (contribution.resources[r] ?? 0) + (cmd.cargo.resources[r] ?? 0);
      const remainder = projectRemainder(p);
      if (!remainder.coins && Object.values(remainder.resources).every((n) => !n)) {
        p.status = "complete";
        const d = s.districts.find((d) => d.id === p.hex)!;
        if (p.kind === "bridge") d.road = true;
        if (p.kind === "granary") d.depot = true;
        for (const id of Object.keys(p.contributions).filter((id) => id !== p.owner)) remember(s, owner, s.houses.find((v) => v.id === id)!, `${PROJECTS[p.kind].title} completed together`, 8, "aid");
        event(s, { kind: "economy", house: p.owner, hex: p.hex, title: `${PROJECTS[p.kind].title} opens`, detail: PROJECTS[p.kind].detail });
      }
      return true;
    }
    case "cancelProject": {
      const p = a.projects.find((p) => p.id === cmd.project);
      require(p?.owner === h.id && p.status === "funding", "Only the founder can cancel an unfinished project");
      for (const [id, cargo] of Object.entries(p.contributions)) {
        const recipient = s.houses.find((v) => v.id === id)!;
        require(RESOURCES.every((r) => recipient.stock[r] + (cargo.resources[r] ?? 0) <= 999), "Contributor stores are full; wait before refunding");
      }
      for (const [id, cargo] of Object.entries(p.contributions)) pay(s.houses.find((v) => v.id === id)!, cargo, 1);
      p.status = "cancelled"; return true;
    }
    case "projectAccess": {
      const p = a.projects.find((p) => p.id === cmd.project);
      require(p?.owner === h.id && p.status === "complete" && s.districts.find((d) => d.id === p.hex)?.owner === h.id, "Only the founder controlling the completed project can change access");
      require(typeof cmd.open === "boolean", "Choose open or closed access");
      require(p.open !== cmd.open, "Access is already set");
      p.open = cmd.open;
      for (const id of Object.keys(p.contributions).filter((id) => id !== h.id)) remember(s, h, s.houses.find((v) => v.id === id)!, `${h.name} ${cmd.open ? "restored" : "closed"} shared project access`, cmd.open ? 3 : -12, cmd.open ? "aid" : "broken", cmd.open ? undefined : h.id);
      return true;
    }
    case "reform": {
      require(Object.hasOwn(REFORMS, cmd.reform), "Unknown reform");
      const d = a.domestic[h.id], reform = REFORMS[cmd.reform];
      require(d.lastReform !== round && d.reform !== cmd.reform, "One different reform per own turn");
      require(h.treasury >= reform.cost, `Reform requires ${reform.cost} coins`);
      h.treasury -= reform.cost; d.reform = cmd.reform; d.lastReform = round;
      for (const v of s.houses.filter((v) => v.liege === h.id)) {
        v.opinion = clamp(v.opinion - (cmd.reform === "charter" ? 8 : cmd.reform === "learning" ? 5 : 0));
        v.loyalty = Math.round(v.opinion * .55 + v.legitimacy * .45);
      }
      event(s, { kind: "politics", house: h.id, title: reform.title, detail: reform.detail });
      return true;
    }
    case "integrate": integrateTerritory(s, h, cmd.hex, cmd.policy, cmd.administrator); return true;
    case "develop": {
      require(["farm", "market", "town"].includes(cmd.building), "Unknown estate development");
      const d = s.districts.find((d) => d.id === cmd.hex);
      require(d?.owner === h.id && !d.occupation && d.biome !== "legacy", "Develop an unoccupied royal estate");
      require((d.development ?? 0) < 3, "This estate is fully developed");
      require(cmd.building !== "farm" || d.farm, "Farm improvements need existing farmland");
      require(cmd.building !== "town" || d.city === "town", "Town growth needs a market town");
      require(cmd.building !== "market" || !d.city, "This estate already has a market");
      const cost: Cargo = { coins: cmd.building === "town" ? 150 : 60, resources: { timber: cmd.building === "town" ? 40 : 20, iron: cmd.building === "town" ? 20 : 0 } };
      require(canPay(h, cost), `Development requires ${cargoDescription(cost)}`); pay(h, cost);
      d.development = (d.development ?? 0) + 1;
      if (cmd.building === "market") d.city = "town";
      if (cmd.building === "town") d.city = "major";
      a.domestic[h.id].approval[cmd.building === "farm" ? "rural" : "merchants"] = clamp(a.domestic[h.id].approval[cmd.building === "farm" ? "rural" : "merchants"] + 5);
      return true;
    }
    case "continueSandbox":
      require(a.campaign.result && s.mode === "single", "Only a finished solo campaign can continue as a sandbox");
      a.campaign.kind = "sandbox"; delete a.campaign.result; return true;
    default: return false;
  }
}
/** Only the controlling crown's turn advances contractual deliveries, projects and politics. */
export function advanceAgreements(s: Campaign, nation?: string) {
  if (!s.agreements) return;
  initializeAgreements(s);
  const a = s.agreements, round = campaignRound(s);
  for (const c of a.compacts) {
    if (c.status === "offered" && round - c.offered > 3) { c.status = "expired"; c.reason = "Offer expired after three rounds"; }
    if (c.status !== "active") continue;
    const from = s.houses.find((h) => h.id === c.from)!, to = s.houses.find((h) => h.id === c.to)!;
    if (war(s, from, to)) { breakPromise(s, c, "War broke a sworn compact"); continue; }
    if (nation && from.nation !== nation || c.lastRound >= round) continue;
    const protects = c.covenant === "protection" && s.routes.some((r) => [from.id, to.id].includes(r.house) && r.status.startsWith("Blockaded"));
    if (protects) { breakPromise(s, c, "Promised trade protection failed during a blockade"); continue; }
    const problem = exchangeProblem(from, to, c.give, c.take);
    if (c.remaining && problem) { breakPromise(s, c, problem, !canPay(from, c.give) ? from.id : !canPay(to, c.take) ? to.id : undefined); continue; }
    if (c.remaining) deliver(s, c);
    else { c.status = "fulfilled"; c.reason = "All deliveries and the final round of political obligations honoured"; remember(s, from, to, "A sworn compact was fulfilled", 8, "honoured"); }
  }
  for (const h of s.houses.filter((h) => (!nation || h.nation === nation) && s.titles.some((t) => t.holder === h.id))) {
    const domestic = a.domestic[h.id];
    if (domestic.lastRound >= round) continue;
    domestic.lastRound = round;
    domestic.levyBurden = Math.max(0, domestic.levyBurden - 100);
    domestic.approval.rural = clamp(domestic.approval.rural + (h.stock.grain < 30 ? -4 : 1));
    domestic.approval.merchants = clamp(domestic.approval.merchants + (domestic.reform === "tolls" ? -2 : domestic.reform === "charter" ? 2 : 1));
    domestic.approval.scholars = clamp(domestic.approval.scholars + (domestic.reform === "learning" ? 2 : 1));
    if (domestic.approval.scholars < 35) h.legitimacy = clamp(h.legitimacy - 1);
    if (domestic.reform === "learning") {
      if (h.treasury >= 8) { h.treasury -= 8; h.legitimacy = clamp(h.legitimacy + 1); }
      else domestic.approval.scholars = clamp(domestic.approval.scholars - 6);
    }
    const pressure = administrationPressure(s, h);
    for (const d of s.districts.filter((d) => d.owner === h.id && !d.occupation)) {
      d.unrest = clamp(d.unrest + pressure.excess + (domestic.approval.rural < 35 ? 2 : -1));
      if (d.integration?.policy === "governor" && (s.houses.find((v) => v.id === d.integration?.administrator)?.loyalty ?? 100) < 40) d.unrest = clamp(d.unrest + 3);
    }
    for (const p of a.projects.filter((p) => p.owner === h.id && p.status === "complete" && p.lastRound < round)) {
      p.lastRound = round;
      const cost = PROJECTS[p.kind].upkeep;
      p.maintained = s.districts.find((d) => d.id === p.hex)?.owner === h.id && !s.districts.find((d) => d.id === p.hex)?.occupation && h.treasury >= cost;
      if (p.maintained) h.treasury -= cost;
    }
    for (const p of a.projects.filter((p) => p.status === "complete" && p.open && p.maintained && p.contributions[h.id] && !war(s, h, s.houses.find((v) => v.id === p.owner)!))) {
      if (p.kind === "bridge") h.treasury += 2;
      if (p.kind === "granary") h.stock.grain = Math.min(999, h.stock.grain + (Math.floor((round - 1) / 3) % 4 === 3 ? 16 : 8));
    }
    if (a.campaign.kind === "council" && round >= a.campaign.startRound + 24 && !a.campaign.councilHeld.includes(h.id)) {
      const ready = successionPreview(s, h);
      if (ready.recognized && ready.next) {
        a.campaign.councilHeld.push(h.id); succeed(s, h);
      } else event(s, { kind: "succession", house: h.id, title: "The succession council awaits an heir", detail: "Secure a recognised successor; the council will reconvene on your next turn." });
    }
  }
}
export function connectedHoldings(s: Campaign, h: House) {
  const controlled = s.districts.filter((d) => {
    const owner = s.houses.find((v) => v.id === (d.occupation ?? d.owner));
    return owner && !owner.rebellion && (owner.id === h.id || owner.liege === h.id);
  });
  const allowed = new Set(controlled.map((d) => d.id));
  const start = controlled.find((d) => d.id === NATIONS.find((n) => n.id === h.nation)?.capital) ?? controlled[0];
  const seen = new Set<string>();
  if (start) {
    const queue = [start]; seen.add(start.id);
    for (let i = 0; i < queue.length; i++) for (const d of neighbors(s.districts, queue[i].id)) if (allowed.has(d.id) && !seen.has(d.id)) { seen.add(d.id); queue.push(d); }
  }
  return { connected: seen, total: controlled.length };
}
export function legacyScore(s: Campaign, h: House): LegacyScore {
  const domestic = s.agreements?.domestic[h.id], family = successionPreview(s, h);
  const vassals = s.houses.filter((v) => v.liege === h.id), estates = s.districts.filter((d) => d.owner === h.id && !d.occupation);
  const fulfilled = (s.agreements?.compacts ?? []).filter((c) => c.status === "fulfilled" && [c.from, c.to].includes(h.id));
  const partners = new Set(fulfilled.map((c) => c.from === h.id ? c.to : c.from));
  const projects = s.agreements?.projects.filter((p) => p.status === "complete" && p.open && p.maintained && p.contributions[h.id]) ?? [];
  const broken = s.agreements?.memories.filter((m) => m.house === h.id && m.kind === "broken" && m.responsible === h.id).length ?? 0;
  const connected = connectedHoldings(s, h).connected;
  const landmarks = s.agreements?.landmarks.filter((l) => connected.has(l.hex)).length ?? 0;
  const dynasty = Math.min(25, (family.next && family.recognized ? 6 : 0) + Math.min(8, (domestic?.successions ?? 0) * 8) + Math.min(6, vassals.filter((v) => !v.rebellion && v.loyalty >= 60).length * 2) + (h.legitimacy >= 70 ? 5 : 0));
  const prosperity = Math.min(25, Math.min(8, s.routes.filter((r) => r.house === h.id && r.delivered >= 24 && !r.status.startsWith("Blockaded")).length * 2) + Math.min(8, projects.length * 4) + Math.min(5, estates.reduce((n, d) => n + (d.development ?? 0), 0)) + (h.stock.grain >= 100 && h.treasury >= 100 ? 4 : 0));
  const diplomacy = Math.max(0, Math.min(25, Math.min(12, partners.size * 4) + Math.min(8, fulfilled.length * 2) + Math.min(5, projects.filter((p) => Object.keys(p.contributions).length > 1).length * 5) - broken * 3));
  const defence = Math.min(25, Math.min(9, landmarks * 3) + (estates.length && estates.every((d) => d.unrest < 40) ? 6 : 0) + (s.districts.some((d) => d.id === NATIONS.find((n) => n.id === h.nation)?.capital && connected.has(d.id) && !d.occupation) ? 6 : 0) + (connected.size >= connectedHoldings(s, h).total * .7 ? 4 : 0));
  return { dynasty, prosperity, diplomacy, defence, total: dynasty + prosperity + diplomacy + defence };
}
export function updateCampaignOutcome(s: Campaign) {
  if (!s.agreements || s.agreements.campaign.result) return;
  const campaign = s.agreements.campaign;
  campaign.scores = Object.fromEntries(s.titles.map((t) => { const h = s.houses.find((h) => h.id === t.holder)!; return [h.id, legacyScore(s, h)]; }));
  if (campaign.kind === "council" && campaignRound(s) >= campaign.startRound + campaign.length && !s.battles.length && !s.turns?.pending.length) {
    const best = Math.max(...Object.values(campaign.scores).map((score) => score.total));
    campaign.result = { round: campaignRound(s), winners: Object.keys(campaign.scores).filter((id) => campaign.scores[id].total === best) };
    event(s, { kind: "politics", house: campaign.result.winners[0], title: "The council records the realm's legacy", detail: `The ${campaign.length}-round chronicle has ended. Dynasty, prosperity, diplomacy and defence each contribute up to 25 points.` });
  }
}
export type RealmDecision = { id: string; title: string; detail: string; tab: string; urgency: "urgent" | "opportunity" | "notice"; hex?: string };
export function realmDecisions(s: Campaign, h: House): RealmDecision[] {
  const result: RealmDecision[] = [], a = s.agreements;
  if (!a) return result;
  const stores = h.stock.grain;
  if (stores < 100) result.push({ id: "food", title: "Secure the next harvest", detail: `${Math.floor(stores)} food in reserve. Negotiate grain, improve farms or fund a shared granary.`, tab: "agreements", urgency: stores < 30 ? "urgent" : "notice" });
  for (const c of a.compacts.filter((c) => c.status === "offered" && c.to === h.id)) result.push({ id: c.id, title: "A trade compact awaits your seal", detail: `${s.houses.find((v) => v.id === c.from)?.name} offers ${cargoDescription(c.give)} for ${cargoDescription(c.take)}.`, tab: "agreements", urgency: "opportunity" });
  const heir = successionPreview(s, h);
  if (!heir.next || !heir.recognized || heir.opposition.length > 1) result.push({ id: "heir", title: "Prepare the next reign", detail: `${heir.opposition.length} houses may dispute succession. Offices, bargains and sworn support can help.`, tab: "dynasty", urgency: !heir.recognized ? "urgent" : "notice" });
  const pressure = administrationPressure(s, h);
  if (pressure.excess) result.push({ id: "administration", title: "Administration is overstretched", detail: `${pressure.used}/${pressure.capacity} administration points; unrest rises by ${pressure.excess} each own turn.`, tab: "interests", urgency: "urgent" });
  for (const d of s.districts.filter((d) => d.occupation === h.id && d.owner !== h.id).slice(0, 2)) result.push({ id: d.id, title: "Choose how to govern a conquest", detail: `${d.name}: local rule, a governor, autonomy or direct integration.`, tab: "district", urgency: "notice", hex: d.id });
  const domestic = a.domestic[h.id];
  if (domestic && Object.values(domestic.approval).some((n) => n < 40)) result.push({ id: "interests", title: "Your subjects need an answer", detail: "A domestic group has low approval. Review reforms and levy pressure.", tab: "interests", urgency: "urgent" });
  const project = a.projects.find((p) => p.status === "funding" && p.owner !== h.id && !war(s, h, s.houses.find((v) => v.id === p.owner)!));
  if (project) result.push({ id: project.id, title: "Build something together", detail: `${PROJECTS[project.kind].title} seeks ${cargoDescription(projectRemainder(project))}.`, tab: "projects", urgency: "opportunity", hex: project.hex });
  if (!result.length) result.push({ id: "opportunity", title: "Give the next reign a stronger realm", detail: "Arrange a resource compact, improve an estate or invite others to a shared project.", tab: "agreements", urgency: "opportunity" });
  return result.sort((x, y) => Number(y.urgency === "urgent") - Number(x.urgency === "urgent")).slice(0, 5);
}
export function agreementBotCommands(s: Campaign, h: House): Command[] {
  const a = s.agreements;
  if (!a) return [];
  const commands: Command[] = [];
  for (const c of a.compacts.filter((c) => c.status === "offered" && c.to === h.id)) {
    const other = s.houses.find((v) => v.id === c.from)!;
    const value = (cargo: Cargo) => cargo.coins + RESOURCES.reduce((n, r) => n + (cargo.resources[r] ?? 0) * s.prices[r], 0);
    const fair = value(c.give) + (c.covenant === "none" ? 0 : 20) >= value(c.take) * .8;
    commands.push({ type: "answerCompact", compact: c.id, accept: !war(s, h, other) && fair && (h.relations[other.id] ?? 0) >= -20 && !exchangeProblem(other, h, c.give, c.take) });
  }
  const project = a.projects.find((p) => p.status === "funding" && p.owner !== h.id && !p.contributions[h.id] && !war(s, h, s.houses.find((v) => v.id === p.owner)!));
  if (project && h.treasury > 180) {
    const left = projectRemainder(project);
    const cargo = { coins: Math.min(30, left.coins), resources: Object.fromEntries(RESOURCES.map((r) => [r, Math.min(left.resources[r] ?? 0, 15, Math.max(0, Math.floor(h.stock[r] - 30)))])) };
    if (cargo.coins + Object.values(cargo.resources).reduce((n, x) => n + x, 0) > 0) commands.push({ type: "fundProject", project: project.id, cargo });
  }
  if (h.stock.grain < 60 && a.compacts.filter((c) => ["active", "offered"].includes(c.status) && [c.from, c.to].includes(h.id)).length < 3) {
    const supplier = s.houses.find((v) => s.titles.some((t) => t.holder === v.id) && v.id !== h.id && v.stock.grain > 150 && !war(s, h, v) && !a.compacts.some((c) => ["offered", "active"].includes(c.status) && c.from === h.id && c.to === v.id));
    if (supplier && h.treasury >= 30) commands.push({ type: "offerCompact", house: supplier.id, give: { coins: 30, resources: {} }, take: { coins: 0, resources: { grain: 20 } }, covenant: "none", duration: 3 });
  }
  if (a.domestic[h.id]?.approval.merchants < 35 && a.domestic[h.id].reform !== "charter" && h.treasury > 100) commands.push({ type: "reform", reform: "charter" });
  return commands;
}

/** Used by the inspector; values are forecasts, never promises of an unknown battle outcome. */
export function estateForecast(s: Campaign, h: House, d: District) {
  return Math.round(production(d) * economicFactors(s, h, d).output * 10) / 10;
}
