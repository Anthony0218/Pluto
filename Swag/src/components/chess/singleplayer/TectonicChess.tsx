import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { playChessSound } from "@/games/chess/audio/chessAudio";
import { emitGameEffect } from "@/games/chess/effects/gameEffects";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useRef, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Chess, type Square } from "chess.js";

import Board from "./Board";
import PromotionBar from "./PromotionBar";
import BoardAnimationToggle from "@/components/chess/singleplayer/BoardAnimationToggle";

import { getSquareName, type PieceType } from "../../../utils/chessUtils";

import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
} from "../../../utils/sound";

import { useDelayedBoardOrientation } from "@/hooks/useDelayedBoardOrientation";

import {
  LanguageSelector,
  translateChess,
  useChessLanguage,
  type TranslationTable,
} from "../../../games/chess/i18n/chessLanguage";

import {
  TECTONIC_PLIES_PER_SHIFT,
  TECTONIC_QUADRANTS,
  advanceTectonicAfterNormalMove,
  applyTectonicShift,
  canSkipTectonicShift,
  cloneTectonicState,
  createInitialTectonicState,
  findTectonicKingSquare,
  getLegalTectonicQuadrants,
  getTectonicPostShiftPreviewGame,
  getTectonicPreviewGame,
  isLegalTectonicRotation,
  isTectonicLockedOut,
  isThreefoldTectonic,
  quadrantLabel,
  tectonicRepetitionKey,
  type TectonicQuadrant,
  type TectonicSide,
  type TectonicState,
} from "../../../games/chess/variants/tectonicChess";
import { useVariantChessAi } from "@/hooks/useVariantChessAi";
import { chooseTectonicAiShift } from "../../../games/chess/ai/tectonicAi";
import {
  chessColorFromPlayerColor,
  oppositeChessColor,
  type Difficulty,
  type ChessPlayerColor,
} from "../../../games/chess/ai/variantAi";

type PromotionPiece = "q" | "r" | "b" | "n";

type PendingPromotion = {
  from: Square;
  to: Square;
};

type Winner = "white" | "black" | "draw";

type FinishReason =
  | "checkmate"
  | "stalemate"
  | "insufficient"
  | "fifty"
  | "repetition"
  | "tectonic_lock";

type FinishedGame = {
  winner: Winner;
  reason: FinishReason;
} | null;

type HistoryEntry = {
  action: number;
  kind: "move" | "shift";
  color: TectonicSide;
  notation: string;
  from: Square | null;
  to: Square | null;
  piece: PieceType | null;
  captured: PieceType | null;
  fenAfter: string;
  stateAfter: TectonicState;
  gaveCheck: boolean;
};

type UndoSnapshot = {
  fen: string;
  state: TectonicState;
  lastMove: {
    from: Square;
    to: Square;
  } | null;
  history: HistoryEntry[];
  repetitionKeys: string[];
  finishedGame: FinishedGame;
};

