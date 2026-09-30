import type {
  DraftMoveRecord,
  DraftPieceType,
  DraftSetupState,
  DraftSide,
} from "./draftChess";

export type DraftArmyStats = {
  pieces: number;
  spent: number;
  remaining: number;
  pawns: number;
  knights: number;
  bishops: number;
  rooks: number;
  queens: number;
};

export type DraftGameStats = {
  moves: number;
  captures: number;
  whiteCaptures: number;
  blackCaptures: number;
  checks: number;
  promotions: number;
};

const costs: Record<
  DraftPieceType,
  number
> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function count(
  state: DraftSetupState,
  side: DraftSide,
  piece: DraftPieceType,
): number {
  return state.placements[
    side
  ].filter(
    (placement) =>
      placement.piece === piece,
  ).length;
}

export function buildDraftArmyStats(
  state: DraftSetupState,
  side: DraftSide,
): DraftArmyStats {
  const placements =
    state.placements[
      side
    ];

  const spent =
    placements.reduce(
      (total, placement) =>
        total +
        costs[
          placement.piece
        ],
      0,
    );

  return {
    pieces:
      placements.length,

    spent,

    remaining:
      39 - spent,

    pawns:
      count(
        state,
        side,
        "p",
      ),

    knights:
      count(
        state,
        side,
        "n",
      ),

    bishops:
      count(
        state,
        side,
        "b",
      ),

    rooks:
      count(
        state,
        side,
        "r",
      ),

    queens:
      count(
        state,
        side,
        "q",
      ),
  };
}

export function buildDraftGameStats(
  records: DraftMoveRecord[],
): DraftGameStats {
  let captures = 0;
  let whiteCaptures = 0;
  let blackCaptures = 0;
  let checks = 0;
  let promotions = 0;

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
    whiteCaptures,
    blackCaptures,
    checks,
    promotions,
  };
}
