import { expandBoard } from "./expandBoard.ts";
import type {
  BoardMap,
  BoardNode,
  MapSlide,
  MapTransport,
  Region,
  TileType,
} from "../types.ts";

// Mountain map: 60 playable spaces in eight regions, laid out bottom (Start) to top (Summit).
//
//                    SUMMIT ring (8)
//                   /               \
//         Cliff Path (5)         Frozen Cave (9, loop)
//              |                       |
//        West rope bridge         East rope bridge      <- Rope Bridge area (3 + 3)
//                   \               /
//                    FROZEN LAKE ring (8, two slides)
//                   /               \
//          Old Mine (7, loop)     Forest Trail (8, loop)
//                   \               /
//                   MOUNTAIN VILLAGE ring (9) — Start
//
// Every connection is reciprocal. Shortcuts: Cable Car (Forest ↔ Cliff), Mine Cart (Mine entrance ↔
// exit), Ice Cave Tunnel warps (Mine ↔ Frozen Cave). Node ids are `mountain-<index>`; the index is the
// position in this table, which is also the order of the region blocks below.

const regions: Region[] = [
  { name: "MOUNTAIN VILLAGE", x: 560, y: 905, color: 0x8fb26f, motif: "village" },
  { name: "OLD MINE", x: 240, y: 700, color: 0x8b7a6b, motif: "mine" },
  { name: "FOREST TRAIL", x: 890, y: 672, color: 0x4f8f5b, motif: "forest" },
  { name: "FROZEN LAKE", x: 545, y: 560, color: 0xa9d8ec, motif: "lake" },
  { name: "ROPE BRIDGES", x: 545, y: 425, color: 0x9a8264, motif: "bridge" },
  { name: "FROZEN CAVE", x: 850, y: 230, color: 0x8fc4e6, motif: "cave" },
  { name: "CLIFF PATH", x: 172, y: 215, color: 0x9a9088, motif: "cliff" },
  { name: "SUMMIT", x: 575, y: 140, color: 0xe9f1f7, motif: "summit" },
];
const [VILLAGE, MINE, FOREST, LAKE, BRIDGE, CAVE, CLIFF, SUMMIT] = [0, 1, 2, 3, 4, 5, 6, 7];

