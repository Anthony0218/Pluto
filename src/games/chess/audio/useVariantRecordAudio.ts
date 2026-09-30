import { useEffect, useRef } from "react";
import { playChessSound, type ChessSoundEvent } from "./chessAudio";

/** Plays events only for newly observed live records, never for loaded history. */
export function useVariantRecordAudio<T>(records: readonly T[] | null, eventsFor: (record: T) => ChessSoundEvent[]) {
  const previousCount = useRef<number | null>(null);
  useEffect(() => {
    if (!records) { previousCount.current = null; return; }
    const count = records.length;
    if (previousCount.current === null || count <= previousCount.current) { previousCount.current = count; return; }
    previousCount.current = count;
    const latest = records.at(-1);
    if (latest) for (const event of eventsFor(latest)) playChessSound(event);
  }, [records, eventsFor]);
}
