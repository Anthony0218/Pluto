import { baseGameValue } from "./tariffs.ts";
import { chooseDocumentAiAction } from "./bot.ts";
import type { BotConfig } from "./botConfig.ts";

/** Shared, deterministic rules for long-deck Schafkopf. No browser dependencies. */
export const SUITS = ["Eichel", "Gras", "Herz", "Schellen"] as const;
export const RANKS = ["Ass", "10", "König", "Ober", "Unter", "9", "8", "7"] as const;
export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];
export type Card = { id: string; suit: Suit; rank: Rank };
export type Contract = { kind: "rufspiel" | "farbwenz" | "wenz" | "solo" | "geier" | "farbgeier" | "bettel" | "sie" | "ramsch"; suit?: Suit; tout?: boolean; calledRank?: Rank };
export type GameRules = {
  sauspiel: boolean; farbwenz: boolean; geier: boolean; farbgeier: boolean; hochzeit: boolean; bettel: boolean;
  ramsch: boolean; eichelOberMuss: boolean; legen: boolean; spritzen: "nie" | "vor-ausspiel" | "jederzeit";
  rufspielValue: number; soloValue: number; wenzValue: number; ramschValue: number;
  farbwenzValue?: number; geierValue?: number; farbgeierValue?: number; bettelValue?: number;
  schneiderValue: number; schwarzValue: number; laufendeValue: number; showPoints: boolean;
  showTrickPoints: boolean; showPlayedTrumps: boolean; bot?: Partial<BotConfig>;
  davonlaufen?: boolean; rufsauAbwerfenAbStich?: number;
  laufendeAbFarbspiel?: number; laufendeAbWenzGeier?: number; laufendeSoloLimit?: number;
  toutAbbrechen?: boolean; spritzSchwellen?: "klassisch" | "letzter-spritzer";
  toutMultiplier?: number; sieMultiplier?: number; toutSchneiderSchwarz?: boolean;
  laufendeAktiv?: boolean; klopferMussSpiel?: boolean;
  hotseatKlopfSekunden?: number; multiplayerKlopfSekunden?: number;
};
export const DEFAULT_GAME_RULES: GameRules = { sauspiel: true, farbwenz: true, geier: false, farbgeier: false, hochzeit: false, bettel: false, ramsch: false, eichelOberMuss: false, legen: false, spritzen: "jederzeit", rufspielValue: 10, soloValue: 30, wenzValue: 30, ramschValue: 10, schneiderValue: 10, schwarzValue: 10, laufendeValue: 10, showPoints: true, showTrickPoints: true, showPlayedTrumps: false, laufendeAktiv: true, klopferMussSpiel: true, hotseatKlopfSekunden: 20, multiplayerKlopfSekunden: 30, toutAbbrechen: true };
export type Play = { seat: number; card: Card };
export type Trick = { plays: Play[]; winner: number; points: number };
export type Phase = "legen" | "intent" | "auction" | "declare" | "kontra" | "re" | "play" | "trick" | "finished" | "redeal";
export type Result = {
  declarerPoints: number; opponentPoints: number; declarerWon: boolean;
  schneider: boolean; schwarz: boolean; laufende: number; value: number; deltas: number[]; team: number[];
  ramschDoubleWinners?: number[];
  ramschLosers?: number[];
};
export type RoundRecord = { round: number; dealer: number; names: string[]; contract: string; deltas: number[]; totals: number[]; price?: string };
export type GameState = {
  rulesVersion?: number;
  phase: Phase; dealer: number; turn: number; round: number; revision: number;
  names: string[]; hands: Card[][]; pendingHands: Card[][]; initialHands: Card[][]; totals: number[]; history: RoundRecord[];
  intents: number[]; declarations: number; incumbent: number; challengerIndex: number; bidLevel: number;
  contract: Contract | null; declarer: number; partner: number | null; partnerRevealed: boolean; escaped: boolean; forcedCaller: boolean; forcedCallerReason?: "eichel-ober" | "legen"; rules: GameRules;
  trick: Play[]; tricks: Trick[]; points: number[]; multiplier: number; doublingVisits: number; spritzCount: number; spritzSeats: number[]; lastSpritzTrick: number; legenDecisions: (boolean | null)[]; legenDeadline: number | null; turnDeadline: number | null;
  spritzEvents?: { seat: number; count: number; trick: number; position: number }[];
  knockSeats?: number[];
  announcements: string[]; announcementTitles?: Record<number, string>; result: Result | null;
};
export type Action = (
  | { type: "legen"; knock: boolean }
  | { type: "intent"; play: boolean; phrase?: string }
  | { type: "bid"; level: number | null; phrase?: string }
  | { type: "declare"; contract: Contract; phrase?: string }
  | { type: "double"; accept: boolean; phrase?: string }
  | { type: "play"; cardId: string; spritz?: boolean; phrase?: string }
  | { type: "collect" }
  | { type: "next" }) & { reasonCode?: string; botLevel?: AiDifficulty; debugInfo?: { candidates: string[]; rules: string[]; tips: string[]; simulations?: number } };
