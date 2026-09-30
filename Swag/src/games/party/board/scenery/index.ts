import type { Container } from "pixi.js";
import type { BoardMap } from "../../types.ts";
import { drawMountainScenery } from "./mountain.ts";
import { drawTropicalScenery } from "./tropical.ts";

// Board backdrops are per theme; everything gameplay-related (nodes, pawns, overlays) is shared.
export const THEMES = {
  tropical: { background: 0x168c9c, nodeShadow: 0x38695f, nodeRing: 0xfff1d3 },
  mountain: { background: 0x7ea0bb, nodeShadow: 0x243342, nodeRing: 0xf6fbff },
} as const;
export function drawScenery(world: Container, map: BoardMap) {
  if (map.theme === "mountain") drawMountainScenery(world, map);
  else drawTropicalScenery(world, map);
}
