import { seededRandom, shuffled } from "../random.ts";
import { STAT_BATTLE } from "./config.ts";
import { compareCountryStats, getCountryStat, type TrialCountry } from "./countryStats.ts";
import { battleCategoryById, battleDeckPool, drawCategory, MAX_BATTLE_REROLLS } from "./statBattle.ts";

/**
 * Stat Battle around a table of three or four (online or hotseat); two players keep the duel in battleMatch.ts.
 * Everyone lays one card face down, all are revealed together, and the single best value takes the round.
 */
export const BATTLE_TABLE = { minSeats: 3, maxSeats: 4, maxRounds: 30 } as const;
export type TableOutcome = { round: number; categoryId: string; cards: string[]; values: number[]; /** Seat that took the round; null when the best value is shared. */ winner: number | null };
export type BattleTableState = {
  seed: string; deck: string[]; hands: string[][]; discard: string[]; rerolls: number[]; picks: (string | null)[];
  round: number; categoryId: string; scores: number[];
  /** choose → reveal (every card on the table) → choose … → finished. */
  phase: "choose" | "reveal" | "finished"; played: TableOutcome | null; history: TableOutcome[];
};
/** What one seat may see: its own hand, and of the others only who has played and how many cards they hold. */
export type TableView = {
  seat: number; round: number; categoryId: string; phase: BattleTableState["phase"]; hand: string[]; handSizes: number[]; deck: number;
  scores: number[]; picked: string | null; pickedSeats: boolean[]; rerollsLeft: number; played: TableOutcome | null; history: TableOutcome[];
};

/** Deals every hand back up to full size, seat by seat. An empty deck is rebuilt from the discard pile. */
function deal(state: Pick<BattleTableState, "seed" | "round" | "deck" | "hands" | "discard">): Pick<BattleTableState, "deck" | "hands" | "discard"> {
  let deck = [...state.deck], discard = [...state.discard];
  const hands = state.hands.map((hand) => {
    const missing = Math.max(0, STAT_BATTLE.handSize - hand.length);
    if (deck.length < missing && discard.length) { deck = [...deck, ...shuffled(discard, seededRandom(`${state.seed}:table-reshuffle:${state.round}`))]; discard = []; }
    const next = [...hand, ...deck.slice(0, missing)];
    deck = deck.slice(missing);
    return next;
  });
  return { deck, hands, discard };
}

export function createBattleTable(pool: readonly TrialCountry[], seed: string, seats: number): BattleTableState {
  if (!Number.isInteger(seats) || seats < BATTLE_TABLE.minSeats || seats > BATTLE_TABLE.maxSeats) throw new Error("A Stat Battle table seats three or four players.");
  const deck = shuffled(battleDeckPool(pool).map((country) => country.id), seededRandom(`${seed}:battle-deck`));
  if (deck.length < STAT_BATTLE.handSize * seats + seats) throw new Error("Not enough countries for Stat Battle.");
  const empty = Array.from({ length: seats }, () => [] as string[]);
  return {
    seed, ...deal({ seed, round: 1, deck, hands: empty, discard: [] }), rerolls: empty.map(() => 0), picks: empty.map(() => null),
    round: 1, categoryId: drawCategory(seed, 1, []), scores: empty.map(() => 0), phase: "choose", played: null, history: [],
  };
}

const assertSeat = (state: BattleTableState, seat: number) => { if (!Number.isInteger(seat) || seat < 0 || seat >= state.hands.length) throw new Error("Only seated players can play cards."); };

export function pickTableCard(state: BattleTableState, seat: number, cardId: string): BattleTableState {
  assertSeat(state, seat);
  if (state.phase !== "choose") throw new Error("The cards are on the table. Wait for the next round.");
  if (!state.hands[seat].includes(cardId)) throw new Error("That card is not in your hand.");
  if (state.picks[seat]) throw new Error("You already played a card this round.");
  return { ...state, picks: state.picks.map((pick, index) => index === seat ? cardId : pick) };
}

