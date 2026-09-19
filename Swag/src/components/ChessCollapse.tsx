import { useRef, useEffect, useMemo, useState } from "react";
import {
  LanguageSelector,
  translateChess,
  useChessLanguage,
  type TranslationTable,
} from "../games/chess/i18n/chessLanguage";

import { Chess, type Square } from "chess.js";

import Board from "./Board.tsx";
import PromotionBar from "./PromotionBar";

import { getSquareName, type PieceType } from "../utils/chessUtils";

import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
} from "../utils/sound.ts";

import { useDelayedBoardOrientation } from "@/hooks/useDelayedBoardOrientation.ts";

import {
  COLLAPSE_KING_MAX_LIVES,
  COLLAPSE_MAX_DELAY_MOVES,
  COLLAPSE_MIN_DELAY_MOVES,
  COLLAPSE_WARNING_MOVES,
  advanceCollapseAfterMove,
  cloneCollapseLives,
  cloneCollapseState,
  collapseCoreReached,
  collapseEdgeLabel,
  createInitialCollapseLives,
  createInitialCollapseState,
  filterMovesForCollapse,
  findCollapseKingSquare,
  getCollapseChessOutcome,
  isSquareInsideCollapseBounds,
  isThreefoldCollapse,
  type CollapseDestroyedPiece,
  type CollapseKingLives,
  type CollapseKingRelocation,
  type CollapseOutcome,
  type CollapseSide,
  type CollapseState,
} from "../games/chess/variants/chessCollapse";
import BoardAnimationToggle from "./BoardAnimationToggle.tsx";
import { useVariantChessAi } from "@/hooks/useVariantChessAi";
import {
  chessColorFromPlayerColor,
  oppositeChessColor,
  type Difficulty,
  type ChessPlayerColor,
} from "../games/chess/ai/variantAi";

