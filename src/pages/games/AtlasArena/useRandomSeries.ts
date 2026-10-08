import { useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ARENA_MODES, modeById } from "../../../games/atlas/modeCatalog";
import { chooseRandomModes, gameWinner, seriesComplete, seriesLength, type SeriesResult } from "../../../games/atlas/randomSeries";

type LocalSeries = { order: string[]; results: SeriesResult[]; reviewing: boolean };
const validOrder = (order: unknown, length: number): order is string[] => Array.isArray(order) && order.length === length && new Set(order).size === length && order.every(id => typeof id === "string" && modeById(id));
function restoreSeries(enabled: boolean, length: 1 | 3 | 5, requested: string[], firstMode: string | undefined, saved: unknown): LocalSeries {
  if (!enabled) return { order: [], results: [], reviewing: false };
  const candidate = saved as LocalSeries | undefined;
  if (candidate && validOrder(candidate.order, length) && (!validOrder(requested, length) || requested.join(",") === candidate.order.join(",")) &&
    typeof candidate.reviewing === "boolean" && Array.isArray(candidate.results) && candidate.results.length <= length &&
    candidate.results.every((result, index) => result && result.mode === candidate.order[index] && (result.winnerId === null || typeof result.winnerId === "string") && result.scores && typeof result.scores === "object" && !Array.isArray(result.scores) && Object.values(result.scores).every(Number.isFinite))) return candidate;
  return { order: validOrder(requested, length) ? requested : chooseRandomModes(ARENA_MODES.map(mode => mode.id), length, firstMode), results: [], reviewing: false };
}

/** The random marker belongs to a series; a direct mode link always starts a single game. */
export function useRandomSeries(firstMode?: string, solo = false) {
  const [params] = useSearchParams();
  const location = useLocation(), navigate = useNavigate();
  const enabled = params.get("random") === "1";
  const length = seriesLength(params.get("bestOf"));
  const [state, setState] = useState(() => restoreSeries(enabled, length, params.get("modes")?.split(",") ?? [], firstMode, location.state?.atlasRandomSeries));
  const latest = useRef(state);
  const isComplete = (value: LocalSeries) => solo ? value.results.length >= length : seriesComplete(length, value.results);
  const update = (next: LocalSeries) => { latest.current = next; setState(next); };
  const openGame = (next: LocalSeries) => {
    const query = new URLSearchParams(params);
    query.set("random", "1"); query.set("bestOf", String(length)); query.set("modes", next.order.join(","));
    const id = next.order[Math.min(next.results.length, next.order.length - 1)];
    navigate({ pathname: `/games/atlas-arena/${solo ? "solo" : "hotseat"}/${id}`, search: `?${query}` }, { replace: true, state: { atlasRandomSeries: next } });
  };
  return {
    enabled, length, ...state, complete: isComplete(state),
    mode: enabled ? modeById(state.order[Math.min(state.results.length, state.order.length - 1)]) : modeById(firstMode),
    finish: (scores: Record<string, number>) => {
      const current = latest.current;
      // A delayed callback from a finished game or a double click cannot score the next game.
      if (!enabled || current.reviewing || isComplete(current) || current.order !== state.order || current.results.length !== state.results.length) return;
      const next = { ...current, results: [...current.results, { mode: current.order[current.results.length], scores: { ...scores }, winnerId: solo ? null : gameWinner(scores) }], reviewing: true };
      update(next);
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: { atlasRandomSeries: next } });
    },
    next: () => {
      const current = latest.current;
      if (!enabled || !current.reviewing || isComplete(current)) return;
      const next = { ...current, reviewing: false };
      update(next); openGame(next);
    },
    reset: () => {
      if (!enabled) return;
      const next = { order: chooseRandomModes(ARENA_MODES.map(mode => mode.id), length), results: [], reviewing: false };
      update(next); openGame(next);
    },
  };
}
