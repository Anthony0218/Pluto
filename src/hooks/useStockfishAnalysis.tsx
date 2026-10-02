import { useCallback, useEffect, useRef, useState } from "react";

export type StockfishAnalysisLine = {
  multipv: number;

  scoreCp: number | null;

  mate: number | null;

  pv: string[];
};

type PendingAnalysis = {
  resolve: (lines: StockfishAnalysisLine[]) => void;

  lines: Map<number, StockfishAnalysisLine>;
};

export function useStockfishAnalysis() {
  const workerRef = useRef<Worker | null>(null);

  const pendingRef = useRef<PendingAnalysis | null>(null);

  const [ready, setReady] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const worker = new Worker("/stockfish/stockfish-18-lite-single.js");

    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      const line = String(event.data);

      if (line === "uciok") {
        worker.postMessage("isready");

        return;
      }

      if (line === "readyok") {
        setReady(true);

        return;
      }

      /*
       * Analysis line.
       *
       * Example:
       *
       * info depth 16 multipv 1
       * score cp 34
       * pv e2e4 e7e5 ...
       */
      if (line.startsWith("info ") && pendingRef.current) {
        const multipvMatch = line.match(/\bmultipv\s+(\d+)/);

        const cpMatch = line.match(/\bscore cp (-?\d+)/);

        const mateMatch = line.match(/\bscore mate (-?\d+)/);

        const pvIndex = line.indexOf(" pv ");

        if (pvIndex === -1) {
          return;
        }

        const pv = line
          .slice(pvIndex + 4)
          .trim()
          .split(/\s+/);

        if (pv.length === 0) {
          return;
        }

        const multipv = multipvMatch ? Number(multipvMatch[1]) : 1;

        pendingRef.current.lines.set(multipv, {
          multipv,

          scoreCp: cpMatch ? Number(cpMatch[1]) : null,

          mate: mateMatch ? Number(mateMatch[1]) : null,

          pv,
        });

        return;
      }

      /*
       * Search finished.
       */
      if (line.startsWith("bestmove ") && pendingRef.current) {
        const pending = pendingRef.current;

        pendingRef.current = null;

        setAnalyzing(false);

        const result = Array.from(pending.lines.values()).sort(
          (a, b) => a.multipv - b.multipv,
        );

        pending.resolve(result);
      }
    };

    worker.postMessage("uci");

    return () => {
      worker.terminate();

      workerRef.current = null;

      pendingRef.current = null;
    };
  }, []);

  const analyzePosition = useCallback(
    async (
      fen: string,
      options?: {
        multiPV?: number;
        moveTime?: number;
        /** Fixed search depth; overrides moveTime and makes results reproducible. */
        depth?: number;
        /** Clear the hash first so earlier searches cannot influence this one. */
        newGame?: boolean;
      },
    ) => {
      const worker = workerRef.current;

      if (!worker || !ready) {
        return [];
      }

      /*
       * Only one search at a time on
       * this analysis worker.
       */
      if (pendingRef.current) {
        return [];
      }

      const multiPV = options?.multiPV ?? 1;

      const moveTime = options?.moveTime ?? 500;

      setAnalyzing(true);

      return new Promise<StockfishAnalysisLine[]>((resolve) => {
        pendingRef.current = {
          resolve,
          lines: new Map(),
        };

        if (options?.newGame) {
          worker.postMessage("ucinewgame");
        }

        worker.postMessage(`setoption name MultiPV value ${multiPV}`);

        worker.postMessage(`position fen ${fen}`);

        worker.postMessage(
          options?.depth ? `go depth ${options.depth}` : `go movetime ${moveTime}`,
        );
      });
    },
    [ready],
  );

  return {
    ready,
    analyzing,
    analyzePosition,
  };
}
