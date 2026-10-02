import { DUEL_CONFIG } from "../config.ts";
import type { DuelWager, Match, Player } from "../types.ts";

// Largest coin stake both duelists can cover (the custom wager's upper bound).
export function maxCoinWager(challenger: Player, defender: Player): number {
  return Math.max(0, Math.min(challenger.coins, defender.coins));
}

export function canWagerCoins(challenger: Player, defender: Player, amount: number): boolean {
  return (
    Number.isInteger(amount) &&
    amount >= DUEL_CONFIG.minCustomCoins &&
    amount <= maxCoinWager(challenger, defender)
  );
}

export function canWagerPluto(challenger: Player, defender: Player): boolean {
  return challenger.goldenPlutos >= 1 && defender.goldenPlutos >= 1;
}

// Throws unless both players can fund the wager. Presets (5/10/20) are just common custom amounts.
export function validateWager(
  challenger: Player,
  defender: Player,
  wager: DuelWager | undefined,
): DuelWager {
  if (!wager) throw new Error("Choose a wager.");
  if (wager.type === "pluto") {
    if (!canWagerPluto(challenger, defender))
      throw new Error("Both duelists need at least 1 Golden Pluto for a Pluto wager.");
    return { type: "pluto", amount: 1 };
  }
  if (wager.type !== "coins" || !Number.isInteger(wager.amount) || wager.amount < DUEL_CONFIG.minCustomCoins)
    throw new Error("A coin wager must be a whole number of at least 1.");
  if (challenger.coins < wager.amount)
    throw new Error(`You need ${wager.amount} coins for that wager.`);
  if (defender.coins < wager.amount)
    throw new Error(`${defender.name} cannot cover a ${wager.amount}-coin wager.`);
  return { type: "coins", amount: wager.amount };
}

export function canChallenge(challenger: Player, defender: Player): boolean {
  return (
    challenger.id !== defender.id &&
    (maxCoinWager(challenger, defender) >= DUEL_CONFIG.minCustomCoins ||
      canWagerPluto(challenger, defender))
  );
}

export function hasDuelTarget(state: Match, playerId: string): boolean {
  const me = state.players.find((p) => p.id === playerId);
  return !!me && state.players.some((p) => canChallenge(me, p));
}

export function describeWager(wager: DuelWager): string {
  return wager.type === "pluto"
    ? "1 GOLDEN PLUTO"
    : `${wager.amount} COIN${wager.amount === 1 ? "" : "S"} EACH`;
}