export type GameView = Omit<GameState, "hands" | "pendingHands" | "initialHands" | "partner"> & {
  seat: number; hand: Card[]; counts: number[]; partner: number | null;
  legalCards: string[]; locks: Record<string, string>; contracts: Contract[]; bidLevels: number[];
  canIntent: boolean; canDouble: boolean; canPassBid: boolean;
};
export type AiDifficulty = "beginner" | "amateur" | "advanced" | "pro" | "legend" | "normal";
export const AI_DIFFICULTY_OPTIONS = [
  { id: "beginner", label: "Anfänger", collectSeconds: 6 },
  { id: "amateur", label: "Amateur", collectSeconds: 5 },
  { id: "advanced", label: "Fortgeschritten", collectSeconds: 4 },
  { id: "pro", label: "Profi", collectSeconds: 3 },
  { id: "legend", label: "Legende", collectSeconds: 2 },
] as const;
export function collectSecondsFor(difficulty: AiDifficulty): number {
  return AI_DIFFICULTY_OPTIONS.find(option => option.id === difficulty)?.collectSeconds ?? 5;
}

export const POINTS: Record<Rank, number> = { Ass: 11, "10": 10, König: 4, Ober: 3, Unter: 2, "9": 0, "8": 0, "7": 0 };
export const BID_NAMES = ["", "Hochzeit", "Sauspiel", "Bettel", "Farbwenz", "Wenz", "Farbgeier", "Geier", "Solo", "Hochzeit Tout", "Sauspiel Tout", "Bettel Tout", "Farbwenz Tout", "Wenz Tout", "Farbgeier Tout", "Geier Tout", "Solo Tout", "Sie"];
export const PLAY_PHRASES = ["Ich würde", "I dad scho!", "I würd scho spuin!", "Ich würde Spielen", "Ich möchte spielen"] as const;
export const PASS_PHRASES = ["Weiter", "Weg"] as const;
export const RUF_SAU_NAMES: Record<Exclude<Suit, "Herz">, string> = {
  Eichel: "Eichel-Ass",
  Gras: "Gras-Ass",
  Schellen: "Schellen-Ass",
};
const next = (seat: number) => (seat + 1) % 4;
export const cardName = (card: Card) => `${card.suit} ${card.rank === "Ass" ? "Sau" : card.rank}`;
export function contractName(contract: Contract): string {
  if (contract.kind === "ramsch") return "Ramsch";
  if (contract.kind === "rufspiel") return `Sauspiel auf ${contract.calledRank && contract.calledRank !== "Ass" ? `${contract.suit}-${contract.calledRank}` : RUF_SAU_NAMES[contract.suit as Exclude<Suit, "Herz">]}`;
  if (contract.kind === "farbwenz" && contract.suit) return `${contract.suit}-Wenz${contract.tout ? " DU" : ""}`;
  const names = { farbwenz: "Farbwenz", wenz: "Wenz", solo: "Solo", geier: "Geier", farbgeier: "Farbgeier", bettel: "Bettel", sie: "Sie", ramsch: "Ramsch" } as const;
  return `${contract.suit ? `${contract.suit}-` : ""}${names[contract.kind]}${contract.tout ? " DU" : ""}`;
}
export function createDeck(): Card[] {
  return SUITS.flatMap(suit => RANKS.map(rank => ({ id: `${suit}-${rank}`, suit, rank })));
}
export function shuffledDeck(random: () => number = Math.random): Card[] {
  const deck = createDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
export const LEGEN_DECISION_MILLISECONDS = 20_000;
export const MULTIPLAYER_LEGEN_DECISION_MILLISECONDS = 30_000;
export const MULTIPLAYER_TURN_MILLISECONDS = 60_000;

export function createGame(names = ["Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4"], dealer = 3, deck = shuffledDeck(), totals = [0, 0, 0, 0], round = 1, rules: GameRules = DEFAULT_GAME_RULES, history: RoundRecord[] = [], now = Date.now()): GameState {
  const ids = new Set(createDeck().map(card => card.id));
  if (names.length !== 4 || totals.length !== 4 || !Number.isInteger(dealer) || dealer < 0 || dealer > 3 || deck.length !== 32 || new Set(deck.map(card => card.id)).size !== 32 || deck.some(card => !ids.has(card.id) || card.id !== `${card.suit}-${card.rank}`)) throw new Error("Ungültiges Kartenspiel.");
  const hands: Card[][] = [[], [], [], []];
  for (let packet = 0; packet < 8; packet++) hands[(dealer + 1 + packet) % 4].push(...deck.slice(packet * 4, packet * 4 + 4));
  return {
    rulesVersion: 2,
    phase: rules.legen ? "legen" : "intent", dealer, turn: next(dealer), round, revision: 0, names: [...names], hands: rules.legen ? hands.map(hand => hand.slice(0, 4)) : hands, pendingHands: rules.legen ? hands.map(hand => hand.slice(4)) : [[], [], [], []], initialHands: structuredClone(hands), totals: [...totals], history: structuredClone(history),
    intents: [], declarations: 0, incumbent: -1, challengerIndex: 1, bidLevel: 0,
    contract: null, declarer: -1, partner: null, partnerRevealed: false, escaped: false, forcedCaller: false, forcedCallerReason: undefined, rules: structuredClone(rules),
    trick: [], tricks: [], points: [0, 0, 0, 0], multiplier: 1, doublingVisits: 0, spritzCount: 0, spritzSeats: [], lastSpritzTrick: -1, legenDecisions: [null, null, null, null], legenDeadline: rules.legen ? now + (rules.hotseatKlopfSekunden ?? 20) * 1000 : null, turnDeadline: null, spritzEvents: [], knockSeats: [], announcements: [], announcementTitles: {}, result: null,
  };
}
/** Preserve saved rounds and scores while translating the former bid-rank numbering. */
export function migrateGameState(previous: GameState): GameState {
  if (previous.rulesVersion === 2) return previous;
  const state = structuredClone(previous);
  state.rulesVersion = 2;
  state.rules = {...DEFAULT_GAME_RULES,...state.rules};
  const oldRanks = [0,2,4,5,7,6,8,3,12,13,15,14,16,17];
  state.bidLevel = ['legen','intent'].includes(state.phase) ? 0 : oldRanks[state.bidLevel] ?? 0;
  return state;
}
export function contractLevel(c: Contract): number {
  if (c.kind === "sie") return 17;
  if (c.kind === "ramsch") return 0;
  const base = { rufspiel: 2, bettel: 3, farbwenz: 4, wenz: 5, farbgeier: 6, geier: 7, solo: 8 }[c.kind];
  return base + (c.tout ? 8 : 0);
}
export type GameDefinition = {
  trumps: Card[]; plainRanks: Rank[]; teamMode: "partner" | "solo" | "individual";
  laufendeMin: number; tariffClass: "rufspiel" | "wenz" | "solo" | "ramsch";
};
const VARIANTS: Record<Contract["kind"], { courts: Rank[]; color?: "Herz" | "selected"; team: GameDefinition["teamMode"]; minimum: number; tariff: GameDefinition["tariffClass"] }> = {
  rufspiel: { courts: ["Ober", "Unter"], color: "Herz", team: "partner", minimum: 3, tariff: "rufspiel" },
  ramsch: { courts: ["Ober", "Unter"], color: "Herz", team: "individual", minimum: 3, tariff: "ramsch" },
  solo: { courts: ["Ober", "Unter"], color: "selected", team: "solo", minimum: 3, tariff: "solo" },
  sie: { courts: ["Ober", "Unter"], team: "solo", minimum: 3, tariff: "solo" },
  wenz: { courts: ["Unter"], team: "solo", minimum: 2, tariff: "wenz" },
  geier: { courts: ["Ober"], team: "solo", minimum: 2, tariff: "solo" },
  farbwenz: { courts: ["Unter"], color: "selected", team: "solo", minimum: 3, tariff: "solo" },
  farbgeier: { courts: ["Ober"], color: "selected", team: "solo", minimum: 3, tariff: "solo" },
  bettel: { courts: [], team: "solo", minimum: 3, tariff: "solo" },
};
const definitionCache = new Map<string, GameDefinition>();
export function gameDefinition(contract: Contract): GameDefinition {
  const key = `${contract.kind}:${contract.suit ?? ""}`;
  const cached = definitionCache.get(key);
  if (cached) return cached;
  const variant = VARIANTS[contract.kind];
  const plainRanks = RANKS.filter(rank => !variant.courts.includes(rank));
  const color = variant.color === "selected" ? contract.suit : variant.color;
  const trumps = [
    ...variant.courts.flatMap(rank => SUITS.map(suit => ({ id: `${suit}-${rank}`, suit, rank }))),
    ...(color ? plainRanks.map(rank => ({ id: `${color}-${rank}`, suit: color, rank })) : []),
  ];
  const definition = { trumps, plainRanks, teamMode: variant.team, laufendeMin: variant.minimum, tariffClass: variant.tariff };
  definitionCache.set(key, definition);
  return definition;
}
export function isTrump(card: Card, contract: Contract): boolean {
  return gameDefinition(contract).trumps.some(trump => trump.id === card.id);
}
export function cardStrength(card: Card, contract: Contract): number {
  const { trumps } = gameDefinition(contract);
  const index = trumps.findIndex(trump => trump.id === card.id);
  return index >= 0 ? 100 - index : 20 - RANKS.indexOf(card.rank);
}
export function sortHandForContract(cards: Card[], contract: Contract | null): Card[] {
  const sortingContract: Contract = contract ?? { kind: "rufspiel" };
  return [...cards].sort((a, b) => {
    const aTrump = isTrump(a, sortingContract);
    const bTrump = isTrump(b, sortingContract);
    if (aTrump !== bTrump) return aTrump ? -1 : 1;
    if (aTrump) return cardStrength(b, sortingContract) - cardStrength(a, sortingContract);
    // In Wenz and Farbwenz, Ober follow their suit between König and 9.
    // The Ober of the Farbwenz trump suit stays in the trump block, but its
    // normal rank keeps it below every Unter.
    return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank);
  });
}
export function contractsFor(hand: Card[], rules: GameRules = DEFAULT_GAME_RULES): Contract[] {
  const contracts: Contract[] = [];
  for (const suit of SUITS) {
    if (rules.sauspiel && suit !== "Herz" && !hand.some(c => c.suit === suit && c.rank === "Ass") && hand.some(c => c.suit === suit && !isTrump(c, { kind: "rufspiel" }))) contracts.push({ kind: "rufspiel", suit }, {kind:"rufspiel",suit,tout:true});
    for (const tout of [false, true]) {
      contracts.push({ kind: "solo", suit, tout });
      if (rules.farbwenz) contracts.push({ kind: "farbwenz", suit, tout });
      if (rules.farbgeier) contracts.push({ kind: "farbgeier", suit, tout });
    }
  }
  contracts.push({ kind: "wenz", tout: false }, { kind: "wenz", tout: true });
  if (rules.geier) contracts.push({ kind: "geier", tout: false }, { kind: "geier", tout: true });
  if (rules.bettel) contracts.push({ kind: "bettel" });
  if (hand.length === 8 && hand.every(c => c.rank === "Ober" || c.rank === "Unter")) contracts.push({ kind: "sie" });
  return contracts;
}
export function forcedCallsFor(hand: Card[], rules: GameRules = DEFAULT_GAME_RULES): Contract[] {
  const suits = (["Eichel", "Gras", "Schellen"] as Suit[]).filter(suit => hand.some(card => card.suit === suit && !isTrump(card, { kind: "rufspiel" })));
  const missingAces = suits.filter(suit => !hand.some(card => card.suit === suit && card.rank === "Ass"));
  if (missingAces.length) return missingAces.map(suit => ({ kind: "rufspiel", suit, calledRank: "Ass" }));
  const calls = suits.flatMap(suit => {
    const calledRank = (["10", "König", "9", "8", "7"] as Rank[]).find(rank => !hand.some(card => card.suit === suit && card.rank === rank));
    return calledRank ? [{ kind: "rufspiel" as const, suit, calledRank }] : [];
  });
  return calls.length ? calls : contractsFor(hand, rules).filter(contract => contract.kind === "solo" && !contract.tout);
}
function forcedContracts(state: GameState, seat: number): Contract[] {
  const hand = state.hands[seat];
  // A knock is binding after four passes, but it never limits the player to a
  // partner game. They can still call a legal missing ace or choose every available
  // individual game (Solo, Wenz, Farbwenz, …).
  if (state.forcedCallerReason === "legen") {
    return contractsFor(hand, state.rules);
  }
  return forcedCallsFor(hand, state.rules);
}
const sameContract = (a: Contract, b: Contract) => a.kind === b.kind && a.suit === b.suit && Boolean(a.tout) === Boolean(b.tout) && (a.calledRank ?? "Ass") === (b.calledRank ?? "Ass");
function order(state: GameState, seat: number) { return (seat - next(state.dealer) + 4) % 4; }
export function bidLevels(state: GameState, seat: number): number[] {
  if (state.phase !== "auction" || state.turn !== seat) return [];
  const other = state.incumbent === seat ? state.intents[state.challengerIndex] : state.incumbent;
  return [...new Set(contractsFor(state.hands[seat], state.rules).map(contractLevel))].filter(level => level > state.bidLevel || level === state.bidLevel && order(state, seat) < order(state, other)).sort((a, b) => a - b);
}
export function canPassBid(state: GameState, seat: number): boolean {
  return state.phase === "auction" && state.turn === seat && state.bidLevel > 0;
}
export function declarerTeam(state: GameState): number[] {
  return state.partner === null ? [state.declarer] : [state.declarer, state.partner];
}
export function canDouble(state: GameState, seat: number): boolean {
  if (!state.contract || state.contract.kind === "sie" || state.contract.kind === "ramsch" || state.rules.spritzen === "nie") return false;
  const spritzCount = state.spritzCount ?? (state.multiplier >= 4 ? 2 : state.multiplier === 2 ? 1 : 0);
  if (state.phase !== "play" || state.turn !== seat || spritzCount > 3) return false;
  if (spritzCount === 0 && (state.tricks.length !== 0 || state.hands[seat].length !== 8) && !(["wenz", "geier"].includes(state.contract.kind) && state.tricks.length === 1)) return false;
  if (spritzCount > 0 && state.tricks.length !== (state.lastSpritzTrick ?? spritzCount - 1) + 1) return false;
  const team = declarerTeam(state).includes(seat);
  return spritzCount % 2 === 0 ? !team : team;
}

