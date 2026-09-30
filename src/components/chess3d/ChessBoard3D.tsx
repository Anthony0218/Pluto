import { ui, useUiLanguage } from "@/i18n/ui";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  Chess,
  type Color,
  type Move,
  type PieceSymbol,
  type Square,
} from "chess.js";

import ChessSquare3D from "./ChessSquare3D";
import ChessPiece3D from "./ChessPiece3D";
import {
  coordinatesToSquare,
  squareToWorld,
} from "../../games/chess/3d/chess3dUtils";
import {
  CHESS_3D_CAMERA_POSITIONS,
  type Chess3DCameraView,
  type Chess3DPieceSkin,
} from "../../games/chess/3d/chess3dAppearance";

type VisualPiece = {
  id: string;
  square: Square;
  type: PieceSymbol;
  color: Color;
  captured: boolean;
  promoted: boolean;
};

type CameraEffectKind = "none" | "capture" | "check" | "checkmate";

type CameraEffect = {
  id: number;
  kind: CameraEffectKind;
};

type ExternalMove = {
  id: number;
  move: Move;
} | null;

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

function createVisualPieces(game: Chess): VisualPiece[] {
  const counters: Record<string, number> = {};

  return game.board().flatMap((row) =>
    row
      .filter((piece) => piece !== null)
      .map((piece) => {
        const key = `${piece!.color}-${piece!.type}`;
        counters[key] = (counters[key] ?? 0) + 1;

        return {
          id: `${key}-${counters[key]}-${piece!.square}`,
          square: piece!.square,
          type: piece!.type,
          color: piece!.color,
          captured: false,
          promoted: false,
        };
      }),
  );
}

function getEnPassantCapturedSquare(move: Move): Square {
  return `${move.to[0]}${move.from[1]}` as Square;
}

type CustomCastleSide = "king" | "queen";

function hasMovedFrom(
  moveHistory: Move[],
  color: Color,
  piece: PieceSymbol,
  from: Square,
) {
  return moveHistory.some(
    (move) =>
      move.color === color && move.piece === piece && move.from === from,
  );
}

function isSquareAttacked(game: Chess, square: Square, byColor: Color) {
  const chess = game as Chess & {
    isAttacked?: (square: Square, color: Color) => boolean;
  };

  return typeof chess.isAttacked === "function"
    ? chess.isAttacked(square, byColor)
    : false;
}

function canCustomCastle(
  game: Chess,
  moveHistory: Move[],
  color: Color,
  side: CustomCastleSide,
) {
  const rank = color === "w" ? "1" : "8";
  const kingSquare = `d${rank}` as Square;
  const rookSquare =
    side === "king" ? (`h${rank}` as Square) : (`a${rank}` as Square);

  const king = game.get(kingSquare);
  const rook = game.get(rookSquare);

  if (
    !king ||
    king.type !== "k" ||
    king.color !== color ||
    !rook ||
    rook.type !== "r" ||
    rook.color !== color
  ) {
    return false;
  }

  if (
    hasMovedFrom(moveHistory, color, "k", kingSquare) ||
    hasMovedFrom(moveHistory, color, "r", rookSquare)
  ) {
    return false;
  }

  const emptySquares: Square[] =
    side === "king"
      ? ([`e${rank}`, `f${rank}`, `g${rank}`] as Square[])
      : ([`c${rank}`, `b${rank}`] as Square[]);

  if (emptySquares.some((square) => game.get(square))) {
    return false;
  }

  const enemy: Color = color === "w" ? "b" : "w";

  const kingPath: Square[] =
    side === "king"
      ? ([kingSquare, `e${rank}`, `f${rank}`] as Square[])
      : ([kingSquare, `c${rank}`, `b${rank}`] as Square[]);

  return !kingPath.some((square) => isSquareAttacked(game, square, enemy));
}

function getCustomCastleTargets(
  game: Chess,
  moveHistory: Move[],
  color: Color,
) {
  const rank = color === "w" ? "1" : "8";
  const targets: Array<{
    square: Square;
    side: CustomCastleSide;
  }> = [];

  if (canCustomCastle(game, moveHistory, color, "king")) {
    targets.push({
      square: `f${rank}` as Square,
      side: "king",
    });
  }

  if (canCustomCastle(game, moveHistory, color, "queen")) {
    targets.push({
      square: `b${rank}` as Square,
      side: "queen",
    });
  }

  return targets;
}

