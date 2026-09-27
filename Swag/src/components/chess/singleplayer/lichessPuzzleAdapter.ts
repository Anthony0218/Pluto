import { Chess, type Square } from "chess.js";

export type ImportedLichessPuzzle = {
  id: string;
  sourceFen: string;
  moves: string[];
  rating: number;
  popularity: number;
  themes: string[];
  openingTags: string[];
  category: "Tactic" | "Checkmate" | "Strategy" | "Endgame";
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Really Hard";
};

type PuzzleRank = 1 | 2 | 3 | "worst";

type PuzzleCandidate = {
  uci: string;
  label: string;
  rank: PuzzleRank;
  explanation: string;
};

type PuzzleLineMove = {
  uci: string;
  label: string;
  note?: string;
};

export type InteractivePuzzle = {
  id: string;
  sourceId: string;
  origin: "lichess" | "singleplayer" | "multiplayer";
  sourceLabel: string;
  title: string;
  category: "Tactic" | "Checkmate" | "Strategy" | "Endgame";
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Really Hard";
  rating: number;
  popularity: number;
  themes: string[];
  objective: string;
  goal: string;
  fen: string;
  orientation: "white" | "black";
  line: PuzzleLineMove[];
  candidates: PuzzleCandidate[];
  quality?: "Inaccuracy" | "Mistake" | "Blunder";
  centipawnLoss?: number;
  moveNumber?: number;
  playedMoveSan?: string;
  createdAt?: string;
};

function moveFromUci(game: Chess, uci: string) {
  return game.move({
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
  });
}

function humanizeTheme(theme: string) {
  return theme
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (value) => value.toUpperCase());
}

function stableLichessPuzzleNumber(id: string) {
  let value = 0;

  for (const character of id) {
    value = (Math.imul(value, 131) + character.charCodeAt(0)) >>> 0;
  }

  return String((value % 999999) + 1).padStart(6, "0");
}

/**
 * Lichess stores the FEN BEFORE the opponent's setup move.
 * Apply moves[0], then the resulting board is the position shown
 * to the player. moves[1:] is the actual puzzle solution.
 */
export function lichessToInteractivePuzzle(
  source: ImportedLichessPuzzle,
): InteractivePuzzle | null {
  if (source.moves.length < 2) return null;

  const game = new Chess(source.sourceFen);

  try {
    moveFromUci(game, source.moves[0]);
  } catch {
    return null;
  }

  const puzzleFen = game.fen();
  const orientation = game.turn() === "w" ? "white" : "black";
  const solutionUcis = source.moves.slice(1);

  const replay = new Chess(puzzleFen);
  const line: PuzzleLineMove[] = [];

  for (const uci of solutionUcis) {
    try {
      const move = moveFromUci(replay, uci);
      line.push({
        uci,
        label: move.san,
      });
    } catch {
      return null;
    }
  }

  if (line.length === 0) return null;

  return {
    id: `lichess-${source.id}`,
    sourceId: source.id,
    origin: "lichess",
    sourceLabel: "Lichess",
    title: `Lichess Puzzle #${stableLichessPuzzleNumber(source.id)}`,
    category: source.category,
    difficulty: source.difficulty,
    rating: source.rating,
    popularity: source.popularity,
    themes: source.themes,
    objective: `Elo ${source.rating}`,
    goal: `Find the best continuation · ${source.themes
      .slice(0, 3)
      .map(humanizeTheme)
      .join(" · ")}`,
    fen: puzzleFen,
    orientation,
    line,
    candidates: [
      {
        uci: line[0].uci,
        label: line[0].label,
        rank: 1,
        explanation: "Best move from the Lichess puzzle solution.",
      },
    ],
  };
}
