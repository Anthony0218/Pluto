/** Traditional Japanese byo-yomi, implemented locally without third-party clock code. */
export const GO_RANKED_TIME_CONTROLS = {
  blitz: { id: "blitz", name: "Blitz", clock: "30s + 5 × 10s", initialMs: 30_000, byoYomiPeriods: 5, byoYomiMs: 10_000 },
  normal: { id: "normal", name: "Normal", clock: "5m + 5 × 30s", initialMs: 300_000, byoYomiPeriods: 5, byoYomiMs: 30_000 },
} as const;
export type GoTimeControl = keyof typeof GO_RANKED_TIME_CONTROLS;
export const GO_RANKED_DEFAULT_MODE: GoTimeControl = "normal";
export const goTimeControls = Object.values(GO_RANKED_TIME_CONTROLS);
export const GO_RANKED_DEFAULT_RATING = 1200;
export const GO_RANKED_BOARD_SIZE = 9;
export const GO_RANKED_KOMI = 6.5;
export function isGoTimeControl(value: unknown): value is GoTimeControl {
  return typeof value === "string" && Object.hasOwn(GO_RANKED_TIME_CONTROLS, value);
}
export function goTimeControlLabel(value: unknown, translate = (text: string) => text) {
  if (!isGoTimeControl(value)) return translate("Unknown time control");
  const mode = GO_RANKED_TIME_CONTROLS[value];
  return `${translate(mode.name)} ${mode.clock}`;
}
/** Exact position, never an Elo threshold. Shared by every Go ranked surface. */
export function isTop10(rank: number | null | undefined) {
  return Number.isInteger(rank) && rank! >= 1 && rank! <= 10;
}
