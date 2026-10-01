import { ui, useUiLanguage } from "@/i18n/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Color, type Move, type PieceSymbol, type Square } from "chess.js";
import type { PieceModelBase } from "@/games/chess/custom/engine/types";
import { coordinatesToSquare, squareToCoordinates } from "../../games/chess/3d/chess3dUtils";
import type { Chess3DCameraView, Chess3DPieceSkin } from "../../games/chess/3d/chess3dAppearance";
import Board3DCanvas, { type Board3DPiece, type Board3DTheme, type CameraShakeKind } from "./Board3DScene";
import type { Square3DMark } from "./ChessSquare3D";

type VisualPiece = {
  id: string;
  square: Square;
  type: PieceSymbol;
  color: Color;
  captured: boolean;
  promoted: boolean;
};

type ExternalMove = { id: number; move: Move } | null;

type Props = {
  game: Chess;
  resetToken: number;
  onMove: (move: Move, resultingFen?: string) => void;
  backgroundImage?: string;
  inputEnabled?: boolean;
  externalMove?: ExternalMove;
  moveHistory?: Move[];
  pieceSkin?: Chess3DPieceSkin;
  cameraView?: Chess3DCameraView;
};

const pieceSymbols: Record<Color, Record<PieceSymbol, string>> = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};

const MODEL_BASE: Record<PieceSymbol, PieceModelBase> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/** The original walnut-and-bone look of 3D chess, now on the shared scene. */
const CLASSIC_THEME: Board3DTheme = {
  light: "#d8d3c8",
  dark: "#33251f",
  roughness: 0.55,
  metalness: 0.02,
  frame: "#5b3422",
  base: "#3a241b",
  trim: "#9b7a43",
  keyLight: "#fff4db",
  rimLight: "#f59e0b",
};

function createVisualPieces(game: Chess): VisualPiece[] {
  const counters: Record<string, number> = {};
  return game.board().flatMap((row) =>
    row
      .filter((piece) => piece !== null)
      .map((piece) => {
        const key = `${piece!.color}-${piece!.type}`;
        counters[key] = (counters[key] ?? 0) + 1;
        return { id: `${key}-${counters[key]}-${piece!.square}`, square: piece!.square, type: piece!.type, color: piece!.color, captured: false, promoted: false };
      }),
  );
}

function getEnPassantCapturedSquare(move: Move): Square {
  return `${move.to[0]}${move.from[1]}` as Square;
}

type CustomCastleSide = "king" | "queen";

function hasMovedFrom(moveHistory: Move[], color: Color, piece: PieceSymbol, from: Square) {
  return moveHistory.some((move) => move.color === color && move.piece === piece && move.from === from);
}

function isSquareAttacked(game: Chess, square: Square, byColor: Color) {
  const chess = game as Chess & { isAttacked?: (square: Square, color: Color) => boolean };
  return typeof chess.isAttacked === "function" ? chess.isAttacked(square, byColor) : false;
}

/* This page starts with king and queen swapped (king on d1), so castling is custom. */
function canCustomCastle(game: Chess, moveHistory: Move[], color: Color, side: CustomCastleSide) {
  const rank = color === "w" ? "1" : "8";
  const kingSquare = `d${rank}` as Square;
  const rookSquare = side === "king" ? (`h${rank}` as Square) : (`a${rank}` as Square);
  const king = game.get(kingSquare);
  const rook = game.get(rookSquare);
  if (!king || king.type !== "k" || king.color !== color || !rook || rook.type !== "r" || rook.color !== color) return false;
  if (hasMovedFrom(moveHistory, color, "k", kingSquare) || hasMovedFrom(moveHistory, color, "r", rookSquare)) return false;
  const emptySquares: Square[] = side === "king" ? ([`e${rank}`, `f${rank}`, `g${rank}`] as Square[]) : ([`c${rank}`, `b${rank}`] as Square[]);
  if (emptySquares.some((square) => game.get(square))) return false;
  const enemy: Color = color === "w" ? "b" : "w";
  const kingPath: Square[] = side === "king" ? ([kingSquare, `e${rank}`, `f${rank}`] as Square[]) : ([kingSquare, `c${rank}`, `b${rank}`] as Square[]);
  return !kingPath.some((square) => isSquareAttacked(game, square, enemy));
}

