import type { Square } from "chess.js";

export type Difficulty = "noob" | "casual" | "tryhard";

export type DifficultySettings = {
  skillLevel: number;
  thinkTime: number;
  randomMoveChance: number;
  label: "Noob" | "Casual" | "Tryhard";
  description: string;
};

export const difficultyLevels: Record<Difficulty, DifficultySettings> = {
  noob: {
    skillLevel: 0,
    thinkTime: 40,
    randomMoveChance: 0.75,
    label: "Noob",
    description:
      "Plays fast, makes terrible decisions, and occasionally gets lucky.",
  },

  casual: {
    skillLevel: 1,
    thinkTime: 80,
    randomMoveChance: 0.45,
    label: "Casual",
    description:
      "Mostly sensible play with plenty of mistakes. Good for relaxed games.",
  },

  tryhard: {
    skillLevel: 18,
    thinkTime: 800,
    randomMoveChance: 0,
    label: "Tryhard",
    description: "Very strong Stockfish play.",
  },
};

export type ChessPlayerColor = "white" | "black";

export type VariantAiGameProps = {
  aiMode?: boolean;
  playerColor?: ChessPlayerColor;
  difficulty?: Difficulty;
  onChangeSettings?: () => void;
};

export type VariantAiMove = {
  from: Square;
  to: Square;
  promotion?: "q" | "r" | "b" | "n";
};

export function chessColorFromPlayerColor(
  playerColor: ChessPlayerColor,
): "w" | "b" {
  return playerColor === "white" ? "w" : "b";
}

export function oppositeChessColor(color: "w" | "b"): "w" | "b" {
  return color === "w" ? "b" : "w";
}

export function moveToUci(move: {
  from: string;
  to: string;
  promotion?: string;
}) {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

export function difficultyRank(difficulty: Difficulty) {
  switch (difficulty) {
    case "noob":
      return 0;
    case "casual":
      return 1;
    case "tryhard":
      return 2;
  }
}