const translations: Partial<TranslationTable> = {
  de: {
    "Chess Collapse": "Schach Collapse",
    Collapse: "Collapse",
    "Central core reached": "Zentraler Kern erreicht",
    "Next warning in": "Nächste Warnung in",
    "collapses in": "stürzt ein in",
    "Left file": "Linke Linie",
    "Right file": "Rechte Linie",
    "Bottom rank": "Untere Reihe",
    "Top rank": "Obere Reihe",
    "King Lives": "Königsleben",
    "Collapse damage only": "Nur Collapse-Schaden",
    "Collapse Status": "Collapse-Status",
    "The battlefield is closing in": "Das Schlachtfeld wird kleiner",
    "Core reached": "Kern erreicht",
    "No more squares will collapse.": "Keine weiteren Felder stürzen ein.",
    "Collapse warning": "Collapse-Warnung",
    "Pieces may stay and gamble. Kings lose one life if caught.":
      "Figuren dürfen bleiben und riskieren alles. Getroffene Könige verlieren ein Leben.",
    "completed moves": "abgeschlossene Züge",
    "Each interval is seeded randomly from 5–9 moves.":
      "Jedes Intervall wird zufällig auf 5–9 Züge gesetzt.",
    "Collapse Stats": "Collapse-Statistik",
    "Damage from this match": "Schaden aus dieser Partie",
    Collapses: "Einstürze",
    "Pieces lost": "Verlorene Figuren",
    "White hits": "Treffer Weiß",
    "Black hits": "Treffer Schwarz",
    plies: "Halbzüge",
    "Each king starts with 3 collapse lives.":
      "Jeder König startet mit 3 Collapse-Leben.",
    "Checkmate always ends the game immediately, even with lives remaining.":
      "Schachmatt beendet die Partie sofort, auch mit verbleibenden Leben.",
    "A selected outer edge cracks for 4 completed moves before disappearing.":
      "Ein ausgewählter Außenrand bricht 4 abgeschlossene Züge lang auf, bevor er verschwindet.",
    "Any normal piece still on the collapsing edge is destroyed.":
      "Jede normale Figur auf dem einstürzenden Rand wird zerstört.",
    "A king caught by a collapse loses one life and may escape only one square into the surviving board. If no adjacent legal escape exists, the game ends immediately.":
      "Ein getroffener König verliert ein Leben und darf nur ein Feld ins verbleibende Brett fliehen. Gibt es kein legales Nachbarfeld, endet die Partie sofort.",
    "Collapsed squares are dead and can never be entered again.":
      "Eingestürzte Felder sind dauerhaft tot und können nicht mehr betreten werden.",
    "Collapse selection favors lightly occupied edges, preventing an opening back-rank wipeout. The board stops shrinking at the central c3–f6 core.":
      "Die Auswahl bevorzugt schwach belegte Ränder und verhindert so einen frühen Grundreihen-Kollaps. Bei c3–f6 stoppt das Schrumpfen.",
    "King hit!": "König getroffen!",
    "Both kings lost their final life. Draw.":
      "Beide Könige verloren ihr letztes Leben. Remis.",
    "The game ended in a draw.": "Die Partie endete remis.",
    "White wins by checkmate.": "Weiß gewinnt durch Schachmatt.",
    "Black wins by checkmate.": "Schwarz gewinnt durch Schachmatt.",
    "White king was trapped in the collapsing danger zone with no legal escape! Black wins.":
      "Der weiße König war ohne Flucht in der Collapse-Zone gefangen! Schwarz gewinnt.",
    "Black king was trapped in the collapsing danger zone with no legal escape! White wins.":
      "Der schwarze König war ohne Flucht in der Collapse-Zone gefangen! Weiß gewinnt.",
    "White king has no lives left! Black wins.":
      "Der weiße König hat keine Leben mehr! Schwarz gewinnt.",
    "Black king has no lives left! White wins.":
      "Der schwarze König hat keine Leben mehr! Weiß gewinnt.",
  },
  bar: {
    "Chess Collapse": "Schach Collapse",
    "King Lives": "Kini-Lebn",
    "Collapse Status": "Collapse-Status",
    "Next warning in": "Nächste Warnung in",
    "King hit!": "Kini troffa!",
    plies: "Halbzüg",
  },
  ko: {
    "Chess Collapse": "체스 콜랩스",
    Collapse: "붕괴",
    "Central core reached": "중앙 코어 도달",
    "Next warning in": "다음 경고까지",
    "collapses in": "붕괴까지",
    "Left file": "왼쪽 파일",
    "Right file": "오른쪽 파일",
    "Bottom rank": "아래 랭크",
    "Top rank": "위 랭크",
    "King Lives": "킹 목숨",
    "Collapse damage only": "붕괴 피해에만 적용",
    "Collapse Status": "붕괴 상태",
    "The battlefield is closing in": "전장이 점점 좁아집니다",
    "Core reached": "코어 도달",
    "No more squares will collapse.": "더 이상 칸이 붕괴하지 않습니다.",
    "Collapse warning": "붕괴 경고",
    "Pieces may stay and gamble. Kings lose one life if caught.":
      "기물은 남아 위험을 감수할 수 있습니다. 킹이 맞으면 목숨 1개를 잃습니다.",
    "completed moves": "완료 수",
    "Each interval is seeded randomly from 5–9 moves.":
      "각 간격은 5~9수 사이로 랜덤 설정됩니다.",
    "Collapse Stats": "붕괴 통계",
    "Damage from this match": "이번 게임 붕괴 피해",
    Collapses: "붕괴 횟수",
    "Pieces lost": "파괴 기물",
    "White hits": "백 피격",
    "Black hits": "흑 피격",
    plies: "하프무브",
    "Each king starts with 3 collapse lives.":
      "각 킹은 붕괴 목숨 3개로 시작합니다.",
    "Checkmate always ends the game immediately, even with lives remaining.":
      "목숨이 남아 있어도 체크메이트는 즉시 게임을 끝냅니다.",
    "A selected outer edge cracks for 4 completed moves before disappearing.":
      "선택된 외곽은 사라지기 전 4완료 수 동안 균열 경고가 표시됩니다.",
    "Any normal piece still on the collapsing edge is destroyed.":
      "붕괴 가장자리에 남은 일반 기물은 파괴됩니다.",
    "A king caught by a collapse loses one life and may escape only one square into the surviving board. If no adjacent legal escape exists, the game ends immediately.":
      "붕괴에 맞은 킹은 목숨 1개를 잃고 생존 보드의 인접 한 칸으로만 탈출할 수 있습니다. 합법 탈출 칸이 없으면 즉시 게임 종료입니다.",
    "Collapsed squares are dead and can never be entered again.":
      "붕괴된 칸은 영구적으로 사용할 수 없습니다.",
    "Collapse selection favors lightly occupied edges, preventing an opening back-rank wipeout. The board stops shrinking at the central c3–f6 core.":
      "붕괴 선택은 기물이 적은 가장자리를 우선해 초반 백랭크 전멸을 막고 중앙 c3–f6에서 멈춥니다.",
    "King hit!": "킹 피격!",
    "Both kings lost their final life. Draw.":
      "두 킹이 동시에 마지막 목숨을 잃었습니다. 무승부.",
    "The game ended in a draw.": "게임은 무승부로 끝났습니다.",
    "White wins by checkmate.": "백이 체크메이트로 승리합니다.",
    "Black wins by checkmate.": "흑이 체크메이트로 승리합니다.",
    "White king was trapped in the collapsing danger zone with no legal escape! Black wins.":
      "백 킹이 붕괴 위험 구역에 갇혀 합법 탈출이 없습니다! 흑 승리.",
    "Black king was trapped in the collapsing danger zone with no legal escape! White wins.":
      "흑 킹이 붕괴 위험 구역에 갇혀 합법 탈출이 없습니다! 백 승리.",
    "White king has no lives left! Black wins.":
      "백 킹의 목숨이 없습니다! 흑 승리.",
    "Black king has no lives left! White wins.":
      "흑 킹의 목숨이 없습니다! 백 승리.",
  },
  ru: {
    "Chess Collapse": "Обрушающиеся шахматы",
    Collapse: "Обрушение",
    "Central core reached": "Центральное ядро достигнуто",
    "Next warning in": "Следующее предупреждение через",
    "collapses in": "обрушится через",
    "Left file": "Левая вертикаль",
    "Right file": "Правая вертикаль",
    "Bottom rank": "Нижний ряд",
    "Top rank": "Верхний ряд",
    "King Lives": "Жизни короля",
    "Collapse damage only": "Только урон обрушения",
    "Collapse Status": "Статус обрушения",
    "The battlefield is closing in": "Поле боя сужается",
    "Core reached": "Ядро достигнуто",
    "No more squares will collapse.": "Больше поля не будут обрушаться.",
    "Collapse warning": "Предупреждение об обрушении",
    "Pieces may stay and gamble. Kings lose one life if caught.":
      "Фигуры могут остаться и рискнуть. Король теряет жизнь при попадании.",
    "completed moves": "завершённых ходов",
    "Each interval is seeded randomly from 5–9 moves.":
      "Каждый интервал случайно равен 5–9 ходам.",
    "Collapse Stats": "Статистика обрушения",
    "Damage from this match": "Урон в этой партии",
    Collapses: "Обрушения",
    "Pieces lost": "Потеряно фигур",
    "White hits": "Удары по белым",
    "Black hits": "Удары по чёрным",
    plies: "полуходов",
    "Each king starts with 3 collapse lives.":
      "У каждого короля 3 жизни от обрушения.",
    "Checkmate always ends the game immediately, even with lives remaining.":
      "Мат всегда завершает игру сразу, даже при оставшихся жизнях.",
    "A selected outer edge cracks for 4 completed moves before disappearing.":
      "Выбранный внешний край предупреждается 4 завершённых хода до исчезновения.",
    "Any normal piece still on the collapsing edge is destroyed.":
      "Любая обычная фигура на рушащемся краю уничтожается.",
    "A king caught by a collapse loses one life and may escape only one square into the surviving board. If no adjacent legal escape exists, the game ends immediately.":
      "Король теряет жизнь и может уйти только на соседнее выжившее поле. Если легального соседнего выхода нет, игра заканчивается сразу.",
    "Collapsed squares are dead and can never be entered again.":
      "Обрушенные поля навсегда недоступны.",
    "Collapse selection favors lightly occupied edges, preventing an opening back-rank wipeout. The board stops shrinking at the central c3–f6 core.":
      "Выбор предпочитает менее занятые края, предотвращая уничтожение заднего ряда в начале. Сужение останавливается на c3–f6.",
    "King hit!": "Король задет!",
    "Both kings lost their final life. Draw.":
      "Оба короля потеряли последнюю жизнь. Ничья.",
    "The game ended in a draw.": "Партия закончилась ничьей.",
    "White wins by checkmate.": "Белые выигрывают матом.",
    "Black wins by checkmate.": "Чёрные выигрывают матом.",
    "White king was trapped in the collapsing danger zone with no legal escape! Black wins.":
      "Белый король заперт в зоне обрушения без выхода! Победа чёрных.",
    "Black king was trapped in the collapsing danger zone with no legal escape! White wins.":
      "Чёрный король заперт в зоне обрушения без выхода! Победа белых.",
    "White king has no lives left! Black wins.":
      "У белого короля не осталось жизней! Победа чёрных.",
    "Black king has no lives left! White wins.":
      "У чёрного короля не осталось жизней! Победа белых.",
  },
};