function buildCustomCastleFen(
  game: Chess,
  color: Color,
  side: CustomCastleSide,
) {
  const rank = color === "w" ? "1" : "8";

  const kingFrom = `d${rank}` as Square;
  const kingTo =
    side === "king" ? (`f${rank}` as Square) : (`b${rank}` as Square);

  const rookFrom =
    side === "king" ? (`h${rank}` as Square) : (`a${rank}` as Square);

  const rookTo =
    side === "king" ? (`e${rank}` as Square) : (`c${rank}` as Square);

  const next = new Chess(game.fen());

  next.remove(kingFrom);
  next.remove(rookFrom);

  next.put({ type: "k", color }, kingTo);
  next.put({ type: "r", color }, rookTo);

  const currentFields = game.fen().split(" ");
  const nextFields = next.fen().split(" ");

  const halfmove = Number.parseInt(currentFields[4] ?? "0", 10) + 1;

  const fullmove =
    Number.parseInt(currentFields[5] ?? "1", 10) + (color === "b" ? 1 : 0);

  return [
    nextFields[0],
    color === "w" ? "b" : "w",
    "-",
    "-",
    String(halfmove),
    String(fullmove),
  ].join(" ");
}

function createCustomCastleMove(
  game: Chess,
  color: Color,
  side: CustomCastleSide,
) {
  const rank = color === "w" ? "1" : "8";
  const from = `d${rank}` as Square;
  const to = side === "king" ? (`f${rank}` as Square) : (`b${rank}` as Square);

  const resultingFen = buildCustomCastleFen(game, color, side);

  const move = {
    color,
    from,
    to,
    piece: "k",
    captured: undefined,
    promotion: undefined,
    flags: side === "king" ? "K" : "Q",
    san: side === "king" ? "O-O" : "O-O-O",
    before: game.fen(),
    after: resultingFen,
  } as unknown as Move;

  return { move, resultingFen };
}

function BoardFurniture() {
  useUiLanguage();
  return (
    <>
      <mesh position={[0, -0.13, 0]} receiveShadow castShadow>
        <boxGeometry args={[8.9, 0.24, 8.9]} />
        <meshStandardMaterial
          color="#5b3422"
          roughness={0.58}
          metalness={0.03}
        />
      </mesh>

      <mesh position={[0, -0.005, 0]} receiveShadow>
        <boxGeometry args={[8.32, 0.055, 8.32]} />
        <meshStandardMaterial
          color="#9b7a43"
          roughness={0.34}
          metalness={0.36}
        />
      </mesh>

      <mesh position={[0, -0.58, 0]} receiveShadow castShadow>
        <boxGeometry args={[11.8, 0.72, 11.8]} />
        <meshStandardMaterial
          color="#3a241b"
          roughness={0.68}
          metalness={0.01}
        />
      </mesh>

      <mesh position={[0, -1.03, 0]} receiveShadow castShadow>
        <boxGeometry args={[9.8, 0.28, 9.8]} />
        <meshStandardMaterial color="#2a1914" roughness={0.72} />
      </mesh>
    </>
  );
}

function CameraEffects({ effect }: { effect: CameraEffect }) {
  const { camera } = useThree();
  const effectStartPosition = useRef(new THREE.Vector3());
  const elapsedRef = useRef(0);
  const lastEffectIdRef = useRef(-1);

  useEffect(() => {
    if (lastEffectIdRef.current === effect.id) return;

    lastEffectIdRef.current = effect.id;
    elapsedRef.current = 0;

    if (effect.kind !== "none") {
      effectStartPosition.current.copy(camera.position);
    }
  }, [effect, camera]);

  useFrame((_, delta) => {
    if (effect.kind === "none") return;

    elapsedRef.current += delta;
    const elapsed = elapsedRef.current;
    const start = effectStartPosition.current;

    if (effect.kind === "capture") {
      const duration = 0.32;
      const t = Math.min(1, elapsed / duration);
      const strength = (1 - t) * 0.09;

      camera.position.set(
        start.x + Math.sin(elapsed * 58) * strength,
        start.y + Math.sin(elapsed * 43) * strength * 0.55,
        start.z + Math.cos(elapsed * 52) * strength,
      );

      if (t >= 1) camera.position.copy(start);
      return;
    }

    if (effect.kind === "check") {
      const duration = 0.55;
      const t = Math.min(1, elapsed / duration);
      const strength = (1 - t) * 0.055;
      const zoomFactor = Math.sin(t * Math.PI) * 0.045;

      camera.position.set(
        start.x * (1 - zoomFactor) + Math.sin(elapsed * 50) * strength,
        start.y * (1 - zoomFactor * 0.55),
        start.z * (1 - zoomFactor) + Math.cos(elapsed * 46) * strength,
      );

      if (t >= 1) camera.position.copy(start);
      return;
    }

    if (effect.kind === "checkmate") {
      const duration = 1.25;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const target = start.clone().multiplyScalar(0.76);

      camera.position.lerpVectors(start, target, eased);
    }
  });

  return null;
}

