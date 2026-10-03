import { Chess } from "chess.js";

/** A legal 49-move sample that ends in checkmate, kept separate from the player's saved games. */
export const ANALYSIS_DEMO_MOVES = "e4 e6 Nc3 Nc6 d4 d5 e5 Nge7 Nf3 b6 h4 h6 a3 Na5 h5 Qd7 Bb5 Nac6 b4 a5 Na4 Qd8 Qd3 Bd7 Bd2 Nc8 Bxc6 Bxc6 b5 Bb7 Rh3 c6 Nc3 cxb5 Nxb5 Ba6 a4 Bb4 c3 Bf8 Kf1 Rb8 Kg1 Ne7 Ne1 Nc8 Nc2 Ra8 Rg3 Bxb5 Qxb5+ Qd7 Qd3 Ne7 Ne3 Qc6 Rb1 Rc8 Rb5 Ra8 Qb1 Ra6 Qb3 g5 hxg6 Nxg6 c4 Nf4 cxd5 Ne2+ Kh2 exd5 Nxd5 Nxd4 Qb1 Bc5 Qe4 Qc8 Be3 Nxb5 axb5 Ra8 e6 Qd8 exf7+ Kf8 Bxc5+ bxc5 Qe5 Qh4+ Kg1 Qxg3 Qe7+ Kg7 f8=Q+ Kg6 Qff7#".split(" ");

/** Validate the entire history before passing it to the review engine. */
export function analysisPositions(moves: readonly string[]) {
  const game = new Chess();
  const positions = [{ fen: game.fen(), lastMove: null as { from: string; to: string } | null }];
  for (const san of moves) {
    if (typeof san !== "string" || !san.trim()) return { positions, valid: false };
    try {
      const move = game.move(san);
      positions.push({ fen: game.fen(), lastMove: { from: move.from, to: move.to } });
    } catch {
      return { positions, valid: false };
    }
  }
  return { positions, valid: moves.length > 0 };
}
