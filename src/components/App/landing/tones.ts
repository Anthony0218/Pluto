export type Tone = { light: string; base: string; dark: string; glow: string; ring: string };

// Planet palettes, kept in step with the tone classes in planetary/planetScene.css.
export const TONES = {
  chess: { light: "#d9d1ff", base: "#7658e9", dark: "#202682", glow: "#9576ff", ring: "#b9aaff" },
  go: { light: "#ffffff", base: "#b8b9cf", dark: "#5b5a7b", glow: "#bdc8ff", ring: "#e4e7ff" },
  watten: { light: "#ffe3e8", base: "#f04f8d", dark: "#8c1851", glow: "#ff69b1", ring: "#ffb3d0" },
  schafkopf: { light: "#9effcb", base: "#1cba8e", dark: "#085859", glow: "#3fe9bb", ring: "#84ffe2" },
  atlas: { light: "#9ce9ff", base: "#1389d7", dark: "#064079", glow: "#32b2ff", ring: "#8fe8ff" },
  natura: { light: "#dcff99", base: "#6fba3b", dark: "#275b2d", glow: "#9de663", ring: "#b5ef78" },
  eatit: { light: "#ffd297", base: "#f25740", dark: "#9a242c", glow: "#ff744d", ring: "#ffb866" },
  tools: { light: "#c9f4ff", base: "#2a9db8", dark: "#0d4b66", glow: "#5dd6f0", ring: "#9ae8ff" },
  learn: { light: "#ffe798", base: "#e79924", dark: "#7e3b17", glow: "#ffc354", ring: "#ffd576" },
  party: { light: "#e6c6ff", base: "#a336e5", dark: "#4b177f", glow: "#d84dff", ring: "#ef92ff" },
} as const satisfies Record<string, Tone>;

export type ToneName = keyof typeof TONES;

export const toneOf = (name: string | undefined): Tone => TONES[(name ?? "chess") as ToneName] ?? TONES.chess;
