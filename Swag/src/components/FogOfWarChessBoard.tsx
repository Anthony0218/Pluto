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
  createFogGame,
  createFogSeed,
  getFogSquares,
  getFogVisibleSquares,
  getMaskedBoard,
  isThreefoldFog,
  type FogMoveRecord,
  type FogSide,
} from "../games/chess/variants/fogOfWarChess";
import { buildFogStats } from "../games/chess/variants/fogOfWarStats";

import { useDelayedBoardOrientation } from "@/hooks/useDelayedBoardOrientation.ts";
import BoardAnimationToggle from "./BoardAnimationToggle.tsx";
import { chooseFogAiMove } from "../games/chess/ai/fogOfWarAi";
import {
  chessColorFromPlayerColor,
  oppositeChessColor,
  type Difficulty,
  type ChessPlayerColor,
} from "../games/chess/ai/variantAi";

type Language = "en" | "de" | "bar" | "ko" | "ru";
type Winner = "white" | "black" | "draw";
type StatsTab = "vision" | "battle" | "moments";
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

const translations: Record<Exclude<Language, "en">, Record<string, string>> = {
  de: {
    "Chess Variant": "Schachvariante",
    "Fog of War Chess": "Nebel-des-Krieges-Schach",
    "You cannot see everything": "Du kannst nicht alles sehen",
    Language: "Sprache",
    "White to move": "Weiß am Zug",
    "Black to move": "Schwarz am Zug",
    "Game Controls": "Spielsteuerung",
    "Private hotseat": "Privates Hotseat",
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
    "Fog Status": "Nebelstatus",
    "Current player's vision": "Sicht des aktuellen Spielers",
    Visible: "Sichtbar",
    Hidden: "Verdeckt",
    "Random Start": "Zufallsstart",
    "Same formation for both sides": "Gleiche Formation für beide Seiten",
    "Fog Stats": "Nebelstatistik",
    Vision: "Sicht",
    Battle: "Kampf",
    Moments: "Momente",
    Captures: "Schlagzüge",
    Checks: "Schachs",
    Promotions: "Umwandlungen",
    "Longest capture run": "Längste Schlagserie",
    "Pass the device": "Gerät weitergeben",
    "Do not look at the board": "Nicht auf das Brett schauen",
    "Reveal for": "Aufdecken für",
    "Reveal Board": "Brett aufdecken",
    "Own army": "Eigene Armee",
    "Reachable squares": "Erreichbare Felder",
    "Hidden enemy": "Verdeckter Gegner",
    "Hidden move": "Verdeckter Zug",
  },
  bar: {
    "Chess Variant": "Schachvariantn",
    "Fog of War Chess": "Nebel-Schach",
    "You cannot see everything": "Du siehst ned ois",
    Language: "Sproch",
    "White to move": "Weiß is dro",
    "Black to move": "Schwarz is dro",
    "Game Controls": "Spielsteuerung",
    "Private hotseat": "Privats Hotseat",
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
    "Game Over": "Spiel aus",
    "White wins": "Weiß gwinnt",
    "Black wins": "Schwarz gwinnt",
    Draw: "Remis",
    "History Preview": "Verlaufsansicht",
    "Back to Live Board": "Zruck zum Live-Brett",
    "Fog Status": "Nebelstatus",
    "Current player's vision": "Sicht vom aktuellen Spieler",
    Visible: "Sichtbar",
    Hidden: "Verdeckt",
    "Random Start": "Zufallsstart",
    "Same formation for both sides": "Gleiche Aufstellung für beide",
    "Fog Stats": "Nebelstatistik",
    Vision: "Sicht",
    Battle: "Kampf",
    Moments: "Momente",
    Captures: "Schlagzüg",
    Checks: "Schachs",
    Promotions: "Umwandlungen",
    "Longest capture run": "Längste Schlagserie",
    "Pass the device": "Gerät weitergebn",
    "Do not look at the board": "Ned aufs Brett schaun",
    "Reveal for": "Aufdeckn für",
    "Reveal Board": "Brett aufdeckn",
    "Own army": "Eigene Armee",
    "Reachable squares": "Erreichbare Felder",
    "Hidden enemy": "Verdeckter Gegner",
    "Hidden move": "Verdeckter Zug",
  },
  ko: {
    "Chess Variant": "체스 변형",
    "Fog of War Chess": "전장의 안개 체스",
    "You cannot see everything": "모든 것을 볼 수 없습니다",
    Language: "언어",
    "White to move": "백 차례",
    "Black to move": "흑 차례",
    "Game Controls": "게임 컨트롤",
    "Private hotseat": "프라이버시 핫시트",
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
    "Fog Status": "안개 상태",
    "Current player's vision": "현재 플레이어의 시야",
    Visible: "보임",
    Hidden: "숨김",
    "Random Start": "랜덤 시작",
    "Same formation for both sides": "양쪽 동일한 랜덤 배치",
    "Fog Stats": "안개 통계",
    Vision: "시야",
    Battle: "전투",
    Moments: "순간들",
    Captures: "잡은 수",
    Checks: "체크",
    Promotions: "프로모션",
    "Longest capture run": "최장 연속 캡처",
    "Pass the device": "기기를 넘겨주세요",
    "Do not look at the board": "보드를 보지 마세요",
    "Reveal for": "보드 공개:",
    "Reveal Board": "보드 공개",
    "Own army": "내 기물",
    "Reachable squares": "도달 가능한 칸",
    "Hidden enemy": "숨겨진 상대 기물",
    "Hidden move": "숨겨진 수",
  },
  ru: {
    "Chess Variant": "Шахматный вариант",
    "Fog of War Chess": "Шахматы с туманом войны",
    "You cannot see everything": "Вы видите не всё",
    Language: "Язык",
    "White to move": "Ход белых",
    "Black to move": "Ход чёрных",
    "Game Controls": "Управление",
    "Private hotseat": "Приватный Hotseat",
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
    "Game Over": "Игра окончена",
    "White wins": "Белые победили",
    "Black wins": "Чёрные победили",
    Draw: "Ничья",
    "History Preview": "Просмотр истории",
    "Back to Live Board": "Вернуться к текущей позиции",
    "Fog Status": "Статус тумана",
    "Current player's vision": "Обзор текущего игрока",
    Visible: "Видимо",
    Hidden: "Скрыто",
    "Random Start": "Случайный старт",
    "Same formation for both sides": "Одинаковая расстановка для обеих сторон",
    "Fog Stats": "Статистика тумана",
    Vision: "Обзор",
    Battle: "Бой",
    Moments: "Моменты",
    Captures: "Взятия",
    Checks: "Шахи",
    Promotions: "Превращения",
    "Longest capture run": "Самая длинная серия взятий",
    "Pass the device": "Передайте устройство",
    "Do not look at the board": "Не смотрите на доску",
    "Reveal for": "Открыть для",
    "Reveal Board": "Открыть доску",
    "Own army": "Своя армия",
    "Reachable squares": "Доступные поля",
    "Hidden enemy": "Скрытый противник",
    "Hidden move": "Скрытый ход",
  },
};

