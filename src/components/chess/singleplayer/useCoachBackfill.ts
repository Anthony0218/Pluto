import { useEffect, useRef, useState } from "react";
import type { Chess } from "chess.js";

import { gradeEarlierMoves, type AnalyzePosition, type MoveReview } from "@/utils/chessAnalysis";

/** True while `moves` still starts with every move of `prefix`. */
function startsWith(moves: string[], prefix: string[]) {
  return prefix.every((san, index) => moves[index] === san);
}

/**
 * Chess Coach switched on mid-game: grades the moves that were played before,
 * so the move history shows their grades too.
 *
 * Every engine search of the coach goes through `queue`, which runs one task
 * after another on the single analysis worker, so a move made during the run
 * is graded once it is done.
 */
export function useCoachBackfill({
  active,
  ready,
  game,
  analyzePosition,
  needsGrade,
  onGrade,
}: {
  active: boolean;
  ready: boolean;
  game: Chess;
  analyzePosition: AnalyzePosition;
  /** Whether the move at `ply` (1-based) still has to be graded. */
  needsGrade: (ply: number, san: string) => boolean;
  onGrade: (review: MoveReview) => void;
}) {
  const [progress, setProgress] = useState<{ run: number; done: number; total: number } | null>(null);
  const tailRef = useRef<Promise<unknown>>(Promise.resolve());
  const runRef = useRef(0);
  const onGradeRef = useRef(onGrade);

  useEffect(() => {
    onGradeRef.current = onGrade;
  });

  function queue<T>(task: () => Promise<T>): Promise<T> {
    const next = tailRef.current.then(task, task);
    tailRef.current = next.catch(() => undefined);
    return next;
  }

  useEffect(() => {
    const run = ++runRef.current;

    if (!active || !ready) {
      return;
    }

    const moves = game.history();
    const plies = moves.map((_, index) => index + 1).filter((ply) => needsGrade(ply, moves[ply - 1]));

    if (plies.length === 0) {
      return;
    }

    const stillWanted = () => runRef.current === run && startsWith(game.history(), moves);

    void queue(() => {
      setProgress({ run, done: 0, total: plies.length });

      return gradeEarlierMoves(moves, plies, analyzePosition, {
        stillWanted,
        onGrade: (review) => {
          if (!stillWanted()) return;
          onGradeRef.current(review);
          setProgress((current) => (current?.run === run ? { ...current, done: current.done + 1 } : current));
        },
      });
    }).finally(() => {
      setProgress((current) => (current?.run === run ? null : current));
    });

    // Runs when the coach is switched on; later moves are graded live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ready]);

  useEffect(
    () => () => {
      runRef.current += 1;
    },
    [],
  );

  // A run stopped by switching the coach off clears itself after its current search.
  const shown = active && progress ? { done: progress.done, total: progress.total } : null;

  return { running: shown !== null, progress: shown, queue };
}
