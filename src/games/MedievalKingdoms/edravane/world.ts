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
export const WORLD_GRID = { minQ: -8, maxQ: 28, minR: -4, maxR: 17 };
export const WORLD_HEX_COUNT = (WORLD_GRID.maxQ - WORLD_GRID.minQ + 1) * (WORLD_GRID.maxR - WORLD_GRID.minR + 1);
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
const worldIndexes = new WeakMap<District[], { length: number; ids: Map<string, District>; cells: Map<string, District[]>; order: Map<District, number> }>();
function worldIndex(world: District[]) {
  let index = worldIndexes.get(world);
  if (!index || index.length !== world.length) {
    index = { length: world.length, ids: new Map(), cells: new Map(), order: new Map() };
    world.forEach((d, i) => {
      index!.ids.set(d.id, d); index!.order.set(d, i);
      const key = `${d.q}:${d.r}`;
      index!.cells.set(key, [...(index!.cells.get(key) ?? []), d]);
    });
    worldIndexes.set(world, index);
  }
  return index;
}
/** Odd-row offset coordinates; geometry is fixed for the lifetime of a campaign map. */
export function adjacentCoordinates(q: number, r: number): [number, number][] {
  const diagonal = r % 2 ? 1 : -1;
  return [[q - 1, r], [q + 1, r], [q, r - 1], [q + diagonal, r - 1], [q, r + 1], [q + diagonal, r + 1]];
}
export function neighbors(world: District[], id: string): District[] {
  const index = worldIndex(world), d = index.ids.get(id);
  return d ? adjacentCoordinates(d.q, d.r).flatMap(([q, r]) => index.cells.get(`${q}:${r}`) ?? []).sort((a, b) => index.order.get(a)! - index.order.get(b)!) : [];
}
export function findPath(
  world: District[],
  from: string,
  to: string,
  sea = false,
): string[] {
  const index = worldIndex(world);
  const end = index.ids.get(to), start = index.ids.get(from);
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
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
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
  // Two deliberately shaped continents, separated by the navigable Crown Strait.
  // Retain the original capitals and Saltmere's island chain; saved maps are never regenerated.
  const islands = new Set(["16:9", "16:10", "17:10", "16:11", "18:11", "18:8"]);
  const western: [number, number][] = [[1, 7], [-1, 8], [-2, 9], [-3, 10], [-4, 10], [-5, 9], [-5, 9], [-6, 9], [-6, 9], [-5, 9], [-4, 10], [-5, 9], [-4, 10], [-3, 9], [-2, 9], [-1, 8], [0, 7], [2, 6]];
  const eastern: [number, number][] = [[17, 21], [15, 23], [13, 24], [13, 25], [13, 25], [14, 26], [13, 25], [13, 24], [14, 23]];
  const land = new Set<string>();
  const addRow = (range: [number, number], r: number) => { for (let q = range[0]; q <= range[1]; q++) land.add(`${q}:${r}`); };
  western.forEach((range, i) => addRow(range, i - 2));
  eastern.forEach((range, i) => addRow(range, i - 1));
  // Bays and peninsulas break up the eastern shore without joining the archipelago.
  addRow([13, 14], 8); addRow([21, 23], 8); addRow([21, 22], 9); addRow([22, 22], 10);
  for (const bay of ["-6:6", "-5:6", "-5:10", "-4:10", "-3:10", "25:2", "25:3", "26:3", "13:5", "17:7", "18:7"]) land.delete(bay);
  const isLand = (q: number, r: number) => land.has(`${q}:${r}`) || islands.has(`${q}:${r}`);
  for (let r = WORLD_GRID.minR; r <= WORLD_GRID.maxR; r++)
    for (let q = WORLD_GRID.minQ; q <= WORLD_GRID.maxQ; q++) {
      if (q === 28 && r === 17) continue; // Reserved for the legacy campaign entry.
      let biome: Biome = islands.has(`${q}:${r}`)
        ? "island"
        : land.has(`${q}:${r}`)
          ? "plains"
          : "sea";
      const nation =
        biome === "sea"
          ? null
          : NATIONS.filter((n) => n.id !== "saltmere" || islands.has(`${q}:${r}`) || r >= 6 && adjacentCoordinates(q, r).some(([nq, nr]) => !isLand(nq, nr))).reduce((a, b) =>
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
        if ((q >= 7 && q <= 10 && r <= 0) || q === 22 && r >= 2 && r <= 5) biome = r <= 0 ? "glacier" : "mountains";
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
    q: 28,
    r: 17,
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
