import VisibleGameResult from "@/components/chess/VisibleGameResult";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import ChessMoveHistoryList from "../ChessMoveHistoryList";
import { playChessSound, stopSound } from "@/games/chess/audio/chessAudio";
import { emitGameEffect } from "@/games/chess/effects/gameEffects";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useRef, useEffect, useMemo, useState } from "react";
import {
  translateChess,
  useChessLanguage,
  type TranslationTable,
} from "../../../games/chess/i18n/chessLanguage.tsx";

import { Chess, type Square } from "chess.js";

import Board from "./Board.tsx";
import PromotionBar from "./PromotionBar.tsx";

import { getSquareName, type PieceType } from "../../../utils/chessUtils.ts";

import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
} from "../../../utils/sound.ts";

import { useDelayedBoardOrientation } from "@/hooks/useDelayedBoardOrientation.ts";

import {
  HOT_POTATO_MIN_FUSE_MOVES,
  HOT_POTATO_MAX_FUSE_MOVES,
  createCoolingHotPotatoState,
  dropHotPotatoAfterBlast,
  pickUpHotPotato,
  createInitialHotPotatoStates,
  createRespawnedHotPotatoState,
  findKingSquare,
  getHotPotatoSquareAfterMove,
  getNormalChessOutcome,
  isChessInCheck,
  resolveHotPotatoExplosion,
  type DestroyedPiece,
  type HotPotatoOutcome,
  type HotPotatoStates,
} from "../../../games/chess/variants/HotPotato.ts";
import { useVariantChessAi } from "@/hooks/useVariantChessAi";
import {
  chessColorFromPlayerColor,
  oppositeChessColor,
  type Difficulty,
  type ChessPlayerColor,
} from "../../../games/chess/ai/variantAi.ts";

