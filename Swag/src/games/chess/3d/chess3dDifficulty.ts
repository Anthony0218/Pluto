export type Chess3DDifficulty =
  | "beginner"
  | "easy"
  | "medium"
  | "hard"
  | "expert";

export type Chess3DDifficultyConfig = {
  id: Chess3DDifficulty;
  label: string;
  description: string;
  stockfishSkill: number;
  moveTime: number;
  randomMoveChance: number;
};

export const CHESS_3D_DIFFICULTIES: Chess3DDifficultyConfig[] = [
  {
    id: "beginner",
    label: "Beginner",
    description: "Very forgiving. Often chooses a random legal move.",
    stockfishSkill: 0,
    moveTime: 80,
    randomMoveChance: 0.6,
  },
  {
    id: "easy",
    label: "Easy",
    description: "Relaxed play with frequent inaccuracies.",
    stockfishSkill: 0,
    moveTime: 80,
    randomMoveChance: 0.4,
  },
  {
    id: "medium",
    label: "Normal",
    description: "Balanced play with occasional mistakes.",
    stockfishSkill: 1,
    moveTime: 300,
    randomMoveChance: 0.15,
  },
  {
    id: "hard",
    label: "Hard",
    description: "Strong play with very few intentional mistakes.",
    stockfishSkill: 5,
    moveTime: 500,
    randomMoveChance: 0.02,
  },
  {
    id: "expert",
    label: "Expert",
    description: "Stockfish plays at full consistency for this mode.",
    stockfishSkill: 18,
    moveTime: 800,
    randomMoveChance: 0,
  },
];

export function getChess3DDifficultyConfig(difficulty: Chess3DDifficulty) {
  return (
    CHESS_3D_DIFFICULTIES.find((entry) => entry.id === difficulty) ??
    CHESS_3D_DIFFICULTIES[2]
  );
}

export function isChess3DDifficulty(
  value: string | null,
): value is Chess3DDifficulty {
  return CHESS_3D_DIFFICULTIES.some((entry) => entry.id === value);
}
