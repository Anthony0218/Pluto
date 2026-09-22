import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Move } from "chess.js";

import ChessBoard3D from "@/components/chess3d/ChessBoard3D";
import { useStockfish } from "@/hooks/useStockfish";
import {
  getChess3DDifficultyConfig,
  type Chess3DDifficulty,
} from "@/games/chess/3d/chess3dDifficulty.ts";
import {
  CHESS_3D_CAMERA_PRESETS,
  CHESS_3D_SKINS,
  type Chess3DCameraPreset,
  type Chess3DCameraView,
  type Chess3DPieceSkin,
} from "@/games/chess/3d/chess3dAppearance";

export type Chess3DMode = "hotseat" | "ai";

type Props = {
  mode: Chess3DMode;
  difficulty?: Chess3DDifficulty;
};

const SWAPPED_KING_QUEEN_START_FEN =
  "rnbkqbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBKQBNR w - - 0 1";

const PROMOTION_CHOICES = ["q", "r", "b", "n"] as const;

function randomPromotion() {
  return PROMOTION_CHOICES[
    Math.floor(Math.random() * PROMOTION_CHOICES.length)
  ];
}

export default function Chess3DGamePage({
  mode,
  difficulty = "medium",
}: Props) {
  const [fen, setFen] = useState(SWAPPED_KING_QUEEN_START_FEN);
  const [resetToken, setResetToken] = useState(0);
  const [fenHistory, setFenHistory] = useState<string[]>([
    SWAPPED_KING_QUEEN_START_FEN,
  ]);
  const [moveHistory, setMoveHistory] = useState<Move[]>([]);
  const [pieceSkin, setPieceSkin] = useState<Chess3DPieceSkin>("classic");
  const [cameraView, setCameraView] = useState<Chess3DCameraView>({
    id: 0,
    preset: "classic",
  });

  const [externalMove, setExternalMove] = useState<{
    id: number;
    move: Move;
  } | null>(null);

  const aiRequestIdRef = useRef(0);
  const aiMoveIdRef = useRef(0);

  const game = useMemo(() => new Chess(fen), [fen]);

  const isAiMode = mode === "ai";
  const difficultyConfig = getChess3DDifficultyConfig(difficulty);

  const {
    ready: stockfishReady,
    thinking: stockfishThinking,
    setSkillLevel,
    getBestMove,
  } = useStockfish(isAiMode);

  const isHumanTurn = !isAiMode || game.turn() === "w";

  useEffect(() => {
    if (!isAiMode || !stockfishReady) return;

    setSkillLevel(difficultyConfig.stockfishSkill);
  }, [
    isAiMode,
    stockfishReady,
    difficultyConfig.stockfishSkill,
    setSkillLevel,
  ]);

  useEffect(() => {
    if (!isAiMode) return;
    if (!stockfishReady) return;
    if (game.isGameOver()) return;
    if (game.turn() !== "b") return;

    const requestId = ++aiRequestIdRef.current;
    const currentFen = fen;

    const timer = window.setTimeout(() => {
      void (async () => {
        if (requestId !== aiRequestIdRef.current) return;

        const currentGame = new Chess(currentFen);
        const legalMoves = currentGame.moves({
          verbose: true,
        });

        let executedMove: Move;

        const useRandomMove =
          legalMoves.length > 0 &&
          Math.random() < difficultyConfig.randomMoveChance;

        if (useRandomMove) {
          const randomLegalMove =
            legalMoves[Math.floor(Math.random() * legalMoves.length)];

          const promotion =
            randomLegalMove.promotion ??
            (randomLegalMove.piece === "p" &&
            (randomLegalMove.to.endsWith("8") ||
              randomLegalMove.to.endsWith("1"))
              ? randomPromotion()
              : undefined);

          executedMove = currentGame.move({
            from: randomLegalMove.from,
            to: randomLegalMove.to,
            promotion,
          });
        } else {
          const result = await getBestMove(
            currentFen,
            difficultyConfig.moveTime,
          );

          if (requestId !== aiRequestIdRef.current) return;
          if (!result) return;

          const movingPiece = currentGame.get(result.from as any);

          const isPromotion =
            movingPiece?.type === "p" &&
            (result.to.endsWith("8") || result.to.endsWith("1"));

          executedMove = currentGame.move({
            from: result.from,
            to: result.to,
            promotion: isPromotion ? randomPromotion() : result.promotion,
          });
        }

        aiMoveIdRef.current += 1;

        setExternalMove({
          id: aiMoveIdRef.current,
          move: executedMove,
        });

        const nextFen = currentGame.fen();
        setFen(nextFen);
        setFenHistory((current) => [...current, nextFen]);
        setMoveHistory((current) => [...current, executedMove]);
      })();
    }, 450);

    return () => {
      window.clearTimeout(timer);
      aiRequestIdRef.current += 1;
    };
  }, [isAiMode, stockfishReady, fen, game, getBestMove, difficultyConfig]);

  function handleHumanMove(move: Move, resultingFen?: string) {
    let nextFen: string;

    if (resultingFen) {
      nextFen = resultingFen;
    } else {
      const nextGame = new Chess(fen);

      nextGame.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion,
      });

      nextFen = nextGame.fen();
    }

    setFen(nextFen);
    setFenHistory((current) => [...current, nextFen]);
    setMoveHistory((current) => [...current, move]);
  }

  function chooseCamera(preset: Chess3DCameraPreset) {
    setCameraView((current) => ({
      id: current.id + 1,
      preset,
    }));
  }

  function undoGame() {
    if (fenHistory.length <= 1) return;

    aiRequestIdRef.current += 1;
    setExternalMove(null);

    const stepsBack = isAiMode && fenHistory.length >= 3 ? 2 : 1;

    const targetIndex = Math.max(0, fenHistory.length - 1 - stepsBack);

    const nextHistory = fenHistory.slice(0, targetIndex + 1);

    const restoredFen =
      nextHistory[nextHistory.length - 1] ?? SWAPPED_KING_QUEEN_START_FEN;

    setFenHistory(nextHistory);
    setMoveHistory((current) =>
      current.slice(0, Math.max(0, current.length - stepsBack)),
    );
    setFen(restoredFen);

    // Rebuild all visual pieces from the restored FEN.
    setResetToken((current) => current + 1);
  }

  function resetGame() {
    aiRequestIdRef.current += 1;
    setFen(SWAPPED_KING_QUEEN_START_FEN);
    setFenHistory([SWAPPED_KING_QUEEN_START_FEN]);
    setMoveHistory([]);
    setExternalMove(null);
    setResetToken((current) => current + 1);
  }

  const statusText = (() => {
    if (game.isCheckmate()) {
      return `${game.turn() === "w" ? "Black" : "White"} wins by checkmate`;
    }

    if (game.isDraw()) {
      return "Draw";
    }

    if (isAiMode && stockfishThinking) {
      return "Stockfish is thinking…";
    }

    if (isAiMode && !stockfishReady) {
      return "Loading Stockfish…";
    }

    return game.turn() === "w" ? "White to move" : "Black to move";
  })();

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-400">
              3D Chess
            </p>

            <h1 className="mt-2 text-3xl font-black text-white">
              {isAiMode
                ? `Vs Stockfish · ${difficultyConfig.label}`
                : "Hotseat"}
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              {isAiMode
                ? "You play White. Stockfish controls Black."
                : "Two players share the same board locally."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={undoGame}
              disabled={fenHistory.length <= 1 || stockfishThinking}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-black text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              ↶ Undo
            </button>

            <button
              type="button"
              onClick={resetGame}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-black text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              ↺ Reset
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3">
          <span className="text-xs font-black uppercase tracking-widest text-zinc-500">
            Status
          </span>

          <span className="rounded-lg bg-white/5 px-3 py-1.5 text-sm font-black text-white">
            {statusText}
          </span>

          {game.isCheck() && !game.isCheckmate() && (
            <span className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-xs font-black text-red-200">
              Check
            </span>
          )}

          {isAiMode && (
            <>
              <span className="rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-black text-violet-200">
                {difficultyConfig.label}
              </span>

              <span
                className={`rounded-lg border px-3 py-1.5 text-xs font-black ${
                  stockfishReady
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                    : "border-amber-400/20 bg-amber-400/10 text-amber-200"
                }`}
              >
                {stockfishReady ? "Stockfish ready" : "Engine loading"}
              </span>
            </>
          )}
        </div>

        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-3">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Camera
            </div>

            <div className="flex flex-wrap gap-2">
              {CHESS_3D_CAMERA_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => chooseCamera(preset.id)}
                  className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                    cameraView.preset === preset.id
                      ? "border-sky-400/35 bg-sky-400/15 text-sky-100"
                      : "border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-zinc-900/60 p-3">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Piece skin
            </div>

            <div className="flex flex-wrap gap-2">
              {CHESS_3D_SKINS.map((skin) => (
                <button
                  key={skin.id}
                  type="button"
                  title={skin.description}
                  onClick={() => setPieceSkin(skin.id)}
                  className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                    pieceSkin === skin.id
                      ? "border-violet-400/35 bg-violet-400/15 text-violet-100"
                      : "border-white/10 bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white"
                  }`}
                >
                  {skin.label}
                </button>
              ))}
            </div>
          </section>
        </div>

        <ChessBoard3D
          game={game}
          resetToken={resetToken}
          onMove={handleHumanMove}
          inputEnabled={isHumanTurn && !stockfishThinking}
          externalMove={externalMove}
          moveHistory={moveHistory}
          pieceSkin={pieceSkin}
          cameraView={cameraView}
          backgroundImage="/images/chess-3d-background.png"
        />
      </div>
    </main>
  );
}
