/**
 * Visual themes for Chess Custom. Purely cosmetic — a theme never changes
 * gameplay, so it lives outside the rule engine and can be swapped freely.
 */
export interface BoardVisualTheme {
  id: string;
  name: string;
  light: string;
  dark: string;
  /** Raised frame around the playing surface. */
  frame: string;
  /** Plinth under the frame. */
  base: string;
  /** Inlay trim / UI accent. */
  trim: string;
  /** CSS background behind the 3D canvas and 2D boards. */
  backdrop: string;
  /** Surface finish for the 3D squares. */
  roughness: number;
  metalness: number;
  keyLight: string;
  rimLight: string;
  /** Suggested 3D piece skin. */
  pieceSkin: string;
}

export const BOARD_THEMES: BoardVisualTheme[] = [
  {
    id: "classic-wood",
    name: "Classic Wood",
    light: "#e6cfa6",
    dark: "#7b5234",
    frame: "#4a2d1c",
    base: "#2a1911",
    trim: "#c9a063",
    backdrop: "radial-gradient(ellipse at 50% 38%, #3a2a1f 0%, #16100c 55%, #070504 100%)",
    roughness: 0.5,
    metalness: 0.02,
    keyLight: "#fff1d6",
    rimLight: "#f59e0b",
    pieceSkin: "classic",
  },
  {
    id: "minimal-dark",
    name: "Minimal Dark",
    light: "#a3a9b3",
    dark: "#3c434d",
    frame: "#1d2127",
    base: "#111418",
    trim: "#6b7280",
    backdrop: "radial-gradient(ellipse at 50% 38%, #1f242b 0%, #0c0e11 60%, #050607 100%)",
    roughness: 0.42,
    metalness: 0.08,
    keyLight: "#e5edf7",
    rimLight: "#60a5fa",
    pieceSkin: "obsidian",
  },
  {
    id: "marble",
    name: "Marble",
    light: "#efece5",
    dark: "#7c858d",
    frame: "#50575e",
    base: "#23272b",
    trim: "#d6c7a1",
    backdrop: "radial-gradient(ellipse at 50% 36%, #2b2f33 0%, #121416 58%, #060708 100%)",
    roughness: 0.22,
    metalness: 0.04,
    keyLight: "#f8fafc",
    rimLight: "#fcd34d",
    pieceSkin: "marble",
  },
  {
    id: "cyber",
    name: "Cyber",
    light: "#1e3a5f",
    dark: "#0b1629",
    frame: "#0f172a",
    base: "#050a14",
    trim: "#22d3ee",
    backdrop: "radial-gradient(ellipse at 50% 38%, #0b2540 0%, #060c18 58%, #02040a 100%)",
    roughness: 0.3,
    metalness: 0.45,
    keyLight: "#c7e9ff",
    rimLight: "#22d3ee",
    pieceSkin: "neon",
  },
  {
    id: "sky-fortress",
    name: "Sky Fortress",
    light: "#dbe7f3",
    dark: "#6b88a8",
    frame: "#3f5873",
    base: "#1c2a3a",
    trim: "#fde68a",
    backdrop: "radial-gradient(ellipse at 50% 30%, #35506e 0%, #142233 55%, #070d15 100%)",
    roughness: 0.36,
    metalness: 0.06,
    keyLight: "#fffbeb",
    rimLight: "#93c5fd",
    pieceSkin: "classic",
  },
  {
    id: "royal-gold",
    name: "Royal Gold",
    light: "#f3e2b3",
    dark: "#8a6424",
    frame: "#3b2a10",
    base: "#1b1307",
    trim: "#f5c451",
    backdrop: "radial-gradient(ellipse at 50% 38%, #3d2d12 0%, #150f06 58%, #070502 100%)",
    roughness: 0.28,
    metalness: 0.35,
    keyLight: "#fff3d1",
    rimLight: "#fbbf24",
    pieceSkin: "gilded",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    light: "#4b4f58",
    dark: "#121317",
    frame: "#0a0a0c",
    base: "#050506",
    trim: "#c084fc",
    backdrop: "radial-gradient(ellipse at 50% 38%, #1c1a24 0%, #09080c 60%, #030304 100%)",
    roughness: 0.14,
    metalness: 0.55,
    keyLight: "#ede9fe",
    rimLight: "#a78bfa",
    pieceSkin: "obsidian",
  },
  {
    id: "fantasy-castle",
    name: "Fantasy Castle",
    light: "#c9c1ad",
    dark: "#5d6b4f",
    frame: "#3d3a31",
    base: "#1f1d18",
    trim: "#e3b75a",
    backdrop: "radial-gradient(ellipse at 50% 34%, #2f3527 0%, #12140f 58%, #060705 100%)",
    roughness: 0.62,
    metalness: 0.02,
    keyLight: "#fff5dc",
    rimLight: "#86efac",
    pieceSkin: "marble",
  },
];

export function getBoardTheme(id: string | undefined): BoardVisualTheme {
  return BOARD_THEMES.find((theme) => theme.id === id) ?? BOARD_THEMES[0];
}

/** Colour and short label for each special tile on 2D boards and in the tile palette. */
export const TILE_STYLES: Record<string, { label: string; color: string; glyph: string; description: string; gameplay: boolean }> = {
  normal: { label: "Normal", color: "transparent", glyph: "", description: "A regular square.", gameplay: true },
  blocked: { label: "Blocked", color: "#57534e", glyph: "■", description: "No piece may enter or pass through.", gameplay: true },
  portal: { label: "Portal", color: "#8b5cf6", glyph: "◎", description: "A piece that lands here is teleported to the linked tile (if it is free).", gameplay: true },
  promotion: { label: "Promotion", color: "#eab308", glyph: "♛", description: "Pieces with a promotion rule may promote here.", gameplay: true },
  goal: { label: "Goal", color: "#22c55e", glyph: "⚑", description: "Used by “Reach a goal tile” and “Hold X goal tiles” victories.", gameplay: true },
  spawn: { label: "Spawn", color: "#14b8a6", glyph: "✚", description: "Where “Spawn piece → spawn tile” events place new pieces.", gameplay: true },
  danger: { label: "Danger", color: "#ef4444", glyph: "☠", description: "A piece still standing here after its owner's next turn is lost.", gameplay: true },
  ice: { label: "Ice", color: "#7dd3fc", glyph: "❄", description: "Straight-line movers keep sliding while they are on ice.", gameplay: true },
  oneWay: { label: "One-way", color: "#f97316", glyph: "➜", description: "May only be entered while moving in its arrow direction.", gameplay: true },
  teleport: { label: "Teleport", color: "#d946ef", glyph: "✧", description: "Pieces with a Teleport rule may jump between teleport tiles.", gameplay: true },
};
