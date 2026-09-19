import { useRef, useEffect, useMemo, useState, type ReactNode } from "react";

import { Chess, type Square } from "chess.js";

import { getSquareName, type PieceType } from "../utils/chessUtils";

import Board from "./Board";
import PromotionBar from "./PromotionBar";

import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
  playRandomSound,
} from "../utils/sound.ts";

import {
  DRAFT_BUDGET,
  DRAFT_PIECE_COSTS,
  applyDraftSetupAction,
  buildDraftStartFen,
  canConfirmDraftArmy,
  countDraftPieceType,
  createInitialDraftSetupState,
  draftPlacementsToBoard,
  getDraftKingSquares,
  getDraftRemainingPoints,
  getDraftSetupSquares,
  getDraftSpentPoints,
  randomizeDraftArmy,
  createIndependentRandomDraftSetup,
  validateDraftStartPosition,
  isThreefoldDraft,
  type DraftMoveRecord,
  type DraftPieceType,
  type DraftSetupState,
  type DraftSide,
} from "../games/chess/variants/draftChess";

import {
  buildDraftArmyStats,
  buildDraftGameStats,
} from "../games/chess/variants/draftStats";

import { useDelayedBoardOrientation } from "@/hooks/useDelayedBoardOrientation.ts";
import BoardAnimationToggle from "./BoardAnimationToggle.tsx";
import { useVariantChessAi } from "@/hooks/useVariantChessAi";
import {
  chessColorFromPlayerColor,
  oppositeChessColor,
  type Difficulty,
  type ChessPlayerColor,
} from "../games/chess/ai/variantAi";

type Language = "en" | "de" | "bar" | "ko" | "ru";

type Winner = "white" | "black" | "draw";

type SetupTool = DraftPieceType | "remove";

type Phase = "setup" | "playing";

type PrivacyStep = "none" | "to-black" | "to-game";

type StatsTab = "armies" | "battle";

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

const pieceNames: Record<DraftPieceType, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

