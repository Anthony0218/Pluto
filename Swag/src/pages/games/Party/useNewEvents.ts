import { useEffect, useRef } from "react";
import type { FeedbackEvent, Match } from "../../../games/party/types.ts";

// Reports each authoritative feedback event once. Events already present at mount (for example after a
// reconnect) are treated as seen so they are not replayed.
export function useNewEvents(
  match: Match,
  onEvents: (events: FeedbackEvent[]) => void,
) {
  const seen = useRef(match.eventSeq);
  const handler = useRef(onEvents);
  useEffect(() => {
    handler.current = onEvents;
  });
  useEffect(() => {
    const fresh = match.events.filter((e) => e.id > seen.current);
    seen.current = Math.max(seen.current, match.eventSeq);
    if (fresh.length) handler.current(fresh);
  }, [match.eventSeq, match.events]);
}
