import { supabase } from "../../../lib/supabase.ts";
import {
  lichessToInteractivePuzzle,
  type ImportedLichessPuzzle,
  type InteractivePuzzle,
} from "./lichessPuzzleAdapter.ts";

export type PuzzleCategoryFilter =
  | "All"
  | "Tactic"
  | "Checkmate"
  | "Strategy"
  | "Endgame";

export type PuzzleDifficultyFilter =
  | "All"
  | "Beginner"
  | "Intermediate"
  | "Advanced"
  | "Really Hard";

export type PuzzleLibrarySort =
  | "random"
  | "popularity-desc"
  | "popularity-asc"
  | "elo-desc"
  | "elo-asc"
  | "difficulty-asc"
  | "difficulty-desc";

type ChessPuzzleRow = {
  id: string;
  source_fen: string;
  moves: string[];
  rating: number;
  rating_deviation: number | null;
  popularity: number;
  nb_plays: number | null;
  themes: string[];
  game_url: string | null;
  opening_tags: string[];
  daily_date: number | null;
  category: "Tactic" | "Checkmate" | "Strategy" | "Endgame";
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Really Hard";
  random_key: number;
};

type CompletedChessPuzzleRow = ChessPuzzleRow & {
  completed_at: string;
  mistakes: number;
};

export type CompletedPuzzle = {
  puzzle: InteractivePuzzle;
  completedAt: string;
  mistakes: number;
};

type LichessPuzzleTitleOverrideRow = {
  puzzle_id: string;
  title: string;
};

async function applyLichessTitleOverrides(
  puzzles: InteractivePuzzle[],
): Promise<InteractivePuzzle[]> {
  if (puzzles.length === 0) {
    return puzzles;
  }

  /*
   * Title changes are per-user. Signed-out visitors keep the stable
   * default "Lichess Puzzle #..." title.
   */
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return puzzles;
  }

  const puzzleIds = [...new Set(puzzles.map((puzzle) => puzzle.sourceId))];

  const { data, error } = await supabase
    .from("chess_puzzle_title_overrides")
    .select("puzzle_id, title")
    .in("puzzle_id", puzzleIds);

  /*
   * Keep the puzzle library usable even if the optional title migration
   * has not been installed yet.
   */
  if (error) {
    console.warn("Could not load Lichess puzzle title overrides:", error);
    return puzzles;
  }

  const overrides = new Map(
    ((data ?? []) as LichessPuzzleTitleOverrideRow[]).map((row) => [
      row.puzzle_id,
      row.title,
    ]),
  );

  return puzzles.map((puzzle) => {
    const title = overrides.get(puzzle.sourceId);

    return title
      ? {
          ...puzzle,
          title,
        }
      : puzzle;
  });
}

function rowToPuzzle(row: ChessPuzzleRow): InteractivePuzzle | null {
  const imported: ImportedLichessPuzzle = {
    id: row.id,
    sourceFen: row.source_fen,
    moves: row.moves ?? [],
    rating: row.rating,
    popularity: row.popularity,
    themes: row.themes ?? [],
    openingTags: row.opening_tags ?? [],
    category: row.category,
    difficulty: row.difficulty,
  };

  return lichessToInteractivePuzzle(imported);
}

async function getRandomLichessPuzzleBase(options?: {
  category?: PuzzleCategoryFilter;
  difficulty?: PuzzleDifficultyFilter;
  minRating?: number | null;
  maxRating?: number | null;
  excludeIds?: string[];
}): Promise<InteractivePuzzle | null> {
  const category =
    options?.category && options.category !== "All" ? options.category : null;

  const difficulty =
    options?.difficulty && options.difficulty !== "All"
      ? options.difficulty
      : null;

  const { data, error } = await supabase.rpc("get_random_chess_puzzle", {
    p_category: category,
    p_difficulty: difficulty,
    p_min_rating: options?.minRating ?? null,
    p_max_rating: options?.maxRating ?? null,
    p_exclude_ids: options?.excludeIds ?? [],
  });

  if (error) {
    throw error;
  }

  const row = ((data ?? []) as ChessPuzzleRow[])[0];

  return row ? rowToPuzzle(row) : null;
}

export async function getRandomLichessPuzzle(options?: {
  category?: PuzzleCategoryFilter;
  difficulty?: PuzzleDifficultyFilter;
  minRating?: number | null;
  maxRating?: number | null;
  excludeIds?: string[];
}): Promise<InteractivePuzzle | null> {
  const puzzle = await getRandomLichessPuzzleBase(options);

  if (!puzzle) {
    return null;
  }

  return (await applyLichessTitleOverrides([puzzle]))[0] ?? puzzle;
}

