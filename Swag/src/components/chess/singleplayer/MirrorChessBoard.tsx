import { ui, useUiLanguage } from "@/i18n/ui";
import { useAppLanguage } from "@/i18n/languageStore";
import { useRef, useEffect, useMemo, useState, type ReactNode } from "react";

import { Chess, type Square } from "chess.js";

import { getSquareName, type PieceType } from "../../../utils/chessUtils.ts";

import Board from "./Board.tsx";
import PromotionBar from "./PromotionBar";

import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
  playRandomSound,
} from "../../../utils/sound.ts";

import {
  applyMirrorSetupAction,
  buildMirrorStartFen,
  createInitialMirrorSetupState,
  createMirrorSeed,
  getAvailableMirrorSquares,
  getCurrentMirrorPiece,
  getMirrorSetupSquares,
  isMirrorStartPositionValid,
  isThreefoldMirror,
  mirrorSetupToBoard,
  mirrorSquare,
  type MirrorMoveRecord,
  type MirrorPieceType,
  type MirrorSetupState,
} from "../../../games/chess/variants/mirrorChess.ts";

import {
  buildMirrorGameStats,
  buildMirrorSetupStats,
} from "../../../games/chess/variants/mirrorStats.ts";

import { useDelayedBoardOrientation } from "@/hooks/useDelayedBoardOrientation.ts";
import BoardAnimationToggle from "./BoardAnimationToggle.tsx";
import { useVariantChessAi } from "@/hooks/useVariantChessAi";
import {
  chessColorFromPlayerColor,
  oppositeChessColor,
  type Difficulty,
  type ChessPlayerColor,
} from "../../../games/chess/ai/variantAi.ts";

type Language = "en" | "de" | "bar" | "ko" | "ru";

type Phase = "setup" | "playing";

type Winner = "white" | "black" | "draw";

type StatsTab = "setup" | "battle";

const CHESS_LANGUAGE_STORAGE_KEY = "chess-language";

const pieceValues: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const whiteSymbols: Record<string, string> = {
  p: "♙",
  n: "♘",
  b: "♗",
  r: "♖",
  q: "♕",
  k: "♔",
};

const blackSymbols: Record<string, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
};

const pieceNames: Record<MirrorPieceType, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

