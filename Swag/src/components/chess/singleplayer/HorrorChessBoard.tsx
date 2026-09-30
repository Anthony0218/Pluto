import { playChessSound, type ChessSoundEvent } from "@/games/chess/audio/chessAudio";
import ChessMoveHistoryList from "../ChessMoveHistoryList";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
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
} from "../../../utils/sound.ts";

import {
  HOT_SQUARE_INTERVAL_PLIES,
  createHorrorSeed,
  createInitialHorrorState,
  getActiveHotSquares,
  hasAnyHorrorLegalMove,
  horrorMoveTouchesFire,
  isHorrorMoveAllowed,
  isThreefoldFromHorrorRecords,
  removeHorrorPieceNow,
  legalHorrorMovesForSquare,
  resolveHorrorAfterMove,
  type HorrorMoveRecord,
  type HorrorPieceType,
  type HorrorState,
} from "../../../games/chess/variants/horrorChess.ts";

import { buildHorrorStats } from "../../../games/chess/variants/horrorStats.ts";
import { useDelayedBoardOrientation } from "@/hooks/useDelayedBoardOrientation.ts";
import { useVariantChessAi } from "@/hooks/useVariantChessAi";
import {
  chessColorFromPlayerColor,
  oppositeChessColor,
  type Difficulty,
  type ChessPlayerColor,
} from "../../../games/chess/ai/variantAi.ts";


type StatsTab = "survival" | "plague" | "moments";

type Winner = "white" | "black" | "draw";


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

