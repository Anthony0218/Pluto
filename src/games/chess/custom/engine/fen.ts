import type { PlacedPiece, PositionSetup } from "./types.ts";

const FEN_TYPES: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/**
 * Read the piece placement, side to move and move number of a standard FEN
 * into a setup for the standard piece library. Boards wider than 8 are fine as
 * long as ranks use digits for gaps (multi-digit runs are supported).
 */
export function setupFromFen(fen: string): PositionSetup | null {
  const [placement, turn = "w", castling = "-", , , fullmove = "1"] = fen.trim().split(/\s+/);
  if (!placement) return null;
  const ranks = placement.split("/");
  const height = ranks.length;
  const pieces: PlacedPiece[] = [];
  for (let row = 0; row < height; row++) {
    let x = 0;
    for (const token of ranks[row].match(/\d+|[a-zA-Z]/g) ?? []) {
      if (/\d/.test(token)) {
        x += Number(token);
        continue;
      }
      const type = FEN_TYPES[token.toLowerCase()];
      if (!type) return null;
      const white = token === token.toUpperCase();
      const y = height - 1 - row;
      const piece: PlacedPiece = { type, team: white ? "white" : "black", x, y };
      if (type === "pawn" && y !== (white ? 1 : height - 2)) piece.moved = true;
      if (type === "king" && !/[KQ]/.test(white ? castling : castling.toUpperCase())) piece.moved = true;
      if (type === "rook") {
        const kingside = x === 7 ? (white ? "K" : "k") : x === 0 ? (white ? "Q" : "q") : null;
        if (!kingside || !castling.includes(kingside)) piece.moved = true;
      }
      pieces.push(piece);
      x += 1;
    }
  }
  return { pieces, startingTeam: turn === "b" ? "black" : "white", turnNumber: Number(fullmove) || 1 };
}