const translations: Record<Exclude<Language, "en">, Record<string, string>> = {
  de: {
    "Switching sides...": "Seitenwechsel...",
    "Pawns and non-King pieces may use either setup rank. The King must stay on rank 1/8.":
      "Bauern und alle Nicht-Königsfiguren dürfen beide Aufbaureihen benutzen. Der König muss auf Reihe 1/8 bleiben.",
    "Chess Variant": "Schachvariante",
    "Mirror Chess": "Spiegelschach",
    "Build one army together": "Baut gemeinsam eine Armee",
    Language: "Sprache",
    White: "Weiß",
    Black: "Schwarz",
    "White to move": "Weiß am Zug",
    "Black to move": "Schwarz am Zug",
    "Random piece": "Zufällige Figur",
    "Place this piece": "Platziere diese Figur",
    "Your setup zone": "Deine Aufbauzone",
    "The same piece is mirrored automatically for the opponent.":
      "Dieselbe Figur wird automatisch für den Gegner gespiegelt.",
    "Placement turn": "Aufbauzug",
    "Pieces placed": "Figuren platziert",
    "Pairs left": "Paare übrig",
    "Mirror Setup": "Spiegel-Aufbau",
    "Alternating random construction": "Abwechselnder zufälliger Aufbau",
    "Available square": "Verfügbares Feld",
    "Mirrored square": "Spiegelfeld",
    "Random bag": "Zufallsbeutel",
    Pawn: "Bauer",
    Knight: "Springer",
    Bishop: "Läufer",
    Rook: "Turm",
    Queen: "Dame",
    King: "König",
    "Formation complete": "Aufstellung vollständig",
    "Start Game": "Spiel starten",
    "Invalid formation": "Ungültige Aufstellung",
    "New Setup": "Neuer Aufbau",
    "Game Controls": "Spielsteuerung",
    "Players and actions": "Aktionen",
    Undo: "Rückgängig",
    Restart: "Neustart",
    "Captured Pieces": "Geschlagene Figuren",
    "Material overview": "Materialübersicht",
    Equal: "Gleich",
    "Move History": "Zugverlauf",
    "Game history": "Partieverlauf",
    "No moves yet": "Noch keine Züge",
    "Game Over": "Spielende",
    "White wins": "Weiß gewinnt",
    "Black wins": "Schwarz gewinnt",
    Draw: "Remis",
    Checkmate: "Schachmatt",
    Stalemate: "Patt",
    "Insufficient material": "Unzureichendes Material",
    "50-move rule": "50-Züge-Regel",
    "Threefold repetition": "Dreifache Stellungswiederholung",
    "History Preview": "Verlaufsansicht",
    "Back to Live Board": "Zurück zum Live-Brett",
    "Mirror Stats": "Spiegel-Statistik",
    Setup: "Aufbau",
    Battle: "Kampf",
    Captures: "Schlagzüge",
    Checks: "Schachs",
    Promotions: "Umwandlungen",
    "White placements": "Weiße Platzierungen",
    "Black placements": "Schwarze Platzierungen",
  },

  bar: {
    "Switching sides...": "Seitnwechsel...",
    "Pawns and non-King pieces may use either setup rank. The King must stay on rank 1/8.":
      "Bauern und olle Figuren außer'm Kini dürfen beide Aufbaureihen nutzen. Da Kini muaß auf Reihe 1/8 bleibn.",
    "Chess Variant": "Schachvariantn",
    "Mirror Chess": "Spiegelschach",
    "Build one army together": "Baut zamm oane Armee",
    Language: "Sproch",
    White: "Weiß",
    Black: "Schwarz",
    "White to move": "Weiß is dro",
    "Black to move": "Schwarz is dro",
    "Random piece": "Zufällige Figur",
    "Place this piece": "Stell de Figur hi",
    "Your setup zone": "Deine Aufbauzone",
    "The same piece is mirrored automatically for the opponent.":
      "De gleiche Figur wird automatisch beim Gegner g'spiegelt.",
    "Placement turn": "Aufbauzug",
    "Pieces placed": "Figuren platziert",
    "Pairs left": "Paare übrig",
    "Mirror Setup": "Spiegel-Aufbau",
    "Alternating random construction": "Abwechselnder Zufallsaufbau",
    "Available square": "Freies Feld",
    "Mirrored square": "Spiegelfeld",
    "Random bag": "Zufallsbeutel",
    Pawn: "Baua",
    Knight: "Springa",
    Bishop: "Läufa",
    Rook: "Turm",
    Queen: "Dame",
    King: "Kini",
    "Formation complete": "Aufstellung fertig",
    "Start Game": "Spiel startn",
    "Invalid formation": "Ungültige Aufstellung",
    "New Setup": "Neuer Aufbau",
    "Game Controls": "Spielsteuerung",
    "Players and actions": "Aktionen",
    Undo: "Zruck",
    Restart: "Neu startn",
    "Captured Pieces": "G'schlagene Figuren",
    "Material overview": "Material",
    Equal: "Gleich",
    "Move History": "Zugverlauf",
    "Game history": "Partieverlauf",
    "No moves yet": "No koa Zug",
    "Game Over": "Spiel aus",
    "White wins": "Weiß gwinnt",
    "Black wins": "Schwarz gwinnt",
    Draw: "Remis",
    "History Preview": "Verlaufsansicht",
    "Back to Live Board": "Zruck zum Live-Brett",
    "Mirror Stats": "Spiegel-Statistik",
    Setup: "Aufbau",
    Battle: "Kampf",
    Captures: "Schlagzüg",
    Checks: "Schachs",
    Promotions: "Umwandlungen",
    "White placements": "Weiße Platzierungen",
    "Black placements": "Schwarze Platzierungen",
  },

  ko: {
    "Switching sides...": "진영 전환 중...",
    "Pawns and non-King pieces may use either setup rank. The King must stay on rank 1/8.":
      "폰과 킹을 제외한 기물은 두 시작 랭크 어디든 둘 수 있습니다. 킹은 백 1랭크/흑 8랭크에 있어야 합니다.",
    "Chess Variant": "체스 변형",
    "Mirror Chess": "미러 체스",
    "Build one army together": "하나의 군대를 함께 구성합니다",
    Language: "언어",
    White: "백",
    Black: "흑",
    "White to move": "백 차례",
    "Black to move": "흑 차례",
    "Random piece": "랜덤 기물",
    "Place this piece": "이 기물을 배치하세요",
    "Your setup zone": "내 배치 구역",
    "The same piece is mirrored automatically for the opponent.":
      "같은 기물이 상대편의 대칭 위치에 자동으로 배치됩니다.",
    "Placement turn": "배치 차례",
    "Pieces placed": "배치된 기물",
    "Pairs left": "남은 쌍",
    "Mirror Setup": "미러 배치",
    "Alternating random construction": "교대로 진행하는 랜덤 구성",
    "Available square": "사용 가능한 칸",
    "Mirrored square": "대칭 칸",
    "Random bag": "랜덤 기물 주머니",
    Pawn: "폰",
    Knight: "나이트",
    Bishop: "비숍",
    Rook: "룩",
    Queen: "퀸",
    King: "킹",
    "Formation complete": "배치 완료",
    "Start Game": "게임 시작",
    "Invalid formation": "유효하지 않은 배치",
    "New Setup": "새 배치",
    "Game Controls": "게임 컨트롤",
    "Players and actions": "게임 조작",
    Undo: "되돌리기",
    Restart: "새 게임",
    "Captured Pieces": "잡힌 기물",
    "Material overview": "기물 현황",
    Equal: "동일",
    "Move History": "수 기록",
    "Game history": "게임 기록",
    "No moves yet": "아직 수가 없습니다",
    "Game Over": "게임 종료",
    "White wins": "백 승리",
    "Black wins": "흑 승리",
    Draw: "무승부",
    Checkmate: "체크메이트",
    Stalemate: "스테일메이트",
    "Insufficient material": "기물 부족",
    "50-move rule": "50수 규칙",
    "Threefold repetition": "3회 동형 반복",
    "History Preview": "기록 미리보기",
    "Back to Live Board": "현재 보드로 돌아가기",
    "Mirror Stats": "미러 통계",
    Setup: "배치",
    Battle: "전투",
    Captures: "잡은 수",
    Checks: "체크",
    Promotions: "프로모션",
    "White placements": "백 배치 수",
    "Black placements": "흑 배치 수",
  },

  ru: {
    "Switching sides...": "Смена стороны...",
    "Pawns and non-King pieces may use either setup rank. The King must stay on rank 1/8.":
      "Пешки и все фигуры кроме короля можно ставить на любой из двух стартовых рядов. Король должен оставаться на 1-м/8-м ряду.",
    "Chess Variant": "Шахматный вариант",
    "Mirror Chess": "Зеркальные шахматы",
    "Build one army together": "Создайте одну армию вместе",
    Language: "Язык",
    White: "Белые",
    Black: "Чёрные",
    "White to move": "Ход белых",
    "Black to move": "Ход чёрных",
    "Random piece": "Случайная фигура",
    "Place this piece": "Разместите эту фигуру",
    "Your setup zone": "Ваша зона расстановки",
    "The same piece is mirrored automatically for the opponent.":
      "Та же фигура автоматически зеркально ставится противнику.",
    "Placement turn": "Ход расстановки",
    "Pieces placed": "Размещено фигур",
    "Pairs left": "Осталось пар",
    "Mirror Setup": "Зеркальная расстановка",
    "Alternating random construction": "Поочерёдная случайная сборка",
    "Available square": "Доступное поле",
    "Mirrored square": "Зеркальное поле",
    "Random bag": "Случайный набор",
    Pawn: "Пешка",
    Knight: "Конь",
    Bishop: "Слон",
    Rook: "Ладья",
    Queen: "Ферзь",
    King: "Король",
    "Formation complete": "Расстановка готова",
    "Start Game": "Начать игру",
    "Invalid formation": "Недопустимая расстановка",
    "New Setup": "Новая расстановка",
    "Game Controls": "Управление",
    "Players and actions": "Действия",
    Undo: "Отменить",
    Restart: "Заново",
    "Captured Pieces": "Взятые фигуры",
    "Material overview": "Материал",
    Equal: "Равно",
    "Move History": "История ходов",
    "Game history": "История партии",
    "No moves yet": "Ходов пока нет",
    "Game Over": "Игра окончена",
    "White wins": "Белые победили",
    "Black wins": "Чёрные победили",
    Draw: "Ничья",
    "History Preview": "Просмотр истории",
    "Back to Live Board": "Вернуться к текущей позиции",
    "Mirror Stats": "Зеркальная статистика",
    Setup: "Расстановка",
    Battle: "Бой",
    Captures: "Взятия",
    Checks: "Шахи",
    Promotions: "Превращения",
    "White placements": "Ходы белых",
    "Black placements": "Ходы чёрных",
  },
};