function CameraPresetRig({
  view,
  controlsRef,
  userInteractingRef,
}: {
  view: Chess3DCameraView;
  controlsRef: React.MutableRefObject<any>;
  userInteractingRef: React.MutableRefObject<boolean>;
}) {
  useUiLanguage();
  const { camera } = useThree();
  const startRef = useRef(new THREE.Vector3());
  const targetRef = useRef(new THREE.Vector3());
  const progressRef = useRef(1);
  const lastIdRef = useRef(-1);

  useEffect(() => {
    if (lastIdRef.current === view.id) return;

    lastIdRef.current = view.id;
    startRef.current.copy(camera.position);
    targetRef.current.set(...CHESS_3D_CAMERA_POSITIONS[view.preset]);
    progressRef.current = 0;

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0.15, 0);
      controlsRef.current.update();
    }
  }, [view, camera, controlsRef]);

  useFrame((_, delta) => {
    if (progressRef.current >= 1 || userInteractingRef.current) return;

    progressRef.current = Math.min(1, progressRef.current + delta / 0.58);

    const t = progressRef.current;
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    camera.position.lerpVectors(startRef.current, targetRef.current, eased);

    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0.15, 0);
      controlsRef.current.update();
    } else {
      camera.lookAt(0, 0.15, 0);
    }
  });

  return null;
}

function LastMoveTrail({ move }: { move: Move | null }) {
  useUiLanguage();
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const [curve, geometry] = useMemo(() => {
    if (!move) return [null, null] as const;

    const [sx, , sz] = squareToWorld(move.from);
    const [tx, , tz] = squareToWorld(move.to);

    const start = new THREE.Vector3(sx, 0.18, sz);
    const end = new THREE.Vector3(tx, 0.18, tz);
    const mid = start.clone().lerp(end, 0.5);

    if (move.piece === "n") {
      mid.y = 1.05;
    } else if (move.piece === "q" || move.piece === "b") {
      mid.y = 0.36;
    } else {
      mid.y = 0.25;
    }

    const path = new THREE.CatmullRomCurve3([start, mid, end]);
    const tube = new THREE.TubeGeometry(path, 28, 0.025, 8, false);
    return [path, tube] as const;
  }, [move]);

  useFrame((state) => {
    if (!materialRef.current) return;

    materialRef.current.emissiveIntensity =
      1.5 + Math.sin(state.clock.elapsedTime * 5) * 0.45;
    materialRef.current.opacity =
      0.28 + Math.sin(state.clock.elapsedTime * 4) * 0.08;
  });

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!move || !curve || !geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        ref={materialRef}
        color="#fbbf24"
        emissive="#f59e0b"
        emissiveIntensity={1.5}
        transparent
        opacity={0.32}
        depthWrite={false}
      />
    </mesh>
  );
}