const translations: Record<Exclude<Language, "en">, Record<string, string>> = {
  de: {
    Random: "Zufall",
    "Invalid setup replaced with two independent random legal armies.":
      "Die ungültige Aufstellung wurde durch zwei unabhängige zufällige legale Armeen ersetzt.",
    "Chess Variant": "Schachvariante",
    "Draft Chess": "Draft-Schach",
    "Build your own army": "Stelle deine eigene Armee zusammen",
    Language: "Sprache",
    White: "Weiß",
    Black: "Schwarz",
    "White to move": "Weiß am Zug",
    "Black to move": "Schwarz am Zug",
    "39-point budget": "39-Punkte-Budget",
    "Private setup": "Geheimer Aufbau",
    "Army Builder": "Armee-Editor",
    "Choose a piece, then click your setup zone.":
      "Wähle eine Figur und klicke anschließend in deine Aufbauzone.",
    Pawn: "Bauer",
    Knight: "Springer",
    Bishop: "Läufer",
    Rook: "Turm",
    Queen: "Dame",
    King: "König",
    Remove: "Entfernen",
    "Clear Army": "Armee leeren",
    "Confirm Army": "Armee bestätigen",
    "Points left": "Punkte übrig",
    "Points spent": "Punkte ausgegeben",
    Pieces: "Figuren",
    "King ready": "König bereit",
    Missing: "Fehlt",
    Ready: "Bereit",
    "Setup Zone": "Aufbauzone",
    "White may use ranks 1–2. King must be on rank 1.":
      "Weiß darf Reihen 1–2 benutzen. Der König muss auf Reihe 1 stehen.",
    "Black may use ranks 7–8. King must be on rank 8.":
      "Schwarz darf Reihen 7–8 benutzen. Der König muss auf Reihe 8 stehen.",
    "Pass the device": "Gerät weitergeben",
    "White army locked": "Weiße Armee gespeichert",
    "Black army locked": "Schwarze Armee gespeichert",
    "Do not look at the setup": "Nicht auf die Aufstellung schauen",
    "Build Black Army": "Schwarze Armee bauen",
    "Reveal Armies & Start": "Armeen aufdecken & starten",
    "Both armies are ready": "Beide Armeen sind bereit",
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
    "Draft Stats": "Draft-Statistik",
    Armies: "Armeen",
    Battle: "Kampf",
    Captures: "Schlagzüge",
    Checks: "Schachs",
    Promotions: "Umwandlungen",
    "White army": "Weiße Armee",
    "Black army": "Schwarze Armee",
  },

  bar: {
    Random: "Zufall",
    "Invalid setup replaced with two independent random legal armies.":
      "De ungültige Aufstellung is durch zwoa unabhängige zufällige legale Armeen ersetzt worn.",
    "Chess Variant": "Schachvariantn",
    "Draft Chess": "Draft-Schach",
    "Build your own army": "Bau da dei eigene Armee",
    Language: "Sproch",
    White: "Weiß",
    Black: "Schwarz",
    "White to move": "Weiß is dro",
    "Black to move": "Schwarz is dro",
    "39-point budget": "39-Punkte-Budget",
    "Private setup": "Geheimer Aufbau",
    "Army Builder": "Armee-Bauer",
    "Choose a piece, then click your setup zone.":
      "Such da a Figur aus und klick in deine Aufbauzone.",
    Pawn: "Baua",
    Knight: "Springa",
    Bishop: "Läufa",
    Rook: "Turm",
    Queen: "Dame",
    King: "Kini",
    Remove: "Wegnehma",
    "Clear Army": "Armee leern",
    "Confirm Army": "Armee bestätigen",
    "Points left": "Punkte übrig",
    "Points spent": "Punkte ausgebn",
    Pieces: "Figuren",
    "King ready": "Kini bereit",
    Missing: "Fehlt",
    Ready: "Bereit",
    "Setup Zone": "Aufbauzone",
    "White may use ranks 1–2. King must be on rank 1.":
      "Weiß darf Reihe 1–2 nutzen. Da Kini muaß auf Reihe 1 bleibn.",
    "Black may use ranks 7–8. King must be on rank 8.":
      "Schwarz darf Reihe 7–8 nutzen. Da Kini muaß auf Reihe 8 bleibn.",
    "Pass the device": "Gerät weitergebn",
    "White army locked": "Weiße Armee is gespeichert",
    "Black army locked": "Schwarze Armee is gespeichert",
    "Do not look at the setup": "Ned auf de Aufstellung schaun",
    "Build Black Army": "Schwarze Armee baun",
    "Reveal Armies & Start": "Armeen aufdeckn & startn",
    "Both armies are ready": "Beide Armeen san bereit",
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
    "Draft Stats": "Draft-Statistik",
    Armies: "Armeen",
    Battle: "Kampf",
    Captures: "Schlagzüg",
    Checks: "Schachs",
    Promotions: "Umwandlungen",
    "White army": "Weiße Armee",
    "Black army": "Schwarze Armee",
  },

  ko: {
    Random: "랜덤",
    "Invalid setup replaced with two independent random legal armies.":
      "유효하지 않은 배치가 서로 다른 두 개의 독립적인 랜덤 합법 군대로 자동 교체되었습니다.",
    "Chess Variant": "체스 변형",
    "Draft Chess": "드래프트 체스",
    "Build your own army": "직접 군대를 구성합니다",
    Language: "언어",
    White: "백",
    Black: "흑",
    "White to move": "백 차례",
    "Black to move": "흑 차례",
    "39-point budget": "39포인트 예산",
    "Private setup": "비공개 배치",
    "Army Builder": "군대 구성",
    "Choose a piece, then click your setup zone.":
      "기물을 선택한 뒤 자신의 배치 구역을 클릭하세요.",
    Pawn: "폰",
    Knight: "나이트",
    Bishop: "비숍",
    Rook: "룩",
    Queen: "퀸",
    King: "킹",
    Remove: "제거",
    "Clear Army": "군대 초기화",
    "Confirm Army": "군대 확정",
    "Points left": "남은 포인트",
    "Points spent": "사용 포인트",
    Pieces: "기물",
    "King ready": "킹 준비",
    Missing: "없음",
    Ready: "준비",
    "Setup Zone": "배치 구역",
    "White may use ranks 1–2. King must be on rank 1.":
      "백은 1–2랭크만 사용할 수 있으며 킹은 반드시 1랭크에 있어야 합니다.",
    "Black may use ranks 7–8. King must be on rank 8.":
      "흑은 7–8랭크만 사용할 수 있으며 킹은 반드시 8랭크에 있어야 합니다.",
    "Pass the device": "기기를 넘겨주세요",
    "White army locked": "백 군대 확정 완료",
    "Black army locked": "흑 군대 확정 완료",
    "Do not look at the setup": "상대 배치를 보지 마세요",
    "Build Black Army": "흑 군대 구성",
    "Reveal Armies & Start": "군대 공개 및 시작",
    "Both armies are ready": "양쪽 군대 준비 완료",
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
    "Draft Stats": "드래프트 통계",
    Armies: "군대",
    Battle: "전투",
    Captures: "잡은 수",
    Checks: "체크",
    Promotions: "프로모션",
    "White army": "백 군대",
    "Black army": "흑 군대",
  },

  ru: {
    Random: "Случайно",
    "Invalid setup replaced with two independent random legal armies.":
      "Недопустимая расстановка была заменена двумя независимыми случайными легальными армиями.",
    "Chess Variant": "Шахматный вариант",
    "Draft Chess": "Драфт-шахматы",
    "Build your own army": "Соберите свою армию",
    Language: "Язык",
    White: "Белые",
    Black: "Чёрные",
    "White to move": "Ход белых",
    "Black to move": "Ход чёрных",
    "39-point budget": "Бюджет 39 очков",
    "Private setup": "Скрытая расстановка",
    "Army Builder": "Конструктор армии",
    "Choose a piece, then click your setup zone.":
      "Выберите фигуру и затем нажмите на поле своей зоны расстановки.",
    Pawn: "Пешка",
    Knight: "Конь",
    Bishop: "Слон",
    Rook: "Ладья",
    Queen: "Ферзь",
    King: "Король",
    Remove: "Удалить",
    "Clear Army": "Очистить армию",
    "Confirm Army": "Подтвердить армию",
    "Points left": "Осталось очков",
    "Points spent": "Потрачено очков",
    Pieces: "Фигуры",
    "King ready": "Король готов",
    Missing: "Нет",
    Ready: "Готов",
    "Setup Zone": "Зона расстановки",
    "White may use ranks 1–2. King must be on rank 1.":
      "Белые используют только ряды 1–2. Король должен быть на ряду 1.",
    "Black may use ranks 7–8. King must be on rank 8.":
      "Чёрные используют только ряды 7–8. Король должен быть на ряду 8.",
    "Pass the device": "Передайте устройство",
    "White army locked": "Армия белых сохранена",
    "Black army locked": "Армия чёрных сохранена",
    "Do not look at the setup": "Не смотрите на расстановку",
    "Build Black Army": "Собрать армию чёрных",
    "Reveal Armies & Start": "Показать армии и начать",
    "Both armies are ready": "Обе армии готовы",
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
    "Draft Stats": "Статистика драфта",
    Armies: "Армии",
    Battle: "Бой",
    Captures: "Взятия",
    Checks: "Шахи",
    Promotions: "Превращения",
    "White army": "Армия белых",
    "Black army": "Армия чёрных",
  },
};

function getInitialLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem(CHESS_LANGUAGE_STORAGE_KEY);

  if (
    stored === "en" ||
    stored === "de" ||
    stored === "bar" ||
    stored === "ko" ||
    stored === "ru"
  ) {
    return stored;
  }

  return "en";
}

type VariantAiBoardProps = {
  aiMode?: boolean;
  playerColor?: ChessPlayerColor;
  difficulty?: Difficulty;
  onChangeSettings?: () => void;
};

export default function DraftChessBoard({
  aiMode = false,
  playerColor = "white",
  difficulty = "casual",
}: VariantAiBoardProps) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  const t = (key: string) => {
    if (language === "en") {
      return key;
    }

    if (language === "bar") {
      return translations.bar[key] ?? translations.de[key] ?? key;
    }

    return translations[language][key] ?? key;
  };

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHESS_LANGUAGE_STORAGE_KEY, nextLanguage);
    }
  }

  const humanColor = chessColorFromPlayerColor(playerColor);
  const computerColor = oppositeChessColor(humanColor);

  const { ready: aiReady, chooseMove: chooseAiMove } = useVariantChessAi(
    aiMode,
    difficulty,
  );

  const aiMovePendingRef = useRef(false);

  const [setupState, setSetupState] = useState<DraftSetupState>(
    createInitialDraftSetupState,
  );

  const [setupSide, setSetupSide] = useState<DraftSide>(() =>
    aiMode ? humanColor : "w",
  );

  const [setupTool, setSetupTool] = useState<SetupTool>("p");

  const [setupError, setSetupError] = useState("");

  const [autoRandomFallbackUsed, setAutoRandomFallbackUsed] = useState(false);

  const [phase, setPhase] = useState<Phase>("setup");

  const [privacyStep, setPrivacyStep] = useState<PrivacyStep>("none");

  const [game] = useState(() => new Chess());

  const [initialFen, setInitialFen] = useState(() => new Chess().fen());

  const [records, setRecords] = useState<DraftMoveRecord[]>([]);

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

  const [statsTab, setStatsTab] = useState<StatsTab>("armies");

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

  const historyPreview =
    historyPreviewPly !== null
      ? (records[historyPreviewPly - 1] ?? null)
      : null;

  const historyPreviewChess = useMemo(
    () => (historyPreview ? new Chess(historyPreview.fenAfter) : null),
    [historyPreview?.fenAfter],
  );

  const setupBoard = useMemo(
    () => draftPlacementsToBoard(setupState, setupSide),
    [setupState, setupSide],
  );

  const displayedChess = historyPreviewChess ?? game;

  const playingBoard = displayedChess.board();

  const {
    orientation: liveBoardOrientation,
    flipPending,
    snapToSide,
  } = useDelayedBoardOrientation(aiMode ? humanColor : game.turn(), 1500);

  const boardOrientation: "white" | "black" =
    phase === "setup"
      ? aiMode
        ? humanColor === "w"
          ? "white"
          : "black"
        : setupSide === "w"
          ? "white"
          : "black"
      : historyPreviewChess
        ? historyPreviewChess.turn() === "w"
          ? "white"
          : "black"
        : liveBoardOrientation;

  const currentSetupSquares = getDraftSetupSquares(setupSide);

  const kingSetupSquares =
    setupTool === "k" ? getDraftKingSquares(setupSide) : [];

  const remainingPoints = getDraftRemainingPoints(setupState, setupSide);

  const spentPoints = getDraftSpentPoints(setupState, setupSide);

  const currentArmyStats = buildDraftArmyStats(setupState, setupSide);

  const whiteArmyStats = buildDraftArmyStats(setupState, "w");

  const blackArmyStats = buildDraftArmyStats(setupState, "b");

  const gameStats = buildDraftGameStats(records);

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

  function applySetupAction(
    action: Parameters<typeof applyDraftSetupAction>[1],
  ) {
    const result = applyDraftSetupAction(setupState, action);

    if (result.error) {
      setSetupError(result.error);
      playSound("illegal");
      return false;
    }

    setSetupState(result.state);

    setSetupError("");

    return true;
  }

  function handleSetupSquareClick(row: number, column: number) {
    if (aiMode && setupSide !== humanColor) return;

    if (phase !== "setup" || privacyStep !== "none") {
      return;
    }

    const square = getSquareName(row, column);

    if (setupTool === "remove") {
      applySetupAction({
        type: "REMOVE_PIECE",
        side: setupSide,
        square,
      });

      return;
    }

    applySetupAction({
      type: "PLACE_PIECE",
      side: setupSide,
      square,
      piece: setupTool,
    });
  }

  function clearCurrentArmy() {
    applySetupAction({
      type: "RESET_ARMY",
      side: setupSide,
    });
  }

  function randomizeCurrentArmy() {
    const nextState = randomizeDraftArmy(setupState, setupSide);

    setSetupState(nextState);

    setSetupTool("p");
    setSetupError("");

    playRandomSound(["castle-1", "castle-2"]);
  }

  function confirmCurrentArmy() {
    const validation = canConfirmDraftArmy(setupState, setupSide);

    if (!validation.ok) {
      setSetupError(validation.error ?? "Army is not ready.");

      playSound("illegal");

      return;
    }

    const result = applyDraftSetupAction(setupState, {
      type: "CONFIRM_ARMY",
      side: setupSide,
    });

    if (result.error) {
      setSetupError(result.error);
      return;
    }

    if (aiMode) {
      /*
       * In Vs AI the human builds only their own army.
       * The opponent receives a legal randomized army using the same
       * 39-point rules, then both sides are confirmed.
       */
      const aiSide: DraftSide = computerColor;
      const randomized = randomizeDraftArmy(result.state, aiSide);
      const confirmedAi = applyDraftSetupAction(randomized, {
        type: "CONFIRM_ARMY",
        side: aiSide,
      });

      if (confirmedAi.error) {
        setSetupError(confirmedAi.error);
        return;
      }

      setSetupState(confirmedAi.state);
      setSetupError("");
      setPrivacyStep("to-game");
      return;
    }

    setSetupState(result.state);

    setSetupError("");

    if (setupSide === "w") {
      setPrivacyStep("to-black");
    } else {
      setPrivacyStep("to-game");
    }
  }

  function revealBlackSetup() {
    setSetupSide("b");

    setSetupTool("p");

    setSetupError("");
    setPrivacyStep("none");
  }

  function startDraftGame() {
    let stateToStart = setupState;

    let usedFallback = false;

    let validation = validateDraftStartPosition(stateToStart);

    if (!validation.ok || !validation.fen) {
      const fallback = createIndependentRandomDraftSetup();

      stateToStart = fallback.state;

      validation = validateDraftStartPosition(stateToStart);

      if (!validation.ok || !validation.fen) {
        setSetupError(
          validation.error ??
            "Could not generate a legal random starting position.",
        );

        playSound("illegal");

        return;
      }

      setSetupState(stateToStart);

      usedFallback = true;
    }

    const fen = validation.fen;

    game.load(fen);

    snapToSide(game.turn());

    setAutoRandomFallbackUsed(usedFallback);

    setSetupError("");

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
    setPrivacyStep("none");
    setStatsTab("armies");

    updateGameOver([], false);
  }

  function updateGameOver(
    nextRecords: DraftMoveRecord[],
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

    if (isThreefoldDraft(nextRecords, initialFen, game.fen())) {
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

      const record: DraftMoveRecord = {
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
    if (phase !== "playing" || records.length === 0) {
      return;
    }

    const nextRecords = records.slice(0, -1);

    const targetFen =
      nextRecords[nextRecords.length - 1]?.fenAfter ?? initialFen;

    game.load(targetFen);
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

  function restartDraft() {
    const fresh = createInitialDraftSetupState();

    setSetupState(fresh);

    setSetupSide("w");

    setSetupTool("p");

    setSetupError("");
    setAutoRandomFallbackUsed(false);

    setPhase("setup");

    setPrivacyStep("none");

    game.reset();
    snapToSide(game.turn());

    setInitialFen(game.fen());

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

    setStatsTab("armies");
  }

  const board = phase === "setup" ? setupBoard : playingBoard;

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-7 flex flex-col gap-4 rounded-3xl border border-emerald-400/10 bg-zinc-900/50 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-3xl shadow-inner">
              ⚔
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-300">
                {t("Chess Variant")}
              </p>

              <h1 className="mt-0.5 text-2xl font-black tracking-tight text-white">
                {t("Draft Chess")}
              </h1>

              <p className="mt-0.5 text-sm text-zinc-500">
                {t("Build your own army")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <LanguageSelector
              language={language}
              onChange={changeLanguage}
              label={t("Language")}
            />

            <div className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-xs font-black text-emerald-200">
              {t("39-point budget")}
            </div>

            {phase === "playing" && !gameOver && (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

                {game.turn() === "w" ? t("White to move") : t("Black to move")}
              </div>
            )}
          </div>
          <BoardAnimationToggle />
        </header>

        {phase === "setup" && (
          <section className="mb-6 rounded-3xl border border-emerald-400/10 bg-emerald-400/[0.03] px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                  {t("Private setup")} ·{" "}
                  {setupSide === "w" ? t("White") : t("Black")}
                </p>

                <p className="mt-1 text-sm text-zinc-400">
                  {setupSide === "w"
                    ? t("White may use ranks 1–2. King must be on rank 1.")
                    : t("Black may use ranks 7–8. King must be on rank 8.")}
                </p>
              </div>

              <div className="flex gap-2">
                <BudgetPill label={t("Points left")} value={remainingPoints} />

                <BudgetPill label={t("Points spent")} value={spentPoints} />
              </div>
            </div>
          </section>
        )}

        <main className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          {/* LEFT */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {phase === "setup" ? (
                <>
                  <Panel>
                    <PanelTitle
                      title={t("Army Builder")}
                      subtitle={t(
                        "Choose a piece, then click your setup zone.",
                      )}
                    />

                    <PiecePalette
                      side={setupSide}
                      selected={setupTool}
                      remaining={remainingPoints}
                      onSelect={setSetupTool}
                      t={t}
                    />

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={clearCurrentArmy}
                        className="rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 text-[11px] font-bold text-zinc-300 transition hover:bg-white/10"
                      >
                        ↺ {t("Clear Army")}
                      </button>

                      <button
                        type="button"
                        onClick={randomizeCurrentArmy}
                        className="rounded-xl border border-violet-400/20 bg-violet-400/[0.07] px-2 py-2.5 text-[11px] font-black text-violet-200 transition hover:bg-violet-400/[0.13]"
                      >
                        🎲 {t("Random")}
                      </button>

                      <button
                        type="button"
                        onClick={confirmCurrentArmy}
                        disabled={
                          !canConfirmDraftArmy(setupState, setupSide).ok
                        }
                        className="rounded-xl bg-emerald-300 px-2 py-2.5 text-[11px] font-black text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        ✓ {t("Confirm Army")}
                      </button>
                    </div>

                    {setupError && (
                      <p className="mt-3 rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2 text-xs font-bold text-red-200">
                        {setupError}
                      </p>
                    )}
                  </Panel>

                  <Panel>
                    <PanelTitle
                      title={t("Setup Zone")}
                      subtitle={
                        setupSide === "w"
                          ? t(
                              "White may use ranks 1–2. King must be on rank 1.",
                            )
                          : t(
                              "Black may use ranks 7–8. King must be on rank 8.",
                            )
                      }
                      compact
                    />

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <SetupStat
                        label={t("Pieces")}
                        value={currentArmyStats.pieces}
                      />

                      <SetupStat
                        label={t("King ready")}
                        value={
                          countDraftPieceType(setupState, setupSide, "k") === 1
                            ? t("Ready")
                            : t("Missing")
                        }
                      />
                    </div>
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
                      onRestart={restartDraft}
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
              {phase === "playing" && autoRandomFallbackUsed && (
                <div className="mb-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3 text-xs font-bold text-amber-100">
                  🎲{" "}
                  {t(
                    "Invalid setup replaced with two independent random legal armies.",
                  )}
                </div>
              )}

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
                  <div className="mb-3 rounded-2xl border border-emerald-400/20 bg-zinc-900/90 p-3 shadow-xl">
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

              <div className="relative">
                <Board
                  board={board}
                  selectedSquare={
                    phase === "playing" && !historyPreview
                      ? selectedSquare
                      : null
                  }
                  legalMoves={
                    phase === "playing" && !historyPreview ? legalMoves : []
                  }
                  lastMove={phase === "playing" ? displayedLastMove : null}
                  checkedKingSquare={checkedKingSquare}
                  onSquareClick={
                    phase === "setup"
                      ? handleSetupSquareClick
                      : historyPreview || flipPending
                        ? () => {}
                        : handleGameSquareClick
                  }
                  draftSetupSquares={
                    phase === "setup" ? currentSetupSquares : []
                  }
                  draftKingSquares={phase === "setup" ? kingSetupSquares : []}
                  orientation={boardOrientation}
                />

                {phase === "setup" && privacyStep !== "none" && (
                  <PrivacyOverlay
                    step={privacyStep}
                    t={t}
                    onContinue={
                      privacyStep === "to-black"
                        ? revealBlackSetup
                        : startDraftGame
                    }
                  />
                )}
              </div>
            </div>
          </section>

          {/* RIGHT */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {phase === "setup" ? (
                <section className="rounded-3xl border border-emerald-400/15 bg-zinc-900/80 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black text-zinc-100">
                        {setupSide === "w" ? t("White army") : t("Black army")}
                      </h2>

                      <p className="mt-1 text-xs text-zinc-500">
                        {t("Private setup")}
                      </p>
                    </div>

                    <span className="text-2xl">⚔</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <SetupStat
                      label={t("Points left")}
                      value={currentArmyStats.remaining}
                    />

                    <SetupStat
                      label={t("Pieces")}
                      value={currentArmyStats.pieces}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-5 gap-1">
                    <TinyPieceStat
                      symbol={setupSide === "w" ? "♙" : "♟"}
                      value={currentArmyStats.pawns}
                    />

                    <TinyPieceStat
                      symbol={setupSide === "w" ? "♘" : "♞"}
                      value={currentArmyStats.knights}
                    />

                    <TinyPieceStat
                      symbol={setupSide === "w" ? "♗" : "♝"}
                      value={currentArmyStats.bishops}
                    />

                    <TinyPieceStat
                      symbol={setupSide === "w" ? "♖" : "♜"}
                      value={currentArmyStats.rooks}
                    />

                    <TinyPieceStat
                      symbol={setupSide === "w" ? "♕" : "♛"}
                      value={currentArmyStats.queens}
                    />
                  </div>
                </section>
              ) : (
                <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                  <h2 className="font-bold text-zinc-100">
                    {t("Draft Stats")}
                  </h2>

                  <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-white/5 bg-black/20 p-1">
                    {(
                      [
                        ["armies", "Armies"],
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
                                ? "bg-emerald-400/15 text-emerald-200"
                                : "text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
                            }
                          `}
                      >
                        {t(label)}
                      </button>
                    ))}
                  </div>

                  {statsTab === "armies" && (
                    <div className="mt-4 space-y-3">
                      <ArmySummary
                        title={t("White army")}
                        stats={whiteArmyStats}
                        symbol="♔"
                      />

                      <ArmySummary
                        title={t("Black army")}
                        stats={blackArmyStats}
                        symbol="♚"
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

                      <SetupStat label="Moves" value={gameStats.moves} />
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

function PiecePalette({
  side,
  selected,
  remaining,
  onSelect,
  t,
}: {
  side: DraftSide;
  selected: SetupTool;
  remaining: number;
  onSelect: (tool: SetupTool) => void;
  t: (key: string) => string;
}) {
  const pieces: DraftPieceType[] = ["p", "n", "b", "r", "q", "k"];

  return (
    <div className="grid grid-cols-2 gap-2">
      {pieces.map((piece) => {
        const cost = DRAFT_PIECE_COSTS[piece];

        const disabled = piece !== "k" && cost > remaining;

        const symbol = side === "w" ? whiteSymbols[piece] : blackSymbols[piece];

        return (
          <button
            key={piece}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(piece)}
            className={`
                flex
                items-center
                justify-between
                rounded-xl
                border
                px-3
                py-2.5
                text-left
                transition
                ${
                  selected === piece
                    ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                }
                disabled:cursor-not-allowed
                disabled:opacity-30
              `}
          >
            <span className="flex items-center gap-2">
              <span className="text-2xl leading-none">{symbol}</span>

              <span className="text-[10px] font-black">
                {t(pieceNames[piece])}
              </span>
            </span>

            <span className="rounded-lg bg-black/20 px-1.5 py-1 text-[9px] font-black">
              {cost}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => onSelect("remove")}
        className={`
          col-span-2
          rounded-xl
          border
          px-3
          py-2.5
          text-xs
          font-black
          transition
          ${
            selected === "remove"
              ? "border-red-300/35 bg-red-400/10 text-red-200"
              : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
          }
        `}
      >
        ✕ {t("Remove")}
      </button>
    </div>
  );
}

function PrivacyOverlay({
  step,
  t,
  onContinue,
}: {
  step: PrivacyStep;
  t: (key: string) => string;
  onContinue: () => void;
}) {
  const toBlack = step === "to-black";

  return (
    <div className="absolute inset-0 z-[90] flex items-center justify-center rounded-xl bg-zinc-950/96 p-6 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-emerald-400/20 bg-zinc-900/95 p-7 text-center shadow-2xl shadow-black/60">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-4xl">
          🛡
        </div>

        <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
          {t("Pass the device")}
        </p>

        <h2 className="mt-2 text-2xl font-black text-white">
          {toBlack ? t("White army locked") : t("Both armies are ready")}
        </h2>

        <p className="mt-3 text-sm text-zinc-500">
          {toBlack ? t("Do not look at the setup") : t("Black army locked")}
        </p>

        <button
          type="button"
          onClick={onContinue}
          className="mt-6 w-full rounded-xl bg-emerald-300 px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-emerald-200"
        >
          {toBlack ? t("Build Black Army") : t("Reveal Armies & Start")}
        </button>
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
  records: DraftMoveRecord[];
  selectedPly: number | null;
  onSelect: (ply: number) => void;
  emptyLabel: string;
}) {
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
                {record.color === "w"
                  ? (whiteSymbols[record.piece] ?? "")
                  : (blackSymbols[record.piece] ?? "")}
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
  return (
    <div className={compact ? "" : "mb-5"}>
      <h2 className="text-sm font-bold text-zinc-100">{title}</h2>

      <p className="mt-1.5 text-xs text-zinc-500">{subtitle}</p>
    </div>
  );
}

function BudgetPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.05] px-3 py-2 text-center">
      <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {label}
      </p>

      <p className="mt-1 text-lg font-black text-emerald-200">{value}</p>
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
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
      <p className="text-lg font-black text-zinc-100">{value}</p>

      <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {label}
      </p>
    </div>
  );
}

function TinyPieceStat({ symbol, value }: { symbol: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 px-1 py-2 text-center">
      <div className="text-xl leading-none">{symbol}</div>

      <div className="mt-1 text-[10px] font-black text-zinc-500">{value}</div>
    </div>
  );
}

function ArmySummary({
  title,
  stats,
  symbol,
}: {
  title: string;
  stats: ReturnType<typeof buildDraftArmyStats>;
  symbol: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-black text-zinc-300">{title}</span>

        <span className="text-xl">{symbol}</span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-black text-white">{stats.pieces}</p>

          <p className="text-[8px] uppercase text-zinc-600">pieces</p>
        </div>

        <div>
          <p className="text-lg font-black text-emerald-200">{stats.spent}</p>

          <p className="text-[8px] uppercase text-zinc-600">spent</p>
        </div>

        <div>
          <p className="text-lg font-black text-zinc-400">{stats.remaining}</p>

          <p className="text-[8px] uppercase text-zinc-600">left</p>
        </div>
      </div>
    </div>
  );
}

function GameControls({
  onUndo,
  onRestart,
  t,
}: {
  onUndo: () => void;
  onRestart: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onUndo}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
      >
        ↶ {t("Undo")}
      </button>

      <button
        type="button"
        onClick={onRestart}
        className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-2.5 text-sm font-bold text-emerald-300 transition hover:bg-emerald-400/[0.12]"
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
  return (
    <div className="mb-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
            {t("Game Over")}
          </p>

          <p className="mt-1 font-black text-white">{reason}</p>
        </div>

        <span className="text-sm font-bold text-zinc-300">
          {winner === "draw"
            ? t("Draw")
            : winner === "white"
              ? t("White wins")
              : t("Black wins")}
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
  return (
    <label className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-400">
      <span>🌐</span>

      <span className="hidden sm:inline">{label}</span>

      <select
        value={language}
        onChange={(event) => onChange(event.target.value as Language)}
        className="bg-transparent text-xs font-bold text-zinc-200 outline-none [color-scheme:dark]"
      >
        <option value="en">English</option>
        <option value="de">Deutsch</option>
        <option value="bar">Boarisch</option>
        <option value="ko">한국어</option>
        <option value="ru">Русский</option>
      </select>
    </label>
  );
}