/** A reason for every forbidden card, used by both disabled buttons and the server. */
export function cardLock(state: GameState, seat: number, card: Card): string | null {
  if (state.phase !== "play" || seat !== state.turn) return "Du bist nicht am Zug.";
  const hand = state.hands[seat];
  if (!hand.some(c => c.id === card.id)) return "Diese Karte ist nicht in deiner Hand.";
  const contract = state.contract!;
  const lead = state.trick[0]?.card;
  const category = (c: Card) => isTrump(c, contract) ? "Trumpf" : c.suit;
  if (lead && category(card) !== category(lead) && hand.some(c => category(c) === category(lead))) return `${category(lead)} zugeben: Du musst bedienen.`;
  if (contract.kind === "rufspiel" && hand.some(c => c.suit === contract.suit && c.rank === (contract.calledRank ?? "Ass"))) {
    const called = card.suit === contract.suit && card.rank === (contract.calledRank ?? "Ass");
    const calledName = (contract.calledRank ?? "Ass") === "Ass" ? "Ruf-Sau" : "gerufene Karte";
    if (lead && category(lead) === contract.suit && !called && !state.escaped) return `Die ${calledName} muss zugegeben werden.`;
    if (lead && category(lead) !== contract.suit && called && !state.escaped && state.tricks.length + 1 < (state.rules.rufsauAbwerfenAbStich ?? 7) && hand.length > 1) return `Die ${calledName} darf erst nach dem Davonlaufen oder ab Stich ${state.rules.rufsauAbwerfenAbStich ?? 7} geschmiert werden.`;
    if (!lead && !state.escaped && category(card) === contract.suit && !called && (state.rules.davonlaufen === false || hand.filter(c => category(c) === contract.suit).length < 4)) return state.rules.davonlaufen === false ? "Davonlaufen ist an diesem Tisch ausgeschaltet." : `Nur die ${calledName} darf ausgespielt werden; Davonlaufen braucht mindestens vier Karten der Ruffarbe in deiner aktuellen Hand.`;
  }
  return null;
}
export function legalCards(state: GameState, seat = state.turn): Card[] {
  return state.hands[seat].filter(card => cardLock(state, seat, card) === null);
}
export function trickWinner(plays: Play[], contract: Contract): number {
  if (!plays.length) throw new Error("Leerer Stich.");
  const lead = plays[0].card;
  const value = (card: Card) => isTrump(card, contract) ? cardStrength(card, contract) + 100 : card.suit === lead.suit ? cardStrength(card, contract) : -1;
  return plays.reduce((best, play) => value(play.card) > value(best.card) ? play : best).seat;
}
/** The last Spritz party always needs 61/31; this is not a house-rule option. */
export function partyThresholds(_rules: GameRules, spritzCount: number): { playerWin: number; playerFree: number; opponentWin: number; opponentFree: number } {
  const opponentLast = spritzCount > 0 && spritzCount % 2 === 1;
  return { playerWin: opponentLast ? 60 : 61, playerFree: opponentLast ? 30 : 31, opponentWin: opponentLast ? 61 : 60, opponentFree: opponentLast ? 31 : 30 };
}
export function scoreRound(state: GameState): Result {
  const contract = state.contract!;
  const rules = state.rules ?? DEFAULT_GAME_RULES;
  if (contract.kind === "ramsch") {
    const most = Math.max(...state.points);
    const losers = state.points.flatMap((points,seat) => points === most ? [seat] : []);
    const value = rules.ramschValue * state.multiplier;
    const wonTricks = state.names.map((_, seat) => state.tricks.filter(trick => trick.winner === seat).length);
    const ramschDoubleWinners = wonTricks.flatMap((tricks, seat) => tricks === 0 && !losers.includes(seat) ? [seat] : []);
    const winnings = state.names.map((_, seat) => losers.includes(seat) ? 0 : value * (ramschDoubleWinners.includes(seat) ? 2 : 1));
    const loss = winnings.reduce((sum, amount) => sum + amount, 0);
    return { declarerPoints: most, opponentPoints: 120 - most, declarerWon: false, schneider: false, schwarz: false, laufende: 0, value, deltas: winnings.map((amount, seat) => losers.includes(seat) && loss ? -loss / losers.length : amount), team: losers, ramschLosers: losers, ramschDoubleWinners };
  }
  const team = declarerTeam(state);
  const points = team.reduce((sum, seat) => sum + state.points[seat], 0);
  const tricks = state.tricks.filter(trick => team.includes(trick.winner)).length;
  const sie = contract.kind === "sie";
  const thresholds = partyThresholds(rules,state.spritzCount ?? 0);
  const won = sie || (contract.kind === "bettel" ? tricks === 0 : contract.tout ? tricks === 8 : points >= thresholds.playerWin);
  const schwarz = !sie && contract.kind !== "bettel" && (tricks === 0 || tricks === 8);
  const schneider = !sie && contract.kind !== "bettel" && (won ? 120 - points < thresholds.opponentFree : points < thresholds.playerFree);
  const trumps = createDeck().filter(card => isTrump(card, contract)).sort((a, b) => cardStrength(b, contract) - cardStrength(a, contract));
  const owned = new Set(team.flatMap(seat => state.initialHands[seat]).map(c => c.id));
  const withTop = Boolean(trumps[0] && owned.has(trumps[0].id));
  let laufende = 0;
  for (const card of trumps) {
    if (owned.has(card.id) !== withTop) break;
    laufende++;
  }
  if (laufende < (["wenz", "geier"].includes(contract.kind) ? rules.laufendeAbWenzGeier ?? 2 : rules.laufendeAbFarbspiel ?? 3)) laufende = 0;
  if (rules.laufendeAktiv === false) laufende = 0;
  // Virtual units only: Rufspiel 1, solos 5, each bonus 1.
  const baseValue = baseGameValue(contract, rules);
  const bonusValue = laufende * (rules.laufendeValue ?? DEFAULT_GAME_RULES.laufendeValue)
    + (sie || contract.tout ? 0 : Number(schneider) * (rules.schneiderValue ?? DEFAULT_GAME_RULES.schneiderValue) + Number(schwarz) * (rules.schwarzValue ?? DEFAULT_GAME_RULES.schwarzValue));
  const value = (baseValue + bonusValue) * (sie ? 4 : contract.tout ? 2 : 1) * state.multiplier;
  const deltas = state.names.map((_, seat) => (team.includes(seat) === won ? 1 : -1) * value * (team.length === 1 && seat === state.declarer ? 3 : 1));
  return { declarerPoints: points, opponentPoints: contract.tout && rules.toutAbbrechen !== false && state.tricks.length < 8 ? state.points.reduce((sum,eyes,seat) => sum+(!team.includes(seat) ? eyes : 0),0) : 120 - points, declarerWon: won, schneider, schwarz, laufende, value, deltas, team };
}

