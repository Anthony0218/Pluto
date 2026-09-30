import type {
  MirrorMoveRecord,
  MirrorPieceType,
  MirrorSetupState,
} from "./mirrorChess";

export type MirrorSetupStats = {
  placedPairs: number;
  remainingPairs: number;
  pawns: number;
  knights: number;
  bishops: number;
  rooks: number;
  queens: number;
  kings: number;
  whitePlaced: number;
  blackPlaced: number;
};

export type MirrorGameStats = {
  moves: number;
  captures: number;
  checks: number;
  promotions: number;
  whiteCaptures: number;
  blackCaptures: number;
};

function countPiece(
  state: MirrorSetupState,
  piece: MirrorPieceType,
): number {
  return state.placements.filter(
    (placement) =>
      placement.piece ===
      piece,
  ).length;
}

export function buildMirrorSetupStats(
  state: MirrorSetupState,
): MirrorSetupStats {
  return {
    placedPairs:
      state.placements.length,

    remainingPairs:
      Math.max(
        0,
        state.bag.length -
          state.drawIndex,
      ),

    pawns:
      countPiece(
        state,
        "p",
      ),

    knights:
      countPiece(
        state,
        "n",
      ),

    bishops:
      countPiece(
        state,
        "b",
      ),

    rooks:
      countPiece(
        state,
        "r",
      ),

    queens:
      countPiece(
        state,
        "q",
      ),

    kings:
      countPiece(
        state,
        "k",
      ),

    whitePlaced:
      state.placements.filter(
        (placement) =>
          placement.sourceSide ===
          "w",
      ).length,

    blackPlaced:
      state.placements.filter(
        (placement) =>
          placement.sourceSide ===
          "b",
      ).length,
  };
}

export function buildMirrorGameStats(
  records: MirrorMoveRecord[],
): MirrorGameStats {
  let captures = 0;
  let checks = 0;
  let promotions = 0;
  let whiteCaptures = 0;
  let blackCaptures = 0;

  for (const record of records) {
    if (record.captured) {
      captures += 1;

      if (
        record.color ===
        "w"
      ) {
        whiteCaptures += 1;
      } else {
        blackCaptures += 1;
      }
    }

    if (
      record.san.endsWith("+") ||
      record.san.endsWith("#")
    ) {
      checks += 1;
    }

    if (
      record.promotion
    ) {
      promotions += 1;
    }
  }

  return {
    moves:
      records.length,

    captures,
    checks,
    promotions,
    whiteCaptures,
    blackCaptures,
  };
}
