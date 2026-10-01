/**
 * "Play from here" in the Game Review: a position from a best continuation,
 * stored as a game (SAN moves from the start) that a chess page loads.
 */
export type ReviewContinuation = {
  moves: string[];
  name: string;
};

const PENDING_KEY = "chess-review-continuation";

export const HOTSEAT_PATH = "/games/chess/classic/hotseat";

export function continuationGameName(moveNumber: number) {
  const timestamp = new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

  return `Review continuation · move ${moveNumber} · ${timestamp}`;
}

/** Saves the continuation for the Hotseat page, which loads it on its next mount. */
export function storePendingContinuation(continuation: ReviewContinuation) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(continuation));
  } catch {
    // Storage blocked: the Hotseat page simply opens a fresh game.
  }
}

/** Reads and clears the stored continuation. */
export function takePendingContinuation(): ReviewContinuation | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ReviewContinuation>;
    if (!Array.isArray(parsed.moves) || !parsed.moves.every((move) => typeof move === "string")) return null;

    return { moves: parsed.moves, name: typeof parsed.name === "string" ? parsed.name : "Review continuation" };
  } catch {
    return null;
  }
}
