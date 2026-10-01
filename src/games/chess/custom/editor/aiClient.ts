import { chooseAiMove, type AiKind } from "../engine/ai.ts";
import type { GameState, GameVariant, Move } from "../engine/types.ts";

/**
 * Asks the AI worker for a move. Cancelling a request whose search is still
 * running terminates the worker (a fresh one is created on demand), so a
 * rewind or new game never waits for a stale multi-second search.
 * Falls back to the main thread where workers are unavailable.
 */
let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (move: Move | null) => void>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === "undefined") return null;
  try {
    worker = new Worker(new URL("../engine/ai.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; move: Move | null }>) => {
      pending.get(event.data.id)?.(event.data.move);
      pending.delete(event.data.id);
    };
    worker.onerror = () => {
      for (const resolve of pending.values()) resolve(null);
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch {
    return null;
  }
}

export function requestAiMove(variant: GameVariant, state: GameState, kind: AiKind): { promise: Promise<Move | null>; cancel: () => void } {
  const target = getWorker();
  if (!target) {
    let cancelled = false;
    const promise = new Promise<Move | null>((resolve) => window.setTimeout(() => resolve(cancelled ? null : chooseAiMove(variant, state, kind)), 0));
    return { promise, cancel: () => (cancelled = true) };
  }
  const id = nextId++;
  const promise = new Promise<Move | null>((resolve) => pending.set(id, resolve));
  target.postMessage({ id, variant, state, kind });
  return {
    promise,
    cancel: () => {
      if (!pending.has(id)) return;
      pending.get(id)?.(null);
      pending.delete(id);
      worker?.terminate();
      worker = null;
      for (const resolve of pending.values()) resolve(null);
      pending.clear();
    },
  };
}