function priceBreakdown(state: GameState, result: Result): string {
  const contract = state.contract!;
  const rules = state.rules ?? DEFAULT_GAME_RULES;
  if (contract.kind === "ramsch") return `Ramsch ${rules.ramschValue} ¢${state.multiplier > 1 ? ` × ${state.multiplier} (Klopfen/Spritzen)` : ""}${result.ramschDoubleWinners?.length ? ` · Jungfrau ×2: ${result.ramschDoubleWinners.map(seat => state.names[seat]).join(", ")}` : ""} = ${result.value} ¢`;
  const base = baseGameValue(contract, rules);
  const baseName = contract.kind === "rufspiel" ? "Sauspiel" : contract.kind === "wenz" ? "Wenz" : "Einzelspiel";
  const parts = [`${baseName} ${base} ¢`];
  if (result.laufende) parts.push(`+ ${result.laufende} Laufende × ${rules.laufendeValue} ¢`);
  if (!contract.tout && contract.kind !== "sie" && result.schneider) parts.push(`+ Schneider ${rules.schneiderValue} ¢`);
  if (!contract.tout && contract.kind !== "sie" && result.schwarz) parts.push(`+ Schwarz ${rules.schwarzValue} ¢`);
  if (contract.tout) parts.push("× 2 Tout");
  if (contract.kind === "sie") parts.push("× 4 Sie");
  if (state.multiplier > 1) parts.push(`× ${state.multiplier} Klopfen/Spritzen`);
  return `${parts.join(" ")} = ${result.value} ¢`;
}