const translations: Partial<TranslationTable> = {
  de: {
    "Chess Hot Potato": "Schach Hot Potato",
    "Pass the danger": "Gib die Gefahr weiter",
    "Random fuse": "Zufällige Zündzeit",
    moves: "Züge",
    "moves left": "Züge übrig",
    "Respawn in": "Neu in",
    "Current board material": "Aktuelles Brettmaterial",
    "White +": "Weiß +",
    "Black +": "Schwarz +",
    "Current carrier": "Aktueller Träger",
    "This potato started with a": "Diese Bombe startete mit einer",
    "move fuse": "Züge-Zündzeit",
    "Cooling down": "Abkühlphase",
    "Next potato": "Nächste Bombe",
    "A new random non-king carrier appears after the cooldown.":
      "Nach der Abkühlzeit erscheint ein neuer zufälliger Nicht-König-Träger.",
    "Hot Potato Stats": "Hot-Potato-Statistik",
    "Chaos from this match": "Chaos aus dieser Partie",
    Explosions: "Explosionen",
    Transfers: "Übergaben",
    Destroyed: "Zerstört",
    Fuse: "Zündzeit",
    "random moves": "zufällige Züge",
    "A random non-king piece starts as the carrier.":
      "Eine zufällige Nicht-Königsfigur startet als Träger.",
    "Each new potato gets a random fuse from 4 to 12 completed player moves.":
      "Jede neue Bombe erhält eine zufällige Zündzeit von 4 bis 12 abgeschlossenen Zügen.",
    "Capture the carrier and your capturing piece inherits it.":
      "Schlage den Träger und deine schlagende Figur übernimmt die Bombe.",
    "The carrier square and all 8 adjacent squares explode.":
      "Das Trägerfeld und alle 8 Nachbarfelder explodieren.",
    "If exactly one king is in the blast radius, that player loses.":
      "Ist genau ein König im Explosionsradius, verliert diese Seite.",
    "If both kings are in the radius, the game is a draw.":
      "Sind beide Könige im Radius, endet die Partie remis.",
    "After an explosion, 5 moves pass before the next potato appears.":
      "Nach einer Explosion vergehen 5 Züge bis zur nächsten Bombe.",
    "Both kings blown up! Draw.": "Beide Könige explodiert! Remis.",
    "The game ended in a draw.": "Die Partie endete remis.",
    "King blown up! White wins.": "König explodiert! Weiß gewinnt.",
    "King blown up! Black wins.": "König explodiert! Schwarz gewinnt.",
    "White wins by checkmate.": "Weiß gewinnt durch Schachmatt.",
    "Black wins by checkmate.": "Schwarz gewinnt durch Schachmatt.",
    Cooldown: "Abkühlzeit",
    plies: "Halbzüge",
    "Back to Live Board": "Zurück zum Live-Brett",
    "Hot Potato": "Hot Potato",
  },
  bar: {
    "Chess Hot Potato": "Schach Hot Potato",
    "Pass the danger": "Gib de G'fahr weiter",
    "Random fuse": "Zufällige Zündzeit",
    moves: "Züg",
    "moves left": "Züg übrig",
    "Respawn in": "Neu in",
    "Cooling down": "Abkühlphase",
    "Next potato": "Nächste Bombn",
    Explosions: "Explosionen",
    Transfers: "Übergaben",
    Destroyed: "Zerstört",
    Fuse: "Zündzeit",
    "random moves": "zufällige Züg",
    Cooldown: "Abkühlzeit",
    plies: "Halbzüg",
  },
  ko: {
    "Chess Hot Potato": "체스 핫 포테이토",
    "Pass the danger": "위험을 넘기세요",
    "Random fuse": "랜덤 타이머",
    moves: "수",
    "moves left": "수 남음",
    "Respawn in": "재생성까지",
    "Current board material": "현재 기물 현황",
    "White +": "백 +",
    "Black +": "흑 +",
    "Current carrier": "현재 운반자",
    "This potato started with a": "이 폭탄의 시작 타이머:",
    "move fuse": "수",
    "Cooling down": "쿨다운 중",
    "Next potato": "다음 폭탄",
    "A new random non-king carrier appears after the cooldown.":
      "쿨다운 후 무작위 비킹 기물에 새 폭탄이 생깁니다.",
    "Hot Potato Stats": "핫 포테이토 통계",
    "Chaos from this match": "이번 게임의 혼돈",
    Explosions: "폭발",
    Transfers: "전달",
    Destroyed: "파괴",
    Fuse: "타이머",
    "random moves": "랜덤 수",
    "A random non-king piece starts as the carrier.":
      "무작위 비킹 기물이 운반자로 시작합니다.",
    "Each new potato gets a random fuse from 4 to 12 completed player moves.":
      "새 폭탄마다 4~12 완료 수의 랜덤 타이머가 설정됩니다.",
    "Capture the carrier and your capturing piece inherits it.":
      "운반자를 잡으면 잡은 기물이 폭탄을 이어받습니다.",
    "The carrier square and all 8 adjacent squares explode.":
      "운반 칸과 주변 8칸이 폭발합니다.",
    "If exactly one king is in the blast radius, that player loses.":
      "폭발 범위에 킹 하나만 있으면 그 진영이 패배합니다.",
    "If both kings are in the radius, the game is a draw.":
      "두 킹 모두 범위에 있으면 무승부입니다.",
    "After an explosion, 5 moves pass before the next potato appears.":
      "폭발 후 5수가 지나야 다음 폭탄이 생깁니다.",
    "Both kings blown up! Draw.": "두 킹 모두 폭발! 무승부.",
    "The game ended in a draw.": "게임은 무승부로 끝났습니다.",
    "King blown up! White wins.": "킹 폭발! 백 승리.",
    "King blown up! Black wins.": "킹 폭발! 흑 승리.",
    "White wins by checkmate.": "백이 체크메이트로 승리합니다.",
    "Black wins by checkmate.": "흑이 체크메이트로 승리합니다.",
    Cooldown: "쿨다운",
    plies: "하프무브",
    "Hot Potato": "핫 포테이토",
  },
  ru: {
    "Chess Hot Potato": "Шахматная горячая картошка",
    "Pass the danger": "Передай опасность",
    "Random fuse": "Случайный таймер",
    moves: "ходов",
    "moves left": "ходов осталось",
    "Respawn in": "Новая через",
    "Current board material": "Текущий материал",
    "White +": "Белые +",
    "Black +": "Чёрные +",
    "Current carrier": "Текущий носитель",
    "This potato started with a": "Эта бомба начала с",
    "move fuse": "ходов таймера",
    "Cooling down": "Перезарядка",
    "Next potato": "Следующая бомба",
    "A new random non-king carrier appears after the cooldown.":
      "После перезарядки появится новый случайный носитель кроме короля.",
    "Hot Potato Stats": "Статистика Hot Potato",
    "Chaos from this match": "Хаос этой партии",
    Explosions: "Взрывы",
    Transfers: "Передачи",
    Destroyed: "Уничтожено",
    Fuse: "Таймер",
    "random moves": "случайных ходов",
    "A random non-king piece starts as the carrier.":
      "Случайная фигура кроме короля начинает как носитель.",
    "Each new potato gets a random fuse from 4 to 12 completed player moves.":
      "Каждая новая бомба получает случайный таймер от 4 до 12 завершённых ходов.",
    "Capture the carrier and your capturing piece inherits it.":
      "Взявшая носителя фигура наследует бомбу.",
    "The carrier square and all 8 adjacent squares explode.":
      "Поле носителя и все 8 соседних полей взрываются.",
    "If exactly one king is in the blast radius, that player loses.":
      "Если во взрыве один король, его сторона проигрывает.",
    "If both kings are in the radius, the game is a draw.":
      "Если оба короля в зоне, результат — ничья.",
    "After an explosion, 5 moves pass before the next potato appears.":
      "После взрыва проходит 5 ходов до новой бомбы.",
    "Both kings blown up! Draw.": "Оба короля взорваны! Ничья.",
    "The game ended in a draw.": "Партия закончилась ничьей.",
    "King blown up! White wins.": "Король взорван! Белые победили.",
    "King blown up! Black wins.": "Король взорван! Чёрные победили.",
    "White wins by checkmate.": "Белые выигрывают матом.",
    "Black wins by checkmate.": "Чёрные выигрывают матом.",
    Cooldown: "Перезарядка",
    plies: "полуходов",
    "Hot Potato": "Hot Potato",
  },
};