const translations: Record<"de" | "bar" | "ko" | "ru", Record<string, string>> & Partial<Record<"es" | "pt", Record<string, string>>> = {
  de: {
    "Chess Variant": "Schachvariante",
    "Horror Chess": "Horror-Schach",
    "The board is dangerous": "Das Brett ist gefährlich",
    Language: "Sprache",
    Rulebook: "Regelbuch",
    "White to move": "Weiß am Zug",
    "Black to move": "Schwarz am Zug",
    "Game Controls": "Spielsteuerung",
    "Players and actions": "Aktionen",
    Undo: "Rückgängig",
    Restart: "Neustart",
    "Captured Pieces": "Geschlagene Figuren",
    "Material overview": "Materialübersicht",
    Equal: "Gleich",
    White: "Weiß",
    Black: "Schwarz",
    "Move History": "Zugverlauf",
    "Game history": "Partieverlauf",
    "No moves yet": "Noch keine Züge",
    Move: "Zug",
    Side: "Seite",
    Played: "Gespielt",
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
    Infection: "Infektion",
    "Cursed Pieces": "Verfluchte Figuren",
    "Burning Squares": "Brennende Felder",
    "Knight Freeze": "Springer-Frost",
    "Horror Status": "Horror-Status",
    "Board hazards right now": "Aktuelle Gefahren auf dem Brett",
    Infected: "Infiziert",
    Cursed: "Verflucht",
    Burning: "Brennend",
    Frozen: "Gefroren",
    Doomed: "Verdammt",
    "No frozen piece": "Keine gefrorene Figur",
    "Next fire wave": "Nächste Feuerwelle",
    plies: "Halbzüge",
    "Horror Stats": "Horror-Statistik",
    "Survival numbers": "Überlebenszahlen",
    Survival: "Überleben",
    Plague: "Seuche",
    Moments: "Momente",
    Deaths: "Todesfälle",
    "Curse triggers": "Fluch-Auslöser",
    "Fire triggers": "Feuer-Auslöser",
    "Freeze triggers": "Frost-Auslöser",
    "Infection spreads": "Infektionsausbreitungen",
    "Most chaotic move": "Chaotischster Zug",
    "Horror timeline": "Horror-Verlauf",
    "No horror events yet": "Noch keine Horror-Ereignisse",
    "Click an event to show that position":
      "Ereignis anklicken, um die Stellung zu zeigen",
  },

  bar: {
    "Chess Variant": "Schachvariantn",
    "Horror Chess": "Horror-Schach",
    "The board is dangerous": "Des Brett is g'fährlich",
    Language: "Sproch",
    Rulebook: "Regelbuch",
    "White to move": "Weiß is dro",
    "Black to move": "Schwarz is dro",
    "Game Controls": "Spielsteuerung",
    "Players and actions": "Aktionen",
    Undo: "Zruck",
    Restart: "Neu startn",
    "Captured Pieces": "G'schlagene Figuren",
    "Material overview": "Material",
    Equal: "Gleich",
    White: "Weiß",
    Black: "Schwarz",
    "Move History": "Zugverlauf",
    "Game history": "Partieverlauf",
    "No moves yet": "No koa Zug",
    Move: "Zug",
    Side: "Seitn",
    Played: "G'spuit",
    "Game Over": "Spiel aus",
    "White wins": "Weiß gwinnt",
    "Black wins": "Schwarz gwinnt",
    Draw: "Remis",
    "History Preview": "Verlaufsansicht",
    "Back to Live Board": "Zruck zum Live-Brett",
    Infection: "Infektion",
    "Cursed Pieces": "Verfluchte Figuren",
    "Burning Squares": "Brennende Felder",
    "Knight Freeze": "Springer-Frost",
    "Horror Status": "Horror-Status",
    "Board hazards right now": "Gefahren am Brett",
    Infected: "Infiziert",
    Cursed: "Verflucht",
    Burning: "Brennend",
    Frozen: "G'frorn",
    Doomed: "Verdammt",
    "No frozen piece": "Koa g'frorene Figur",
    "Next fire wave": "Nächste Feuerwelln",
    plies: "Halbzüg",
    "Horror Stats": "Horror-Statistik",
    "Survival numbers": "Überlebenszahlen",
    Survival: "Überleben",
    Plague: "Seuche",
    Moments: "Momente",
    Deaths: "Todesfälle",
    "Curse triggers": "Fluch-Auslöser",
    "Fire triggers": "Feuer-Auslöser",
    "Freeze triggers": "Frost-Auslöser",
    "Infection spreads": "Infektionsausbreitung",
    "Most chaotic move": "Chaotischster Zug",
    "Horror timeline": "Horror-Verlauf",
    "No horror events yet": "No koa Horror-Ereignis",
    "Click an event to show that position": "Ereignis anklickn für de Stellung",
  },

  ko: {
    "Chess Variant": "체스 변형",
    "Horror Chess": "호러 체스",
    "The board is dangerous": "체스판 자체가 위험합니다",
    Language: "언어",
    Rulebook: "규칙 설명",
    "White to move": "백 차례",
    "Black to move": "흑 차례",
    "Game Controls": "게임 컨트롤",
    "Players and actions": "게임 조작",
    Undo: "되돌리기",
    Restart: "새 게임",
    "Captured Pieces": "잡힌 기물",
    "Material overview": "기물 현황",
    Equal: "동일",
    White: "백",
    Black: "흑",
    "Move History": "수 기록",
    "Game history": "게임 기록",
    "No moves yet": "아직 수가 없습니다",
    Move: "수",
    Side: "진영",
    Played: "착수",
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
    Infection: "감염",
    "Cursed Pieces": "저주받은 기물",
    "Burning Squares": "불타는 칸",
    "Knight Freeze": "나이트 동결",
    "Horror Status": "호러 상태",
    "Board hazards right now": "현재 체스판의 위험 상태",
    Infected: "감염",
    Cursed: "저주",
    Burning: "불칸",
    Frozen: "동결",
    Doomed: "죽음 예정",
    "No frozen piece": "동결된 기물 없음",
    "Next fire wave": "다음 화염 웨이브",
    plies: "하프무브",
    "Horror Stats": "호러 통계",
    "Survival numbers": "생존 기록",
    Survival: "생존",
    Plague: "역병",
    Moments: "순간들",
    Deaths: "사망",
    "Curse triggers": "저주 발동",
    "Fire triggers": "화염 발동",
    "Freeze triggers": "동결 발동",
    "Infection spreads": "감염 확산",
    "Most chaotic move": "가장 혼란스러운 수",
    "Horror timeline": "호러 타임라인",
    "No horror events yet": "아직 호러 이벤트가 없습니다",
    "Click an event to show that position":
      "이벤트를 클릭하면 해당 보드를 표시합니다",
  },

  ru: {
    "Chess Variant": "Шахматный вариант",
    "Horror Chess": "Хоррор-шахматы",
    "The board is dangerous": "Сама доска опасна",
    Language: "Язык",
    Rulebook: "Правила",
    "White to move": "Ход белых",
    "Black to move": "Ход чёрных",
    "Game Controls": "Управление",
    "Players and actions": "Действия",
    Undo: "Отменить",
    Restart: "Заново",
    "Captured Pieces": "Взятые фигуры",
    "Material overview": "Материал",
    Equal: "Равно",
    White: "Белые",
    Black: "Чёрные",
    "Move History": "История ходов",
    "Game history": "История партии",
    "No moves yet": "Ходов пока нет",
    Move: "Ход",
    Side: "Сторона",
    Played: "Сыграно",
    "Game Over": "Игра окончена",
    "White wins": "Белые победили",
    "Black wins": "Чёрные победили",
    Draw: "Ничья",
    "History Preview": "Просмотр истории",
    "Back to Live Board": "Вернуться к текущей позиции",
    Infection: "Инфекция",
    "Cursed Pieces": "Проклятые фигуры",
    "Burning Squares": "Горящие поля",
    "Knight Freeze": "Заморозка конём",
    "Horror Status": "Статус ужаса",
    "Board hazards right now": "Опасности на доске",
    Infected: "Заражено",
    Cursed: "Проклято",
    Burning: "Горит",
    Frozen: "Заморожено",
    Doomed: "Обречено",
    "No frozen piece": "Нет замороженной фигуры",
    "Next fire wave": "Следующая волна огня",
    plies: "полуходов",
    "Horror Stats": "Статистика ужаса",
    "Survival numbers": "Статистика выживания",
    Survival: "Выживание",
    Plague: "Чума",
    Moments: "Моменты",
    Deaths: "Смерти",
    "Curse triggers": "Срабатывания проклятия",
    "Fire triggers": "Срабатывания огня",
    "Freeze triggers": "Заморозки",
    "Infection spreads": "Распространение инфекции",
    "Most chaotic move": "Самый хаотичный ход",
    "Horror timeline": "Хронология ужаса",
    "No horror events yet": "Событий ужаса пока нет",
    "Click an event to show that position":
      "Нажмите событие, чтобы показать позицию",
  },
};



