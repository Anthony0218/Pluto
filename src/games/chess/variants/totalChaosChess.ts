import {
  Chess,
  type Color,
  type PieceSymbol,
  type Square,
} from "chess.js";

export type TotalChaosPosition = {
  seed: number;
  fen: string;
  whiteKingSquare: Square;
  blackKingSquare: Square;
  orthodoxMatches: number;
};

type ChaosPiece = {
  color: Color;
  type: PieceSymbol;
};

const FILES = "abcdefgh";
const ALL_SQUARES: Square[] = Array.from(
  { length: 8 },
  (_, row) =>
    Array.from(
      { length: 8 },
      (_, column) =>
        `${FILES[column]}${8 - row}` as Square,
    ),
).flat();

const PAWN_SQUARES = ALL_SQUARES.filter(
  (square) =>
    square[1] !== "1" &&
    square[1] !== "8",
);

const WHITE_NON_KING: ChaosPiece[] = [
  { color: "w", type: "q" },
  { color: "w", type: "r" },
  { color: "w", type: "r" },
  { color: "w", type: "b" },
  { color: "w", type: "b" },
  { color: "w", type: "n" },
  { color: "w", type: "n" },
];

const BLACK_NON_KING: ChaosPiece[] = [
  { color: "b", type: "q" },
  { color: "b", type: "r" },
  { color: "b", type: "r" },
  { color: "b", type: "b" },
  { color: "b", type: "b" },
  { color: "b", type: "n" },
  { color: "b", type: "n" },
];

const PAWNS: ChaosPiece[] = [
  ...Array.from(
    { length: 8 },
    () =>
      ({
        color: "w",
        type: "p",
      }) as ChaosPiece,
  ),
  ...Array.from(
    { length: 8 },
    () =>
      ({
        color: "b",
        type: "p",
      }) as ChaosPiece,
  ),
];

const ORTHODOX: Record<string, string> = {
  a1: "wr",
  b1: "wn",
  c1: "wb",
  d1: "wq",
  e1: "wk",
  f1: "wb",
  g1: "wn",
  h1: "wr",
  a2: "wp",
  b2: "wp",
  c2: "wp",
  d2: "wp",
  e2: "wp",
  f2: "wp",
  g2: "wp",
  h2: "wp",

  a8: "br",
  b8: "bn",
  c8: "bb",
  d8: "bq",
  e8: "bk",
  f8: "bb",
  g8: "bn",
  h8: "br",
  a7: "bp",
  b7: "bp",
  c7: "bp",
  d7: "bp",
  e7: "bp",
  f7: "bp",
  g7: "bp",
  h7: "bp",
};

function mulberry32(seed: number) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;

    let t = value;

    t = Math.imul(
      t ^ (t >>> 15),
      t | 1,
    );

    t ^=
      t +
      Math.imul(
        t ^ (t >>> 7),
        t | 61,
      );

    return (
      ((t ^ (t >>> 14)) >>> 0) /
      4294967296
    );
  };
}

function mixSeed(
  seed: number,
  attempt: number,
) {
  let value =
    (seed ^
      Math.imul(
        attempt + 1,
        0x9e3779b1,
      )) >>>
    0;

  value =
    Math.imul(
      value ^ (value >>> 16),
      0x45d9f3b,
    ) >>> 0;

  value =
    Math.imul(
      value ^ (value >>> 16),
      0x45d9f3b,
    ) >>> 0;

  return (
    value ^
    (value >>> 16)
  ) >>> 0;
}

function shuffle<T>(
  items: T[],
  random: () => number,
) {
  const result = [...items];

  for (
    let index = result.length - 1;
    index > 0;
    index -= 1
  ) {
    const target = Math.floor(
      random() * (index + 1),
    );

    [
      result[index],
      result[target],
    ] = [
      result[target],
      result[index],
    ];
  }

  return result;
}

function squareDistance(
  a: Square,
  b: Square,
) {
  const fileA =
    FILES.indexOf(a[0]);
  const fileB =
    FILES.indexOf(b[0]);

  const rankA =
    Number(a[1]);
  const rankB =
    Number(b[1]);

  return Math.max(
    Math.abs(fileA - fileB),
    Math.abs(rankA - rankB),
  );
}

function pieceToFen(
  piece: ChaosPiece,
) {
  return piece.color === "w"
    ? piece.type.toUpperCase()
    : piece.type;
}

function boardToFen(
  placements: Map<Square, ChaosPiece>,
) {
  const ranks: string[] = [];

  for (
    let rank = 8;
    rank >= 1;
    rank -= 1
  ) {
    let row = "";
    let empty = 0;

    for (const file of FILES) {
      const square =
        `${file}${rank}` as Square;

      const piece =
        placements.get(square);

      if (!piece) {
        empty += 1;
        continue;
      }

      if (empty > 0) {
        row += String(empty);
        empty = 0;
      }

      row += pieceToFen(piece);
    }

    if (empty > 0) {
      row += String(empty);
    }

    ranks.push(row);
  }

  return ranks.join("/");
}

function placementFen(
  placements: Map<Square, ChaosPiece>,
  turn: "w" | "b",
) {
  return [
    boardToFen(placements),
    turn,
    "-",
    "-",
    "0",
    "1",
  ].join(" ");
}

