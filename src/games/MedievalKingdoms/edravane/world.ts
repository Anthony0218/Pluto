import type { Biome, District, Nation, Resource, Stock } from "./types.ts";
export const RESOURCES: Resource[] = [
  "grain",
  "timber",
  "iron",
  "livestock",
  "horses",
  "herbs",
  "luxury",
];
export const NATIONS: Nation[] = [
  [
    "auremarch",
    "Auremarch",
    "Human",
    "Kings inherit",
    "Valcrest",
    "#c5a550",
    "♜",
    8,
    6,
  ],
  [
    "high-cairn",
    "High Cairn",
    "Human",
    "Kings inherit",
    "Stoneward",
    "#b19a86",
    "▲",
    3,
    3,
  ],
  [
    "saltmere",
    "Saltmere",
    "Human",
    "Queens inherit",
    "Maren",
    "#65aeb9",
    "⚓",
    16,
    10,
  ],
  [
    "dunwald",
    "Dunwald",
    "Human",
    "Queens inherit",
    "Thornholt",
    "#6e9667",
    "♣",
    14,
    6,
  ],
  [
    "varnesk",
    "Varnesk",
    "Human",
    "Eldest eligible child, any gender",
    "Wintermere",
    "#9aabc7",
    "❄",
    9,
    1,
  ],
  [
    "sylvarenne",
    "Sylvarenne",
    "Elven",
    "Eligible heir confirmed by council",
    "Vaeltharyn",
    "#91bd99",
    "✧",
    14,
    2,
  ],
  [
    "ilyr-coast",
    "Ilyr Coast",
    "Elven",
    "Any gender",
    "Oriveth",
    "#d5958f",
    "☼",
    3,
    8,
  ],
  [
    "graskor",
    "Graskor",
    "Ork",
    "Any gender; clan assembly recognition",
    "Drazhkul",
    "#b8865f",
    "◆",
    9,
    10,
  ],
].map(([id, name, people, succession, house, color, crest, q, r]) => ({
  id,
  name,
  people,
  succession,
  house,
  color,
  crest,
  capital: `${q}:${r}`,
  anchor: [q, r],
})) as Nation[];
export const BALANCE = {
  grain: 1.2,
  iron: 1.2,
  shipCost: 0.85,
  timber: 1.2,
  winter: 0.8,
  herbs: 1.15,
  luxuryIncome: 1.15,
  livestock: 1.2,
};
export const BIOMES: Record<
  Biome,
  {
    color: string;
    icon: string;
    cost: number;
    attrition: number;
    description: string;
  }
> = {
  plains: {
    color: "#788e54",
    icon: "˒",
    cost: 1,
    attrition: 0,
    description: "Fertile farmland",
  },
  river: {
    color: "#658c84",
    icon: "≈",
    cost: 2,
    attrition: 0,
    description: "River crossing: slower movement",
  },
  forest: {
    color: "#426b50",
    icon: "♣",
    cost: 2,
    attrition: 0,
    description: "Woodland cover: slower movement, short visibility",
  },
  hills: {
    color: "#8b8560",
    icon: "⌁",
    cost: 2,
    attrition: 0,
    description: "Hills: defender advantage",
  },
  mountains: {
    color: "#8c8b85",
    icon: "▲",
    cost: 3,
    attrition: 0.01,
    description: "Mountain passes: slow movement, attrition",
  },
  coast: {
    color: "#9c9f72",
    icon: "≈",
    cost: 1,
    attrition: 0,
    description: "Coastline and harbour",
  },
  island: {
    color: "#96aa85",
    icon: "⚓",
    cost: 1,
    attrition: 0,
    description: "Island: maritime access only",
  },
  tundra: {
    color: "#a2b0aa",
    icon: "❄",
    cost: 2,
    attrition: 0.015,
    description: "Tundra: winter attrition",
  },
  steppe: {
    color: "#b2a374",
    icon: "〰",
    cost: 1,
    attrition: 0,
    description: "Dry grazing land",
  },
  glacier: {
    color: "#c8dce0",
    icon: "❄",
    cost: 4,
    attrition: 0.06,
    description: "Glacier hazard: 6% attrition per tick",
  },
  volcanic: {
    color: "#6b514f",
    icon: "♨",
    cost: 3,
    attrition: 0.05,
    description: "Volcanic hazard: 5% attrition per tick",
  },
  desert: {
    color: "#c7ab72",
    icon: "☼",
    cost: 3,
    attrition: 0.04,
    description: "Desert hazard: 4% attrition per tick",
  },
  marsh: {
    color: "#577b75",
    icon: "≋",
    cost: 3,
    attrition: 0.03,
    description: "Flooded marsh: 3% attrition per tick",
  },
  sea: {
    color: "#244955",
    icon: "",
    cost: 1,
    attrition: 0,
    description: "Navigable sea; armies cannot enter",
  },
  legacy: {
    color: "#695c53",
    icon: "🔒",
    cost: 99,
    attrition: 0,
    description: "Legacy Region — unavailable in this campaign.",
  },
};
export const stock = (n = 0): Stock =>
  Object.fromEntries(RESOURCES.map((r) => [r, n])) as Stock;
