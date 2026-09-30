export type Chess3DPieceSkin =
  | "classic"
  | "marble"
  | "obsidian"
  | "neon";

export type Chess3DCameraPreset =
  | "classic"
  | "top"
  | "low"
  | "white"
  | "black";

export type Chess3DCameraView = {
  id: number;
  preset: Chess3DCameraPreset;
};

export const CHESS_3D_SKINS: Array<{
  id: Chess3DPieceSkin;
  label: string;
  description: string;
}> = [
  {
    id: "classic",
    label: "Classic",
    description: "Original polished light and dark pieces.",
  },
  {
    id: "marble",
    label: "Marble",
    description: "Soft stone finish with elegant contrast.",
  },
  {
    id: "obsidian",
    label: "Obsidian",
    description: "Dark glossy tournament pieces with metallic highlights.",
  },
  {
    id: "neon",
    label: "Neon",
    description: "Sci-fi emissive blue and violet pieces.",
  },
];

export const CHESS_3D_CAMERA_PRESETS: Array<{
  id: Chess3DCameraPreset;
  label: string;
}> = [
  { id: "classic", label: "Classic" },
  { id: "top", label: "Top" },
  { id: "low", label: "Low" },
  { id: "white", label: "White" },
  { id: "black", label: "Black" },
];

export const CHESS_3D_CAMERA_POSITIONS: Record<
  Chess3DCameraPreset,
  [number, number, number]
> = {
  classic: [7.4, 7.6, 7.4],
  top: [0.2, 13.7, 0.2],
  low: [9.4, 4.0, 7.8],
  white: [8.7, 6.6, 0],
  black: [-8.7, 6.6, 0],
};
