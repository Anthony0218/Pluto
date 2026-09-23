import { Chess, type Square } from "chess.js";

export const THREE_LIVES_STARTING_HP = 3;
export const THIRD_HEART_SPAWN_PLY = 10;

export type ThreeLivesSide = "white" | "black";

export type HeartPickupEvent = {
  ply: number;
  moveNumber: number;
  san: string;
  side: ThreeLivesSide;
  square: Square;
  whiteHpAfter: number;
  blackHpAfter: number;
};

export type HeartSpawnEvent = {
  ply: number;
  square: Square;
};

export type ThreeLivesPowerupTimelineEntry = {
  ply: number;
  moveNumber: number;
  san: string;
  damagedSide: ThreeLivesSide | null;
  heartPickedBy: ThreeLivesSide | null;
  heartPickedSquare: Square | null;
  whiteHpAfter: number;
  blackHpAfter: number;
  activeHeartsAfter: Square[];
  thirdHeartSpawned: Square | null;
};

export type ThreeLivesPowerupState = {
  seed: number;
  whiteHp: number;
  blackHp: number;
  winnerByHp: ThreeLivesSide | null;
  initialHeartSquares: Square[];
  thirdHeartSquare: Square | null;
  activeHearts: Square[];
  pickups: HeartPickupEvent[];
  spawns: HeartSpawnEvent[];
  timeline: ThreeLivesPowerupTimelineEntry[];
};

const middleSquares: Square[] = [
  "a4",
  "b4",
  "c4",
  "d4",
  "e4",
  "f4",
  "g4",
  "h4",
  "a5",
  "b5",
  "c5",
  "d5",
  "e5",
  "f5",
  "g5",
  "h5",
];

function mulberry32(seed: number) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;

    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);

    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function pickAndRemove<T>(items: T[], random: () => number): T | null {
  if (items.length === 0) return null;

  const index = Math.floor(random() * items.length);
  const [picked] = items.splice(index, 1);

  return picked ?? null;
}

export function createThreeLivesHeartSeed(): number {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] >>> 0;
  }

  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export function hashThreeLivesHeartSeed(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function buildThreeLivesPowerupState(
  moves: string[],
  seed: number,
): ThreeLivesPowerupState {
  const replay = new Chess();
  const random = mulberry32(seed);

  /*
   * Opening hearts are split across the two center ranks:
   * exactly one on rank 4 and exactly one on rank 5.
   */
  const rank4Pool = middleSquares.filter((square) => square[1] === "4");
  const rank5Pool = middleSquares.filter((square) => square[1] === "5");

  const rank4Heart = pickAndRemove(rank4Pool, random);
  const rank5Heart = pickAndRemove(rank5Pool, random);

  const initialHeartSquares = [rank4Heart, rank5Heart].filter(
    (square): square is Square => square !== null,
  );

  const activeHearts = new Set<Square>(initialHeartSquares);

  let whiteHp = THREE_LIVES_STARTING_HP;
  let blackHp = THREE_LIVES_STARTING_HP;

  let thirdHeartSquare: Square | null = null;

  const pickups: HeartPickupEvent[] = [];
  const spawns: HeartSpawnEvent[] = [];
  const timeline: ThreeLivesPowerupTimelineEntry[] = [];

  initialHeartSquares.forEach((square) => {
    spawns.push({
      ply: 0,
      square,
    });
  });

  for (let index = 0; index < moves.length; index += 1) {
    const move = replay.move(moves[index]);
    const ply = index + 1;
    const moveNumber = Math.floor(index / 2) + 1;

    const mover: ThreeLivesSide = move.color === "w" ? "white" : "black";

    let heartPickedBy: ThreeLivesSide | null = null;
    let heartPickedSquare: Square | null = null;

    /*
     * Landing on a heart consumes it immediately and grants +1 life.
     * Lives are intentionally allowed to go above the starting 3.
     */
    if (activeHearts.has(move.to)) {
      activeHearts.delete(move.to);

      heartPickedBy = mover;
      heartPickedSquare = move.to;

      if (mover === "white") {
        whiteHp += 1;
      } else {
        blackHp += 1;
      }
    }

    let damagedSide: ThreeLivesSide | null = null;

    if (replay.isCheck()) {
      damagedSide = replay.turn() === "w" ? "white" : "black";

      if (damagedSide === "white") {
        whiteHp = Math.max(0, whiteHp - 1);
      } else {
        blackHp = Math.max(0, blackHp - 1);
      }
    }

    /*
     * After five complete moves (10 plies), try to spawn the third heart.
     * It can only appear on an empty rank-4/rank-5 square.
     *
     * If every middle square is occupied, this third heart is skipped
     * permanently for the game.
     */
    let thirdHeartSpawned: Square | null = null;

    if (ply === THIRD_HEART_SPAWN_PLY) {
      const available = middleSquares.filter(
        (square) =>
          replay.get(square) === undefined && !activeHearts.has(square),
      );

      if (available.length > 0) {
        const picked =
          available[Math.floor(random() * available.length)] ?? null;

        if (picked) {
          thirdHeartSquare = picked;
          thirdHeartSpawned = picked;
          activeHearts.add(picked);

          spawns.push({
            ply,
            square: picked,
          });
        }
      }
    }

    if (heartPickedBy && heartPickedSquare) {
      pickups.push({
        ply,
        moveNumber,
        san: move.san,
        side: heartPickedBy,
        square: heartPickedSquare,
        whiteHpAfter: whiteHp,
        blackHpAfter: blackHp,
      });
    }

    timeline.push({
      ply,
      moveNumber,
      san: move.san,
      damagedSide,
      heartPickedBy,
      heartPickedSquare,
      whiteHpAfter: whiteHp,
      blackHpAfter: blackHp,
      activeHeartsAfter: [...activeHearts],
      thirdHeartSpawned,
    });
  }

  return {
    seed,
    whiteHp,
    blackHp,
    winnerByHp: whiteHp <= 0 ? "black" : blackHp <= 0 ? "white" : null,
    initialHeartSquares,
    thirdHeartSquare,
    activeHearts: [...activeHearts],
    pickups,
    spawns,
    timeline,
  };
}