function getCustomCastleTargets(game: Chess, moveHistory: Move[], color: Color) {
  const rank = color === "w" ? "1" : "8";
  const targets: Array<{ square: Square; side: CustomCastleSide }> = [];
  if (canCustomCastle(game, moveHistory, color, "king")) targets.push({ square: `f${rank}` as Square, side: "king" });
  if (canCustomCastle(game, moveHistory, color, "queen")) targets.push({ square: `b${rank}` as Square, side: "queen" });
  return targets;
}

function buildCustomCastleFen(game: Chess, color: Color, side: CustomCastleSide) {
  const rank = color === "w" ? "1" : "8";
  const kingFrom = `d${rank}` as Square;
  const kingTo = side === "king" ? (`f${rank}` as Square) : (`b${rank}` as Square);
  const rookFrom = side === "king" ? (`h${rank}` as Square) : (`a${rank}` as Square);
  const rookTo = side === "king" ? (`e${rank}` as Square) : (`c${rank}` as Square);
  const next = new Chess(game.fen());
  next.remove(kingFrom);
  next.remove(rookFrom);
  next.put({ type: "k", color }, kingTo);
  next.put({ type: "r", color }, rookTo);
  const currentFields = game.fen().split(" ");
  const nextFields = next.fen().split(" ");
  const halfmove = Number.parseInt(currentFields[4] ?? "0", 10) + 1;
  const fullmove = Number.parseInt(currentFields[5] ?? "1", 10) + (color === "b" ? 1 : 0);
  return [nextFields[0], color === "w" ? "b" : "w", "-", "-", String(halfmove), String(fullmove)].join(" ");
}

function createCustomCastleMove(game: Chess, color: Color, side: CustomCastleSide) {
  const rank = color === "w" ? "1" : "8";
  const from = `d${rank}` as Square;
  const to = side === "king" ? (`f${rank}` as Square) : (`b${rank}` as Square);
  const resultingFen = buildCustomCastleFen(game, color, side);
  const move = { color, from, to, piece: "k", captured: undefined, promotion: undefined, flags: side === "king" ? "K" : "Q", san: side === "king" ? "O-O" : "O-O-O", before: game.fen(), after: resultingFen } as unknown as Move;
  return { move, resultingFen };
}

/** Where each rook goes for every castling flag (standard and this page's custom castling). */
const ROOK_CASTLE_MOVES: Record<string, Record<Color, [Square, Square]>> = {
  K: { w: ["h1", "e1"], b: ["h8", "e8"] },
  Q: { w: ["a1", "c1"], b: ["a8", "c8"] },
  k: { w: ["h1", "f1"], b: ["h8", "f8"] },
  q: { w: ["a1", "d1"], b: ["a8", "d8"] },
};