function finish(state: GameState) {
  state.phase = "finished";
  state.result = scoreRound(state);
  if (state.contract?.kind === "ramsch") state.declarer = state.result.team[0];
  state.totals = state.totals.map((total, seat) => total + state.result!.deltas[seat]);
  (state.history ??= []).push({ round: state.round, dealer: state.dealer, names: [...state.names], contract: contractName(state.contract!), price: priceBreakdown(state, state.result), deltas: [...state.result.deltas], totals: [...state.totals] });
}
function finalDeclaration(state: GameState, seat: number) {
  state.phase = "declare";
  state.declarer = seat;
  state.turn = seat;
}
function advanceContest(state: GameState, winner: number) {
  state.incumbent = winner;
  state.challengerIndex++;
  if (state.challengerIndex >= state.intents.length) finalDeclaration(state, winner);
  else {
    state.turn = state.intents[state.challengerIndex];
  }
}

function addSecondLegenPacket(state: GameState, seat: number) {
  state.hands[seat] = [...state.hands[seat], ...(state.pendingHands?.[seat] ?? [])];
  state.pendingHands[seat] = [];
}

function finishLegen(state: GameState) {
  if (!state.legenDecisions.every(decision => decision !== null)) return;
  state.phase = "intent";
  state.turn = next(state.dealer);
  state.legenDeadline = null;
}

