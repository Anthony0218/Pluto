import { useEffect, useState } from "react";
import type { Board3DEffect, Board3DPiece, CameraShakeKind } from "@/components/chess3d/Board3DScene";
import type { PieceMotion } from "@/components/chess3d/ChessPiece3D";
import { isInCheck } from "@/games/chess/custom/engine/game";
import type { GameState, GameVariant, Move, PieceInstance } from "@/games/chess/custom/engine/types";
import type { GameSession } from "@/games/chess/custom/editor/useGameSession";

interface Tracked {
  state: GameState;
  cursor: number;
  ghosts: PieceInstance[];
  promoted: Record<string, number>;
  effects: Board3DEffect[];
  shake: { id: number; kind: CameraShakeKind };
  motion: Record<string, PieceMotion>;
  nextEffectId: number;
}

function motionFor(variant: GameVariant, move: Move, pieceType: string): PieceMotion {
  if (move.landing || move.source === "teleport") return "teleport";
  const def = variant.pieces.find((piece) => piece.id === pieceType);
  const rule = [...(def?.movement ?? []), ...(def?.capture ?? [])].find((entry) => entry.id === move.ruleId);
  const straight = move.offset.x === 0 || move.offset.y === 0 || Math.abs(move.offset.x) === Math.abs(move.offset.y);
  if (rule?.kind === "leap" && (!straight || rule.canJump)) return Math.max(Math.abs(move.offset.x), Math.abs(move.offset.y)) > 1 ? "jump" : "slide";
  return "slide";
}

/**
 * Turns engine snapshots into 3D-friendly data: captured pieces linger as
 * "ghosts" long enough to play their shatter animation, transformed pieces get
 * a promotion pulse, and move effects become short-lived bursts. Stepping one
 * move forward animates; jumping around the timeline snaps instantly.
 */
export function useSimulationVisuals(variant: GameVariant, session: GameSession) {
  const state = session.current;
  const [tracked, setTracked] = useState<Tracked>(() => ({ state, cursor: session.cursor, ghosts: [], promoted: {}, effects: [], shake: { id: 0, kind: "none" }, motion: {}, nextEffectId: 1 }));

  if (tracked.state !== state) {
    const stepForward = session.cursor === tracked.cursor + 1 || (session.cursor === tracked.cursor && state.ply === tracked.state.ply + 1);
    const move = session.frames[session.cursor].move;
    const ids = new Set(state.pieces.map((piece) => piece.id));
    const ghosts = stepForward ? tracked.state.pieces.filter((piece) => !ids.has(piece.id)) : [];
    const promoted = { ...tracked.promoted };
    const previousType = new Map(tracked.state.pieces.map((piece) => [piece.id, piece.type]));
    for (const piece of state.pieces) {
      const before = previousType.get(piece.id);
      if (stepForward && before && before !== piece.type) promoted[piece.id] = (promoted[piece.id] ?? 0) + 1;
    }
    const motion: Record<string, PieceMotion> = {};
    for (const piece of state.pieces) motion[piece.id] = stepForward ? "slide" : "instant";
    if (stepForward && move) {
      const mover = tracked.state.pieces.find((piece) => piece.id === move.pieceId);
      if (mover) motion[move.pieceId] = motionFor(variant, move, mover.type);
    }
    let nextEffectId = tracked.nextEffectId;
    const effects = stepForward ? state.effects.map((effect) => ({ ...effect, id: nextEffectId++ })) : [];
    const royal = state.effects.some((effect) => effect.kind === "royalCapture");
    const kind: CameraShakeKind = !stepForward
      ? "none"
      : state.result && !state.result.draw
        ? royal
          ? "royal"
          : "checkmate"
        : royal
          ? "royal"
          : isInCheck(variant, state, state.turn)
            ? "check"
            : state.effects.some((effect) => effect.kind === "capture" || effect.kind === "shake")
              ? "capture"
              : "none";
    setTracked({
      state,
      cursor: session.cursor,
      ghosts,
      promoted,
      effects: [...tracked.effects, ...effects].slice(-16),
      shake: kind === "none" ? tracked.shake : { id: tracked.shake.id + 1, kind },
      motion,
      nextEffectId,
    });
  }

  // Ghosts disappear once their capture animation has played.
  useEffect(() => {
    const ghosts = tracked.ghosts;
    if (!ghosts.length) return;
    const timer = window.setTimeout(() => setTracked((current) => (current.ghosts === ghosts ? { ...current, ghosts: [] } : current)), 700);
    return () => window.clearTimeout(timer);
  }, [tracked.ghosts]);

  const inCheck = !state.result && isInCheck(variant, state, state.turn);
  const mated = state.result?.reason.startsWith("Checkmate");

  const toVisual = (piece: PieceInstance, captured: boolean): Board3DPiece => {
    const def = variant.pieces.find((entry) => entry.id === piece.type);
    const team = variant.teams.find((entry) => entry.id === piece.team);
    const royal = Boolean(def?.royal);
    return {
      id: piece.id,
      x: piece.x,
      y: piece.y,
      z: piece.z ?? 0,
      base: def?.model.base ?? "pawn",
      set: team?.modelSet ?? "light",
      accent: def?.model.accent,
      tint: def?.model.tint,
      scale: def?.model.scale,
      captured,
      promotedKey: tracked.promoted[piece.id] ?? 0,
      inCheck: Boolean(inCheck && royal && piece.team === state.turn && !mated),
      checkmated: Boolean(mated && royal && state.result && !state.result.winners.includes(piece.team)),
      motion: tracked.motion[piece.id] ?? "instant",
      teamColor: variant.teams.length > 2 ? team?.color : undefined,
    };
  };

  const pieces = [...state.pieces.map((piece) => toVisual(piece, false)), ...tracked.ghosts.map((piece) => toVisual(piece, true))];
  const move = session.frames[session.cursor].move;
  return { pieces, effects: tracked.effects, shake: tracked.shake, trail: move?.path ?? null, trailJump: Boolean(move && tracked.motion[move.pieceId] === "jump") };
}
