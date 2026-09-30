import VisibleGameResult from "@/components/chess/VisibleGameResult";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import ChessMoveHistoryList from "../ChessMoveHistoryList";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useRef, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Chess, type Square } from "chess.js";

import Board from "./Board";
import PromotionBar from "./PromotionBar";

import { getSquareName } from "../../../utils/chessUtils";

import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
} from "../../../utils/sound";

import { useDelayedBoardOrientation } from "@/hooks/useDelayedBoardOrientation";

import {
  translateChess,
  useChessLanguage,
  type TranslationTable,
} from "../../../games/chess/i18n/chessLanguage";

import {
  countPiecesByZone,
  createTotalChaosPosition,
  type TotalChaosPosition,
} from "../../../games/chess/variants/totalChaosChess";
import { useVariantChessAi } from "@/hooks/useVariantChessAi";
import {
  chessColorFromPlayerColor,
  oppositeChessColor,
  type Difficulty,
  type ChessPlayerColor,
} from "../../../games/chess/ai/variantAi";

type PromotionPiece = "q" | "r" | "b" | "n";

type Winner = "white" | "black" | "draw";

type MoveRecord = {
  ply: number;
  moveNumber: number;
  color: "w" | "b";
  san: string;
  from: Square;
  to: Square;
  fenAfter: string;
};

type FinishedGame = {
  winner: Winner;
  reason: string;
} | null;