function Scene({
  visualPieces,
  selectedSquare,
  legalMoves,
  customCastleTargets,
  onSquareClick,
  checkedKingColor,
  checkmatedKingColor,
  cameraEffect,
  lastMove,
  pieceSkin,
  cameraView,
  controlsRef,
  userInteractingRef,
}: {
  visualPieces: VisualPiece[];
  selectedSquare: Square | null;
  legalMoves: Move[];
  customCastleTargets: Array<{
    square: Square;
    side: CustomCastleSide;
  }>;
  onSquareClick: (square: Square) => void;
  checkedKingColor: Color | null;
  checkmatedKingColor: Color | null;
  cameraEffect: CameraEffect;
  lastMove: Move | null;
  pieceSkin: Chess3DPieceSkin;
  cameraView: Chess3DCameraView;
  controlsRef: React.MutableRefObject<any>;
  userInteractingRef: React.MutableRefObject<boolean>;
}) {
  useUiLanguage();
  const legalMoveMap = useMemo(
    () => new Map(legalMoves.map((move) => [move.to, move])),
    [legalMoves],
  );

  return (
    <>
      <ambientLight intensity={1.05} />
      <hemisphereLight intensity={0.7} color="#fff4db" groundColor="#1c120e" />

      <directionalLight
        position={[5, 10, 6]}
        intensity={2.35}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <BoardFurniture />

      {Array.from({ length: 8 }, (_, rank) =>
        Array.from({ length: 8 }, (_, file) => {
          const square = coordinatesToSquare(file, rank);
          const legalMove = legalMoveMap.get(square);
          const isCustomCastleTarget = customCastleTargets.some(
            (target) => target.square === square,
          );

          return (
            <ChessSquare3D
              key={square}
              square={square}
              file={file}
              rank={rank}
              selected={selectedSquare === square}
              legalMove={Boolean(legalMove) || isCustomCastleTarget}
              legalCapture={Boolean(legalMove?.captured)}
              lastMoveFrom={lastMove?.from === square}
              lastMoveTo={lastMove?.to === square}
              onClick={onSquareClick}
            />
          );
        }),
      )}

      <LastMoveTrail move={lastMove} />

      <Suspense fallback={null}>
        {visualPieces.map((piece) => {
          const isKing = piece.type === "k";

          return (
            <ChessPiece3D
              key={piece.id}
              square={piece.square}
              type={piece.type}
              color={piece.color}
              selected={!piece.captured && selectedSquare === piece.square}
              captured={piece.captured}
              promoted={piece.promoted}
              skin={pieceSkin}
              inCheck={
                isKing &&
                checkedKingColor === piece.color &&
                checkmatedKingColor !== piece.color
              }
              checkmated={isKing && checkmatedKingColor === piece.color}
              onClick={onSquareClick}
            />
          );
        })}
      </Suspense>

      <CameraEffects effect={cameraEffect} />
      <CameraPresetRig
        view={cameraView}
        controlsRef={controlsRef}
        userInteractingRef={userInteractingRef}
      />

      <OrbitControls
        ref={controlsRef}
        target={[0, 0.15, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={17}
        maxPolarAngle={Math.PI / 2.02}
        onStart={() => {
          userInteractingRef.current = true;
        }}
        onEnd={() => {
          userInteractingRef.current = false;
        }}
      />
    </>
  );
}

function CapturedTray({ moveHistory }: { moveHistory: Move[] }) {
  useUiLanguage();
  const capturedByWhite = moveHistory
    .filter((move) => move.color === "w" && move.captured)
    .map((move) => move.captured!) as PieceSymbol[];

  const capturedByBlack = moveHistory
    .filter((move) => move.color === "b" && move.captured)
    .map((move) => move.captured!) as PieceSymbol[];

  function Tray({
    label,
    pieces,
    capturedColor,
  }: {
    label: string;
    pieces: PieceSymbol[];
    capturedColor: Color;
  }) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          {ui(label)}
        </div>

        <div className="mt-2 flex min-h-12 flex-wrap content-start gap-1.5">
          {pieces.length === 0 ? (
            <span className="text-xs text-zinc-600">{ui("None")}</span>
          ) : (
            pieces.map((piece, index) => (
              <span
                key={`${piece}-${index}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-xl shadow-inner shadow-black/30"
                title={`Captured ${piece}`}
              >
                {pieceSymbols[capturedColor][piece]}
              </span>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <aside className="flex flex-col gap-3">
      <div className="rounded-2xl border border-amber-200/15 bg-zinc-950/80 p-4 shadow-xl shadow-black/30 backdrop-blur">
        <div className="mb-3">
          <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">{ui("Captured")}</div>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{ui("Trophies from the current game.")}</p>
        </div>

        <div className="space-y-3">
          <Tray
            label={ui("White captured")}
            pieces={capturedByWhite}
            capturedColor="b"
          />

          <Tray
            label={ui("Black captured")}
            pieces={capturedByBlack}
            capturedColor="w"
          />
        </div>
      </div>
    </aside>
  );
}

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
  const [customCastleTargets, setCustomCastleTargets] = useState<
    Array<{
      square: Square;
      side: CustomCastleSide;
    }>
  >([]);
  const [visualPieces, setVisualPieces] = useState<VisualPiece[]>(() =>
    createVisualPieces(game),
  );
  const [lastResetToken, setLastResetToken] = useState(resetToken);
  const [cameraEffect, setCameraEffect] = useState<CameraEffect>({
    id: 0,
    kind: "none",
  });

  const controlsRef = useRef<any>(null);
  const userInteractingRef = useRef(false);
  const lastExternalMoveIdRef = useRef<number | null>(null);
  const lastMove = moveHistory.at(-1) ?? null;

  const checkedKingColor: Color | null = game.isCheck() ? game.turn() : null;
  const checkmatedKingColor: Color | null = game.isCheckmate()
    ? game.turn()
    : null;

  if (lastResetToken !== resetToken) {
    setLastResetToken(resetToken);
    setVisualPieces(createVisualPieces(game));
    setSelectedSquare(null);
    setLegalMoves([]);
    setCustomCastleTargets([]);
    setCameraEffect((current) => ({
      id: current.id + 1,
      kind: "none",
    }));
  }

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoves([]);
    setCustomCastleTargets([]);
  }

  function selectSquare(square: Square) {
    const piece = game.get(square);

    if (!piece || piece.color !== game.turn()) {
      clearSelection();
      return;
    }

    const moves = game.moves({
      square,
      verbose: true,
    });

    const castleTargets =
      piece.type === "k" &&
      square === (`d${piece.color === "w" ? "1" : "8"}` as Square)
        ? getCustomCastleTargets(game, moveHistory, piece.color)
        : [];

    setSelectedSquare(square);
    setLegalMoves(moves);
    setCustomCastleTargets(castleTargets);
  }

  function animateVisualMove(move: Move) {
    const capturedSquare = move.flags.includes("e")
      ? getEnPassantCapturedSquare(move)
      : move.to;

    setVisualPieces((current) =>
      current.map((piece) => {
        if (
          piece.square === capturedSquare &&
          piece.color !== move.color &&
          !piece.captured
        ) {
          return {
            ...piece,
            captured: true,
          };
        }

        if (
          piece.square === move.from &&
          piece.color === move.color &&
          !piece.captured
        ) {
          return {
            ...piece,
            square: move.to,
            type: move.promotion ?? piece.type,
            promoted: Boolean(move.promotion),
          };
        }

        if (move.flags.includes("K")) {
          const rookFrom = move.color === "w" ? "h1" : "h8";
          const rookTo = move.color === "w" ? "e1" : "e8";

          if (
            piece.square === rookFrom &&
            piece.color === move.color &&
            piece.type === "r"
          ) {
            return {
              ...piece,
              square: rookTo as Square,
            };
          }
        }

        if (move.flags.includes("Q")) {
          const rookFrom = move.color === "w" ? "a1" : "a8";
          const rookTo = move.color === "w" ? "c1" : "c8";

          if (
            piece.square === rookFrom &&
            piece.color === move.color &&
            piece.type === "r"
          ) {
            return {
              ...piece,
              square: rookTo as Square,
            };
          }
        }

        if (move.flags.includes("k")) {
          const rookFrom = move.color === "w" ? "h1" : "h8";
          const rookTo = move.color === "w" ? "f1" : "f8";

          if (
            piece.square === rookFrom &&
            piece.color === move.color &&
            piece.type === "r"
          ) {
            return {
              ...piece,
              square: rookTo as Square,
            };
          }
        }

        if (move.flags.includes("q")) {
          const rookFrom = move.color === "w" ? "a1" : "a8";
          const rookTo = move.color === "w" ? "d1" : "d8";

          if (
            piece.square === rookFrom &&
            piece.color === move.color &&
            piece.type === "r"
          ) {
            return {
              ...piece,
              square: rookTo as Square,
            };
          }
        }

        return piece;
      }),
    );

    window.setTimeout(() => {
      setVisualPieces((current) => current.filter((piece) => !piece.captured));
    }, 590);

    if (move.promotion) {
      window.setTimeout(() => {
        setVisualPieces((current) =>
          current.map((piece) =>
            piece.square === move.to &&
            piece.color === move.color &&
            piece.type === move.promotion
              ? { ...piece, promoted: false }
              : piece,
          ),
        );
      }, 700);
    }
  }

  function triggerCameraEffect(kind: CameraEffectKind) {
    setCameraEffect((current) => ({
      id: current.id + 1,
      kind,
    }));
  }

  function triggerEffectForMove(move: Move, resultingGame: Chess) {
    if (resultingGame.isCheckmate()) {
      triggerCameraEffect("checkmate");
    } else if (resultingGame.isCheck()) {
      triggerCameraEffect("check");
    } else if (move.captured) {
      triggerCameraEffect("capture");
    } else {
      triggerCameraEffect("none");
    }
  }

  useEffect(() => {
    if (!externalMove) return;

    if (lastExternalMoveIdRef.current === externalMove.id) {
      return;
    }

    lastExternalMoveIdRef.current = externalMove.id;

    animateVisualMove(externalMove.move);
    triggerEffectForMove(externalMove.move, game);
    clearSelection();
  }, [externalMove, game]);

  function handleSquareClick(square: Square) {
    if (!inputEnabled) return;

    const clickedPiece = game.get(square);

    if (!selectedSquare) {
      selectSquare(square);
      return;
    }

    if (clickedPiece?.color === game.turn()) {
      selectSquare(square);
      return;
    }

    const customCastle = customCastleTargets.find(
      (target) => target.square === square,
    );

    if (customCastle && selectedSquare) {
      const movingPiece = game.get(selectedSquare);

      if (movingPiece?.type === "k" && movingPiece.color === game.turn()) {
        const { move: executedMove, resultingFen } = createCustomCastleMove(
          game,
          movingPiece.color,
          customCastle.side,
        );

        animateVisualMove(executedMove);

        const resultingGame = new Chess(resultingFen);
        triggerEffectForMove(executedMove, resultingGame);

        onMove(executedMove, resultingFen);
        clearSelection();
        return;
      }
    }

    const destinationMoves = legalMoves.filter((move) => move.to === square);

    if (destinationMoves.length === 0) {
      clearSelection();
      return;
    }

    const legalMove = destinationMoves[0];
    const nextGame = new Chess(game.fen());

    const promotionMoves = destinationMoves.filter((move) =>
      Boolean(move.promotion),
    );

    const chosenPromotionMove =
      promotionMoves.length > 0
        ? promotionMoves[Math.floor(Math.random() * promotionMoves.length)]
        : legalMove;

    const executedMove = nextGame.move({
      from: selectedSquare,
      to: square,
      promotion: chosenPromotionMove.promotion,
    });

    animateVisualMove(executedMove);
    triggerEffectForMove(executedMove, nextGame);

    onMove(executedMove);
    clearSelection();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_190px]">
      <div
        className="relative h-[700px] w-full overflow-hidden rounded-[2rem] border border-amber-200/20 bg-zinc-950 shadow-2xl shadow-black/50"
        style={{
          backgroundImage: `
            linear-gradient(
              rgba(8, 6, 5, 0.30),
              rgba(8, 6, 5, 0.62)
            ),
            url("${backgroundImage}")
          `,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/10" />

        <Canvas
          shadows
          gl={{ alpha: true }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = THREE.PCFShadowMap;
          }}
          camera={{
            position: [7.4, 7.6, 7.4],
            fov: 44,
            near: 0.1,
            far: 100,
          }}
        >
          <Scene
            visualPieces={visualPieces}
            selectedSquare={selectedSquare}
            legalMoves={legalMoves}
            customCastleTargets={customCastleTargets}
            onSquareClick={handleSquareClick}
            checkedKingColor={checkedKingColor}
            checkmatedKingColor={checkmatedKingColor}
            cameraEffect={cameraEffect}
            lastMove={lastMove}
            pieceSkin={pieceSkin}
            cameraView={cameraView}
            controlsRef={controlsRef}
            userInteractingRef={userInteractingRef}
          />
        </Canvas>
      </div>

      <CapturedTray moveHistory={moveHistory} />
    </div>
  );
}
