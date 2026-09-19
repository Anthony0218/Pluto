import { useRef, useEffect, useMemo, useState } from "react";

import { Chess, type Square } from "chess.js";

import { getSquareName, type PieceType } from "../utils/chessUtils";

import Board from "./Board";

import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
  playRandomSound,
} from "../utils/sound.ts";

import PromotionBar from "./PromotionBar";

import {
  MUTATION_INTERVAL_PLIES,
  applyScheduledMutation,
  createMutationSeed,
  getPliesUntilNextMutation,
  isThreefoldFromRecords,
  type MutationEvent,
  type MutationMoveRecord,
  type MutationPieceType,
} from "../games/chess/variants/mutationChess";

import { buildMutationStats } from "../games/chess/variants/mutationStats";

import { useDelayedBoardOrientation } from "@/hooks/useDelayedBoardOrientation.ts";
import BoardAnimationToggle from "./BoardAnimationToggle.tsx";
import { useVariantChessAi } from "@/hooks/useVariantChessAi";
import {
  chessColorFromPlayerColor,
  oppositeChessColor,
  type Difficulty,
  type ChessPlayerColor,
} from "../games/chess/ai/variantAi";

/* =========================================================
   TYPES
   ========================================================= */

type Language = "en" | "de" | "bar" | "ko" | "ru";
type StatsTab = "overview" | "chaos" | "moments";

type Winner = "white" | "black" | "draw";

const CHESS_LANGUAGE_STORAGE_KEY = "chess-language";

/* =========================================================
   PIECES
   ========================================================= */

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

const pieceNames: Record<MutationPieceType, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
};

/* =========================================================
   TRANSLATIONS
   ========================================================= */

