import { useEffect, useRef } from "react";
import { boardLanding } from "../../../games/party/board/fieldDesign.ts";
import type { BoardLanding } from "../../../games/party/board/fieldDesign.ts";
import type { BoardMap, Match } from "../../../games/party/types.ts";

export function useBoardLanding(match: Match | null, map: BoardMap, onLanding: (landing: BoardLanding) => void) {
  const previous = useRef<{ match: Match | null; at: number } | null>(null);
  const handler = useRef(onLanding);
  useEffect(() => { handler.current = onLanding; });
  useEffect(() => {
    const now = performance.now(), before = previous.current;
    previous.current = { match, at: now };
    // Mounts and snapshots after a long disconnection never replay old landings.
    if (!match || !before?.match || now - before.at > 3000 || before.match.mapId !== match.mapId) return;
    const landing = boardLanding(before.match, match, map, now);
    if (landing) handler.current(landing);
  }, [match, map]);
}