export const hexDistance = (
  a: Pick<District, "q" | "r">,
  b: Pick<District, "q" | "r">,
) => {
  const aq = a.q - Math.floor(a.r / 2),
    bq = b.q - Math.floor(b.r / 2),
    dr = a.r - b.r,
    dq = aq - bq;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};
export const center = (d: Pick<District, "q" | "r">): [number, number] => [
  54 + d.q * (Math.sqrt(3) * 25) + (d.r % 2 ? Math.sqrt(3) * 12.5 : 0),
  66 + d.r * 37.5,
];
export function neighbors(world: District[], id: string): District[] {
  const d = world.find((h) => h.id === id);
  return d ? world.filter((h) => hexDistance(d, h) === 1) : [];
}
export function findPath(
  world: District[],
  from: string,
  to: string,
  sea = false,
): string[] {
  const end = world.find((d) => d.id === to),
    start = world.find((d) => d.id === from);
  if (
    !end ||
    !start ||
    end.biome === "legacy" ||
    start.biome === "legacy" ||
    (!sea && end.biome === "sea")
  )
    return [];
  const queue = [from],
    prev = new Map<string, string>([[from, ""]]);
  while (queue.length) {
    const id = queue.shift()!;
    if (id === to) break;
    for (const n of neighbors(world, id)) {
      if (prev.has(n.id) || n.biome === "legacy") continue;
      if (sea ? n.biome !== "sea" && n.id !== to : n.biome === "sea") continue;
      prev.set(n.id, id);
      queue.push(n.id);
    }
  }
  if (!prev.has(to)) return [];
  const path = [];
  let id = to;
  while (id !== from) {
    path.unshift(id);
    id = prev.get(id)!;
  }
  return path;
}
export function makeWorld(): District[] {
  const world: District[] = [];
  // A broad mainland, a south-eastern gulf, and Saltmere's island chain follow the reference.
  // Select 174 mainland hexes by a geographic score, plus six explicit island hexes.
  const islands = new Set(["16:9", "16:10", "17:10", "16:11", "18:11", "18:8"]);
  const candidates: {
    id: string;
    score: number;
  }[] = [];
  for (let r = 0; r <= 12; r++)
    for (let q = 0; q <= 17; q++) {
      const gulf = q >= 14 && r >= 8,
        corner = q <= 1 && r <= 1;
      if (gulf || corner || islands.has(`${q}:${r}`)) continue;
      const score =
        ((q - 8.4) / 9.3) ** 2 +
        ((r - 6) / 7.1) ** 2 +
        (q < 3 && r > 9 ? 0.3 : 0);
      candidates.push({
        id: `${q}:${r}`,
        score: NATIONS.some((n) => n.capital === `${q}:${r}`) ? -1 : score,
      });
    }
  const land = new Set(
    candidates
      .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
      .slice(0, 174)
      .map((d) => d.id),
  );
  for (let r = -1; r <= 13; r++)
    for (let q = -1; q <= 18; q++) {
      let biome: Biome = islands.has(`${q}:${r}`)
        ? "island"
        : land.has(`${q}:${r}`)
          ? "plains"
          : "sea";
      const nation =
        biome === "sea"
          ? null
          : NATIONS.reduce((a, b) =>
              hexDistance({ q, r }, { q: a.anchor[0], r: a.anchor[1] }) <=
              hexDistance({ q, r }, { q: b.anchor[0], r: b.anchor[1] })
                ? a
                : b,
            );
      if (nation && biome !== "island") {
        const base: Record<string, Biome> = {
          auremarch: "plains",
          "high-cairn": "mountains",
          saltmere: "coast",
          dunwald: "forest",
          varnesk: "tundra",
          sylvarenne: "forest",
          "ilyr-coast": "coast",
          graskor: "steppe",
        };
        biome = base[nation.id];
        if ((q + r) % 5 === 0) biome = "hills";
        if (q === 8 && r > 3) biome = "river";
        if (q >= 9 && q <= 11 && r === 0) biome = "glacier";
        if (q >= 6 && q <= 12 && r === 12) biome = "volcanic";
        if (q === 16 && r === 7) biome = "desert";
        if (q === 15 && r === 7) biome = "marsh";
      }
      const resources: Partial<Record<Biome, Resource>> = {
        plains: "grain",
        river: "grain",
        forest: nation?.id === "sylvarenne" ? "herbs" : "timber",
        mountains: "iron",
        hills: "iron",
        steppe: "livestock",
        tundra: "horses",
        coast: "luxury",
        island: "luxury",
      };
      world.push({
        id: `${q}:${r}`,
        q,
        r,
        name: nation ? `${nation.name} ${q + 2}·${r + 2}` : "The Azure Sea",
        nation: nation?.id ?? null,
        owner: null,
        biome,
        resource: resources[biome] ?? "grain",
        settlement:
          nation?.capital === `${q}:${r}`
            ? `${nation.house} Keep`
            : (q + r) % 4 === 0
              ? "Market town"
              : "Hamlet",
        port: false,
        shipyard: false,
        road: (q + r) % 3 === 0,
        bonus:
          nation?.capital === `${q}:${r}`
            ? "gold"
            : (q + r) % 11 === 0 && nation
              ? "silver"
              : undefined,
        disputed: false,
        unrest: 0,
      });
    }
  for (const d of world) {
    d.port =
      !!d.nation && neighbors(world, d.id).some((n) => n.biome === "sea");
    d.shipyard = d.port && d.nation === "saltmere";
  }
  world.push({
    id: "legacy",
    q: 18,
    r: 13,
    name: "Legacy Region",
    nation: null,
    owner: null,
    biome: "legacy",
    resource: "grain",
    settlement: "The old kingdoms",
    port: false,
    shipyard: false,
    road: false,
    disputed: false,
    unrest: 0,
  });
  return world;
}
export function production(d: District): number {
  let mult = 1;
  if (
    d.nation === "auremarch" &&
    d.resource === "grain" &&
    ["plains", "river"].includes(d.biome)
  )
    mult = BALANCE.grain;
  if (
    d.nation === "high-cairn" &&
    d.biome === "mountains" &&
    d.resource === "iron"
  )
    mult = BALANCE.iron;
  if (d.nation === "dunwald" && d.biome === "forest" && d.resource === "timber")
    mult = BALANCE.timber;
  if (
    d.nation === "sylvarenne" &&
    d.biome === "forest" &&
    d.resource === "herbs"
  )
    mult = BALANCE.herbs;
  if (
    d.nation === "graskor" &&
    d.biome === "steppe" &&
    d.resource === "livestock"
  )
    mult = BALANCE.livestock;
  return 6 * mult * (1 - d.unrest / 150);
}
