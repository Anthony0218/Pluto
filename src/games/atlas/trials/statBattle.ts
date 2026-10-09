import { seededRandom, shuffled } from "../random.ts";
import { STAT_BATTLE } from "./config.ts";
import { compareCountryStats, getCountryStat, hasStats, pickOne, STAT_IDS, STATS, type StatDirection, type TrialCountry, type TrialStatId } from "./countryStats.ts";

export type BattleGroup = "People" | "Geography";
export type BattleCategory = { id: string; statId: TrialStatId; direction: StatDirection; group: BattleGroup; label: string };
/** "Lower wins" rounds turn small countries into strong cards, which keeps hoarding giants risky. */
export const BATTLE_CATEGORIES: BattleCategory[] = ([
  { id: "population:highest", statId: "population", direction: "highest", group: "People", label: "Population" },
  { id: "population:lowest", statId: "population", direction: "lowest", group: "People", label: "Population" },
  { id: "density:highest", statId: "density", direction: "highest", group: "People", label: "Population density" },
  { id: "density:lowest", statId: "density", direction: "lowest", group: "People", label: "Population density" },
  { id: "areaKm2:highest", statId: "areaKm2", direction: "highest", group: "Geography", label: "Area" },
  { id: "areaKm2:lowest", statId: "areaKm2", direction: "lowest", group: "Geography", label: "Area" },
  { id: "highestPointM:highest", statId: "highestPointM", direction: "highest", group: "Geography", label: "Highest point" },
  { id: "neighborCount:highest", statId: "neighborCount", direction: "highest", group: "Geography", label: "Land borders" },
] satisfies BattleCategory[]).filter((category) => STATS[category.statId].usableIn.battle);
const BATTLE_STATS = STAT_IDS.filter((id) => BATTLE_CATEGORIES.some((category) => category.statId === id));

export type BattleLevel = "easy" | "normal" | "hard";
export type BattleSide = "player" | "opponent";
export type BattleOutcome = { round: number; categoryId: string; player: string; opponent: string; playerValue: number; opponentValue: number; winner: BattleSide | "tie" };
export type BattleState = {
  seed: string; level: BattleLevel; deck: string[]; player: string[]; opponent: string[]; discard: string[];
  rerolls: [number, number];
  round: number; categoryId: string; playerScore: number; opponentScore: number;
  /** choose → reveal (both cards on the table) → choose … → finished. */
  phase: "choose" | "reveal" | "finished"; played: BattleOutcome | null; history: BattleOutcome[];
};

export const battleCategoryById = (id: string) => BATTLE_CATEGORIES.find((category) => category.id === id)!;
/** Only countries with every battle stat are dealt, so no category can meet a blank card. */
export const battleDeckPool = (pool: readonly TrialCountry[]) => pool.filter((country) => hasStats(country, BATTLE_STATS));

/** Never the same stat twice in a row (so "Population ↓" isn't followed by "Population ↑"), nor a category from the last two rounds. */
export function drawCategory(seed: string, round: number, recent: string[]): string {
  const random = seededRandom(`${seed}:battle-category:${round}`);
  const lastStat = recent.length ? battleCategoryById(recent[recent.length - 1]).statId : null;
  return pickOne(BATTLE_CATEGORIES.filter((category) => !recent.includes(category.id) && category.statId !== lastStat), random).id;
}
/** Tops a hand back up from the deck; the deck holds each country once, so hands can never share a card. */
function refill(hand: string[], deck: string[]): [string[], string[]] {
  const missing = Math.max(0, STAT_BATTLE.handSize - hand.length);
  return [[...hand, ...deck.slice(0, missing)], deck.slice(missing)];
}

export function createBattle(pool: readonly TrialCountry[], seed: string, level: BattleLevel): BattleState {
  const deck = shuffled(battleDeckPool(pool).map((country) => country.id), seededRandom(`${seed}:battle-deck`));
  if (deck.length < STAT_BATTLE.handSize * 2) throw new Error("Not enough countries for Stat Battle.");
  const [player, afterPlayer] = refill([], deck), [opponent, rest] = refill([], afterPlayer);
  return { seed, level, deck: rest, player, opponent, discard: [], rerolls: [0, 0], round: 1, categoryId: drawCategory(seed, 1, []), playerScore: 0, opponentScore: 0, phase: "choose", played: null, history: [] };
}

export const MAX_BATTLE_REROLLS = 3;

