import { useMemo, useState } from "react";
import { sameCoord } from "../engine/board.ts";
import { attackedRoyals, explainPiece, getLegalMoves, type MoveExplanation } from "../engine/game.ts";
import type { Coord, GameState, GameVariant, Move } from "../engine/types.ts";
import { coordKey } from "./editorUtils.ts";
import type { GameSession } from "./useGameSession.ts";

export type SquareMark = "selected" | "move" | "capture" | "special" | "illegal" | "lastFrom" | "lastTo" | "check";

export interface PendingPromotion {
  moves: Move[];
}

/**
 * Click-to-move logic shared by the 2D test board and the 3D simulation:
 * selection, legal-move highlights, debugger explanations, promotion choice.
 */
export function usePieceSelection(variant: GameVariant, session: GameSession, options: { showIllegal: boolean; canMove: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const state: GameState = session.current;
  const selected = state.pieces.find((piece) => piece.id === selectedId) ?? null;

  const legalMoves = useMemo(() => (selected && selected.team === state.turn ? getLegalMoves(variant, state, { pieceId: selected.id }) : []), [variant, state, selected]);
  const explanations: MoveExplanation[] = useMemo(() => (selected ? explainPiece(variant, state, selected.id) : []), [variant, state, selected]);
  const checked = useMemo(() => (state.royalMode === "checkmate" ? attackedRoyals(variant, state, state.turn) : []), [variant, state]);

  const marks = useMemo(() => {
    const map = new Map<string, SquareMark>();
    const last = session.frames[session.cursor].move;
    if (last) {
      map.set(coordKey(last.from), "lastFrom");
      map.set(coordKey(last.landing ?? last.to), "lastTo");
    }
    for (const royal of checked) map.set(coordKey(royal), "check");
    if (selected) {
      if (options.showIllegal) for (const entry of explanations) if (!entry.legal) map.set(coordKey(entry.to), "illegal");
      // Previewing an opponent's piece shows what it could do on its turn.
      const reach = selected.team === state.turn ? legalMoves.map((move) => ({ to: move.to, kind: move.castle || move.landing || move.source === "enPassant" || move.source === "teleport" ? "special" : move.captureIds.length ? "capture" : "move" })) : explanations.filter((entry) => entry.legal);
      for (const entry of reach) map.set(coordKey(entry.to), entry.kind as SquareMark);
      map.set(coordKey(selected), "selected");
    }
    return map;
  }, [session.frames, session.cursor, checked, selected, explanations, legalMoves, options.showIllegal, state.turn]);

  function clickSquare(coord: Coord) {
    if (pendingPromotion) return;
    const occupant = state.pieces.find((piece) => sameCoord(piece, coord));
    if (selected && options.canMove && selected.team === state.turn) {
      const moves = legalMoves.filter((move) => sameCoord(move.to, coord));
      if (moves.length > 1 && moves.every((move) => move.promotion)) {
        setPendingPromotion({ moves });
        return;
      }
      if (moves.length) {
        session.play(moves[0]);
        setSelectedId(null);
        return;
      }
    }
    if (occupant && occupant.id !== selectedId) setSelectedId(occupant.id);
    else setSelectedId(null);
  }

  return {
    selected,
    selectedId,
    setSelectedId,
    legalMoves,
    explanations,
    marks,
    clickSquare,
    pendingPromotion,
    choosePromotion: (move: Move | null) => {
      if (move) session.play(move);
      setPendingPromotion(null);
      setSelectedId(null);
    },
  };
}
