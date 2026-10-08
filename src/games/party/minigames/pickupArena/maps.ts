export type ArenaMapId = "arcade" | "city";
export type WeaponId = "knife" | "pistol" | "shotgun" | "rifle" | "desert-eagle";
export interface ArenaBox { x: number; y: number; z: number; w: number; h: number; d: number; color: string; kind: "wall" | "cabinet" | "building" | "cover" }
export interface ArenaStair { x: number; z: number; w: number; length: number; base: number; rise: number }
export interface ArenaPoint { x: number; y: number; z: number }
export interface ArenaMap {
  id: ArenaMapId; name: string; halfSize: number; floors: number;
  boxes: ArenaBox[]; stairs: ArenaStair[]; spawns: ArenaPoint[];
  pickups: (ArenaPoint & { weapon: WeaponId })[];
  supplies: (ArenaPoint & { kind: "health" | "ammo" })[];
}
export const WEAPONS = {
  knife: { name: "Comet Baton", damage: 55, range: 2.5, cooldown: 480, ammo: -1, color: "#c7e4ee" },
  pistol: { name: "Pocket Blaster", damage: 34, range: 36, cooldown: 360, ammo: 18, color: "#ffdb71" },
  shotgun: { name: "Scatter Blaster", damage: 70, range: 12, cooldown: 850, ammo: 8, color: "#ff9276" },
  rifle: { name: "Pulse Blaster", damage: 25, range: 48, cooldown: 150, ammo: 40, color: "#92f0c2" },
  "desert-eagle": { name: "Nova Blaster", damage: 50, range: 40, cooldown: 650, ammo: 7, color: "#b6c9ff" },
} satisfies Record<WeaponId, { name: string; damage: number; range: number; cooldown: number; ammo: number; color: string }>;
const walls = (size: number, height: number): ArenaBox[] => [
  { x: -size, y: height / 2, z: 0, w: 0.5, h: height, d: size * 2, color: "#273349", kind: "wall" },
  { x: size, y: height / 2, z: 0, w: 0.5, h: height, d: size * 2, color: "#273349", kind: "wall" },
  { x: 0, y: height / 2, z: -size, w: size * 2, h: height, d: 0.5, color: "#273349", kind: "wall" },
  { x: 0, y: height / 2, z: size, w: size * 2, h: height, d: 0.5, color: "#273349", kind: "wall" },
];
const arcade: ArenaMap = {
  id: "arcade", name: "Neon Play Arcade", halfSize: 16, floors: 3,
  stairs: [-13, 13].flatMap((x) => [
    { x, z: -6, w: 2.2, length: 8, base: 0, rise: 4 },
    { x, z: 6, w: 2.2, length: 8, base: 4, rise: 4 },
  ]),
  boxes: [...walls(16, 12), ...[0, 4, 8].flatMap((y) => [
    ...[-7, 0, 7].flatMap((x) => [-6, 6].map((z): ArenaBox => ({
      x, y: y + 1.1, z, w: 2.2, h: 2.2, d: 1.5, color: ["#824be8", "#18a7ab", "#d84d91"][y / 4], kind: "cabinet",
    }))),
    { x: -4, y: y + 0.7, z: 0, w: 3, h: 1.4, d: 2, color: "#303b58", kind: "cover" as const },
    { x: 5, y: y + 0.7, z: 0, w: 3, h: 1.4, d: 2, color: "#303b58", kind: "cover" as const },
  ])],
  spawns: [0, 4, 8].flatMap((y) => [{ x: -9, y, z: -12 }, { x: 9, y, z: 12 }, { x: -9, y, z: 12 }, { x: 9, y, z: -12 }]),
  supplies: [0, 4, 8].flatMap((y) => [
    { x: -8, y, z: 0, kind: "health" as const }, { x: 8, y, z: 3, kind: "health" as const },
    { x: -3, y, z: -11, kind: "ammo" as const }, { x: 3, y, z: 11, kind: "ammo" as const },
  ]),
  pickups: [0, 4, 8].flatMap((y) => [
    { x: -9, y, z: -10, weapon: "desert-eagle" as const }, { x: 9, y, z: 10, weapon: "pistol" as const },
    { x: -9, y, z: 10, weapon: "knife" as const }, { x: 9, y, z: -10, weapon: "rifle" as const },
    { x: 0, y, z: 0, weapon: "shotgun" as const },
  ]),
};
const city: ArenaMap = {
  id: "city", name: "Pluto City Blocks", halfSize: 22, floors: 1, stairs: [],
  boxes: [...walls(22, 5), ...[-12, 12].flatMap((x) => [-11, 11].map((z): ArenaBox => ({
    x, y: 5, z, w: 9, h: 10, d: 9, color: x < 0 ? "#526985" : "#8a6c72", kind: "building",
  }))), ...[-1, 1].flatMap((sign): ArenaBox[] => [
    { x: sign * 7, y: 0.8, z: 0, w: 3.5, h: 1.6, d: 1.7, color: "#58859e", kind: "cover" },
    { x: 0, y: 0.65, z: sign * 10, w: 2.5, h: 1.3, d: 2.5, color: "#9d7d53", kind: "cover" },
    { x: sign * 18, y: 0.8, z: sign * 2, w: 1.8, h: 1.6, d: 3, color: "#71906a", kind: "cover" },
  ])],
  spawns: [{ x: -19, y: 0, z: -19 }, { x: 19, y: 0, z: 19 }, { x: -19, y: 0, z: 19 }, { x: 19, y: 0, z: -19 }],
  supplies: [
    { x: -4, y: 0, z: -8, kind: "health" }, { x: 4, y: 0, z: 8, kind: "health" },
    { x: -19, y: 0, z: 10, kind: "health" }, { x: 19, y: 0, z: -10, kind: "health" },
    { x: 0, y: 0, z: -17, kind: "ammo" }, { x: 0, y: 0, z: 17, kind: "ammo" },
    { x: -5, y: 0, z: 2, kind: "ammo" }, { x: 5, y: 0, z: -2, kind: "ammo" },
  ],
  pickups: [
    { x: -19, y: 0, z: -16, weapon: "desert-eagle" }, { x: 19, y: 0, z: 16, weapon: "pistol" },
    { x: -19, y: 0, z: 16, weapon: "knife" }, { x: 19, y: 0, z: -16, weapon: "rifle" },
    { x: -5, y: 0, z: -18, weapon: "rifle" }, { x: 5, y: 0, z: 18, weapon: "knife" },
    { x: 0, y: 0, z: 3, weapon: "shotgun" }, { x: 0, y: 0, z: -3, weapon: "shotgun" },
  ],
};
// A smaller city brings encounters and objectives closer together.
city.halfSize *= .82;
for (const list of [city.boxes, city.spawns, city.pickups, city.supplies]) for (const point of list) { point.x *= .82; point.z *= .82; }
for (const box of city.boxes) { box.w *= .82; box.d *= .82; }
export const ARENA_MAPS: Record<ArenaMapId, ArenaMap> = { arcade, city };
// Upper arcade decks leave holes above the four stairways.
export function floorPieces(map: ArenaMap, floor: number): { x: number; z: number; w: number; d: number }[] {
  if (!floor || map.id === "city") return [{ x: 0, z: 0, w: map.halfSize * 2, d: map.halfSize * 2 }];
  return [
    { x: 0, z: 0, w: 23.8, d: 32 },
    ...[-1, 1].flatMap((sign) => [
      { x: sign * 15.05, z: 0, w: 1.9, d: 32 },
      { x: sign * 13, z: -13, w: 2.2, d: 6 },
      { x: sign * 13, z: 0, w: 2.2, d: 4 },
      { x: sign * 13, z: 13, w: 2.2, d: 6 },
    ]),
  ];
}
export function walkHeight(map: ArenaMap, point: ArenaPoint, x: number, z: number): number | null {
  for (const stair of map.stairs) if (Math.abs(x - stair.x) < stair.w / 2 && Math.abs(z - stair.z) <= stair.length / 2) {
    const y = stair.base + ((z - stair.z + stair.length / 2) / stair.length) * stair.rise;
    if (Math.abs(y - point.y) < 0.35) return y;
  }
  const floor = Math.round(point.y / 4);
  if (Math.abs(point.y - floor * 4) > 0.35) return null;
  if (floorPieces(map, floor).some((p) => Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2)) return floor * 4;
  return null;
}
export function collides(map: ArenaMap, x: number, y: number, z: number): boolean {
  return Math.abs(x) > map.halfSize - 0.65 || Math.abs(z) > map.halfSize - 0.65 || map.boxes.some((b) =>
    y + 1.7 > b.y - b.h / 2 && y < b.y + b.h / 2 && Math.abs(x - b.x) < b.w / 2 + 0.35 && Math.abs(z - b.z) < b.d / 2 + 0.35);
}
// Slab ray intersection is shared by hit validation and bot visibility.
export function rayBox(origin: ArenaPoint, direction: ArenaPoint, box: ArenaBox): number {
  let near = 0, far = Infinity;
  for (const [axis, extent] of [["x", box.w], ["y", box.h], ["z", box.d]] as const) {
    const low = box[axis] - extent / 2, high = box[axis] + extent / 2;
    if (Math.abs(direction[axis]) < 1e-8) { if (origin[axis] < low || origin[axis] > high) return Infinity; }
    else {
      const a = (low - origin[axis]) / direction[axis], b = (high - origin[axis]) / direction[axis];
      near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
      if (near > far) return Infinity;
    }
  }
  return near;
}
const obstructionCache = new WeakMap<ArenaMap, ArenaBox[]>();
export function obstructionDistance(map: ArenaMap, origin: ArenaPoint, direction: ArenaPoint): number {
  let obstacles = obstructionCache.get(map);
  if (!obstacles) {
  const decks: ArenaBox[] = Array.from({ length: map.floors - 1 }, (_, i) => i + 1).flatMap((floor) =>
    floorPieces(map, floor).map((p) => ({ ...p, y: floor * 4 - 0.12, h: 0.24, color: "", kind: "wall" as const })));
  const steps: ArenaBox[] = map.stairs.flatMap((s) => Array.from({ length: 16 }, (_, i) => ({
    x: s.x, y: s.base + (i + 0.5) * s.rise / 16 - 0.12, z: s.z - s.length / 2 + (i + 0.5) * s.length / 16,
    w: s.w, h: 0.24, d: s.length / 16, color: "", kind: "wall" as const,
  })));
    obstacles = [...map.boxes, ...decks, ...steps]; obstructionCache.set(map, obstacles);
  }
  let nearest = Infinity;
  for (const box of obstacles) nearest = Math.min(nearest, rayBox(origin, direction, box));
  return nearest;
}
