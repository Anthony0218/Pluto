import { Chess } from "chess.js";

/** A legal 60-move sample, kept separate from the player's saved games. */
export const ANALYSIS_DEMO_MOVES = "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7 c4 Nc5 Nc3 Nd5 cxd5 Kh8 Qd3 f5 dxc5 Bh4 Nb1 Rf6 a4 f4 Qxb5 Bxf2+ Kf1 Qe7 g4 a5 Qd3 Bd7 g5 Bf5 Bc4 Bc8 h4 Qe8 Qe3 Rg6 Ke2 Bg4 Qd2 Bxe1 Qc3 h5 Qd2 Bxh4 Ra2 Re6 Na3 Be1 Bb5 Qxb5+ Kxe1 Ra7 b3 c6 Qxa5 Qxa5+ Rd2 Kh7 Kd1 g6 Bb2 Ra8 Bd4 Rc8 Ba1 Rh8 Bxe5 Ree8 Bg7 Qd8 Rc2 Bh3 Bf8 Qe7 Kc1 Bg4 Nh2 Qxg5 Rg2 Be2 Nf3 Qd8 Nd4 Qd7 Kb2 h4 Kc2 Qb7 Nb1 Re6 Nxe2 Qa7 Nbc3 Qf7 Nc1 Qf6 N1a2 f3 Nb1 Qf7 Nb4 Rg8 Rg4 Re8 e5 Qf5+".split(" ");

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
