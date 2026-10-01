import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "chess-coach-auto-best-move";

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Chess Coach "auto best move": while on, `showHelp` runs once for every
 * position in which `canShow` holds, so the engine's top move appears on
 * the board without pressing Help. Hiding Help keeps it hidden until the
 * position changes.
 */
export function useAutoBestMove({ fen, canShow, showHelp }: { fen: string; canShow: boolean; showHelp: () => void }) {
  const [enabled, setEnabled] = useState(readStored);
  const shownForFenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !canShow || shownForFenRef.current === fen) return;
    shownForFenRef.current = fen;
    showHelp();
  }, [enabled, canShow, fen, showHelp]);

  function toggle() {
    const next = !enabled;
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked: the switch still works for this visit.
    }
    // Turning it on shows the best move for the current position too.
    if (next) shownForFenRef.current = null;
    setEnabled(next);
  }

  return { enabled, toggle };
}