/** Used by local and multiplayer timers; it never exposes a pending packet. */
export function resolveLegenTimeout(previous: GameState): GameState {
  previous = migrateGameState(previous);
  if (previous.phase !== "legen") return previous;
  const state = structuredClone(previous);
  state.legenDecisions ??= [null, null, null, null];
  for (let seat = 0; seat < 4; seat++) {
    if (state.legenDecisions[seat] !== null) continue;
    state.legenDecisions[seat] = false;
    addSecondLegenPacket(state, seat);
  }
  finishLegen(state);
  state.revision++;
  return state;
}

export function applyAction(previous: GameState, seat: number, action: Action, random: () => number = Math.random): GameState {
  previous = migrateGameState(previous);
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) throw new Error("Ungültiger Sitz.");
  const concurrentLegenDecision = previous.phase === "legen" && action.type === "legen";
  if (seat !== previous.turn && action.type !== "next" && !concurrentLegenDecision) throw new Error("Du bist nicht am Zug.");
  const state = structuredClone(previous);
  const cleanPhrase = (value: unknown) => typeof value === "string" ? value.trim().replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").slice(0, 100) || null : null;
  const say = (message: string, title?: string) => { if (title) (state.announcementTitles ??= {})[state.announcements.length] = title; state.announcements.push(`${state.names[seat]}: ${message}`); };
  if (action.type === "next") {
    if (state.phase !== "finished" && state.phase !== "redeal") throw new Error("Die Runde läuft noch.");
    const game = createGame(state.names, next(state.dealer), shuffledDeck(random), state.totals, state.round + 1, state.rules, state.history ?? []);
    game.revision = previous.revision + 1;
    return game;
  } else if (action.type === "legen" && state.phase === "legen") {
    if (typeof action.knock !== "boolean") throw new Error("Ungültige Klopfentscheidung.");
    if (state.legenDeadline !== null && Date.now() >= state.legenDeadline) throw new Error("Die Klopfzeit ist abgelaufen.");
    state.legenDecisions ??= [null, null, null, null];
    if (state.legenDecisions[seat] !== null) throw new Error("Du hast bereits entschieden.");
    state.legenDecisions[seat] = action.knock;
    if (action.knock) { state.multiplier *= 2; (state.knockSeats ??= []).push(seat); say("Klopft! (1 €)"); }
    // Every player receives the remaining four cards immediately after their
    // own decision, while the other first packets remain private.
    addSecondLegenPacket(state, seat);
    state.turn = next(seat);
    finishLegen(state);
  } else if (action.type === "intent" && state.phase === "intent") {
    if (typeof action.play !== "boolean") throw new Error("Ungültige Ansage.");
    if (action.play) {
      if (!contractsFor(state.hands[seat], state.rules).length) throw new Error("Keine gültige Spielabsicht.");
      state.intents.push(seat);
    }
    const phrase = cleanPhrase(action.phrase) ?? (action.play ? PLAY_PHRASES[Math.floor(random() * PLAY_PHRASES.length)] : PASS_PHRASES[Math.floor(random() * PASS_PHRASES.length)]);
    say(`${phrase}${/[.!]$/.test(phrase) ? "" : "."}`);
    state.declarations++;
    state.turn = next(seat);
    if (state.declarations === 4) {
      if (!state.intents.length) {
        // The final knock is binding when more than one player knocked.
        const knockedSeat = state.knockSeats?.at(-1) ?? Array.from({ length: 4 }, (_, offset) => (next(state.dealer) + offset) % 4).findLast(candidate => state.legenDecisions?.[candidate]);
        if (knockedSeat !== undefined && state.rules.klopferMussSpiel !== false) {
          state.forcedCaller = true;
          state.forcedCallerReason = "legen";
          finalDeclaration(state, knockedSeat);
          say(`${state.names[state.declarer]} hat geklopft und muss nach viermal Weiter spielen.`);
        }
        else if (state.rules.eichelOberMuss) { state.forcedCaller = true; state.forcedCallerReason = "eichel-ober"; finalDeclaration(state, state.hands.findIndex(hand => hand.some(card => card.id === "Eichel-Ober"))); say(`${state.names[state.declarer]} mit dem Eichel-Ober muss spielen.`); }
        else if (state.rules.ramsch) { state.contract = { kind: "ramsch" }; state.phase = "play"; state.turn = next(state.dealer); say("Ramsch!"); }
        else { state.phase = "redeal"; (state.history ??= []).push({ round: state.round, dealer: state.dealer, names: [...state.names], contract: "Alle weiter", price: "Keine Wertung", deltas: [0, 0, 0, 0], totals: [...state.totals] }); }
      }
      else if (state.intents.length === 1) finalDeclaration(state, state.intents[0]);
      else {
        state.phase = "auction";
        state.incumbent = state.intents[0];
        state.turn = state.intents[0];
      }
    }
  } else if (action.type === "bid" && state.phase === "auction") {
    if (action.level === null) {
      if (!canPassBid(state, seat)) throw new Error("Deine Spielabsicht ist verbindlich. Nenne zuerst mindestens deinen erforderlichen Spielrang.");
      const phrase = cleanPhrase(action.phrase) ?? PASS_PHRASES[Math.floor(random() * PASS_PHRASES.length)];
      say(`${phrase}.`);
      advanceContest(state, seat === state.incumbent ? state.intents[state.challengerIndex] : state.incumbent);
    } else {
      if (!bidLevels(state, seat).includes(action.level)) throw new Error("Dieses Gebot ist nicht zulässig.");
      state.bidLevel = action.level;
      const phrase = cleanPhrase(action.phrase);
      say(phrase ? phrase.includes("{Gebot}") ? phrase.replaceAll("{Gebot}", BID_NAMES[action.level]) : `${phrase} (${BID_NAMES[action.level]})` : `Mindestens ${BID_NAMES[action.level]}.`);
      state.turn = seat === state.incumbent ? state.intents[state.challengerIndex] : state.incumbent;
    }
  } else if (action.type === "declare" && state.phase === "declare") {
    const contract = (state.forcedCaller ? forcedContracts(state, seat) : contractsFor(state.hands[seat], state.rules)).find(c => sameContract(c, action.contract) && contractLevel(c) >= state.bidLevel);
    if (!contract) throw new Error("Dieses Spiel kannst du nicht ansagen.");
    state.contract = contract;
    state.partner = contract.kind === "rufspiel" ? state.hands.findIndex(hand => hand.some(c => c.suit === contract.suit && c.rank === (contract.calledRank ?? "Ass"))) : null;
    say(cleanPhrase(action.phrase) ?? contractName(contract), contract.kind === "rufspiel" && (contract.calledRank ?? "Ass") === "Ass" ? RUF_SAU_NAMES[contract.suit as Exclude<Suit, "Herz">] : contractName(contract));
    if (contract.kind === "sie") { state.points[seat] = 120; finish(state); }
    else { state.phase = "play"; state.turn = next(state.dealer); }
  } else if (action.type === "double" && ["kontra", "re"].includes(state.phase)) {
    if (typeof action.accept !== "boolean") throw new Error("Ungültige Ansage.");
    if (action.accept) {
      if (!canDouble(state, seat)) throw new Error("Kontra/Re ist jetzt nicht zulässig.");
      say(cleanPhrase(action.phrase) ?? (state.spritzCount === 0 ? "Kontra!" : "Re!"));
      state.multiplier *= 2;
      state.spritzCount = (state.spritzCount ?? 0) + 1;
      (state.spritzEvents ??= []).push({ seat, count: state.spritzCount, trick: state.tricks.length, position: state.trick.length });
      if (!(state.spritzSeats ??= []).includes(seat)) state.spritzSeats.push(seat);
    }
    state.doublingVisits++;
    state.turn = next(seat);
    if (state.doublingVisits === 4) {
      state.phase = state.phase === "kontra" && state.multiplier === 2 ? "re" : "play";
      state.doublingVisits = 0;
      state.turn = next(state.dealer);
    }
  } else if (action.type === "play" && state.phase === "play") {
    const card = state.hands[seat].find(c => c.id === action.cardId);
    if (!card) throw new Error("Diese Karte ist nicht in deiner Hand.");
    const reason = cardLock(state, seat, card);
    if (reason) throw new Error(reason);
    if (action.spritz) {
      if (!canDouble(state, seat)) throw new Error("Spritzen ist bei diesem Zug nicht möglich.");
      say(cleanPhrase(action.phrase) ?? ["I geb a Spritzn!", "Re!", "Sub!", "Hirsch!"][state.spritzCount]);
      state.multiplier *= 2;
      state.lastSpritzTrick = state.tricks.length;
      state.spritzCount = (state.spritzCount ?? 0) + 1;
      (state.spritzEvents ??= []).push({ seat, count: state.spritzCount, trick: state.tricks.length, position: state.trick.length });
      if (!(state.spritzSeats ??= []).includes(seat)) state.spritzSeats.push(seat);
    }
    const contract = state.contract!;
    if (contract.kind === "rufspiel" && seat === state.partner) {
      if (!state.trick.length && card.suit === contract.suit && !isTrump(card, contract) && card.rank !== (contract.calledRank ?? "Ass") && !state.escaped && state.hands[seat].some(c => c.suit === contract.suit && c.rank === (contract.calledRank ?? "Ass"))) {
        state.escaped = true;
        state.partnerRevealed = true;
        say("Davongelaufen.");
      }
      if (card.suit === contract.suit && card.rank === (contract.calledRank ?? "Ass")) state.partnerRevealed = true;
    }
    state.hands[seat] = state.hands[seat].filter(c => c.id !== card.id);
    state.trick.push({ seat, card });
    state.turn = next(seat);
    if (state.trick.length === 4) {
      const winner = trickWinner(state.trick, contract);
      const points = state.trick.reduce((sum, play) => sum + POINTS[play.card.rank], 0);
      state.tricks.push({ plays: [...state.trick], winner, points });
      state.points[winner] += points;
      state.turn = winner;
      state.phase = "trick";
    }
  } else if (action.type === "collect" && state.phase === "trick") {
    state.trick = [];
    if (state.tricks.length === 8 || state.rules.toutAbbrechen !== false && state.contract?.tout && state.tricks.some(trick => !declarerTeam(state).includes(trick.winner))) finish(state);
    else state.phase = "play";
  } else throw new Error("Diese Aktion ist in dieser Phase nicht zulässig.");
  state.revision++;
  return state;
}