const translations: TranslationTable = {
  de: {
    "Total Chaos Chess": "Total-Chaos-Schach",
    "Nothing starts where it should": "Nichts beginnt dort, wo es sollte",
    "Every piece. Any part of the board.": "Jede Figur. Überall auf dem Brett.",
    "Chaos Setup": "Chaos-Aufstellung",
    "The opening book is useless": "Das Eröffnungsbuch ist nutzlos",
    "Chaos seed": "Chaos-Seed",
    "Orthodox matches": "Normale Starttreffer",
    "Pieces accidentally on their normal starting square":
      "Figuren, die zufällig auf ihrem normalen Startfeld stehen",
    "White pieces in Black half": "Weiße Figuren in schwarzer Hälfte",
    "Black pieces in White half": "Schwarze Figuren in weißer Hälfte",
    "New Chaos": "Neues Chaos",
    "Generate another full-board setup":
      "Erzeuge eine neue Ganzbrett-Aufstellung",
    "Every game starts with the normal 32-piece material, but all pieces are scattered across the board.":
      "Jede Partie startet mit den normalen 32 Figuren, aber alle Figuren werden über das gesamte Brett verteilt.",
    "Kings never begin in check and never begin adjacent.":
      "Könige beginnen nie im Schach und nie direkt nebeneinander.",
    "Pawns may begin anywhere except ranks 1 and 8.":
      "Bauern dürfen überall außer auf Reihe 1 und 8 beginnen.",
    "Castling is disabled because Kings and Rooks do not begin in reliable home positions.":
      "Rochade ist deaktiviert, weil Könige und Türme nicht zuverlässig auf ihren Heimatfeldern beginnen.",
    "After setup, normal chess rules apply.":
      "Nach der Aufstellung gelten normale Schachregeln.",
    Rulebook: "Regelbuch",
    "Total Chaos": "Total Chaos",
    "Full-board random setup": "Zufällige Ganzbrett-Aufstellung",
    "Safe Kings": "Sichere Könige",
    "No opening theory": "Keine Eröffnungstheorie",
    "The randomizer rejects positions where either King already begins in check. The chaos starts from move one, not before move one.":
      "Der Zufallsgenerator verwirft Stellungen, in denen ein König bereits im Schach steht. Das Chaos beginnt mit Zug eins, nicht davor.",
    "White wins by checkmate.": "Weiß gewinnt durch Schachmatt.",
    "Black wins by checkmate.": "Schwarz gewinnt durch Schachmatt.",
    "The game ended in a draw.": "Die Partie endete remis.",
  },
  bar: {
    "Total Chaos Chess": "Total-Chaos-Schach",
    "Nothing starts where it should": "Nix fangt do o, wo's sollt",
    "Every piece. Any part of the board.": "Jede Figur. Überall am Brett.",
    "Chaos Setup": "Chaos-Aufstellung",
    "New Chaos": "Neis Chaos",
    Rulebook: "Regelbuch",
  },
  ko: {
    "Total Chaos Chess": "토탈 카오스 체스",
    "Nothing starts where it should":
      "아무 기물도 원래 자리에서 시작하지 않습니다",
    "Every piece. Any part of the board.": "모든 기물. 보드 어디에서든 시작.",
    "Chaos Setup": "카오스 배치",
    "The opening book is useless": "오프닝 이론은 무용지물입니다",
    "Chaos seed": "카오스 시드",
    "Orthodox matches": "정상 시작 위치 일치",
    "Pieces accidentally on their normal starting square":
      "우연히 원래 시작 칸에 놓인 기물 수",
    "White pieces in Black half": "흑 진영에 있는 백 기물",
    "Black pieces in White half": "백 진영에 있는 흑 기물",
    "New Chaos": "새 카오스",
    "Generate another full-board setup":
      "새로운 전체 보드 랜덤 배치를 생성합니다",
    "Every game starts with the normal 32-piece material, but all pieces are scattered across the board.":
      "매 게임은 정상적인 32개 기물로 시작하지만 모든 기물이 보드 전체에 무작위로 흩어집니다.",
    "Kings never begin in check and never begin adjacent.":
      "두 킹은 시작부터 체크 상태가 아니며 서로 인접하지 않습니다.",
    "Pawns may begin anywhere except ranks 1 and 8.":
      "폰은 1랭크와 8랭크를 제외한 어느 칸에서든 시작할 수 있습니다.",
    "Castling is disabled because Kings and Rooks do not begin in reliable home positions.":
      "킹과 룩이 고정된 시작 위치에 있지 않으므로 캐슬링은 비활성화됩니다.",
    "After setup, normal chess rules apply.":
      "배치가 끝난 뒤에는 일반 체스 규칙이 적용됩니다.",
    Rulebook: "규칙서",
    "Total Chaos": "토탈 카오스",
    "Full-board random setup": "전체 보드 랜덤 배치",
    "Safe Kings": "안전한 킹",
    "No opening theory": "오프닝 이론 없음",
    "The randomizer rejects positions where either King already begins in check. The chaos starts from move one, not before move one.":
      "랜덤 생성기는 어느 킹이든 시작부터 체크 상태인 배치를 제외합니다. 혼돈은 첫 수부터 시작하며 첫 수 이전에 승부가 결정되지는 않습니다.",
    "White wins by checkmate.": "백이 체크메이트로 승리합니다.",
    "Black wins by checkmate.": "흑이 체크메이트로 승리합니다.",
    "The game ended in a draw.": "무승부로 종료되었습니다.",
  },
  ru: {
    "Total Chaos Chess": "Шахматы «Полный хаос»",
    "Nothing starts where it should": "Ничто не начинает там, где должно",
    "Every piece. Any part of the board.": "Любая фигура. Любая часть доски.",
    "Chaos Setup": "Хаотическая расстановка",
    "The opening book is useless": "Дебютная теория бесполезна",
    "Chaos seed": "Seed хаоса",
    "Orthodox matches": "Совпадения с обычным стартом",
    "Pieces accidentally on their normal starting square":
      "Фигуры, случайно оказавшиеся на обычном стартовом поле",
    "White pieces in Black half": "Белые фигуры на половине чёрных",
    "Black pieces in White half": "Чёрные фигуры на половине белых",
    "New Chaos": "Новый хаос",
    "Generate another full-board setup":
      "Создать новую случайную расстановку по всей доске",
    "Every game starts with the normal 32-piece material, but all pieces are scattered across the board.":
      "Каждая партия начинается с обычных 32 фигур, но все они разбросаны по всей доске.",
    "Kings never begin in check and never begin adjacent.":
      "Короли никогда не начинают под шахом и рядом друг с другом.",
    "Pawns may begin anywhere except ranks 1 and 8.":
      "Пешки могут начинать где угодно, кроме 1-й и 8-й горизонталей.",
    "Castling is disabled because Kings and Rooks do not begin in reliable home positions.":
      "Рокировка отключена, потому что короли и ладьи не имеют стабильных домашних позиций.",
    "After setup, normal chess rules apply.":
      "После расстановки действуют обычные шахматные правила.",
    Rulebook: "Правила",
    "Total Chaos": "Полный хаос",
    "Full-board random setup": "Случайная расстановка по всей доске",
    "Safe Kings": "Безопасные короли",
    "No opening theory": "Без дебютной теории",
    "The randomizer rejects positions where either King already begins in check. The chaos starts from move one, not before move one.":
      "Генератор отбрасывает позиции, где любой король уже находится под шахом. Хаос начинается с первого хода, а не до него.",
    "White wins by checkmate.": "Белые выигрывают матом.",
    "Black wins by checkmate.": "Чёрные выигрывают матом.",
    "The game ended in a draw.": "Партия завершилась вничью.",
  },
};

