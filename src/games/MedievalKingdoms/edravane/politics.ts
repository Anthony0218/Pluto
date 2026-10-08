import type {
  Army,
  Campaign,
  District,
  House,
  TradeRoute,
  WarReason,
} from "./types.ts";
import { neighbors } from "./world.ts";
import { campaignRound } from "./realm.ts";

const soldiers = (a: Army) =>
  Object.values(a.troops).reduce((n, v) => n + v, 0);
export const WAR_REASONS: Record<WarReason, string> = {
  "trade-blockade": "Trade route blocked",
  "occupied-land": "Recover occupied territory",
  "captive-family": "Rescue captured family",
  "defend-ally": "Defend a marriage ally",
  insult: "Answer a diplomatic insult",
  "territorial-conquest": "Territorial conquest of an unprotected border",
  "dynastic-claim": "Press an inherited family claim",
  unjustified: "War without a justified reason",
};
function realmHouses(s: Campaign, h: House) {
  return s.houses.filter((v) => v.id === h.id || v.liege === h.id);
}
/** Accepted living marriages bind realms; good relations and offers are not pacts. */
export function hasMarriagePact(s: Campaign, h: House, nation: string) {
  const people = realmHouses(s, h)
    .flatMap((v) => v.family)
    .filter((p) => p.alive);
  return s.houses
    .filter((v) => v.nation === nation)
    .some((v) =>
      v.family.some(
        (p) =>
          p.alive &&
          people.some((own) => own.spouse === p.id && p.spouse === own.id),
      ),
    );
}
export function conquestTargets(s: Campaign, h: House, nation: string) {
  if (nation === h.nation || hasMarriagePact(s, h, nation)) return [];
  const ids = new Set(realmHouses(s, h).map((v) => v.id));
  const land = (d: District) => d.owner && !["sea", "legacy"].includes(d.biome);
  return s.districts.filter(
    (d) =>
      land(d) &&
      s.houses.find((v) => v.id === (d.occupation ?? d.owner))?.nation ===
        nation &&
      neighbors(s.districts, d.id).some(
        (n) => land(n) && ids.has(n.occupation ?? n.owner!),
      ),
  );
}
export function insultGrievances(s: Campaign, h: House, nation: string) {
  const ids = new Set(realmHouses(s, h).map((v) => v.id));
  return (s.insults ?? []).filter(
    (i) =>
      !i.resolved &&
      ids.has(i.to) &&
      s.houses.find((v) => v.id === i.from)?.nation === nation,
  );
}
/** A single surviving soldier can stop cargo; empty and friendly forces cannot. */
export function routeBlockers(s: Campaign, route: TradeRoute) {
  const owner = s.houses.find((h) => h.id === route.house);
  if (!owner) return [];
  return s.armies.filter((a) => {
    const faction = s.houses.find((h) => h.id === (a.pledgedTo ?? a.house));
    if (
      !faction ||
      soldiers(a) < 1 ||
      (faction.nation === owner.nation && !a.rebel)
    )
      return false;
    if ((s.treaties ?? []).some((t) => t.trade && t.until >= campaignRound(s) && [t.from, t.to].includes(faction.nation) && [t.from, t.to].includes(owner.nation))) return false;
    const onRoute =
      (s.sieges ?? []).some((siege) => siege.army === a.id && route.path.includes(siege.hex)) ||
      route.path.includes(a.hex) ||
      (route.maritime &&
        !!s.districts.find((d) => d.id === a.hex)?.port &&
        neighbors(s.districts, a.hex).some(
          (d) => d.biome === "sea" && route.path.includes(d.id),
        ));
    return (
      onRoute &&
      (a.blockading ||
        a.rebel ||
        s.wars.includes([faction.nation, owner.nation].sort().join("|")))
    );
  });
}
export function justifiedWarReasons(
  s: Campaign,
  h: House,
  nation: string,
  hex?: string,
): Exclude<WarReason, "unjustified">[] {
  const reasons: Exclude<WarReason, "unjustified">[] = [];
  const realm = s.houses.filter((v) => v.id === h.id || v.liege === h.id);
  const ids = realm.map((v) => v.id);
  if (
    s.routes.some(
      (r) =>
        ids.includes(r.house) &&
        routeBlockers(s, r).some(
          (a) =>
            s.houses.find((v) => v.id === (a.pledgedTo ?? a.house))?.nation ===
            nation,
        ),
    )
  )
    reasons.push("trade-blockade");
  if (
    s.districts.some(
      (d) =>
        ids.includes(d.owner ?? "") &&
        s.houses.find((v) => v.id === d.occupation)?.nation === nation,
    )
  )
    reasons.push("occupied-land");
  if (
    realm.some((v) =>
      v.family.some(
        (p) =>
          p.alive &&
          s.houses.find((captor) => captor.id === p.imprisonedBy)?.nation ===
            nation,
      ),
    )
  )
    reasons.push("captive-family");
  const spouses = h.family
    .filter((p) => p.alive && p.spouse)
    .map((p) => p.spouse);
  const allies = s.houses.filter(
    (v) =>
      v.nation !== h.nation &&
      v.nation !== nation &&
      v.family.some((p) => p.alive && spouses.includes(p.id)),
  );
  // An ally must have been attacked; helping an ally start an offensive war is not a justification.
  if (
    allies.some(
      (ally) =>
        s.wars.includes([ally.nation, nation].sort().join("|")) &&
        s.warDeclarations?.some(
          (w) => w.from === nation && w.to === ally.nation,
        ),
    )
  )
    reasons.push("defend-ally");
  if (insultGrievances(s, h, nation).length) reasons.push("insult");
  if (conquestTargets(s, h, nation).some((d) => !hex || d.id === hex))
    reasons.push("territorial-conquest");
  if (!hasMarriagePact(s, h, nation) && h.family.some((p) => p.alive && p.age >= 16 && !p.imprisonedBy && p.claims?.includes(nation))) reasons.push("dynastic-claim");
  return reasons;
}
export function recordWar(
  s: Campaign,
  h: House,
  nation: string,
  requested?: WarReason,
  hex?: string,
) {
  const valid = justifiedWarReasons(s, h, nation, hex);
  const reason = requested ?? valid[0] ?? "unjustified";
  if (reason !== "unjustified" && !valid.includes(reason))
    throw Error("This war reason has no current evidence");
  if (reason === "insult")
    for (const i of insultGrievances(s, h, nation)) i.resolved = true;
  (s.warDeclarations ??= []).push({
    from: h.nation,
    to: nation,
    reason,
    tick: s.tick,
  });
  if (reason === "unjustified") {
    h.unjustifiedWars = (h.unjustifiedWars ?? 0) + 1;
    const realm = s.houses.filter((v) => v.id === h.id || v.liege === h.id);
    for (const d of s.districts.filter((d) =>
      realm.some((v) => v.id === d.owner),
    ))
      d.unrest = Math.min(100, d.unrest + 5);
    for (const a of s.armies.filter((a) => a.house === h.id))
      a.loyalty = Math.max(0, (a.loyalty ?? 85) - 6);
    if (h.unjustifiedWars >= 2)
      for (const v of realm.filter((v) => v.liege === h.id)) {
        v.opinion = Math.max(0, v.opinion - 15);
        v.loyalty = Math.round(v.opinion * 0.55 + v.legitimacy * 0.45);
      }
    s.log.unshift(
      `${h.name} began an unjustified war (${h.unjustifiedWars} total): +5 realm unrest, −6 royal army loyalty${h.unjustifiedWars >= 2 ? ", −15 vassal opinion" : ""}.`,
    );
  }
  s.log.unshift(`${h.name} declares war on ${nation}: ${WAR_REASONS[reason]}.`);
  return reason;
}
export function armyLoyalty(s: Campaign, a: Army) {
  const h = s.houses.find((h) => h.id === a.house);
  return Math.max(
    0,
    Math.min(
      100,
      h?.liege ? Math.min(h.loyalty, a.loyalty ?? 85) : (a.loyalty ?? 85),
    ),
  );
}
export function armyRebellionRisk(s: Campaign, a: Army) {
  if (a.rebel || a.garrison || a.morale >= 40) return 0;
  return Math.max(0, (30 - armyLoyalty(s, a)) / 150);
}