function Tray({ label, pieces, capturedColor }: { label: string; pieces: PieceSymbol[]; capturedColor: Color }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{ui(label)}</div>
      <div className="mt-2 flex min-h-12 flex-wrap content-start gap-1.5">
        {pieces.length === 0 ? (
          <span className="text-xs text-zinc-600">{ui("None")}</span>
        ) : (
          pieces.map((piece, index) => (
            <span key={`${piece}-${index}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-xl shadow-inner shadow-black/30" title={`Captured ${piece}`}>
              {pieceSymbols[capturedColor][piece]}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function CapturedTray({ moveHistory }: { moveHistory: Move[] }) {
  useUiLanguage();
  const capturedByWhite = moveHistory.filter((move) => move.color === "w" && move.captured).map((move) => move.captured!) as PieceSymbol[];
  const capturedByBlack = moveHistory.filter((move) => move.color === "b" && move.captured).map((move) => move.captured!) as PieceSymbol[];
  return (
    <aside className="flex flex-col gap-3">
      <div className="rounded-2xl border border-amber-200/15 bg-zinc-950/80 p-4 shadow-xl shadow-black/30 backdrop-blur">
        <div className="mb-3">
          <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">{ui("Captured")}</div>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{ui("Trophies from the current game.")}</p>
        </div>
        <div className="space-y-3">
          <Tray label={ui("White captured")} pieces={capturedByWhite} capturedColor="b" />
          <Tray label={ui("Black captured")} pieces={capturedByBlack} capturedColor="w" />
        </div>
      </div>
    </aside>
  );
}

const BOARD_CELLS = Array.from({ length: 64 }, (_, index) => ({ x: index % 8, y: Math.floor(index / 8), enabled: true, tile: "normal" as const }));

export default function ChessBoard3D({
  game,
  resetToken,
  onMove,
  backgroundImage = "/images/chess-3d-background.jpg",
  inputEnabled = true,
  externalMove = null,
  moveHistory = [],
  pieceSkin = "classic",
  cameraView = { id: 0, preset: "classic" },
}: Props) {
  useUiLanguage();
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [customCastleTargets, setCustomCastleTargets] = useState<Array<{ square: Square; side: CustomCastleSide }>>([]);
  const [visualPieces, setVisualPieces] = useState<VisualPiece[]>(() => createVisualPieces(game));
  const [lastResetToken, setLastResetToken] = useState(resetToken);
  const [cameraShake, setCameraShake] = useState<{ id: number; kind: CameraShakeKind }>({ id: 0, kind: "none" });
  const lastExternalMoveIdRef = useRef<number | null>(null);
  const lastMove = moveHistory.at(-1) ?? null;

  const checkedKingColor: Color | null = game.isCheck() ? game.turn() : null;
  const checkmatedKingColor: Color | null = game.isCheckmate() ? game.turn() : null;

  if (lastResetToken !== resetToken) {
    setLastResetToken(resetToken);
    setVisualPieces(createVisualPieces(game));
    setSelectedSquare(null);
    setLegalMoves([]);
    setCustomCastleTargets([]);
    setCameraShake((current) => ({ id: current.id + 1, kind: "none" }));
  }

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoves([]);
    setCustomCastleTargets([]);
  }

  function selectSquare(square: Square) {
    const piece = game.get(square);
    if (!piece || piece.color !== game.turn()) return clearSelection();
    setSelectedSquare(square);
    setLegalMoves(game.moves({ square, verbose: true }));
    setCustomCastleTargets(piece.type === "k" && square === (`d${piece.color === "w" ? "1" : "8"}` as Square) ? getCustomCastleTargets(game, moveHistory, piece.color) : []);
  }

  function animateVisualMove(move: Move) {
    const capturedSquare = move.flags.includes("e") ? getEnPassantCapturedSquare(move) : move.to;
    const castleFlag = ["K", "Q", "k", "q"].find((flag) => move.flags.includes(flag));
    const rookMove = castleFlag ? ROOK_CASTLE_MOVES[castleFlag][move.color] : null;
    setVisualPieces((current) =>
      current.map((piece) => {
        if (piece.captured) return piece;
        if (piece.square === capturedSquare && piece.color !== move.color) return { ...piece, captured: true };
        if (piece.square === move.from && piece.color === move.color) return { ...piece, square: move.to, type: move.promotion ?? piece.type, promoted: Boolean(move.promotion) };
        if (rookMove && piece.square === rookMove[0] && piece.color === move.color && piece.type === "r") return { ...piece, square: rookMove[1] };
        return piece;
      }),
    );
    window.setTimeout(() => setVisualPieces((current) => current.filter((piece) => !piece.captured)), 590);
    if (move.promotion) {
      window.setTimeout(() => setVisualPieces((current) => current.map((piece) => (piece.square === move.to && piece.color === move.color ? { ...piece, promoted: false } : piece))), 700);
    }
  }

  function shakeFor(move: Move, resultingGame: Chess) {
    const kind: CameraShakeKind = resultingGame.isCheckmate() ? "checkmate" : resultingGame.isCheck() ? "check" : move.captured ? "capture" : "none";
    setCameraShake((current) => ({ id: current.id + 1, kind }));
  }

  // Replay moves made outside this component (AI) with the same animation.
  const replayExternal = useRef({ animateVisualMove, shakeFor, clearSelection });
  useEffect(() => {
    replayExternal.current = { animateVisualMove, shakeFor, clearSelection };
  });
  useEffect(() => {
    if (!externalMove || lastExternalMoveIdRef.current === externalMove.id) return;
    lastExternalMoveIdRef.current = externalMove.id;
    replayExternal.current.animateVisualMove(externalMove.move);
    replayExternal.current.shakeFor(externalMove.move, game);
    replayExternal.current.clearSelection();
  }, [externalMove, game]);

  function handleSquareClick(x: number, y: number) {
    if (!inputEnabled) return;
    const square = coordinatesToSquare(x, y);
    const clickedPiece = game.get(square);
    if (!selectedSquare || clickedPiece?.color === game.turn()) return selectSquare(square);

    const customCastle = customCastleTargets.find((target) => target.square === square);
    const movingPiece = game.get(selectedSquare);
    if (customCastle && movingPiece?.type === "k" && movingPiece.color === game.turn()) {
      const { move, resultingFen } = createCustomCastleMove(game, movingPiece.color, customCastle.side);
      animateVisualMove(move);
      shakeFor(move, new Chess(resultingFen));
      onMove(move, resultingFen);
      clearSelection();
      return;
    }

    const destinationMoves = legalMoves.filter((move) => move.to === square);
    if (destinationMoves.length === 0) return clearSelection();
    const promotionMoves = destinationMoves.filter((move) => Boolean(move.promotion));
    const chosen = promotionMoves.length > 0 ? promotionMoves[Math.floor(Math.random() * promotionMoves.length)] : destinationMoves[0];
    const nextGame = new Chess(game.fen());
    const executedMove = nextGame.move({ from: selectedSquare, to: square, promotion: chosen.promotion });
    animateVisualMove(executedMove);
    shakeFor(executedMove, nextGame);
    onMove(executedMove);
    clearSelection();
  }

  const marks = useMemo(() => {
    const map = new Map<string, Square3DMark>();
    const key = (square: Square) => {
      const { x, y } = squareToCoordinates(square);
      return `${x},${y}`;
    };
    if (lastMove) {
      map.set(key(lastMove.from), "lastFrom");
      map.set(key(lastMove.to), "lastTo");
    }
    for (const move of legalMoves) map.set(key(move.to), move.captured ? "capture" : "move");
    for (const target of customCastleTargets) map.set(key(target.square), "special");
    if (selectedSquare) map.set(key(selectedSquare), "selected");
    return map;
  }, [lastMove, legalMoves, customCastleTargets, selectedSquare]);

  const pieces: Board3DPiece[] = visualPieces.map((piece) => {
    const { x, y } = squareToCoordinates(piece.square);
    const isKing = piece.type === "k";
    return {
      id: piece.id,
      x,
      y,
      base: MODEL_BASE[piece.type],
      set: piece.color === "w" ? "light" : "dark",
      captured: piece.captured,
      promotedKey: piece.promoted ? 1 : 0,
      inCheck: isKing && checkedKingColor === piece.color && checkmatedKingColor !== piece.color,
      checkmated: isKing && checkmatedKingColor === piece.color,
      motion: piece.type === "n" ? "jump" : "slide",
    };
  });
  const selectedPieceId = visualPieces.find((piece) => !piece.captured && piece.square === selectedSquare)?.id ?? null;
  const trail = lastMove ? [squareToCoordinates(lastMove.from), squareToCoordinates(lastMove.to)] : null;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_190px]">
      <div
        className="relative h-[700px] w-full overflow-hidden rounded-[2rem] border border-amber-200/20 bg-zinc-950 shadow-2xl shadow-black/50"
        style={{ backgroundImage: `linear-gradient(rgba(8, 6, 5, 0.30), rgba(8, 6, 5, 0.62)), url("${backgroundImage}")`, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/10" />
        <Board3DCanvas
          width={8}
          height={8}
          cells={BOARD_CELLS}
          pieces={pieces}
          marks={marks}
          selectedPieceId={selectedPieceId}
          theme={CLASSIC_THEME}
          skin={pieceSkin}
          cameraView={cameraView}
          cameraShake={cameraShake}
          trail={trail}
          trailJump={lastMove?.piece === "n"}
          atmosphere={false}
          onCellClick={handleSquareClick}
        />
      </div>
      <CapturedTray moveHistory={moveHistory} />
    </div>
  );
}
