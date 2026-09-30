import { useCallback, useEffect, useMemo } from "react";
import { type Chess, type Square } from "chess.js";

import { useStockfish } from "@/hooks/useStockfish";

import {
  difficultyLevels,
  moveToUci,
  type Difficulty,
  type VariantAiMove,
} from "../games/chess/ai/variantAi";

type VerboseMoveLike = {
  from: string;
  to: string;
  promotion?: string;
};

function normalizeMove(move: VerboseMoveLike): VariantAiMove {
  return {
    from: move.from as Square,
    to: move.to as Square,
    promotion: move.promotion
      ? (move.promotion as "q" | "r" | "b" | "n")
      : undefined,
  };
}

function chooseRandomMove(moves: VerboseMoveLike[]): VariantAiMove | null {
  if (moves.length === 0) {
    return null;
  }

  const move = moves[Math.floor(Math.random() * moves.length)];

  return normalizeMove(move);
}

/**
 * Shared Stockfish controller for all 8×8 variants.
 *
 * The variant may pass `allowedUciMoves` to prevent Stockfish from selecting
 * a normal-chess move that the variant itself forbids.
 */
export function useVariantChessAi(
  enabled: boolean,
  difficulty: Difficulty,
) {
  const settings = useMemo(
    () => difficultyLevels[difficulty],
    [difficulty],
  );

  const {
    ready,
    thinking,
    setSkillLevel,
    getBestMove,
  } = useStockfish(enabled);

  useEffect(() => {
    if (!enabled || !ready) {
      return;
    }

    setSkillLevel(settings.skillLevel);
  }, [enabled, ready, setSkillLevel, settings.skillLevel]);

  const chooseMove = useCallback(
    async (
      game: Chess,
      allowedUciMoves?: string[],
    ): Promise<VariantAiMove | null> => {
      const allMoves = game.moves({ verbose: true });

      if (allowedUciMoves && allowedUciMoves.length === 0) {
        return null;
      }

      const allowedSet =
        allowedUciMoves !== undefined
          ? new Set(allowedUciMoves)
          : null;

      const legalMoves = allowedSet
        ? allMoves.filter((move) => allowedSet.has(moveToUci(move)))
        : allMoves;

      if (legalMoves.length === 0) {
        return null;
      }

      const shouldPlayWeakMove =
        settings.randomMoveChance > 0 &&
        Math.random() < settings.randomMoveChance;

      if (shouldPlayWeakMove) {
        return chooseRandomMove(legalMoves);
      }

      const stockfishMove = await getBestMove(
        game.fen(),
        settings.thinkTime,
        allowedSet ? legalMoves.map(moveToUci) : undefined,
      );

      if (!stockfishMove) {
        return chooseRandomMove(legalMoves);
      }

      const uci = moveToUci(stockfishMove);

      /*
       * A late engine answer can theoretically be stale after a variant event.
       * Never trust it blindly when a variant supplied its own legal set.
       */
      if (allowedSet && !allowedSet.has(uci)) {
        return chooseRandomMove(legalMoves);
      }

      return {
        from: stockfishMove.from as Square,
        to: stockfishMove.to as Square,
        promotion:
          (stockfishMove.promotion as
            | "q"
            | "r"
            | "b"
            | "n"
            | undefined) ?? undefined,
      };
    },
    [
      getBestMove,
      settings.randomMoveChance,
      settings.thinkTime,
    ],
  );

  return {
    ready,
    thinking,
    settings,
    chooseMove,
  };
}