const translations: TranslationTable = {
  de: {
    "Tectonic Chess": "Tectonic Chess",
    "Move pieces. Then move the board.":
      "Ziehe Figuren. Dann bewege das Brett.",
    "Tectonic Status": "Tectonic-Status",
    "The board itself is a weapon": "Das Brett selbst ist eine Waffe",
    "Normal plies until shift": "Normale Halbzüge bis zum Shift",
    "TECTONIC SHIFT": "TEKTONISCHER SHIFT",
    "Choose one quadrant or skip": "Wähle einen Quadranten oder überspringe",
    "Rotate 90° clockwise": "90° im Uhrzeigersinn drehen",
    Locked: "Gesperrt",
    Illegal: "Illegal",
    Preview: "Vorschau",
    "Skip Shift": "Shift überspringen",
    "Skip is illegal while your King is in check.":
      "Überspringen ist illegal, solange dein König im Schach steht.",
    "Previous quadrant lock": "Sperre des vorherigen Quadranten",
    "No quadrant locked": "Kein Quadrant gesperrt",
    "Last shift": "Letzter Shift",
    "No shift yet": "Noch kein Shift",
    "Shift Stats": "Shift-Statistik",
    "Tectonic actions": "Tectonic-Aktionen",
    Rotations: "Drehungen",
    Skips: "Übersprungen",
    "Checks by shift": "Schachs durch Shift",
    Rulebook: "Regelbuch",
    "Every 4 normal plies, the side whose turn comes next gets a Tectonic Shift before its normal move.":
      "Alle 4 normalen Halbzüge erhält die Seite, die als Nächstes am Zug wäre, einen Tectonic Shift statt eines normalen Zuges.",
    "A shift rotates one 4×4 quadrant 90° clockwise.":
      "Ein Shift dreht einen 4×4-Quadranten um 90° im Uhrzeigersinn.",
    "The quadrant used by the previous shift is locked for the next one.":
      "Der im vorherigen Shift verwendete Quadrant ist beim nächsten Shift gesperrt.",
    "Your rotation may never leave your own King in check.":
      "Deine Drehung darf deinen eigenen König niemals im Schach lassen.",
    "A shift may give check or checkmate to the opponent.":
      "Ein Shift darf dem Gegner Schach oder Schachmatt geben.",
    "White wins by checkmate.": "Weiß gewinnt durch Schachmatt.",
    "Black wins by checkmate.": "Schwarz gewinnt durch Schachmatt.",
    "White wins: Black has no legal Tectonic escape.":
      "Weiß gewinnt: Schwarz hat keinen legalen tektonischen Ausweg.",
    "Black wins: White has no legal Tectonic escape.":
      "Schwarz gewinnt: Weiß hat keinen legalen tektonischen Ausweg.",
    "Stalemate. Draw.": "Patt. Remis.",
    "Insufficient material. Draw.": "Unzureichendes Material. Remis.",
    "50-move rule. Draw.": "50-Züge-Regel. Remis.",
    "Threefold repetition. Draw.": "Dreifache Wiederholung. Remis.",
    "Shift preview": "Shift-Vorschau",
    "Hover a legal quadrant to preview the rotation.":
      "Fahre über einen legalen Quadranten, um die Drehung vorab zu sehen.",
    "This shift gives check!": "Dieser Shift gibt Schach!",
    "Shift skipped": "Shift übersprungen",
    "Shift locked out": "Kein legaler Shift",
    "Your King is in check and no legal quadrant can rotate it to safety.":
      "Dein König steht im Schach und kein legaler Quadrant kann ihn in Sicherheit drehen.",
    "History action": "Historienaktion",
    "Normal move": "Normaler Zug",
    "Tectonic shift": "Tectonic Shift",
    "Play Tectonic Chess": "Tectonic Chess spielen",
  },
  bar: {
    "Tectonic Chess": "Tectonic Chess",
    "Move pieces. Then move the board.": "Figurn ziagn. Dann s Brett bewegn.",
    "Tectonic Status": "Tectonic-Status",
    "TECTONIC SHIFT": "TEKTONISCHER SHIFT",
    "Choose one quadrant or skip": "Wähl an Quadrantn oder lass aus",
    "Rotate 90° clockwise": "90° im Uhrzeigersinn drahn",
    Locked: "G'sperrt",
    Illegal: "Ned erlaubt",
    "Skip Shift": "Shift auslassn",
    Rulebook: "Regelbuch",
    Rotations: "Drahungen",
    Skips: "Ausglassn",
    "Play Tectonic Chess": "Tectonic Chess spuin",
  },
  ko: {
    "Tectonic Chess": "텍토닉 체스",
    "Move pieces. Then move the board.":
      "기물을 움직인 뒤, 체스판 자체를 움직입니다.",
    "Tectonic Status": "텍토닉 상태",
    "The board itself is a weapon": "체스판 자체가 무기입니다",
    "Normal plies until shift": "다음 시프트까지 일반 하프무브",
    "TECTONIC SHIFT": "텍토닉 시프트",
    "Choose one quadrant or skip": "사분면 하나를 선택하거나 건너뜁니다",
    "Rotate 90° clockwise": "시계 방향 90° 회전",
    Locked: "잠김",
    Illegal: "불가",
    Preview: "미리보기",
    "Skip Shift": "시프트 건너뛰기",
    "Skip is illegal while your King is in check.":
      "킹이 체크 상태이면 시프트를 건너뛸 수 없습니다.",
    "Previous quadrant lock": "이전 사분면 잠금",
    "No quadrant locked": "잠긴 사분면 없음",
    "Last shift": "최근 시프트",
    "No shift yet": "아직 시프트 없음",
    "Shift Stats": "시프트 통계",
    "Tectonic actions": "텍토닉 행동",
    Rotations: "회전",
    Skips: "건너뜀",
    "Checks by shift": "시프트 체크",
    Rulebook: "규칙서",
    "Every 4 normal plies, the side whose turn comes next gets a Tectonic Shift before its normal move.":
      "일반 하프무브 4회마다 다음 차례의 플레이어는 일반 수 대신 텍토닉 시프트를 수행합니다.",
    "A shift rotates one 4×4 quadrant 90° clockwise.":
      "시프트는 4×4 사분면 하나를 시계 방향으로 90° 회전시킵니다.",
    "The quadrant used by the previous shift is locked for the next one.":
      "직전 시프트에서 사용한 사분면은 다음 시프트에서 잠깁니다.",
    "Your rotation may never leave your own King in check.":
      "회전 후 자신의 킹이 체크 상태가 되면 그 회전은 불법입니다.",
    "A shift may give check or checkmate to the opponent.":
      "시프트로 상대에게 체크 또는 체크메이트를 만들 수 있습니다.",
    "White wins by checkmate.": "백이 체크메이트로 승리합니다.",
    "Black wins by checkmate.": "흑이 체크메이트로 승리합니다.",
    "White wins: Black has no legal Tectonic escape.":
      "백 승리: 흑에게 합법적인 텍토닉 탈출이 없습니다.",
    "Black wins: White has no legal Tectonic escape.":
      "흑 승리: 백에게 합법적인 텍토닉 탈출이 없습니다.",
    "Stalemate. Draw.": "스테일메이트. 무승부.",
    "Insufficient material. Draw.": "기물 부족. 무승부.",
    "50-move rule. Draw.": "50수 규칙. 무승부.",
    "Threefold repetition. Draw.": "3회 동형 반복. 무승부.",
    "Shift preview": "시프트 미리보기",
    "Hover a legal quadrant to preview the rotation.":
      "합법적인 사분면 위에 마우스를 올리면 회전을 미리 볼 수 있습니다.",
    "This shift gives check!": "이 시프트는 체크를 만듭니다!",
    "Shift skipped": "시프트 건너뜀",
    "Shift locked out": "시프트 불가",
    "Your King is in check and no legal quadrant can rotate it to safety.":
      "킹이 체크 상태이며 안전하게 만들 수 있는 합법적 사분면 회전이 없습니다.",
    "History action": "기록 행동",
    "Normal move": "일반 수",
    "Tectonic shift": "텍토닉 시프트",
    "Play Tectonic Chess": "텍토닉 체스 플레이",
  },
  ru: {
    "Tectonic Chess": "Тектонические шахматы",
    "Move pieces. Then move the board.":
      "Двигайте фигуры. Затем двигайте саму доску.",
    "Tectonic Status": "Тектонический статус",
    "The board itself is a weapon": "Сама доска становится оружием",
    "Normal plies until shift": "Обычных полуходов до сдвига",
    "TECTONIC SHIFT": "ТЕКТОНИЧЕСКИЙ СДВИГ",
    "Choose one quadrant or skip": "Выберите квадрант или пропустите",
    "Rotate 90° clockwise": "Повернуть на 90° по часовой стрелке",
    Locked: "Заблокировано",
    Illegal: "Нельзя",
    Preview: "Предпросмотр",
    "Skip Shift": "Пропустить сдвиг",
    "Skip is illegal while your King is in check.":
      "Нельзя пропустить сдвиг, если вашему королю объявлен шах.",
    "Previous quadrant lock": "Блокировка прошлого квадранта",
    "No quadrant locked": "Нет заблокированного квадранта",
    "Last shift": "Последний сдвиг",
    "No shift yet": "Сдвигов ещё не было",
    "Shift Stats": "Статистика сдвигов",
    "Tectonic actions": "Тектонические действия",
    Rotations: "Повороты",
    Skips: "Пропуски",
    "Checks by shift": "Шахи сдвигом",
    Rulebook: "Правила",
    "Every 4 normal plies, the side whose turn comes next gets a Tectonic Shift before its normal move.":
      "После каждых 4 обычных полуходов сторона, чей ход следующий, выполняет тектонический сдвиг вместо обычного хода.",
    "A shift rotates one 4×4 quadrant 90° clockwise.":
      "Сдвиг поворачивает один квадрант 4×4 на 90° по часовой стрелке.",
    "The quadrant used by the previous shift is locked for the next one.":
      "Квадрант предыдущего сдвига заблокирован на следующий сдвиг.",
    "Your rotation may never leave your own King in check.":
      "После вашего поворота собственный король не может оставаться под шахом.",
    "A shift may give check or checkmate to the opponent.":
      "Сдвиг может объявить сопернику шах или мат.",
    "White wins by checkmate.": "Белые выигрывают матом.",
    "Black wins by checkmate.": "Чёрные выигрывают матом.",
    "White wins: Black has no legal Tectonic escape.":
      "Белые выигрывают: у чёрных нет легального тектонического спасения.",
    "Black wins: White has no legal Tectonic escape.":
      "Чёрные выигрывают: у белых нет легального тектонического спасения.",
    "Stalemate. Draw.": "Пат. Ничья.",
    "Insufficient material. Draw.": "Недостаточно материала. Ничья.",
    "50-move rule. Draw.": "Правило 50 ходов. Ничья.",
    "Threefold repetition. Draw.": "Троекратное повторение. Ничья.",
    "Shift preview": "Предпросмотр сдвига",
    "Hover a legal quadrant to preview the rotation.":
      "Наведите на легальный квадрант, чтобы увидеть поворот.",
    "This shift gives check!": "Этот сдвиг объявляет шах!",
    "Shift skipped": "Сдвиг пропущен",
    "Shift locked out": "Нет легального сдвига",
    "Your King is in check and no legal quadrant can rotate it to safety.":
      "Ваш король под шахом, и ни один легальный поворот не спасает его.",
    "History action": "Действие истории",
    "Normal move": "Обычный ход",
    "Tectonic shift": "Тектонический сдвиг",
    "Play Tectonic Chess": "Играть в тектонические шахматы",
  },
};