async function getSortedLichessPuzzles(options: {
  category?: PuzzleCategoryFilter;
  difficulty?: PuzzleDifficultyFilter;
  sort: Exclude<PuzzleLibrarySort, "random">;
  excludeIds?: string[];
  count: number;
}): Promise<InteractivePuzzle[]> {
  const category =
    options.category && options.category !== "All" ? options.category : null;

  const difficulty =
    options.difficulty && options.difficulty !== "All"
      ? options.difficulty
      : null;

  const { data, error } = await supabase.rpc("get_chess_puzzle_library", {
    p_category: category,
    p_difficulty: difficulty,
    p_sort: options.sort,
    p_limit: options.count,
    p_exclude_ids: options.excludeIds ?? [],
  });

  if (error) {
    const details = [error.code, error.message, error.details, error.hint]
      .filter(Boolean)
      .join(" · ");

    throw new Error(
      details || "Supabase could not load the sorted puzzle library.",
    );
  }

  const puzzles = ((data ?? []) as ChessPuzzleRow[])
    .map(rowToPuzzle)
    .filter((puzzle): puzzle is InteractivePuzzle => puzzle !== null);

  return applyLichessTitleOverrides(puzzles);
}

export async function getSuggestedLichessPuzzles(options?: {
  category?: PuzzleCategoryFilter;
  difficulty?: PuzzleDifficultyFilter;
  minRating?: number | null;
  maxRating?: number | null;
  excludeIds?: string[];
  count?: number;
  sort?: PuzzleLibrarySort;
}): Promise<InteractivePuzzle[]> {
  const count = options?.count ?? 5;
  const sort = options?.sort ?? "random";

  if (sort !== "random") {
    return getSortedLichessPuzzles({
      category: options?.category,
      difficulty: options?.difficulty,
      sort,
      excludeIds: options?.excludeIds,
      count,
    });
  }
  const selected: InteractivePuzzle[] = [];
  const excluded = new Set(options?.excludeIds ?? []);

  const fullyOpen =
    (!options?.category || options.category === "All") &&
    (!options?.difficulty || options.difficulty === "All") &&
    options?.minRating == null &&
    options?.maxRating == null;

  const diversityProfiles: Array<{
    category?: PuzzleCategoryFilter;
    difficulty?: PuzzleDifficultyFilter;
  }> = [
    { category: "Tactic", difficulty: "Beginner" },
    { category: "Checkmate", difficulty: "Intermediate" },
    { category: "Strategy", difficulty: "Advanced" },
    { category: "Endgame", difficulty: "Really Hard" },
    {},
  ];

  for (let index = 0; index < count; index += 1) {
    const profile = fullyOpen
      ? diversityProfiles[index % diversityProfiles.length]
      : {};

    let puzzle = await getRandomLichessPuzzleBase({
      category: profile.category ?? options?.category,
      difficulty: profile.difficulty ?? options?.difficulty,
      minRating: options?.minRating,
      maxRating: options?.maxRating,
      excludeIds: [...excluded],
    });

    /*
     * Smaller imports might not contain every category+difficulty
     * combination. Fall back to the active filters while keeping
     * completed/duplicate exclusions.
     */
    if (!puzzle && fullyOpen) {
      puzzle = await getRandomLichessPuzzleBase({
        category: options?.category,
        difficulty: options?.difficulty,
        minRating: options?.minRating,
        maxRating: options?.maxRating,
        excludeIds: [...excluded],
      });
    }

    if (!puzzle) {
      break;
    }

    selected.push(puzzle);
    excluded.add(puzzle.sourceId);
  }

  return applyLichessTitleOverrides(selected);
}

export async function renameLichessPuzzle(
  puzzleId: string,
  title: string,
): Promise<void> {
  const normalizedTitle = title.trim();

  if (!normalizedTitle) {
    throw new Error("Puzzle title cannot be empty.");
  }

  const { error } = await supabase.rpc("set_chess_puzzle_title", {
    p_puzzle_id: puzzleId,
    p_title: normalizedTitle.slice(0, 80),
  });

  if (error) {
    const details = [error.code, error.message, error.details, error.hint]
      .filter(Boolean)
      .join(" · ");

    throw new Error(details || "Supabase could not rename the Lichess puzzle.");
  }
}

export async function recordLichessPuzzleCompletion(
  puzzleId: string,
  mistakes: number,
): Promise<void> {
  const { error } = await supabase.rpc("record_chess_puzzle_completion", {
    p_puzzle_id: puzzleId,
    p_mistakes: Math.max(0, mistakes),
  });

  if (error) {
    throw error;
  }
}

export async function getCompletedLichessPuzzles(
  limit = 100,
): Promise<CompletedPuzzle[]> {
  const { data, error } = await supabase.rpc("get_completed_chess_puzzles", {
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  const result: CompletedPuzzle[] = [];

  for (const row of (data ?? []) as CompletedChessPuzzleRow[]) {
    const puzzle = rowToPuzzle(row);

    if (!puzzle) {
      continue;
    }

    result.push({
      puzzle,
      completedAt: row.completed_at,
      mistakes: row.mistakes ?? 0,
    });
  }

  const titledPuzzles = await applyLichessTitleOverrides(
    result.map((entry) => entry.puzzle),
  );

  return result.map((entry, index) => ({
    ...entry,
    puzzle: titledPuzzles[index] ?? entry.puzzle,
  }));
}
