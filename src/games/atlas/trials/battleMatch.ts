import type { TrialCountry } from "./countryStats.ts";
import { advanceBattle, createBattle, playBattleRound, rerollBattleHand, MAX_BATTLE_REROLLS, type BattleOutcome, type BattleState } from "./statBattle.ts";

/**
 * Stat Battle between two people (online or hotseat). Seat 0 holds the engine's "player" hand, seat 1 its
 * "opponent" hand. Both pick face down; the round is revealed once both cards are in.
 */
export type BattleSeat = 0 | 1;
export type BattleMatchState = { battle: BattleState; picks: [string | null, string | null] };
export type SeatOutcome = { round: number; categoryId: string; mine: string; theirs: string; myValue: number; theirValue: number; winner: "me" | "them" | "tie" };
export type BattleView = {
  round: number; categoryId: string; phase: BattleState["phase"]; hand: string[]; opponentCards: number; deck: number;
  myScore: number; theirScore: number; picked: string | null; opponentPicked: boolean; played: SeatOutcome | null; history: SeatOutcome[];
  rerollsLeft: number;
};

export const handOf = (state: BattleMatchState, seat: BattleSeat) => seat === 0 ? state.battle.player : state.battle.opponent;

export function createBattleMatch(pool: readonly TrialCountry[], seed: string): BattleMatchState {
  return { battle: createBattle(pool, seed, "normal"), picks: [null, null] };
}

export function pickBattleCard(state: BattleMatchState, seat: BattleSeat, cardId: string): BattleMatchState {
  if (state.battle.phase !== "choose") throw new Error("Both cards are on the table. Wait for the next round.");
  if (!handOf(state, seat).includes(cardId)) throw new Error("That card is not in your hand.");
  if (state.picks[seat]) throw new Error("You already played a card this round.");
  const picks: BattleMatchState["picks"] = [...state.picks];
  picks[seat] = cardId;
  return { ...state, picks };
}

export function rerollBattleMatchHand(state: BattleMatchState, seat: BattleSeat): BattleMatchState {
  if (state.picks[seat]) throw new Error("Your card is already on the table.");
  const battle = rerollBattleHand(state.battle, seat);
  if (battle === state.battle) throw new Error("No rerolls remain for this game.");
  return { ...state, battle };
}

/** Reveals the round once both cards are in. `force` plays the first card of a hand whose owner ran out of time. */
export function revealBattlePicks(state: BattleMatchState, byId: Map<string, TrialCountry>, force = false): BattleMatchState {
  if (state.battle.phase !== "choose") return state;
  const first = state.picks[0] ?? (force ? state.battle.player[0] : null), second = state.picks[1] ?? (force ? state.battle.opponent[0] : null);
  if (!first || !second) return state;
  return { battle: playBattleRound(state.battle, first, second, byId), picks: [null, null] };
}

export function nextBattleRound(state: BattleMatchState): BattleMatchState {
  return { battle: advanceBattle(state.battle), picks: [null, null] };
}

export function outcomeForSeat(outcome: BattleOutcome, seat: BattleSeat): SeatOutcome {
  const mine = seat === 0;
  return {
    round: outcome.round, categoryId: outcome.categoryId,
    mine: mine ? outcome.player : outcome.opponent, theirs: mine ? outcome.opponent : outcome.player,
    myValue: mine ? outcome.playerValue : outcome.opponentValue, theirValue: mine ? outcome.opponentValue : outcome.playerValue,
    winner: outcome.winner === "tie" ? "tie" : (outcome.winner === "player") === mine ? "me" : "them",
  };
}

/** What one seat may see: its own hand, only the size of the other, and the opponent's pick only once revealed. */
export function battleView(state: BattleMatchState, seat: BattleSeat): BattleView {
  const { battle } = state, other: BattleSeat = seat === 0 ? 1 : 0;
  return {
    round: battle.round, categoryId: battle.categoryId, phase: battle.phase, hand: handOf(state, seat), opponentCards: handOf(state, other).length, deck: battle.deck.length,
    myScore: seat === 0 ? battle.playerScore : battle.opponentScore, theirScore: seat === 0 ? battle.opponentScore : battle.playerScore,
    picked: state.picks[seat], opponentPicked: Boolean(state.picks[other]),
    rerollsLeft: MAX_BATTLE_REROLLS - (battle.rerolls?.[seat] ?? 0),
    played: battle.played ? outcomeForSeat(battle.played, seat) : null, history: battle.history.map((outcome) => outcomeForSeat(outcome, seat)),
  };
}
