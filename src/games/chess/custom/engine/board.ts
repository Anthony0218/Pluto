import type { BoardCell, BoardDefinition, Coord, TileType } from "./types.ts";

export const MIN_BOARD_SIZE = 3;
/** Beyond 16×16 the 3D scene and legal-move search stop feeling instant. */
export const MAX_BOARD_SIZE = 16;

const FILES = "abcdefghijklmnop";

export function squareName({ x, y }: Coord) {
  return `${FILES[x] ?? `x${x}`}${y + 1}`;
}

export function parseSquare(name: string): Coord | null {
  const match = /^([a-p])(\d{1,2})$/.exec(name.trim().toLowerCase());
  if (!match) return null;
  return { x: FILES.indexOf(match[1]), y: Number(match[2]) - 1 };
}

export const sameCoord = (a: Coord | undefined | null, b: Coord | undefined | null) =>
  Boolean(a && b && a.x === b.x && a.y === b.y);

export function clampBoardSize(value: number) {
  return Math.max(MIN_BOARD_SIZE, Math.min(MAX_BOARD_SIZE, Math.round(value) || MIN_BOARD_SIZE));
}

export function createRectangularBoard(width: number, height: number): BoardDefinition {
  const w = clampBoardSize(width);
  const h = clampBoardSize(height);
  const cells: BoardCell[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push({ x, y, enabled: true, tile: "normal" });
  return { width: w, height: h, cells };
}

export function inBounds(board: BoardDefinition, { x, y }: Coord) {
  return x >= 0 && y >= 0 && x < board.width && y < board.height;
}

export function getCell(board: BoardDefinition, coord: Coord): BoardCell | null {
  return inBounds(board, coord) ? board.cells[coord.y * board.width + coord.x] ?? null : null;
}

/** A cell a piece could ever stand on. */
export function isPlayable(board: BoardDefinition, coord: Coord) {
  const cell = getCell(board, coord);
  return Boolean(cell && cell.enabled && cell.tile !== "blocked");
}

/** Resize while keeping existing cells anchored bottom-left. */
export function resizeBoard(board: BoardDefinition, width: number, height: number): BoardDefinition {
  const next = createRectangularBoard(width, height);
  next.cells = next.cells.map((cell) => {
    const previous = getCell(board, cell);
    return previous ? { ...previous } : cell;
  });
  return next;
}

export function updateCell(board: BoardDefinition, coord: Coord, patch: Partial<BoardCell>): BoardDefinition {
  if (!inBounds(board, coord)) return board;
  const index = coord.y * board.width + coord.x;
  const cells = board.cells.slice();
  cells[index] = { ...cells[index], ...patch, x: coord.x, y: coord.y };
  return { ...board, cells };
}

export function setTile(board: BoardDefinition, coord: Coord, tile: TileType): BoardDefinition {
  const cell = getCell(board, coord);
  if (!cell) return board;
  const patch: Partial<BoardCell> = { tile, enabled: true };
  if (tile !== "portal") patch.portalTarget = undefined;
  if (tile === "oneWay" && !cell.direction) patch.direction = { x: 0, y: 1 };
  return updateCell(board, coord, patch);
}

/* ---------------------------------------------------------------- Shapes */

export const BOARD_SHAPES = ["rectangle", "cross", "diamond", "ring", "islands", "bridge", "castle", "holes"] as const;
export type BoardShape = (typeof BOARD_SHAPES)[number];

export const BOARD_SHAPE_LABELS: Record<BoardShape, string> = {
  rectangle: "Rectangle",
  cross: "Cross",
  diamond: "Diamond",
  ring: "Ring",
  islands: "Islands",
  bridge: "Bridge",
  castle: "Castle",
  holes: "Holes",
};

/**
 * Enable/disable cells to form a shape. The home ranks (two rows at each end)
 * always stay enabled so a standard army still fits.
 */
export function applyBoardShape(board: BoardDefinition, shape: BoardShape): BoardDefinition {
  const { width: w, height: h } = board;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const home = (y: number) => y < 2 || y >= h - 2;
  const keep = (x: number, y: number): boolean => {
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);
    switch (shape) {
      case "rectangle":
        return true;
      case "cross":
        return home(y) || dx <= w / 4 || dy <= h / 6;
      case "diamond":
        return home(y) || dx / (w / 2) + dy / (h / 2) <= 1.05;
      case "ring":
        return home(y) || dx > w / 5 || dy > h / 5;
      case "islands": {
        if (home(y)) return true;
        const midBand = dy < h / 2 - 2;
        const gapCol = dx < 0.6 || Math.abs(dx - w / 4) < 0.6;
        return !(midBand && (gapCol || Math.abs(y - cy) < 0.6));
      }
      case "bridge":
        return home(y) || y < h / 2 - 1 || y > h / 2 || dx <= 1;
      case "castle":
        // Crenellated outer ranks and a moat with a gate in the centre.
        if ((y === 0 || y === h - 1) && w >= 8) return true;
        if (Math.abs(y - cy) < 0.6 && h % 2 === 1) return dx <= 1;
        if ((y === Math.floor(cy) || y === Math.ceil(cy)) && h % 2 === 0) return dx <= 1 || dx >= w / 2 - 1;
        return true;
      case "holes":
        return home(y) || !((x + 1) % 3 === 0 && (y + 1) % 3 === 0);
    }
  };
  return {
    ...board,
    cells: board.cells.map((cell) => {
      const enabled = keep(cell.x, cell.y);
      return enabled ? { ...cell, enabled: true } : { ...cell, enabled: false, tile: "normal", portalTarget: undefined };
    }),
  };
}

/* ---------------------------------------------------------- Connectivity */

/** Groups of playable cells connected by king steps. */
export function findBoardRegions(board: BoardDefinition): Coord[][] {
  const seen = new Set<number>();
  const regions: Coord[][] = [];
  for (const cell of board.cells) {
    const index = cell.y * board.width + cell.x;
    if (seen.has(index) || !isPlayable(board, cell)) continue;
    const region: Coord[] = [];
    const stack: Coord[] = [cell];
    seen.add(index);
    while (stack.length) {
      const current = stack.pop()!;
      region.push({ x: current.x, y: current.y });
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const next = { x: current.x + dx, y: current.y + dy };
          const nextIndex = next.y * board.width + next.x;
          if ((dx || dy) && isPlayable(board, next) && !seen.has(nextIndex)) {
            seen.add(nextIndex);
            stack.push(next);
          }
        }
      }
    }
    regions.push(region);
  }
  return regions;
}

export function isLightSquare({ x, y }: Coord) {
  return (x + y) % 2 === 1;
}