function getCheckedKingSquare(chess: Chess): Square | null {
  if (!chess.isCheck()) {
    return null;
  }

  const color = chess.turn();
  const files = "abcdefgh";

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const piece = chess.board()[row][column];

      if (piece?.type === "k" && piece.color === color) {
        return `${files[column]}${8 - row}` as Square;
      }
    }
  }

  return null;
}

function repetitionKey(fen: string) {
  return fen.split(" ").slice(0, 4).join(" ");
}

function hasThreefoldRepetition(startFen: string, records: MoveRecord[]) {
  const counts = new Map<string, number>();

  const positions = [
    repetitionKey(startFen),
    ...records.map((record) => repetitionKey(record.fenAfter)),
  ];

  for (const position of positions) {
    const count = (counts.get(position) ?? 0) + 1;

    counts.set(position, count);

    if (count >= 3) {
      return true;
    }
  }

  return false;
}

function getFinishedGame(
  game: Chess,
  startFen: string,
  records: MoveRecord[],
): FinishedGame {
  if (game.isCheckmate()) {
    return {
      winner: game.turn() === "w" ? "black" : "white",
      reason: "checkmate",
    };
  }

  if (
    game.isStalemate() ||
    game.isInsufficientMaterial() ||
    game.isDrawByFiftyMoves() ||
    hasThreefoldRepetition(startFen, records)
  ) {
    return {
      winner: "draw",
      reason: "draw",
    };
  }

  return null;
}

type VariantAiBoardProps = {
  aiMode?: boolean;
  playerColor?: ChessPlayerColor;
  difficulty?: Difficulty;
  onChangeSettings?: () => void;
};

export default function TotalChaosChess({
  aiMode = false,
  playerColor = "white",
  difficulty = "casual",
}: VariantAiBoardProps) {
  useUiLanguage();
  const { language } = useChessLanguage();

  const t = (key: string) => translateChess(language, key, translations);

  const [startPosition, setStartPosition] = useState<TotalChaosPosition>(() =>
    createTotalChaosPosition(),
  );

  const [game, setGame] = useState(
    () =>
      new Chess(startPosition.fen, {
        skipValidation: true,
      }),
  );

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const [lastMove, setLastMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [records, setRecords] = useState<MoveRecord[]>([]);

  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );

  const [finishedGame, setFinishedGame] = useState<FinishedGame>(null);

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
      finishedGame ||
      historyPreviewPly !== null ||
      pendingPromotion ||
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
    game,
    records.length,
    finishedGame,
    historyPreviewPly,
    pendingPromotion,
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
    () =>
      historyPreview
        ? new Chess(historyPreview.fenAfter, {
            skipValidation: true,
          })
        : null,
    [historyPreview?.fenAfter],
  );

  const displayedChess = historyPreviewChess ?? game;

  const boardOrientation: "white" | "black" = historyPreviewChess
    ? historyPreviewChess.turn() === "w"
      ? "white"
      : "black"
    : liveBoardOrientation;

  const zoneStats = useMemo(
    () =>
      countPiecesByZone(
        new Chess(startPosition.fen, {
          skipValidation: true,
        }),
      ),
    [startPosition.fen],
  );

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  function commitMove(
    from: Square,
    to: Square,
    promotion?: "q" | "r" | "b" | "n",
  ) {
    if (finishedGame || historyPreview || flipPending) {
      return;
    }

    const nextGame = new Chess(game.fen(), {
      skipValidation: true,
    });

    let move;

    try {
      move = nextGame.move({
        from,
        to,
        promotion,
      });
    } catch {
      clearSelection();
      return;
    }

    if (!move) {
      clearSelection();
      return;
    }

    const nextPly = records.length + 1;

    const record: MoveRecord = {
      ply: nextPly,
      moveNumber: Math.ceil(nextPly / 2),
      color: move.color,
      san: move.san,
      from: move.from,
      to: move.to,
      fenAfter: nextGame.fen(),
    };

    const nextRecords = [...records, record];

    setGame(nextGame);
    setRecords(nextRecords);
    setLastMove({
      from: move.from,
      to: move.to,
    });
    setPendingPromotion(null);
    setHistoryPreviewPly(null);
    setFinishedGame(getFinishedGame(nextGame, startPosition.fen, nextRecords));

    clearSelection();

    if (move.captured) {
      playPieceCaptureSound(move.piece);
    } else {
      playPieceMoveSound(move.piece);
    }
  }

  function handleSquareClick(row: number, column: number) {
    if (aiMode && game.turn() !== humanColor) return;

    if (finishedGame || historyPreview || flipPending) {
      return;
    }

    const square = getSquareName(row, column);

    if (!selectedSquare) {
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
      setPendingPromotion({
        from: selectedSquare,
        to: square,
      });

      clearSelection();

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
      } else {
        clearSelection();
      }

      return;
    }

    commitMove(selectedSquare, square);
  }

  function undo() {
    if (records.length === 0) {
      return;
    }

    const nextRecords = records.slice(0, -1);

    const targetFen =
      nextRecords[nextRecords.length - 1]?.fenAfter ?? startPosition.fen;

    const restored = new Chess(targetFen, {
      skipValidation: true,
    });

    setGame(restored);
    setRecords(nextRecords);

    const previous = nextRecords[nextRecords.length - 1];

    setLastMove(
      previous
        ? {
            from: previous.from,
            to: previous.to,
          }
        : null,
    );

    setFinishedGame(null);
    setPendingPromotion(null);
    setHistoryPreviewPly(null);

    clearSelection();
    snapToSide(restored.turn());
  }

  function newChaos() {
    const nextPosition = createTotalChaosPosition();

    const nextGame = new Chess(nextPosition.fen, {
      skipValidation: true,
    });

    setStartPosition(nextPosition);
    setGame(nextGame);
    setRecords([]);
    setLastMove(null);
    setFinishedGame(null);
    setPendingPromotion(null);
    setHistoryPreviewPly(null);

    clearSelection();
    snapToSide("w");
  }


  return (
    <div className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1460px]">
        <ChessPageHeader className="mb-6 rounded-3xl border border-pink-400/10 bg-zinc-900/70 px-5 py-4 shadow-xl shadow-black/20" description={<> {t("Every piece. Any part of the board.")} </>}>
