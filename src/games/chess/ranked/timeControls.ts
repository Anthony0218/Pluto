/** Ranked time controls. Each has its own queue, clock and Elo (see the ranked_time_controls migration). */
export type TimeControl = "bullet" | "blitz" | "rapid" | "classical";

export const timeControls: { id: TimeControl; name: string; clock: string; initialMs: number }[] = [
  { id: "bullet", name: "Bullet", clock: "1+0", initialMs: 60_000 },
  { id: "blitz", name: "Blitz", clock: "3+0", initialMs: 180_000 },
  { id: "rapid", name: "Rapid", clock: "5+0", initialMs: 300_000 },
  { id: "classical", name: "Classical", clock: "10+0", initialMs: 600_000 },
];

export function isTimeControl(value: unknown): value is TimeControl {
  return timeControls.some((control) => control.id === value);
}

export function timeControlInfo(id: TimeControl | null | undefined) {
  return timeControls.find((control) => control.id === id) ?? timeControls[2];
}

/** "Blitz 3+0", with the name passed through `translate`. */
export function timeControlLabel(id: TimeControl | null | undefined, translate: (text: string) => string = (text) => text) {
  const control = timeControlInfo(id);
  return `${translate(control.name)} ${control.clock}`;
}
