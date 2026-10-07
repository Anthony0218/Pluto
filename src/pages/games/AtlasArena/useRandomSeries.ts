import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ARENA_MODES, modeById } from "../../../games/atlas/modeCatalog";
import { chooseRandomModes, gameWinner, seriesComplete, seriesLength, type SeriesResult } from "../../../games/atlas/randomSeries";

export function useRandomSeries(firstMode?: string, solo = false) {
  const [params] = useSearchParams();
  const enabled = params.get("random") === "1";
  const length = seriesLength(params.get("bestOf"));
  const [order, setOrder] = useState(() => {
    if (!enabled) return [];
    const requested = params.get("modes")?.split(",") ?? [];
    return requested.length === length && new Set(requested).size === length && requested.every(id => modeById(id)) && requested[0] === firstMode
      ? requested : chooseRandomModes(ARENA_MODES.map(mode => mode.id), length, firstMode);
  });
  const [results, setResults] = useState<SeriesResult[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const complete = solo ? results.length >= length : seriesComplete(length, results);
  return {
    enabled, length, order, results, reviewing, complete,
    mode: enabled ? modeById(order[Math.min(results.length, order.length - 1)]) : modeById(firstMode),
    finish: (scores: Record<string, number>) => {
      if (reviewing || complete) return;
      setResults(current => [...current, { mode: order[current.length], scores, winnerId: solo ? null : gameWinner(scores) }]);
      setReviewing(true);
    },
    next: () => setReviewing(false),
    reset: () => { setOrder(chooseRandomModes(ARENA_MODES.map(mode => mode.id), length)); setResults([]); setReviewing(false); },
  };
}
