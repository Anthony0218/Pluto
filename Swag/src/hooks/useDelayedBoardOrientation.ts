import { useCallback, useEffect, useRef, useState } from "react";

export type BoardOrientation = "white" | "black";

export type ChessSide = "w" | "b";

function toOrientation(side: ChessSide): BoardOrientation {
  return side === "w" ? "white" : "black";
}

/**
 * Delays a side-to-move board flip.
 *
 * Example with 1500 ms:
 * White moves -> game.turn() becomes "b"
 * -> board stays White-bottom for 1.5 seconds
 * -> orientation becomes Black-bottom.
 *
 * Whether Board.tsx animates that orientation change or snaps instantly
 * is intentionally handled separately by Board.tsx.
 */
export function useDelayedBoardOrientation(
  sideToMove: ChessSide,
  delayMs = 1500,
) {
  const desiredOrientation = toOrientation(sideToMove);

  const [orientation, setOrientation] =
    useState<BoardOrientation>(desiredOrientation);

  const [flipPending, setFlipPending] = useState(false);

  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);

      timerRef.current = null;
    }
  }, []);

  const snapToSide = useCallback(
    (side: ChessSide) => {
      clearTimer();

      setOrientation(toOrientation(side));

      setFlipPending(false);
    },
    [clearTimer],
  );

  useEffect(() => {
    clearTimer();

    if (orientation === desiredOrientation) {
      setFlipPending(false);

      return;
    }

    setFlipPending(true);

    timerRef.current = window.setTimeout(() => {
      setOrientation(desiredOrientation);

      setFlipPending(false);

      timerRef.current = null;
    }, delayMs);

    return clearTimer;
  }, [clearTimer, delayMs, desiredOrientation, orientation]);

  return {
    orientation,
    flipPending,
    snapToSide,
  };
}