/** Replace an entire hand. Fresh deck/discard cards are dealt first; old cards are recycled only if needed. */
export function rerollBattleHand(state: BattleState, seat: 0 | 1): BattleState {
  const used = state.rerolls ?? [0, 0];
  if (state.phase !== "choose" || used[seat] >= MAX_BATTLE_REROLLS) return state;
  const oldHand = seat === 0 ? state.player : state.opponent;
  if (!oldHand.length) return state;
  const random = seededRandom(`${state.seed}:battle-reroll:${seat}:${used[seat]}:${state.round}`);
  const available = shuffled([...state.deck, ...state.discard], random);
  const fresh = available.slice(0, oldHand.length);
  const recycled = fresh.length < oldHand.length ? shuffled(oldHand, random).slice(0, oldHand.length - fresh.length) : [];
  const hand = [...fresh, ...recycled];
  const deck = [...available.slice(oldHand.length), ...oldHand.filter((id) => !recycled.includes(id))];
  const rerolls: [number, number] = [...used];
  rerolls[seat] += 1;
  return { ...state, deck, discard: [], rerolls, ...(seat === 0 ? { player: hand } : { opponent: hand }) };
}

/**
 * Easy mostly plays at random; Normal usually picks one of its two best cards; Hard nearly always plays its best.
 * The AI sees only its own hand, never the player's choice.
 */
export function chooseOpponentCard(hand: string[], category: BattleCategory, level: BattleLevel, byId: Map<string, TrialCountry>, random: () => number): string {
  const ranked = [...hand].sort((left, right) => compareCountryStats(byId.get(right)!, byId.get(left)!, category.statId, category.direction));
  const roll = random();
  if (level === "easy") return roll < .75 ? pickOne(hand, random) : ranked[Math.min(1, ranked.length - 1)];
  if (level === "normal") return roll < .7 ? ranked[Math.floor(random() * Math.min(2, ranked.length))] : pickOne(hand, random);
  return roll < .9 ? ranked[0] : ranked[Math.min(1, ranked.length - 1)];
}

export function resolveBattle(player: TrialCountry, opponent: TrialCountry, category: BattleCategory): BattleSide | "tie" {
  const comparison = compareCountryStats(player, opponent, category.statId, category.direction);
  return comparison > 0 ? "player" : comparison < 0 ? "opponent" : "tie";
}

/** Plays a card from the player's hand. Anything but a legal play in the choose phase returns the same state. */
export function playBattleCard(state: BattleState, cardId: string, byId: Map<string, TrialCountry>): BattleState {
  if (state.phase !== "choose" || !state.player.includes(cardId)) return state;
  const category = battleCategoryById(state.categoryId);
  const opponentCard = chooseOpponentCard(state.opponent, category, state.level, byId, seededRandom(`${state.seed}:battle-ai:${state.round}`));
  return playBattleRound(state, cardId, opponentCard, byId);
}

/**
 * Puts one card from each hand on the table. Used by the AI match above and by two-player duels (hotseat and
 * online), where "player" is the first seat and "opponent" the second. Illegal plays return the same state.
 */
export function playBattleRound(state: BattleState, cardId: string, opponentCard: string, byId: Map<string, TrialCountry>): BattleState {
  if (state.phase !== "choose" || !state.player.includes(cardId) || !state.opponent.includes(opponentCard)) return state;
  const category = battleCategoryById(state.categoryId);
  const player = byId.get(cardId)!, opponent = byId.get(opponentCard)!;
  const winner = resolveBattle(player, opponent, category);
  const played: BattleOutcome = { round: state.round, categoryId: category.id, player: cardId, opponent: opponentCard, playerValue: getCountryStat(player, category.statId)!, opponentValue: getCountryStat(opponent, category.statId)!, winner };
  return {
    ...state, phase: "reveal", played, history: [...state.history, played],
    player: state.player.filter((id) => id !== cardId), opponent: state.opponent.filter((id) => id !== opponentCard),
    playerScore: state.playerScore + Number(winner === "player"), opponentScore: state.opponentScore + Number(winner === "opponent"),
  };
}

/** Discards the table, refills both hands and reveals the next category — or ends the match. */
export function advanceBattle(state: BattleState): BattleState {
  if (state.phase !== "reveal" || !state.played) return state;
  const discard = [...state.discard, state.played.player, state.played.opponent];
  const [player, afterPlayer] = refill(state.player, state.deck), [opponent, deck] = refill(state.opponent, afterPlayer);
  const finished = state.playerScore >= STAT_BATTLE.winTarget || state.opponentScore >= STAT_BATTLE.winTarget || !player.length || !opponent.length;
  if (finished) return { ...state, discard, player, opponent, deck, phase: "finished", played: null };
  const round = state.round + 1, recent = state.history.slice(-2).map((outcome) => outcome.categoryId);
  return { ...state, discard, player, opponent, deck, round, categoryId: drawCategory(state.seed, round, recent), phase: "choose", played: null };
}

export const battleWinner = (state: BattleState): BattleSide | "draw" => state.playerScore === state.opponentScore ? "draw" : state.playerScore > state.opponentScore ? "player" : "opponent";
/** Points for the personal-best board: 200 per round won plus 1,000 for winning the match. */
export const battlePoints = (state: BattleState) => state.playerScore * 200 + (state.phase === "finished" && battleWinner(state) === "player" ? 1000 : 0);