function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(CHESS_LANGUAGE_STORAGE_KEY);
  return stored === "en" ||
    stored === "de" ||
    stored === "bar" ||
    stored === "ko" ||
    stored === "ru"
    ? stored
    : "en";
}

type VariantAiBoardProps = {
  aiMode?: boolean;
  playerColor?: ChessPlayerColor;
  difficulty?: Difficulty;
  onChangeSettings?: () => void;
};

export default function FogOfWarChessBoard({
  aiMode = false,
  playerColor = "white",
  difficulty = "casual",
}: VariantAiBoardProps) {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const t = (key: string) =>
    language === "en"
      ? key
      : language === "bar"
        ? (translations.bar[key] ?? translations.de[key] ?? key)
        : (translations[language][key] ?? key);
  const changeLanguage = (next: Language) => {
    setLanguage(next);
    if (typeof window !== "undefined")
      window.localStorage.setItem(CHESS_LANGUAGE_STORAGE_KEY, next);
  };

  const [fogSeed, setFogSeed] = useState<number>(createFogSeed);
  const [game] = useState(() => createFogGame(fogSeed));
  const [initialFen, setInitialFen] = useState(() => game.fen());
  const [records, setRecords] = useState<FogMoveRecord[]>([]);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(
    null,
  );
  const [promotionFrom, setPromotionFrom] = useState<Square | null>(null);
  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState("");
  const [winner, setWinner] = useState<Winner>("white");
  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );
  const [statsTab, setStatsTab] = useState<StatsTab>("vision");

  const humanColor = chessColorFromPlayerColor(playerColor);
  const computerColor = oppositeChessColor(humanColor);
  const aiMovePendingRef = useRef(false);

  useEffect(() => {
    if (
      !aiMode ||
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
    aiMovePendingRef.current = true;

    const timer = window.setTimeout(() => {
      try {
        const move = chooseFogAiMove(game, computerColor, difficulty);

        if (
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
    }, 260);

    return () => {
      window.clearTimeout(timer);
      // Needed for React StrictMode's development-only setup/cleanup cycle.
      aiMovePendingRef.current = false;
    };
  }, [
    aiMode,
    computerColor,
    difficulty,
    records.length,
    gameOver,
    historyPreviewPly,
    promotionFrom,
    promotionSquare,
  ]);

  const historyPreview =
    historyPreviewPly !== null
      ? (records[historyPreviewPly - 1] ?? null)
      : null;
  const historyPreviewChess = useMemo(
    () => (historyPreview ? new Chess(historyPreview.fenAfter) : null),
    [historyPreview?.fenAfter],
  );
  const liveSide: FogSide = game.turn();
  const displayedChess = historyPreviewChess ?? game;
  const displayedSide: FogSide = historyPreviewChess
    ? historyPreviewChess.turn()
    : liveSide;
  const displayedBoard = getMaskedBoard(displayedChess, displayedSide);
  const fogSquares = getFogSquares(displayedChess, displayedSide);
  const visibleSquares = getFogVisibleSquares(displayedChess, displayedSide);
  const {
    orientation: liveBoardOrientation,
    flipPending,
    snapToSide,
  } = useDelayedBoardOrientation(aiMode ? humanColor : liveSide, 1500);

  const boardOrientation: "white" | "black" = historyPreviewChess
    ? displayedSide === "w"
      ? "white"
      : "black"
    : liveBoardOrientation;
  const displayedLastMove = historyPreview
    ? { from: historyPreview.from, to: historyPreview.to }
    : lastMove;
  const checkedKingSquare = getCheckedKingSquare(displayedChess, displayedSide);

  const capturedWhite = useMemo(
    () =>
      records
        .filter((r) => r.color === "b" && r.captured)
        .map((r) => r.captured as PieceType),
    [records],
  );
  const capturedBlack = useMemo(
    () =>
      records
        .filter((r) => r.color === "w" && r.captured)
        .map((r) => r.captured as PieceType),
    [records],
  );
  const whiteMaterial = capturedBlack.reduce(
    (sum, p) => sum + (pieceValues[p] ?? 0),
    0,
  );
  const blackMaterial = capturedWhite.reduce(
    (sum, p) => sum + (pieceValues[p] ?? 0),
    0,
  );
  const materialDifference = whiteMaterial - blackMaterial;
  const fogStats = useMemo(() => buildFogStats(records), [records]);

  const playSound = (sound: string) => {
    const audio = new Audio(`/sounds/${sound}.mp3`);
    audio.play().catch(() => {});
  };

  function updateGameOver(
    nextRecords: FogMoveRecord[],
    playResultSound = false,
  ) {
    if (game.isCheckmate()) {
      setGameOver(true);
      setGameOverReason("Checkmate");
      setWinner(game.turn() === "w" ? "black" : "white");
      if (playResultSound) playSound("checkmate");
      return true;
    }
    if (game.isStalemate()) {
      setGameOver(true);
      setGameOverReason("Stalemate");
      setWinner("draw");
      if (playResultSound) playSound("draw");
      return true;
    }
    if (game.isInsufficientMaterial()) {
      setGameOver(true);
      setGameOverReason("Insufficient material");
      setWinner("draw");
      if (playResultSound) playSound("draw");
      return true;
    }
    if (game.isDrawByFiftyMoves()) {
      setGameOver(true);
      setGameOverReason("50-move rule");
      setWinner("draw");
      if (playResultSound) playSound("draw");
      return true;
    }
    if (isThreefoldFog(nextRecords, initialFen, game.fen())) {
      setGameOver(true);
      setGameOverReason("Threefold repetition");
      setWinner("draw");
      if (playResultSound) playSound("draw");
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
    if (gameOver || historyPreview) return;
    try {
      const move = game.move({ from, to, promotion });
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
      const record: FogMoveRecord = {
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
      setLastMove({ from: move.from, to: move.to });
      setSelectedSquare(null);
      setLegalMoves([]);
      setPromotionFrom(null);
      setPromotionSquare(null);
      setHistoryPreviewPly(null);
      captured
        ? playPieceCaptureSound(move.piece)
        : playPieceMoveSound(move.piece);
      const ended = updateGameOver(nextRecords, true);
      if (!ended) {
        if (game.isCheck()) playSound("check");
        else if (move.isKingsideCastle() || move.isQueensideCastle())
          playRandomSound(["castle-1", "castle-2"]);
      }
    } catch {
      playSound("illegal");
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }

  function handleSquareClick(row: number, column: number) {
    if (aiMode && game.turn() !== humanColor) return;

    if (gameOver || historyPreview) return;
    const square = getSquareName(row, column);
    if (selectedSquare === null) {
      const piece = game.get(square);
      if (!piece || piece.color !== game.turn()) return;
      setSelectedSquare(square);
      playPieceSelectSound(piece.type);
      setLegalMoves(game.moves({ square, verbose: true }).map((m) => m.to));
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
      const clicked = game.get(square);
      if (clicked && clicked.color === game.turn()) {
        setSelectedSquare(square);
        playPieceSelectSound(clicked.type);
        setLegalMoves(game.moves({ square, verbose: true }).map((m) => m.to));
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
    if (promotionFrom && promotionSquare)
      commitMove(promotionFrom, promotionSquare, piece);
  }

  function undoMove() {
    if (records.length === 0 || aiMode) return;
    const nextRecords = records.slice(0, -1);
    game.load(nextRecords[nextRecords.length - 1]?.fenAfter ?? initialFen);
    snapToSide(game.turn());
    setRecords(nextRecords);
    const previous = nextRecords[nextRecords.length - 1] ?? null;
    setLastMove(previous ? { from: previous.from, to: previous.to } : null);
    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionFrom(null);
    setPromotionSquare(null);
    setHistoryPreviewPly(null);
    setGameOver(false);
    setGameOverReason("");
    setWinner("white");

    updateGameOver(nextRecords, false);
  }

  function restartGame() {
    const nextSeed = createFogSeed();
    const nextGame = createFogGame(nextSeed);
    const nextFen = nextGame.fen();
    game.load(nextFen);
    snapToSide(game.turn());
    setFogSeed(nextSeed);
    setInitialFen(nextFen);
    setRecords([]);
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPromotionFrom(null);
    setPromotionSquare(null);
    setHistoryPreviewPly(null);
    setStatsTab("vision");
    setGameOver(false);
    setGameOverReason("");
    setWinner("white");
  }

  const safePreview = (record: FogMoveRecord) =>
    gameOver || record.color !== liveSide;
  const displayRecordSan = (record: FogMoveRecord) =>
    gameOver || record.color === liveSide ? record.san : t("Hidden move");

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-7 flex flex-col gap-4 rounded-3xl border border-sky-400/10 bg-zinc-900/50 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-3xl">
              🌫
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-300">
                {t("Chess Variant")}
              </p>
              <h1 className="mt-0.5 text-2xl font-black text-white">
                {t("Fog of War Chess")}
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                {t("You cannot see everything")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSelector
              language={language}
              onChange={changeLanguage}
              label={t("Language")}
            />
            {!gameOver && (
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300">
                {game.turn() === "w" ? t("White to move") : t("Black to move")}
              </div>
            )}
          </div>
          <BoardAnimationToggle />
        </header>

        <section className="mb-6 grid gap-3 rounded-3xl border border-sky-400/10 bg-sky-400/[0.03] px-5 py-4 md:grid-cols-3">
          <RuleStrip
            icon="♙"
            title={t("Own army")}
            detail="Your own pieces are always visible"
          />
          <RuleStrip
            icon="◌"
            title={t("Reachable squares")}
            detail="Moves and attacked squares reveal the fog"
          />
          <RuleStrip
            icon="?"
            title={t("Hidden enemy")}
            detail="Enemy pieces outside your vision are invisible"
          />
        </section>

        <main className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel>
                <PanelTitle
                  title={t("Game Controls")}
                  subtitle={t("Private hotseat")}
                />
                <FogControls
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
                  <span className="rounded-xl bg-white/5 px-2.5 py-1 text-xs text-zinc-400">
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
                      <tbody>
                        {records.map((record) => {
                          const canPreview = safePreview(record);
                          return (
                            <tr
                              key={record.ply}
                              onClick={() => {
                                if (!canPreview) return;
                                setHistoryPreviewPly(record.ply);
                                setSelectedSquare(null);
                                setLegalMoves([]);
                              }}
                              className={`border-b border-white/5 last:border-0 ${canPreview ? "cursor-pointer hover:bg-white/5" : "cursor-not-allowed opacity-55"} ${historyPreviewPly === record.ply ? "bg-blue-400/10" : ""}`}
                            >
                              <td className="px-3 py-2.5 text-[10px] text-zinc-600">
                                {record.moveNumber}
                                {record.color === "w" ? "." : "..."}
                              </td>
                              <td className="px-2 py-2.5 text-lg">
                                {gameOver || record.color === liveSide
                                  ? historyPieceSymbol(
                                      record.color,
                                      record.piece,
                                    )
                                  : "?"}
                              </td>
                              <td className="px-2 py-2.5 font-mono text-xs font-bold text-zinc-200">
                                {displayRecordSan(record)}
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

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {gameOver && (
                <div className="mb-3 rounded-2xl border border-sky-400/20 bg-sky-400/[0.07] px-4 py-3">
                  <div className="flex justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-sky-300">
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
                <div className="mb-3 rounded-2xl border border-sky-400/20 bg-zinc-900/90 p-3">
                  <PromotionBar onPromote={promotePawn} />
                </div>
              )}
              {historyPreview && (
                <div className="mb-3 flex items-center justify-between rounded-xl border border-blue-400/20 bg-blue-400/[0.07] px-4 py-3">
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
                    onClick={() => {
                      setHistoryPreviewPly(null);
                    }}
                    className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold"
                  >
                    {t("Back to Live Board")}
                  </button>
                </div>
              )}
              <div className="relative">
                <Board
                  board={displayedBoard}
                  selectedSquare={historyPreview ? null : selectedSquare}
                  legalMoves={historyPreview ? [] : legalMoves}
                  lastMove={displayedLastMove}
                  checkedKingSquare={checkedKingSquare}
                  onSquareClick={
                    historyPreview || flipPending ? () => {} : handleSquareClick
                  }
                  fogSquares={fogSquares}
                  orientation={boardOrientation}
                />
              </div>
            </div>
          </section>

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <section className="rounded-3xl border border-sky-400/15 bg-zinc-900/80 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-black">{t("Fog Status")}</h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Current player's vision")}
                    </p>
                  </div>
                  <span className="text-2xl">🌫</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <FogStat
                    label={t("Visible")}
                    value={visibleSquares.length}
                    tone="sky"
                  />
                  <FogStat
                    label={t("Hidden")}
                    value={64 - visibleSquares.length}
                    tone="zinc"
                  />
                </div>
                <div className="mt-3 rounded-xl border border-violet-400/10 bg-violet-400/[0.04] px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-violet-300">
                    {t("Random Start")}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("Same formation for both sides")}
                  </p>
                  <p className="mt-2 font-mono text-[10px] text-zinc-700">
                    Seed {fogSeed}
                  </p>
                </div>
              </section>
              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4">
                <h2 className="font-bold">{t("Fog Stats")}</h2>
                <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-white/5 bg-black/20 p-1">
                  {(
                    [
                      ["vision", "Vision"],
                      ["battle", "Battle"],
                      ["moments", "Moments"],
                    ] as Array<[StatsTab, string]>
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStatsTab(tab)}
                      className={`rounded-lg px-2 py-2 text-[10px] font-black uppercase ${statsTab === tab ? "bg-sky-400/15 text-sky-200" : "text-zinc-600 hover:bg-white/5"}`}
                    >
                      {t(label)}
                    </button>
                  ))}
                </div>
                {statsTab === "vision" && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <StatCard
                      label={t("Visible")}
                      value={visibleSquares.length}
                    />
                    <StatCard
                      label={t("Hidden")}
                      value={64 - visibleSquares.length}
                    />
                  </div>
                )}
                {statsTab === "battle" && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <StatCard label={t("Captures")} value={fogStats.captures} />
                    <StatCard label={t("Checks")} value={fogStats.checks} />
                    <StatCard
                      label={t("Promotions")}
                      value={fogStats.promotions}
                    />
                    <StatCard
                      label={t("Longest capture run")}
                      value={fogStats.longestCaptureRun}
                    />
                  </div>
                )}
                {statsTab === "moments" &&
                  (fogStats.latestCapture ? (
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryPreviewPly(fogStats.latestCapture!.ply);
                      }}
                      className="mt-4 w-full rounded-xl border border-white/5 bg-black/20 px-3 py-3 text-left hover:border-sky-400/20"
                    >
                      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                        Latest capture
                      </p>
                      <p className="mt-2 font-mono text-sm font-black text-zinc-200">
                        {fogStats.latestCapture.san}
                      </p>
                    </button>
                  ) : (
                    <p className="mt-4 rounded-xl bg-black/20 px-3 py-4 text-xs text-zinc-700">
                      No captures yet
                    </p>
                  ))}
              </section>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function getCheckedKingSquare(
  chess: Chess,
  viewingSide: FogSide,
): Square | null {
  if (!chess.isCheck() || chess.turn() !== viewingSide) return null;
  const board = chess.board();
  for (let row = 0; row < 8; row += 1)
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (piece?.type === "k" && piece.color === viewingSide)
        return getSquareName(row, col);
    }
  return null;
}
function historyPieceSymbol(color: "w" | "b", type: string) {
  return color === "w"
    ? (whiteSymbols[type] ?? "")
    : (blackSymbols[type] ?? "");
}
function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20">
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
function FogControls({
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
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onUndo}
        disabled={undoDisabled}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-zinc-300 disabled:cursor-not-allowed
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
        className="rounded-xl border border-sky-400/15 bg-sky-400/[0.06] px-3 py-2.5 text-sm font-bold text-sky-300"
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
  const render = (pieces: PieceType[], color: "w" | "b") => (
    <div className="mt-2 flex min-h-8 flex-wrap gap-1">
      {pieces.length === 0 ? (
        <span className="text-xs text-zinc-700">—</span>
      ) : (
        pieces.map((piece, index) => (
          <span
            key={`${color}-${piece}-${index}`}
            className="flex h-7 w-7 items-center justify-center text-2xl"
          >
            {color === "w" ? whiteSymbols[piece] : blackSymbols[piece]}
          </span>
        ))
      )}
    </div>
  );
  return (
    <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
        {t("Black")}
      </p>
      {render(capturedBlack, "b")}
      <div className="mt-3 border-t border-white/5 pt-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
          {t("White")}
        </p>
        {render(capturedWhite, "w")}
      </div>
    </div>
  );
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
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400/10 text-lg font-black text-sky-200">
        {icon}
      </span>
      <div>
        <p className="text-xs font-black text-zinc-200">{title}</p>
        <p className="mt-1 text-[10px] leading-4 text-zinc-600">{detail}</p>
      </div>
    </div>
  );
}
function FogStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "sky" | "zinc";
}) {
  return (
    <div
      className={
        tone === "sky"
          ? "rounded-xl border border-sky-400/10 bg-sky-400/[0.05] px-3 py-3"
          : "rounded-xl border border-white/5 bg-black/20 px-3 py-3"
      }
    >
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {label}
      </p>
    </div>
  );
}
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
      <p className="text-xl font-black text-zinc-100">{value}</p>
      <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {label}
      </p>
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
        onChange={(e) => onChange(e.target.value as Language)}
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