/* =========================================================
   TYPES
   ========================================================= */

type PromotionPiece = "q" | "r" | "b" | "n";

type PendingPromotion = {
  from: Square;
  to: Square;
};

type FinishedGame = {
  outcome: Exclude<HotPotatoOutcome, null>;
  reason: "explosion" | "checkmate" | "draw";
} | null;

type HotPotatoHistoryEntry = {
  ply: number;
  moveNumber: number;
  color: "w" | "b";
  san: string;
  piece: PieceType;
  from: Square;
  to: Square;
  fenAfter: string;
  hotPotatoesAfter: HotPotatoStates;
  explosionSquaresAfter: Square[];
  blownUpKingSquaresAfter: Square[];
  potatoTransferred: boolean;
  destroyedPieces: DestroyedPiece[];
};

type UndoSnapshot = {
  fen: string;
  hotPotatoes: HotPotatoStates;
  lastMove: { from: Square; to: Square } | null;
  capturedWhite: PieceType[];
  capturedBlack: PieceType[];
  history: HotPotatoHistoryEntry[];
  explosionCount: number;
  transferCount: number;
  destroyedPieceCount: number;
  blownUpKingSquares: Square[];
  finishedGame: FinishedGame;
};

/* =========================================================
   CONSTANTS
   ========================================================= */

const pieceValues: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

/* =========================================================
   HELPERS
   ========================================================= */


function getHistoryPieceSymbol(color: "w" | "b", piece: PieceType) {
  const symbols: Record<"w" | "b", Record<PieceType, string>> = {
    w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
    b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
  };

  return symbols[color][piece];
}

function getBoardMaterialDifference(game: Chess) {
  let white = 0;
  let black = 0;

  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;

      const value = pieceValues[piece.type as PieceType];

      if (piece.color === "w") white += value;
      else black += value;
    }
  }

  return white - black;
}