<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-pink-300">
                {t("Chess Variant")}
              </p>

              <h1 className="mt-1 text-2xl font-black text-white">
                {t("Total Chaos Chess")}
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                {t("Every piece. Any part of the board.")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!finishedGame && (
                <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-300">
                  {game.turn() === "w" ? t("White to move") : t("Black to move")}
                </span>
              )}
            </div>
          </div>

        </ChessPageHeader>

        <main className="grid gap-6 chess-game-grid xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel
                title={t("Game Controls")}
                subtitle={t("Players and actions")}
              >
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={undo}
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
                    onClick={newChaos}
                    className="rounded-xl border border-pink-300/20 bg-pink-400/10 px-3 py-2.5 text-xs font-black text-pink-200 transition hover:bg-pink-400/20"
                  >
                    🌀 {t("New Chaos")}
                  </button>
                </div>

                <p className="mt-2 text-[10px] leading-4 text-zinc-600">
                  {t("Generate another full-board setup")}
                </p>

              </Panel>

              <Panel
                title={t("Chaos Setup")}
                subtitle={t("The opening book is useless")}
              >
                <InfoRow
                  label={t("Chaos seed")}
                  value={String(startPosition.seed)}
                />

                <InfoRow
                  label={t("Orthodox matches")}
                  value={String(startPosition.orthodoxMatches)}
                />

                <p className="mt-2 text-[10px] leading-4 text-zinc-600">
                  {t("Pieces accidentally on their normal starting square")}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MiniStat
                    label={t("White pieces in Black half")}
                    value={zoneStats.whiteInEnemyHalf}
                  />

                  <MiniStat
                    label={t("Black pieces in White half")}
                    value={zoneStats.blackInEnemyHalf}
                  />
                </div>
              </Panel>

              <Panel
                title={t("Move History")}
                subtitle={`${records.length} plies`}
              >
                <ChessMoveHistoryList
                  listClassName="max-h-80 rounded-xl border border-white/5 bg-black/20"
                  selectedPly={historyPreviewPly}
                  emptyLabel={t("No moves yet")}
                  entries={records.map((record) => ({
                    ply: record.ply,
                    side: record.color,
                    moveNumber: record.moveNumber,
                    content: <span className="truncate text-xs font-black text-zinc-200">{record.san}</span>,
                  }))}
                  onSelect={(ply) => {
                    setHistoryPreviewPly(ply);
                    clearSelection();
                  }}
                />
              </Panel>
            </div>
          </aside>

          <section className="mx-auto w-full max-w-[820px] min-w-0">
            {historyPreview && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-pink-400/20 bg-pink-400/[0.07] px-4 py-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-pink-300">
                    {t("History Preview")}
                  </p>

                  <p className="mt-1 text-sm font-bold text-white">
                    {historyPreview.moveNumber}
                    {historyPreview.color === "w" ? "." : "..."}{" "}
                    {historyPreview.san}
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

            {pendingPromotion && !historyPreview && (
              <div className="mb-3">
                <PromotionBar
                  onPromote={(piece) =>
                    commitMove(
                      pendingPromotion.from,
                      pendingPromotion.to,
                      piece as PromotionPiece,
                    )
                  }
                />
              </div>
            )}

            {finishedGame && !historyPreview && (
              <VisibleGameResult
                actions={
                  <button
                    type="button"
                    onClick={newChaos}
                    className="mt-5 rounded-xl bg-pink-300 px-4 py-2.5 text-sm font-black text-zinc-950"
                  >
                    🌀 {t("New Chaos")}
                  </button>
                }
              />
            )}

            <div className="relative">
              <Board
                board={displayedChess.board()}
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
                checkedKingSquare={getCheckedKingSquare(displayedChess)}
                onSquareClick={
                  historyPreview || flipPending ? () => {} : handleSquareClick
                }
                orientation={boardOrientation}
              />
            </div>
          </section>

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel
                title={t("Total Chaos")}
                subtitle={t("Full-board random setup")}
              >
                <div className="grid gap-2">
                  <RuleLine
                    icon="32"
                    text={t(
                      "Every game starts with the normal 32-piece material, but all pieces are scattered across the board.",
                    )}
                  />

                  <RuleLine
                    icon="♔"
                    text={t(
                      "Kings never begin in check and never begin adjacent.",
                    )}
                  />

                  <RuleLine
                    icon="♙"
                    text={t("Pawns may begin anywhere except ranks 1 and 8.")}
                  />

                  <RuleLine
                    icon="♖"
                    text={t(
                      "Castling is disabled because Kings and Rooks do not begin in reliable home positions.",
                    )}
                  />

                  <RuleLine
                    icon="✓"
                    text={t("After setup, normal chess rules apply.")}
                  />
                </div>

                <Link
                  to="/games/chess/variants/complete-chaos/rules"
                  className="mt-4 flex w-full items-center justify-center rounded-xl border border-pink-300/20 bg-pink-400/10 px-3 py-2.5 text-xs font-black text-pink-200 transition hover:bg-pink-400/20"
                >
                  📖 {t("Rulebook")}
                </Link>
              </Panel>

              <Panel title={t("Safe Kings")} subtitle={t("No opening theory")}>
                <p className="text-xs leading-6 text-zinc-500">
                  {t(
                    "The randomizer rejects positions where either King already begins in check. The chaos starts from move one, not before move one.",
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
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  useUiLanguage();
  return (
    <section className="rounded-3xl border border-white/5 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
      <h2 className="font-black text-zinc-100">{ui(title)}</h2>

      <p className="mt-1 mb-4 text-xs text-zinc-600">{ui(subtitle)}</p>

      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  useUiLanguage();
  return (
    <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 last:mb-0">
      <span className="text-[10px] font-bold text-zinc-600">{ui(label)}</span>

      <span className="max-w-[52%] truncate font-mono text-xs font-black text-pink-200">
        {value}
      </span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  useUiLanguage();
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3 text-center">
      <div className="text-2xl font-black text-pink-200">{value}</div>

      <div className="mt-1 text-[9px] font-bold leading-4 text-zinc-600">
        {ui(label)}
      </div>
    </div>
  );
}

function RuleLine({ icon, text }: { icon: string; text: string }) {
  useUiLanguage();
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-xs leading-5 text-zinc-400">
      <span className="flex min-w-7 justify-center font-black text-pink-300">
        {icon}
      </span>

      <span>{ui(text)}</span>
    </div>
  );
}