// [key, tile type, x, y, region]. Order defines the node id.
type Row = [string, TileType, number, number, number];
const rows: Row[] = [
  // Mountain Village (9) — the Start ring; the Start space is the map's single "Nothing" field.
  ["v0", "empty", 560, 990, VILLAGE],
  ["v1", "coin", 445, 968, VILLAGE],
  ["v2", "item", 355, 918, VILLAGE],
  ["v3", "coin", 378, 852, VILLAGE],
  ["v4", "event", 482, 818, VILLAGE],
  ["v5", "property", 622, 818, VILLAGE],
  ["v6", "coin", 742, 852, VILLAGE],
  ["v7", "boost", 765, 918, VILLAGE],
  ["v8", "deposit", 675, 968, VILLAGE],
  // Old Mine (7): a loop of two tunnels between the entrance (m0) and the exit (m6).
  ["m0", "item", 292, 818, MINE],
  ["m1", "heal", 210, 772, MINE],
  ["m2", "warp", 163, 700, MINE],
  ["m3", "event", 215, 622, MINE],
  ["m4", "coin", 338, 758, MINE],
  ["m5", "property", 350, 676, MINE],
  ["m6", "coin", 302, 600, MINE],
  // Forest Trail (8): scenic main path plus a short stream detour.
  ["f0", "coin", 818, 818, FOREST],
  ["f1", "item", 893, 778, FOREST],
  ["f2", "coin", 948, 718, FOREST],
  ["f3", "deposit", 935, 640, FOREST],
  ["f4", "heal", 872, 590, FOREST],
  ["f5", "coin", 790, 585, FOREST],
  ["f6", "property", 852, 715, FOREST],
  ["f7", "item", 818, 650, FOREST],
  // Frozen Lake (8): an open ring. Two spaces are Frozen Slides.
  ["l0", "item", 420, 560, LAKE],
  ["l1", "event", 457, 516, LAKE],
  ["l2", "coin", 545, 498, LAKE],
  ["l3", "item", 633, 516, LAKE],
  ["l4", "coin", 670, 560, LAKE],
  ["l5", "duel", 633, 604, LAKE],
  ["l6", "coin", 545, 622, LAKE],
  ["l7", "property", 457, 604, LAKE],
  // Rope Bridges (6): two single-file bridges, the map's main chokepoints.
  ["b0", "coin", 418, 468, BRIDGE],
  ["b1", "bank", 372, 425, BRIDGE],
  ["b2", "item", 338, 380, BRIDGE],
  ["b3", "coin", 672, 468, BRIDGE],
  ["b4", "event", 718, 425, BRIDGE],
  ["b5", "deposit", 752, 380, BRIDGE],
  // Frozen Cave (9): a long snake with a safe outer ice path and a risky inner tunnel, so the shorter
  // Cliff Path is the dangerous option and the cave the longer, safer one.
  ["c0", "item", 790, 338, CAVE],
  ["c1", "coin", 842, 300, CAVE],
  ["c2", "item", 897, 258, CAVE],
  ["c3", "heal", 893, 198, CAVE],
  ["c4", "property", 800, 262, CAVE],
  ["c5", "warp", 798, 205, CAVE],
  ["c6", "deposit", 850, 160, CAVE],
  ["c7", "item", 812, 112, CAVE],
  ["c8", "coin", 762, 78, CAVE],
  // Cliff Path (5): short, exposed and dangerous.
  ["k0", "deposit", 300, 338, CLIFF],
  ["k1", "event", 255, 298, CLIFF],
  ["k2", "rare", 232, 240, CLIFF],
  ["k3", "hazard", 262, 180, CLIFF],
  ["k4", "coin", 335, 150, CLIFF],
  // Summit (8): an upper ring around the peak.
  ["s0", "coin", 418, 142, SUMMIT],
  ["s1", "item", 464, 92, SUMMIT],
  ["s2", "duel", 575, 70, SUMMIT],
  ["s3", "event", 686, 92, SUMMIT],
  ["s4", "coin", 732, 142, SUMMIT],
  ["s5", "property", 686, 192, SUMMIT],
  ["s6", "deposit", 575, 214, SUMMIT],
  ["s7", "item", 464, 192, SUMMIT],
];

const idOf = new Map(rows.map(([key], i) => [key, `mountain-${i}`]));
const id = (key: string): string => {
  const value = idOf.get(key);
  if (!value) throw new Error(`Unknown mountain node key ${key}`);
  return value;
};

// Spaces that must never hold a Golden Pluto besides the generic exclusions (Start, Rare, Bank, property,
// warp, boost): transport stations and Frozen Slide origins, whose landing is followed by forced movement.
const special = new Set(["m0", "m6", "f2", "k4", "l2", "l6"]);
const nodes: BoardNode[] = rows.map(([key, type, x, y, region], i) => ({
  id: `mountain-${i}`,
  x,
  y,
  type,
  connections: [],
  region,
  plutoEligible: !(type === "warp" || type === "boost" || special.has(key)),
}));
const byId = new Map(nodes.map((n) => [n.id, n]));
function connect(a: string, b: string) {
  byId.get(id(a))!.connections.push(id(b));
  byId.get(id(b))!.connections.push(id(a));
}
const chain = (...keys: string[]) => keys.slice(1).forEach((k, i) => connect(keys[i], k));

chain("v0", "v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v0"); // village ring
chain("v3", "m0"); // west: village → Old Mine
chain("m0", "m1", "m2", "m3", "m6"); // upper (deep) tunnel
chain("m0", "m4", "m5", "m6"); // lower tunnel
chain("m6", "l0"); // Mine Exit → Frozen Lake
chain("v6", "f0"); // east: village → Forest Trail
chain("f0", "f1", "f2", "f3", "f4", "f5"); // scenic main path
chain("f1", "f6", "f7", "f5"); // stream detour
chain("f5", "l4"); // Forest exit → Frozen Lake
chain("l0", "l1", "l2", "l3", "l4", "l5", "l6", "l7", "l0"); // lake ring
chain("l1", "b0", "b1", "b2", "k0"); // west rope bridge → Cliff Path
chain("l3", "b3", "b4", "b5", "c0"); // east rope bridge → Frozen Cave
chain("k0", "k1", "k2", "k3", "k4", "s0"); // Cliff Path → Summit
chain("c0", "c1", "c2", "c3", "c6"); // cave outer ice path
chain("c1", "c4", "c5", "c6"); // cave inner tunnel
chain("c6", "c7", "c8", "s3"); // Frozen Cave → Summit
chain("s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s0"); // summit ring

