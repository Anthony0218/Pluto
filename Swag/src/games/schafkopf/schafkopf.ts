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
  schneiderValue: number; schwarzValue: number; laufendeValue: number; showPoints: boolean;
  showTrickPoints: boolean; showPlayedTrumps: boolean;
};
export const DEFAULT_GAME_RULES: GameRules = { sauspiel: true, farbwenz: true, geier: false, farbgeier: false, hochzeit: false, bettel: false, ramsch: false, eichelOberMuss: false, legen: false, spritzen: "jederzeit", rufspielValue: 10, soloValue: 30, wenzValue: 30, ramschValue: 10, schneiderValue: 10, schwarzValue: 10, laufendeValue: 10, showPoints: true, showTrickPoints: true, showPlayedTrumps: false };
export type Play = { seat: number; card: Card };
export type Trick = { plays: Play[]; winner: number; points: number };
export type Phase = "legen" | "intent" | "auction" | "declare" | "kontra" | "re" | "play" | "trick" | "finished" | "redeal";
export type Result = {
  declarerPoints: number; opponentPoints: number; declarerWon: boolean;
  schneider: boolean; schwarz: boolean; laufende: number; value: number; deltas: number[]; team: number[];
  ramschDoubleWinners?: number[];
};
export type RoundRecord = { round: number; dealer: number; names: string[]; contract: string; deltas: number[]; totals: number[]; price?: string };
export type GameState = {
  phase: Phase; dealer: number; turn: number; round: number; revision: number;
  names: string[]; hands: Card[][]; pendingHands: Card[][]; initialHands: Card[][]; totals: number[]; history: RoundRecord[];
  intents: number[]; declarations: number; incumbent: number; challengerIndex: number; bidLevel: number;
  contract: Contract | null; declarer: number; partner: number | null; partnerRevealed: boolean; escaped: boolean; forcedCaller: boolean; forcedCallerReason?: "eichel-ober" | "legen"; rules: GameRules;
  trick: Play[]; tricks: Trick[]; points: number[]; multiplier: number; doublingVisits: number; spritzCount: number; spritzSeats: number[]; lastSpritzTrick: number; legenDecisions: (boolean | null)[]; legenDeadline: number | null; turnDeadline: number | null;
  announcements: string[]; announcementTitles?: Record<number, string>; result: Result | null;
};
export type Action =
  | { type: "legen"; knock: boolean }
  | { type: "intent"; play: boolean; phrase?: string }
  | { type: "bid"; level: number | null; phrase?: string }
  | { type: "declare"; contract: Contract; phrase?: string }
  | { type: "double"; accept: boolean; phrase?: string }
  | { type: "play"; cardId: string; spritz?: boolean; phrase?: string }
  | { type: "collect" }
  | { type: "next" };
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
export const BID_NAMES = ["", "Rufspiel", "Farbwenz", "Wenz", "Geier", "Farbgeier", "Solo", "Bettel", "Farbwenz Tout", "Wenz Tout", "Geier Tout", "Farbgeier Tout", "Solo Tout", "Sie"];
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
export const LEGEN_DECISION_MILLISECONDS = 15_000;
export const MULTIPLAYER_LEGEN_DECISION_MILLISECONDS = 20_000;
export const MULTIPLAYER_TURN_MILLISECONDS = 60_000;

