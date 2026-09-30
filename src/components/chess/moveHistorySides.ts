export type MoveHistorySide = {
  key: string;
  label: string;
  /** Classes for the side's colour dot. */
  dotClass: string;
};

export const CLASSIC_HISTORY_SIDES: MoveHistorySide[] = [
  { key: "w", label: "White", dotClass: "border-white/60 bg-zinc-100" },
  { key: "b", label: "Black", dotClass: "border-zinc-500 bg-zinc-900" },
];

export const FOUR_PLAYER_HISTORY_SIDES: MoveHistorySide[] = [
  { key: "red", label: "Red", dotClass: "border-red-300 bg-red-400" },
  { key: "blue", label: "Blue", dotClass: "border-sky-300 bg-sky-400" },
  { key: "yellow", label: "Yellow", dotClass: "border-amber-200 bg-amber-300" },
  { key: "green", label: "Green", dotClass: "border-emerald-300 bg-emerald-400" },
];