const transports: MapTransport[] = [
  {
    id: "cable-car",
    kind: "cable-car",
    name: "Cable Car",
    icon: "🚡",
    endpoints: [id("f2"), id("k4")],
    endpointNames: ["Lower Cable Car Station", "Upper Cable Car Station"],
    cost: 0,
    prompt: "Take Cable Car?",
    rideLabel: "YES",
    stayLabel: "NO",
  },
  {
    id: "mine-cart",
    kind: "mine-cart",
    name: "Mine Cart",
    icon: "⛏️",
    endpoints: [id("m0"), id("m6")],
    endpointNames: ["Mine Entrance", "Mine Exit"],
    cost: 0,
    prompt: "MINE CART — Ride to the other end of the mine?",
    rideLabel: "RIDE",
    stayLabel: "STAY",
  },
];
// Both slides run along the lake ring; each is a fixed 2-space forced path ending on a normal space.
const slides: MapSlide[] = [
  { nodeId: id("l2"), path: [id("l1"), id("l0")] },
  { nodeId: id("l6"), path: [id("l5"), id("l4")] },
];

export const mountain: BoardMap = {
  id: "mountain",
  name: "Mountain",
  theme: "mountain",
  tagline: "Tighter routes and hazards",
  description:
    "Climb from the village to the summit through chokepoints, cliffs and caves. Avalanches close paths; cable cars and ice slides bend the map.",
  start: id("v0"),
  size: { width: 1120, height: 1040 },
  nodes: expandBoard(nodes, regions, "mountain", 4),
  spaceCount: 92,
  fieldDistribution: { coin: 34, item: 20, deposit: 14 },
  regions,
  eventHooks: ["avalanche", "mine-collapse", "cable-breakdown", "snowstorm", "mountain-goats"],
  eventPoolIds: ["avalanche", "mine-collapse", "cable-breakdown", "windfall"],
  goldenPlutoCount: 1,
  propertyName: "Mountain Camp",
  flavor: {
    welcome: "Welcome to the Mountain! Rolling for starting order…",
    roundStart: "The climb continues.",
    warp: "slipped through the Ice Cave Tunnel. Arrival does not retrigger a tile.",
    hazard: "was hit by falling rocks!",
    empty: "found a beautiful view. That's it.",
    emptyToast: "YOU FOUND A BEAUTIFUL VIEW. THAT'S IT.",
  },
  tiles: {
    coin: { label: "+3 coins" },
    item: { label: "Supply cache · win a random item (hold up to 3)" },
    event: { label: "Mountain event · avalanche, closures or a windfall" },
    deposit: { label: "Mountain toll · pay up to 3 coins to the bank" },
    property: {
      label: "Mountain Camp · claim for 5 coins, upgrade up to Level 4, earn tolls",
      icon: "⛺",
    },
    heal: { label: "Warm spring · heal 10 HP" },
    warp: { label: "Ice Cave Tunnel · slips you through the mountain to the far end", icon: "❄" },
    hazard: { label: "Falling rocks · lose 5 HP", icon: "▲" },
    boost: { label: "Hot cocoa stand · +3 coins", icon: "☕" },
    empty: { label: "Trailhead · YOU FOUND A BEAUTIFUL VIEW. That's it.", icon: "⌂" },
  },
  warps: { [id("m2")]: id("c5"), [id("c5")]: id("m2") },
  transports,
  slides,
  blockableEdges: [
    ["b0", "b1"],
    ["b1", "b2"],
    ["b2", "k0"],
    ["b3", "b4"],
    ["b4", "b5"],
    ["b5", "c0"],
    ["k1", "k2"],
    ["k2", "k3"],
    ["k3", "k4"],
    ["m6", "l0"],
    ["f5", "l4"],
  ].map(([a, b]) => [id(a), id(b)] as [string, string]),
};
