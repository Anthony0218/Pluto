import { Chess, type Square } from "chess.js";

/** A move queued during the opponent's turn; it is played the moment the turn comes back, if still legal. */
export type Premove = { from: Square; to: Square };

const files = "abcdefgh";

/**
 * Squares the piece on `square` may be premoved to while `color` waits for the
 * opponent: its moves as if it were `color`'s turn now, plus pawn captures onto
 * squares the opponent may still move a piece to.
 */
export function premoveTargets(fen: string, square: Square, color: "w" | "b"): Square[] {
  const fields = fen.split(" ");
  fields[1] = color;
  fields[3] = "-";

  let probe: Chess;
  try {
    probe = new Chess(fields.join(" "), { skipValidation: true });
  } catch {
    return [];
  }

  const piece = probe.get(square);
  if (!piece || piece.color !== color) return [];

  const targets = new Set<Square>(probe.moves({ square, verbose: true }).map((move) => move.to));

  if (piece.type === "p") {
    const file = files.indexOf(square[0]);
    const rank = Number(square[1]) + (color === "w" ? 1 : -1);
    for (const step of [-1, 1]) {
      const target = `${files[file + step] ?? ""}${rank}` as Square;
      if (target.length !== 2 || rank < 1 || rank > 8) continue;
      if (probe.get(target)?.color !== color) targets.add(target);
    }
  }

  return [...targets];
}

/** The premove as a legal move in `fen` (promotions become queens), or null when it no longer fits. */
export function resolvePremove(fen: string, premove: Premove) {
  let game: Chess;
  try {
    game = new Chess(fen);
  } catch {
    return null;
  }

  const move = game.moves({ square: premove.from, verbose: true }).find((candidate) => candidate.to === premove.to);
  if (!move) return null;

  return { from: move.from, to: move.to, promotion: move.promotion ? ("q" as const) : undefined };
}
