export const JANMANN = {
  id: "volumeSphere",
  slug: "janmanns-gambit",
  name: "Janmann's Gambit",
  author: "Yannick",
  source: "community",
  collections: ["community", "pluto"],
  configurable: false,
  boardType: "sphere",
  resourceType: "volume",
  resourceUnit: "m3",
  description: "Think differently... The thoughts of the Janmann Principle made playable: if every surface conceals a volume, every move must eventually answer for the space it occupies. Eight sectors, eighty Dividends, one unnecessarily rigorous Gambit.",
} as const;

export const SECTOR_COUNT = 8;
export const DIVIDENDS_PER_SECTOR = 10;
export const TOTAL_DIVIDENDS = SECTOR_COUNT * DIVIDENDS_PER_SECTOR;
export const DIVIDEND_CAPACITY_M3 = 3;
export const VOLUME_PER_SURFACE_UNIT_M3 = 1;
export const EXTRACTION_RATE_M3 = 1;
export const VOLUMETRIC_VICTORY_M3 = 50;
export const VOLUMETRIC_VICTORY_SECTORS = 5;
export const SNUB_CUBE_STRETCH = 5;
export const DEFAULT_OUTER_RADIUS_M = 5;
export const DEFAULT_INNER_RADIUS_M = 0;
export const SPHERE_ASSEMBLY_DURATION_MS = 1800;
export const PROMOTION_X = 5;

export type Side = "white" | "black";
export type PieceKind = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type Vec3 = [number, number, number];
export type DividendId = `${number}:${number}`;
export const opposite = (side: Side): Side => side === "white" ? "black" : "white";
