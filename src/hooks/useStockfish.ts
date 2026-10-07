import { useCallback, useEffect, useRef, useState } from "react";

export type StockfishMove = {
  from: string;
  to: string;
  promotion?: string;
};

export function useStockfish(enabled = true) {
  const workerRef = useRef<Worker | null>(null);

  const [ready, setReady] = useState(false);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setReady(false);
      setThinking(false);
      return;
    }

    const worker = new Worker("/stockfish/stockfish-18-lite-single.js");

    workerRef.current = worker;

    const handleMessage = (event: MessageEvent) => {
      const line = String(event.data);

      if (line === "uciok") {
        worker.postMessage("isready");
      }

      if (line === "readyok") {
        setReady(true);
      }
    };

    worker.addEventListener("message", handleMessage);

    worker.postMessage("uci");

    return () => {
      worker.removeEventListener("message", handleMessage);

      try {
        worker.postMessage("quit");
      } catch {
        // Worker may already be terminating.
      }

      worker.terminate();

      workerRef.current = null;

      setReady(false);
      setThinking(false);
    };
  }, [enabled]);

  const setSkillLevel = useCallback((level: number) => {
    const worker = workerRef.current;

    if (!worker) {
      return;
    }

    const safeLevel = Math.max(0, Math.min(20, level));

    worker.postMessage(`setoption name Skill Level value ${safeLevel}`);
  }, []);

  /**
   * `searchMoves` is optional.
   *
   * It is the important extension for variants such as Horror / Collapse:
   * Stockfish still evaluates the chess position, but it is only allowed to
   * choose moves that the variant layer has declared legal.
   *
   * Existing classic calls remain valid:
   *   getBestMove(fen, 500)
   */
  const getBestMove = useCallback(
    (
      fen: string,
      moveTime = 500,
      searchMoves?: string[],
    ): Promise<StockfishMove | null> => {
      return new Promise((resolve) => {
        const worker = workerRef.current;

        if (!worker) {
          resolve(null);
          return;
        }

        if (searchMoves && searchMoves.length === 0) {
          resolve(null);
          return;
        }

        setThinking(true);

        const handleBestMove = (event: MessageEvent) => {
          const line = String(event.data);

          if (!line.startsWith("bestmove")) {
            return;
          }

          worker.removeEventListener("message", handleBestMove);

          setThinking(false);

          const [, move] = line.split(" ");

          if (!move || move === "(none)") {
            resolve(null);
            return;
          }

          resolve({
            from: move.slice(0, 2),
            to: move.slice(2, 4),
            promotion: move.length > 4 ? move.slice(4, 5) : undefined,
          });
        };

        worker.addEventListener("message", handleBestMove);

        worker.postMessage("stop");
        worker.postMessage(`position fen ${fen}`);

        const searchMovesCommand =
          searchMoves && searchMoves.length > 0
            ? ` searchmoves ${searchMoves.join(" ")}`
            : "";

        worker.postMessage(
          `go movetime ${Math.max(1, moveTime)}${searchMovesCommand}`,
        );
      });
    },
    [],
  );

  return {
    ready,
    thinking,
    setSkillLevel,
    getBestMove,
  };
}
