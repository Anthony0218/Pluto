import { useCallback, useEffect, useRef, useState } from "react";
import { chooseBotAction } from "../engine/bot.ts";
import { createGame, performAction, type SeatInput } from "../engine/GameEngine.ts";
import type { ActionRequest, GameDefinition, GameState } from "../engine/types.ts";

export interface LobbySeat extends SeatInput {
  isBot: boolean;
}

export interface LocalMatchOptions {
  seats: LobbySeat[];
  settings: Record<string, unknown>;
  seed: number;
}

/** The first bot (in seat order) that has something to do. */
function findNextBot(def: GameDefinition, state: GameState) {
  if (state.status !== "playing") return null;
  for (const player of state.players) {
    if (!player.isBot) continue;
    const request = chooseBotAction(def, state, player.id);
    if (request) return { playerId: player.id, request };
  }
  return null;
}

export const randomSeed = () => {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0];
};

/**
 * A match running in the browser (test mode / hotseat). The engine is the
 * same one the server runs; the UI only sends requests and renders the state.
 */
export function useLocalMatch(def: GameDefinition | null, initial?: LocalMatchOptions) {
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<GameState | null>(() => {
    if (!def || !initial) return null;
    try {
      return createGame(def, { players: initial.seats, settings: initial.settings, seed: initial.seed });
    } catch {
      return null;
    }
  });
  const [autoBots, setAutoBots] = useState(true);
  const [botDelay, setBotDelay] = useState(450);
  const history = useRef<GameState[]>([]);
  const [historySize, setHistorySize] = useState(0);

  const start = useCallback(
    (options: LocalMatchOptions) => {
      if (!def) return;
      try {
        history.current = [];
        setHistorySize(0);
        setState(createGame(def, { players: options.seats, settings: options.settings, seed: options.seed }));
        setError(null);
      } catch (cause) {
        setState(null);
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [def],
  );

  const act = useCallback(
    (playerId: string, request: ActionRequest) => {
      if (!def || !state) return false;
      const result = performAction(def, state, playerId, request);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      history.current.push(state);
      if (history.current.length > 200) history.current.shift();
      setHistorySize(history.current.length);
      setState(result.state);
      setError(null);
      return true;
    },
    [def, state],
  );

  const nextBot = def && state ? findNextBot(def, state) : null;

  const botStep = () => {
    if (nextBot) act(nextBot.playerId, nextBot.request);
  };

  useEffect(() => {
    if (!autoBots || !def || !state) return;
    const next = findNextBot(def, state);
    if (!next) return;
    const timer = window.setTimeout(() => act(next.playerId, next.request), botDelay);
    return () => window.clearTimeout(timer);
  }, [autoBots, def, state, act, botDelay]);

  const undo = useCallback(() => {
    const previous = history.current.pop();
    setHistorySize(history.current.length);
    if (previous) setState(previous);
  }, []);

  return { state, error, setError, start, act, botStep, nextBot, autoBots, setAutoBots, botDelay, setBotDelay, undo, canUndo: historySize > 0, reset: () => setState(null) };
}