function getFinish(
  game: Chess,
  state: TectonicState,
  repetitionKeys: string[],
): FinishedGame {
  /*
   * A derived Tectonic position should already be sanitized by the
   * shared rules module. Keep result evaluation guarded as a final
   * safety net so a chess.js move-generation exception cannot freeze AI.
   */
  try {
    if (state.pendingShift) {
      if (isTectonicLockedOut(game, state)) {
        return {
          winner: game.turn() === "w" ? "black" : "white",
          reason: "tectonic_lock",
        };
      }

      if (isThreefoldTectonic(repetitionKeys)) {
        return {
          winner: "draw",
          reason: "repetition",
        };
      }

      return null;
    }

    if (game.isCheckmate()) {
      return {
        winner: game.turn() === "w" ? "black" : "white",
        reason: "checkmate",
      };
    }

    if (game.isStalemate()) {
      return {
        winner: "draw",
        reason: "stalemate",
      };
    }

    if (game.isInsufficientMaterial()) {
      return {
        winner: "draw",
        reason: "insufficient",
      };
    }

    if (game.isDrawByFiftyMoves()) {
      return {
        winner: "draw",
        reason: "fifty",
      };
    }

    if (isThreefoldTectonic(repetitionKeys)) {
      return {
        winner: "draw",
        reason: "repetition",
      };
    }
  } catch (error) {
    console.error("Tectonic finish evaluation failed", {
      fen: game.fen(),
      state,
      error,
    });

    return null;
  }

  return null;
}

