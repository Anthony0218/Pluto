// Presentation events are separate from chess rules. A future board renderer can
// subscribe to these events without importing or changing a variant engine.
export type GameEffect =
  | { type: "MOVE" | "CAPTURE" | "CHECK" | "CHECKMATE" | "CASTLE"; from?: string; to?: string }
  | { type: "BOARD_ROTATE"; quadrant?: string }
  | { type: "TELEPORT" | "MUTATION" | "COLLAPSE" | "BOMB_EXPLODE" | "PIECE_SPAWN"; square?: string };
type Listener = (effect: GameEffect) => void;
const listeners = new Set<Listener>();
export function emitGameEffect(effect: GameEffect) { for (const listener of listeners) listener(effect); }
export function subscribeGameEffects(listener: Listener) { listeners.add(listener); return () => { listeners.delete(listener); }; }