const translations: Record<Exclude<Language, "en">, Record<string, string>> = {
  de: {
    "Chess Variant": "Schachvariante",
    "Mutation Chess": "Mutationsschach",
    "Every 5 full moves, one piece changes":
      "Alle 5 vollen Züge verändert sich eine Figur",
    Language: "Sprache",
    "White to move": "Weiß am Zug",
    "Black to move": "Schwarz am Zug",
    "Game Controls": "Spielsteuerung",
    "Players and actions": "Spieler und Aktionen",
    "White player": "Spieler Weiß",
    "Black player": "Spieler Schwarz",
    White: "Weiß",
    Black: "Schwarz",
    Undo: "Rückgängig",
    Restart: "Neustart",
    "Captured Pieces": "Geschlagene Figuren",
    "Material overview": "Materialübersicht",
    Equal: "Gleich",
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
    Material: "Material",
    "Mutation Status": "Mutationsstatus",
    "Next mutation": "Nächste Mutation",
    plies: "Halbzüge",
    "full moves": "volle Züge",
    "Last mutation": "Letzte Mutation",
    "No mutation yet": "Noch keine Mutation",
    "Mutation Stats": "Mutationsstatistik",
    "Fun numbers from this match": "Spaßzahlen aus dieser Partie",
    Overview: "Übersicht",
    Chaos: "Chaos",
    Moments: "Momente",
    "Total mutations": "Mutationen gesamt",
    "White pieces": "Weiße Figuren",
    "Black pieces": "Schwarze Figuren",
    Upgrades: "Verbesserungen",
    Downgrades: "Verschlechterungen",
    Sidegrades: "Seitwärtswechsel",
    "Chaos score": "Chaoswert",
    "Net mutation value": "Netto-Mutationswert",
    "Favorite result": "Häufigstes Ergebnis",
    "Biggest upgrade": "Größtes Upgrade",
    "Biggest downgrade": "Größtes Downgrade",
    "Mutation timeline": "Mutationsverlauf",
    "No mutation events yet": "Noch keine Mutationsereignisse",
    "Click a mutation to show that position":
      "Mutation anklicken, um die Stellung zu zeigen",
    Pawn: "Bauer",
    Knight: "Springer",
    Bishop: "Läufer",
    Rook: "Turm",
    Queen: "Dame",
    "Random non-king piece": "Zufällige Nicht-Königsfigur",
    "Same color · different piece": "Gleiche Farbe · andere Figur",
  },
  bar: {
    "Chess Variant": "Schachvariantn",
    "Mutation Chess": "Mutationsschach",
    "Every 5 full moves, one piece changes":
      "Alle 5 ganze Züg verändert si a Figur",
    Language: "Sproch",
    "White to move": "Weiß is dro",
    "Black to move": "Schwarz is dro",
    "Game Controls": "Spielsteuerung",
    "Players and actions": "Spieler und Aktionen",
    "White player": "Weißer Spieler",
    "Black player": "Schwarzer Spieler",
    White: "Weiß",
    Black: "Schwarz",
    Undo: "Zruck",
    Restart: "Neu startn",
    "Captured Pieces": "G'schlagene Figuren",
    "Material overview": "Material",
    Equal: "Gleich",
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
    Material: "Material",
    "Mutation Status": "Mutationsstatus",
    "Next mutation": "Nächste Mutation",
    plies: "Halbzüg",
    "full moves": "volle Züg",
    "Last mutation": "Letzte Mutation",
    "No mutation yet": "No koa Mutation",
    "Mutation Stats": "Mutationsstatistik",
    "Fun numbers from this match": "A paar lustige Zahlen",
    Overview: "Übersicht",
    Chaos: "Chaos",
    Moments: "Momente",
    "Total mutations": "Mutationen",
    "White pieces": "Weiße Figuren",
    "Black pieces": "Schwarze Figuren",
    Upgrades: "Upgrades",
    Downgrades: "Downgrades",
    Sidegrades: "Seitwärts",
    "Chaos score": "Chaoswert",
    "Net mutation value": "Mutationswert",
    "Favorite result": "Häufigstes Ergebnis",
    "Biggest upgrade": "Größtes Upgrade",
    "Biggest downgrade": "Größtes Downgrade",
    "Mutation timeline": "Mutationsverlauf",
    "No mutation events yet": "No koa Mutation",
    "Click a mutation to show that position":
      "Mutation anklickn für de Stellung",
    Pawn: "Bauer",
    Knight: "Springer",
    Bishop: "Läufer",
    Rook: "Turm",
    Queen: "Dame",
    "Random non-king piece": "Zufällige Figur außer'm Kini",
    "Same color · different piece": "Gleiche Farb · andere Figur",
  },
  ko: {
    "Chess Variant": "체스 변형",
    "Mutation Chess": "돌연변이 체스",
    "Every 5 full moves, one piece changes": "5수마다 기물 하나가 변합니다",
    Language: "언어",
    "White to move": "백 차례",
    "Black to move": "흑 차례",
    "Game Controls": "게임 컨트롤",
    "Players and actions": "플레이어 및 게임 조작",
    "White player": "백 플레이어",
    "Black player": "흑 플레이어",
    White: "백",
    Black: "흑",
    Undo: "되돌리기",
    Restart: "새 게임",
    "Captured Pieces": "잡힌 기물",
    "Material overview": "기물 현황",
    Equal: "동일",
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
    Material: "기물",
    "Mutation Status": "돌연변이 상태",
    "Next mutation": "다음 돌연변이",
    plies: "하프무브",
    "full moves": "풀무브",
    "Last mutation": "최근 돌연변이",
    "No mutation yet": "아직 돌연변이 없음",
    "Mutation Stats": "돌연변이 통계",
    "Fun numbers from this match": "이번 게임의 재미있는 기록",
    Overview: "개요",
    Chaos: "카오스",
    Moments: "순간들",
    "Total mutations": "총 돌연변이",
    "White pieces": "백 기물",
    "Black pieces": "흑 기물",
    Upgrades: "업그레이드",
    Downgrades: "다운그레이드",
    Sidegrades: "동급 변화",
    "Chaos score": "카오스 점수",
    "Net mutation value": "순 돌연변이 가치",
    "Favorite result": "가장 자주 나온 기물",
    "Biggest upgrade": "최대 업그레이드",
    "Biggest downgrade": "최대 다운그레이드",
    "Mutation timeline": "돌연변이 기록",
    "No mutation events yet": "아직 돌연변이가 없습니다",
    "Click a mutation to show that position":
      "돌연변이를 클릭하면 해당 보드를 표시합니다",
    Pawn: "폰",
    Knight: "나이트",
    Bishop: "비숍",
    Rook: "룩",
    Queen: "퀸",
    "Random non-king piece": "킹이 아닌 무작위 기물",
    "Same color · different piece": "같은 색 · 다른 기물",
  },
  ru: {
    "Chess Variant": "Шахматный вариант",
    "Mutation Chess": "Мутационные шахматы",
    "Every 5 full moves, one piece changes":
      "Каждые 5 полных ходов одна фигура меняется",
    Language: "Язык",
    "White to move": "Ход белых",
    "Black to move": "Ход чёрных",
    "Game Controls": "Управление",
    "Players and actions": "Игроки и действия",
    "White player": "Белые",
    "Black player": "Чёрные",
    White: "Белые",
    Black: "Чёрные",
    Undo: "Отменить",
    Restart: "Заново",
    "Captured Pieces": "Взятые фигуры",
    "Material overview": "Материал",
    Equal: "Равно",
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
    Checkmate: "Мат",
    Stalemate: "Пат",
    "Insufficient material": "Недостаточно материала",
    "50-move rule": "Правило 50 ходов",
    "Threefold repetition": "Троекратное повторение",
    "History Preview": "Просмотр истории",
    "Back to Live Board": "Вернуться к текущей позиции",
    Material: "Материал",
    "Mutation Status": "Статус мутации",
    "Next mutation": "Следующая мутация",
    plies: "полуходов",
    "full moves": "полных ходов",
    "Last mutation": "Последняя мутация",
    "No mutation yet": "Мутаций пока нет",
    "Mutation Stats": "Статистика мутаций",
    "Fun numbers from this match": "Забавные цифры партии",
    Overview: "Обзор",
    Chaos: "Хаос",
    Moments: "Моменты",
    "Total mutations": "Всего мутаций",
    "White pieces": "Белые фигуры",
    "Black pieces": "Чёрные фигуры",
    Upgrades: "Улучшения",
    Downgrades: "Ухудшения",
    Sidegrades: "Равные замены",
    "Chaos score": "Очки хаоса",
    "Net mutation value": "Чистая ценность мутаций",
    "Favorite result": "Любимый результат",
    "Biggest upgrade": "Самое большое улучшение",
    "Biggest downgrade": "Самое большое ухудшение",
    "Mutation timeline": "Хронология мутаций",
    "No mutation events yet": "Мутаций пока не было",
    "Click a mutation to show that position":
      "Нажмите мутацию, чтобы показать позицию",
    Pawn: "Пешка",
    Knight: "Конь",
    Bishop: "Слон",
    Rook: "Ладья",
    Queen: "Ферзь",
    "Random non-king piece": "Случайная фигура, кроме короля",
    "Same color · different piece": "Тот же цвет · другая фигура",
  },
};

