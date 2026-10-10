import { gameUi } from "../../../i18n/gameUi.ts";
import VisibleGameResult from "@/components/chess/VisibleGameResult";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import ChessMoveHistoryList from "../ChessMoveHistoryList";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useRef, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  translateChess,
  useChessLanguage,
  type TranslationTable,
} from "../../../games/chess/i18n/chessLanguage.tsx";
import { Chess, type Square } from "chess.js";

import Board from "./Board.tsx";
import PromotionBar from "./PromotionBar";
import { getSquareName } from "../../../utils/chessUtils.ts";
import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
} from "../../../utils/sound.ts";
import { useDelayedBoardOrientation } from "@/hooks/useDelayedBoardOrientation.ts";

import {
  createRandomStartPosition,
  type RandomStartPosition,
} from "../../../games/chess/variants/randomStartChess.ts";
import { useVariantChessAi } from "@/hooks/useVariantChessAi";
import {
  chessColorFromPlayerColor,
  oppositeChessColor,
  type Difficulty,
  type ChessPlayerColor,
} from "../../../games/chess/ai/variantAi.ts";

const translations: Partial<TranslationTable> = {
  de: {
    "Random Start Chess": "Zufallsstart-Schach",
    "Independent random back ranks. No mirroring. No castling.":
      "Unabhängig zufällige Grundreihen. Keine Spiegelung. Keine Rochade.",
    "Starting Position": "Startstellung",
    "This game's independent shuffle": "Unabhängige Mischung dieser Partie",
    "White back rank": "Weiße Grundreihe",
    "Black back rank": "Schwarze Grundreihe",
    "The two back ranks are shuffled separately, so Black is not a reflection of White.":
      "Die beiden Grundreihen werden getrennt gemischt; Schwarz ist also keine Spiegelung von Weiß.",
    plies: "Halbzüge",
    "Random setup only": "Nur zufällige Startstellung",
    "Each side keeps the normal set of 8 back-rank pieces.":
      "Jede Seite behält die normalen 8 Figuren der Grundreihe.",
    "White and Black are shuffled independently.":
      "Weiß und Schwarz werden unabhängig gemischt.",
    "Pawns remain on ranks 2 and 7.":
      "Die Bauern bleiben auf den Reihen 2 und 7.",
    "Castling is disabled for the entire game.":
      "Rochade ist für die gesamte Partie deaktiviert.",
    "After setup, normal chess rules apply.":
      "Nach der Aufstellung gelten normale Schachregeln.",
    "Why it plays differently": "Warum es anders spielt",
    "No mirrored preparation": "Keine gespiegelte Vorbereitung",
    "You cannot rely on matching development plans. A bishop, queen or knight may face a completely different opposing piece, so opening priorities change immediately.":
      "Du kannst dich nicht auf symmetrische Entwicklungspläne verlassen. Läufer, Dame oder Springer können völlig anderen Gegenspielern gegenüberstehen, wodurch sich die Eröffnungsprioritäten sofort ändern.",
    "New random game": "Neue Zufallspartie",
  },
  bar: {
    "Random Start Chess": "Zufallsstart-Schach",
    "Independent random back ranks. No mirroring. No castling.":
      "Zwoa unabhängige Zufalls-Grundreihn. Koane Spiegelung. Koane Rochade.",
    "New random game": "Neie Zufallspartie",
  },
  ko: {
    "Random Start Chess": "랜덤 스타트 체스",
    "Independent random back ranks. No mirroring. No castling.":
      "백과 흑의 백랭크를 각각 독립적으로 무작위 배치합니다. 대칭 없음, 캐슬링 없음.",
    "Starting Position": "시작 포지션",
    "This game's independent shuffle": "이번 게임의 독립 셔플",
    "White back rank": "백 백랭크",
    "Black back rank": "흑 백랭크",
    "The two back ranks are shuffled separately, so Black is not a reflection of White.":
      "두 백랭크를 따로 섞으므로 흑은 백의 대칭 배치가 아닙니다.",
    plies: "하프무브",
    "Random setup only": "랜덤 시작 배치만 변경",
    "Each side keeps the normal set of 8 back-rank pieces.":
      "각 진영은 표준 백랭크 8기물을 그대로 가집니다.",
    "White and Black are shuffled independently.":
      "백과 흑은 독립적으로 섞입니다.",
    "Pawns remain on ranks 2 and 7.": "폰은 2랭크와 7랭크에 그대로 있습니다.",
    "Castling is disabled for the entire game.":
      "게임 전체에서 캐슬링은 비활성화됩니다.",
    "After setup, normal chess rules apply.":
      "배치 후에는 일반 체스 규칙이 적용됩니다.",
    "Why it plays differently": "왜 다르게 플레이되는가",
    "No mirrored preparation": "대칭 준비 없음",
    "You cannot rely on matching development plans. A bishop, queen or knight may face a completely different opposing piece, so opening priorities change immediately.":
      "대칭적인 전개 계획에 의존할 수 없습니다. 비숍, 퀸, 나이트가 전혀 다른 상대 기물을 마주할 수 있어 오프닝 우선순위가 즉시 달라집니다.",
    "New random game": "새 랜덤 게임",
  },
  ru: {
    "Random Start Chess": "Шахматы со случайным стартом",
    "Independent random back ranks. No mirroring. No castling.":
      "Независимые случайные задние ряды. Без зеркала. Без рокировки.",
    "Starting Position": "Начальная позиция",
    "This game's independent shuffle": "Независимая расстановка этой партии",
    "White back rank": "Задний ряд белых",
    "Black back rank": "Задний ряд чёрных",
    "The two back ranks are shuffled separately, so Black is not a reflection of White.":
      "Два задних ряда перемешиваются отдельно, поэтому чёрные не являются зеркалом белых.",
    plies: "полуходов",
    "Random setup only": "Меняется только старт",
    "Each side keeps the normal set of 8 back-rank pieces.":
      "У каждой стороны остаётся стандартный набор из 8 фигур заднего ряда.",
    "White and Black are shuffled independently.":
      "Белые и чёрные перемешиваются независимо.",
    "Pawns remain on ranks 2 and 7.": "Пешки остаются на рядах 2 и 7.",
    "Castling is disabled for the entire game.":
      "Рокировка отключена на всю партию.",
    "After setup, normal chess rules apply.":
      "После расстановки действуют обычные шахматные правила.",
    "Why it plays differently": "Почему игра отличается",
    "No mirrored preparation": "Нет зеркальной подготовки",
    "You cannot rely on matching development plans. A bishop, queen or knight may face a completely different opposing piece, so opening priorities change immediately.":
      "Нельзя полагаться на симметричное развитие: слон, ферзь или конь могут встретить совсем другую фигуру соперника, поэтому приоритеты дебюта меняются сразу.",
    "New random game": "Новая случайная партия",
  },
};

