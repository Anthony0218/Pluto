/* Pixel avatars are stored inline in profiles.avatar_id: "px1:" + 256 hex
   digits, one palette index per pixel of a 16×16 grid, row by row. */

export const PIXEL_SIZE = 16;
export const PIXEL_PREFIX = "px1:";

export const PIXEL_PALETTE = [
  "#0f172a", // 0 background
  "#ffffff",
  "#111827",
  "#f1c7a5",
  "#c98e67",
  "#7c4a2d",
  "#3f2718",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#94a3b8",
] as const;

export type PixelGrid = number[];

export const isPixelAvatarId = (id: string | null | undefined): id is string =>
  typeof id === "string" && /^px1:[0-9a-f]{256}$/.test(id);

export function encodePixelAvatar(grid: PixelGrid) {
  return PIXEL_PREFIX + grid.map((index) => (index & 15).toString(16)).join("");
}

export function decodePixelAvatar(id: string): PixelGrid | null {
  if (!isPixelAvatarId(id)) return null;
  return [...id.slice(PIXEL_PREFIX.length)].map((digit) => parseInt(digit, 16));
}

export const blankPixelGrid = (): PixelGrid => Array(PIXEL_SIZE * PIXEL_SIZE).fill(0);

/** A friendly face to start from instead of an empty canvas. */
export function starterPixelGrid(): PixelGrid {
  const rows = [
    "0000000000000000",
    "0000066666600000",
    "0000666666660000",
    "0006666666666000",
    "0006333333336000",
    "0063333333333600",
    "0063223333223600",
    "0063223333223600",
    "0063333333333600",
    "0063333553333600",
    "0006337777336000",
    "0006333333336000",
    "0000633333360000",
    "000ccc3333ccc000",
    "00cccccccccccc00",
    "0cccccccccccccc0",
  ];
  return rows.join("").split("").map((digit) => parseInt(digit, 16));
}

/** Four-way flood fill from one pixel. */
export function floodFill(grid: PixelGrid, start: number, color: number): PixelGrid {
  const target = grid[start];
  if (target === color) return grid;
  const next = [...grid];
  const stack = [start];
  while (stack.length) {
    const index = stack.pop()!;
    if (next[index] !== target) continue;
    next[index] = color;
    const x = index % PIXEL_SIZE;
    const y = Math.floor(index / PIXEL_SIZE);
    if (x > 0) stack.push(index - 1);
    if (x < PIXEL_SIZE - 1) stack.push(index + 1);
    if (y > 0) stack.push(index - PIXEL_SIZE);
    if (y < PIXEL_SIZE - 1) stack.push(index + PIXEL_SIZE);
  }
  return next;
}
