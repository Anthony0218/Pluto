import { useEffect, useRef, useState } from "react";
import { getMoveRating } from "../utils/chessUtils";

type AnalysisType = "before" | "after" | "position";

type PlayerColor = "w" | "b";

export function useStockfish() {
  const stockfish = useRef<Worker | null>(null);
  const beforeMoveEvaluation = useRef<number | null>(null);
  const afterMoveEvaluation = useRef<number | null>(null);
  const playerMoveColor = useRef<"w" | "b" | null>(null);
  const analysisType = useRef<"before" | "after" | "position" | null>(null);
  const [evaluation, setEvaluation] = useState<number | null>(null);
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [moveRating, setMoveRating] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker("/stockfish/stockfish-18-lite-single.js");

    stockfish.current = worker;

    worker.onmessage = (event) => {
      const message = event.data as string;

      console.log("Stockfish:", message);

      if (message.startsWith("info") && message.includes("score cp")) {
        const match = message.match(/score cp (-?\d+)/);

        if (!match) {
          return;
        }

        const depthMatch = message.match(/depth (\d+)/);

        if (!depthMatch) {
          return;
        }

        const depth = Number(depthMatch[1]);

        if (depth < 15) {
          return;
        }

        const centipawns = Number(match[1]);
        const score = centipawns / 100;

        if (analysisType.current === "position") {
          setEvaluation(score);

          // This is the position immediately before
          // the player's move.
          beforeMoveEvaluation.current = score;
        }

        if (analysisType.current === "after") {
          afterMoveEvaluation.current = score;
          setEvaluation(score);
        }
      }

      if (message.startsWith("bestmove")) {
        const move = message.split(" ")[1];

        if (move) {
          setBestMove(move);
        }

        if (
          analysisType.current === "after" &&
          beforeMoveEvaluation.current !== null &&
          afterMoveEvaluation.current !== null &&
          playerMoveColor.current !== null
        ) {
          const rating = getMoveRating(
            beforeMoveEvaluation.current,
            afterMoveEvaluation.current,
            playerMoveColor.current,
          );

          console.log(
            "BEFORE:",
            beforeMoveEvaluation.current,
            "AFTER:",
            afterMoveEvaluation.current,
            "COLOR:",
            playerMoveColor.current,
            "RATING:",
            rating,
          );

          setMoveRating(rating);

          beforeMoveEvaluation.current = afterMoveEvaluation.current;
        }

        analysisType.current = null;
      }
    };

    worker.postMessage("uci");

    return () => {
      worker.terminate();
    };
  }, []);
  function analyzePosition(fen: string, type: "before" | "after" | "position") {
    if (!stockfish.current) {
      return;
    }

    analysisType.current = type;

    if (type === "before") {
      beforeMoveEvaluation.current = null;
    }

    if (type === "after") {
      afterMoveEvaluation.current = null;
    }

    stockfish.current.postMessage("stop");
    stockfish.current.postMessage(`position fen ${fen}`);
    stockfish.current.postMessage("go depth 15");
  }
  function setPlayerMoveColor(color: PlayerColor) {
    playerMoveColor.current = color;
  }
  function resetAnalysis() {
    setEvaluation(null);
    setBestMove(null);
    setMoveRating(null);

    beforeMoveEvaluation.current = null;
    afterMoveEvaluation.current = null;
    playerMoveColor.current = null;
    analysisType.current = null;
  }
  function clearMoveAnalysis() {
    setBestMove(null);
    setMoveRating(null);
  }
  return {
    evaluation,
    bestMove,
    moveRating,
    analyzePosition,
    setPlayerMoveColor,
    clearMoveAnalysis,
    resetAnalysis,
  };
}
