import { boardLayers } from "../engine/board.ts";
import type { BoardDefinition, GameVariant, PositionSetup, TeamDefinition } from "../engine/types.ts";

/**
 * A compact, render-ready picture of a variant for library and community
 * cards. Cells are one character each (row-major from the bottom rank):
 * "." missing, "o" normal, "#" blocked, "*" portal, "+" any other special tile.
 */
export interface VariantPreview {
  theme: string;
  layers: { z: number; width: number; height: number; cells: string }[];
  pieces: { x: number; y: number; z: number; color: string; royal?: boolean }[];
}

const TILE_CHAR: Record<string, string> = { normal: "o", blocked: "#", portal: "*" };

export function buildVariantPreview(source: {
  board: BoardDefinition;
  setup?: PositionSetup;
  teams?: TeamDefinition[];
  theme?: GameVariant["theme"];
  royalTypes?: string[];
}): VariantPreview {
  const colors = new Map((source.teams ?? []).map((team) => [team.id, team.color]));
  const royal = new Set(source.royalTypes ?? ["king"]);
  return {
    theme: source.theme?.boardTheme ?? "classic-wood",
    layers: boardLayers(source.board).map((layer) => {
      const grid = Array.from({ length: layer.width * layer.height }, () => ".");
      for (const cell of layer.cells) {
        if (cell.x < 0 || cell.y < 0 || cell.x >= layer.width || cell.y >= layer.height) continue;
        grid[cell.y * layer.width + cell.x] = cell.enabled ? TILE_CHAR[cell.tile] ?? "+" : ".";
      }
      return { z: layer.z, width: layer.width, height: layer.height, cells: grid.join("") };
    }),
    pieces: (source.setup?.pieces ?? []).map((piece) => ({
      x: piece.x,
      y: piece.y,
      z: piece.z ?? 0,
      color: colors.get(piece.team) ?? "#a1a1aa",
      ...(royal.has(piece.type) ? { royal: true } : {}),
    })),
  };
}
