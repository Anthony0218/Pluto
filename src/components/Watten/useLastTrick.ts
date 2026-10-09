import { useCallback, useState } from "react";
import type { WattenTrickRecord } from "./WattenTricks";

/**
 * Remembers the latest finished trick of the current round. `finish` records
 * it when the table reports a trick as complete; `reset` forgets it for a new
 * round. The viewer closes itself when a newer trick replaces the old one.
 */
export function useLastTrick() {
  const [last, setLast] = useState<WattenTrickRecord | null>(null);
  const [open, setOpen] = useState(false);
  const finish = useCallback((trick: WattenTrickRecord) => { setLast(trick); setOpen(false); }, []);
  const reset = useCallback(() => { setLast(null); setOpen(false); }, []);
  return { last, open, setOpen, finish, reset };
}
