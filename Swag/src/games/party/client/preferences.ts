// Per-device player preferences (browser only). Stored in localStorage; there are no accounts, so no
// database table is involved.
export type MotionPreference = "system" | "reduce" | "full";
export interface PartyPreferences {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  uiVolume: number;
  muted: boolean;
  motion: MotionPreference;
  controlHints: boolean;
}
export const DEFAULT_PREFERENCES: PartyPreferences = {
  masterVolume: 0.8,
  musicVolume: 0.35,
  sfxVolume: 0.8,
  uiVolume: 0.5,
  muted: false,
  motion: "system",
  controlHints: true,
};
const KEY = "pluto-party-preferences";
const unit = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
function load(): PartyPreferences {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<PartyPreferences>;
    const d = DEFAULT_PREFERENCES;
    return {
      masterVolume: unit(raw.masterVolume, d.masterVolume),
      musicVolume: unit(raw.musicVolume, d.musicVolume),
      sfxVolume: unit(raw.sfxVolume, d.sfxVolume),
      uiVolume: unit(raw.uiVolume, d.uiVolume),
      muted: typeof raw.muted === "boolean" ? raw.muted : d.muted,
      motion: raw.motion === "reduce" || raw.motion === "full" ? raw.motion : d.motion,
      controlHints: typeof raw.controlHints === "boolean" ? raw.controlHints : d.controlHints,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}
let current: PartyPreferences | null = null;
const listeners = new Set<() => void>();
export function getPreferences(): PartyPreferences {
  return (current ??= typeof window === "undefined" ? { ...DEFAULT_PREFERENCES } : load());
}
export function setPreferences(patch: Partial<PartyPreferences>) {
  current = { ...getPreferences(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Storage may be unavailable (private mode); the change still applies for this visit.
  }
  listeners.forEach((listener) => listener());
}
export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
// The in-game override wins; "system" follows the OS setting. Read at use time (cheap).
export function prefersReducedMotion(): boolean {
  const { motion } = getPreferences();
  if (motion !== "system") return motion === "reduce";
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}
