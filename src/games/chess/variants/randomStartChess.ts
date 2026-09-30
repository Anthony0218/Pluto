import { Chess } from "chess.js";

export type RandomBackRankPiece = "r" | "n" | "b" | "q" | "k";

export type RandomStartPosition = {
  seed: number;
  whiteBackRank: RandomBackRankPiece[];
  blackBackRank: RandomBackRankPiece[];
  fen: string;
};

const STARTING_BACK_RANK: RandomBackRankPiece[] = [
  "r",
  "n",
  "b",
  "q",
  "k",
  "b",
  "n",
  "r",
];

function mulberry32(seed: number) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;

    let t = value;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mixSeed(seed: number, salt: number) {
  let value = (seed ^ salt) >>> 0;

  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);

  return (value ^ (value >>> 16)) >>> 0;
}

function shuffle<T>(items: T[], seed: number) {
  const random = mulberry32(seed);
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));

    [result[index], result[target]] = [result[target], result[index]];
  }

  return result;
}

function rowToFen(row: RandomBackRankPiece[], color: "white" | "black") {
  const text = row.join("");

  return color === "white" ? text.toUpperCase() : text;
}

export function createRandomStartSeed() {
  return (
    (Date.now() ^
      Math.floor(Math.random() * 0xffffffff) ^
      Math.floor(performance.now() * 1000)) >>>
    0
  );
}

export function createRandomStartPosition(
  seed = createRandomStartSeed(),
): RandomStartPosition {
  /*
   * White and Black are deliberately shuffled with different seeds.
   * This is NOT a mirrored/random-Chess960 position.
   */
  const whiteBackRank = shuffle(STARTING_BACK_RANK, mixSeed(seed, 0x51f15e));

  const blackBackRank = shuffle(STARTING_BACK_RANK, mixSeed(seed, 0xb1ac6b));

  /*
   * No castling rights:
   * kings and rooks are not guaranteed to occupy their orthodox squares.
   */
  const fen =
    [
      rowToFen(blackBackRank, "black"),
      "pppppppp",
      "8",
      "8",
      "8",
      "8",
      "PPPPPPPP",
      rowToFen(whiteBackRank, "white"),
    ].join("/") + " w - - 0 1";

  /*
   * chess.js validation also gives us a guard against accidental invalid
   * FEN generation if this file is changed later.
   */
  new Chess(fen);

  return {
    seed,
    whiteBackRank,
    blackBackRank,
    fen,
  };
}

export function randomBackRankLabel(piece: RandomBackRankPiece) {
  switch (piece) {
    case "k":
      return "King";
    case "q":
      return "Queen";
    case "r":
      return "Rook";
    case "b":
      return "Bishop";
    case "n":
      return "Knight";
  }
}