type VariantAiBoardProps = {
  aiMode?: boolean;
  playerColor?: ChessPlayerColor;
  difficulty?: Difficulty;
  onChangeSettings?: () => void;
};

export default function MirrorChessBoard({
  aiMode = false,
  playerColor = "white",
  difficulty = "casual",
}: VariantAiBoardProps) {
  useUiLanguage();
  const { language, setLanguage } = useAppLanguage();

  const t = (key: string) => {
    if (language === "en") {
      return key;
    }

    if (language === "bar") {
      return translations.bar[key] ?? translations.de[key] ?? ui(key);
    }

    return translations[language][key] ?? ui(key);
  };

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHESS_LANGUAGE_STORAGE_KEY, nextLanguage);
    }
  }

  const [setupState, setSetupState] = useState<MirrorSetupState>(() =>
    createInitialMirrorSetupState(createMirrorSeed()),
  );

  const [setupError, setSetupError] = useState("");

  const [phase, setPhase] = useState<Phase>("setup");

  const [game] = useState(() => new Chess());

  const [initialFen, setInitialFen] = useState(() => new Chess().fen());

  const [records, setRecords] = useState<MirrorMoveRecord[]>([]);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const [lastMove, setLastMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [promotionFrom, setPromotionFrom] = useState<Square | null>(null);

  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);

  const [gameOver, setGameOver] = useState(false);

  const [gameOverReason, setGameOverReason] = useState("");

  const [winner, setWinner] = useState<Winner>("white");

  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );

  const [statsTab, setStatsTab] = useState<StatsTab>("setup");

  const humanColor = chessColorFromPlayerColor(playerColor);
  const computerColor = oppositeChessColor(humanColor);

  const { ready: aiReady, chooseMove: chooseAiMove } = useVariantChessAi(
    aiMode,
    difficulty,
  );

  const aiMovePendingRef = useRef(false);

  const historyPreview =
    historyPreviewPly !== null
      ? (records[historyPreviewPly - 1] ?? null)
      : null;

  const historyPreviewChess = useMemo(
    () =>
      historyPreview
        ? new Chess(historyPreview.fenAfter, { skipValidation: true })
        : null,
    [historyPreview?.fenAfter],
  );

  const setupBoard = useMemo(
    () => mirrorSetupToBoard(setupState),
    [setupState],
  );

  const displayedChess = historyPreviewChess ?? game;

  const playingBoard = displayedChess.board();

  const board = phase === "setup" ? setupBoard : playingBoard;

  const currentPiece = getCurrentMirrorPiece(setupState);

  const availableSquares = getAvailableMirrorSquares(
    setupState,
    setupState.turn,
  );

  const setupSquares = getMirrorSetupSquares(setupState.turn);

  useEffect(() => {
    if (
      !aiMode ||
      phase !== "setup" ||
      setupState.complete ||
      setupState.turn !== computerColor ||
      availableSquares.length === 0
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      /*
       * The setup draw itself is random and hidden from opening theory.
       * The AI selects a legal square without looking ahead at future draws.
       */
      const index = Math.floor(Math.random() * availableSquares.length);
      const square = availableSquares[index];

      const result = applyMirrorSetupAction(setupState, {
        type: "PLACE_DRAWN_PIECE",
        side: computerColor,
        square,
      });

      if (!result.error) {
        setSetupState(result.state);
        setSetupError("");
        setSelectedSquare(null);

        if (currentPiece) {
          playPieceSelectSound(currentPiece);
        }
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [
    aiMode,
    phase,
    setupState,
    computerColor,
    availableSquares,
    currentPiece,
  ]);

  useEffect(() => {
    if (
      !aiMode ||
      phase !== "playing" ||
      !aiReady ||
      aiMovePendingRef.current ||
      gameOver ||
      historyPreviewPly !== null ||
      promotionFrom ||
      promotionSquare ||
      game.turn() !== computerColor
    ) {
      return;
    }

    const expectedFen = game.fen();
    let cancelled = false;
    aiMovePendingRef.current = true;

    const timer = window.setTimeout(async () => {
      try {
        const move = await chooseAiMove(game);

        if (
          cancelled ||
          !move ||
          game.fen() !== expectedFen ||
          game.turn() !== computerColor
        ) {
          return;
        }

        commitMove(move.from, move.to, move.promotion);
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
    phase,
    aiReady,
    computerColor,
    records.length,
    gameOver,
    historyPreviewPly,
    promotionFrom,
    promotionSquare,
    chooseAiMove,
  ]);

  const currentPreviewSquares: Square[] =
    selectedSquare && phase === "setup"
      ? [selectedSquare, mirrorSquare(selectedSquare)]
      : [];

  const setupStats = buildMirrorSetupStats(setupState);

  const gameStats = buildMirrorGameStats(records);

  /*
   * Playing phase:
   * keep the player who just moved at the bottom for 1.5 seconds.
   */
  const {
    orientation: liveBoardOrientation,
    flipPending,
    snapToSide,
  } = useDelayedBoardOrientation(aiMode ? humanColor : game.turn(), 1500);

  /*
   * Mirror setup phase:
   * after a placement, setupState.turn changes immediately to the
   * next player, but the board remains in the previous player's
   * orientation for 1.5 seconds so the placing player can clearly
   * see the chosen square and its mirrored copy.
   */
  const {
    orientation: setupBoardOrientation,
    flipPending: setupFlipPending,
    snapToSide: snapSetupToSide,
  } = useDelayedBoardOrientation(aiMode ? humanColor : setupState.turn, 1500);

  const boardOrientation: "white" | "black" =
    phase === "setup"
      ? setupBoardOrientation
      : historyPreviewChess
        ? historyPreviewChess.turn() === "w"
          ? "white"
          : "black"
        : liveBoardOrientation;

  const displayedLastMove = historyPreview
    ? {
        from: historyPreview.from,
        to: historyPreview.to,
      }
    : lastMove;

  const checkedKingSquare =
    phase === "playing" ? getCheckedKingSquare(displayedChess) : null;

  const capturedWhite = useMemo(
    () =>
      records
        .filter((record) => record.color === "b" && record.captured)
        .map((record) => record.captured as PieceType),
    [records],
  );

  const capturedBlack = useMemo(
    () =>
      records
        .filter((record) => record.color === "w" && record.captured)
        .map((record) => record.captured as PieceType),
    [records],
  );

  const whiteMaterial = capturedBlack.reduce(
    (total, piece) => total + (pieceValues[piece] ?? 0),
    0,
  );

  const blackMaterial = capturedWhite.reduce(
    (total, piece) => total + (pieceValues[piece] ?? 0),
    0,
  );

  const materialDifference = whiteMaterial - blackMaterial;

  function playSound(sound: string) {
    const audio = new Audio(`/sounds/${sound}.mp3`);

    audio.play().catch(() => {});
  }

  function handleSetupSquareClick(row: number, column: number) {
    if (aiMode && setupState.turn !== humanColor) return;

    if (
      phase !== "setup" ||
      setupState.complete ||
      setupFlipPending ||
      !currentPiece
    ) {
      return;
    }

    const square = getSquareName(row, column);

    if (!availableSquares.includes(square)) {
      playSound("illegal");

      setSetupError("Choose an available square in your two starting ranks.");

      return;
    }

    const result = applyMirrorSetupAction(setupState, {
      type: "PLACE_DRAWN_PIECE",
      side: setupState.turn,
      square,
    });

    if (result.error) {
      setSetupError(result.error);

      playSound("illegal");

      return;
    }

    setSetupState(result.state);

    setSetupError("");

    setSelectedSquare(null);

    playPieceSelectSound(currentPiece);
  }

  function startGame() {
    const validation = isMirrorStartPositionValid(setupState);

    if (!validation.ok) {
      setSetupError(validation.error ?? t("Invalid formation"));

      playSound("illegal");

      return;
    }

    try {
      const fen = buildMirrorStartFen(setupState);

      game.load(fen, { skipValidation: true });
      snapToSide(game.turn());

      setInitialFen(fen);

      setRecords([]);

      setSelectedSquare(null);

      setLegalMoves([]);

      setLastMove(null);

      setPromotionFrom(null);

      setPromotionSquare(null);

      setHistoryPreviewPly(null);

      setGameOver(false);

      setGameOverReason("");

      setWinner("white");

      setPhase("playing");

      setStatsTab("setup");

      updateGameOver([], false);
    } catch {
      setSetupError(t("Invalid formation"));
    }
  }

  function restartSetup() {
    const nextSeed = createMirrorSeed();

    setSetupState(createInitialMirrorSetupState(nextSeed));

    snapSetupToSide("w");

    setSetupError("");

    setPhase("setup");

    setRecords([]);

    setSelectedSquare(null);

    setLegalMoves([]);

    setLastMove(null);

    setPromotionFrom(null);

    setPromotionSquare(null);

    setHistoryPreviewPly(null);

    setGameOver(false);

    setGameOverReason("");

    setWinner("white");

    setStatsTab("setup");

    game.reset();
    snapToSide(game.turn());

    setInitialFen(game.fen());
  }

  function updateGameOver(
    nextRecords: MirrorMoveRecord[],
    playResultSound = false,
  ) {
    if (game.isCheckmate()) {
      setGameOver(true);

      setGameOverReason("Checkmate");

      setWinner(game.turn() === "w" ? "black" : "white");

      if (playResultSound) {
        playSound("checkmate");
      }

      return true;
    }

    if (game.isStalemate()) {
      setGameOver(true);

      setGameOverReason("Stalemate");

      setWinner("draw");

      if (playResultSound) {
        playSound("draw");
      }

      return true;
    }

    if (game.isInsufficientMaterial()) {
      setGameOver(true);

      setGameOverReason("Insufficient material");

      setWinner("draw");

      if (playResultSound) {
        playSound("draw");
      }

      return true;
    }

    if (game.isDrawByFiftyMoves()) {
      setGameOver(true);

      setGameOverReason("50-move rule");

      setWinner("draw");

      if (playResultSound) {
        playSound("draw");
      }

      return true;
    }

    if (isThreefoldMirror(nextRecords, initialFen, game.fen())) {
      setGameOver(true);

      setGameOverReason("Threefold repetition");

      setWinner("draw");

      if (playResultSound) {
        playSound("draw");
      }

      return true;
    }

    setGameOver(false);

    setGameOverReason("");

    return false;
  }

  function commitMove(
    from: Square,
    to: Square,
    promotion?: "q" | "r" | "b" | "n",
  ) {
    if (phase !== "playing" || gameOver || historyPreview) {
      return;
    }

    try {
      const move = game.move({
        from,
        to,
        promotion,
      });

      const captured =
        move.captured === "p" ||
        move.captured === "n" ||
        move.captured === "b" ||
        move.captured === "r" ||
        move.captured === "q"
          ? move.captured
          : undefined;

      const promotedTo =
        move.promotion === "q" ||
        move.promotion === "r" ||
        move.promotion === "b" ||
        move.promotion === "n"
          ? move.promotion
          : undefined;

      const ply = records.length + 1;

      const record: MirrorMoveRecord = {
        ply,

        moveNumber: Math.ceil(ply / 2),

        color: move.color,

        san: move.san,

        from: move.from,

        to: move.to,

        piece: move.piece,

        captured,

        promotion: promotedTo,

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

      if (captured) {
        playPieceCaptureSound(move.piece);
      } else {
        playPieceMoveSound(move.piece);
      }

      const ended = updateGameOver(nextRecords, true);

      if (!ended) {
        if (game.isCheck()) {
          playSound("check");
        } else if (move.isKingsideCastle() || move.isQueensideCastle()) {
          playRandomSound(["castle-1", "castle-2"]);
        }
      }
    } catch {
      playSound("illegal");

      setSelectedSquare(null);

      setLegalMoves([]);
    }
  }

  function handleGameSquareClick(row: number, column: number) {
    if (aiMode && game.turn() !== humanColor) return;

    if (phase !== "playing" || gameOver || historyPreview) {
      return;
    }

    const square = getSquareName(row, column);

    if (selectedSquare === null) {
      const piece = game.get(square);

      if (!piece || piece.color !== game.turn()) {
        return;
      }

      const moves = game.moves({
        square,
        verbose: true,
      });

      if (moves.length === 0) {
        return;
      }

      setSelectedSquare(square);

      playPieceSelectSound(piece.type);

      setLegalMoves(moves.map((move) => move.to));

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

      if (clickedPiece && clickedPiece.color === game.turn()) {
        const moves = game.moves({
          square,
          verbose: true,
        });

        if (moves.length > 0) {
          setSelectedSquare(square);

          playPieceSelectSound(clickedPiece.type);

          setLegalMoves(moves.map((move) => move.to));

          return;
        }
      }

      setSelectedSquare(null);

      setLegalMoves([]);

      playSound("illegal");

      return;
    }

    commitMove(selectedSquare, square);
  }

  function promotePawn(piece: "q" | "r" | "b" | "n") {
    if (!promotionFrom || !promotionSquare) {
      return;
    }

    commitMove(promotionFrom, promotionSquare, piece);
  }

  function undoMove() {
    if (phase !== "playing" || records.length === 0 || aiMode) {
      return;
    }

    const nextRecords = records.slice(0, -1);

    const targetFen =
      nextRecords[nextRecords.length - 1]?.fenAfter ?? initialFen;

    game.load(targetFen, { skipValidation: true });
    snapToSide(game.turn());

    setRecords(nextRecords);

    const previous = nextRecords[nextRecords.length - 1] ?? null;

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

    updateGameOver(nextRecords, false);
  }

  return (
    <div className="chess-variant-page min-h-[calc(100dvh-4rem)] bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-7 flex flex-col gap-4 rounded-3xl border border-zinc-400/10 bg-zinc-900/50 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-3xl shadow-inner">
              ◈
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-violet-300">
                {t("Chess Variant")}
              </p>

              <h1 className="mt-0.5 text-2xl font-black tracking-tight text-white">
                {t("Mirror Chess")}
              </h1>

              <p className="mt-0.5 text-sm text-zinc-500">
                {t("Build one army together")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <LanguageSelector
              language={language}
              onChange={changeLanguage}
              label={t("Language")}
            />

            {phase === "setup" && (
              <div className="rounded-full border border-violet-400/15 bg-violet-400/[0.06] px-3 py-1.5 text-xs font-black text-violet-200">
                {setupFlipPending ? t("Switching sides...") : `${t("Placement turn")}: ${
                      setupState.turn === "w" ? t("White") : t("Black")
                    }`}
              </div>
            )}

            {phase === "playing" && !gameOver && (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />

                {game.turn() === "w" ? t("White to move") : t("Black to move")}
              </div>
            )}
          </div>
          <BoardAnimationToggle />
        </header>

        {phase === "setup" && (
          <section className="mb-6 grid gap-3 rounded-3xl border border-violet-400/10 bg-violet-400/[0.03] px-5 py-4 md:grid-cols-3">
            <RuleStrip
              icon="🎲"
              title={t("Random piece")}
              detail="A seeded standard 16-piece bag decides the next piece"
            />

            <RuleStrip
              icon="◈"
              title={t("Mirrored square")}
              detail="Every placement automatically appears on the opponent's mirrored square"
            />

            <RuleStrip
              icon="↔"
              title={t("Placement turn")}
              detail="White and Black alternate choosing where the random piece goes"
            />
          </section>
        )}

        <main className="grid gap-6 chess-game-grid xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          {/* LEFT */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {phase === "setup" ? (
                <>
                  <Panel>
                    <PanelTitle
                      title={t("Mirror Setup")}
                      subtitle={t("Alternating random construction")}
                    />

                    <div className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.06] p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">
                        {t("Random piece")}
                      </p>

                      {setupFlipPending ? (
                        <div className="py-4">
                          <div className="text-4xl leading-none text-violet-200">
                            ↔
                          </div>

                          <p className="mt-3 text-sm font-black text-violet-100">
                            {t("Switching sides...")}
                          </p>
                        </div>
                      ) : currentPiece ? (
                        <>
                          <div className="mt-3 text-6xl leading-none">
                            {setupState.turn === "w" ? whiteSymbols[currentPiece] : blackSymbols[currentPiece]}
                          </div>

                          <p className="mt-3 text-sm font-black text-white">
                            {t(pieceNames[currentPiece])}
                          </p>

                          <p className="mt-1 text-[10px] text-zinc-500">
                            {t("Place this piece")}
                          </p>
                        </>
                      ) : (
                        <p className="mt-3 text-sm font-black text-emerald-200">
                          {t("Formation complete")}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <SetupStat
                        label={t("Pieces placed")}
                        value={setupStats.placedPairs}
                      />

                      <SetupStat
                        label={t("Pairs left")}
                        value={setupStats.remainingPairs}
                      />
                    </div>

                    {setupError && (
                      <p className="mt-3 rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2 text-xs font-bold text-red-200">
                        {setupError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={restartSetup}
                      className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-bold text-zinc-300 transition hover:bg-white/10"
                    >
                      ↻ {t("New Setup")}
                    </button>

                    {setupState.complete && (
                      <button
                        type="button"
                        onClick={startGame}
                        disabled={setupFlipPending}
                        className="mt-2 w-full rounded-xl bg-violet-300 px-3 py-3 text-sm font-black text-zinc-950 transition hover:bg-violet-200 disabled:cursor-wait disabled:opacity-40"
                      >
                        ▶ {t("Start Game")}
                      </button>
                    )}
                  </Panel>

                  <Panel>
                    <PanelTitle
                      title={t("Your setup zone")}
                      subtitle={t(
                        "The same piece is mirrored automatically for the opponent.",
                      )}
                      compact
                    />

                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-zinc-500">
                      <span className="inline-block h-3 w-3 rounded border border-emerald-300/40" />
                      {t("Available square")}
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-zinc-500">
                      <span className="text-violet-200">◈</span>
                      {t("Mirrored square")}
                    </div>

                    <p className="mt-3 rounded-xl border border-amber-400/10 bg-amber-400/[0.04] px-3 py-2 text-[10px] leading-4 text-zinc-500">
                      {t(
                        "Pawns and non-King pieces may use either setup rank. The King must stay on rank 1/8.",
                      )}
                    </p>
                  </Panel>
                </>
              ) : (
                <>
                  <Panel>
                    <PanelTitle
                      title={t("Game Controls")}
                      subtitle={t("Players and actions")}
                    />

                    <GameControls
                      onUndo={undoMove}
                      onRestart={restartSetup}
                      undoDisabled={aiMode}
                      t={t}
                    />
                  </Panel>

                  <Panel>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <PanelTitle
                        title={t("Captured Pieces")}
                        subtitle={t("Material overview")}
                        compact
                      />

                      <span className="rounded-xl bg-white/5 px-2.5 py-1 text-xs font-bold text-zinc-400">
                        {materialDifference > 0 &&
                          `${t("White")} +${materialDifference}`}

                        {materialDifference < 0 &&
                          `${t("Black")} +${Math.abs(materialDifference)}`}

                        {materialDifference === 0 && t("Equal")}
                      </span>
                    </div>

                    <CapturedPiecesGrid
                      capturedBlack={capturedBlack}
                      capturedWhite={capturedWhite}
                      t={t}
                    />
                  </Panel>

                  <Panel>
                    <div className="mb-4 flex items-center justify-between">
                      <PanelTitle
                        title={t("Move History")}
                        subtitle={t("Game history")}
                        compact
                      />

                      <span className="rounded-xl bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-400">
                        {records.length}
                      </span>
                    </div>

                    <MoveHistory
                      records={records}
                      selectedPly={historyPreviewPly}
                      onSelect={(ply) => {
                        setHistoryPreviewPly(ply);

                        setSelectedSquare(null);

                        setLegalMoves([]);
                      }}
                      emptyLabel={t("No moves yet")}
                    />
                  </Panel>
                </>
              )}
            </div>
          </aside>

          {/* CENTER */}

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {phase === "playing" && gameOver && (
                <GameOverBanner
                  reason={t(gameOverReason)}
                  winner={winner}
                  t={t}
                />
              )}

              {phase === "playing" &&
                promotionSquare &&
                promotionFrom &&
                !historyPreview && (
                  <div className="mb-3 rounded-2xl border border-violet-400/20 bg-zinc-900/90 p-3 shadow-xl">
                    <PromotionBar onPromote={promotePawn} />
                  </div>
                )}

              {phase === "playing" && historyPreview && (
                <div className="mb-3 flex items-center justify-between gap-4 rounded-xl border border-blue-400/20 bg-blue-400/[0.07] px-4 py-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">
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
                    className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-zinc-200 transition hover:bg-white/20"
                  >
                    {t("Back to Live Board")}
                  </button>
                </div>
              )}

              <Board
                board={board}
                selectedSquare={
                  phase === "playing" && !historyPreview ? selectedSquare : null
                }
                legalMoves={
                  phase === "playing" && !historyPreview ? legalMoves : []
                }
                lastMove={phase === "playing" ? displayedLastMove : null}
                checkedKingSquare={checkedKingSquare}
                onSquareClick={
                  phase === "setup"
                    ? setupFlipPending
                      ? () => {}
                      : handleSetupSquareClick
                    : historyPreview || flipPending
                      ? () => {}
                      : handleGameSquareClick
                }
                mirrorSetupSquares={
                  phase === "setup" && !setupFlipPending ? setupSquares : []
                }
                mirrorAvailableSquares={
                  phase === "setup" && !setupFlipPending ? availableSquares : []
                }
                mirrorPreviewSquares={
                  phase === "setup" ? currentPreviewSquares : []
                }
                orientation={boardOrientation}
              />
            </div>
          </section>

          {/* RIGHT */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {phase === "setup" ? (
                <>
                  <section className="rounded-3xl border border-violet-400/15 bg-zinc-900/80 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-base font-black text-zinc-100">
                          {t("Random bag")}
                        </h2>

                        <p className="mt-1 text-xs text-zinc-500">{ui("Seed")}{setupState.seed}
                        </p>
                      </div>

                      <span className="text-2xl">🎲</span>
                    </div>

                    <div className="mt-4 grid grid-cols-6 gap-1">
                      {setupState.bag.map((piece, index) => (
                        <div
                          key={`${piece}-${index}`}
                          className={`
                              rounded-lg
                              border
                              px-1
                              py-2
                              text-center
                              ${
                                index < setupState.drawIndex
                                  ? "border-white/5 bg-black/20 opacity-25"
                                  : index === setupState.drawIndex
                                    ? "border-violet-300/40 bg-violet-400/10"
                                    : "border-white/5 bg-white/[0.03]"
                              }
                            `}
                        >
                          <div className="text-lg leading-none">
                            {setupState.turn === "w" ? whiteSymbols[piece] : blackSymbols[piece]}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                    <h2 className="font-bold text-zinc-100">
                      {t("Mirror Stats")}
                    </h2>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <SetupStat
                        label={t("White placements")}
                        value={setupStats.whitePlaced}
                      />

                      <SetupStat
                        label={t("Black placements")}
                        value={setupStats.blackPlaced}
                      />

                      <SetupStat
                        label={t("Pieces placed")}
                        value={setupStats.placedPairs}
                      />

                      <SetupStat
                        label={t("Pairs left")}
                        value={setupStats.remainingPairs}
                      />
                    </div>
                  </section>
                </>
              ) : (
                <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                  <h2 className="font-bold text-zinc-100">
                    {t("Mirror Stats")}
                  </h2>

                  <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-white/5 bg-black/20 p-1">
                    {(
                      [
                        ["setup", "Setup"],
                        ["battle", "Battle"],
                      ] as Array<[StatsTab, string]>
                    ).map(([tab, label]) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setStatsTab(tab)}
                        className={`
                            rounded-lg
                            px-2
                            py-2
                            text-[10px]
                            font-black
                            uppercase
                            tracking-wide
                            transition
                            ${
                              statsTab === tab
                                ? "bg-violet-400/15 text-violet-200"
                                : "text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
                            }
                          `}
                      >
                        {t(label)}
                      </button>
                    ))}
                  </div>

                  {statsTab === "setup" && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <SetupStat
                        label={t("White placements")}
                        value={setupStats.whitePlaced}
                      />

                      <SetupStat
                        label={t("Black placements")}
                        value={setupStats.blackPlaced}
                      />
                    </div>
                  )}

                  {statsTab === "battle" && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <SetupStat
                        label={t("Captures")}
                        value={gameStats.captures}
                      />

                      <SetupStat label={t("Checks")} value={gameStats.checks} />

                      <SetupStat
                        label={t("Promotions")}
                        value={gameStats.promotions}
                      />

                      <SetupStat label={ui("Moves")} value={gameStats.moves} />
                    </div>
                  )}
                </section>
              )}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function getCheckedKingSquare(chess: Chess): Square | null {
  if (!chess.isCheck()) {
    return null;
  }

  const board = chess.board();

  const kingColor = chess.turn();

  for (let row = 0; row < board.length; row += 1) {
    for (let column = 0; column < board[row].length; column += 1) {
      const piece = board[row][column];

      if (piece?.type === "k" && piece.color === kingColor) {
        return getSquareName(row, column);
      }
    }
  }

  return null;
}

function RuleStrip({
  icon,
  title,
  detail,
}: {
  icon: string;
  title: string;
  detail: string;
}) {
  useUiLanguage();
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-lg font-black text-violet-200">
        {icon}
      </span>

      <div>
        <p className="text-xs font-black text-zinc-200">{ui(title)}</p>

        <p className="mt-1 text-[10px] leading-4 text-zinc-600">{detail}</p>
      </div>
    </div>
  );
}

function MoveHistory({
  records,
  selectedPly,
  onSelect,
  emptyLabel,
}: {
  records: MirrorMoveRecord[];
  selectedPly: number | null;
  onSelect: (ply: number) => void;
  emptyLabel: string;
}) {
  useUiLanguage();
  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-8 text-center text-xs text-zinc-600">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="max-h-80 overflow-y-auto rounded-2xl border border-white/5 bg-black/20">
      <table className="w-full border-collapse">
        <tbody>
          {records.map((record) => (
            <tr
              key={record.ply}
              onClick={() => onSelect(record.ply)}
              className={`
                  cursor-pointer
                  border-b
                  border-white/5
                  transition
                  last:border-0
                  ${
                    selectedPly === record.ply
                      ? "bg-blue-400/10"
                      : "hover:bg-white/5"
                  }
                `}
            >
              <td className="px-3 py-2.5 text-[10px] text-zinc-600">
                {record.moveNumber}
                {record.color === "w" ? "." : "..."}
              </td>

              <td className="px-2 py-2.5 text-lg">
                {record.color === "w" ? (whiteSymbols[record.piece] ?? "") : (blackSymbols[record.piece] ?? "")}
              </td>

              <td className="px-2 py-2.5 font-mono text-xs font-bold text-zinc-200">
                {record.san}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Panel({ children }: { children: ReactNode }) {
  useUiLanguage();
  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
      {children}
    </section>
  );
}

function PanelTitle({
  title,
  subtitle,
  compact = false,
}: {
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  useUiLanguage();
  return (
    <div className={compact ? "" : "mb-5"}>
      <h2 className="text-sm font-bold text-zinc-100">{ui(title)}</h2>

      <p className="mt-1.5 text-xs text-zinc-500">{ui(subtitle)}</p>
    </div>
  );
}

function SetupStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  useUiLanguage();
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
      <p className="text-lg font-black text-zinc-100">{value}</p>

      <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {ui(label)}
      </p>
    </div>
  );
}

function GameControls({
  onUndo,
  onRestart,
  undoDisabled,
  t,
}: {
  onUndo: () => void;
  onRestart: () => void;
  undoDisabled: boolean;
  t: (key: string) => string;
}) {
  useUiLanguage();
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onUndo}
        disabled={undoDisabled}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed
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
        onClick={onRestart}
        className="rounded-xl border border-violet-400/15 bg-violet-400/[0.06] px-3 py-2.5 text-sm font-bold text-violet-300 transition hover:bg-violet-400/[0.12]"
      >
        ↻ {t("Restart")}
      </button>
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
  useUiLanguage();
  function renderPieces(pieces: PieceType[], color: "w" | "b") {
    return (
      <div className="mt-2 flex min-h-8 flex-wrap gap-1">
        {pieces.length === 0 ? (
          <span className="text-xs text-zinc-700">—</span>
        ) : (
          pieces.map((piece, index) => (
            <span
              key={`${color}-${piece}-${index}`}
              className="flex h-7 w-7 items-center justify-center text-2xl leading-none"
            >
              {color === "w" ? whiteSymbols[piece] : blackSymbols[piece]}
            </span>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
          {t("Black")}
        </p>

        {renderPieces(capturedBlack, "b")}
      </div>

      <div className="mt-3 border-t border-white/5 pt-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
          {t("White")}
        </p>

        {renderPieces(capturedWhite, "w")}
      </div>
    </div>
  );
}

function GameOverBanner({
  reason,
  winner,
  t,
}: {
  reason: string;
  winner: Winner;
  t: (key: string) => string;
}) {
  useUiLanguage();
  return (
    <div className="mb-3 rounded-2xl border border-violet-400/20 bg-violet-400/[0.07] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-violet-300">
            {t("Game Over")}
          </p>

          <p className="mt-1 font-black text-white">{ui(reason)}</p>
        </div>

        <span className="text-sm font-bold text-zinc-300">
          {winner === "draw" ? t("Draw") : winner === "white" ? t("White wins") : t("Black wins")}
        </span>
      </div>
    </div>
  );
}

function LanguageSelector({
  language,
  onChange,
  label,
}: {
  language: Language;
  onChange: (language: Language) => void;
  label: string;
}) {
  useUiLanguage();
  return (
    <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-400">
      <span>🌐</span>

      <span className="hidden sm:inline">{ui(label)}</span>

      <select
        value={language}
        onChange={(event) => onChange(event.target.value as Language)}
        className="bg-transparent text-xs font-bold text-zinc-200 outline-none [color-scheme:dark]"
      >
        <option value="en">{ui("English")}</option>
        <option value="de">{ui("Deutsch")}</option>
        <option value="bar">{ui("Boarisch")}</option>
        <option value="ko">한국어</option>
        <option value="ru">Русский</option>
      </select>
    </label>
  );
}
