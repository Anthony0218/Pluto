import { useCallback, useEffect, useRef } from "react";

/** Timeouts that are cleared on unmount, so leaving a mode mid-animation never fires into a dead component. */
export function useTrialTimers() {
  const timers = useRef<number[]>([]);
  useEffect(() => () => { timers.current.forEach((timer) => window.clearTimeout(timer)); timers.current = []; }, []);
  const schedule = useCallback((callback: () => void, delayMs: number) => {
    const timer = window.setTimeout(() => { timers.current = timers.current.filter((item) => item !== timer); callback(); }, delayMs);
    timers.current.push(timer);
  }, []);
  const clear = useCallback(() => { timers.current.forEach((timer) => window.clearTimeout(timer)); timers.current = []; }, []);
  return { schedule, clear };
}

/** Animation delays shrink to a blink when the player prefers reduced motion. */
export const motionDelay = (ms: number) => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? Math.min(ms, 120) : ms;

/** Number keys 1–9 pick the matching option while `enabled`; ignored while typing in a field. */
export function useOptionHotkeys(count: number, onPick: (index: number) => void, enabled: boolean) {
  const pick = useRef(onPick);
  useEffect(() => { pick.current = onPick; });
  useEffect(() => {
    if (!enabled) return;
    const handle = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || (event.target as HTMLElement | null)?.closest?.("input, textarea, select")) return;
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < count) { event.preventDefault(); pick.current(index); }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [count, enabled]);
}

/** Reports the final score once a run ends (the page keeps the personal best, so repeats are harmless). */
export function useRecordWhenOver(over: boolean, score: number, onRecord: (score: number) => void) {
  useEffect(() => { if (over) onRecord(score); }, [over, score, onRecord]);
}
