import type {
  MutationEvent,
  MutationMoveRecord,
  MutationPieceType,
} from "./mutationChess";

export type MutationStats = {
  totalMutations: number;
  whiteMutations: number;
  blackMutations: number;

  upgrades: number;
  downgrades: number;
  sidegrades: number;

  whiteNetValue: number;
  blackNetValue: number;

  chaosScore: number;

  latestMutation: MutationEvent | null;
  biggestUpgrade: MutationEvent | null;
  biggestDowngrade: MutationEvent | null;

  favoriteTarget: MutationPieceType | null;

  mutations: MutationEvent[];
};

export function buildMutationStats(
  records: MutationMoveRecord[],
): MutationStats {
  const mutations = records
    .map((record) => record.mutation)
    .filter((event): event is MutationEvent => event !== null);

  let whiteMutations = 0;
  let blackMutations = 0;

  let upgrades = 0;
  let downgrades = 0;
  let sidegrades = 0;

  let whiteNetValue = 0;
  let blackNetValue = 0;

  let chaosScore = 0;

  let biggestUpgrade: MutationEvent | null = null;
  let biggestDowngrade: MutationEvent | null = null;

  const targetCounts: Partial<Record<MutationPieceType, number>> = {};

  for (const event of mutations) {
    if (event.color === "w") {
      whiteMutations += 1;
      whiteNetValue += event.valueDelta;
    } else {
      blackMutations += 1;
      blackNetValue += event.valueDelta;
    }

    if (event.valueDelta > 0) {
      upgrades += 1;

      if (
        !biggestUpgrade ||
        event.valueDelta > biggestUpgrade.valueDelta
      ) {
        biggestUpgrade = event;
      }
    } else if (event.valueDelta < 0) {
      downgrades += 1;

      if (
        !biggestDowngrade ||
        event.valueDelta < biggestDowngrade.valueDelta
      ) {
        biggestDowngrade = event;
      }
    } else {
      sidegrades += 1;
    }

    chaosScore += Math.abs(event.valueDelta);

    targetCounts[event.toType] =
      (targetCounts[event.toType] ?? 0) + 1;
  }

  let favoriteTarget: MutationPieceType | null = null;
  let favoriteTargetCount = 0;

  for (const [type, count] of Object.entries(targetCounts)) {
    if ((count ?? 0) > favoriteTargetCount) {
      favoriteTarget = type as MutationPieceType;
      favoriteTargetCount = count ?? 0;
    }
  }

  return {
    totalMutations: mutations.length,
    whiteMutations,
    blackMutations,
    upgrades,
    downgrades,
    sidegrades,
    whiteNetValue,
    blackNetValue,
    chaosScore,
    latestMutation: mutations[mutations.length - 1] ?? null,
    biggestUpgrade,
    biggestDowngrade,
    favoriteTarget,
    mutations,
  };
}
