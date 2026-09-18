import { Chess } from "chess.js";

import {
  buildThreeLivesPowerupState,
  type HeartPickupEvent,
} from "./threeLivesPowerups";

export type ThreeLivesStatsSide = "white" | "black";
export type ThreeLivesStatsPiece = "p" | "n" | "b" | "r" | "q" | "k";

export type ThreeLivesHitMoment = {
  ply: number;
  moveNumber: number;
  san: string;
  attacker: ThreeLivesStatsSide;
  damagedSide: ThreeLivesStatsSide;
  piece: ThreeLivesStatsPiece;
  whiteHpAfter: number;
  blackHpAfter: number;
};

export type DangerousPiece = {
  piece: ThreeLivesStatsPiece;
  checks: number;
} | null;

export type ThreeLivesMatchStats = {
  totalPlies: number;
  totalMoves: number;

  whiteChecksDealt: number;
  blackChecksDealt: number;

  whiteCaptures: number;
  blackCaptures: number;

  whiteMaterialTaken: number;
  blackMaterialTaken: number;

  whiteHeartsClaimed: number;
  blackHeartsClaimed: number;
  heartPickups: HeartPickupEvent[];

  currentCalmStreak: number;
  longestCalmStreak: number;

  whiteLastLifeMoves: number;
  blackLastLifeMoves: number;

  whiteDangerousPiece: DangerousPiece;
  blackDangerousPiece: DangerousPiece;

  whitePressureScore: number;
  blackPressureScore: number;
  pressureLeader: ThreeLivesStatsSide | "even";

  longestCheckRun: {
    side: ThreeLivesStatsSide | null;
    count: number;
  };

  firstHit: ThreeLivesHitMoment | null;
  latestHit: ThreeLivesHitMoment | null;
  hitMoments: ThreeLivesHitMoment[];
};

const pieceValues: Record<ThreeLivesStatsPiece, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function mostDangerousPiece(
  counts: Record<ThreeLivesStatsPiece, number>,
): DangerousPiece {
  let bestPiece: ThreeLivesStatsPiece | null = null;
  let bestChecks = 0;

  for (const piece of Object.keys(counts) as ThreeLivesStatsPiece[]) {
    if (counts[piece] > bestChecks) {
      bestPiece = piece;
      bestChecks = counts[piece];
    }
  }

  return bestPiece
    ? {
        piece: bestPiece,
        checks: bestChecks,
      }
    : null;
}

export function buildThreeLivesMatchStats(
  moves: string[],
  heartSeed: number,
): ThreeLivesMatchStats {
  const replay = new Chess();
  const powerups = buildThreeLivesPowerupState(moves, heartSeed);

  let whiteHp = 3;
  let blackHp = 3;

  let whiteChecksDealt = 0;
  let blackChecksDealt = 0;

  let whiteCaptures = 0;
  let blackCaptures = 0;

  let whiteMaterialTaken = 0;
  let blackMaterialTaken = 0;

  let whiteHeartsClaimed = 0;
  let blackHeartsClaimed = 0;

  let currentCalmStreak = 0;
  let longestCalmStreak = 0;

  let whiteLastLifeMoves = 0;
  let blackLastLifeMoves = 0;

  const checksByPiece = {
    white: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    black: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
  } satisfies Record<ThreeLivesStatsSide, Record<ThreeLivesStatsPiece, number>>;

  const hitMoments: ThreeLivesHitMoment[] = [];

  let longestRunSide: ThreeLivesStatsSide | null = null;
  let longestRunCount = 0;

  let currentRunSide: ThreeLivesStatsSide | null = null;
  let currentRunCount = 0;

  for (let index = 0; index < moves.length; index += 1) {
    const sideToMove: ThreeLivesStatsSide =
      replay.turn() === "w" ? "white" : "black";

    if (sideToMove === "white" && whiteHp === 1) {
      whiteLastLifeMoves += 1;
    }

    if (sideToMove === "black" && blackHp === 1) {
      blackLastLifeMoves += 1;
    }

    const move = replay.move(moves[index]);
    const timeline = powerups.timeline[index];

    const attacker: ThreeLivesStatsSide =
      move.color === "w" ? "white" : "black";

    if (move.captured) {
      const captured = move.captured as ThreeLivesStatsPiece;

      if (attacker === "white") {
        whiteCaptures += 1;
        whiteMaterialTaken += pieceValues[captured] ?? 0;
      } else {
        blackCaptures += 1;
        blackMaterialTaken += pieceValues[captured] ?? 0;
      }
    }

    if (timeline?.heartPickedBy === "white") {
      whiteHeartsClaimed += 1;
    } else if (timeline?.heartPickedBy === "black") {
      blackHeartsClaimed += 1;
    }

    if (!timeline?.damagedSide) {
      currentCalmStreak += 1;
      longestCalmStreak = Math.max(longestCalmStreak, currentCalmStreak);

      if (timeline) {
        whiteHp = timeline.whiteHpAfter;
        blackHp = timeline.blackHpAfter;
      }

      continue;
    }

    currentCalmStreak = 0;

    if (attacker === "white") {
      whiteChecksDealt += 1;
      checksByPiece.white[move.piece as ThreeLivesStatsPiece] += 1;
    } else {
      blackChecksDealt += 1;
      checksByPiece.black[move.piece as ThreeLivesStatsPiece] += 1;
    }

    const moment: ThreeLivesHitMoment = {
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      san: move.san,
      attacker,
      damagedSide: timeline.damagedSide,
      piece: move.piece as ThreeLivesStatsPiece,
      whiteHpAfter: timeline.whiteHpAfter,
      blackHpAfter: timeline.blackHpAfter,
    };

    hitMoments.push(moment);

    if (currentRunSide === attacker) {
      currentRunCount += 1;
    } else {
      currentRunSide = attacker;
      currentRunCount = 1;
    }

    if (currentRunCount > longestRunCount) {
      longestRunCount = currentRunCount;
      longestRunSide = currentRunSide;
    }

    whiteHp = timeline.whiteHpAfter;
    blackHp = timeline.blackHpAfter;
  }

  const whitePressureScore = whiteChecksDealt * 3 + whiteCaptures;
  const blackPressureScore = blackChecksDealt * 3 + blackCaptures;

  return {
    totalPlies: moves.length,
    totalMoves: Math.ceil(moves.length / 2),

    whiteChecksDealt,
    blackChecksDealt,

    whiteCaptures,
    blackCaptures,

    whiteMaterialTaken,
    blackMaterialTaken,

    whiteHeartsClaimed,
    blackHeartsClaimed,
    heartPickups: powerups.pickups,

    currentCalmStreak,
    longestCalmStreak,

    whiteLastLifeMoves,
    blackLastLifeMoves,

    whiteDangerousPiece: mostDangerousPiece(checksByPiece.white),
    blackDangerousPiece: mostDangerousPiece(checksByPiece.black),

    whitePressureScore,
    blackPressureScore,
    pressureLeader:
      whitePressureScore === blackPressureScore
        ? "even"
        : whitePressureScore > blackPressureScore
          ? "white"
          : "black",

    longestCheckRun: {
      side: longestRunSide,
      count: longestRunCount,
    },

    firstHit: hitMoments[0] ?? null,
    latestHit: hitMoments[hitMoments.length - 1] ?? null,
    hitMoments,
  };
}