type PromotionPiece = "q" | "r" | "b" | "n";

type PendingPromotion = {
  from: Square;
  to: Square;
};

type FinishedGame = {
  outcome: Exclude<CollapseOutcome, null>;
  reason: "lives" | "trapped" | "checkmate" | "draw";
} | null;

type CollapseHistoryEntry = {
  ply: number;
  moveNumber: number;
  color: CollapseSide;
  san: string;
  piece: PieceType;
  from: Square;
  to: Square;
  fenAfter: string;
  collapseAfter: CollapseState;
  livesAfter: CollapseKingLives;
  kingHits: CollapseSide[];
  trappedKings: CollapseSide[];
  relocatedKings: CollapseKingRelocation[];
  destroyedPieces: CollapseDestroyedPiece[];
};

type UndoSnapshot = {
  fen: string;
  collapse: CollapseState;
  lives: CollapseKingLives;
  lastMove: { from: Square; to: Square } | null;
  capturedWhite: PieceType[];
  capturedBlack: PieceType[];
  history: CollapseHistoryEntry[];
  finishedGame: FinishedGame;
};

const pieceValues: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function hearts(lives: number): string {
  return `${"♥".repeat(Math.max(0, lives))}${"♡".repeat(
    Math.max(0, COLLAPSE_KING_MAX_LIVES - lives),
  )}`;
}

function resultText(
  result: FinishedGame,
  lives: CollapseKingLives,
  t: (key: string) => string,
): string {
  if (!result) return "";
  if (result.outcome === "draw") {
    return result.reason === "lives"
      ? t("Both kings lost their final life. Draw.")
      : t("The game ended in a draw.");
  }
  if (result.reason === "checkmate") {
    return result.outcome === "white"
      ? t("White wins by checkmate.")
      : t("Black wins by checkmate.");
  }
  if (result.reason === "trapped") {
    return result.outcome === "white"
      ? t(
          "Black king was trapped in the collapsing danger zone with no legal escape! White wins.",
        )
      : t(
          "White king was trapped in the collapsing danger zone with no legal escape! Black wins.",
        );
  }
  const loserLives = result.outcome === "white" ? lives.b : lives.w;
  if (loserLives <= 0) {
    return result.outcome === "white"
      ? t("Black king has no lives left! White wins.")
      : t("White king has no lives left! Black wins.");
  }
  return result.outcome === "white" ? t("White wins") : t("Black wins");
}

function getHistoryPieceSymbol(color: CollapseSide, piece: PieceType) {
  const symbols: Record<CollapseSide, Record<PieceType, string>> = {
    w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
    b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
  };

  return symbols[color][piece];
}

function getBoardMaterialDifference(game: Chess, collapse: CollapseState) {
  let white = 0;
  let black = 0;

  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;

      const square = piece.square as Square;
      if (!isSquareInsideCollapseBounds(square, collapse.bounds)) continue;

      const value = pieceValues[piece.type as PieceType];
      if (piece.color === "w") white += value;
      else black += value;
    }
  }

  return white - black;
}

function collapseStatusText(
  state: CollapseState,
  t: (key: string) => string,
): string {
  if (collapseCoreReached(state.bounds)) return t("Central core reached");
  if (state.warningEdge)
    return `${t(collapseEdgeLabel(state.warningEdge))} ${t("collapses in")} ${state.warningMovesRemaining}`;
  return `${t("Next warning in")} ${state.movesUntilWarning}`;
}

