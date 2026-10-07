import { Chess, type Square } from "chess.js";

import { qualityColor, type ReviewVisualQuality } from "./reviewQualityVisuals.ts";

export type BoardArrow = { from: Square; to: Square; color: string; opacity: number };

/**
 * "outline" borders a square; "origin" marks the square a piece left;
 * "glow" softly pulses the whole square.
 */
export type BoardSquareMark = {
  square: Square;
  kind: "outline" | "origin" | "glow";
  color: string;
  opacity: number;
};

/** Small icon in a square's top-left corner; "shield" marks a protected checking piece. */
export type BoardBadge = { square: Square; kind: "shield"; color: string };

export type BoardAnnotations = {
  icon?: { square: Square; quality: ReviewVisualQuality } | null;
  /** Red cross in a square's top-right corner, in place of a quality icon. */
  cross?: { square: Square; color: string } | null;
  marks?: BoardSquareMark[];
  arrows?: BoardArrow[];
  badges?: BoardBadge[];
};

const MOVE_COLOR = "#cbd5e1";
const CHECK_COLOR = "#ff4d67";
const SUPPORT_COLOR = "#4f9dff";
const WRONG_COLOR = "#ff4d67";

/** True when two squares touch, orthogonally or diagonally. */
function adjacent(a: Square, b: Square) {
  const files = Math.abs(a.charCodeAt(0) - b.charCodeAt(0));
  const ranks = Math.abs(Number(a[1]) - Number(b[1]));
  return Math.max(files, ranks) === 1;
}

/**
 * Checkmate markup: a red arrow from each checker to the king (skipped when they touch),
 * a shield on each protected checker and a blue arrow from every piece protecting it.
 */
function checkmateAnnotations(fenAfter: string): Pick<BoardAnnotations, "arrows" | "badges"> {
  const arrows: BoardArrow[] = [];
  const badges: BoardBadge[] = [];
  try {
    const game = new Chess(fenAfter);
    if (!game.isCheckmate()) return { arrows, badges };
    const attacker = game.turn() === "w" ? "b" : "w";
    const king = game.findPiece({ type: "k", color: game.turn() })[0];
    for (const checker of king ? game.attackers(king, attacker) : []) {
      if (!adjacent(checker, king)) arrows.push({ from: checker, to: king, color: CHECK_COLOR, opacity: 0.8 });
      const supporters = adjacent(checker, king) ? game.attackers(checker, attacker) : [];
      for (const supporter of supporters) arrows.push({ from: supporter, to: checker, color: SUPPORT_COLOR, opacity: 0.8 });
      if (supporters.length > 0) badges.push({ square: checker, kind: "shield", color: SUPPORT_COLOR });
    }
  } catch {
    // An unreadable position just skips the markup.
  }
  return { arrows, badges };
}

/** True when the piece that landed on `square` in `fenAfter` still stands there in `currentFen`. */
function pieceStillOn(square: Square, fenAfter: string, currentFen: string) {
  try {
    const moved = new Chess(fenAfter).get(square);
    const current = new Chess(currentFen).get(square);
    return Boolean(moved && current && moved.type === current.type && moved.color === current.color);
  } catch {
    return true;
  }
}

/**
 * Live Chess Coach: the grade icon, plus the mate markup on a checkmate; the engine's best move stays off the board.
 * With `currentFen`, the icon disappears once the graded piece left its square (e.g. it was captured),
 * so it is never mistaken for a grade of the capturing piece.
 */
export function liveCoachAnnotations(move: {
  to: Square;
  quality?: ReviewVisualQuality | null;
  fenAfter?: string;
  currentFen?: string;
}): BoardAnnotations {
  const iconVisible = !move.currentFen || !move.fenAfter || pieceStillOn(move.to, move.fenAfter, move.currentFen);
  return {
    icon: move.quality && iconVisible ? { square: move.to, quality: move.quality } : null,
    marks: [],
    ...(move.fenAfter ? checkmateAnnotations(move.fenAfter) : { arrows: [] }),
  };
}

/** Game Review: played move, checks and the pieces behind a mate. */
export function reviewMoveAnnotations(move: {
  from: Square;
  to: Square;
  quality: ReviewVisualQuality;
  fenAfter: string;
  bestMoveUci?: string | null;
}): BoardAnnotations {
  const result: Required<Omit<BoardAnnotations, "icon" | "cross">> = { marks: [], arrows: [], badges: [] };
  const link = (from: Square, to: Square, color: string, opacity: number) => result.arrows.push({ from, to, color, opacity });

  // A missed win crosses out the played move and points at the piece that would have won.
  const winMove = move.quality === "Missed Win" && move.bestMoveUci && move.bestMoveUci.slice(0, 4) !== `${move.from}${move.to}`
    ? { from: move.bestMoveUci.slice(0, 2) as Square, to: move.bestMoveUci.slice(2, 4) as Square }
    : null;

  result.marks.push(
    { square: move.from, kind: "origin", color: MOVE_COLOR, opacity: 0.55 },
    { square: move.to, kind: "outline", color: winMove ? WRONG_COLOR : qualityColor(move.quality), opacity: 0.95 },
  );
  if (winMove) {
    const violet = qualityColor("Missed Win");
    result.marks.push(
      { square: winMove.from, kind: "outline", color: violet, opacity: 0.95 },
      { square: winMove.to, kind: "glow", color: violet, opacity: 0.32 },
    );
  }
  link(move.from, move.to, MOVE_COLOR, 0.35);

  try {
    const game = new Chess(move.fenAfter);
    if (game.inCheck()) {
      const defender = game.turn();
      const attacker = defender === "w" ? "b" : "w";
      const king = game.findPiece({ type: "k", color: defender })[0];
      const checkers = king ? game.attackers(king, attacker) : [];

      // A checker touching the king needs no arrow; the check is obvious.
      for (const checker of checkers) {
        if (!adjacent(checker, king)) link(checker, king, CHECK_COLOR, 0.8);
      }

      if (game.isCheckmate()) {
        // The protecting piece gets the blue border, the protected checker the shield.
        const protectors = new Set<Square>();
        for (const checker of checkers) {
          const supporters = adjacent(checker, king) ? game.attackers(checker, attacker) : [];
          for (const supporter of supporters) {
            link(supporter, checker, SUPPORT_COLOR, 0.8);
            protectors.add(supporter);
          }
          if (supporters.length > 0) result.badges.push({ square: checker, kind: "shield", color: SUPPORT_COLOR });
        }
        for (const square of protectors) {
          result.marks.push({ square, kind: "outline", color: SUPPORT_COLOR, opacity: 0.95 });
        }
      }
    }
  } catch {
    // An unreadable position just skips the check arrows.
  }

  if (winMove) {
    return { icon: { square: winMove.from, quality: move.quality }, cross: { square: move.to, color: WRONG_COLOR }, ...result };
  }
  return { icon: { square: move.to, quality: move.quality }, ...result };
}
