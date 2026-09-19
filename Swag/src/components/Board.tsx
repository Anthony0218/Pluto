import { useEffect, useRef, useState } from "react";

import { type Square } from "chess.js";
import { getSquareName } from "../utils/chessUtils";
import { useChessSettings } from "@/context/ChessSettingsContext";

type BoardPiece = {
  type: "p" | "n" | "b" | "r" | "q" | "k";
  color: "w" | "b";
};

type BoardProps = {
  board: (BoardPiece | null)[][];
  selectedSquare: Square | null;
  legalMoves: Square[];
  lastMove: {
    from: Square;
    to: Square;
  } | null;
  checkedKingSquare: Square | null;
  onSquareClick: (row: number, column: number) => void;

  /*
   * Variant-only square markers.
   * Optional so Classic / AI / Multiplayer do not need to pass anything.
   */
  heartSquares?: Square[];

  /*
   * Mutation Chess uses the same native square rendering path,
   * so its highlight never drifts from the chess board.
   */
  mutationSquares?: Square[];

  /*
   * Capitalism Chess bounty targets.
   * Rendered natively inside the real square, just like last-move
   * and variant highlights.
   */
  bountySquares?: Square[];

  /*
   * Capitalism Chess shop spawn points.
   * All home-rook squares are marked; currently usable empty squares
   * receive the stronger marker.
   */
  shopSpawnSquares?: Square[];
  availableShopSpawnSquares?: Square[];

  /*
   * King Journey mission destinations.
   * Kept separate so White and Black targets are visually distinct.
   */
  whiteMissionTargetSquares?: Square[];
  blackMissionTargetSquares?: Square[];

  /*
   * Horror Chess status markers.
   */
  infectedSquares?: Square[];
  cursedSquares?: Square[];
  hotSquares?: Square[];
  frozenSquares?: Square[];
  doomedSquares?: Square[];
  graveSquares?: Square[];
  fogSquares?: Square[];

  /*
   * Draft Chess setup-zone markers.
   */
  draftSetupSquares?: Square[];
  draftKingSquares?: Square[];

  /*
   * Mirror Chess setup markers.
   */
  mirrorSetupSquares?: Square[];
  mirrorAvailableSquares?: Square[];
  mirrorPreviewSquares?: Square[];

  /*
   * ChessRoulette Lucky Squares.
   *
   * Untriggered Lucky Squares show "?".
   * Triggered Lucky Squares reveal their effect icon until they expire.
   */
  luckySquares?: Square[];
  destroyLuckySquares?: Square[];
  teleportLuckySquares?: Square[];
  swapLuckySquares?: Square[];
  promoteLuckySquares?: Square[];
  activeLuckySquares?: Square[];

  /*
   * Chess Hot Potato markers.
   *
   * The carrier gets a native bomb/countdown badge.
   * The most recent blast uses the same native square overlay path
   * as the other variants.
   */
  hotPotatoSquare?: Square | null;
  hotPotatoMovesRemaining?: number;
  hotPotatoExplosionSquares?: Square[];
  hotPotatoBlownUpKingSquares?: Square[];

  /*
   * Chess Collapse markers.
   * Warning squares crack first, impact squares flash on the collapse move,
   * and collapsed squares become permanent holes in the board.
   */
  collapseWarningSquares?: Square[];
  collapsedSquares?: Square[];
  collapseImpactSquares?: Square[];

  /*
   * Boss Battle Chess markers.
   */
  bossSquare?: Square | null;
  bossPowerTargetSquares?: Square[];
  bossPowerTargetMode?: "summon" | "dark_step" | null;
  bossShockwaveSquares?: Square[];
  bossArmorActive?: boolean;
  bossRage?: number;

  orientation?: "white" | "black";

  /*
   * Allows smaller pieces on boards
   * such as Game Review without
   * changing the normal game board.
   */
  pieceScale?: number;
};

const pieceSymbols = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",

  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
};

