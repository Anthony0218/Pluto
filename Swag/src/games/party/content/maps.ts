import type { BoardMap, BoardNode, Region, TileType } from "../types.ts";
import { FIELD_DISTRIBUTION } from "../config.ts";
import { mountain } from "./mountain.ts";
import { Registry } from "./registry.ts";
const regions: Region[] = [
  { name: "SUNSPILL BAY", x: 210, y: 215, color: 0x6dbd85, motif: "palm" },
  { name: "COCONUT CLUB", x: 540, y: 185, color: 0x8bca87, motif: "palm" },
  { name: "EMBER PEAK", x: 885, y: 230, color: 0xa9a085, motif: "volcano" },
  { name: "WHISPER RUINS", x: 905, y: 565, color: 0x72b4a5, motif: "temple" },
  { name: "PIRATE PICNIC", x: 550, y: 610, color: 0x9ac077, motif: "boat" },
  { name: "JADE JUNGLE", x: 205, y: 560, color: 0x4eae88, motif: "palm" },
];
const types = FIELD_DISTRIBUTION.flatMap(([type, count]) =>
  Array<TileType>(count).fill(type),
);
// A coprime stride spreads the exact field distribution across all six islands.
const nodes: BoardNode[] = Array.from({ length: 60 }, (_, i) => {
  const region = Math.floor(i / 10),
    angle = ((i % 10) / 10) * Math.PI * 2;
  return {
    id: `space-${i}`,
    x: regions[region].x + Math.cos(angle) * 126,
    y: regions[region].y + Math.sin(angle) * 101,
    type: types[(i * 17 + 59) % 60],
    plutoEligible: !["warp", "boost"].includes(types[(i * 17 + 59) % 60]),
    connections: [],
    region,
  };
});
function connect(a: number, b: number) {
  nodes[a].connections.push(nodes[b].id);
  nodes[b].connections.push(nodes[a].id);
}
for (let r = 0; r < 6; r++)
  for (let n = 0; n < 10; n++) connect(r * 10 + n, r * 10 + ((n + 1) % 10));
// Perimeter and two central bridges give connected loops and genuine route choices.
for (const [a, b] of [
  [0, 15],
  [10, 25],
  [22, 38],
  [35, 40],
  [45, 50],
  [58, 2],
  [13, 47],
  [7, 53],
])
  connect(a, b);
// Tropical Islands. The registry id stays "sunspill" (Milestone 2 name) so saved settings and tests keep working.
export const tropical: BoardMap = {
  id: "sunspill",
  name: "Sunspill Islands",
  theme: "tropical",
  tagline: "Open routes",
  description:
    "Six sunny islands joined by bridges. Wide open, lots of alternate routes, two Golden Plutos to race for.",
  start: "space-0",
  size: { width: 1120, height: 800 },
  nodes,
  regions,
  goldenPlutoCount: 2,
  propertyName: "Outpost",
  eventHooks: ["tides", "hurricane", "bridge-collapse", "volcano"],
  eventPoolIds: ["island-breeze"],
  flavor: {
    welcome: "Welcome to Sunspill! Rolling for starting order…",
    roundStart: "The island adventure continues.",
    warp: "took the island ferry. Arrival does not retrigger a tile.",
    hazard: "stepped on the ember vent.",
    empty: "takes a breather.",
  },
};
export const mapRegistry = new Registry<BoardMap>();
mapRegistry.register(tropical);
mapRegistry.register(mountain);
export { mountain };
export const tilePresentation: Record<
  TileType,
  { label: string; icon: string; color: number; active: boolean }
> = {
  coin: { label: "+3 coins", icon: "+", color: 0xf6ca66, active: true },
  item: {
    label: "Item cache · win a random item (hold up to 3)",
    icon: "◆",
    color: 0x90b5ff,
    active: true,
  },
  rare: {
    label: "Rare item · win a Pocket Duel, Fallout Core or Wild Totem",
    icon: "★",
    color: 0xe69cff,
    active: true,
  },
  event: {
    label: "Island breeze · +2 coins to everyone",
    icon: "?",
    color: 0xd3a0eb,
    active: true,
  },
  deposit: {
    label: "Pay up to 3 coins to the bank",
    icon: "−",
    color: 0xf19583,
    active: true,
  },
  bank: {
    label: "Claim the central bank",
    icon: "B",
    color: 0xf8d889,
    active: true,
  },
  property: {
    label: "Outpost · claim for 5 coins, upgrade up to Level 4, earn tolls",
    icon: "⌂",
    color: 0xaeb8c7,
    active: true,
  },
  heal: { label: "Heal 10 HP", icon: "♥", color: 0x8fe1bf, active: true },
  duel: {
    label: "Duel · coming next",
    icon: "⚔",
    color: 0xc5a7eb,
    active: false,
  },
  warp: {
    label: "Ferry to the next island",
    icon: "↗",
    color: 0x82dbed,
    active: true,
  },
  hazard: {
    label: "Ember vent · lose 5 HP",
    icon: "!",
    color: 0xef8c76,
    active: true,
  },
  boost: {
    label: "Tailwind · +3 coins",
    icon: "»",
    color: 0xa0e5d0,
    active: true,
  },
  empty: {
    label: "Start / resting place",
    icon: "·",
    color: 0xf3f2cf,
    active: true,
  },
};

// Tile presentation for one map: the shared defaults plus that map's per-tile overrides.
export function tilePresentationFor(
  map: BoardMap,
): Record<TileType, { label: string; icon: string; color: number; active: boolean }> {
  const merged = { ...tilePresentation };
  for (const [type, text] of Object.entries(map.tiles ?? {}))
    merged[type as TileType] = { ...merged[type as TileType], ...text };
  return merged;
}