/** Replaces a whole hand. Fresh deck and discard cards are dealt first; old cards are recycled only if needed. */
export function rerollTableHand(state: BattleTableState, seat: number): BattleTableState {
  assertSeat(state, seat);
  if (state.picks[seat]) throw new Error("Your card is already on the table.");
  const old = state.hands[seat];
  if (state.phase !== "choose" || state.rerolls[seat] >= MAX_BATTLE_REROLLS || !old.length) throw new Error("No rerolls remain for this game.");
  const random = seededRandom(`${state.seed}:table-reroll:${seat}:${state.rerolls[seat]}:${state.round}`);
  const available = shuffled([...state.deck, ...state.discard], random);
  const fresh = available.slice(0, old.length);
  const recycled = fresh.length < old.length ? shuffled(old, random).slice(0, old.length - fresh.length) : [];
  return {
    ...state, discard: [], deck: [...available.slice(old.length), ...old.filter((id) => !recycled.includes(id))],
    hands: state.hands.map((hand, index) => index === seat ? [...fresh, ...recycled] : hand),
    rerolls: state.rerolls.map((used, index) => index === seat ? used + 1 : used),
  };
}

/** Reveals the round once every card is in. `force` plays the first card of each hand whose owner ran out of time. */
export function revealTablePicks(state: BattleTableState, byId: Map<string, TrialCountry>, force = false): BattleTableState {
  if (state.phase !== "choose") return state;
  const cards = state.picks.map((pick, seat) => pick ?? (force ? state.hands[seat][0] ?? null : null));
  if (cards.some((card) => !card)) return state;
  const category = battleCategoryById(state.categoryId), countries = cards.map((card) => byId.get(card!)!);
  const best = countries.reduce((lead, country) => compareCountryStats(country, lead, category.statId, category.direction) > 0 ? country : lead);
  const leaders = countries.flatMap((country, seat) => compareCountryStats(country, best, category.statId, category.direction) === 0 ? [seat] : []);
  const winner = leaders.length === 1 ? leaders[0] : null;
  const played: TableOutcome = { round: state.round, categoryId: category.id, cards: cards as string[], values: countries.map((country) => getCountryStat(country, category.statId)!), winner };
  return {
    ...state, phase: "reveal", played, history: [...state.history, played], picks: state.picks.map(() => null),
    hands: state.hands.map((hand, seat) => hand.filter((id) => id !== cards[seat])),
    scores: state.scores.map((score, seat) => score + Number(seat === winner)),
  };
}

/** Clears the table, refills every hand and reveals the next category — or ends the match. */
export function nextTableRound(state: BattleTableState): BattleTableState {
  if (state.phase !== "reveal" || !state.played) return state;
  const dealt = deal({ ...state, discard: [...state.discard, ...state.played.cards] });
  const finished = state.scores.some((score) => score >= STAT_BATTLE.winTarget) || state.round >= BATTLE_TABLE.maxRounds || dealt.hands.some((hand) => !hand.length);
  if (finished) return { ...state, ...dealt, phase: "finished", played: null };
  const round = state.round + 1, recent = state.history.slice(-2).map((outcome) => outcome.categoryId);
  return { ...state, ...dealt, round, categoryId: drawCategory(state.seed, round, recent), phase: "choose", played: null };
}

export function tableView(state: BattleTableState, seat: number): TableView {
  assertSeat(state, seat);
  return {
    seat, round: state.round, categoryId: state.categoryId, phase: state.phase, hand: state.hands[seat], handSizes: state.hands.map((hand) => hand.length), deck: state.deck.length,
    scores: state.scores, picked: state.picks[seat], pickedSeats: state.picks.map(Boolean), rerollsLeft: MAX_BATTLE_REROLLS - state.rerolls[seat],
    played: state.played, history: state.history,
  };
}