function cloneHotPotatoes(states: HotPotatoStates): HotPotatoStates {
  return {
    w: { ...states.w },
    b: { ...states.b },
  };
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

export default function ChessHotPotatoBoard({
  aiMode = false,
  playerColor = "white",
  difficulty = "casual",
}: VariantAiBoardProps) {
  useUiLanguage();
  const { language } = useChessLanguage();
  const t = (key: string) => translateChess(language, key, translations);
  /* =======================================================
     CHESS GAME
     ======================================================= */

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

  /* =======================================================
     HOT POTATO
     ======================================================= */

  const [hotPotatoes, setHotPotatoes] = useState<HotPotatoStates>(() => {
    const initialGame = new Chess();
    return createInitialHotPotatoStates(initialGame);
  });
  useEffect(() => {
    const active = (Object.values(hotPotatoes)).some(potato => potato.square !== null && !potato.dropped && potato.movesUntilExplosion > 0);
    if (active && !finishedGame) playChessSound("bombFuse");
    else stopSound("bombFuse");
    return () => stopSound("bombFuse");
  }, [hotPotatoes, finishedGame]);

  const [explosionSquares, setExplosionSquares] = useState<Square[]>([]);
  const [blownUpKingSquares, setBlownUpKingSquares] = useState<Square[]>([]);

  const [explosionCount, setExplosionCount] = useState(0);
  const [transferCount, setTransferCount] = useState(0);
  const [destroyedPieceCount, setDestroyedPieceCount] = useState(0);

  /* =======================================================
     HISTORY / UNDO
     ======================================================= */

  const [history, setHistory] = useState<HotPotatoHistoryEntry[]>([]);
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
    finishedGame,
    historyPreviewPly,
    pendingPromotion,
    chooseAiMove,
  ]);

  /* =======================================================
     BOARD ORIENTATION
     ======================================================= */

  const {
    orientation: liveBoardOrientation,
    flipPending,
    snapToSide,
  } = useDelayedBoardOrientation(aiMode ? humanColor : game.turn(), 1500);

  /* =======================================================
     HISTORY PREVIEW
     ======================================================= */

  const historyPreview =
    historyPreviewPly !== null
      ? (history[historyPreviewPly - 1] ?? null)
      : null;

  const historyPreviewChess = useMemo(
    () => (historyPreview ? new Chess(historyPreview.fenAfter) : null),
    [historyPreview?.fenAfter],
  );

  const displayedGame = historyPreviewChess ?? game;
  const displayedBoard = displayedGame.board();

  const boardOrientation: "white" | "black" = historyPreviewChess
    ? historyPreviewChess.turn() === "w"
      ? "white"
      : "black"
    : liveBoardOrientation;

  const displayedLastMove = historyPreview
    ? { from: historyPreview.from, to: historyPreview.to }
    : lastMove;

  const displayedHotPotatoes = historyPreview
    ? historyPreview.hotPotatoesAfter
    : hotPotatoes;

  const displayedExplosionSquares = historyPreview
    ? historyPreview.explosionSquaresAfter
    : explosionSquares;

  const displayedBlownUpKingSquares = historyPreview
    ? historyPreview.blownUpKingSquaresAfter
    : blownUpKingSquares;

  /* =======================================================
     CHECKED KING
     ======================================================= */

  const checkedKingSquare = useMemo(() => {
    if (!isChessInCheck(displayedGame)) return null;
    return findKingSquare(displayedGame, displayedGame.turn());
  }, [displayedGame]);

  /* =======================================================
     MATERIAL
     ======================================================= */

  const materialDifference = getBoardMaterialDifference(displayedGame);

  /* =======================================================
     BASIC UI HELPERS
     ======================================================= */

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  function selectPiece(square: Square) {
    if (historyPreview || finishedGame || pendingPromotion || flipPending)
      return;

    const piece = game.get(square);

    if (!piece || piece.color !== game.turn()) {
      clearSelection();
      return;
    }

    const moves = game.moves({
      square,
      verbose: true,
    });

    setSelectedSquare(square);
    setLegalMoves(moves.map((move) => move.to as Square));

    playPieceSelectSound(piece.type);
  }

  function snapshotCurrentState(): UndoSnapshot {
    return {
      fen: game.fen(),
      hotPotatoes: cloneHotPotatoes(hotPotatoes),
      lastMove,
      capturedWhite: [...capturedWhite],
      capturedBlack: [...capturedBlack],
      history: [...history],
      explosionCount,
      transferCount,
      destroyedPieceCount,
      blownUpKingSquares: [...blownUpKingSquares],
      finishedGame,
    };
  }

  function getNormalFinish(nextGame: Chess): FinishedGame {
    const outcome = getNormalChessOutcome(nextGame);

    if (!outcome) return null;

    return {
      outcome,
      reason: nextGame.isCheckmate() ? "checkmate" : "draw",
    };
  }

  /* =======================================================
     MOVE EXECUTION
     ======================================================= */

  function makeMove(
    from: Square,
    to: Square,
    promotion?: PromotionPiece,
  ): boolean {
    if (finishedGame || historyPreview) return false;

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
    const nextHotPotatoes = cloneHotPotatoes(hotPotatoes);

    let nextExplosionSquares: Square[] = [];
    let nextBlownUpKingSquares: Square[] = [];
    let variantFinish: FinishedGame = null;
    let destroyedPieces: DestroyedPiece[] = [];
    let potatoTransferred = false;
    let transfersThisMove = 0;
    let explosionsThisMove = 0;

    // First update both bomb locations/fuses from the chess move.
    const explodingOwners: Array<"w" | "b"> = [];

    for (const owner of ["w", "b"] as const) {
      const potato = nextHotPotatoes[owner];

      if (potato.square) {
        if (!pickUpHotPotato(potato, move)) continue;
        const carrierBeforeMove = potato.square;

        const carrierWasCaptured =
          carrierBeforeMove === move.to && carrierBeforeMove !== move.from;

        const enPassantCarrierWasCaptured =
          move.flags.includes("e") &&
          carrierBeforeMove === (`${move.to[0]}${move.from[1]}` as Square);

        if (carrierWasCaptured || enPassantCarrierWasCaptured) {
          potatoTransferred = true;
          transfersThisMove += 1;
        }

        const movedSquare = getHotPotatoSquareAfterMove(carrierBeforeMove, {
          from: move.from as Square,
          to: move.to as Square,
          color: move.color,
          flags: move.flags,
        });

        potato.square = movedSquare;
        potato.movesUntilExplosion -= 1;

        if (potato.movesUntilExplosion <= 0) {
          explodingOwners.push(owner);
        }
      } else if (potato.respawnMovesRemaining > 0) {
        potato.respawnMovesRemaining -= 1;

        if (potato.respawnMovesRemaining <= 0) {
          nextHotPotatoes[owner] = createRespawnedHotPotatoState(
            nextGame,
            owner,
          );
        }
      }
    }

    // Resolve bombs that reached zero on this ply.
    for (const owner of explodingOwners) {
      const center = nextHotPotatoes[owner].square;
      if (!center) continue;

      const explosion = resolveHotPotatoExplosion(
        nextGame,
        center,
        nextHotPotatoes[owner].blastPattern,
      );

      nextExplosionSquares = [
        ...new Set([...nextExplosionSquares, ...explosion.explosionSquares]),
      ];
      nextBlownUpKingSquares = [
        ...new Set([
          ...nextBlownUpKingSquares,
          ...explosion.blownUpKingSquares,
        ]),
      ];
      destroyedPieces = [...destroyedPieces, ...explosion.destroyedPieces];
      explosionsThisMove += 1;

      nextHotPotatoes[owner] = createCoolingHotPotatoState(
        owner,
        nextHotPotatoes[owner].blastPattern,
      );
    }

    for (const owner of ["w", "b"] as const) {
      dropHotPotatoAfterBlast(nextGame, nextHotPotatoes[owner], nextExplosionSquares);
    }

    const whiteKingSquare = findKingSquare(nextGame, "w");
    const blackKingSquare = findKingSquare(nextGame, "b");
    const whiteKingHit =
      whiteKingSquare !== null &&
      nextBlownUpKingSquares.includes(whiteKingSquare);
    const blackKingHit =
      blackKingSquare !== null &&
      nextBlownUpKingSquares.includes(blackKingSquare);

    if (whiteKingHit || blackKingHit) {
      variantFinish = {
        outcome:
          whiteKingHit && blackKingHit
            ? "draw"
            : whiteKingHit
              ? "black"
              : "white",
        reason: "explosion",
      };
    }

    const normalFinish = variantFinish ? null : getNormalFinish(nextGame);

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

    const nextPly = history.length + 1;

    const nextHistoryEntry: HotPotatoHistoryEntry = {
      ply: nextPly,
      moveNumber: Math.floor((nextPly - 1) / 2) + 1,
      color: move.color,
      san: move.san,
      piece: move.piece as PieceType,
      from: move.from as Square,
      to: move.to as Square,
      fenAfter: nextGame.fen(),
      hotPotatoesAfter: cloneHotPotatoes(nextHotPotatoes),
      explosionSquaresAfter: nextExplosionSquares,
      blownUpKingSquaresAfter: nextBlownUpKingSquares,
      potatoTransferred,
      destroyedPieces,
    };

    setUndoStack((stack) => [...stack, beforeMove]);
    setGame(nextGame);
    setHotPotatoes(nextHotPotatoes);
    if (potatoTransferred) stopSound("bombFuse");
    if (explosionsThisMove > 0) {
      stopSound("bombFuse");
      playChessSound("bombExplosion");
      emitGameEffect({ type: "BOMB_EXPLODE", square: nextExplosionSquares[0] });
    }
    setExplosionSquares(nextExplosionSquares);
    setBlownUpKingSquares(nextBlownUpKingSquares);
    setLastMove({
      from: move.from as Square,
      to: move.to as Square,
    });
    setCapturedWhite(nextCapturedWhite);
    setCapturedBlack(nextCapturedBlack);
    setHistory((rows) => [...rows, nextHistoryEntry]);

    if (transfersThisMove > 0) {
      setTransferCount((count) => count + transfersThisMove);
    }

    if (explosionsThisMove > 0) {
      setExplosionCount((count) => count + explosionsThisMove);
      setDestroyedPieceCount((count) => count + destroyedPieces.length);
    }

    setPendingPromotion(null);
    clearSelection();

    if (variantFinish) {
      setFinishedGame(variantFinish);
    } else if (normalFinish) {
      setFinishedGame(normalFinish);
    }

    return true;
  }

  /* =======================================================
     BOARD CLICK
     ======================================================= */

  function handleSquareClick(row: number, column: number) {
    if (aiMode && game.turn() !== humanColor) return;

    if (finishedGame || historyPreview || pendingPromotion || flipPending)
      return;

    const square = getSquareName(row, column);
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
      setPendingPromotion({
        from: selectedSquare,
        to: square,
      });

      clearSelection();
      return;
    }

    makeMove(selectedSquare, square);
  }

  /* =======================================================
     UNDO / RESTART
     ======================================================= */

  function undoMove() {
    const snapshot = undoStack[undoStack.length - 1];

    if (!snapshot) return;
    if (aiMode) return;
    const restoredGame = new Chess(snapshot.fen);

    setGame(restoredGame);
    snapToSide(restoredGame.turn());

    setHotPotatoes(cloneHotPotatoes(snapshot.hotPotatoes));
    setLastMove(snapshot.lastMove);
    setCapturedWhite([...snapshot.capturedWhite]);
    setCapturedBlack([...snapshot.capturedBlack]);
    setHistory([...snapshot.history]);
    setExplosionCount(snapshot.explosionCount);
    setTransferCount(snapshot.transferCount);
    setDestroyedPieceCount(snapshot.destroyedPieceCount);
    setFinishedGame(snapshot.finishedGame);
    setBlownUpKingSquares([...snapshot.blownUpKingSquares]);

    setUndoStack((stack) => stack.slice(0, -1));
    setExplosionSquares([]);
    setHistoryPreviewPly(null);
    setPendingPromotion(null);
    clearSelection();
  }

  function restartGame() {
    const freshGame = new Chess();

    setGame(freshGame);
    snapToSide(freshGame.turn());

    setHotPotatoes(createInitialHotPotatoStates(freshGame));
    setExplosionSquares([]);
    setBlownUpKingSquares([]);

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

    setExplosionCount(0);
    setTransferCount(0);
    setDestroyedPieceCount(0);
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div
      className="
        chess-variant-page min-h-[var(--app-height)]
        bg-transparent
        px-4
        py-6
        text-zinc-100
        sm:px-6
        lg:px-8
      "
    >
      <div className="mx-auto max-w-[1500px]">
        {/* =================================================
            HEADER
           ================================================= */}

        <ChessPageHeader className="
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
          " description={<> {t("Pass the danger")} · {t("Random fuse")}{" "}
                {HOT_POTATO_MIN_FUSE_MOVES}–{HOT_POTATO_MAX_FUSE_MOVES}{" "}
                {t("moves")} </>}>


          <div className="flex flex-wrap items-center justify-end gap-2">
            <div
              className="
                flex
                items-center
                gap-2
                rounded-full
                border
                border-orange-400/20
                bg-orange-400/[0.07]
                px-3
                py-1.5
                text-xs
                font-bold
                text-orange-200
              "
            >
              <span aria-hidden="true">💣</span>

              <span>
                {(["w", "b"] as const)
                  .map((owner) => {
                    const potato = displayedHotPotatoes[owner];

                    return potato.square
                      ? `${owner === "w" ? "W" : "B"} ${potato.movesUntilExplosion}{potato.dropped ? " · Paused on ground" : ""}`
                      : `${owner === "w" ? "W" : "B"} ❄${potato.respawnMovesRemaining}`;
                  })
                  .join(" · ")}
              </span>
            </div>

            {!finishedGame && !historyPreview && (
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
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                {game.turn() === "w" ? t("White to move") : t("Black to move")}
              </div>
            )}
          </div>
        </ChessPageHeader>

        {/* =================================================
            MAIN LAYOUT — SAME 300px / BOARD / 300px SHELL
            AS THREE LIVES
           ================================================= */}

        <main
          className="
            grid
            gap-6
            chess-game-grid xl:grid-cols-[300px_minmax(0,1fr)_300px]
          "
        >
          {/* ===============================================
              LEFT SIDEBAR
             =============================================== */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {/* GAME CONTROLS */}

              <section data-chess-controls className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
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
                      className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-xs font-black text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:cursor-not-allowed
    disabled:border-white/5
    disabled:bg-white/[0.02]
    disabled:text-zinc-600
    disabled:opacity-50
    disabled:hover:bg-white/[0.02]"
                    >
                      {t("Undo")}
                    </button>

                    <button
                      type="button"
                      onClick={restartGame}
                      className="rounded-xl border border-orange-400/15 bg-orange-400/[0.07] px-3 py-2.5 text-xs font-black text-orange-200 transition hover:bg-orange-400/10"
                    >
                      {t("New Game")}
                    </button>
                  </div>
                </div>
              </section>

              {/* CAPTURED PIECES */}

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-100">
                      {t("Captured Pieces")}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Current board material")}
                    </p>
                  </div>

                  <span
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold ${
                      materialDifference > 0
                        ? "bg-amber-400/10 text-amber-200"
                        : materialDifference < 0
                          ? "bg-white/10 text-zinc-300"
                          : "bg-white/5 text-zinc-500"
                    }`}
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
              </section>

              {/* MOVE HISTORY */}

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

                <ChessMoveHistoryList
                  listClassName="max-h-80 rounded-2xl border border-white/5 bg-black/20"
                  selectedPly={historyPreviewPly}
                  emptyLabel={t("No moves yet")}
                  entries={history.map((move) => ({
                    ply: move.ply,
                    side: move.color,
                    moveNumber: move.moveNumber,
                    content: (
                      <>
                        <span className="text-base leading-none">{getHistoryPieceSymbol(move.color, move.piece)}</span>
                        <span className="truncate font-mono text-xs font-bold text-zinc-200">{move.san}</span>
                      </>
                    ),
                    trailing:
                      move.potatoTransferred || move.explosionSquaresAfter.length > 0 ? (
                        <span className="flex items-center gap-1">
                          {move.potatoTransferred && (
                            <span className="rounded-full bg-orange-400/10 px-1.5 py-0.5 font-black text-orange-300">💣↔</span>
                          )}
                          {move.explosionSquaresAfter.length > 0 && (
                            <span className="text-xs" aria-label={ui("Explosion")}>💥</span>
                          )}
                        </span>
                      ) : null,
                  }))}
                  onSelect={setHistoryPreviewPly}
                />
              </section>
            </div>
          </aside>

          {/* ===============================================
              CENTER BOARD
             =============================================== */}

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {finishedGame && !historyPreview && (
                <VisibleGameResult />
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
                      {(["w", "b"] as const)
                        .map((owner) => {
                          const potato = historyPreview.hotPotatoesAfter[owner];
                          return potato.square
                            ? `${owner === "w" ? "W" : "B"} 💣 ${potato.movesUntilExplosion}{potato.dropped ? " · Paused on ground" : ""}`
                            : `${owner === "w" ? "W" : "B"} ${t("Cooldown")} ${potato.respawnMovesRemaining}`;
                        })
                        .join(" · ")}
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
                board={displayedBoard}
                selectedSquare={historyPreview ? null : selectedSquare}
                legalMoves={historyPreview ? [] : legalMoves}
                lastMove={displayedLastMove}
                checkedKingSquare={checkedKingSquare}
                onSquareClick={
                  historyPreview || flipPending ? () => {} : handleSquareClick
                }
                hotPotatoes={(["w", "b"] as const)
                  .map((owner) => ({
                    owner,
                    square: displayedHotPotatoes[owner].square,
                    movesRemaining:
                      displayedHotPotatoes[owner].movesUntilExplosion,
                  }))
                  .filter(
                    (
                      potato,
                    ): potato is {
                      owner: "w" | "b";
                      square: Square;
                      movesRemaining: number;
                    } => potato.square !== null,
                  )}
                hotPotatoExplosionSquares={displayedExplosionSquares}
                hotPotatoBlownUpKingSquares={displayedBlownUpKingSquares}
                orientation={boardOrientation}
              />

              {/* MOBILE STATUS */}

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-900/75 px-4 py-3 xl:hidden">
                <span className="text-sm text-zinc-500">{t("Hot Potato")}</span>
                <span className="text-sm font-bold text-zinc-200">
                  {(["w", "b"] as const)
                    .map((owner) => {
                      const potato = displayedHotPotatoes[owner];
                      return potato.square
                        ? `${owner === "w" ? "W" : "B"} 💣 ${potato.movesUntilExplosion}{potato.dropped ? " · Paused on ground" : ""}`
                        : `${owner === "w" ? "W" : "B"} ❄ ${potato.respawnMovesRemaining}`;
                    })
                    .join(" · ")}
                </span>
              </div>
            </div>
          </section>

          {/* ===============================================
              RIGHT SIDEBAR
             =============================================== */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {/* HOT POTATO STATUS */}

              <section className="rounded-3xl border border-orange-400/15 bg-zinc-900/80 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4">
                  <h2 className="text-base font-black text-zinc-100">
                    {t("Hot Potato")}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">{ui("Two independent bombs")}</p>
                </div>

                <div className="space-y-3">
                  {(["w", "b"] as const).map((owner) => {
                    const potato = displayedHotPotatoes[owner];
                    const patternLabel =
                      potato.blastPattern === "ring"
                        ? "Ring 1"
                        : potato.blastPattern === "cross2"
                          ? "Cross 2"
                          : "Diagonal 2";

                    return (
                      <div
                        key={owner}
                        className={`rounded-2xl border p-4 ${
                          owner === "w"
                            ? "border-amber-300/15 bg-amber-300/[0.04]"
                            : "border-violet-300/15 bg-violet-300/[0.04]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-black uppercase tracking-wider text-zinc-400">
                            {owner === "w" ? ui("White bomb") : ui("Black bomb")}
                          </p>
                          <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-black text-zinc-300">
                            {patternLabel}
                          </span>
                        </div>

                        {potato.square ? (
                          <>
                            <div className="mt-3 flex items-end justify-between gap-4">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{ui("Carrier")}</p>
                                <p className="mt-1 font-mono text-xl font-black uppercase text-white">
                                  {potato.square}
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{ui("Explodes in")}</p>
                                <p className="mt-1 text-3xl font-black text-orange-200">
                                  {potato.movesUntilExplosion}{potato.dropped ? ui(" · Paused on ground") : ""}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/30">
                              <div
                                className="h-full rounded-full bg-orange-400 transition-all duration-300"
                                style={{
                                  width: `${Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      (potato.movesUntilExplosion /
                                        Math.max(1, potato.fuseMovesTotal)) *
                                        100,
                                    ),
                                  )}%`,
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-3">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{ui("Cooling down")}</p>
                              <p className="mt-1 text-xs text-zinc-500">{ui("A new random bomb will spawn for this side.")}</p>
                            </div>
                            <span className="text-2xl font-black text-cyan-200">
                              {potato.respawnMovesRemaining}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* HOT POTATO STATS */}

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-zinc-100">
                      {t("Hot Potato Stats")}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("Chaos from this match")}
                    </p>
                  </div>

                  <span className="rounded-full border border-orange-400/15 bg-orange-400/[0.07] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-orange-300">
                    {history.length} {t("plies")}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    icon="💥"
                    label={t("Explosions")}
                    value={String(explosionCount)}
                  />
                  <StatCard
                    icon="↔"
                    label={t("Transfers")}
                    value={String(transferCount)}
                  />
                  <StatCard
                    icon="☠"
                    label={t("Destroyed")}
                    value={String(destroyedPieceCount)}
                  />
                  <StatCard
                    icon="⏳"
                    label={t("Fuse")}
                    value={`${HOT_POTATO_MIN_FUSE_MOVES}–${HOT_POTATO_MAX_FUSE_MOVES}`}
                    detail={t("random moves")}
                  />
                </div>
              </section>

              {/* RULES */}

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-zinc-100">
                    {t("Rules")}
                  </h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    {t("Chess Hot Potato")}
                  </p>
                </div>

                <div className="space-y-2 text-xs leading-5 text-zinc-400">
                  <RuleLine
                    icon="💣"
                    text={t("A random non-king piece starts as the carrier.")}
                  />
                  <RuleLine
                    icon="🎲"
                    text={t(
                      "Each new potato gets a random fuse from 4 to 12 completed player moves.",
                    )}
                  />
                  <RuleLine
                    icon="↔"
                    text={t(
                      "Capture the carrier and your capturing piece inherits it.",
                    )}
                  />
                  <RuleLine
                    icon="💥"
                    text={t(
                      "The carrier square and all 8 adjacent squares explode.",
                    )}
                  />
                  <RuleLine
                    icon="♔"
                    text={t(
                      "If exactly one king is in the blast radius, that player loses.",
                    )}
                  />
                  <RuleLine
                    icon="♔♚"
                    text={t(
                      "If both kings are in the radius, the game is a draw.",
                    )}
                  />
                  <RuleLine
                    icon="❄"
                    text={t(
                      "After an explosion, 5 moves pass before the next potato appears.",
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

/* =========================================================
   SMALL UI COMPONENTS
   ========================================================= */

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: string;
  label: string;
  value: string;
  detail?: string;
}) {
  useUiLanguage();
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-lg" aria-hidden="true">
          {icon}
        </span>
        <span className="text-xl font-black text-white">{value}</span>
      </div>

      <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {ui(label)}
      </p>

      {detail && <p className="mt-0.5 text-[10px] text-zinc-700">{detail}</p>}
    </div>
  );
}

function RuleLine({ icon, text }: { icon: string; text: string }) {
  useUiLanguage();
  return (
    <div className="flex gap-2 rounded-xl border border-white/[0.04] bg-black/15 px-3 py-2">
      <span className="w-7 shrink-0 text-center font-black text-orange-300">
        {icon}
      </span>
      <span>{ui(text)}</span>
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