function isPlayablePlacement(
  placements: Map<Square, ChaosPiece>,
) {
  try {
    const whiteTurn = new Chess(
      placementFen(
        placements,
        "w",
      ),
      {
        skipValidation: true,
      },
    );

    const blackTurn = new Chess(
      placementFen(
        placements,
        "b",
      ),
      {
        skipValidation: true,
      },
    );

    /*
     * Total Chaos begins wild, but neither King is allowed to start
     * already attacked. This keeps move one strategically chaotic
     * rather than randomly deciding the result before play begins.
     */
    if (
      whiteTurn.isCheck() ||
      blackTurn.isCheck()
    ) {
      return false;
    }

    /*
     * Also reject frozen starting positions.
     */
    if (
      whiteTurn.moves().length === 0 ||
      blackTurn.moves().length === 0
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function countOrthodoxMatches(
  placements: Map<Square, ChaosPiece>,
) {
  let matches = 0;

  for (
    const [
      square,
      piece,
    ] of placements
  ) {
    if (
      ORTHODOX[square] ===
      `${piece.color}${piece.type}`
    ) {
      matches += 1;
    }
  }

  return matches;
}

function buildAttempt(
  seed: number,
  attempt: number,
): TotalChaosPosition | null {
  const random =
    mulberry32(
      mixSeed(
        seed,
        attempt,
      ),
    );

  const shuffledSquares =
    shuffle(
      ALL_SQUARES,
      random,
    );

  const whiteKingSquare =
    shuffledSquares[0];

  const blackKingCandidates =
    shuffledSquares
      .slice(1)
      .filter(
        (square) =>
          squareDistance(
            whiteKingSquare,
            square,
          ) > 1,
      );

  if (
    blackKingCandidates.length === 0
  ) {
    return null;
  }

  const blackKingSquare =
    blackKingCandidates[
      Math.floor(
        random() *
          blackKingCandidates.length,
      )
    ];

  const placements =
    new Map<Square, ChaosPiece>();

  placements.set(
    whiteKingSquare,
    {
      color: "w",
      type: "k",
    },
  );

  placements.set(
    blackKingSquare,
    {
      color: "b",
      type: "k",
    },
  );

  const occupied =
    new Set<Square>([
      whiteKingSquare,
      blackKingSquare,
    ]);

  const pawnSquares =
    shuffle(
      PAWN_SQUARES.filter(
        (square) =>
          !occupied.has(square),
      ),
      random,
    ).slice(
      0,
      PAWNS.length,
    );

  if (
    pawnSquares.length <
    PAWNS.length
  ) {
    return null;
  }

  const shuffledPawns =
    shuffle(
      PAWNS,
      random,
    );

  pawnSquares.forEach(
    (square, index) => {
      placements.set(
        square,
        shuffledPawns[index],
      );

      occupied.add(square);
    },
  );

  const remainingSquares =
    shuffle(
      ALL_SQUARES.filter(
        (square) =>
          !occupied.has(square),
      ),
      random,
    );

  const nonKings =
    shuffle(
      [
        ...WHITE_NON_KING,
        ...BLACK_NON_KING,
      ],
      random,
    );

  if (
    remainingSquares.length <
    nonKings.length
  ) {
    return null;
  }

  nonKings.forEach(
    (piece, index) => {
      placements.set(
        remainingSquares[index],
        piece,
      );
    },
  );

  if (
    !isPlayablePlacement(
      placements,
    )
  ) {
    return null;
  }

  return {
    seed,
    fen:
      placementFen(
        placements,
        "w",
      ),
    whiteKingSquare,
    blackKingSquare,
    orthodoxMatches:
      countOrthodoxMatches(
        placements,
      ),
  };
}

export function createTotalChaosSeed() {
  const now =
    Date.now() >>> 0;

  const random =
    Math.floor(
      Math.random() *
        0xffffffff,
    ) >>> 0;

  const perf =
    typeof performance !==
    "undefined"
      ? Math.floor(
          performance.now() *
            1000,
        ) >>> 0
      : 0;

  return (
    now ^
    random ^
    perf
  ) >>> 0;
}

export function createTotalChaosPosition(
  seed =
    createTotalChaosSeed(),
): TotalChaosPosition {
  /*
   * Random full-board arrangements are cheap to generate, so retry
   * until both Kings begin safe and both sides have legal moves.
   */
  for (
    let attempt = 0;
    attempt < 10000;
    attempt += 1
  ) {
    const result =
      buildAttempt(
        seed,
        attempt,
      );

    if (result) {
      return result;
    }
  }

  throw new Error(
    "Could not generate a playable Total Chaos position.",
  );
}

export function countPiecesByZone(
  game: Chess,
) {
  let whiteHalf = 0;
  let blackHalf = 0;
  let whiteInEnemyHalf = 0;
  let blackInEnemyHalf = 0;

  for (
    let row = 0;
    row < 8;
    row += 1
  ) {
    for (
      let column = 0;
      column < 8;
      column += 1
    ) {
      const piece =
        game.board()[row][column];

      if (!piece) {
        continue;
      }

      const rank =
        8 - row;

      if (piece.color === "w") {
        if (rank <= 4) {
          whiteHalf += 1;
        } else {
          whiteInEnemyHalf += 1;
        }
      } else {
        if (rank >= 5) {
          blackHalf += 1;
        } else {
          blackInEnemyHalf += 1;
        }
      }
    }
  }

  return {
    whiteHalf,
    blackHalf,
    whiteInEnemyHalf,
    blackInEnemyHalf,
  };
}