/** Explicit allowlist: never serialize opponents' hands or the hidden partner. */
export function viewFor(state: GameState, seat: number): GameView {
  state = migrateGameState(state);
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) throw new Error("Ungültiger Sitz.");
  const hand = state.hands[seat];
  return structuredClone({
    rulesVersion: state.rulesVersion,
    phase: state.phase, dealer: state.dealer, turn: state.turn, round: state.round, revision: state.revision,
    names: state.names, totals: state.totals, history: state.history ?? [], intents: state.intents, declarations: state.declarations,
    incumbent: state.incumbent, challengerIndex: state.challengerIndex, bidLevel: state.bidLevel,
    contract: state.contract, declarer: state.declarer,
    partner: state.partnerRevealed || state.phase === "finished" || seat === state.partner ? state.partner : null,
    partnerRevealed: state.partnerRevealed, escaped: state.escaped, forcedCaller: state.forcedCaller ?? false, forcedCallerReason: state.forcedCallerReason, trick: state.trick,
    tricks: state.tricks, points: state.points, multiplier: state.multiplier, doublingVisits: state.doublingVisits,
    spritzCount: state.spritzCount ?? 0, spritzSeats: state.spritzSeats ?? [], lastSpritzTrick: state.lastSpritzTrick ?? -1, legenDecisions: state.legenDecisions ?? [null, null, null, null], legenDeadline: state.legenDeadline ?? null, turnDeadline: state.turnDeadline ?? null,
    spritzEvents: state.spritzEvents ?? [], knockSeats: state.knockSeats ?? [], announcements: state.announcements, announcementTitles: state.announcementTitles ?? {}, result: state.result, seat, hand, counts: state.hands.map(h => h.length),
    legalCards: legalCards(state, seat).map(c => c.id),
    locks: Object.fromEntries(hand.flatMap(card => { const reason = cardLock(state, seat, card); return reason ? [[card.id, reason]] : []; })),
    rules: state.rules, contracts: (state.forcedCaller ? forcedContracts(state, seat) : contractsFor(hand, state.rules)).filter(c => contractLevel(c) >= state.bidLevel), bidLevels: bidLevels(state, seat),
    canIntent: contractsFor(hand, state.rules).length > 0, canDouble: canDouble(state, seat), canPassBid: canPassBid(state, seat),
  });
}

