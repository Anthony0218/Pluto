import type {
  CapitalSide,
  CapitalState,
  CapitalismMoveRecord,
} from "./capitalismChess";

import { STARTING_COINS } from "./capitalismChess";

export type CapitalismStats = {
  whiteEarned: number;
  blackEarned: number;

  whiteSpent: number;
  blackSpent: number;

  captureIncome: number;
  checkIncome: number;
  castleIncome: number;
  promotionIncome: number;
  bountyIncome: number;
  missionIncome: number;
  investmentIncome: number;

  bountyClaims: number;
  missionsCompleted: number;

  biggestPayday: CapitalismMoveRecord | null;

  richestSide: CapitalSide | "even";

  momentRecords: CapitalismMoveRecord[];
};

export function buildCapitalismStats(
  records: CapitalismMoveRecord[],
  currentState: CapitalState,
): CapitalismStats {
  let whiteEarned = 0;
  let blackEarned = 0;

  let captureIncome = 0;
  let checkIncome = 0;
  let castleIncome = 0;
  let promotionIncome = 0;
  let bountyIncome = 0;
  let missionIncome = 0;
  let investmentIncome = 0;

  let bountyClaims = 0;
  let missionsCompleted = 0;

  let biggestPayday: CapitalismMoveRecord | null = null;

  const momentRecords: CapitalismMoveRecord[] = [];

  for (const record of records) {
    const event = record.economy;

    if (event.side === "white") {
      whiteEarned += event.totalEarned;
    } else {
      blackEarned += event.totalEarned;
    }

    captureIncome += event.captureCoins;
    checkIncome += event.checkCoins;
    castleIncome += event.castleCoins;
    promotionIncome += event.promotionCoins;
    bountyIncome += event.bountyCoins;
    missionIncome += event.missionCoins;
    investmentIncome += event.investmentBonus;

    if (event.bountyClaimed) {
      bountyClaims += 1;
    }

    if (event.missionCompleted) {
      missionsCompleted += 1;
    }

    if (
      !biggestPayday ||
      event.totalEarned > biggestPayday.economy.totalEarned
    ) {
      biggestPayday = record;
    }

    if (
      event.bountyClaimed ||
      event.missionCompleted ||
      event.totalEarned >= 6
    ) {
      momentRecords.push(record);
    }
  }

  /*
   * Infer all spending from the live balance.
   * This includes both Royal Powers and shop purchases.
   */
  const whiteSpent = Math.max(
    0,
    STARTING_COINS + whiteEarned - currentState.coins.white,
  );

  const blackSpent = Math.max(
    0,
    STARTING_COINS + blackEarned - currentState.coins.black,
  );

  const whiteWealth = currentState.coins.white;
  const blackWealth = currentState.coins.black;

  return {
    whiteEarned,
    blackEarned,
    whiteSpent,
    blackSpent,
    captureIncome,
    checkIncome,
    castleIncome,
    promotionIncome,
    bountyIncome,
    missionIncome,
    investmentIncome,
    bountyClaims,
    missionsCompleted,
    biggestPayday:
      biggestPayday && biggestPayday.economy.totalEarned > 0
        ? biggestPayday
        : null,
    richestSide:
      whiteWealth === blackWealth
        ? "even"
        : whiteWealth > blackWealth
          ? "white"
          : "black",
    momentRecords,
  };
}