export function createGame(names = ["Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4"], dealer = 3, deck = shuffledDeck(), totals = [0, 0, 0, 0], round = 1, rules: GameRules = DEFAULT_GAME_RULES, history: RoundRecord[] = [], now = Date.now()): GameState {
  const ids = new Set(createDeck().map(card => card.id));
  if (names.length !== 4 || totals.length !== 4 || !Number.isInteger(dealer) || dealer < 0 || dealer > 3 || deck.length !== 32 || new Set(deck.map(card => card.id)).size !== 32 || deck.some(card => !ids.has(card.id) || card.id !== `${card.suit}-${card.rank}`)) throw new Error("Ungültiges Kartenspiel.");
  const hands: Card[][] = [[], [], [], []];
  for (let packet = 0; packet < 8; packet++) hands[(dealer + 1 + packet) % 4].push(...deck.slice(packet * 4, packet * 4 + 4));
  return {
    phase: rules.legen ? "legen" : "intent", dealer, turn: next(dealer), round, revision: 0, names: [...names], hands: rules.legen ? hands.map(hand => hand.slice(0, 4)) : hands, pendingHands: rules.legen ? hands.map(hand => hand.slice(4)) : [[], [], [], []], initialHands: structuredClone(hands), totals: [...totals], history: structuredClone(history),
    intents: [], declarations: 0, incumbent: -1, challengerIndex: 1, bidLevel: 1,
    contract: null, declarer: -1, partner: null, partnerRevealed: false, escaped: false, forcedCaller: false, forcedCallerReason: undefined, rules: structuredClone(rules),
    trick: [], tricks: [], points: [0, 0, 0, 0], multiplier: 1, doublingVisits: 0, spritzCount: 0, spritzSeats: [], lastSpritzTrick: -1, legenDecisions: [null, null, null, null], legenDeadline: rules.legen ? now + LEGEN_DECISION_MILLISECONDS : null, turnDeadline: null, announcements: [], announcementTitles: {}, result: null,
  };
}
export function contractLevel(c: Contract): number {
  if (c.kind === "sie") return 13;
  if (c.kind === "ramsch") return 0;
  const base = { rufspiel: 1, farbwenz: 2, wenz: 3, geier: 4, farbgeier: 5, solo: 6, bettel: 7 }[c.kind];
  if (!c.tout) return base;
  const tout = { farbwenz: 8, wenz: 9, geier: 10, farbgeier: 11, solo: 12 } as const;
  return c.kind in tout ? tout[c.kind as keyof typeof tout] : base;
}
export function isTrump(card: Card, contract: Contract): boolean {
  if (contract.kind === "bettel") return false;
  const usesOber = ["rufspiel", "ramsch", "solo", "sie", "geier", "farbgeier"].includes(contract.kind);
  const usesUnter = ["rufspiel", "ramsch", "solo", "sie", "wenz", "farbwenz"].includes(contract.kind);
  if ((usesOber && card.rank === "Ober") || (usesUnter && card.rank === "Unter")) return true;
  if (["rufspiel", "ramsch", "solo", "farbwenz", "farbgeier"].includes(contract.kind)) return card.suit === (["rufspiel", "ramsch"].includes(contract.kind) ? "Herz" : contract.suit);
  return false;
}
export function cardStrength(card: Card, contract: Contract): number {
  if (isTrump(card, contract)) {
    const oberIsTopTrump = ["rufspiel", "ramsch", "solo", "sie", "geier", "farbgeier"].includes(contract.kind);
    const unterIsTopTrump = ["rufspiel", "ramsch", "solo", "sie", "wenz", "farbwenz"].includes(contract.kind);
    if (card.rank === "Ober" && oberIsTopTrump) return 100 - SUITS.indexOf(card.suit);
    if (card.rank === "Unter" && unterIsTopTrump) return 90 - SUITS.indexOf(card.suit);
    return 70 - RANKS.indexOf(card.rank);
  }
  return 20 - RANKS.indexOf(card.rank);
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
    if (rules.sauspiel && suit !== "Herz" && !hand.some(c => c.suit === suit && c.rank === "Ass") && hand.some(c => c.suit === suit && !isTrump(c, { kind: "rufspiel" }))) contracts.push({ kind: "rufspiel", suit });
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
  // partner game. They can still call a legal card or choose every available
  // individual game (Solo, Wenz, Farbwenz, …).
  if (state.forcedCallerReason === "legen") {
    const individualGames = contractsFor(hand, state.rules).filter(contract => contract.kind !== "rufspiel");
    return [...forcedCallsFor(hand, state.rules), ...individualGames];
  }
  return forcedCallsFor(hand, state.rules);
}
const sameContract = (a: Contract, b: Contract) => a.kind === b.kind && a.suit === b.suit && Boolean(a.tout) === Boolean(b.tout) && (a.calledRank ?? "Ass") === (b.calledRank ?? "Ass");
function order(state: GameState, seat: number) { return (seat - next(state.dealer) + 4) % 4; }
export function bidLevels(state: GameState, seat: number): number[] {
  if (state.phase !== "auction" || state.turn !== seat) return [];
  const other = state.incumbent === seat ? state.intents[state.challengerIndex] : state.incumbent;
  return [...new Set(contractsFor(state.hands[seat], state.rules).map(contractLevel))].filter(level => level >= state.intents.indexOf(seat) + 1 && (level > state.bidLevel || (level === state.bidLevel && order(state, seat) < order(state, other)))).sort((a, b) => a - b);
}
export function canPassBid(state: GameState, seat: number): boolean {
  return state.phase === "auction" && state.turn === seat && (seat === state.incumbent || state.bidLevel >= state.intents.indexOf(seat) + 1);
}
export function declarerTeam(state: GameState): number[] {
  return state.partner === null ? [state.declarer] : [state.declarer, state.partner];
}
export function canDouble(state: GameState, seat: number): boolean {
  if (!state.contract || state.contract.kind === "sie" || state.contract.kind === "ramsch" || state.rules.spritzen === "nie") return false;
  const spritzCount = state.spritzCount ?? (state.multiplier >= 4 ? 2 : state.multiplier === 2 ? 1 : 0);
  if (state.phase !== "play" || state.turn !== seat || spritzCount > 3) return false;
  if (spritzCount === 0 && (state.tricks.length !== 0 || state.hands[seat].length !== 8)) return false;
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
    if (lead && category(lead) === contract.suit && !called) return `Die ${calledName} muss zugegeben werden.`;
    if (lead && category(lead) !== contract.suit && called && !state.escaped && state.tricks.length < 6 && hand.length > 1) return `Die ${calledName} darf erst nach dem Davonlaufen oder ab dem vorletzten Stich geschmiert werden.`;
    if (!lead && category(card) === contract.suit && !called && hand.filter(c => category(c) === contract.suit).length < 4) return `Nur die ${calledName} darf ausgespielt werden; Davonlaufen braucht mindestens vier Karten der Ruffarbe in deiner aktuellen Hand.`;
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
export function scoreRound(state: GameState): Result {
  const contract = state.contract!;
  const rules = state.rules ?? DEFAULT_GAME_RULES;
  if (contract.kind === "ramsch") {
    const loser = state.points.indexOf(Math.max(...state.points));
    const value = rules.ramschValue * state.multiplier;
    const wonTricks = state.names.map((_, seat) => state.tricks.filter(trick => trick.winner === seat).length);
    const ramschDoubleWinners = wonTricks.flatMap((tricks, seat) => tricks === 0 && seat !== loser ? [seat] : []);
    const winnings = state.names.map((_, seat) => seat === loser ? 0 : value * (ramschDoubleWinners.includes(seat) ? 2 : 1));
    const loss = winnings.reduce((sum, amount) => sum + amount, 0);
    return { declarerPoints: state.points[loser], opponentPoints: 120 - state.points[loser], declarerWon: false, schneider: false, schwarz: false, laufende: 0, value, deltas: winnings.map((amount, seat) => seat === loser ? -loss : amount), team: [loser], ramschDoubleWinners };
  }
  const team = declarerTeam(state);
  const points = team.reduce((sum, seat) => sum + state.points[seat], 0);
  const tricks = state.tricks.filter(trick => team.includes(trick.winner)).length;
  const sie = contract.kind === "sie";
  const won = sie || (contract.kind === "bettel" ? tricks === 0 : contract.tout ? tricks === 8 : points >= 61);
  const schwarz = !sie && contract.kind !== "bettel" && (tricks === 0 || tricks === 8);
  const schneider = !sie && contract.kind !== "bettel" && (won ? points >= 91 : points <= 30);
  const trumps = createDeck().filter(card => isTrump(card, contract)).sort((a, b) => cardStrength(b, contract) - cardStrength(a, contract));
  const owned = new Set(team.flatMap(seat => state.initialHands[seat]).map(c => c.id));
  const withTop = owned.has(trumps[0].id);
  let laufende = 0;
  const cap = contract.kind === "rufspiel" ? 14 : ["wenz", "geier"].includes(contract.kind) ? 4 : 8;
  for (const card of trumps.slice(0, cap)) {
    if (owned.has(card.id) !== withTop) break;
    laufende++;
  }
  if (laufende < (["wenz", "geier"].includes(contract.kind) ? 2 : 3)) laufende = 0;
  // Virtual units only: Rufspiel 1, solos 5, each bonus 1.
  const baseValue = contract.kind === "rufspiel" ? rules.rufspielValue : contract.kind === "wenz" ? rules.wenzValue : rules.soloValue;
  const bonusValue = laufende * (rules.laufendeValue ?? DEFAULT_GAME_RULES.laufendeValue)
    + (contract.tout || sie ? 0 : Number(schneider) * (rules.schneiderValue ?? DEFAULT_GAME_RULES.schneiderValue) + Number(schwarz) * (rules.schwarzValue ?? DEFAULT_GAME_RULES.schwarzValue));
  const value = (baseValue + bonusValue) * (sie ? 4 : contract.tout ? 2 : 1) * state.multiplier;
  const deltas = state.names.map((_, seat) => (team.includes(seat) === won ? 1 : -1) * value * (team.length === 1 && seat === state.declarer ? 3 : 1));
  return { declarerPoints: points, opponentPoints: 120 - points, declarerWon: won, schneider, schwarz, laufende, value, deltas, team };
}

function priceBreakdown(state: GameState, result: Result): string {
  const contract = state.contract!;
  const rules = state.rules ?? DEFAULT_GAME_RULES;
  if (contract.kind === "ramsch") return `Ramsch ${rules.ramschValue} ¢${state.multiplier > 1 ? ` × ${state.multiplier} (Klopfen/Spritzen)` : ""}${result.ramschDoubleWinners?.length ? ` · Jungfrau ×2: ${result.ramschDoubleWinners.map(seat => state.names[seat]).join(", ")}` : ""} = ${result.value} ¢`;
  const base = contract.kind === "rufspiel" ? rules.rufspielValue : contract.kind === "wenz" ? rules.wenzValue : rules.soloValue;
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
    if (action.knock) { state.multiplier *= 2; say("Klopft! (1 €)"); }
    // Every player receives the remaining four cards immediately after their
    // own decision, while the other first packets remain private.
    addSecondLegenPacket(state, seat);
    state.turn = next(seat);
    finishLegen(state);
  } else if (action.type === "intent" && state.phase === "intent") {
    if (typeof action.play !== "boolean") throw new Error("Ungültige Ansage.");
    if (action.play) {
      if (!contractsFor(state.hands[seat], state.rules).some(c => contractLevel(c) >= state.intents.length + 1)) throw new Error("Keine gültige Spielabsicht.");
      state.intents.push(seat);
    }
    const phrase = cleanPhrase(action.phrase) ?? (action.play ? PLAY_PHRASES[Math.floor(random() * PLAY_PHRASES.length)] : PASS_PHRASES[Math.floor(random() * PASS_PHRASES.length)]);
    say(`${phrase}${/[.!]$/.test(phrase) ? "" : "."}`);
    state.declarations++;
    state.turn = next(seat);
    if (state.declarations === 4) {
      if (!state.intents.length) {
        // The final knock is binding when more than one player knocked.
        const knockedSeat = Array.from({ length: 4 }, (_, offset) => (next(state.dealer) + offset) % 4).findLast(candidate => state.legenDecisions?.[candidate]);
        if (knockedSeat !== undefined) {
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
        state.turn = state.intents[1];
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
    if (state.tricks.length === 8) finish(state);
    else state.phase = "play";
  } else throw new Error("Diese Aktion ist in dieser Phase nicht zulässig.");
  state.revision++;
  return state;
}

/** Explicit allowlist: never serialize opponents' hands or the hidden partner. */
export function viewFor(state: GameState, seat: number): GameView {
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) throw new Error("Ungültiger Sitz.");
  const hand = state.hands[seat];
  return structuredClone({
    phase: state.phase, dealer: state.dealer, turn: state.turn, round: state.round, revision: state.revision,
    names: state.names, totals: state.totals, history: state.history ?? [], intents: state.intents, declarations: state.declarations,
    incumbent: state.incumbent, challengerIndex: state.challengerIndex, bidLevel: state.bidLevel,
    contract: state.contract, declarer: state.declarer,
    partner: state.partnerRevealed || state.phase === "finished" || seat === state.partner ? state.partner : null,
    partnerRevealed: state.partnerRevealed, escaped: state.escaped, forcedCaller: state.forcedCaller ?? false, forcedCallerReason: state.forcedCallerReason, trick: state.trick,
    tricks: state.tricks, points: state.points, multiplier: state.multiplier, doublingVisits: state.doublingVisits,
    spritzCount: state.spritzCount ?? 0, spritzSeats: state.spritzSeats ?? [], lastSpritzTrick: state.lastSpritzTrick ?? -1, legenDecisions: state.legenDecisions ?? [null, null, null, null], legenDeadline: state.legenDeadline ?? null, turnDeadline: state.turnDeadline ?? null,
    announcements: state.announcements, announcementTitles: state.announcementTitles ?? {}, result: state.result, seat, hand, counts: state.hands.map(h => h.length),
    legalCards: legalCards(state, seat).map(c => c.id),
    locks: Object.fromEntries(hand.flatMap(card => { const reason = cardLock(state, seat, card); return reason ? [[card.id, reason]] : []; })),
    rules: state.rules, contracts: (state.forcedCaller ? forcedContracts(state, seat) : contractsFor(hand, state.rules)).filter(c => contractLevel(c) >= state.bidLevel), bidLevels: bidLevels(state, seat),
    canIntent: contractsFor(hand, state.rules).some(c => contractLevel(c) >= state.intents.length + 1), canDouble: canDouble(state, seat), canPassBid: canPassBid(state, seat),
  });
}

export function shouldAiKnock(hand: Card[]): boolean {
  if (hand.length !== 4) return false;
  const ober = hand.filter(card => card.rank === "Ober");
  const unter = hand.filter(card => card.rank === "Unter");
  const heartSuit = hand.filter(card => card.suit === "Herz" && card.rank !== "Ober" && card.rank !== "Unter");
  const eligible = unter.length >= 3 || ober.length >= 2 || (unter.length >= 2 && ober.length >= 1)
    || (unter.length >= 1 && ober.length >= 1 && heartSuit.length >= 1);
  if (!eligible) return false;
  const topTrumps = [...SUITS.map(suit => `${suit}-Ober`), ...SUITS.map(suit => `${suit}-Unter`)];
  const held = new Set(hand.map(card => card.id));
  let laufende = 0;
  for (const id of topTrumps) { if (!held.has(id)) break; laufende++; }
  const highOber = ober.filter(card => card.suit === "Eichel" || card.suit === "Gras").length;
  const highUnter = unter.filter(card => card.suit === "Eichel" || card.suit === "Gras").length;
  const quality = highOber * 2 + highUnter + Math.min(laufende, 2) * 2 + heartSuit.length;
  return quality >= (unter.length >= 3 || ober.length >= 2 || (unter.length >= 2 && ober.length >= 1) ? 2 : 3);
}

/** The AI uses only its private view and public tricks. Random errors always remain legal. */
function chooseAiMove(view: GameView, difficulty: AiDifficulty = "normal", random: () => number = Math.random): Action {
  const errorRate = { beginner: 0.35, amateur: 0.12, advanced: 0.045, normal: 0.025, pro: 0.008, legend: 0 }[difficulty];
  const countsOwnPoints = difficulty !== "beginner";
  const countsFallenTrumps = difficulty === "pro" || difficulty === "legend";
  const plansAhead = difficulty === "pro" || difficulty === "legend";
  const trumpPower = (card: Card, contract: Contract) => {
    if (!isTrump(card, contract)) return 0;
    if (card.rank === "Ober" && contract.kind !== "wenz" && contract.kind !== "farbwenz") return 2.3 - SUITS.indexOf(card.suit) * 0.2;
    if (card.rank === "Unter") return 1.9 - SUITS.indexOf(card.suit) * 0.18;
    return 0.35;
  };
  const strength = (contract: Contract) => {
    if (contract.kind === "sie") return 100;
    const trumps = view.hand.filter(card => isTrump(card, contract));
    const aces = view.hand.filter(card => !isTrump(card, contract) && card.rank === "Ass").length;
    const tens = view.hand.filter(card => !isTrump(card, contract) && card.rank === "10").length;
    const trumpSmear = trumps.reduce((sum, card) => sum + (["Ass", "10"].includes(card.rank) ? POINTS[card.rank] : 0), 0);
    const power = trumps.reduce((sum, card) => sum + trumpPower(card, contract), 0);
    const base = trumps.length * (contract.kind === "rufspiel" ? 1 : 1.3) + power + aces * 1.35 + tens * 0.25;
    return base + (contract.kind === "rufspiel" ? 2.8 : -2.5) + (contract.kind === "solo" || contract.kind === "farbwenz" ? trumpSmear / 12 : 0) - (contract.tout ? 9 : 0);
  };
  const viable = (contract: Contract) => {
    if (contract.kind === "sie") return true;
    const trumps = view.hand.filter(card => isTrump(card, contract));
    const aces = view.hand.filter(card => !isTrump(card, contract) && card.rank === "Ass").length;
    if (contract.kind === "rufspiel") {
      const highTrumps = trumps.filter(card => card.rank === "Ober" || card.rank === "Unter");
      const oberCount = highTrumps.filter(card => card.rank === "Ober").length;
      const missingAces = (["Eichel", "Gras", "Schellen"] as Suit[]).filter(suit => view.hand.some(card => card.suit === suit && !isTrump(card, contract)) && !view.hand.some(card => card.suit === suit && card.rank === "Ass")).length;
      if (missingAces >= 2 || oberCount === 0) return false;
      if (trumps.length >= 5) return true;
      if (trumps.length === 4) return highTrumps.length >= 2;
      return trumps.length === 3 && view.seat === view.dealer && !view.rules.ramsch && highTrumps.length >= 2 && aces >= 1;
    }
    if (contract.kind === "bettel") return view.hand.filter(card => POINTS[card.rank] === 0).length >= 5;
    const trumpOrder = createDeck().filter(card => isTrump(card, contract)).sort((a, b) => cardStrength(b, contract) - cardStrength(a, contract));
    const topCount = (limit: number) => trumps.filter(card => trumpOrder.findIndex(trump => trump.id === card.id) < limit).length;
    if (contract.kind === "wenz" || contract.kind === "geier") {
      if (contract.tout) return trumps.length === 4 && aces >= 2;
      return trumps.length === 4 || (topCount(3) === 3 && aces >= 1);
    }
    if (contract.kind === "farbwenz" || contract.kind === "farbgeier") {
      const trumpSmear = trumps.reduce((sum, card) => sum + (["Ass", "10"].includes(card.rank) ? POINTS[card.rank] : 0), 0);
      const strong = topCount(6) >= 4 && aces >= 1 && trumpSmear >= 11;
      const solid = topCount(8) >= 5 && trumps.length >= 6 && trumpSmear >= 10;
      return contract.tout ? strong && trumps.length >= 7 : strong || solid;
    }
    const trumpSmear = trumps.reduce((sum, card) => sum + (["Ass", "10"].includes(card.rank) ? POINTS[card.rank] : 0), 0);
    const strong = trumps.length >= 6 && (topCount(8) >= 6 || (topCount(8) >= 5 && trumpSmear >= 10));
    const solid = trumps.length >= 7 && topCount(11) >= 7;
    return contract.tout ? strong && trumps.length >= 7 && aces >= 1 : strong || solid;
  };
  const ranked = (minimumLevel: number) => view.contracts.filter(contract => contractLevel(contract) >= minimumLevel).sort((a, b) => strength(b) - strength(a));
  const preferred = (minimumLevel: number) => {
    const choices = ranked(minimumLevel);
    const safe = choices.filter(viable);
    const rufspiel = safe.find(contract => contract.kind === "rufspiel");
    if (!rufspiel) return safe[0];
    if (view.hand.filter(card => isTrump(card, rufspiel)).length >= 6) {
      const solo = safe.find(contract => contract.kind === "solo" || contract.kind === "farbwenz");
      if (solo) return solo;
    }
    const exceptional = safe.find(contract => contract.kind !== "rufspiel" && strength(contract) >= strength(rufspiel) + (difficulty === "beginner" ? 3 : 5));
    return exceptional ?? rufspiel;
  };
  if (view.phase === "legen") {
    return { type: "legen", knock: shouldAiKnock(view.hand) };
  }
  if (view.phase === "intent") {
    const play = view.canIntent && Boolean(preferred(view.intents.length + 1));
    return { type: "intent", play: play && random() >= errorRate };
  }
  if (view.phase === "auction") {
    const bid = view.bidLevels.find(level => preferred(level));
    return { type: "bid", level: random() < errorRate && view.canPassBid ? null : bid ?? (view.canPassBid ? null : view.bidLevels[0]) };
  }
  if (view.phase === "declare") {
    const choices = ranked(view.bidLevel);
    const contract = view.forcedCaller ? (view.forcedCallerReason === "legen" ? choices.find(choice => choice.kind !== "rufspiel") : choices.find(choice => choice.kind === "rufspiel")) ?? choices[0] : preferred(view.bidLevel) ?? choices[0];
    const mistaken = choices.find(choice => viable(choice) && !sameContract(choice, contract));
    return { type: "declare", contract: random() < errorRate && mistaken ? mistaken : contract };
  }
  if (view.phase === "kontra" || view.phase === "re") return { type: "double", accept: false };
  if (view.phase === "trick") return { type: "collect" };
  if (view.phase === "redeal" || view.phase === "finished") return { type: "next" };
  const contract = view.contract!;
  const cards = view.hand.filter(card => view.legalCards.includes(card.id));
  const expense = (card: Card) => POINTS[card.rank] * 2 + cardStrength(card, contract) / 10;
  const cheapest = [...cards].sort((a, b) => expense(a) - expense(b));
  if (contract.kind === "ramsch") {
    const avoidWinning = view.trick.length ? cheapest.filter(card => trickWinner([...view.trick, { seat: view.seat, card }], contract) !== view.seat) : cheapest.filter(card => !isTrump(card, contract));
    return { type: "play", cardId: (avoidWinning[0] ?? cheapest[0]).id };
  }
  const played = new Set([...view.tricks.flatMap(trick => trick.plays.map(play => play.card.id)), ...view.trick.map(play => play.card.id), ...view.hand.map(card => card.id)]);
  const secure = (card: Card) => !createDeck().some(other => !played.has(other.id) && isTrump(other, contract) === isTrump(card, contract) && (isTrump(card, contract) || other.suit === card.suit) && cardStrength(other, contract) > cardStrength(card, contract));
  const onPlayingTeam = view.seat === view.declarer || view.partner === view.seat;
  const opposingRufspiel = contract.kind === "rufspiel" && !onPlayingTeam;
  const trumps = cards.filter(card => isTrump(card, contract));
  const plain = cards.filter(card => !isTrump(card, contract));
  const allySeat = (seat: number) => seat === view.seat || (onPlayingTeam
    ? seat === view.declarer || seat === view.partner
    : seat !== view.declarer && (contract.kind !== "rufspiel" || view.partner !== null && seat !== view.partner));
  const enemySeat = (seat: number) => !allySeat(seat);
  const knownVoidInCalledSuit = (seat: number) => contract.kind === "rufspiel" && view.tricks.some(trick => {
    const lead = trick.plays[0]?.card;
    const response = trick.plays.find(play => play.seat === seat)?.card;
    return lead?.suit === contract.suit && !isTrump(lead, contract) && response
      && (isTrump(response, contract) || response.suit !== contract.suit);
  });
  const enemyVoidInCalledSuit = contract.kind === "rufspiel" && view.names.some((_, seat) => enemySeat(seat) && knownVoidInCalledSuit(seat));
  const seatsBehind = Array.from({ length: 3 - view.trick.length }, (_, offset) => (view.seat + offset + 1) % 4);
  const enemyBehind = seatsBehind.some(enemySeat);
  const enemyVoidBehind = seatsBehind.some(seat => enemySeat(seat) && knownVoidInCalledSuit(seat));
  if (view.trick.length) {
    const leadCalledSuit = contract.kind === "rufspiel" && !isTrump(view.trick[0].card, contract) && view.trick[0].card.suit === contract.suit;
    const currentWinner = trickWinner(view.trick, contract);
    if (leadCalledSuit && enemyVoidBehind && plain.length) {
      return { type: "play", cardId: [...plain].sort((a, b) => expense(a) - expense(b))[0].id };
    }
    if (!enemyBehind && allySeat(currentWinner)) {
      return { type: "play", cardId: [...cards].sort((a, b) => POINTS[b.rank] - POINTS[a.rank] || expense(a) - expense(b))[0].id };
    }
    const winningTrumps = trumps.filter(card => trickWinner([...view.trick, { seat: view.seat, card }], contract) === view.seat);
    if (!enemyBehind && !allySeat(currentWinner) && winningTrumps.length) {
      if (difficulty === "legend" && view.trick.reduce((sum, play) => sum + POINTS[play.card.rank], 0) < 6) {
        const cheapLoss = cheapest.find(card => trickWinner([...view.trick, { seat: view.seat, card }], contract) !== view.seat && POINTS[card.rank] <= 4);
        if (cheapLoss) return { type: "play", cardId: cheapLoss.id };
      }
      return { type: "play", cardId: [...winningTrumps].sort((a, b) => cardStrength(a, contract) - cardStrength(b, contract))[0].id };
    }
  }
  if (opposingRufspiel && view.trick.length && !isTrump(view.trick[0].card, contract)
    && view.trick[0].card.suit === contract.suit && trumps.length
    && !view.hand.some(card => !isTrump(card, contract) && card.suit === contract.suit)) {
    return { type: "play", cardId: [...trumps].sort((a, b) => cardStrength(a, contract) - cardStrength(b, contract))[0].id };
  }
  if (!view.trick.length) {
    if (!onPlayingTeam && plain.length) {
      const calledCardSeen = [...view.tricks.flatMap(trick => trick.plays), ...view.trick].some(play => play.card.suit === contract.suit && play.card.rank === (contract.calledRank ?? "Ass"));
      const search = opposingRufspiel && !calledCardSeen ? plain.filter(card => card.suit === contract.suit) : [];
      return { type: "play", cardId: [...(search.length ? search : plain)].sort((a, b) => expense(a) - expense(b))[0].id };
    }
    if (onPlayingTeam && enemyVoidInCalledSuit && plain.length) {
      const otherSuit = plain.filter(card => card.suit !== contract.suit);
      return { type: "play", cardId: [...(otherSuit.length ? otherSuit : plain)].sort((a, b) => expense(a) - expense(b))[0].id };
    }
    const partnerLast = view.partner !== null && (view.partner - view.seat + 4) % 4 === 3;
    const previousLead = view.tricks.at(-1)?.plays[0]?.card;
    const replay = partnerLast && previousLead && !isTrump(previousLead, contract)
      ? plain.filter(card => card.suit === previousLead.suit) : [];
    const otherTrumpsRemain = createDeck().some(card => isTrump(card, contract) && !played.has(card.id));
    if (onPlayingTeam && trumps.length) {
      if (plansAhead && otherTrumpsRemain) {
        return { type: "play", cardId: [...trumps].sort((a, b) => cardStrength(b, contract) - cardStrength(a, contract))[0].id };
      }
      if (replay.length && random() < (plansAhead ? 0.65 : difficulty === "advanced" ? 0.35 : 0.1)) {
        return { type: "play", cardId: [...replay].sort((a, b) => expense(a) - expense(b))[0].id };
      }
      const secureAce = plain.find(card => card.rank === "Ass" && secure(card));
      if (!plansAhead && secureAce && random() < 0.12) return { type: "play", cardId: secureAce.id };
      return { type: "play", cardId: [...trumps].sort((a, b) => cardStrength(b, contract) - cardStrength(a, contract))[0].id };
    }
    if (replay.length && random() < (plansAhead ? 0.65 : difficulty === "advanced" ? 0.35 : 0.1)) {
      return { type: "play", cardId: [...replay].sort((a, b) => expense(a) - expense(b))[0].id };
    }
    if (difficulty !== "beginner" && difficulty !== "amateur" && random() < errorRate) return { type: "play", cardId: cards[Math.floor(random() * cards.length)].id };
    const ace = cards.find(card => card.rank === "Ass" && !isTrump(card, contract) && (!plansAhead || secure(card)));
    const lowSuit = cheapest.find(card => !isTrump(card, contract));
    return { type: "play", cardId: (ace ?? lowSuit ?? cheapest[0]).id };
  }
  if (difficulty !== "beginner" && difficulty !== "amateur" && random() < errorRate) return { type: "play", cardId: cards[Math.floor(random() * cards.length)].id };
  const winner = trickWinner(view.trick, contract);
  const knownTeam = contract.kind !== "rufspiel" || view.partner !== null;
  const team = [view.declarer, view.partner];
  const allyWinning = knownTeam && team.includes(winner) === team.includes(view.seat);
  if (allyWinning) {
    const safeAlly = view.trick.length === 3 || !plansAhead || secure(view.trick.find(play => play.seat === winner)!.card);
    const gift = safeAlly ? [...cards].sort((a, b) => POINTS[b.rank] - POINTS[a.rank] || expense(a) - expense(b))[0] : cheapest[0];
    return { type: "play", cardId: gift.id };
  }
  const winning = cheapest.filter(card => trickWinner([...view.trick, { seat: view.seat, card }], contract) === view.seat);
  const points = view.trick.reduce((sum, play) => sum + POINTS[play.card.rank], 0);
  const myPoints = view.points[view.seat] ?? 0;
  const teamPoints = view.points.reduce((total, value, seat) => total + (allySeat(seat) ? value : 0), 0);
  const opponentPoints = view.points.reduce((total, value, seat) => total + (enemySeat(seat) ? value : 0), 0);
  const needEyes = countsOwnPoints && (countsFallenTrumps ? teamPoints < 61 && opponentPoints < 60 : myPoints < 61);
  const fallenTrumps = countsFallenTrumps ? view.tricks.flatMap(trick => trick.plays).filter(play => isTrump(play.card, contract)).length : 0;
  const takeNow = needEyes && (difficulty === "legend" ? points >= 5 : difficulty === "pro" ? points >= 10 : difficulty === "advanced" ? points >= 18 : points >= 25);
  const useful = winning.filter(card => !plansAhead || view.trick.length === 3 || takeNow || secure(card) || fallenTrumps >= 7 && points >= 5);
  return { type: "play", cardId: (useful[0] ?? cheapest[0]).id };
}

/** Legende samples plausible unseen hands and compares complete outcomes of the current trick. */
function chooseLegendPlay(view: GameView, baseline: Action, random: () => number): Action {
  if (baseline.type !== "play" || !view.contract) return baseline;
  const contract = view.contract;
  const legal = view.hand.filter(card => view.legalCards.includes(card.id));
  if (legal.length < 2) return baseline;
  const seen = new Set([...view.hand, ...view.trick.map(play => play.card), ...view.tricks.flatMap(trick => trick.plays.map(play => play.card))].map(card => card.id));
  const unseen = createDeck().filter(card => !seen.has(card.id));
  const team = (seat: number) => seat === view.declarer || seat === view.partner;
  const sameTeam = (seat: number) => team(seat) === team(view.seat);
  const seatsRemaining = Array.from({ length: 3 - view.trick.length }, (_, index) => (view.seat + index + 1) % 4);
  const samples = Array.from({ length: 16 }, () => {
    const shuffled = [...unseen];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swap = Math.floor(random() * (index + 1));
      [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
    }
    const hands = new Map<number, Card[]>();
    let offset = 0;
    for (const seat of seatsRemaining) {
      hands.set(seat, shuffled.slice(offset, offset + view.counts[seat]));
      offset += view.counts[seat];
    }
    return hands;
  });
  const value = (card: Card) => POINTS[card.rank] * 2 + (isTrump(card, contract) ? cardStrength(card, contract) / 7 : 0);
  const score = (card: Card) => {
    let total = card.id === baseline.cardId ? 2 : 0;
    for (const hands of samples) {
      const plays = [...view.trick, { seat: view.seat, card }];
      for (const seat of seatsRemaining) {
        const hand = hands.get(seat) ?? [];
        const lead = plays[0].card;
        const follow = hand.filter(other => isTrump(lead, contract) ? isTrump(other, contract) : !isTrump(other, contract) && other.suit === lead.suit);
        const options = follow.length ? follow : hand;
        if (!options.length) continue;
        const eyes = plays.reduce((sum, play) => sum + POINTS[play.card.rank], 0);
        const winners = options.filter(other => trickWinner([...plays, { seat, card: other }], contract) === seat);
        const chosen = eyes >= 10 && winners.length ? [...winners].sort((a, b) => value(a) - value(b))[0] : [...options].sort((a, b) => value(a) - value(b))[0];
        plays.push({ seat, card: chosen });
      }
      const winner = trickWinner(plays, contract);
      const eyes = plays.reduce((sum, play) => sum + POINTS[play.card.rank], 0);
      total += contract.kind === "ramsch" ? winner === view.seat ? -eyes : eyes / 4 : (sameTeam(winner) ? eyes : -eyes) * 1.7;
      if (contract.tout) total += sameTeam(winner) ? 12 : -24;
    }
    // Preserve valuable cards unless the sampled trick is worth taking.
    return total / samples.length - value(card) * .35;
  };
  return { type: "play", cardId: [...legal].sort((a, b) => score(b) - score(a))[0].id };
}

export function chooseAiAction(view: GameView, difficulty: AiDifficulty = "normal", random: () => number = Math.random): Action {
  const basic = chooseAiMove(view, difficulty, random);
  const action = difficulty === "legend" && view.phase === "play" ? chooseLegendPlay(view, basic, random) : basic;
  if (action.type !== "play" || !view.contract) return action;
  const legal = view.hand.filter(card => view.legalCards.includes(card.id));
  const mistakeChance = { beginner: .65, amateur: .28, advanced: .10, normal: 0, pro: .015, legend: 0 }[difficulty];
  if (mistakeChance > 0 && legal.length > 1 && random() > 1 - mistakeChance) {
    const alternative = legal.filter(card => card.id !== action.cardId).sort((a, b) => POINTS[a.rank] - POINTS[b.rank])[0];
    // A weaker legal card is a strategic miss, while following suit and called-ace rules stay enforced.
    if (alternative) return { type: "play", cardId: alternative.id };
  }
  if (!view.canDouble) return action;
  // Spritzen is a calculated commitment, not a routine bonus action. Beginner and
  // Amateur learn the card play first; the higher levels only risk it with a
  // clearly exceptional hand and increasingly deliberate frequency.
  if (difficulty === "beginner" || difficulty === "amateur") return action;
  const trumps = view.hand.filter(card => isTrump(card, view.contract!));
  const highTrumps = trumps.filter(card => card.rank === "Ober" || card.rank === "Unter").length;
  const aces = view.hand.filter(card => card.rank === "Ass").length;
  const topTrumps = trumps.filter(card => card.rank === "Ober" && (card.suit === "Eichel" || card.suit === "Gras")).length;
  const strength = trumps.length + highTrumps * 2 + topTrumps + aces;
  const threshold = [12, 14, 15, 16][view.spritzCount] ?? 16;
  const likelihood = { advanced: .16, normal: .22, pro: .36, legend: .52 }[difficulty];
  return strength >= threshold && likelihood !== undefined && random() < likelihood ? { ...action, spritz: true } : action;
}