export default function Board({
  board,
  selectedSquare,
  legalMoves,
  lastMove,
  checkedKingSquare,
  onSquareClick,
  heartSquares = [],
  mutationSquares = [],
  bountySquares = [],
  shopSpawnSquares = [],
  availableShopSpawnSquares = [],
  whiteMissionTargetSquares = [],
  blackMissionTargetSquares = [],
  infectedSquares = [],
  cursedSquares = [],
  hotSquares = [],
  frozenSquares = [],
  doomedSquares = [],
  graveSquares = [],
  fogSquares = [],
  draftSetupSquares = [],
  draftKingSquares = [],
  mirrorSetupSquares = [],
  mirrorAvailableSquares = [],
  mirrorPreviewSquares = [],
  luckySquares = [],
  destroyLuckySquares = [],
  teleportLuckySquares = [],
  swapLuckySquares = [],
  promoteLuckySquares = [],
  activeLuckySquares = [],
  hotPotatoSquare = null,
  hotPotatoMovesRemaining = 0,
  hotPotatoExplosionSquares = [],
  hotPotatoBlownUpKingSquares = [],
  collapseWarningSquares = [],
  collapsedSquares = [],
  collapseImpactSquares = [],
  bossSquare = null,
  bossPowerTargetSquares = [],
  bossPowerTargetMode = null,
  bossShockwaveSquares = [],
  bossArmorActive = false,
  bossRage = 0,
  orientation = "white",
  pieceScale = 1,
}: BoardProps) {
  /*
   * Orientation animation lives INSIDE Board.tsx.
   *
   * Parent components continue to pass only:
   *
   *   orientation="white" | "black"
   *
   * When orientation changes, the whole chess board turns FLAT
   * through 180 degrees like a physical board being rotated on a
   * table.
   *
   * The piece layer counter-rotates by -180 degrees at the same
   * speed, so the chess symbols stay upright while their positions
   * travel around the board.
   *
   * At the end of the animation:
   *   - the logical displayed orientation changes,
   *   - board rotation resets instantly to 0,
   *   - piece counter-rotation resets instantly to 0.
   *
   * A 180°-rotated White-oriented board has the same square
   * positions as a Black-oriented board, so that reset is visually
   * seamless.
   */
  const [displayedOrientation, setDisplayedOrientation] = useState<
    "white" | "black"
  >(orientation);

  const { boardAnimationEnabled } = useChessSettings();

  type RotationPhase = "idle" | "rotating" | "reset";

  const [rotationPhase, setRotationPhase] = useState<RotationPhase>("idle");

  const displayedOrientationRef = useRef<"white" | "black">(orientation);

  const rotationTimerRef = useRef<number | null>(null);

  const resetFrameRef = useRef<number | null>(null);

  const ROTATION_MS = 520;

  useEffect(() => {
    /*
     * Stop any previous rotation/reset before reacting to the
     * requested orientation or animation setting.
     */
    if (rotationTimerRef.current !== null) {
      window.clearTimeout(rotationTimerRef.current);

      rotationTimerRef.current = null;
    }

    if (resetFrameRef.current !== null) {
      window.cancelAnimationFrame(resetFrameRef.current);

      resetFrameRef.current = null;
    }

    /*
     * Nothing to flip.
     */
    if (orientation === displayedOrientationRef.current) {
      if (!boardAnimationEnabled) {
        setRotationPhase("idle");
      }

      return;
    }

    /*
     * ANIMATION OFF
     *
     * The orientation prop itself is still delayed by
     * useDelayedBoardOrientation. Once that delayed orientation
     * arrives here, switch sides immediately without rotating.
     */
    if (!boardAnimationEnabled) {
      displayedOrientationRef.current = orientation;

      setDisplayedOrientation(orientation);

      /*
       * "reset" disables CSS transitions for the instantaneous swap.
       */
      setRotationPhase("reset");

      resetFrameRef.current = window.requestAnimationFrame(() => {
        setRotationPhase("idle");

        resetFrameRef.current = null;
      });

      return;
    }

    /*
     * ANIMATION ON
     *
     * Rotate the currently displayed board through a full half-turn.
     */
    setRotationPhase("rotating");

    rotationTimerRef.current = window.setTimeout(() => {
      /*
       * At 180° the physical square locations already match the
       * requested opposite orientation.
       *
       * Swap the logical orientation and remove the transforms
       * without a transition. The screen therefore stays in the
       * same visual position while the DOM returns to its normal
       * unrotated state.
       */
      displayedOrientationRef.current = orientation;

      setDisplayedOrientation(orientation);

      setRotationPhase("reset");

      rotationTimerRef.current = null;

      resetFrameRef.current = window.requestAnimationFrame(() => {
        setRotationPhase("idle");

        resetFrameRef.current = null;
      });
    }, ROTATION_MS);

    return () => {
      if (rotationTimerRef.current !== null) {
        window.clearTimeout(rotationTimerRef.current);

        rotationTimerRef.current = null;
      }

      if (resetFrameRef.current !== null) {
        window.cancelAnimationFrame(resetFrameRef.current);

        resetFrameRef.current = null;
      }
    };
  }, [orientation, boardAnimationEnabled]);

  const orientationAnimating =
    boardAnimationEnabled && rotationPhase !== "idle";

  const boardRotation = rotationPhase === "rotating" ? 180 : 0;

  const pieceCounterRotation = rotationPhase === "rotating" ? -180 : 0;

  const boardTransform = `rotate(${boardRotation}deg)`;

  const boardTransition =
    !boardAnimationEnabled || rotationPhase === "reset"
      ? "none"
      : `transform ${ROTATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), filter 220ms ease, box-shadow 220ms ease`;

  const pieceTransition =
    !boardAnimationEnabled || rotationPhase === "reset"
      ? "none"
      : `transform ${ROTATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;

  const boardFilter =
    boardAnimationEnabled && rotationPhase === "rotating"
      ? "brightness(0.9) saturate(0.95)"
      : "brightness(1) saturate(1)";

  const boardShadow =
    boardAnimationEnabled && rotationPhase === "rotating"
      ? "0 38px 90px rgba(0,0,0,0.62)"
      : "0 30px 80px rgba(0,0,0,0.55)";

  return (
    /*
     * ROTATION WRAPPER
     *
     * No 3D perspective is needed now. This is a flat, tabletop
     * rotation around the center of the board.
     */
    <div className="w-full">
      {/*
       * OUTER WOODEN FRAME
       */}
      <div
        aria-busy={orientationAnimating}
        className="
          w-full
          rounded-[28px]
          border
          border-[#5f412d]
          bg-gradient-to-br
          from-[#493323]
          via-[#2d1e15]
          to-[#160e09]
          p-3
          sm:p-4
        "
        style={{
          transform: boardTransform,

          transition: boardTransition,

          transformOrigin: "center center",

          willChange: "transform, filter, box-shadow",

          filter: boardFilter,

          boxShadow: boardShadow,
        }}
      >
        {/* Inner frame */}

        <div
          className="
          rounded-[18px]
          border
          border-black/40
          bg-[#160e09]
          p-1.5
          shadow-inner
          sm:p-2
        "
        >
          {/* Chess board */}

          <div
            className="
            grid
            aspect-square
            w-full
            grid-cols-8
            grid-rows-8
            overflow-hidden
            rounded-xl
            shadow-[0_12px_30px_rgba(0,0,0,0.45)]
          "
          >
            {board.map((_, displayRow) =>
              board[displayRow].map((_, displayColumn) => {
                /*
                 * Actual chess.js coordinates.
                 *
                 * The displayed position changes when
                 * playing as Black, while the real
                 * chess coordinates remain correct.
                 */

                const row =
                  displayedOrientation === "white"
                    ? displayRow
                    : 7 - displayRow;

                const column =
                  displayedOrientation === "white"
                    ? displayColumn
                    : 7 - displayColumn;

                const piece = board[row][column];

                const square = getSquareName(row, column);

                const isLight = (row + column) % 2 === 0;

                const isSelected = selectedSquare === square;

                const isLegalMove = legalMoves.includes(square);

                const isLastMove =
                  lastMove?.from === square || lastMove?.to === square;

                const isHeartSquare = heartSquares.includes(square);

                const isMutationSquare = mutationSquares.includes(square);

                const isBountySquare = bountySquares.includes(square);

                const isShopSpawnSquare = shopSpawnSquares.includes(square);

                const isAvailableShopSpawnSquare =
                  availableShopSpawnSquares.includes(square);

                const isWhiteMissionTargetSquare =
                  whiteMissionTargetSquares.includes(square);

                const isBlackMissionTargetSquare =
                  blackMissionTargetSquares.includes(square);

                const isAnyMissionTargetSquare =
                  isWhiteMissionTargetSquare || isBlackMissionTargetSquare;

                const isInfectedSquare = infectedSquares.includes(square);

                const isCursedSquare = cursedSquares.includes(square);

                const isHotSquare = hotSquares.includes(square);

                const isFrozenSquare = frozenSquares.includes(square);

                const isDoomedSquare = doomedSquares.includes(square);

                const isGraveSquare = graveSquares.includes(square);

                const isFogSquare = fogSquares.includes(square);

                const isDraftSetupSquare = draftSetupSquares.includes(square);

                const isDraftKingSquare = draftKingSquares.includes(square);

                const isMirrorSetupSquare = mirrorSetupSquares.includes(square);

                const isMirrorAvailableSquare =
                  mirrorAvailableSquares.includes(square);

                const isMirrorPreviewSquare =
                  mirrorPreviewSquares.includes(square);

                const isLuckySquare = luckySquares.includes(square);

                const isDestroyLuckySquare =
                  destroyLuckySquares.includes(square);

                const isTeleportLuckySquare =
                  teleportLuckySquares.includes(square);

                const isSwapLuckySquare = swapLuckySquares.includes(square);

                const isPromoteLuckySquare =
                  promoteLuckySquares.includes(square);

                const isTriggeredLuckySquare =
                  isDestroyLuckySquare ||
                  isTeleportLuckySquare ||
                  isSwapLuckySquare ||
                  isPromoteLuckySquare;

                const isActiveLuckySquare = activeLuckySquares.includes(square);

                const isHotPotatoSquare = hotPotatoSquare === square;

                const isHotPotatoExplosionSquare =
                  hotPotatoExplosionSquares.includes(square);

                const isHotPotatoBlownUpKingSquare =
                  hotPotatoBlownUpKingSquares.includes(square) &&
                  piece?.type === "k";

                const isCollapseWarningSquare =
                  collapseWarningSquares.includes(square);

                const isCollapsedSquare = collapsedSquares.includes(square);

                const isCollapseImpactSquare =
                  collapseImpactSquares.includes(square);

                const isBossSquare = bossSquare === square;

                const isBossPowerTargetSquare =
                  bossPowerTargetSquares.includes(square);

                const isBossShockwaveSquare =
                  bossShockwaveSquares.includes(square);

                const isCheckedKing =
                  piece?.type === "k" && checkedKingSquare === square;

                let symbol = "";

                if (piece) {
                  const key =
                    `${piece.color}${piece.type}` as keyof typeof pieceSymbols;

                  symbol = pieceSymbols[key];
                }

                const file = square[0];
                const rank = square[1];

                return (
                  <button
                    key={square}
                    type="button"
                    aria-label={square}
                    onClick={() => {
                      if (orientationAnimating) {
                        return;
                      }

                      onSquareClick(row, column);
                    }}
                    disabled={orientationAnimating}
                    className={`
                    group
                    relative
                    flex
                    aspect-square
                    items-center
                    justify-center
                    overflow-hidden
                    border-0
                    p-0
                    transition-[filter,box-shadow]
                    duration-150
                    focus:outline-none
                    disabled:cursor-default
                    disabled:opacity-100

                    ${
                      isLight
                        ? `
                          bg-gradient-to-br
                          from-[#ead7b7]
                          to-[#d5b78b]
                        `
                        : `
                          bg-gradient-to-br
                          from-[#9a6746]
                          to-[#724a31]
                        `
                    }

                    ${
                      isSelected
                        ? `
                          z-10
                          ring-4
                          ring-inset
                          ring-amber-300
                        `
                        : ""
                    }

                    hover:brightness-105
                  `}
                  >
                    {isDraftSetupSquare && (
                      <span
                        className="
                        pointer-events-none
                        absolute
                        inset-0
                        z-[1]
                        bg-emerald-400/10
                        shadow-[inset_0_0_16px_rgba(52,211,153,0.16)]
                      "
                      />
                    )}

                    {isDraftKingSquare && (
                      <span
                        className="
                        pointer-events-none
                        absolute
                        right-1
                        top-1
                        z-[18]
                        flex
                        h-5
                        w-5
                        items-center
                        justify-center
                        rounded-full
                        border
                        border-amber-200/35
                        bg-amber-950/70
                        text-[10px]
                        font-black
                        text-amber-200
                      "
                        aria-hidden="true"
                      >
                        ♔
                      </span>
                    )}

                    {isMirrorSetupSquare && (
                      <span
                        className="
                        pointer-events-none
                        absolute
                        inset-0
                        z-[1]
                        bg-violet-400/[0.07]
                        shadow-[inset_0_0_18px_rgba(167,139,250,0.12)]
                      "
                      />
                    )}

                    {isMirrorAvailableSquare && (
                      <span
                        className="
                        pointer-events-none
                        absolute
                        inset-[5px]
                        z-[6]
                        rounded-md
                        border
                        border-emerald-300/40
                        shadow-[inset_0_0_12px_rgba(110,231,183,0.15)]
                      "
                      />
                    )}

                    {isMirrorPreviewSquare && (
                      <span
                        className="
                        pointer-events-none
                        absolute
                        left-1/2
                        top-1/2
                        z-[18]
                        -translate-x-1/2
                        -translate-y-1/2
                        text-xl
                        font-black
                        leading-none
                        text-violet-200
                        drop-shadow-[0_0_8px_rgba(167,139,250,0.9)]
                      "
                        aria-hidden="true"
                      >
                        ◈
                      </span>
                    )}

                    {/* =========================
                      CHESSROULETTE LUCKY SQUARE
                     ========================= */}

                    {isLuckySquare && (
                      <>
                        <span
                          className={`
                          pointer-events-none
                          absolute
                          inset-0
                          z-[5]
                          ${
                            isDestroyLuckySquare
                              ? "bg-red-500/16 shadow-[inset_0_0_30px_rgba(239,68,68,0.42)]"
                              : isTeleportLuckySquare
                                ? "bg-cyan-400/16 shadow-[inset_0_0_30px_rgba(34,211,238,0.42)]"
                                : isSwapLuckySquare
                                  ? "bg-violet-400/16 shadow-[inset_0_0_30px_rgba(167,139,250,0.42)]"
                                  : isPromoteLuckySquare
                                    ? "bg-amber-300/16 shadow-[inset_0_0_30px_rgba(251,191,36,0.42)]"
                                    : "bg-amber-300/14 shadow-[inset_0_0_30px_rgba(251,191,36,0.38)]"
                          }
                          ${isActiveLuckySquare ? "animate-pulse" : ""}
                        `}
                        />

                        <span
                          className={`
                          pointer-events-none
                          absolute
                          left-1/2
                          top-1/2
                          z-[8]
                          flex
                          h-[62%]
                          w-[62%]
                          -translate-x-1/2
                          -translate-y-1/2
                          items-center
                          justify-center
                          rounded-full
                          border-2
                          bg-zinc-950/45
                          text-[clamp(1.3rem,3.5vw,2.6rem)]
                          font-black
                          leading-none
                          shadow-[0_0_22px_rgba(255,255,255,0.16)]
                          ${
                            isTriggeredLuckySquare
                              ? "border-white/35"
                              : "border-amber-100/45 text-amber-100"
                          }
                          ${
                            isActiveLuckySquare
                              ? "scale-110 animate-bounce"
                              : ""
                          }
                        `}
                          aria-hidden="true"
                        >
                          {isDestroyLuckySquare
                            ? "💥"
                            : isTeleportLuckySquare
                              ? "🌀"
                              : isSwapLuckySquare
                                ? "🔄"
                                : isPromoteLuckySquare
                                  ? "🎴"
                                  : "?"}
                        </span>
                      </>
                    )}

                    {/* =========================
                      CHESS HOT POTATO
                     ========================= */}

                    {isHotPotatoExplosionSquare && (
                      <>
                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[7]
                          animate-pulse
                          bg-[radial-gradient(circle,rgba(251,146,60,0.78)_0%,rgba(239,68,68,0.55)_45%,rgba(127,29,29,0.18)_78%)]
                          shadow-[inset_0_0_30px_rgba(249,115,22,0.78)]
                        "
                        />

                        <span
                          className="
                          pointer-events-none
                          absolute
                          left-1/2
                          top-1/2
                          z-[18]
                          -translate-x-1/2
                          -translate-y-1/2
                          text-[clamp(1.5rem,4vw,3.2rem)]
                          leading-none
                          drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]
                        "
                          aria-hidden="true"
                        >
                          💥
                        </span>
                      </>
                    )}

                    {isHotPotatoSquare && (
                      <>
                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[5]
                          animate-pulse
                          bg-orange-500/12
                          shadow-[inset_0_0_30px_rgba(249,115,22,0.5)]
                        "
                        />

                        <span
                          className="
                          pointer-events-none
                          absolute
                          right-1
                          top-1
                          z-[19]
                          flex
                          min-w-10
                          items-center
                          justify-center
                          gap-0.5
                          rounded-full
                          border
                          border-orange-100/70
                          bg-zinc-950/90
                          px-1.5
                          py-1
                          text-[10px]
                          font-black
                          leading-none
                          text-orange-100
                          shadow-[0_2px_10px_rgba(0,0,0,0.55)]
                        "
                          aria-label={`Hot Potato explodes in ${hotPotatoMovesRemaining} moves`}
                        >
                          <span aria-hidden="true">💣</span>
                          <span>{hotPotatoMovesRemaining}</span>
                        </span>
                      </>
                    )}

                    {/* =========================
                      BOSS BATTLE CHESS
                     ========================= */}

                    {isBossShockwaveSquare && (
                      <>
                        <span
                          className="
                            pointer-events-none
                            absolute
                            inset-0
                            z-[8]
                            animate-pulse
                            bg-[radial-gradient(circle,rgba(248,113,113,0.56)_0%,rgba(239,68,68,0.28)_48%,transparent_78%)]
                            shadow-[inset_0_0_28px_rgba(239,68,68,0.5)]
                          "
                        />

                        <span
                          className="
                            pointer-events-none
                            absolute
                            left-1/2
                            top-1/2
                            z-[18]
                            -translate-x-1/2
                            -translate-y-1/2
                            text-[clamp(1.2rem,3vw,2.4rem)]
                            leading-none
                          "
                          aria-hidden="true"
                        >
                          💥
                        </span>
                      </>
                    )}

                    {isBossPowerTargetSquare && (
                      <>
                        <span
                          className={`
                            pointer-events-none
                            absolute
                            inset-[6%]
                            z-[13]
                            rounded-md
                            border-2
                            border-dashed
                            ${
                              bossPowerTargetMode === "summon"
                                ? "border-emerald-200/80 bg-emerald-400/12 shadow-[inset_0_0_18px_rgba(52,211,153,0.3)]"
                                : "border-violet-200/80 bg-violet-400/12 shadow-[inset_0_0_18px_rgba(167,139,250,0.3)]"
                            }
                          `}
                        />

                        <span
                          className={`
                            pointer-events-none
                            absolute
                            bottom-1
                            right-1
                            z-[19]
                            rounded-full
                            border
                            bg-zinc-950/90
                            px-1.5
                            py-0.5
                            text-[10px]
                            font-black
                            ${
                              bossPowerTargetMode === "summon"
                                ? "border-emerald-200/40 text-emerald-200"
                                : "border-violet-200/40 text-violet-200"
                            }
                          `}
                          aria-hidden="true"
                        >
                          {bossPowerTargetMode === "summon" ? "♟+" : "✦"}
                        </span>
                      </>
                    )}

                    {isBossSquare && (
                      <>
                        <span
                          className={`
                            pointer-events-none
                            absolute
                            inset-0
                            z-[4]
                            ${
                              bossArmorActive
                                ? "bg-cyan-300/14 shadow-[inset_0_0_34px_rgba(103,232,249,0.48)]"
                                : "bg-red-500/10 shadow-[inset_0_0_34px_rgba(239,68,68,0.38)]"
                            }
                          `}
                        />

                        <span
                          className="
                            pointer-events-none
                            absolute
                            left-1
                            top-1
                            z-[19]
                            rounded-full
                            border
                            border-red-200/35
                            bg-red-950/90
                            px-1.5
                            py-0.5
                            text-[8px]
                            font-black
                            uppercase
                            tracking-wider
                            text-red-100
                          "
                        >
                          Boss
                        </span>

                        {bossArmorActive && (
                          <span
                            className="
                              pointer-events-none
                              absolute
                              right-1
                              top-1
                              z-[20]
                              text-base
                              drop-shadow-[0_0_8px_rgba(103,232,249,0.95)]
                            "
                            aria-hidden="true"
                          >
                            🛡
                          </span>
                        )}

                        {bossRage > 0 && (
                          <span
                            className="
                              pointer-events-none
                              absolute
                              bottom-1
                              left-1
                              z-[20]
                              rounded-full
                              bg-zinc-950/85
                              px-1.5
                              py-0.5
                              text-[9px]
                              font-black
                              text-orange-200
                            "
                            aria-hidden="true"
                          >
                            🔥{bossRage}
                          </span>
                        )}
                      </>
                    )}

                    {/* =========================
                      CHESS COLLAPSE
                     ========================= */}

                    {isCollapseWarningSquare && !isCollapsedSquare && (
                      <>
                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[8]
                          animate-pulse
                          bg-orange-500/20
                          shadow-[inset_0_0_28px_rgba(249,115,22,0.5)]
                        "
                        />

                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-[8%]
                          z-[17]
                          opacity-80
                          bg-[linear-gradient(135deg,transparent_0%,transparent_43%,rgba(255,237,213,0.85)_44%,rgba(255,237,213,0.85)_47%,transparent_48%,transparent_62%,rgba(127,29,29,0.8)_63%,rgba(127,29,29,0.8)_66%,transparent_67%)]
                        "
                        />

                        <span
                          className="
                          pointer-events-none
                          absolute
                          right-1
                          top-1
                          z-[19]
                          rounded-full
                          border
                          border-orange-100/50
                          bg-zinc-950/85
                          px-1.5
                          py-0.5
                          text-[10px]
                          font-black
                          text-orange-200
                        "
                          aria-hidden="true"
                        >
                          ⚠
                        </span>
                      </>
                    )}

                    {isCollapseImpactSquare && (
                      <>
                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[27]
                          animate-pulse
                          bg-[radial-gradient(circle,rgba(248,113,113,0.75)_0%,rgba(127,29,29,0.6)_48%,rgba(9,9,11,0.35)_78%)]
                        "
                        />
                        <span
                          className="
                          pointer-events-none
                          absolute
                          left-1/2
                          top-1/2
                          z-[31]
                          -translate-x-1/2
                          -translate-y-1/2
                          text-[clamp(1.4rem,4vw,3rem)]
                          leading-none
                        "
                          aria-hidden="true"
                        >
                          💥
                        </span>
                      </>
                    )}

                    {isCollapsedSquare && (
                      <>
                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[29]
                          bg-[radial-gradient(circle_at_center,#09090b_0%,#09090b_48%,#18181b_70%,#3f1d1d_100%)]
                          shadow-[inset_0_0_20px_rgba(0,0,0,1)]
                        "
                        />

                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-[8%]
                          z-[30]
                          rounded-md
                          border
                          border-red-950/80
                          shadow-[0_0_18px_rgba(0,0,0,0.9),inset_0_0_12px_rgba(0,0,0,0.95)]
                        "
                        />
                      </>
                    )}

                    {/* =========================
                      THREE LIVES HEART SQUARE
                      Rendered INSIDE the real board square,
                      so it can never drift or offset.
                     ========================= */}

                    {isHeartSquare && (
                      <>
                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[2]
                          bg-red-400/25
                          shadow-[inset_0_0_24px_rgba(248,113,113,0.28)]
                        "
                        />

                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[8]
                          flex
                          items-center
                          justify-center
                          select-none
                          font-serif
                          text-[clamp(2.8rem,7vw,6rem)]
                          font-black
                          leading-none
                          text-red-400
                          drop-shadow-[0_0_12px_rgba(248,113,113,0.95)]
                        "
                        >
                          <span className="animate-pulse leading-none">♥</span>
                        </span>
                      </>
                    )}

                    {/* =========================
                      MUTATION SQUARE
                     ========================= */}

                    {isMutationSquare && (
                      <>
                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[2]
                          bg-violet-400/25
                          shadow-[inset_0_0_26px_rgba(167,139,250,0.35)]
                        "
                        />

                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[8]
                          flex
                          items-center
                          justify-center
                          select-none
                          text-[clamp(2.4rem,6vw,5rem)]
                          font-black
                          leading-none
                          text-violet-200/55
                          drop-shadow-[0_0_12px_rgba(167,139,250,0.95)]
                        "
                        >
                          ✦
                        </span>
                      </>
                    )}

                    {/* =========================
                      CAPITALISM BOUNTY TARGET
                     ========================= */}

                    {isBountySquare && (
                      <>
                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[2]
                          bg-amber-300/20
                          shadow-[inset_0_0_24px_rgba(251,191,36,0.22)]
                        "
                        />

                        <span
                          className="
                          pointer-events-none
                          absolute
                          right-1.5
                          top-1.5
                          z-[18]
                          flex
                          h-5
                          min-w-5
                          items-center
                          justify-center
                          rounded-full
                          border
                          border-amber-100/50
                          bg-amber-300
                          px-1
                          text-[9px]
                          font-black
                          leading-none
                          text-amber-950
                          shadow-[0_2px_8px_rgba(0,0,0,0.4)]
                        "
                        >
                          $
                        </span>
                      </>
                    )}

                    {/* =========================
                      CAPITALISM SHOP SPAWN POINT
                     ========================= */}

                    {isShopSpawnSquare && (
                      <>
                        <span
                          className={`
                          pointer-events-none
                          absolute
                          inset-0
                          z-[2]

                          ${
                            isAvailableShopSpawnSquare
                              ? "bg-emerald-300/18 shadow-[inset_0_0_22px_rgba(52,211,153,0.26)]"
                              : "bg-cyan-300/[0.06]"
                          }
                        `}
                        />

                        <span
                          className={`
                          pointer-events-none
                          absolute
                          bottom-1.5
                          left-1.5
                          z-[18]
                          flex
                          h-7
                          w-7
                          items-center
                          justify-center
                          rounded-full
                          border
                          text-[11px]
                          font-black
                          leading-none
                          shadow-[0_2px_8px_rgba(0,0,0,0.35)]

                          ${
                            isAvailableShopSpawnSquare
                              ? "border-emerald-100/60 bg-emerald-300 text-emerald-950"
                              : "border-cyan-100/20 bg-cyan-900/70 text-cyan-200/55"
                          }
                        `}
                        >
                          +
                        </span>
                      </>
                    )}

                    {/* =========================
                      KING JOURNEY TARGET
                     ========================= */}

                    {isAnyMissionTargetSquare && (
                      <>
                        <span
                          className={`
                          pointer-events-none
                          absolute
                          inset-0
                          z-[4]

                          ${
                            isWhiteMissionTargetSquare &&
                            isBlackMissionTargetSquare
                              ? "bg-[linear-gradient(135deg,rgba(186,230,253,0.26)_0%,rgba(186,230,253,0.26)_50%,rgba(196,181,253,0.26)_50%,rgba(196,181,253,0.26)_100%)] shadow-[inset_0_0_30px_rgba(167,139,250,0.28)]"
                              : isWhiteMissionTargetSquare
                                ? "bg-sky-200/25 shadow-[inset_0_0_28px_rgba(186,230,253,0.38)]"
                                : "bg-violet-300/22 shadow-[inset_0_0_28px_rgba(196,181,253,0.36)]"
                          }
                        `}
                        />

                        <span
                          className={`
                          pointer-events-none
                          absolute
                          left-1/2
                          top-1/2
                          z-[19]
                          flex
                          -translate-x-1/2
                          -translate-y-1/2
                          items-center
                          justify-center
                          rounded-full
                          border
                          font-black
                          leading-none
                          shadow-[0_2px_12px_rgba(0,0,0,0.45)]

                          ${
                            isWhiteMissionTargetSquare &&
                            isBlackMissionTargetSquare
                              ? "h-9 min-w-12 border-white/50 bg-zinc-900/90 px-1.5 text-[15px] text-white"
                              : isWhiteMissionTargetSquare
                                ? "h-9 w-9 border-sky-50/70 bg-sky-100/95 text-xl text-sky-950"
                                : "h-9 w-9 border-violet-100/70 bg-violet-300/95 text-xl text-violet-950"
                          }
                        `}
                        >
                          {isWhiteMissionTargetSquare &&
                          isBlackMissionTargetSquare
                            ? "♔♚"
                            : isWhiteMissionTargetSquare
                              ? "♔"
                              : "♚"}
                        </span>

                        <span
                          className={`
                          pointer-events-none
                          absolute
                          bottom-1
                          right-1
                          z-[19]
                          text-[15px]
                          font-black
                          leading-none

                          ${
                            isWhiteMissionTargetSquare &&
                            isBlackMissionTargetSquare
                              ? "text-white"
                              : isWhiteMissionTargetSquare
                                ? "text-sky-50"
                                : "text-violet-100"
                          }
                        `}
                        >
                          ★
                        </span>
                      </>
                    )}

                    {/* =========================
                      HORROR CHESS STATUS MARKERS
                     ========================= */}

                    {isInfectedSquare && (
                      <>
                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[3]
                          bg-emerald-500/15
                          shadow-[inset_0_0_24px_rgba(16,185,129,0.32)]
                        "
                        />

                        <span
                          className="
                          pointer-events-none
                          absolute
                          left-1
                          top-1
                          z-[17]
                          flex
                          h-5
                          w-5
                          items-center
                          justify-center
                          rounded-full
                          border
                          border-emerald-100/35
                          bg-emerald-950/85
                          text-[10px]
                          font-black
                          text-emerald-300
                        "
                        >
                          ☣
                        </span>
                      </>
                    )}

                    {isCursedSquare && (
                      <>
                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[4]
                          bg-fuchsia-500/12
                          shadow-[inset_0_0_28px_rgba(217,70,239,0.34)]
                        "
                        />

                        <span
                          className="
                          pointer-events-none
                          absolute
                          right-1
                          top-1
                          z-[18]
                          flex
                          h-7
                          w-7
                          items-center
                          justify-center
                          rounded-full
                          border
                          border-fuchsia-100/40
                          bg-fuchsia-950/90
                          text-[16px]
                          font-black
                          text-fuchsia-200
                        "
                        >
                          ☠
                        </span>
                      </>
                    )}

                    {isHotSquare && (
                      <>
                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[5]
                          bg-red-500/20
                          shadow-[inset_0_0_30px_rgba(239,68,68,0.48)]
                        "
                        />

                        <span
                          className="
                          pointer-events-none
                          absolute
                          bottom-1
                          right-1
                          z-[18]
                          text-xl
                          font-black
                          leading-none
                          text-orange-200
                          drop-shadow-[0_0_8px_rgba(249,115,22,0.95)]
                        "
                        >
                          🔥
                        </span>
                      </>
                    )}

                    {isFrozenSquare && (
                      <>
                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[7]
                          bg-cyan-200/25
                          shadow-[inset_0_0_30px_rgba(103,232,249,0.5)]
                        "
                        />

                        <span
                          className="
                          pointer-events-none
                          absolute
                          bottom-1
                          left-1
                          z-[18]
                          text-xl
                          font-black
                          leading-none
                          text-cyan-50
                          drop-shadow-[0_0_8px_rgba(34,211,238,0.95)]
                        "
                        >
                          ❄
                        </span>
                      </>
                    )}

                    {isDoomedSquare && (
                      <>
                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-[3px]
                          z-[9]
                          rounded-sm
                          border-2
                          border-dashed
                          border-red-200
                          shadow-[inset_0_0_22px_rgba(248,113,113,0.42)]
                        "
                        />

                        <span
                          className="
                          pointer-events-none
                          absolute
                          left-1/2
                          top-1/2
                          z-[19]
                          -translate-x-1/2
                          -translate-y-1/2
                          text-3xl
                          font-black
                          leading-none
                          text-red-200/90
                          drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]
                        "
                        >
                          ×
                        </span>
                      </>
                    )}

                    {isGraveSquare && (
                      <>
                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[8]
                          bg-zinc-950/18
                          shadow-[inset_0_0_24px_rgba(24,24,27,0.55)]
                        "
                        />

                        <span
                          className="
                          pointer-events-none
                          absolute
                          left-1/2
                          top-1/2
                          z-[19]
                          -translate-x-1/2
                          -translate-y-1/2
                          text-3xl
                          leading-none
                          drop-shadow-[0_0_8px_rgba(0,0,0,0.9)]
                        "
                          aria-hidden="true"
                        >
                          🪦
                        </span>
                      </>
                    )}

                    {/* =========================
                      LAST MOVE HIGHLIGHT
                     ========================= */}

                    {isLastMove && (
                      <span
                        className="
                        pointer-events-none
                        absolute
                        inset-0
                        z-[2]
                        bg-yellow-300/25
                      "
                      />
                    )}

                    {/* =========================
                      CHECK GLOW
                     ========================= */}

                    {isCheckedKing && (
                      <span
                        className="
                        pointer-events-none
                        absolute
                        inset-0
                        z-[3]
                        bg-[radial-gradient(circle,rgba(239,68,68,0.85)_0%,rgba(185,28,28,0.52)_45%,rgba(127,29,29,0.05)_80%)]
                        shadow-[inset_0_0_20px_rgba(239,68,68,0.85)]
                      "
                      />
                    )}

                    {/* =========================
                      EMPTY LEGAL MOVE
                     ========================= */}

                    {isLegalMove && !piece && !isCollapsedSquare && (
                      <span
                        className="
                        pointer-events-none
                        absolute
                        z-[6]
                        h-[22%]
                        w-[22%]
                        rounded-full
                        bg-black/30
                        shadow-sm
                      "
                      />
                    )}

                    {/* =========================
                      LEGAL CAPTURE
                     ========================= */}

                    {isLegalMove && piece && !isCollapsedSquare && (
                      <span
                        className="
                        pointer-events-none
                        absolute
                        inset-[7%]
                        z-[6]
                        rounded-full
                        border-[clamp(3px,0.5vw,6px)]
                        border-black/25
                      "
                      />
                    )}

                    {/* =========================
                      PIECE
                     ========================= */}

                    {piece &&
                      !isHotPotatoBlownUpKingSquare &&
                      !isCollapsedSquare && (
                        /*
                         * Outer wrapper controls only
                         * the overall piece size.
                         *
                         * The inner span keeps the
                         * existing hover animation.
                         */
                        <span
                          className="
                        pointer-events-none
                        relative
                        z-10
                        flex
                        h-full
                        w-full
                        items-center
                        justify-center
                      "
                          style={{
                            transform: `scale(${pieceScale}) rotate(${pieceCounterRotation}deg)`,

                            transformOrigin: "center center",

                            transition: pieceTransition,

                            willChange: "transform",
                          }}
                        >
                          <span
                            className={`
                          pointer-events-none
                          relative
                          select-none

                          font-serif
                          text-[clamp(2.4rem,6vw,5.2rem)]
                          leading-none

                          transition-transform
                          duration-150

                          group-hover:scale-[1.06]

                          ${
                            piece.color === "w"
                              ? `
                                text-[#fff3d5]
                                [text-shadow:0_1px_0_#ffffff,0_2px_2px_rgba(0,0,0,0.75),0_5px_8px_rgba(0,0,0,0.45)]
                              `
                              : `
                                text-[#1b1b1b]
                                [text-shadow:0_1px_0_rgba(255,255,255,0.35),0_3px_3px_rgba(0,0,0,0.65),0_5px_8px_rgba(0,0,0,0.45)]
                              `
                          }
                        `}
                          >
                            {symbol}
                          </span>
                        </span>
                      )}

                    {isFogSquare && (
                      <>
                        <span
                          className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[19]
                          bg-zinc-950/90
                          backdrop-blur-[1px]
                        "
                        />
                        <span
                          className="
                          pointer-events-none
                          absolute
                          left-1/2
                          top-1/2
                          z-[19]
                          -translate-x-1/2
                          -translate-y-1/2
                          text-lg
                          leading-none
                          text-zinc-600/70
                        "
                          aria-hidden="true"
                        >
                          ◌
                        </span>
                      </>
                    )}

                    {/* =========================
                      FILE COORDINATE
                      a b c d e f g h
                     ========================= */}

                    {displayRow === 7 && (
                      <span
                        style={{
                          opacity: orientationAnimating ? 0 : 1,

                          transition: "opacity 120ms ease",
                        }}
                        className={`
                        pointer-events-none
                        absolute
                        bottom-1
                        right-1.5
                        z-20
                        text-[clamp(8px,1vw,12px)]
                        font-black

                        ${isLight ? "text-[#66452f]/70" : "text-[#f1ddbe]/70"}
                      `}
                      >
                        {file}
                      </span>
                    )}

                    {/* =========================
                      RANK COORDINATE
                      1 2 3 4 5 6 7 8
                     ========================= */}

                    {displayColumn === 0 && (
                      <span
                        style={{
                          opacity: orientationAnimating ? 0 : 1,

                          transition: "opacity 120ms ease",
                        }}
                        className={`
                        pointer-events-none
                        absolute
                        left-1.5
                        top-1
                        z-20
                        text-[clamp(8px,1vw,12px)]
                        font-black

                        ${isLight ? "text-[#66452f]/70" : "text-[#f1ddbe]/70"}
                      `}
                      >
                        {rank}
                      </span>
                    )}
                  </button>
                );
              }),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