type MoveRecord = {
  ply: number;
  moveNumber: number;
  color: "w" | "b";
  san: string;
  from: Square;
  to: Square;
  fenAfter: string;
};

type Winner = "white" | "black" | "draw";

type VariantAiBoardProps = {
  aiMode?: boolean;
  playerColor?: ChessPlayerColor;
  difficulty?: Difficulty;
  onChangeSettings?: () => void;
};

export default function RandomStartChess({
  aiMode = false,
  playerColor = "white",
  difficulty = "casual",
}: VariantAiBoardProps) {
  useUiLanguage();
  const { language } = useChessLanguage();
  const t = (key: string) => translateChess(language, key, translations);
  const [startPosition, setStartPosition] = useState<RandomStartPosition>(() =>
    createRandomStartPosition(),
  );

  const [game] = useState(() => new Chess(startPosition.fen));

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [promotionFrom, setPromotionFrom] = useState<Square | null>(null);
  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);

  const [records, setRecords] = useState<MoveRecord[]>([]);

  const [gameOver, setGameOver] = useState(false);
  const [, setGameOverReason] = useState("");
  const [, setWinner] = useState<Winner>("draw");

  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );

  const humanColor = chessColorFromPlayerColor(playerColor);
  const computerColor = oppositeChessColor(humanColor);

  const { ready: aiReady, chooseMove: chooseAiMove } = useVariantChessAi(
    aiMode,
    difficulty,
  );

  const aiMovePendingRef = useRef(false);

  useEffect(() => {
    if (
      !aiMode ||
      !aiReady ||
      aiMovePendingRef.current ||
      gameOver ||
      historyPreview ||
      Boolean(promotionFrom || promotionSquare) ||
      game.turn() !== computerColor
    ) {
      return;
    }

    const expectedFen = game.fen();
    let cancelled = false;

    aiMovePendingRef.current = true;

    const timer = window.setTimeout(async () => {
      try {
        const aiMove = await chooseAiMove(game);

        if (
          cancelled ||
          !aiMove ||
          game.fen() !== expectedFen ||
          game.turn() !== computerColor
        ) {
          return;
        }

        commitMove(aiMove.from, aiMove.to, aiMove.promotion);
      } finally {
        aiMovePendingRef.current = false;
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    aiMode,
    aiReady,
    computerColor,
    records.length,
    gameOver,
    historyPreviewPly,
    promotionFrom,
    promotionSquare,
    chooseAiMove,
  ]);

  const {
    orientation: liveBoardOrientation,
    flipPending,
    snapToSide,
  } = useDelayedBoardOrientation(aiMode ? humanColor : game.turn(), 1500);

  const historyPreview =
    historyPreviewPly !== null
      ? (records[historyPreviewPly - 1] ?? null)
      : null;

  const historyPreviewChess = useMemo(
    () => (historyPreview ? new Chess(historyPreview.fenAfter) : null),
    [historyPreview?.fenAfter],
  );

  const displayedChess = historyPreviewChess ?? game;
  const displayedBoard = displayedChess.board();

  const boardOrientation: "white" | "black" = historyPreviewChess
    ? historyPreviewChess.turn() === "w"
      ? "white"
      : "black"
    : liveBoardOrientation;

  const checkedKingSquare = getCheckedKingSquare(displayedChess);

  function getCheckedKingSquare(chess: Chess): Square | null {
    if (!chess.isCheck()) {
      return null;
    }

    const color = chess.turn();

    for (let row = 0; row < 8; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const square = getSquareName(row, column);
        const piece = chess.get(square);

        if (piece?.type === "k" && piece.color === color) {
          return square;
        }
      }
    }

    return null;
  }

  function updateGameOver(nextRecords: MoveRecord[]) {
    if (game.isCheckmate()) {
      setGameOver(true);
      setGameOverReason("Checkmate");
      setWinner(game.turn() === "w" ? "black" : "white");
      return true;
    }

    if (game.isStalemate()) {
      setGameOver(true);
      setGameOverReason("Stalemate");
      setWinner("draw");
      return true;
    }

    if (game.isInsufficientMaterial()) {
      setGameOver(true);
      setGameOverReason("Insufficient material");
      setWinner("draw");
      return true;
    }

    if (game.isDrawByFiftyMoves()) {
      setGameOver(true);
      setGameOverReason("50-move rule");
      setWinner("draw");
      return true;
    }

    /*
     * chess.js can handle repetition normally because this variant stops
     * being special after the initial setup.
     */
    if (game.isThreefoldRepetition()) {
      setGameOver(true);
      setGameOverReason("Threefold repetition");
      setWinner("draw");
      return true;
    }

    setGameOver(false);
    setGameOverReason("");
    void nextRecords;

    return false;
  }

  function commitMove(
    from: Square,
    to: Square,
    promotion?: "q" | "r" | "b" | "n",
  ) {
    if (gameOver || historyPreview) {
      return;
    }

    try {
      const move = game.move({
        from,
        to,
        promotion,
      });

      const nextPly = records.length + 1;

      const record: MoveRecord = {
        ply: nextPly,
        moveNumber: Math.ceil(nextPly / 2),
        color: move.color,
        san: move.san,
        from: move.from,
        to: move.to,
        fenAfter: game.fen(),
      };

      const nextRecords = [...records, record];

      setRecords(nextRecords);

      setLastMove({
        from: move.from,
        to: move.to,
      });

      setSelectedSquare(null);
      setLegalMoves([]);
      setPromotionFrom(null);
      setPromotionSquare(null);
      setHistoryPreviewPly(null);

      if (move.captured) {
        playPieceCaptureSound(move.piece);
      } else {
        playPieceMoveSound(move.piece);
      }

      updateGameOver(nextRecords);
    } catch {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }

  function handleSquareClick(row: number, column: number) {
    if (aiMode && game.turn() !== humanColor) {
      return;
    }

    if (gameOver || historyPreview || flipPending) {
      return;
    }

    const square = getSquareName(row, column);

    if (selectedSquare === null) {
      const piece = game.get(square);

      if (!piece || piece.color !== game.turn()) {
        return;
      }

      setSelectedSquare(square);
      playPieceSelectSound(piece.type);

      setLegalMoves(
        game
          .moves({
            square,
            verbose: true,
          })
          .map((move) => move.to),
      );

      return;
    }

    const selectedPiece = game.get(selectedSquare);

    if (
      selectedPiece?.type === "p" &&
      legalMoves.includes(square) &&
      (square[1] === "8" || square[1] === "1")
    ) {
      setPromotionFrom(selectedSquare);
      setPromotionSquare(square);
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    if (!legalMoves.includes(square)) {
      const clickedPiece = game.get(square);

      if (clickedPiece?.color === game.turn()) {
        setSelectedSquare(square);
        playPieceSelectSound(clickedPiece.type);

        setLegalMoves(
          game
            .moves({
              square,
              verbose: true,
            })
            .map((move) => move.to),
        );

        return;
      }

      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    commitMove(selectedSquare, square);
  }

  function undoMove() {
    if (records.length === 0 || aiMode) {
      return;
    }

    const nextRecords = records.slice(0, -1);

    const targetFen =
      nextRecords[nextRecords.length - 1]?.fenAfter ?? startPosition.fen;

    game.load(targetFen);
    snapToSide(game.turn());

    const previous = nextRecords[nextRecords.length - 1] ?? null;

    setRecords(nextRecords);
    setLastMove(
      previous
        ? {
            from: previous.from,
            to: previous.to,
          }
        : null,
    );

    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionFrom(null);
    setPromotionSquare(null);
    setHistoryPreviewPly(null);
    setGameOver(false);
    setGameOverReason("");
  }

  function newRandomGame() {
    const nextPosition = createRandomStartPosition();

    game.load(nextPosition.fen);
    snapToSide("w");

    setStartPosition(nextPosition);
    setRecords([]);
    setLastMove(null);
    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionFrom(null);
    setPromotionSquare(null);
    setHistoryPreviewPly(null);
    setGameOver(false);
    setGameOverReason("");
    setWinner("draw");
  }

  const whiteLineup = startPosition.whiteBackRank
    .map((piece) => piece.toUpperCase())
    .join(" ");

  const blackLineup = startPosition.blackBackRank
    .map((piece) => piece.toUpperCase())
    .join(" ");

  return (
    <div className="min-h-screen bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1460px]">
        <ChessPageHeader className="mb-6 rounded-3xl border border-violet-400/10 bg-zinc-900/70 px-5 py-4 shadow-xl shadow-black/20">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-violet-300">
            {t("Chess Variant")}
          </p>

          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-white">
                {t("Random Start Chess")}
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                {t("Independent random back ranks. No mirroring. No castling.")}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {gameUi(!gameOver && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black text-zinc-300">
                  {gameUi(game.turn() === "w" ? t("White to move") : t("Black to move"))}
                </span>
              ))}
            </div>
          </div>
        </ChessPageHeader>

        <main className="chess-game-grid grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel gameControls
                title={t("Game Controls")}
                subtitle={t("Players and actions")}
              >
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={undoMove}
                    disabled={records.length === 0 || aiMode}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-black text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed
    disabled:border-white/5
    disabled:bg-white/[0.02]
    disabled:text-zinc-600
    disabled:opacity-50
    disabled:hover:bg-white/[0.02]"
                  >
                    ↶ {t("Undo")}
                  </button>

                  <button
                    type="button"
                    onClick={newRandomGame}
                    className="rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 py-2.5 text-xs font-black text-violet-200 transition hover:bg-violet-400/20"
                  >
                    🎲 {t("New setup")}
                  </button>
                </div>
              </Panel>

              <Panel
                title={t("Starting Position")}
                subtitle={t("This game's independent shuffle")}
              >
                <Lineup title={t("White back rank")} value={whiteLineup} />
                <div className="mt-3">
                  <Lineup title={t("Black back rank")} value={blackLineup} />
                </div>

                <p className="mt-3 text-[10px] leading-5 text-zinc-600">
                  {t(
                    "The two back ranks are shuffled separately, so Black is not a reflection of White.",
                  )}
                </p>
              </Panel>

              <Panel
                title={t("Move History")}
                subtitle={gameUi(`${records.length} ${t("plies")}`)}
              >
                <ChessMoveHistoryList
                  listClassName="max-h-72 rounded-xl border border-white/5 bg-black/20"
                  selectedPly={historyPreviewPly}
                  emptyLabel={t("No moves yet")}
                  entries={records.map((record) => ({
                    ply: record.ply,
                    side: record.color,
                    moveNumber: record.moveNumber,
                    content: <span className="truncate text-xs font-black text-zinc-200">{gameUi(record.san)}</span>,
                  }))}
                  onSelect={(ply) => {
                    setHistoryPreviewPly(ply);
                    setSelectedSquare(null);
                    setLegalMoves([]);
                  }}
                />
              </Panel>
            </div>
          </aside>

          <section className="mx-auto w-full max-w-[820px] min-w-0">
            {historyPreview && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-violet-400/20 bg-violet-400/[0.07] px-4 py-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-violet-300">
                    {t("History Preview")}
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {gameUi(historyPreview.moveNumber)}
                    {gameUi(historyPreview.color === "w" ? "." : "...")}{gameUi(" ")}
                    {gameUi(historyPreview.san)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setHistoryPreviewPly(null)}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-white/20"
                >
                  {t("Back to live")}
                </button>
              </div>
            )}

            {gameUi(promotionFrom && promotionSquare && !historyPreview && (
              <div className="mb-3">
                <PromotionBar
                  onPromote={(piece) =>
                    commitMove(promotionFrom, promotionSquare, piece)
                  }
                />
              </div>
            ))}

            {gameUi(gameOver && !historyPreview && (
              <VisibleGameResult
                actions={
                  <button
                    type="button"
                    onClick={newRandomGame}
                    className="mt-5 rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-black text-violet-950"
                  >
                    {t("New random game")}
                  </button>
                }
              />
            ))}

            <div className="relative">
              <Board
                board={displayedBoard}
                selectedSquare={historyPreview ? null : selectedSquare}
                legalMoves={historyPreview ? [] : legalMoves}
                lastMove={
                  historyPreview
                    ? {
                        from: historyPreview.from,
                        to: historyPreview.to,
                      }
                    : lastMove
                }
                checkedKingSquare={checkedKingSquare}
                onSquareClick={
                  historyPreview || flipPending ? () => {} : handleSquareClick
                }
                orientation={boardOrientation}
              />
            </div>
          </section>

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel title={t("Rules")} subtitle={t("Random setup only")}>
                <Rule
                  text={t(
                    "Each side keeps the normal set of 8 back-rank pieces.",
                  )}
                />
                <Rule text={t("White and Black are shuffled independently.")} />
                <Rule text={t("Pawns remain on ranks 2 and 7.")} />
                <Rule text={t("Castling is disabled for the entire game.")} />
                <Rule text={t("After setup, normal chess rules apply.")} />
              </Panel>

              <Panel
                title={t("Why it plays differently")}
                subtitle={t("No mirrored preparation")}
              >
                <p className="text-xs leading-6 text-zinc-500">
                  {t(
                    "You cannot rely on matching development plans. A bishop, queen or knight may face a completely different opposing piece, so opening priorities change immediately.",
                  )}
                </p>
              </Panel>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function Panel({
  gameControls = false,
  title,
  subtitle,
  children,
}: {
  gameControls?: boolean;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  useUiLanguage();
  return (
    <section data-chess-controls={gameControls || undefined} className="rounded-3xl border border-white/5 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
      <h2 className="font-black text-zinc-100">{ui(title)}</h2>
      <p className="mt-1 mb-4 text-xs text-zinc-600">{ui(subtitle)}</p>
      {gameUi(children)}
    </section>
  );
}

function Lineup({ title, value }: { title: string; value: string }) {
  useUiLanguage();
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
      <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {ui(title)}
      </p>
      <p className="mt-2 font-mono text-sm font-black tracking-widest text-zinc-200">
        {gameUi(value)}
      </p>
    </div>
  );
}

function Rule({ text }: { text: string }) {
  useUiLanguage();
  return (
    <div className="mb-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-xs leading-5 text-zinc-400 last:mb-0">
      {ui(text)}
    </div>
  );
}
