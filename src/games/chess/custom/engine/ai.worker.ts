import { chooseAiMove, type AiKind } from "./ai.ts";
import type { GameState, GameVariant } from "./types.ts";

/** Runs AI move selection off the main thread so the board stays smooth while it thinks. */
interface Request {
  id: number;
  variant: GameVariant;
  state: GameState;
  kind: AiKind;
}

const scope = self as unknown as { onmessage: ((event: MessageEvent<Request>) => void) | null; postMessage: (message: unknown) => void };

scope.onmessage = (event) => {
  const { id, variant, state, kind } = event.data;
  try {
    scope.postMessage({ id, move: chooseAiMove(variant, state, kind) });
  } catch (error) {
    scope.postMessage({ id, move: null, error: error instanceof Error ? error.message : String(error) });
  }
};
