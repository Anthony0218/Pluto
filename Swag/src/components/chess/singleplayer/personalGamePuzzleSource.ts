import { Chess, type Square } from "chess.js";

import { supabase } from "../../../lib/supabase.ts";
import type { InteractivePuzzle } from "./lichessPuzzleAdapter.ts";

export type GamePuzzleSourceMode = "singleplayer" | "multiplayer";
export type PersonalPuzzleQuality = "Inaccuracy" | "Mistake" | "Blunder";

type PersonalGamePuzzleRow = {
  id: string;
  user_id: string;
  name: string | null;
  source_mode: GamePuzzleSourceMode;
  game_key: string;
  player_color: "white" | "black";
  move_number: number;
  fen: string;
  solution_moves: string[];
  played_move_uci: string;
  played_move_san: string;
  best_move_san: string | null;
  centipawn_loss: number;
  quality: PersonalPuzzleQuality;
  created_at: string;
  completed_at: string | null;
  mistakes: number;
};

export type CompletedPersonalPuzzle = {
  puzzle: InteractivePuzzle;
  completedAt: string;
  mistakes: number;
};

function moveFromUci(game: Chess, uci: string) {
  return game.move({
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    promotion: uci.length > 4 ? (uci[4] as "q" | "r" | "b" | "n") : undefined,
  });
}

function difficultyFromQuality(
  quality: PersonalPuzzleQuality,
): InteractivePuzzle["difficulty"] {
  if (quality === "Inaccuracy") return "Intermediate";
  if (quality === "Mistake") return "Advanced";
  return "Really Hard";
}

function sourceLabel(source: GamePuzzleSourceMode) {
  return source === "singleplayer"
    ? "From your Singleplayer game"
    : "From your Multiplayer game";
}

function rowToInteractivePuzzle(
  row: PersonalGamePuzzleRow,
): InteractivePuzzle | null {
  const game = new Chess(row.fen);
  const line: InteractivePuzzle["line"] = [];

  for (const uci of row.solution_moves ?? []) {
    try {
      const move = moveFromUci(game, uci);
      line.push({
        uci,
        label: move.san,
      });
    } catch {
      return null;
    }
  }

  if (line.length === 0) {
    return null;
  }

  return {
    id: `personal-${row.id}`,
    sourceId: row.id,
    origin: row.source_mode,
    sourceLabel: sourceLabel(row.source_mode),
    title:
      row.name?.trim() ||
      `${row.source_mode === "singleplayer" ? "Singleplayer" : "Multiplayer"} · ${new Date(
        row.created_at,
      ).toLocaleString()}`,
    category: "Tactic",
    difficulty: difficultyFromQuality(row.quality),
    rating: 0,
    popularity: 0,
    themes: ["fromGame", row.source_mode, row.quality],
    objective: `${row.quality} · ${(row.centipawn_loss / 100).toFixed(1)} pawns`,
    goal: `Find the move you missed on move ${row.move_number}.`,
    fen: row.fen,
    orientation: row.player_color,
    line,
    candidates: [
      {
        uci: line[0].uci,
        label: line[0].label,
        rank: 1,
        explanation: "Best continuation found during your Game Review.",
      },
    ],
    quality: row.quality,
    centipawnLoss: row.centipawn_loss,
    moveNumber: row.move_number,
    playedMoveSan: row.played_move_san,
    createdAt: row.created_at,
  };
}

function fallbackHash(value: string) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }

  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0)
    .toString(16)
    .padStart(8, "0")}`;
}

async function createGameKey(
  sourceMode: GamePuzzleSourceMode,
  moves: string[],
) {
  const value = `${sourceMode}\u001f${moves.join("\u001f")}`;

  if (
    typeof crypto !== "undefined" &&
    crypto.subtle &&
    typeof TextEncoder !== "undefined"
  ) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return `${moves.length}-${fallbackHash(value)}`;
}

export async function savePersonalGamePuzzle(options: {
  name: string;
  sourceMode: GamePuzzleSourceMode;
  moves: string[];
  playerColor: "white" | "black";
  moveNumber: number;
  fen: string;
  solutionMoves: string[];
  playedMoveUci: string;
  playedMoveSan: string;
  bestMoveSan: string | null;
  centipawnLoss: number;
  quality: PersonalPuzzleQuality;
}): Promise<string | null> {
  const gameKey = await createGameKey(options.sourceMode, options.moves);

  const { data, error } = await supabase.rpc("save_user_chess_puzzle", {
    p_name: options.name.trim(),
    p_source_mode: options.sourceMode,
    p_game_key: gameKey,
    p_player_color: options.playerColor,
    p_move_number: options.moveNumber,
    p_fen: options.fen,
    p_solution_moves: options.solutionMoves,
    p_played_move_uci: options.playedMoveUci,
    p_played_move_san: options.playedMoveSan,
    p_best_move_san: options.bestMoveSan,
    p_centipawn_loss: Math.max(0, Math.round(options.centipawnLoss)),
    p_quality: options.quality,
  });

  if (error) {
    const details = [error.code, error.message, error.details, error.hint]
      .filter(Boolean)
      .join(" · ");

    throw new Error(
      details || "Supabase could not save the personal chess puzzle.",
    );
  }

  return typeof data === "string" ? data : null;
}

export async function getPersonalGamePuzzles(
  limit = 100,
): Promise<InteractivePuzzle[]> {
  const { data, error } = await supabase
    .from("user_chess_puzzles")
    .select("*")
    .is("completed_at", null)
    .order("created_at", {
      ascending: false,
    })
    .limit(limit);

  if (error) {
    throw error;
  }

  const result: InteractivePuzzle[] = [];

  for (const row of (data ?? []) as PersonalGamePuzzleRow[]) {
    const puzzle = rowToInteractivePuzzle(row);

    if (puzzle) {
      result.push(puzzle);
    }
  }

  return result;
}

export async function getCompletedPersonalGamePuzzles(
  limit = 100,
): Promise<CompletedPersonalPuzzle[]> {
  const { data, error } = await supabase
    .from("user_chess_puzzles")
    .select("*")
    .not("completed_at", "is", null)
    .order("completed_at", {
      ascending: false,
    })
    .limit(limit);

  if (error) {
    throw error;
  }

  const result: CompletedPersonalPuzzle[] = [];

  for (const row of (data ?? []) as PersonalGamePuzzleRow[]) {
    const puzzle = rowToInteractivePuzzle(row);

    if (!puzzle || !row.completed_at) {
      continue;
    }

    result.push({
      puzzle,
      completedAt: row.completed_at,
      mistakes: row.mistakes ?? 0,
    });
  }

  return result;
}

export async function renamePersonalGamePuzzle(
  puzzleId: string,
  name: string,
): Promise<void> {
  const normalizedName = name.trim();

  if (!normalizedName) {
    throw new Error("Puzzle title cannot be empty.");
  }

  const { error } = await supabase
    .from("user_chess_puzzles")
    .update({
      name: normalizedName.slice(0, 80),
    })
    .eq("id", puzzleId);

  if (error) {
    const details = [error.code, error.message, error.details, error.hint]
      .filter(Boolean)
      .join(" · ");

    throw new Error(
      details || "Supabase could not rename the personal chess puzzle.",
    );
  }
}

export async function recordPersonalGamePuzzleCompletion(
  puzzleId: string,
  mistakes: number,
): Promise<void> {
  const { error } = await supabase.rpc("record_user_chess_puzzle_completion", {
    p_puzzle_id: puzzleId,
    p_mistakes: Math.max(0, Math.round(mistakes)),
  });

  if (error) {
    throw error;
  }
}