type VariantAiBoardProps = {
  aiMode?: boolean;
  playerColor?: ChessPlayerColor;
  difficulty?: Difficulty;
  onChangeSettings?: () => void;
};

export default function ChessCollapseBoard({
  aiMode = false,
  playerColor = "white",
  difficulty = "casual",
}: VariantAiBoardProps) {
  const { language, setLanguage } = useChessLanguage();
  const t = (key: string) => translateChess(language, key, translations);
  const initialFen = useMemo(() => new Chess().fen(), []);

  const [game, setGame] = useState(() => new Chess());

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const [lastMove, setLastMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);

  const [finishedGame, setFinishedGame] = useState<FinishedGame>(null);

  const [whitePlayer, setWhitePlayer] = useState("");
  const [blackPlayer, setBlackPlayer] = useState("");

  const [collapse, setCollapse] = useState<CollapseState>(() =>
    createInitialCollapseState(),
  );

  const [kingLives, setKingLives] = useState<CollapseKingLives>(() =>
    createInitialCollapseLives(),
  );

  const [history, setHistory] = useState<CollapseHistoryEntry[]>([]);
  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  const [capturedWhite, setCapturedWhite] = useState<PieceType[]>([]);
  const [capturedBlack, setCapturedBlack] = useState<PieceType[]>([]);

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

    const allowedMoves = game
      .moves({ verbose: true })
      .filter((move) =>
        isSquareInsideCollapseBounds(move.to as Square, collapse.bounds),
      )
      .map((move) => `${move.from}${move.to}${move.promotion ?? ""}`);

    if (allowedMoves.length === 0) {
      return;
    }

    let cancelled = false;
    aiMovePendingRef.current = true;

    const timer = window.setTimeout(async () => {
      try {
        const move = await chooseAiMove(game, allowedMoves);

        if (
          cancelled ||
          !move ||
          game.fen() !== expectedFen ||
          game.turn() !== computerColor
        ) {
          return;
        }

        makeMove(move.from, move.to, move.promotion);
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
    history.length,
    collapse,
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
      ? (history[historyPreviewPly - 1] ?? null)
      : null;

  const historyPreviewChess = useMemo(
    () => (historyPreview ? new Chess(historyPreview.fenAfter) : null),
    [historyPreview?.fenAfter],
  );

  const displayedGame = historyPreviewChess ?? game;
  const displayedCollapse = historyPreview
    ? historyPreview.collapseAfter
    : collapse;
  const displayedLives = historyPreview ? historyPreview.livesAfter : kingLives;
  const displayedBoard = displayedGame.board();

  const boardOrientation: "white" | "black" = historyPreviewChess
    ? historyPreviewChess.turn() === "w"
      ? "white"
      : "black"
    : liveBoardOrientation;

  const displayedLastMove = historyPreview
    ? { from: historyPreview.from, to: historyPreview.to }
    : lastMove;

  const displayedLastEvent =
    historyPreview ?? history[history.length - 1] ?? null;

  const checkedKingSquare = useMemo(() => {
    if (!displayedGame.isCheck()) return null;

    return findCollapseKingSquare(displayedGame, displayedGame.turn());
  }, [displayedGame]);

  const materialDifference = getBoardMaterialDifference(
    displayedGame,
    displayedCollapse,
  );

  const collapseDestroyedCount = history.reduce(
    (total, entry) => total + entry.destroyedPieces.length,
    0,
  );

  const whiteCollapseHits = history.reduce(
    (total, entry) =>
      total + entry.kingHits.filter((color) => color === "w").length,
    0,
  );

  const blackCollapseHits = history.reduce(
    (total, entry) =>
      total + entry.kingHits.filter((color) => color === "b").length,
    0,
  );

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  function selectPiece(square: Square) {
    if (historyPreview || finishedGame || pendingPromotion || flipPending)
      return;
    if (!isSquareInsideCollapseBounds(square, collapse.bounds)) return;

    const piece = game.get(square);

    if (!piece || piece.color !== game.turn()) {
      clearSelection();
      return;
    }

    const moves = filterMovesForCollapse(
      game.moves({ square, verbose: true }).map((move) => ({
        to: move.to as Square,
      })),
      collapse.bounds,
    );

    setSelectedSquare(square);
    setLegalMoves(moves.map((move) => move.to));
    playPieceSelectSound(piece.type);
  }

  function snapshotCurrentState(): UndoSnapshot {
    return {
      fen: game.fen(),
      collapse: cloneCollapseState(collapse),
      lives: cloneCollapseLives(kingLives),
      lastMove,
      capturedWhite: [...capturedWhite],
      capturedBlack: [...capturedBlack],
      history: [...history],
      finishedGame,
    };
  }

  function getNormalFinish(
    candidateGame: Chess,
    candidateCollapse: CollapseState,
    previousHistory: CollapseHistoryEntry[],
  ): FinishedGame {
    const outcome = getCollapseChessOutcome(
      candidateGame,
      candidateCollapse.bounds,
    );

    if (outcome) {
      return {
        outcome,
        reason: outcome === "draw" ? "draw" : "checkmate",
      };
    }

    const previousFens = [
      initialFen,
      ...previousHistory.map((entry) => entry.fenAfter),
    ];

    if (isThreefoldCollapse(previousFens, candidateGame.fen())) {
      return {
        outcome: "draw",
        reason: "draw",
      };
    }

    return null;
  }

  function makeMove(
    from: Square,
    to: Square,
    promotion?: PromotionPiece,
  ): boolean {
    if (finishedGame || historyPreview) return false;
    if (!isSquareInsideCollapseBounds(to, collapse.bounds)) return false;

    const nextGame = new Chess(game.fen());

    let move;

    try {
      move = nextGame.move({
        from,
        to,
        ...(promotion ? { promotion } : {}),
      });
    } catch {
      return false;
    }

    if (!move) return false;

    const beforeMove = snapshotCurrentState();
    const nextPly = history.length + 1;

    let nextCollapse = cloneCollapseState(collapse);
    let nextLives = cloneCollapseLives(kingLives);
    let kingHits: CollapseSide[] = [];
    let trappedKings: CollapseSide[] = [];
    let relocatedKings: CollapseKingRelocation[] = [];
    let destroyedPieces: CollapseDestroyedPiece[] = [];

    /*
     * Checkmate / normal draw ends immediately. A collapse does not get
     * to rescue a side from a checkmate that has already been delivered.
     */
    let finish = getNormalFinish(nextGame, nextCollapse, history);

    if (!finish) {
      const collapseResult = advanceCollapseAfterMove(
        nextGame,
        nextCollapse,
        nextLives,
        nextPly,
      );

      nextCollapse = collapseResult.state;
      nextLives = collapseResult.lives;
      kingHits = collapseResult.kingHits;
      trappedKings = collapseResult.trappedKings;
      relocatedKings = collapseResult.relocatedKings;
      destroyedPieces = collapseResult.destroyedPieces;

      if (collapseResult.outcome) {
        finish = {
          outcome: collapseResult.outcome,
          reason: collapseResult.trappedKings.length > 0 ? "trapped" : "lives",
        };
      } else {
        finish = getNormalFinish(nextGame, nextCollapse, history);
      }
    }

    let nextCapturedWhite = [...capturedWhite];
    let nextCapturedBlack = [...capturedBlack];

    if (move.captured) {
      playPieceCaptureSound(move.piece);

      if (move.color === "w") {
        nextCapturedBlack = [...nextCapturedBlack, move.captured as PieceType];
      } else {
        nextCapturedWhite = [...nextCapturedWhite, move.captured as PieceType];
      }
    } else {
      playPieceMoveSound(move.piece);
    }

    const nextHistoryEntry: CollapseHistoryEntry = {
      ply: nextPly,
      moveNumber: Math.floor((nextPly - 1) / 2) + 1,
      color: move.color as CollapseSide,
      san: move.san,
      piece: move.piece as PieceType,
      from: move.from as Square,
      to: move.to as Square,
      fenAfter: nextGame.fen(),
      collapseAfter: cloneCollapseState(nextCollapse),
      livesAfter: cloneCollapseLives(nextLives),
      kingHits,
      trappedKings,
      relocatedKings,
      destroyedPieces,
    };

    setUndoStack((stack) => [...stack, beforeMove]);
    setGame(nextGame);
    setCollapse(nextCollapse);
    setKingLives(nextLives);
    setLastMove({ from: move.from as Square, to: move.to as Square });
    setCapturedWhite(nextCapturedWhite);
    setCapturedBlack(nextCapturedBlack);
    setHistory((rows) => [...rows, nextHistoryEntry]);
    setPendingPromotion(null);
    clearSelection();

    if (finish) setFinishedGame(finish);

    return true;
  }

  function handleSquareClick(row: number, column: number) {
    if (aiMode && game.turn() !== humanColor) return;

    if (finishedGame || historyPreview || pendingPromotion || flipPending)
      return;

    const square = getSquareName(row, column);

    if (!isSquareInsideCollapseBounds(square, collapse.bounds)) {
      clearSelection();
      return;
    }

    const clickedPiece = game.get(square);

    if (!selectedSquare) {
      selectPiece(square);
      return;
    }

    if (square === selectedSquare) {
      clearSelection();
      return;
    }

    if (clickedPiece?.color === game.turn()) {
      selectPiece(square);
      return;
    }

    if (!legalMoves.includes(square)) {
      clearSelection();
      return;
    }

    const selectedPiece = game.get(selectedSquare);

    const reachesPromotionRank =
      selectedPiece?.type === "p" &&
      ((selectedPiece.color === "w" && square[1] === "8") ||
        (selectedPiece.color === "b" && square[1] === "1"));

    if (reachesPromotionRank) {
      setPendingPromotion({ from: selectedSquare, to: square });
      clearSelection();
      return;
    }

    makeMove(selectedSquare, square);
  }

  function undoMove() {
    const snapshot = undoStack[undoStack.length - 1];
    if (!snapshot) return;
    if (aiMode) return;
    const restoredGame = new Chess(snapshot.fen);

    setGame(restoredGame);
    snapToSide(restoredGame.turn());
    setCollapse(cloneCollapseState(snapshot.collapse));
    setKingLives(cloneCollapseLives(snapshot.lives));
    setLastMove(snapshot.lastMove);
    setCapturedWhite([...snapshot.capturedWhite]);
    setCapturedBlack([...snapshot.capturedBlack]);
    setHistory([...snapshot.history]);
    setFinishedGame(snapshot.finishedGame);
    setUndoStack((stack) => stack.slice(0, -1));
    setHistoryPreviewPly(null);
    setPendingPromotion(null);
    clearSelection();
  }

  function restartGame() {
    const freshGame = new Chess();
    const freshCollapse = createInitialCollapseState();

    setGame(freshGame);
    snapToSide(freshGame.turn());
    setCollapse(freshCollapse);
    setKingLives(createInitialCollapseLives());
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPendingPromotion(null);
    setFinishedGame(null);
    setCapturedWhite([]);
    setCapturedBlack([]);
    setHistory([]);
    setHistoryPreviewPly(null);
    setUndoStack([]);
  }

  return (
    <div
      className="
        min-h-screen
        bg-[radial-gradient(circle_at_top,#24180f_0%,#111111_38%,#080808_100%)]
        px-4
        py-6
        text-zinc-100
        sm:px-6
        lg:px-8
      "
    >
      <div className="mx-auto max-w-[1500px]">
        <header
          className="
            mb-7
            flex
            flex-col
            gap-4
            rounded-3xl
            border
            border-white/5
            bg-zinc-900/50
            px-5
            py-4
            shadow-xl
            shadow-black/20
            backdrop-blur-md
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div className="flex items-center gap-4">
            <div
              className="
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-2xl
                border
                border-red-500/20
                bg-red-400/10
                text-3xl
                shadow-inner
              "
              aria-hidden="true"
            >
              ◫
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-red-400">
                {t("Chess Variant")}
              </p>

              <h1 className="mt-0.5 text-2xl font-black tracking-tight text-white">
                {t("Chess Collapse")}
              </h1>

              <p className="mt-0.5 text-sm text-zinc-500">
                The board shrinks · kings have 3 lives · checkmate still wins
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <LanguageSelector
              language={language}
              onChange={setLanguage}
              label={t("Language")}
            />
            <div className="rounded-full border border-red-400/15 bg-red-400/[0.06] px-3 py-1.5 text-xs font-black text-red-200">
              ♔ {hearts(displayedLives.w)} · ♚ {hearts(displayedLives.b)}
            </div>

            <div
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                displayedCollapse.warningEdge
                  ? "border-orange-400/20 bg-orange-400/[0.07] text-orange-200"
                  : "border-white/10 bg-white/5 text-zinc-300"
              }`}
            >
              {displayedCollapse.warningEdge ? "⚠ " : "⌛ "}
              {collapseStatusText(displayedCollapse, t)}
            </div>

            {!finishedGame && !historyPreview && (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                {game.turn() === "w" ? t("White to move") : t("Black to move")}
              </div>
            )}
          </div>
          <BoardAnimationToggle />
        </header>

        <main className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.55)]" />
                    <h2 className="font-bold text-zinc-100">
                      {t("Game Controls")}
                    </h2>
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-500">
                    {t("Players, game and actions")}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={undoMove}
                      disabled={undoStack.length === 0 || aiMode}
                      className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-xs font-black text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {t("Undo")}
                    </button>

                    <button
                      type="button"
                      onClick={restartGame}
                      className="rounded-xl border border-red-400/15 bg-red-400/[0.07] px-3 py-2.5 text-xs font-black text-red-200 transition hover:bg-red-400/10"
                    >
                      {t("New Game")}
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-100">
                      {t("Captured Pieces")}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Normal captures only")}
                    </p>
                  </div>

                  <span className="rounded-xl bg-white/5 px-2.5 py-1 text-xs font-bold text-zinc-400">
                    {materialDifference > 0 &&
                      `${t("White")} +${materialDifference}`}
                    {materialDifference < 0 &&
                      `${t("Black")} +${Math.abs(materialDifference)}`}
                    {materialDifference === 0 && t("Equal")}
                  </span>
                </div>

                <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                  <CapturedPiecesGrid
                    capturedBlack={capturedBlack}
                    capturedWhite={capturedWhite}
                    t={t}
                  />
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-100">
                      {t("Move History")}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Game history")}
                    </p>
                  </div>

                  <span className="rounded-xl bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-400">
                    {history.length}
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto rounded-2xl border border-white/5 bg-black/20">
                  {history.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-zinc-600">
                      {t("No moves yet")}
                    </div>
                  ) : (
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-10 bg-zinc-900">
                        <tr className="border-b border-white/5 text-left text-[9px] font-black uppercase tracking-wider text-zinc-600">
                          <th className="px-3 py-2">{t("Move")}</th>
                          <th className="px-2 py-2">{t("Side")}</th>
                          <th className="px-2 py-2">{t("Played")}</th>
                        </tr>
                      </thead>

                      <tbody>
                        {history.map((entry) => {
                          const selected = historyPreviewPly === entry.ply;
                          const collapsedOnMove =
                            entry.collapseAfter.lastImpactSquares.length > 0;

                          return (
                            <tr
                              key={entry.ply}
                              tabIndex={0}
                              onClick={() => setHistoryPreviewPly(entry.ply)}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  setHistoryPreviewPly(entry.ply);
                                }
                              }}
                              className={`cursor-pointer border-b border-white/[0.04] transition last:border-b-0 ${
                                selected
                                  ? "bg-red-400/[0.08]"
                                  : "hover:bg-white/[0.04]"
                              }`}
                            >
                              <td className="px-3 py-2.5 text-[10px] font-black text-zinc-500">
                                {entry.moveNumber}
                                {entry.color === "w" ? "." : "..."}
                              </td>
                              <td className="px-2 py-2.5 text-xs text-zinc-500">
                                {entry.color === "w" ? "♔" : "♚"}
                              </td>
                              <td className="px-2 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 text-center text-lg leading-none">
                                    {getHistoryPieceSymbol(
                                      entry.color,
                                      entry.piece,
                                    )}
                                  </span>
                                  <span className="font-mono text-xs font-bold text-zinc-200">
                                    {entry.san}
                                  </span>
                                  {collapsedOnMove && (
                                    <span className="text-xs">💥</span>
                                  )}
                                  {entry.kingHits.length > 0 && (
                                    <span className="text-xs">♥−</span>
                                  )}
                                  {entry.trappedKings.length > 0 && (
                                    <span className="text-xs">☠</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {finishedGame && !historyPreview && (
                <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-400/[0.07] px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-red-400">
                        {t("Game Over")}
                      </p>
                      <p className="mt-1 font-black text-white">
                        {resultText(finishedGame, kingLives, t)}
                      </p>
                    </div>
                    <span className="text-2xl" aria-hidden="true">
                      {finishedGame.reason === "trapped"
                        ? "☠"
                        : finishedGame.reason === "lives"
                          ? "💥"
                          : "♚"}
                    </span>
                  </div>
                </div>
              )}

              {pendingPromotion && !historyPreview && (
                <div className="mb-3 rounded-2xl border border-amber-500/20 bg-zinc-900/90 p-3 shadow-xl">
                  <PromotionBar
                    onPromote={(piece) =>
                      makeMove(
                        pendingPromotion.from,
                        pendingPromotion.to,
                        piece,
                      )
                    }
                  />
                </div>
              )}

              {historyPreview && (
                <div className="mb-3 flex items-center justify-between gap-4 rounded-xl border border-blue-400/20 bg-blue-400/[0.07] px-4 py-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">
                      {t("History Preview")}
                    </p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {t("Move")} {historyPreview.moveNumber}
                      {historyPreview.color === "w" ? "." : "..."}{" "}
                      {historyPreview.san}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold text-zinc-500">
                      ♔ {hearts(historyPreview.livesAfter.w)} · ♚{" "}
                      {hearts(historyPreview.livesAfter.b)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHistoryPreviewPly(null)}
                    className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-zinc-200 transition hover:bg-white/20"
                  >
                    {t("Back to Live Board")}
                  </button>
                </div>
              )}

              {displayedLastEvent && displayedLastEvent.kingHits.length > 0 && (
                <div className="mb-3 rounded-2xl border border-orange-400/20 bg-orange-400/[0.07] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-300">
                    {t("King hit!")}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-black text-white">
                    {displayedLastEvent.kingHits.includes("w") && (
                      <span>
                        ♔ {t("White")} {hearts(displayedLastEvent.livesAfter.w)}
                      </span>
                    )}
                    {displayedLastEvent.kingHits.includes("b") && (
                      <span>
                        ♚ {t("Black")} {hearts(displayedLastEvent.livesAfter.b)}
                      </span>
                    )}
                  </div>

                  {displayedLastEvent.relocatedKings.length > 0 && (
                    <p className="mt-1 text-[10px] text-zinc-500">
                      {displayedLastEvent.relocatedKings
                        .map(
                          (king) =>
                            `${king.color === "w" ? t("White") : t("Black")}: ${king.from} → ${king.to}`,
                        )
                        .join(" · ")}
                    </p>
                  )}
                </div>
              )}

              <Board
                board={displayedBoard}
                selectedSquare={historyPreview ? null : selectedSquare}
                legalMoves={historyPreview ? [] : legalMoves}
                lastMove={displayedLastMove}
                checkedKingSquare={checkedKingSquare}
                onSquareClick={
                  historyPreview || flipPending ? () => {} : handleSquareClick
                }
                collapseWarningSquares={displayedCollapse.warningSquares}
                collapsedSquares={displayedCollapse.collapsedSquares}
                collapseImpactSquares={displayedCollapse.lastImpactSquares}
                orientation={boardOrientation}
              />

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-900/75 px-4 py-3 xl:hidden">
                <span className="text-sm text-zinc-500">{t("Collapse")}</span>
                <span className="text-sm font-bold text-zinc-200">
                  {collapseStatusText(displayedCollapse, t)}
                </span>
              </div>
            </div>
          </section>

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <section className="rounded-3xl border border-red-400/15 bg-zinc-900/80 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-zinc-100">
                      {t("King Lives")}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Collapse damage only")}
                    </p>
                  </div>
                  <span className="text-2xl" aria-hidden="true">
                    ♥
                  </span>
                </div>

                <KingLifeCard
                  symbol="♔"
                  label={whitePlayer || t("White")}
                  lives={displayedLives.w}
                  hits={whiteCollapseHits}
                />
                <div className="h-2" />
                <KingLifeCard
                  symbol="♚"
                  label={blackPlayer || t("Black")}
                  lives={displayedLives.b}
                  hits={blackCollapseHits}
                />
              </section>

              <section
                className={`rounded-3xl border p-4 shadow-xl shadow-black/20 backdrop-blur-md ${
                  displayedCollapse.warningEdge
                    ? "border-orange-400/25 bg-orange-950/25"
                    : "border-white/10 bg-zinc-900/75"
                }`}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-zinc-100">
                      {t("Collapse Status")}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("The battlefield is closing in")}
                    </p>
                  </div>
                  <span className="text-2xl" aria-hidden="true">
                    {displayedCollapse.warningEdge ? "⚠" : "⌛"}
                  </span>
                </div>

                {collapseCoreReached(displayedCollapse.bounds) ? (
                  <div className="rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.05] p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-emerald-300">
                      {t("Core reached")}
                    </p>
                    <p className="mt-2 text-xl font-black text-white">
                      c3 – f6
                    </p>
                    <p className="mt-2 text-[10px] text-zinc-600">
                      {t("No more squares will collapse.")}
                    </p>
                  </div>
                ) : displayedCollapse.warningEdge ? (
                  <div className="rounded-2xl border border-orange-300/20 bg-orange-400/[0.06] p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-orange-300">
                      {t("Collapse warning")}
                    </p>
                    <div className="mt-2 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-lg font-black text-white">
                          {t(collapseEdgeLabel(displayedCollapse.warningEdge))}
                        </p>
                        <p className="mt-1 font-mono text-xs font-bold text-zinc-500">
                          {displayedCollapse.warningSquares.join(" · ")}
                        </p>
                      </div>
                      <span className="text-4xl font-black leading-none text-orange-200">
                        {displayedCollapse.warningMovesRemaining}
                      </span>
                    </div>
                    <p className="mt-3 text-[10px] text-zinc-600">
                      {t(
                        "Pieces may stay and gamble. Kings lose one life if caught.",
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                      {t("Next warning in")}
                    </p>
                    <div className="mt-2 flex items-end justify-between gap-4">
                      <span className="text-sm font-bold text-zinc-400">
                        {t("completed moves")}
                      </span>
                      <span className="text-4xl font-black leading-none text-white">
                        {displayedCollapse.movesUntilWarning}
                      </span>
                    </div>
                    <p className="mt-3 text-[10px] text-zinc-600">
                      {t("Each interval is seeded randomly from 5–9 moves.")}
                    </p>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-zinc-100">
                      {t("Collapse Stats")}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Damage from this match")}
                    </p>
                  </div>
                  <span className="rounded-full border border-red-400/15 bg-red-400/[0.07] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-red-300">
                    {history.length} {t("plies")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    icon="💥"
                    label={t("Collapses")}
                    value={String(displayedCollapse.collapseCount)}
                  />
                  <StatCard
                    icon="☠"
                    label={t("Pieces lost")}
                    value={String(collapseDestroyedCount)}
                  />
                  <StatCard
                    icon="♔"
                    label={t("White hits")}
                    value={String(whiteCollapseHits)}
                  />
                  <StatCard
                    icon="♚"
                    label={t("Black hits")}
                    value={String(blackCollapseHits)}
                  />
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-zinc-100">
                    {t("Rules")}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("Chess Collapse")}
                  </p>
                </div>

                <div className="space-y-2 text-xs leading-5 text-zinc-400">
                  <RuleLine
                    icon="♥"
                    text={t("Each king starts with 3 collapse lives.")}
                  />
                  <RuleLine
                    icon="♚"
                    text={t(
                      "Checkmate always ends the game immediately, even with lives remaining.",
                    )}
                  />
                  <RuleLine
                    icon="⚠"
                    text={t(
                      "A selected outer edge cracks for 4 completed moves before disappearing.",
                    )}
                  />
                  <RuleLine
                    icon="💥"
                    text={t(
                      "Any normal piece still on the collapsing edge is destroyed.",
                    )}
                  />
                  <RuleLine
                    icon="♔"
                    text={t(
                      "A king caught by a collapse loses one life and may escape only one square into the surviving board. If no adjacent legal escape exists, the game ends immediately.",
                    )}
                  />
                  <RuleLine
                    icon="■"
                    text={t(
                      "Collapsed squares are dead and can never be entered again.",
                    )}
                  />
                  <RuleLine
                    icon="◎"
                    text={t(
                      "Collapse selection favors lightly occupied edges, preventing an opening back-rank wipeout. The board stops shrinking at the central c3–f6 core.",
                    )}
                  />
                </div>
              </section>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function PlayerInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm font-semibold text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-amber-400/30"
      />
    </label>
  );
}

function KingLifeCard({
  symbol,
  label,
  lives,
  hits,
}: {
  symbol: string;
  label: string;
  lives: number;
  hits: number;
}) {
  return (
    <div className="rounded-2xl border border-red-300/10 bg-red-400/[0.04] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{symbol}</span>
          <div>
            <p className="text-xs font-black text-white">{label}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wider text-zinc-600">
              {hits} collapse hit{hits === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <span className="text-lg font-black tracking-wider text-red-300">
          {hearts(lives)}
        </span>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-lg" aria-hidden="true">
          {icon}
        </span>
        <span className="text-xl font-black text-white">{value}</span>
      </div>
      <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {label}
      </p>
    </div>
  );
}

function RuleLine({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex gap-2 rounded-xl border border-white/[0.04] bg-black/15 px-3 py-2">
      <span className="w-7 shrink-0 text-center font-black text-red-300">
        {icon}
      </span>
      <span>{text}</span>
    </div>
  );
}

function CapturedPiecesGrid({
  capturedBlack,
  capturedWhite,
  t,
}: {
  capturedBlack: PieceType[];
  capturedWhite: PieceType[];
  t: (key: string) => string;
}) {
  const whiteSymbols: Record<PieceType, string> = {
    p: "♙",
    n: "♘",
    b: "♗",
    r: "♖",
    q: "♕",
    k: "♔",
  };

  const blackSymbols: Record<PieceType, string> = {
    p: "♟",
    n: "♞",
    b: "♝",
    r: "♜",
    q: "♛",
    k: "♚",
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
          {t("White")}
        </span>
        <div className="flex min-h-7 flex-wrap gap-1 text-xl leading-none text-[#fff3d5]">
          {capturedWhite.length === 0 ? (
            <span className="text-xs text-zinc-700">—</span>
          ) : (
            capturedWhite.map((piece, index) => (
              <span key={`${piece}-${index}`}>{whiteSymbols[piece]}</span>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
          {t("Black")}
        </span>
        <div className="flex min-h-7 flex-wrap gap-1 text-xl leading-none text-zinc-300">
          {capturedBlack.length === 0 ? (
            <span className="text-xs text-zinc-700">—</span>
          ) : (
            capturedBlack.map((piece, index) => (
              <span key={`${piece}-${index}`}>{blackSymbols[piece]}</span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