type VariantAiBoardProps = {
  aiMode?: boolean;
  playerColor?: ChessPlayerColor;
  difficulty?: Difficulty;
  onChangeSettings?: () => void;
};

export default function HorrorChessBoard({
  aiMode = false,
  playerColor = "white",
  difficulty = "casual",
}: VariantAiBoardProps) {
  useUiLanguage();
  const { language } = useAppLanguage();

  const t = (key: string) => {
    if (language === "en") {
      return key;
    }

    if (language === "bar") {
      return translations.bar[key] ?? translations.de[key] ?? ui(key);
    }

    return translations[language]?.[key] ?? ui(key);
  };

  const [game] = useState(() => new Chess());

  const [horrorSeed, setHorrorSeed] = useState<number>(createHorrorSeed);

  const [horrorState, setHorrorState] = useState<HorrorState>(() =>
    createInitialHorrorState(new Chess(), horrorSeed),
  );

  const [records, setRecords] = useState<HorrorMoveRecord[]>([]);

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
      historyPreviewPly !== null ||
      promotionFrom ||
      promotionSquare ||
      game.turn() !== computerColor
    ) {
      return;
    }

    const expectedFen = game.fen();
    const nextPly = records.length + 1;

    const allowedMoves = game
      .moves({ verbose: true })
      .filter((move) =>
        isHorrorMoveAllowed({
          game,
          state: horrorState,
          from: move.from,
          to: move.to,
          nextPly,
        }),
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
    aiReady,
    computerColor,
    records.length,
    horrorState,
    gameOver,
    historyPreviewPly,
    promotionFrom,
    promotionSquare,
    chooseAiMove,
  ]);

  const [statsTab, setStatsTab] = useState<StatsTab>("survival");

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

  const displayedState = historyPreview?.stateAfter ?? horrorState;

  const displayedRecord = historyPreview ?? records[records.length - 1] ?? null;

  const horrorMessages = displayedRecord
    ? buildHorrorMessages(displayedRecord)
    : [];

  const graveSquares: Square[] = displayedRecord
    ? [...new Set(displayedRecord.event.deaths.map((death) => death.square))]
    : [];

  const selectedStatusMessages =
    !historyPreview && selectedSquare
      ? buildSelectedStatusMessages(selectedSquare, horrorState)
      : [];

  const {
    orientation: liveBoardOrientation,
    flipPending,
    snapToSide,
  } = useDelayedBoardOrientation(aiMode ? humanColor : game.turn(), 1500);

  const boardOrientation: "white" | "black" = historyPreviewChess
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

  const checkedKingSquare = getCheckedKingSquare(displayedChess);

  const nextPly = records.length + 1;

  const displayedHotSquares = historyPreview
    ? displayedState.hotSquares.map((item) => item.square)
    : getActiveHotSquares(horrorState, nextPly);

  const frozenSquares = displayedState.frozen
    ? [displayedState.frozen.square]
    : [];

  const doomedSquares = displayedState.doomed.map((item) => item.square);

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

  const horrorStats = useMemo(
    () => buildHorrorStats(records, horrorState),
    [records, horrorState],
  );

  const fireRemainder = records.length % HOT_SQUARE_INTERVAL_PLIES;

  const pliesUntilFire =
    fireRemainder === 0
      ? HOT_SQUARE_INTERVAL_PLIES
      : HOT_SQUARE_INTERVAL_PLIES - fireRemainder;

  function playSound(sound: string) { playChessSound(sound as ChessSoundEvent); }

  function updateGameOver(
    nextRecords: HorrorMoveRecord[],
    nextState: HorrorState,
    playResultSound = false,
  ) {
    const hasVariantMove = hasAnyHorrorLegalMove({
      game,
      state: nextState,
      nextPly: nextRecords.length + 1,
    });

    if (game.isCheckmate() || (!hasVariantMove && game.isCheck())) {
      setGameOver(true);
      setGameOverReason("Checkmate");

      setWinner(game.turn() === "w" ? "black" : "white");

      if (playResultSound) {
        playSound("checkmate");
      }

      return true;
    }

    if (game.isStalemate() || !hasVariantMove) {
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

    if (isThreefoldFromHorrorRecords(nextRecords, game.fen())) {
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
    if (gameOver || historyPreview) {
      return;
    }

    if (
      !isHorrorMoveAllowed({
        game,
        state: horrorState,
        from,
        to,
        nextPly: records.length + 1,
      })
    ) {
      playSound("illegal");
      return;
    }

    const destinationPiece = game.get(to);

    const moveTouchesFire = horrorMoveTouchesFire({
      state: horrorState,
      from,
      to,
      ply: records.length + 1,
    });

    try {
      const move = game.move({
        from,
        to,
        promotion,
      });

      const captured: HorrorPieceType | undefined =
        move.captured === "p" ||
        move.captured === "n" ||
        move.captured === "b" ||
        move.captured === "r" ||
        move.captured === "q"
          ? move.captured
          : undefined;

      const promotedTo: "q" | "r" | "b" | "n" | undefined =
        move.promotion === "q" ||
        move.promotion === "r" ||
        move.promotion === "b" ||
        move.promotion === "n"
          ? move.promotion
          : undefined;

      let capturedSquare: Square | null = null;

      if (captured) {
        capturedSquare = destinationPiece
          ? move.to
          : (`${move.to[0]}${move.from[1]}` as Square);
      }

      const ply = records.length + 1;

      const knightDirectCheck =
        move.piece === "n" &&
        knightDirectlyAttacksEnemyKing(game, move.to, move.color);

      const result = resolveHorrorAfterMove({
        previousState: horrorState,
        gameAfterMove: game,
        seed: horrorSeed,
        ply,
        move: {
          color: move.color,
          piece: move.piece,
          from: move.from,
          to: move.to,
          captured,
          capturedSquare,
          promotion: promotedTo,
          isCastle: move.isKingsideCastle() || move.isQueensideCastle(),
          isKingsideCastle: move.isKingsideCastle(),
          knightDirectCheck,
        },
      });

      /*
       * PAGE-LEVEL FIRE SAFETY NET
       *
       * This executes before SAN/check/checkmate. Even if some future
       * Horror interaction accidentally leaves the mover alive, a piece
       * that touched fire is removed here before `game.isCheck()`.
       */
      if (moveTouchesFire && move.piece !== "k") {
        const survivor = game.get(move.to);

        if (survivor && survivor.color === move.color) {
          const pawnDoubleStep =
            move.piece === "p" &&
            Math.abs(Number(move.to[1]) - Number(move.from[1])) === 2;

          removeHorrorPieceNow(game, move.to, {
            clearEnPassant: pawnDoubleStep,
          });

          result.state.infectedSquares = result.state.infectedSquares.filter(
            (square) => square !== move.to,
          );

          result.state.cursedSquares = result.state.cursedSquares.filter(
            (square) => square !== move.to,
          );

          result.state.doomed = result.state.doomed.filter(
            (item) => item.square !== move.to,
          );

          const alreadyRecorded = result.event.deaths.some(
            (death) =>
              death.square === move.to &&
              (death.reason === "fire" || death.reason === "curse+fire"),
          );

          if (!alreadyRecorded) {
            result.state.fireTriggers += 1;
            result.state.deaths += 1;
            result.event.fireTriggered = true;

            const vanishedPiece = nonKingPieceType(move.piece);

            if (vanishedPiece) {
              result.event.deaths.push({
                square: move.to,
                reason: "fire",
                piece: vanishedPiece,
              });
            }
          }
        }
      }

      const resolvedSan = game.isCheck()
        ? move.san
        : move.san.replace(/[+#]+$/, "");

      const record: HorrorMoveRecord = {
        ply,
        moveNumber: Math.ceil(ply / 2),
        color: move.color,
        san: resolvedSan,
        from: move.from,
        to: move.to,
        piece: move.piece,
        captured,
        promotion: promotedTo,
        fenAfter: game.fen(),
        stateAfter: result.state,
        event: result.event,
      };

      const nextRecords = [...records, record];

      setRecords(nextRecords);
      setHorrorState(result.state);

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

      const ended = updateGameOver(nextRecords, result.state, true);

      if (!ended) {
        if (game.isCheck()) {
          playSound("check");
        } else if (move.isKingsideCastle() || move.isQueensideCastle()) {
          playChessSound("castle");
        }
      }
    } catch {
      playSound("illegal");
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }

  function handleSquareClick(row: number, column: number) {
    if (aiMode && game.turn() !== humanColor) return;

    if (gameOver || historyPreview) {
      return;
    }

    const square = getSquareName(row, column);

    if (selectedSquare === null) {
      const piece = game.get(square);

      if (!piece || piece.color !== game.turn()) {
        return;
      }

      const moves = legalHorrorMovesForSquare({
        game,
        state: horrorState,
        square,
        nextPly: records.length + 1,
      });

      if (moves.length === 0) {
        if (horrorState.frozen?.square === square) {
          playSound("illegal");
        }

        return;
      }

      setSelectedSquare(square);
      playPieceSelectSound(piece.type);
      setLegalMoves(moves);

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
        const moves = legalHorrorMovesForSquare({
          game,
          state: horrorState,
          square,
          nextPly: records.length + 1,
        });

        if (moves.length > 0) {
          setSelectedSquare(square);
          playPieceSelectSound(clickedPiece.type);
          setLegalMoves(moves);

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
    if (records.length === 0 || aiMode) {
      return;
    }

    const nextRecords = records.slice(0, -1);

    const targetFen =
      nextRecords[nextRecords.length - 1]?.fenAfter ?? new Chess().fen();

    game.load(targetFen);
    snapToSide(game.turn());

    const restoredState =
      nextRecords[nextRecords.length - 1]?.stateAfter ??
      createInitialHorrorState(new Chess(), horrorSeed);

    setRecords(nextRecords);
    setHorrorState(restoredState);

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

    updateGameOver(nextRecords, restoredState, false);
  }

  function restartGame() {
    game.reset();
    snapToSide(game.turn());

    const nextSeed = createHorrorSeed();

    setHorrorSeed(nextSeed);

    setHorrorState(createInitialHorrorState(game, nextSeed));

    setRecords([]);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPromotionFrom(null);
    setPromotionSquare(null);
    setHistoryPreviewPly(null);
    setStatsTab("survival");

    setGameOver(false);
    setGameOverReason("");
    setWinner("white");
  }

  return (
    <div className="min-h-screen bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <ChessPageHeader className="mb-7 flex flex-col gap-4 rounded-3xl border border-rose-400/10 bg-zinc-900/50 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between" description={<> {t("The board is dangerous")} </>}>


          <div className="flex flex-wrap items-center justify-end gap-2">
            <a
              href="/games/chess/variants/horror/rules"
              className="rounded-full border border-rose-400/15 bg-rose-400/[0.06] px-3 py-1.5 text-xs font-black text-rose-200 transition hover:bg-rose-400/[0.12]"
            >
              📖 {t("Rulebook")}
            </a>

            {!gameOver && (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />

                {game.turn() === "w" ? t("White to move") : t("Black to move")}
              </div>
            )}
          </div>
        </ChessPageHeader>

        <section className="mb-6 grid gap-3 rounded-3xl border border-rose-400/10 bg-rose-400/[0.025] px-5 py-4 md:grid-cols-2 xl:grid-cols-4">
          <HazardRule
            icon="☣"
            title={t("Infection")}
            detail="Infected movers spread to one adjacent non-King piece"
          />

          <HazardRule
            icon="☠"
            title={t("Cursed Pieces")}
            detail="Capture one and the capturer dies after the opponent moves"
          />

          <HazardRule
            icon="✹"
            title={t("Burning Squares")}
            detail="Landing on or crossing fire is lethal"
          />

          <HazardRule
            icon="❄"
            title={t("Knight Freeze")}
            detail="A direct Knight check freezes one enemy piece"
          />
        </section>

        <section className="mb-6 rounded-2xl border border-white/5 bg-zinc-900/55 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">{ui("Board legend")}</span>

            <HorrorLegendItem
              icon="☣"
              label={ui("Infected piece")}
              className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
            />

            <HorrorLegendItem
              icon="☠"
              label={ui("Cursed piece")}
              className="border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200"
            />

            <HorrorLegendItem
              icon="🔥"
              label={ui("Burning square")}
              className="border-orange-400/20 bg-orange-400/10 text-orange-200"
            />

            <HorrorLegendItem
              icon="❄"
              label={ui("Frozen piece")}
              className="border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
            />

            <HorrorLegendItem
              icon="×"
              label={ui("Doomed piece")}
              className="border-red-300/30 bg-red-400/10 text-red-200"
            />

            <HorrorLegendItem
              icon="🪦"
              label={ui("Piece vanished here")}
              className="border-zinc-400/20 bg-zinc-400/10 text-zinc-200"
            />
          </div>
        </section>

        <main className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          {/* LEFT */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel>
                <PanelTitle
                  title={t("Game Controls")}
                  subtitle={t("Players and actions")}
                />

                <HorrorGameControls
                  onUndo={undoMove}
                  onRestart={restartGame}
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

                <ChessMoveHistoryList
                  listClassName="max-h-80 rounded-2xl border border-white/5 bg-black/20"
                  selectedPly={historyPreviewPly}
                  emptyLabel={t("No moves yet")}
                  entries={records.map((record) => ({
                    ply: record.ply,
                    side: record.color,
                    moveNumber: record.moveNumber,
                    content: (
                      <>
                        <span className="text-base leading-none">{historyPieceSymbol(record.color, record.piece)}</span>
                        <span className="truncate font-mono text-xs font-bold text-zinc-200">{record.san}</span>
                      </>
                    ),
                    trailing: eventIcons(record),
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

          {/* CENTER */}

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {gameOver && (
                <div className="mb-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-rose-300">
                        {t("Game Over")}
                      </p>

                      <p className="mt-1 font-black text-white">
                        {t(gameOverReason)}
                      </p>
                    </div>

                    <span className="text-sm font-bold text-zinc-300">
                      {winner === "draw" ? t("Draw") : winner === "white" ? t("White wins") : t("Black wins")}
                    </span>
                  </div>
                </div>
              )}

              {promotionSquare && promotionFrom && !historyPreview && (
                <div className="mb-3 rounded-2xl border border-rose-400/20 bg-zinc-900/90 p-3 shadow-xl">
                  <PromotionBar onPromote={promotePawn} />
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

              {(horrorMessages.length > 0 ||
                selectedStatusMessages.length > 0) && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {horrorMessages.map((message, index) => (
                    <HorrorMessageChip
                      key={`event-${displayedRecord?.ply ?? 0}-${index}`}
                      icon={message.icon}
                      text={message.text}
                      tone={message.tone}
                    />
                  ))}

                  {selectedStatusMessages.map((message, index) => (
                    <HorrorMessageChip
                      key={`selected-${selectedSquare ?? "none"}-${index}`}
                      icon={message.icon}
                      text={message.text}
                      tone={message.tone}
                    />
                  ))}
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
                infectedSquares={displayedState.infectedSquares}
                cursedSquares={displayedState.cursedSquares}
                hotSquares={displayedHotSquares}
                frozenSquares={frozenSquares}
                doomedSquares={doomedSquares}
                graveSquares={graveSquares}
                orientation={boardOrientation}
              />
            </div>
          </section>

          {/* RIGHT */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <section className="rounded-3xl border border-rose-400/15 bg-zinc-900/80 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-zinc-100">
                      {t("Horror Status")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Board hazards right now")}
                    </p>
                  </div>

                  <span className="text-2xl">☠</span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <HazardStat
                    icon="☣"
                    label={t("Infected")}
                    value={displayedState.infectedSquares.length}
                  />

                  <HazardStat
                    icon="☠"
                    label={t("Cursed")}
                    value={displayedState.cursedSquares.length}
                  />

                  <HazardStat
                    icon="✹"
                    label={t("Burning")}
                    value={displayedHotSquares.length}
                  />

                  <HazardStat
                    icon="⚠"
                    label={t("Doomed")}
                    value={displayedState.doomed.length}
                  />
                </div>

                <div className="mt-3 rounded-xl border border-cyan-400/10 bg-cyan-400/[0.04] px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-black text-cyan-200">
                      ❄ {t("Frozen")}
                    </span>

                    <span className="font-mono text-xs font-black text-white">
                      {displayedState.frozen ? displayedState.frozen.square : "—"}
                    </span>
                  </div>
                </div>

                {!historyPreview && (
                  <div className="mt-3 rounded-xl border border-orange-400/10 bg-orange-400/[0.04] px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-zinc-500">
                        {t("Next fire wave")}
                      </span>

                      <span className="text-sm font-black text-orange-300">
                        {pliesUntilFire} {t("plies")}
                      </span>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-zinc-100">
                      {t("Horror Stats")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Survival numbers")}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-white/5 bg-black/20 p-1">
                  {(
                    [
                      ["survival", "Survival"],
                      ["plague", "Plague"],
                      ["moments", "Moments"],
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
                            ? "bg-rose-400/15 text-rose-200"
                            : "text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
                        }
                      `}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>

                {statsTab === "survival" && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <StatCard label={t("Deaths")} value={horrorStats.deaths} />

                    <StatCard
                      label={t("Doomed")}
                      value={horrorStats.currentlyDoomed}
                    />

                    <StatCard
                      label={t("Curse triggers")}
                      value={horrorStats.curseTriggers}
                    />

                    <StatCard
                      label={t("Fire triggers")}
                      value={horrorStats.fireTriggers}
                    />
                  </div>
                )}

                {statsTab === "plague" && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <StatCard
                      label={t("Infection spreads")}
                      value={horrorStats.infectionSpreads}
                    />

                    <StatCard
                      label={t("Freeze triggers")}
                      value={horrorStats.freezeTriggers}
                    />

                    <StatCard
                      label={t("Infected")}
                      value={horrorStats.currentInfected}
                    />

                    <StatCard
                      label={t("Cursed")}
                      value={horrorStats.currentCursed}
                    />
                  </div>
                )}

                {statsTab === "moments" && (
                  <div className="mt-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                      {t("Horror timeline")}
                    </p>

                    <p className="mt-1 text-[10px] text-zinc-700">
                      {t("Click an event to show that position")}
                    </p>

                    {horrorStats.moments.length === 0 ? (
                      <p className="mt-4 rounded-xl bg-black/20 px-3 py-4 text-xs text-zinc-700">
                        {t("No horror events yet")}
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {horrorStats.moments
                          .slice()
                          .reverse()
                          .map((record) => (
                            <button
                              key={`horror-${record.ply}`}
                              type="button"
                              onClick={() => {
                                setHistoryPreviewPly(record.ply);
                                setSelectedSquare(null);
                                setLegalMoves([]);
                              }}
                              className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-3 text-left transition hover:border-rose-400/20 hover:bg-rose-400/[0.05]"
                            >
                              <div>
                                <p className="font-mono text-xs font-black text-zinc-200">
                                  {record.san}
                                </p>

                                <p className="mt-1 text-[10px] text-zinc-600">
                                  {eventIcons(record)}
                                </p>
                              </div>

                              <span className="text-[10px] text-zinc-700">
                                #{record.ply}
                              </span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
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

function knightDirectlyAttacksEnemyKing(
  game: Chess,
  knightSquare: Square,
  moverColor: "w" | "b",
): boolean {
  const files = "abcdefgh";

  const knightFile = files.indexOf(knightSquare[0]);

  const knightRank = Number(knightSquare[1]);

  const enemyColor = moverColor === "w" ? "b" : "w";

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const square = getSquareName(row, column);

      const piece = game.get(square);

      if (piece?.type !== "k" || piece.color !== enemyColor) {
        continue;
      }

      const kingFile = files.indexOf(square[0]);

      const kingRank = Number(square[1]);

      const df = Math.abs(knightFile - kingFile);

      const dr = Math.abs(knightRank - kingRank);

      return (df === 1 && dr === 2) || (df === 2 && dr === 1);
    }
  }

  return false;
}

function historyPieceSymbol(color: "w" | "b", type: string) {
  return color === "w"
    ? (whiteSymbols[type] ?? "")
    : (blackSymbols[type] ?? "");
}

function eventIcons(record: HorrorMoveRecord) {
  const icons: string[] = [];

  if (record.event.infectionsAdded.length > 0) {
    icons.push("☣");
  }

  if (record.event.becameCursed || record.event.curseTriggered) {
    icons.push("☠");
  }

  if (record.event.fireTriggered || record.event.hotSpawned.length > 0) {
    icons.push("🔥");
  }

  if (record.event.frozenSquare) {
    icons.push("❄");
  }

  if (record.event.deaths.length > 0) {
    icons.push("†");
  }

  return icons.join(" ");
}

type HorrorMessageTone = "infection" | "curse" | "fire" | "freeze" | "danger";

type HorrorMessage = {
  icon: string;
  text: string;
  tone: HorrorMessageTone;
};

function buildHorrorMessages(record: HorrorMoveRecord): HorrorMessage[] {
  const messages: HorrorMessage[] = [];
  const event = record.event;

  const fireDeaths = event.deaths.filter(
    (death) => death.reason === "fire" || death.reason === "curse+fire",
  );

  const curseDeaths = event.deaths.filter(
    (death) => death.reason === "curse" || death.reason === "curse+fire",
  );

  if (fireDeaths.length > 0) {
    const squares = [...new Set(fireDeaths.map((death) => death.square))];

    messages.push({
      icon: "🔥",
      text: `Burned and vanished · ${squares.join(", ")}`,
      tone: "fire",
    });
  }

  for (const death of event.deaths) {
    messages.push({
      icon: "🪦",
      text: `Rest in piece, ${pieceLabel(death.piece)} · ${death.square}`,
      tone: "danger",
    });
  }

  if (event.infectionsAdded.length > 0) {
    messages.push({
      icon: "☣",
      text: `Infection spread to ${event.infectionsAdded.join(", ")}`,
      tone: "infection",
    });
  }

  if (event.becameCursed) {
    messages.push({
      icon: "☠",
      text: `${event.becameCursed} became cursed`,
      tone: "curse",
    });
  }

  if (event.curseTriggered && curseDeaths.length === 0) {
    messages.push({
      icon: "×",
      text: `${record.to} is doomed by the curse`,
      tone: "danger",
    });
  }

  if (curseDeaths.length > 0) {
    const squares = [...new Set(curseDeaths.map((death) => death.square))];

    messages.push({
      icon: "☠",
      text: `Curse claimed ${squares.join(", ")}`,
      tone: "curse",
    });
  }

  if (event.frozenSquare) {
    messages.push({
      icon: "❄",
      text: `${event.frozenSquare} is frozen for the next turn`,
      tone: "freeze",
    });
  }

  if (event.hotSpawned.length > 0) {
    messages.push({
      icon: "🔥",
      text: `New burning squares: ${event.hotSpawned.join(", ")}`,
      tone: "fire",
    });
  }

  return messages;
}

function buildSelectedStatusMessages(
  square: Square,
  state: HorrorState,
): HorrorMessage[] {
  const messages: HorrorMessage[] = [];

  if (state.infectedSquares.includes(square)) {
    messages.push({
      icon: "☣",
      text: `${square}: infected — moving may spread infection`,
      tone: "infection",
    });
  }

  if (state.cursedSquares.includes(square)) {
    messages.push({
      icon: "☠",
      text: `${square}: cursed — capturing it dooms the capturer`,
      tone: "curse",
    });
  }

  if (state.frozen?.square === square) {
    messages.push({
      icon: "❄",
      text: `${square}: frozen — this piece cannot move`,
      tone: "freeze",
    });
  }

  const doomed = state.doomed.find((item) => item.square === square);

  if (doomed) {
    messages.push({
      icon: "×",
      text: `${square}: doomed — it will disappear after the opponent's move`,
      tone: "danger",
    });
  }

  return messages;
}

function nonKingPieceType(
  piece: "p" | "n" | "b" | "r" | "q" | "k",
): HorrorPieceType | null {
  return piece === "k" ? null : piece;
}

function pieceLabel(piece: "p" | "n" | "b" | "r" | "q" | "k"): string {
  return {
    p: "Pawn",
    n: "Knight",
    b: "Bishop",
    r: "Rook",
    q: "Queen",
    k: "King",
  }[piece];
}

function HorrorMessageChip({
  icon,
  text,
  tone,
}: {
  icon: string;
  text: string;
  tone: HorrorMessageTone;
}) {
  useUiLanguage();
  const toneClass = {
    infection: "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100",
    curse: "border-fuchsia-400/20 bg-fuchsia-400/[0.08] text-fuchsia-100",
    fire: "border-orange-400/25 bg-orange-400/[0.08] text-orange-100",
    freeze: "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-100",
    danger: "border-red-400/25 bg-red-400/[0.08] text-red-100",
  }[tone];

  return (
    <div
      className={`
        inline-flex
        items-center
        gap-2
        rounded-xl
        border
        px-3
        py-2
        text-[11px]
        font-bold
        shadow-sm
        ${toneClass}
      `}
    >
      <span className="text-base leading-none">{icon}</span>

      <span>{ui(text)}</span>
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

function HorrorGameControls({
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
        className="rounded-xl border border-rose-400/15 bg-rose-400/[0.06] px-3 py-2.5 text-sm font-bold text-rose-300 transition hover:bg-rose-400/[0.12]"
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

function HorrorLegendItem({
  icon,
  label,
  className,
}: {
  icon: string;
  label: string;
  className: string;
}) {
  useUiLanguage();
  return (
    <div className="flex items-center gap-2">
      <span
        className={`
          flex
          h-7
          w-7
          items-center
          justify-center
          rounded-lg
          border
          text-base
          font-black
          ${className}
        `}
      >
        {icon}
      </span>

      <span className="text-[10px] font-bold text-zinc-400">{ui(label)}</span>
    </div>
  );
}

function HazardRule({
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
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-400/10 text-lg font-black text-rose-200">
        {icon}
      </span>

      <div>
        <p className="text-xs font-black text-zinc-200">{ui(title)}</p>

        <p className="mt-1 text-[10px] leading-4 text-zinc-600">{detail}</p>
      </div>
    </div>
  );
}

function HazardStat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number;
}) {
  useUiLanguage();
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span>{icon}</span>

        <span className="text-xl font-black text-zinc-100">{value}</span>
      </div>

      <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {ui(label)}
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  useUiLanguage();
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
      <p className="text-xl font-black text-zinc-100">{value}</p>

      <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {ui(label)}
      </p>
    </div>
  );
}