function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";

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

/* =========================================================
   COMPONENT
   ========================================================= */

type VariantAiBoardProps = {
  aiMode?: boolean;
  playerColor?: ChessPlayerColor;
  difficulty?: Difficulty;
  onChangeSettings?: () => void;
};

export default function MutationChessBoard({
  aiMode = false,
  playerColor = "white",
  difficulty = "casual",
}: VariantAiBoardProps) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  const t = (key: string) => {
    if (language === "en") return key;

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

  /* =======================================================
     GAME STATE
     ======================================================= */

  const [game] = useState(() => new Chess());

  const [records, setRecords] = useState<MutationMoveRecord[]>([]);

  const [mutationSeed, setMutationSeed] = useState<number>(createMutationSeed);

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

  const [whitePlayer, setWhitePlayer] = useState("");
  const [blackPlayer, setBlackPlayer] = useState("");

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

  const [statsTab, setStatsTab] = useState<StatsTab>("overview");

  /* =======================================================
     DERIVED GAME DATA
     ======================================================= */

  const board = game.board();

  const historyPreview =
    historyPreviewPly !== null
      ? (records[historyPreviewPly - 1] ?? null)
      : null;

  const historyPreviewChess = useMemo(
    () => (historyPreview ? new Chess(historyPreview.fenAfter) : null),
    [historyPreview?.fenAfter],
  );

  const displayedBoard = historyPreviewChess
    ? historyPreviewChess.board()
    : board;

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

  const historyPreviewMove = historyPreview
    ? {
        from: historyPreview.from,
        to: historyPreview.to,
      }
    : null;

  const checkedKingSquare = getCheckedKingSquare(game);

  const historyPreviewCheckedKingSquare = historyPreviewChess
    ? getCheckedKingSquare(historyPreviewChess)
    : null;

  const lastRecord = records[records.length - 1] ?? null;

  const displayedMutationSquares: Square[] = historyPreview?.mutation
    ? [historyPreview.mutation.square]
    : !historyPreview && lastRecord?.mutation
      ? [lastRecord.mutation.square]
      : [];

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

  const mutationStats = useMemo(() => buildMutationStats(records), [records]);

  const pliesUntilMutation = getPliesUntilNextMutation(records.length);

  const fullMovesUntilMutation = Math.ceil(pliesUntilMutation / 2);

  /* =======================================================
     SOUND
     ======================================================= */

  function playSound(sound: string) {
    const audio = new Audio(`/sounds/${sound}.mp3`);

    audio.play().catch(() => {});
  }

  /* =======================================================
     GAME OVER
     ======================================================= */

  function updateGameOver(
    nextRecords: MutationMoveRecord[],
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

    if (isThreefoldFromRecords(nextRecords, game.fen())) {
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

  function standardGameEndedBeforeMutation(currentFen: string) {
    return (
      game.isCheckmate() ||
      game.isStalemate() ||
      game.isInsufficientMaterial() ||
      game.isDrawByFiftyMoves() ||
      isThreefoldFromRecords(records, currentFen)
    );
  }

  /* =======================================================
     MOVE FINALIZATION
     ======================================================= */

  function commitMove(
    from: Square,
    to: Square,
    promotion?: "q" | "r" | "b" | "n",
  ) {
    if (gameOver || historyPreview) return;

    try {
      const move = game.move({
        from,
        to,
        promotion,
      });

      /*
       * chess.js exposes captured/promotion as PieceSymbol | undefined,
       * but MutationMoveRecord uses stricter legal subsets.
       * Narrow them before creating the record.
       */
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

      const nextPly = records.length + 1;

      /*
       * Normal chess endings resolve before the scheduled mutation.
       * A mutation itself may still CREATE check/checkmate/stalemate.
       */
      const endedBeforeMutation = standardGameEndedBeforeMutation(game.fen());

      let mutation: MutationEvent | null = null;

      if (!endedBeforeMutation && nextPly % MUTATION_INTERVAL_PLIES === 0) {
        mutation = applyScheduledMutation(
          game,
          mutationSeed,
          Math.floor(nextPly / MUTATION_INTERVAL_PLIES),
          nextPly,
        );
      }

      const record: MutationMoveRecord = {
        ply: nextPly,
        moveNumber: Math.ceil(nextPly / 2),
        color: move.color,
        san: move.san,
        from: move.from,
        to: move.to,
        piece: move.piece,
        captured,
        promotion: promotedTo,
        fenAfter: game.fen(),
        mutation,
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

  /* =======================================================
     BOARD INPUT
     ======================================================= */

  function handleSquareClick(row: number, column: number) {
    if (aiMode && game.turn() !== humanColor) {
      return;
    }

    if (gameOver || historyPreview) {
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

      const moves = game.moves({
        square,
        verbose: true,
      });

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
        setSelectedSquare(square);

        playPieceSelectSound(clickedPiece.type);

        const moves = game.moves({
          square,
          verbose: true,
        });

        setLegalMoves(moves.map((move) => move.to));

        return;
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

  /* =======================================================
     UNDO / RESTART
     ======================================================= */

  function undoMove() {
    if (records.length === 0 || aiMode) return;

    const nextRecords = records.slice(0, -1);

    const targetFen =
      nextRecords[nextRecords.length - 1]?.fenAfter ?? new Chess().fen();

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

  function restartGame() {
    game.reset();
    snapToSide(game.turn());

    setRecords([]);
    setMutationSeed(createMutationSeed());

    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPromotionFrom(null);
    setPromotionSquare(null);
    setHistoryPreviewPly(null);
    setStatsTab("overview");

    setGameOver(false);
    setGameOverReason("");
    setWinner("white");
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div
      className="
        min-h-screen
        bg-zinc-950
        px-4
        py-6
        text-zinc-100
        sm:px-6
      "
    >
      <div className="mx-auto max-w-[1500px]">
        {/* HEADER */}

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
                border-violet-400/20
                bg-violet-400/10
                text-3xl
                shadow-inner
              "
            >
              🧬
            </div>

            <div>
              <p
                className="
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.28em]
                  text-violet-300
                "
              >
                {t("Chess Variant")}
              </p>

              <h1 className="mt-0.5 text-2xl font-black tracking-tight text-white">
                {t("Mutation Chess")}
              </h1>

              <p className="mt-0.5 text-sm text-zinc-500">
                {t("Every 5 full moves, one piece changes")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <ChessLanguageSelector
              language={language}
              onChange={changeLanguage}
              label={t("Language")}
            />

            <div
              className="
                rounded-full
                border
                border-violet-400/15
                bg-violet-400/[0.07]
                px-3
                py-1.5
                text-xs
                font-black
                text-violet-200
              "
            >
              ✦ {pliesUntilMutation} {t("plies")}
            </div>

            {!gameOver && (
              <div
                className="
                  flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-white/10
                  bg-white/5
                  px-3
                  py-1.5
                  text-xs
                  font-bold
                  text-zinc-300
                "
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />

                {game.turn() === "w" ? t("White to move") : t("Black to move")}
              </div>
            )}
          </div>
          <BoardAnimationToggle />
        </header>

        {/* RULE STRIP */}

        <section
          className="
            mb-6
            grid
            gap-3
            rounded-3xl
            border
            border-violet-400/10
            bg-violet-400/[0.035]
            px-5
            py-4
            sm:grid-cols-2
          "
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎲</span>

            <div>
              <p className="text-xs font-black text-violet-200">
                {t("Random non-king piece")}
              </p>

              <p className="mt-1 text-[10px] text-zinc-600">
                {t("Every 5 full moves, one piece changes")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-2xl">✦</span>

            <div>
              <p className="text-xs font-black text-violet-200">
                {t("Same color · different piece")}
              </p>

              <p className="mt-1 text-[10px] text-zinc-600">
                Pawn · Knight · Bishop · Rook · Queen
              </p>
            </div>
          </div>
        </section>

        {/* MAIN */}

        <main
          className="
            grid
            gap-6
            xl:grid-cols-[300px_minmax(0,1fr)_300px]
          "
        >
          {/* LEFT */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel>
                <PanelTitle
                  title={t("Game Controls")}
                  subtitle={t("Players and actions")}
                />

                <MutationGameControls
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

                  <span
                    className={`
                      rounded-xl
                      px-2.5
                      py-1
                      text-xs
                      font-bold

                      ${
                        materialDifference > 0
                          ? "bg-amber-400/10 text-amber-200"
                          : materialDifference < 0
                            ? "bg-white/10 text-zinc-300"
                            : "bg-white/5 text-zinc-500"
                      }
                    `}
                  >
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

                <div className="max-h-80 overflow-y-auto rounded-2xl border border-white/5 bg-black/20">
                  {records.length === 0 ? (
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
                        {records.map((record) => {
                          const selected = historyPreviewPly === record.ply;

                          return (
                            <tr
                              key={record.ply}
                              tabIndex={0}
                              onClick={() => {
                                setHistoryPreviewPly(record.ply);
                                setSelectedSquare(null);
                                setLegalMoves([]);
                              }}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  setHistoryPreviewPly(record.ply);
                                  setSelectedSquare(null);
                                  setLegalMoves([]);
                                }
                              }}
                              className={`
                                cursor-pointer
                                border-b
                                border-white/5
                                transition
                                last:border-0

                                ${
                                  selected
                                    ? "bg-blue-400/10"
                                    : "hover:bg-white/5"
                                }
                              `}
                            >
                              <td className="px-3 py-2.5 text-[10px] text-zinc-600">
                                {record.moveNumber}
                                {record.color === "w" ? "." : "..."}
                              </td>

                              <td className="px-2 py-2.5">
                                <span className="text-xs text-zinc-500">
                                  {record.color === "w"
                                    ? `♔ ${t("White")}`
                                    : `♚ ${t("Black")}`}
                                </span>
                              </td>

                              <td className="px-2 py-2.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="w-5 text-center text-lg leading-none">
                                    {historyPieceSymbol(
                                      record.color,
                                      record.piece,
                                    )}
                                  </span>

                                  <span className="font-mono text-xs font-bold text-zinc-200">
                                    {record.san}
                                  </span>

                                  {record.mutation && (
                                    <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[9px] font-black text-violet-300">
                                      ✦ {mutationShortLabel(record.mutation)}
                                    </span>
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
              </Panel>
            </div>
          </aside>

          {/* CENTER */}

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {gameOver && (
                <div className="mb-3 rounded-2xl border border-violet-400/20 bg-violet-400/[0.07] px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-violet-300">
                        {t("Game Over")}
                      </p>

                      <p className="mt-1 font-black text-white">
                        {t(gameOverReason)}
                      </p>
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
              )}

              {promotionSquare && promotionFrom && !historyPreview && (
                <div className="mb-3 rounded-2xl border border-violet-400/20 bg-zinc-900/90 p-3 shadow-xl">
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

                    {historyPreview.mutation && (
                      <p className="mt-1 text-[10px] font-bold text-violet-300">
                        ✦ {formatMutation(historyPreview.mutation, t)}
                      </p>
                    )}
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
                board={displayedBoard}
                selectedSquare={historyPreview ? null : selectedSquare}
                legalMoves={historyPreview ? [] : legalMoves}
                lastMove={historyPreviewMove ?? lastMove}
                checkedKingSquare={
                  historyPreview
                    ? historyPreviewCheckedKingSquare
                    : checkedKingSquare
                }
                onSquareClick={
                  historyPreview || flipPending ? () => {} : handleSquareClick
                }
                mutationSquares={displayedMutationSquares}
                orientation={boardOrientation}
              />

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-900/75 px-4 py-3 xl:hidden">
                <span className="text-sm text-zinc-500">{t("Material")}</span>

                <span className="text-sm font-bold text-zinc-200">
                  {materialDifference > 0 &&
                    `${t("White")} +${materialDifference}`}

                  {materialDifference < 0 &&
                    `${t("Black")} +${Math.abs(materialDifference)}`}

                  {materialDifference === 0 && t("Equal")}
                </span>
              </div>
            </div>
          </section>

          {/* RIGHT */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <section className="rounded-3xl border border-violet-400/15 bg-zinc-900/80 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-zinc-100">
                      {t("Mutation Status")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Same color · different piece")}
                    </p>
                  </div>

                  <span className="text-2xl text-violet-300">🧬</span>
                </div>

                <div className="mt-4 rounded-2xl border border-violet-400/10 bg-violet-400/[0.05] p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-violet-300">
                    {t("Next mutation")}
                  </p>

                  <div className="mt-2 flex items-end justify-between gap-4">
                    <span className="text-4xl font-black leading-none text-white">
                      {pliesUntilMutation}
                    </span>

                    <div className="text-right">
                      <p className="text-xs font-bold text-zinc-300">
                        {t("plies")}
                      </p>

                      <p className="mt-1 text-[10px] text-zinc-600">
                        ≈ {fullMovesUntilMutation} {t("full moves")}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-white/5 bg-black/20 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                    {t("Last mutation")}
                  </p>

                  {mutationStats.latestMutation ? (
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryPreviewPly(mutationStats.latestMutation!.ply);
                        setSelectedSquare(null);
                        setLegalMoves([]);
                      }}
                      className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl bg-white/[0.025] px-3 py-3 text-left transition hover:bg-violet-400/[0.07]"
                    >
                      <MutationGlyph event={mutationStats.latestMutation} />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-zinc-200">
                          {formatMutation(mutationStats.latestMutation, t)}
                        </p>

                        <p className="mt-1 text-[10px] text-zinc-600">
                          {t("Move")} {mutationStats.latestMutation.moveNumber}
                        </p>
                      </div>
                    </button>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-700">
                      {t("No mutation yet")}
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-zinc-100">
                      {t("Mutation Stats")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Fun numbers from this match")}
                    </p>
                  </div>

                  <span className="rounded-full border border-violet-400/15 bg-violet-400/[0.07] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-violet-300">
                    {mutationStats.totalMutations} ✦
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-white/5 bg-black/20 p-1">
                  {(
                    [
                      ["overview", "Overview"],
                      ["chaos", "Chaos"],
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
                            ? "bg-violet-400/15 text-violet-200"
                            : "text-zinc-600 hover:bg-white/5 hover:text-zinc-300"
                        }
                      `}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>

                {statsTab === "overview" && (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <StatCard
                        icon="✦"
                        label={t("Total mutations")}
                        value={String(mutationStats.totalMutations)}
                        detail={`1 / ${MUTATION_INTERVAL_PLIES} ${t("plies")}`}
                      />

                      <StatCard
                        icon="⚡"
                        label={t("Chaos score")}
                        value={String(mutationStats.chaosScore)}
                        detail="Σ |piece value change|"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <StatCard
                        icon="♔"
                        label={t("White pieces")}
                        value={String(mutationStats.whiteMutations)}
                        detail={formatSigned(mutationStats.whiteNetValue)}
                      />

                      <StatCard
                        icon="♚"
                        label={t("Black pieces")}
                        value={String(mutationStats.blackMutations)}
                        detail={formatSigned(mutationStats.blackNetValue)}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <MiniStat
                        label={t("Upgrades")}
                        value={mutationStats.upgrades}
                      />
                      <MiniStat
                        label={t("Downgrades")}
                        value={mutationStats.downgrades}
                      />
                      <MiniStat
                        label={t("Sidegrades")}
                        value={mutationStats.sidegrades}
                      />
                    </div>
                  </div>
                )}

                {statsTab === "chaos" && (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-violet-400/10 bg-violet-400/[0.04] p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-violet-300">
                        {t("Net mutation value")}
                      </p>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-black/20 p-3">
                          <p className="text-[10px] text-zinc-600">
                            ♔ {t("White")}
                          </p>
                          <p className="mt-1 text-xl font-black text-[#fff3d5]">
                            {formatSigned(mutationStats.whiteNetValue)}
                          </p>
                        </div>

                        <div className="rounded-xl bg-black/20 p-3">
                          <p className="text-[10px] text-zinc-600">
                            ♚ {t("Black")}
                          </p>
                          <p className="mt-1 text-xl font-black text-zinc-200">
                            {formatSigned(mutationStats.blackNetValue)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs text-zinc-500">
                          {t("Favorite result")}
                        </span>

                        <span className="text-sm font-black text-violet-200">
                          {mutationStats.favoriteTarget
                            ? `${
                                whiteSymbols[mutationStats.favoriteTarget]
                              } ${t(pieceNames[mutationStats.favoriteTarget])}`
                            : "—"}
                        </span>
                      </div>
                    </div>

                    <MutationMomentCard
                      title={t("Biggest upgrade")}
                      event={mutationStats.biggestUpgrade}
                      emptyText="—"
                      onSelect={(ply) => setHistoryPreviewPly(ply)}
                      t={t}
                    />

                    <MutationMomentCard
                      title={t("Biggest downgrade")}
                      event={mutationStats.biggestDowngrade}
                      emptyText="—"
                      onSelect={(ply) => setHistoryPreviewPly(ply)}
                      t={t}
                    />
                  </div>
                )}

                {statsTab === "moments" && (
                  <div className="mt-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                      {t("Mutation timeline")}
                    </p>

                    <p className="mt-1 text-[10px] text-zinc-700">
                      {t("Click a mutation to show that position")}
                    </p>

                    {mutationStats.mutations.length === 0 ? (
                      <p className="mt-4 rounded-xl bg-black/20 px-3 py-4 text-xs text-zinc-700">
                        {t("No mutation events yet")}
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {mutationStats.mutations
                          .slice()
                          .reverse()
                          .map((event) => (
                            <button
                              key={`mutation-${event.mutationNumber}`}
                              type="button"
                              onClick={() => {
                                setHistoryPreviewPly(event.ply);
                                setSelectedSquare(null);
                                setLegalMoves([]);
                              }}
                              className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-3 text-left transition hover:border-violet-400/20 hover:bg-violet-400/[0.05]"
                            >
                              <MutationGlyph event={event} />

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-black text-zinc-200">
                                  {formatMutation(event, t)}
                                </p>

                                <p className="mt-1 text-[9px] text-zinc-700">
                                  {t("Move")} {event.moveNumber} ·{" "}
                                  {event.square}
                                </p>
                              </div>

                              <span
                                className={`
                                  text-xs
                                  font-black

                                  ${
                                    event.valueDelta > 0
                                      ? "text-emerald-300"
                                      : event.valueDelta < 0
                                        ? "text-red-300"
                                        : "text-zinc-500"
                                  }
                                `}
                              >
                                {formatSigned(event.valueDelta)}
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

/* =========================================================
   HELPERS
   ========================================================= */

function getCheckedKingSquare(chess: Chess): Square | null {
  if (!chess.isCheck()) return null;

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

function historyPieceSymbol(color: "w" | "b", type: string): string {
  return color === "w"
    ? (whiteSymbols[type] ?? "")
    : (blackSymbols[type] ?? "");
}

function mutationPieceSymbol(
  color: "w" | "b",
  type: MutationPieceType,
): string {
  return color === "w" ? whiteSymbols[type] : blackSymbols[type];
}

function mutationShortLabel(event: MutationEvent): string {
  return `${mutationPieceSymbol(
    event.color,
    event.fromType,
  )}→${mutationPieceSymbol(event.color, event.toType)}`;
}

function formatMutation(
  event: MutationEvent,
  t: (key: string) => string,
): string {
  return `${event.square}: ${t(
    pieceNames[event.fromType],
  )} → ${t(pieceNames[event.toType])}`;
}

function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function Panel({ children }: { children: React.ReactNode }) {
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

function MutationGameControls({
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
  return (
    <div className="space-y-4">
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
  const renderPieces = (pieces: PieceType[], color: "w" | "b") => (
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

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
          {t("Black")}
        </p>

        {renderPieces(capturedBlack, "b")}
      </div>

      <div className="border-t border-white/5 pt-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
          {t("White")}
        </p>

        {renderPieces(capturedWhite, "w")}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">{icon}</span>

        <span className="text-xl font-black text-zinc-100">{value}</span>
      </div>

      <p className="mt-2 text-[10px] font-black uppercase tracking-wider text-zinc-600">
        {label}
      </p>

      <p className="mt-1 text-[10px] text-zinc-700">{detail}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-2 py-3 text-center">
      <p className="text-lg font-black text-zinc-200">{value}</p>

      <p className="mt-1 text-[9px] font-bold text-zinc-600">{label}</p>
    </div>
  );
}

function MutationGlyph({ event }: { event: MutationEvent }) {
  return (
    <div className="flex shrink-0 items-center gap-1 text-xl">
      <span>{mutationPieceSymbol(event.color, event.fromType)}</span>

      <span className="text-xs text-violet-400">→</span>

      <span className="text-violet-200">
        {mutationPieceSymbol(event.color, event.toType)}
      </span>
    </div>
  );
}

function MutationMomentCard({
  title,
  event,
  emptyText,
  onSelect,
  t,
}: {
  title: string;
  event: MutationEvent | null;
  emptyText: string;
  onSelect: (ply: number) => void;
  t: (key: string) => string;
}) {
  return (
    <button
      type="button"
      disabled={!event}
      onClick={() => {
        if (event) onSelect(event.ply);
      }}
      className="w-full rounded-xl border border-white/5 bg-black/20 px-3 py-3 text-left transition enabled:hover:border-violet-400/20 enabled:hover:bg-violet-400/[0.05] disabled:cursor-default"
    >
      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
        {title}
      </p>

      {event ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MutationGlyph event={event} />

            <div>
              <p className="text-xs font-black text-zinc-200">
                {formatMutation(event, t)}
              </p>

              <p className="mt-1 text-[9px] text-zinc-700">
                {t("Move")} {event.moveNumber}
              </p>
            </div>
          </div>

          <span
            className={`
              text-xs
              font-black

              ${
                event.valueDelta > 0
                  ? "text-emerald-300"
                  : event.valueDelta < 0
                    ? "text-red-300"
                    : "text-zinc-500"
              }
            `}
          >
            {formatSigned(event.valueDelta)}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-xs text-zinc-700">{emptyText}</p>
      )}
    </button>
  );
}

function ChessLanguageSelector({
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
        <option value="en" className="bg-zinc-900">
          English
        </option>
        <option value="de" className="bg-zinc-900">
          Deutsch
        </option>
        <option value="bar" className="bg-zinc-900">
          Boarisch
        </option>
        <option value="ko" className="bg-zinc-900">
          한국어
        </option>
        <option value="ru" className="bg-zinc-900">
          Русский
        </option>
      </select>
    </label>
  );
}
