/* Pixel avatars are stored inline in profiles.avatar_id: "px2:" + 1,024 hex
   digits, one palette index per pixel of a 32×32 grid, row by row. Avatars
   drawn before the larger canvas are "px1:" + 256 digits (16×16); they still
   display everywhere and open in the editor at double size. */

export const PIXEL_SIZE = 32;
export const PIXEL_PREFIX = "px2:";
const LEGACY_SIZE = 16;

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
  typeof id === "string" && /^(px1:[0-9a-f]{256}|px2:[0-9a-f]{1024})$/.test(id);

export function encodePixelAvatar(grid: PixelGrid) {
  return PIXEL_PREFIX + grid.map((index) => (index & 15).toString(16)).join("");
}

/** The drawing at the size it was saved in: 256 cells (16×16) or 1,024 (32×32). */
export function decodePixelAvatar(id: string): PixelGrid | null {
  if (!isPixelAvatarId(id)) return null;
  return [...id.slice(PIXEL_PREFIX.length)].map((digit) => parseInt(digit, 16));
}

/** Side length of a square grid. */
export const pixelGridSize = (grid: PixelGrid) => Math.round(Math.sqrt(grid.length));

/** A 16×16 drawing on the 32×32 canvas, each pixel doubled; larger grids are returned as they are. */
export function editablePixelGrid(grid: PixelGrid): PixelGrid {
  if (grid.length !== LEGACY_SIZE * LEGACY_SIZE) return grid;
  return Array.from({ length: PIXEL_SIZE * PIXEL_SIZE }, (_, cell) =>
    grid[Math.floor(cell / PIXEL_SIZE / 2) * LEGACY_SIZE + Math.floor((cell % PIXEL_SIZE) / 2)]);
}

/** Each row as runs of one colour, so a drawing needs far fewer shapes than pixels. Background runs are left out. */
export function pixelRuns(grid: PixelGrid) {
  const size = pixelGridSize(grid);
  const runs: { x: number; y: number; width: number; color: number }[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size;) {
      const color = grid[y * size + x];
      let end = x + 1;
      while (end < size && grid[y * size + end] === color) end += 1;
      if (color !== 0) runs.push({ x, y, width: end - x, color });
      x = end;
    }
  }
  return runs;
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
  return editablePixelGrid(rows.join("").split("").map((digit) => parseInt(digit, 16)));
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
