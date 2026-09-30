import { useEffect, useRef, useState, type RefObject } from "react";

// Offset between the authority's clock and this browser's. Each snapshot carries `serverNow`; network
// delay only makes a snapshot look older, so the largest observed offset is the best estimate.
export function useServerOffset(
  serverNow: number | undefined,
): RefObject<number | null> {
  const offset = useRef<number | null>(null);
  useEffect(() => {
    if (serverNow === undefined) return;
    const observed = serverNow - Date.now();
    if (offset.current === null || observed > offset.current)
      offset.current = observed;
  }, [serverNow]);
  return offset;
}

// Estimated authoritative server time, re-rendering every `intervalMs`. Only the minigame screen uses
// this, so the ticking never re-renders the rest of the app. Canvas games read `useServerOffset`
// directly from their animation frame instead.
export function useServerClock(
  serverNow: number | undefined,
  intervalMs = 100,
): number {
  const offset = useServerOffset(serverNow);
  const [now, setNow] = useState(() => serverNow ?? 0);
  useEffect(() => {
    const tick = () => setNow(Date.now() + (offset.current ?? 0));
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, offset]);
  return now;
}