export function shouldAiKnock(hand: Card[], priorKnocks = 0): boolean {
  if (hand.length !== 4) return false;
  const unter = hand.filter(card => card.rank === "Unter");
  const courts = hand.filter(card => card.rank === "Ober" || card.rank === "Unter");
  if (priorKnocks > 0) return courts.length >= 3;
  const contract: Contract = {kind:"rufspiel"};
  const trumps = hand.filter(card => isTrump(card,contract));
  const topSix = gameDefinition(contract).trumps.slice(0,6);
  if (trumps.length === 4 && trumps.some(card => topSix.some(high => high.id === card.id))) return true;
  const bremser = hand.some(card => card.rank === "Ober" && card.suit !== "Schellen");
  if (trumps.length >= 3 && bremser) return true;
  const heart = hand.some(card => card.suit === "Herz" && card.rank !== "Ober" && card.rank !== "Unter");
  const sameSuitPair = SUITS.some(suit => hand.filter(card => card.suit === suit).length >= 2);
  return unter.length >= 2 && (heart || sameSuitPair);
}

/** Bot input is deliberately restricted to the redacted player view. */
export function chooseAiAction(view: GameView, difficulty: AiDifficulty = "normal", random: () => number = Math.random): Action {
  return chooseDocumentAiAction(view, difficulty, random);
}
