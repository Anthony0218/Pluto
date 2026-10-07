import type { Army, Campaign, District, UnitKind } from "./types.ts";
import { NATIONS, neighbors } from "./world.ts";

export const HARVEST_COOLDOWN = 6;
export function harvestYield(d: District) {
  return d.biome === "plains" || d.biome === "river" ? 32 : 18;
}
export function castleBonus(d: District) {
  return d.castle ? [0, 0.15, 0.3, 0.55][d.castle.level] : 0;
}
export function castleGuard(s: Campaign, d: District) {
  return Math.min(
    500,
    s.armies
      .filter((a) => a.garrison && a.hex === d.id && a.house === d.owner)
      .reduce(
        (n, a) => n + Object.values(a.troops).reduce((x, y) => x + y, 0),
        0,
      ),
  );
}
export function splitTroops(a: Army, count: number) {
  const troops = { levies: 0, spearmen: 0, archers: 0, heavy: 0, cavalry: 0 };
  const total = Object.values(a.troops).reduce((n, v) => n + v, 0);
  let remaining = count;
  const kinds = Object.keys(troops) as UnitKind[];
  for (const k of kinds) {
    const take = Math.min(
      a.troops[k],
      Math.floor((a.troops[k] / total) * count),
    );
    troops[k] = take;
    a.troops[k] -= take;
    remaining -= take;
  }
  for (const k of kinds) {
    const take = Math.min(a.troops[k], remaining);
    troops[k] += take;
    a.troops[k] -= take;
    remaining -= take;
  }
  return troops;
}
function composition(count: number) {
  return {
    levies: count * 0.4,
    spearmen: count * 0.3,
    archers: count * 0.2,
    heavy: count * 0.08,
    cavalry: count * 0.02,
  };
}
/** Capitals contain adjacent city and keep footprints within their hex. */
export function establishEstates(s: Campaign, fresh: boolean) {
  for (const d of s.districts)
    if (d.owner) {
      d.farm = !["volcanic", "glacier", "desert", "marsh"].includes(d.biome);
      if (d.settlement === "Market town") d.city = "town";
    }
  for (const h of s.houses) {
    const owned = s.districts.filter((d) => d.owner === h.id);
    const capital =
      owned.find(
        (d) => d.id === NATIONS.find((n) => n.id === h.nation)?.capital,
      ) ?? owned[0];
    if (!capital) continue;
    const seats = [capital];
    capital.seat = "capital";
    capital.city = "major";
    capital.castle = { level: 2 };
    capital.settlement = `${h.name} Seat`;
    capital.farm = true;
    if (h.role === "crown") {
      const secondary = owned.find((d) => d.id !== capital.id);
      if (secondary) {
        secondary.seat = "secondary";
        secondary.city = "town";
        secondary.castle = { level: 1 };
        secondary.settlement = `${h.name} March Keep`;
        seats.push(secondary);
      }
    }
    {
      for (const [index, d] of seats.entries()) {
        const base: Army = s.armies.find((a) => a.house === h.id) ?? {
          id: `army-${h.id}`,
          name: `${h.name} reserves`,
          house: h.id,
          origin: h.nation,
          hex: d.id,
          troops: composition(0),
          path: [],
          morale: 85,
          supply: 1,
          fatigue: 0,
          serviceUntil: 0,
          commander: h.ruler,
          rebel: false,
          delay: 0,
        };
        const g =
          fresh && index === 0
            ? base
            : {
                ...structuredClone(base),
                id: `seat-${h.id}-${index === 0 ? "capital" : "secondary"}`,
                hex: d.id,
              };
        g.garrison = true;
        g.name = `${h.name} ${index === 0 ? "capital" : "secondary"} garrison`;
        g.hex = d.id;
        g.troops = composition(
          fresh ? (h.role === "crown" && index === 0 ? 5000 : 2000) : 0,
        );
        g.path = [];
        delete g.voyage;
        delete g.pledgedTo;
        if (index || !fresh) s.armies.push(g);
      }
    }
  }
  // A few rural keeps protect nearby market towns, in addition to the seat castles.
  for (const city of s.districts.filter((d) => d.city && !d.seat)) {
    const fort = neighbors(s.districts, city.id).find(
      (d) => d.owner === city.owner && !d.castle && !d.city,
    );
    if (!fort) continue;
    fort.castle = { level: 1 };
    fort.settlement = "Marketwatch Castle";
    {
      const base = s.armies.find((a) => a.house === fort.owner)!;
      s.armies.push({
        ...structuredClone(base),
        id: `fort-${fort.id}`,
        name: `${fort.settlement} guard`,
        hex: fort.id,
        troops: composition(fresh ? 500 : 0),
        garrison: true,
        path: [],
      });
    }
  }
  s.estateRules = 1;
}
