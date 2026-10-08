import type { Army, Campaign, District, House } from "./types.ts";
import { findPath, hexDistance, neighbors } from "./world.ts";
import { campaignRound, councilSkill, season } from "./realm.ts";

const soldiers = (a: Army) => Object.values(a.troops).reduce((sum, n) => sum + n, 0);
export function realmNation(s: Campaign, a: Army) {
  return s.houses.find((h) => h.id === (a.pledgedTo ?? a.house))?.nation ?? a.origin;
}
export function militaryAccess(s: Campaign, from: string, to: string) {
  return from === to || (s.treaties ?? []).some((t) => t.access && t.until >= campaignRound(s) && [t.from, t.to].includes(from) && [t.from, t.to].includes(to));
}
export function hostileAt(s: Campaign, nation: string, d: District) {
  return (s.sieges ?? []).some((siege) => siege.hex === d.id && s.houses.find((h) => h.id === siege.defender)?.nation === nation) ||
    s.armies.some((a) => a.hex === d.id && soldiers(a) > 0 && (a.rebel || s.wars.includes([nation, realmNation(s, a)].sort().join("|"))));
}
/** Food flows through friendly/access-granted districts. Hostile troops close a corridor. */
export function supplyConnection(s: Campaign, a: Army, at = a.hex) {
  const nation = realmNation(s, a);
  const start = s.districts.find((d) => d.id === at);
  if (!start) return { connected: false, path: [] as string[], reason: "No known supply position" };
  if (a.voyage) return { connected: true, path: [at], reason: "Transport fleet carries its stores" };
  const accessible = (d: District) => {
    const owner = s.houses.find((h) => h.id === (d.occupation ?? d.owner));
    return owner && militaryAccess(s, nation, owner.nation) && !hostileAt(s, nation, d);
  };
  const source = (d: District) => accessible(d) && (d.city || d.depot || d.farm && d.resource === "grain" && !d.occupation);
  const seen = new Set<string>([at]);
  const queue: string[][] = [[at]];
  for (let index = 0; index < queue.length; index++) {
    const path = queue[index], d = s.districts.find((d) => d.id === path.at(-1))!;
    if (source(d)) return { connected: true, path, reason: `${d.depot ? "Supply depot" : d.city ? "City stores" : "Friendly farms"} at ${d.name}`, source: d.id };
    if (path.length > 1 && !accessible(d)) continue;
    for (const next of neighbors(s.districts, d.id)) {
      if (seen.has(next.id) || !accessible(next) || (path.length === 1 && hostileAt(s, nation, start))) continue;
      seen.add(next.id); queue.push([...path, next.id]);
    }
  }
  // A friendly/occupied port can receive supplies from a realm shipyard across an open sea lane.
  if (start.port && accessible(start)) {
    for (const port of s.districts.filter((d) => d.port && d.shipyard && source(d))) {
      const path = findPath(s.districts, port.id, start.id, true);
      if (path.length && path.every((id) => !hostileAt(s, nation, s.districts.find((d) => d.id === id)!)))
        return { connected: true, path: [port.id, ...path], reason: `Sea supply from ${port.name}`, source: port.id };
    }
  }
  return { connected: false, path: [] as string[], reason: "No open route to friendly farms, a city, or a depot" };
}
export function provisionLimit(s: Campaign, a: Army) {
  const h = s.houses.find((h) => h.id === a.house);
  return (a.origin === "varnesk" ? 4 : 3) + (h && councilSkill(s, h, "stewardship") >= 16 ? 1 : 0);
}
export function feedArmy(s: Campaign, a: Army, demand: number, actingNation?: string) {
  const h = s.houses.find((h) => h.id === a.house)!;
  if (!s.strategyRules || a.garrison) {
    const available = Math.min(h.stock.grain, demand); h.stock.grain -= available;
    return demand ? available / demand : 1;
  }
  const connection = supplyConnection(s, a);
  a.supplySource = connection.reason;
  // Stocks and carried stores are consumed only on this host's controlling realm turn.
  if (s.turns && realmNation(s, a) !== actingNation) return a.supply;
  if (connection.connected) {
    const available = Math.min(h.stock.grain, demand);
    h.stock.grain -= available;
    if (available >= demand) a.provisions = Math.min(provisionLimit(s, a), (a.provisions ?? 0) + 1);
    return demand ? available / demand : 1;
  }
  if ((a.provisions ?? 0) > 0) { a.provisions!--; return 1; }
  return 0;
}
export function routeForecast(s: Campaign, a: Army, destination: string) {
  const path = findPath(s.districts, a.hex, destination);
  let stores = a.provisions ?? provisionLimit(s, a), isolated = 0, risk = false;
  // A campaign turn feeds the host at its current position before marching.
  for (const id of path.length ? [a.hex, ...path.slice(0, -1)] : []) {
    if (supplyConnection(s, a, id).connected) stores = provisionLimit(s, a);
    else { stores--; isolated++; if (stores < 0) risk = true; }
  }
  return { path, stores: Math.max(0, stores), isolated, risk, winter: season(s) === "Winter" };
}
export function visibleDistricts(s: Campaign, house: House) {
  const visible = new Set<string>();
  const houseNations = new Map(s.houses.map((h) => [h.id, h.nation]));
  const districts = new Map(s.districts.map((d) => [d.id, d]));
  const origins = s.districts.filter((d) => houseNations.get(d.occupation ?? d.owner ?? "") === house.nation);
  origins.forEach((d) => visible.add(d.id));
  const watches = origins.filter((d) => d.watchtower);
  const armies = s.armies.filter((a) => houseNations.get(a.pledgedTo ?? a.house) === house.nation).map((a) => ({ origin: districts.get(a.hex)!, range: a.garrison ? 1 : 2 }));
  const scouts = (s.scouts ?? []).filter((m) => m.house === house.id && m.until >= campaignRound(s)).map((m) => districts.get(m.hex)!);
  const scoutRange = councilSkill(s, house, "intrigue") >= 16 ? 3 : 2;
  const traders = new Set(s.routes.filter((r) => r.house === house.id && r.delivered > 0 && !r.status.startsWith("Blockaded")).flatMap((r) => r.path));
  for (const d of s.districts) {
    if (visible.has(d.id) || watches.some((o) => hexDistance(o, d) <= (house.nation === "dunwald" ? 3 : 2)) || armies.some((a) => hexDistance(a.origin, d) <= a.range) || scouts.some((o) => hexDistance(o, d) <= scoutRange) || traders.has(d.id)) visible.add(d.id);
  }
  return visible;
}
export function updateIntelligence(s: Campaign) {
  if (!s.strategyRules) return;
  s.intelligence ??= {};
  const round = campaignRound(s);
  s.scouts = (s.scouts ?? []).filter((mission) => mission.until >= round);
  for (const house of s.houses.filter((h) => !h.liege)) {
    const visible = visibleDistricts(s, house);
    const sightings = s.armies.filter((a) => !a.garrison && realmNation(s, a) !== house.nation && visible.has(a.hex) && soldiers(a) > 0);
    const old = (s.intelligence[house.id] ?? []).filter((r) => round - r.seen <= 5 && !visible.has(r.hex) && !sightings.some((a) => a.id === r.army));
    s.intelligence[house.id] = [...sightings.map((a) => ({ army: a.id, house: a.house, name: a.name, hex: a.hex,
      low: Math.floor(soldiers(a) * 0.8 / 100) * 100, high: Math.max(100, Math.ceil(soldiers(a) * 1.2 / 100) * 100), seen: round })), ...old].slice(0, 80);
  }
}
/** Multiplayer replies omit unseen armies and other players' scout/intelligence records. */
export function strategyView(s: Campaign, houseId: string): Campaign {
  if (!s.strategyRules) return s;
  const house = s.houses.find((h) => h.id === houseId);
  if (!house) return s;
  const visible = visibleDistricts(s, house);
  const engagements = new Set(s.battles.flatMap((b) => b.armies));
  const threatened = s.turns?.pending.filter((r) => r.to === houseId && r.kind === "attack").map((r) => r.army) ?? [];
  return { ...s,
    armies: s.armies.filter((a) => realmNation(s, a) === house.nation || visible.has(a.hex) || engagements.has(a.id) || threatened.includes(a.id)).map((a) => realmNation(s, a) === house.nation ? a : { ...a, path: [], objective: undefined, voyage: a.voyage ? { ...a.voyage, destination: a.hex, path: a.voyage.path.slice(0, a.voyage.progress + 1) } : undefined }),
    scouts: (s.scouts ?? []).filter((m) => m.house === houseId),
    intelligence: { [houseId]: s.intelligence?.[houseId] ?? [] },
    events: (s.events ?? []).filter((e) => e.house === houseId || e.other === houseId || s.houses.find((h) => h.id === e.house)?.nation === house.nation || ["succession", "diplomacy"].includes(e.kind) || !!e.hex && visible.has(e.hex)),
    battleReports: s.battleReports?.filter((r) => r.sides.some((side) => s.houses.find((h) => h.id === side.house)?.nation === house.nation)),
    log: s.log.filter((line) => !s.armies.some((a) => realmNation(s, a) !== house.nation && !visible.has(a.hex) && line.includes(a.name))),
  };
}