function getCheckedKingSquare(game: Chess): Square | null {
  if (!game.isCheck()) {
    return null;
  }

  return findTectonicKingSquare(game, game.turn());
}

function resultText(result: FinishedGame, t: (key: string) => string): string {
  if (!result) {
    return "";
  }

  if (result.reason === "checkmate") {
    return result.winner === "white"
      ? t("White wins by checkmate.")
      : t("Black wins by checkmate.");
  }

  if (result.reason === "tectonic_lock") {
    return result.winner === "white"
      ? t("White wins: Black has no legal Tectonic escape.")
      : t("Black wins: White has no legal Tectonic escape.");
  }

  if (result.reason === "stalemate") {
    return t("Stalemate. Draw.");
  }

  if (result.reason === "insufficient") {
    return t("Insufficient material. Draw.");
  }

  if (result.reason === "fifty") {
    return t("50-move rule. Draw.");
  }

  return t("Threefold repetition. Draw.");
}

type VariantAiBoardProps = {
  aiMode?: boolean;
  playerColor?: ChessPlayerColor;
  difficulty?: Difficulty;
  onChangeSettings?: () => void;
};

export default function TectonicChess({
  aiMode = false,
  playerColor = "white",
  difficulty = "casual",
}: VariantAiBoardProps) {
  useUiLanguage();
  const { language, setLanguage } = useChessLanguage();

  const t = (key: string) => translateChess(language, key, translations);

  const [game, setGame] = useState(() => new Chess());

  const [tectonic, setTectonic] = useState<TectonicState>(
    createInitialTectonicState,
  );

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const [lastMove, setLastMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  const [historyPreviewIndex, setHistoryPreviewIndex] = useState<number | null>(
    null,
  );

  const [hoveredQuadrant, setHoveredQuadrant] =
    useState<TectonicQuadrant | null>(null);

  const [finishedGame, setFinishedGame] = useState<FinishedGame>(null);

  const [repetitionKeys, setRepetitionKeys] = useState<string[]>(() => [
    tectonicRepetitionKey(new Chess(), createInitialTectonicState()),
  ]);

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
      aiMovePendingRef.current ||
      finishedGame ||
      historyPreviewIndex !== null ||
      pendingPromotion ||
      game.turn() !== computerColor ||
      (!tectonic.pendingShift && !aiReady)
    ) {
      return;
    }

    const expectedFen = game.fen();
    let cancelled = false;
    aiMovePendingRef.current = true;

    const timer = window.setTimeout(async () => {
      try {
        if (tectonic.pendingShift) {
          const action = chooseTectonicAiShift(game, tectonic, difficulty);

          if (
            cancelled ||
            game.fen() !== expectedFen ||
            game.turn() !== computerColor
          ) {
            return;
          }

          performShift(action, true);
          return;
        }

        if (!aiReady) {
          return;
        }

        const move = await chooseAiMove(game);

        if (
          cancelled ||
          !move ||
          game.fen() !== expectedFen ||
          game.turn() !== computerColor
        ) {
          return;
        }

        commitNormalMove(move.from, move.to, move.promotion);
      } finally {
        aiMovePendingRef.current = false;
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      // React StrictMode runs an extra setup/cleanup cycle in development.
      // Reset the guard here so the real effect can schedule White's first AI move.
      aiMovePendingRef.current = false;
    };
  }, [
    aiMode,
    aiReady,
    computerColor,
    difficulty,
    game,
    tectonic,
    history.length,
    finishedGame,
    historyPreviewIndex,
    pendingPromotion,
    chooseAiMove,
  ]);

  const {
    orientation: liveBoardOrientation,
    flipPending,
    snapToSide,
  } = useDelayedBoardOrientation(aiMode ? humanColor : game.turn(), 1500);

  const legalShiftQuadrants = useMemo(
    () =>
      tectonic.pendingShift ? getLegalTectonicQuadrants(game, tectonic) : [],
    [game, tectonic],
  );

  const previewGame = useMemo(() => {
    if (
      !tectonic.pendingShift ||
      !hoveredQuadrant ||
      !isLegalTectonicRotation(game, tectonic, hoveredQuadrant)
    ) {
      return null;
    }

    return getTectonicPreviewGame(game, hoveredQuadrant);
  }, [game, tectonic, hoveredQuadrant]);

  const postShiftPreviewGame = useMemo(() => {
    if (!tectonic.pendingShift || !hoveredQuadrant) {
      return null;
    }

    return getTectonicPostShiftPreviewGame(game, tectonic, hoveredQuadrant);
  }, [game, tectonic, hoveredQuadrant]);

  const historyPreview =
    historyPreviewIndex === null
      ? null
      : (history[historyPreviewIndex] ?? null);

  const historyPreviewGame = useMemo(
    () =>
      historyPreview
        ? new Chess(historyPreview.fenAfter, { skipValidation: true })
        : null,
    [historyPreview?.fenAfter],
  );

  const displayedChess = historyPreviewGame ?? previewGame ?? game;

  const displayedBoard = displayedChess.board();

  const boardOrientation: "white" | "black" = historyPreviewGame
    ? historyPreviewGame.turn() === "w"
      ? "white"
      : "black"
    : liveBoardOrientation;

  const displayedLastMove =
    historyPreview?.kind === "move" && historyPreview.from && historyPreview.to
      ? {
          from: historyPreview.from,
          to: historyPreview.to,
        }
      : historyPreview
        ? null
        : lastMove;

  const checkedKingSquare =
    previewGame && postShiftPreviewGame
      ? getCheckedKingSquare(postShiftPreviewGame)
      : getCheckedKingSquare(displayedChess);

  const pliesUntilShift = tectonic.pendingShift
    ? 0
    : Math.max(0, TECTONIC_PLIES_PER_SHIFT - tectonic.normalPliesSinceShift);

  const moveAfterSkippedShift =
    !tectonic.pendingShift && tectonic.consecutiveShiftSkips > 0;

  const shiftHistory = history.filter((entry) => entry.kind === "shift");

  const rotations = shiftHistory.filter(
    (entry) => entry.notation !== "SKIP",
  ).length;

  const skips = shiftHistory.length - rotations;

  const checksByShift = shiftHistory.filter((entry) => entry.gaveCheck).length;

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  function snapshot(): UndoSnapshot {
    return {
      fen: game.fen(),
      state: cloneTectonicState(tectonic),
      lastMove: lastMove ? { ...lastMove } : null,
      history: history.map((entry) => ({
        ...entry,
        stateAfter: cloneTectonicState(entry.stateAfter),
      })),
      repetitionKeys: [...repetitionKeys],
      finishedGame,
    };
  }

  function commitNormalMove(
    from: Square,
    to: Square,
    promotion?: PromotionPiece,
  ) {
    if (
      finishedGame ||
      tectonic.pendingShift ||
      historyPreview ||
      flipPending
    ) {
      return;
    }

    const before = snapshot();

    const nextGame = new Chess(game.fen(), { skipValidation: true });

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

    const nextState = advanceTectonicAfterNormalMove(tectonic);

    const nextKeys = [
      ...repetitionKeys,
      tectonicRepetitionKey(nextGame, nextState),
    ];

    const nextFinished = getFinish(nextGame, nextState, nextKeys);

    const nextEntry: HistoryEntry = {
      action: history.length + 1,
      kind: "move",
      color: move.color,
      notation: move.san,
      from: move.from,
      to: move.to,
      piece: move.piece as PieceType,
      captured: (move.captured as PieceType | undefined) ?? null,
      fenAfter: nextGame.fen(),
      stateAfter: cloneTectonicState(nextState),
      gaveCheck: nextGame.isCheck(),
    };

    setUndoStack((stack) => [...stack, before]);

    setGame(nextGame);
    setTectonic(nextState);
    setHistory((items) => [...items, nextEntry]);
    setRepetitionKeys(nextKeys);
    setLastMove({
      from: move.from,
      to: move.to,
    });
    setPendingPromotion(null);
    setHistoryPreviewIndex(null);
    setHoveredQuadrant(null);
    setFinishedGame(nextFinished);

    clearSelection();

    if (move.captured) {
      playPieceCaptureSound(move.piece);
    } else {
      playPieceMoveSound(move.piece);
    }
  }

  function handleSquareClick(row: number, column: number) {
    if (aiMode && game.turn() !== humanColor) return;

    if (
      finishedGame ||
      tectonic.pendingShift ||
      historyPreview ||
      flipPending
    ) {
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

    commitNormalMove(selectedSquare, square);
  }

  function performShift(
    quadrant: TectonicQuadrant | null,
    initiatedByAi = false,
  ) {
    if (aiMode && !initiatedByAi && game.turn() !== humanColor) return;
    if (
      finishedGame ||
      !tectonic.pendingShift ||
      historyPreview ||
      flipPending
    ) {
      return;
    }

    const before = snapshot();
    const shifter = game.turn();

    const result = applyTectonicShift(game, tectonic, quadrant);

    if (!result) {
      return;
    }

    const nextKeys = [
      ...repetitionKeys,
      tectonicRepetitionKey(result.game, result.state),
    ];

    const nextFinished = getFinish(result.game, result.state, nextKeys);

    const notation = quadrant === null ? "SKIP" : `↻${quadrant}`;

    const entry: HistoryEntry = {
      action: history.length + 1,
      kind: "shift",
      color: shifter,
      notation,
      from: null,
      to: null,
      piece: null,
      captured: null,
      fenAfter: result.game.fen(),
      stateAfter: cloneTectonicState(result.state),
      gaveCheck: result.game.isCheck(),
    };

    setUndoStack((stack) => [...stack, before]);
    setGame(result.game);
    setTectonic(result.state);
    setHistory((items) => [...items, entry]);
    setRepetitionKeys(nextKeys);
    setLastMove(null);
    setPendingPromotion(null);
    setHistoryPreviewIndex(null);
    setHoveredQuadrant(null);
    setFinishedGame(nextFinished);
    clearSelection();
    if (quadrant !== null) {
      playChessSound("boardRotate");
      emitGameEffect({ type: "BOARD_ROTATE", quadrant });
    }
  }

  function undo() {
    const previous = undoStack[undoStack.length - 1];

    if (!previous) {
      return;
    }

    const restoredGame = new Chess(previous.fen, { skipValidation: true });

    setGame(restoredGame);
    setTectonic(cloneTectonicState(previous.state));
    setLastMove(previous.lastMove ? { ...previous.lastMove } : null);
    setHistory(
      previous.history.map((entry) => ({
        ...entry,
        stateAfter: cloneTectonicState(entry.stateAfter),
      })),
    );
    setRepetitionKeys([...previous.repetitionKeys]);
    setFinishedGame(previous.finishedGame);

    setUndoStack((stack) => stack.slice(0, -1));

    setPendingPromotion(null);
    setHistoryPreviewIndex(null);
    setHoveredQuadrant(null);
    clearSelection();

    snapToSide(restoredGame.turn());
  }

  function restart() {
    const freshGame = new Chess();
    const freshState = createInitialTectonicState();

    setGame(freshGame);
    setTectonic(freshState);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPendingPromotion(null);
    setHistory([]);
    setUndoStack([]);
    setHistoryPreviewIndex(null);
    setHoveredQuadrant(null);
    setFinishedGame(null);
    setRepetitionKeys([tectonicRepetitionKey(freshGame, freshState)]);

    snapToSide("w");
  }

  const visualQuadrants =
    boardOrientation === "white"
      ? {
          topLeft: "A",
          topRight: "B",
          bottomLeft: "C",
          bottomRight: "D",
        }
      : {
          topLeft: "D",
          topRight: "C",
          bottomLeft: "B",
          bottomRight: "A",
        };

  const shifterName = game.turn() === "w" ? t("White") : t("Black");

  return (
    <div className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1460px]">
        <ChessPageHeader className="mb-6 rounded-3xl border border-violet-400/10 bg-zinc-900/70 px-5 py-4 shadow-xl shadow-black/20" description={<> {t("Move pieces. Then move the board.")} </>}>
<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-violet-300">
                {t("Chess Variant")}
              </p>

              <h1 className="mt-1 text-2xl font-black text-white">
                {t("Tectonic Chess")}
              </h1>

              <p className="mt-1 text-sm text-zinc-500">
                {t("Move pieces. Then move the board.")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <LanguageSelector
                language={language}
                onChange={setLanguage}
                label={t("Language")}
              />

              {!finishedGame && (
                <div
                  className={`rounded-xl border px-3 py-2 text-xs font-black ${
                    tectonic.pendingShift
                      ? "border-violet-300/20 bg-violet-400/10 text-violet-200"
                      : "border-white/10 bg-white/5 text-zinc-300"
                  }`}
                >
                  {tectonic.pendingShift ? `${t("TECTONIC SHIFT")} · ${shifterName}` : moveAfterSkippedShift ? `${shifterName} · normal move after skip` : game.turn() === "w" ? t("White to move") : t("Black to move")}
                </div>
              )}
            </div>
            <BoardAnimationToggle />
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
                    disabled={undoStack.length === 0 || aiMode}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-black text-zinc-300 transition hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed
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
                    onClick={restart}
                    className="rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 py-2.5 text-xs font-black text-violet-200 transition hover:bg-violet-400/20"
                  >
                    ↻ {t("Restart")}
                  </button>
                </div>
              </Panel>

              <Panel title={t("Move History")} subtitle={t("Game history")}>
                <div className="max-h-80 overflow-y-auto rounded-xl border border-white/5 bg-black/20">
                  {history.length === 0 ? (
                    <p className="px-4 py-8 text-center text-xs text-zinc-600">
                      {t("No moves yet")}
                    </p>
                  ) : (
                    history.map((entry, index) => (
                      <button
                        key={entry.action}
                        type="button"
                        onClick={() => {
                          setHistoryPreviewIndex(index);
                          clearSelection();
                          setHoveredQuadrant(null);
                        }}
                        className={`flex w-full items-center justify-between border-b border-white/5 px-3 py-2.5 text-left text-xs transition last:border-0 ${
                          historyPreviewIndex === index
                            ? "bg-violet-400/10 text-violet-200"
                            : "text-zinc-400 hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-6 text-[10px] text-zinc-600">
                            {ui(entry.action)}
                          </span>

                          <span>{entry.color === "w" ? "♙" : "♟"}</span>

                          <span className="font-black">
                            {entry.kind === "shift" ? "↻" : "·"}
                          </span>
                        </div>

                        <span className="font-mono font-black">
                          {entry.notation}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </Panel>

              <Panel title={t("Shift Stats")} subtitle={t("Tectonic actions")}>
                <div className="grid grid-cols-3 gap-2">
                  <Stat label={t("Rotations")} value={rotations} />
                  <Stat label={t("Skips")} value={skips} />
                  <Stat label={t("Checks by shift")} value={checksByShift} />
                </div>
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
                    {historyPreview.notation}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setHistoryPreviewIndex(null)}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-white/20"
                >
                  {t("Back to live")}
                </button>
              </div>
            )}

            {previewGame && hoveredQuadrant && !historyPreview && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-violet-400/20 bg-violet-400/[0.07] px-4 py-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-violet-300">
                    {t("Shift preview")}
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">
                    ↻ {quadrantLabel(hoveredQuadrant)}
                  </p>
                </div>

                {postShiftPreviewGame?.isCheck() && (
                  <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-[10px] font-black text-red-300">
                    {t("This shift gives check!")}
                  </span>
                )}
              </div>
            )}

            {pendingPromotion && !historyPreview && !tectonic.pendingShift && (
              <div className="mb-3">
                <PromotionBar
                  onPromote={(piece) =>
                    commitNormalMove(
                      pendingPromotion.from,
                      pendingPromotion.to,
                      piece,
                    )
                  }
                />
              </div>
            )}

            <div className="relative">
              <Board
                board={displayedBoard}
                selectedSquare={
                  historyPreview || previewGame ? null : selectedSquare
                }
                legalMoves={historyPreview || previewGame ? [] : legalMoves}
                lastMove={displayedLastMove}
                checkedKingSquare={checkedKingSquare}
                onSquareClick={
                  historyPreview ||
                  previewGame ||
                  tectonic.pendingShift ||
                  flipPending
                    ? () => {}
                    : handleSquareClick
                }
                orientation={boardOrientation}
              />

              <QuadrantOverlay
                quadrants={visualQuadrants}
                active={tectonic.pendingShift}
                hovered={hoveredQuadrant}
                locked={tectonic.lockedQuadrant}
              />

              {finishedGame && !historyPreview && (
                <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[28px] bg-zinc-950/82 p-6 backdrop-blur-sm">
                  <div className="max-w-sm rounded-3xl border border-violet-300/20 bg-zinc-900 p-6 text-center shadow-2xl">
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-300">
                      {t("Game Over")}
                    </p>

                    <h2 className="mt-3 text-3xl font-black text-white">
                      {finishedGame.winner === "white" ? t("White wins") : finishedGame.winner === "black" ? t("Black wins") : t("Draw")}
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-zinc-500">
                      {resultText(finishedGame, t)}
                    </p>

                    <button
                      type="button"
                      onClick={restart}
                      className="mt-5 rounded-xl bg-violet-400 px-4 py-2.5 text-sm font-black text-violet-950"
                    >
                      {t("Play again")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <section className="rounded-3xl border border-violet-400/15 bg-zinc-900/80 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-zinc-100">
                      {t("Tectonic Status")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("The board itself is a weapon")}
                    </p>
                  </div>

                  <span className="text-2xl">↻</span>
                </div>

                {tectonic.pendingShift ? (
                  <div className="mt-4">
                    <div className="rounded-2xl border border-violet-300/20 bg-violet-400/[0.07] p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">
                        {t("TECTONIC SHIFT")}
                      </p>

                      <p className="mt-2 text-lg font-black text-white">
                        {shifterName}
                      </p>

                      <p className="mt-1 text-[10px] text-zinc-500">
                        {t("Choose one quadrant or skip")}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {TECTONIC_QUADRANTS.map((quadrant) => {
                        const legal = legalShiftQuadrants.includes(quadrant);

                        const locked = tectonic.lockedQuadrant === quadrant;

                        return (
                          <button
                            key={quadrant}
                            type="button"
                            disabled={!legal || flipPending}
                            onMouseEnter={() =>
                              legal && setHoveredQuadrant(quadrant)
                            }
                            onMouseLeave={() => setHoveredQuadrant(null)}
                            onFocus={() =>
                              legal && setHoveredQuadrant(quadrant)
                            }
                            onBlur={() => setHoveredQuadrant(null)}
                            onClick={() => performShift(quadrant)}
                            className={`rounded-2xl border p-3 text-left transition ${
                              legal
                                ? hoveredQuadrant === quadrant
                                  ? "border-violet-300/40 bg-violet-400/20"
                                  : "border-violet-300/15 bg-violet-400/[0.07] hover:bg-violet-400/15"
                                : "border-white/5 bg-black/20 opacity-45"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-2xl font-black text-white">
                                {quadrant}
                              </span>
                              <span className="text-lg">↻</span>
                            </div>

                            <p className="mt-2 text-[10px] font-bold text-zinc-500">
                              {quadrantLabel(quadrant).slice(4)}
                            </p>

                            <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-zinc-600">
                              {locked ? t("Locked") : legal ? t("Rotate 90° clockwise") : t("Illegal")}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={
                        !canSkipTectonicShift(game, tectonic) || flipPending
                      }
                      onClick={() => performShift(null)}
                      className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-black text-zinc-300 transition hover:bg-white/10 disabled:opacity-35"
                    >
                      {t("Skip Shift")}
                    </button>

                    {game.isCheck() && (
                      <p className="mt-2 text-[10px] leading-4 text-red-300/80">
                        {t("Skip is illegal while your King is in check.")}
                      </p>
                    )}

                    {isTectonicLockedOut(game, tectonic) && (
                      <div className="mt-3 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3">
                        <p className="text-xs font-black text-red-300">
                          {t("Shift locked out")}
                        </p>

                        <p className="mt-1 text-[10px] leading-4 text-zinc-500">
                          {t(
                            "Your King is in check and no legal quadrant can rotate it to safety.",
                          )}
                        </p>
                      </div>
                    )}

                    <p className="mt-3 text-center text-[10px] text-zinc-600">
                      {t("Hover a legal quadrant to preview the rotation.")}
                    </p>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                      {t("Normal plies until shift")}
                    </p>

                    <div className="mt-2 flex items-end justify-between">
                      <span className="text-sm font-bold text-zinc-300">
                        {game.turn() === "w" ? t("White") : t("Black")}
                      </span>

                      <span className="text-4xl font-black leading-none text-violet-300">
                        {pliesUntilShift}
                      </span>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-violet-400 transition-all duration-300"
                        style={{
                          width: `${
                            (tectonic.normalPliesSinceShift /
                              TECTONIC_PLIES_PER_SHIFT) *
                            100
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <StatusMini
                    label={t("Previous quadrant lock")}
                    value={tectonic.lockedQuadrant ?? "—"}
                  />

                  <StatusMini
                    label={t("Last shift")}
                    value={
                      tectonic.skippedLastShift
                        ? t("Shift skipped")
                        : (tectonic.lastShiftQuadrant ?? "—")
                    }
                  />
                </div>
              </section>

              <Panel title={t("Rules")} subtitle={t("Tectonic Chess")}>
                <div className="space-y-2">
                  <RuleLine
                    icon="4"
                    text={t(
                      "Every 4 normal plies, the side whose turn comes next gets a Tectonic Shift instead of a normal move.",
                    )}
                  />
                  <RuleLine
                    icon="↻"
                    text={t("A shift rotates one 4×4 quadrant 90° clockwise.")}
                  />
                  <RuleLine
                    icon="🔒"
                    text={t(
                      "The quadrant used by the previous shift is locked for the next one.",
                    )}
                  />
                  <RuleLine
                    icon="♔"
                    text={t(
                      "Your rotation may never leave your own King in check.",
                    )}
                  />
                  <RuleLine
                    icon="+"
                    text={t(
                      "A shift may give check or checkmate to the opponent.",
                    )}
                  />
                </div>

                <Link
                  to="/games/chess/variants/tectonic/rules"
                  className="mt-4 flex w-full items-center justify-center rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 py-2.5 text-xs font-black text-violet-200 transition hover:bg-violet-400/20"
                >
                  📖 {t("Rulebook")}
                </Link>
              </Panel>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function QuadrantOverlay({
  quadrants,
  active,
  hovered,
  locked,
}: {
  quadrants: {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
  };
  active: boolean;
  hovered: TectonicQuadrant | null;
  locked: TectonicQuadrant | null;
}) {
  useUiLanguage();
  const cells = [
    ["topLeft", "left-[25%] top-[25%]"],
    ["topRight", "left-[75%] top-[25%]"],
    ["bottomLeft", "left-[25%] top-[75%]"],
    ["bottomRight", "left-[75%] top-[75%]"],
  ] as const;

  return (
    <div className="pointer-events-none absolute inset-[2.5%] z-30 rounded-2xl">
      <div className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-violet-300/25" />
      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-violet-300/25" />

      {cells.map(([key, position]) => {
        const quadrant = quadrants[key] as TectonicQuadrant;

        const isHovered = hovered === quadrant;

        const isLocked = locked === quadrant;

        return (
          <div
            key={key}
            className={`absolute ${position} -translate-x-1/2 -translate-y-1/2 rounded-lg border px-2 py-1 text-[10px] font-black transition ${
              active
                ? isHovered
                  ? "border-violet-200/60 bg-violet-400/35 text-white shadow-lg shadow-violet-950/40"
                  : isLocked
                    ? "border-zinc-500/20 bg-zinc-950/60 text-zinc-600"
                    : "border-violet-300/20 bg-zinc-950/45 text-violet-200"
                : "border-violet-300/10 bg-zinc-950/30 text-violet-300/45"
            }`}
          >
            {quadrant}
          </div>
        );
      })}
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

function Stat({ label, value }: { label: string; value: number }) {
  useUiLanguage();
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-2 py-3 text-center">
      <p className="text-xl font-black text-violet-200">{value}</p>
      <p className="mt-1 text-[9px] font-bold leading-4 text-zinc-600">
        {ui(label)}
      </p>
    </div>
  );
}

function StatusMini({ label, value }: { label: string; value: string }) {
  useUiLanguage();
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {ui(label)}
      </p>
      <p className="mt-1 text-sm font-black text-zinc-300">{value}</p>
    </div>
  );
}

function RuleLine({ icon, text }: { icon: string; text: string }) {
  useUiLanguage();
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-xs leading-5 text-zinc-400">
      <span className="flex min-w-7 justify-center font-black text-violet-300">
        {icon}
      </span>
      <span>{ui(text)}</span>
    </div>
  );
}
