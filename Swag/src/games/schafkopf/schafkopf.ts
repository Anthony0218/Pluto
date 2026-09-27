/** Shared, deterministic rules for long-deck Schafkopf. No browser dependencies. */
export const SUITS = ["Eichel", "Gras", "Herz", "Schellen"] as const;
export const RANKS = ["Ass", "10", "König", "Ober", "Unter", "9", "8", "7"] as const;
export type Suit = typeof SUITS[number];
export type Rank = typeof RANKS[number];
export type Card = { id: string; suit: Suit; rank: Rank };
export type Contract = { kind: "rufspiel" | "farbwenz" | "wenz" | "solo" | "sie"; suit?: Suit; tout?: boolean };
export type Play = { seat: number; card: Card };
export type Trick = { plays: Play[]; winner: number; points: number };
export type Phase = "intent" | "auction" | "declare" | "kontra" | "re" | "play" | "trick" | "finished" | "redeal";
export type Result = {
  declarerPoints: number; opponentPoints: number; declarerWon: boolean;
  schneider: boolean; schwarz: boolean; laufende: number; value: number; deltas: number[]; team: number[];
};
export type GameState = {
  phase: Phase; dealer: number; turn: number; round: number; revision: number;
  names: string[]; hands: Card[][]; initialHands: Card[][]; totals: number[];
  intents: number[]; declarations: number; incumbent: number; challengerIndex: number; bidLevel: number;
  contract: Contract | null; declarer: number; partner: number | null; partnerRevealed: boolean; escaped: boolean;
  trick: Play[]; tricks: Trick[]; points: number[]; multiplier: number; doublingVisits: number;
  announcements: string[]; result: Result | null;
};
export type Action =
  | { type: "intent"; play: boolean }
  | { type: "bid"; level: number | null }
  | { type: "declare"; contract: Contract }
  | { type: "double"; accept: boolean }
  | { type: "play"; cardId: string }
  | { type: "collect" }
  | { type: "next" };
export type GameView = Omit<GameState, "hands" | "initialHands" | "partner"> & {
  seat: number; hand: Card[]; counts: number[]; partner: number | null;
  legalCards: string[]; locks: Record<string, string>; contracts: Contract[]; bidLevels: number[];
  canIntent: boolean; canDouble: boolean; canPassBid: boolean;
};

export const POINTS: Record<Rank, number> = { Ass: 11, "10": 10, König: 4, Ober: 3, Unter: 2, "9": 0, "8": 0, "7": 0 };
export const BID_NAMES = ["", "Rufspiel", "Farbwenz", "Wenz", "Solo", "Farbwenz Tout", "Wenz Tout", "Solo Tout", "Sie"];
const next = (seat: number) => (seat + 1) % 4;
export const cardName = (card: Card) => `${card.suit} ${card.rank === "Ass" ? "Sau" : card.rank}`;
export function contractName(contract: Contract): string {
  if (contract.kind === "rufspiel") return `Rufspiel mit der ${contract.suit}-Sau`;
  return `${contract.suit ? `${contract.suit}-` : ""}${contract.kind === "sie" ? "Sie" : contract.kind === "solo" ? "Solo" : contract.kind === "wenz" ? "Wenz" : "Farbwenz"}${contract.tout ? " Tout" : ""}`;
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
export function createGame(names = ["Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4"], dealer = 3, deck = shuffledDeck(), totals = [0, 0, 0, 0], round = 1): GameState {
  const ids = new Set(createDeck().map(card => card.id));
  if (names.length !== 4 || totals.length !== 4 || !Number.isInteger(dealer) || dealer < 0 || dealer > 3 || deck.length !== 32 || new Set(deck.map(card => card.id)).size !== 32 || deck.some(card => !ids.has(card.id) || card.id !== `${card.suit}-${card.rank}`)) throw new Error("Ungültiges Kartenspiel.");
  const hands: Card[][] = [[], [], [], []];
  for (let packet = 0; packet < 8; packet++) hands[(dealer + 1 + packet) % 4].push(...deck.slice(packet * 4, packet * 4 + 4));
  return {
    phase: "intent", dealer, turn: next(dealer), round, revision: 0, names: [...names], hands, initialHands: structuredClone(hands), totals: [...totals],
    intents: [], declarations: 0, incumbent: -1, challengerIndex: 1, bidLevel: 1,
    contract: null, declarer: -1, partner: null, partnerRevealed: false, escaped: false,
    trick: [], tricks: [], points: [0, 0, 0, 0], multiplier: 1, doublingVisits: 0, announcements: [], result: null,
  };
}
export function contractLevel(c: Contract): number {
  if (c.kind === "sie") return 8;
  const base = { rufspiel: 1, farbwenz: 2, wenz: 3, solo: 4 }[c.kind];
  return base + (c.tout ? 3 : 0);
}
export function isTrump(card: Card, contract: Contract): boolean {
  if (card.rank === "Unter") return true;
  if (["rufspiel", "solo", "sie"].includes(contract.kind) && card.rank === "Ober") return true;
  return card.suit === (contract.kind === "rufspiel" ? "Herz" : contract.suit);
}
export function cardStrength(card: Card, contract: Contract): number {
  if (isTrump(card, contract)) {
    if (card.rank === "Ober" && contract.kind !== "wenz" && contract.kind !== "farbwenz") return 100 - SUITS.indexOf(card.suit);
    if (card.rank === "Unter") return 90 - SUITS.indexOf(card.suit);
    return 70 - RANKS.indexOf(card.rank);
  }
  return 20 - RANKS.indexOf(card.rank);
}
export function contractsFor(hand: Card[]): Contract[] {
  const contracts: Contract[] = [];
  for (const suit of SUITS) {
    if (suit !== "Herz" && !hand.some(c => c.suit === suit && c.rank === "Ass") && hand.some(c => c.suit === suit && !isTrump(c, { kind: "rufspiel" }))) contracts.push({ kind: "rufspiel", suit });
    for (const kind of ["farbwenz", "solo"] as const) for (const tout of [false, true]) contracts.push({ kind, suit, tout });
  }
  contracts.push({ kind: "wenz", tout: false }, { kind: "wenz", tout: true });
  if (hand.length === 8 && hand.every(c => c.rank === "Ober" || c.rank === "Unter")) contracts.push({ kind: "sie" });
  return contracts;
}
const sameContract = (a: Contract, b: Contract) => a.kind === b.kind && a.suit === b.suit && Boolean(a.tout) === Boolean(b.tout);
function order(state: GameState, seat: number) { return (seat - next(state.dealer) + 4) % 4; }
export function bidLevels(state: GameState, seat: number): number[] {
  if (state.phase !== "auction" || state.turn !== seat) return [];
  const other = state.incumbent === seat ? state.intents[state.challengerIndex] : state.incumbent;
  return [...new Set(contractsFor(state.hands[seat]).map(contractLevel))].filter(level => level >= state.intents.indexOf(seat) + 1 && (level > state.bidLevel || (level === state.bidLevel && order(state, seat) < order(state, other)))).sort((a, b) => a - b);
}
export function canPassBid(state: GameState, seat: number): boolean {
  return state.phase === "auction" && state.turn === seat && (seat === state.incumbent || state.bidLevel >= state.intents.indexOf(seat) + 1);
}
export function declarerTeam(state: GameState): number[] {
  return state.partner === null ? [state.declarer] : [state.declarer, state.partner];
}
export function canDouble(state: GameState, seat: number): boolean {
  if (!state.contract || state.contract.kind === "sie") return false;
  const playingEarly = state.phase === "play" && state.tricks.length === 0 && state.trick.length < 2;
  if (!["kontra", "re"].includes(state.phase) && !playingEarly) return false;
  const team = declarerTeam(state).includes(seat);
  return (state.multiplier === 1 && !team) || (state.multiplier === 2 && team);
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
  if (contract.kind === "rufspiel" && !state.escaped && hand.some(c => c.suit === contract.suit && c.rank === "Ass")) {
    const ace = card.suit === contract.suit && card.rank === "Ass";
    if (lead && category(lead) === contract.suit && !ace) return "Die gerufene Sau muss zugegeben werden.";
    if (lead && category(lead) !== contract.suit && ace && hand.length > 1) return "Die Ruf-Sau ist gesperrt, bis sie gesucht wird (oder letzter Stich).";
    if (!lead && category(card) === contract.suit && !ace && hand.filter(c => category(c) === contract.suit).length < 4) return "Davonlaufen braucht mindestens vier Karten der Ruffarbe in deiner aktuellen Hand.";
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
  const team = declarerTeam(state);
  const points = team.reduce((sum, seat) => sum + state.points[seat], 0);
  const tricks = state.tricks.filter(trick => team.includes(trick.winner)).length;
  const sie = contract.kind === "sie";
  const won = sie || (contract.tout ? tricks === 8 : points >= 61);
  const schwarz = !sie && (tricks === 0 || tricks === 8);
  const schneider = !sie && (won ? points >= 91 : points <= 30);
  const trumps = createDeck().filter(card => isTrump(card, contract)).sort((a, b) => cardStrength(b, contract) - cardStrength(a, contract));
  const owned = new Set(team.flatMap(seat => state.initialHands[seat]).map(c => c.id));
  const withTop = owned.has(trumps[0].id);
  let laufende = 0;
  const cap = contract.kind === "rufspiel" ? 14 : contract.kind === "wenz" ? 4 : 8;
  for (const card of trumps.slice(0, cap)) {
    if (owned.has(card.id) !== withTop) break;
    laufende++;
  }
  if (laufende < (contract.kind === "wenz" ? 2 : 3)) laufende = 0;
  // Virtual units only: Rufspiel 1, solos 5, each bonus 1.
  const value = ((contract.kind === "rufspiel" ? 1 : 5) + laufende + (contract.tout || sie ? 0 : Number(schneider) + Number(schwarz))) * (sie ? 4 : contract.tout ? 2 : 1) * state.multiplier;
  const deltas = state.names.map((_, seat) => (team.includes(seat) === won ? 1 : -1) * value * (team.length === 1 && seat === state.declarer ? 3 : 1));
  return { declarerPoints: points, opponentPoints: 120 - points, declarerWon: won, schneider, schwarz, laufende, value, deltas, team };
}
function finish(state: GameState) {
  state.phase = "finished";
  state.result = scoreRound(state);
  state.totals = state.totals.map((total, seat) => total + state.result!.deltas[seat]);
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
export function applyAction(previous: GameState, seat: number, action: Action, random: () => number = Math.random): GameState {
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) throw new Error("Ungültiger Sitz.");
  const earlyDouble = action.type === "double" && action.accept && previous.phase === "play" && canDouble(previous, seat);
  if (seat !== previous.turn && action.type !== "next" && !earlyDouble) throw new Error("Du bist nicht am Zug.");
  const state = structuredClone(previous);
  const say = (message: string) => state.announcements.push(`${state.names[seat]}: ${message}`);
  if (action.type === "next") {
    if (state.phase !== "finished" && state.phase !== "redeal") throw new Error("Die Runde läuft noch.");
    const game = createGame(state.names, next(state.dealer), shuffledDeck(random), state.totals, state.round + 1);
    game.revision = previous.revision + 1;
    return game;
  } else if (action.type === "intent" && state.phase === "intent") {
    if (typeof action.play !== "boolean") throw new Error("Ungültige Ansage.");
    if (action.play) {
      if (!contractsFor(state.hands[seat]).some(c => contractLevel(c) >= state.intents.length + 1)) throw new Error("Keine gültige Spielabsicht.");
      state.intents.push(seat);
    }
    say(action.play ? "Ich möchte spielen." : "Weiter.");
    state.declarations++;
    state.turn = next(seat);
    if (state.declarations === 4) {
      if (!state.intents.length) state.phase = "redeal";
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
      say("Weiter.");
      advanceContest(state, seat === state.incumbent ? state.intents[state.challengerIndex] : state.incumbent);
    } else {
      if (!bidLevels(state, seat).includes(action.level)) throw new Error("Dieses Gebot ist nicht zulässig.");
      state.bidLevel = action.level;
      say(`Mindestens ${BID_NAMES[action.level]}.`);
      state.turn = seat === state.incumbent ? state.intents[state.challengerIndex] : state.incumbent;
    }
  } else if (action.type === "declare" && state.phase === "declare") {
    const contract = contractsFor(state.hands[seat]).find(c => sameContract(c, action.contract) && contractLevel(c) >= state.bidLevel);
    if (!contract) throw new Error("Dieses Spiel kannst du nicht ansagen.");
    state.contract = contract;
    state.partner = contract.kind === "rufspiel" ? state.hands.findIndex(hand => hand.some(c => c.suit === contract.suit && c.rank === "Ass")) : null;
    say(contractName(contract));
    if (contract.kind === "sie") { state.points[seat] = 120; finish(state); }
    else { state.phase = "kontra"; state.turn = next(state.dealer); }
  } else if (action.type === "double" && (["kontra", "re"].includes(state.phase) || earlyDouble)) {
    if (typeof action.accept !== "boolean") throw new Error("Ungültige Ansage.");
    if (action.accept) {
      if (!canDouble(state, seat)) throw new Error("Kontra/Re ist jetzt nicht zulässig.");
      say(state.multiplier === 1 ? "Kontra!" : "Re!");
      state.multiplier *= 2;
    }
    if (!earlyDouble) {
      state.doublingVisits++;
      state.turn = next(seat);
      if (state.doublingVisits === 4) {
        state.phase = state.phase === "kontra" && state.multiplier === 2 ? "re" : "play";
        state.doublingVisits = 0;
        state.turn = next(state.dealer);
      }
    }
  } else if (action.type === "play" && state.phase === "play") {
    const card = state.hands[seat].find(c => c.id === action.cardId);
    if (!card) throw new Error("Diese Karte ist nicht in deiner Hand.");
    const reason = cardLock(state, seat, card);
    if (reason) throw new Error(reason);
    const contract = state.contract!;
    if (contract.kind === "rufspiel" && seat === state.partner) {
      if (!state.trick.length && card.suit === contract.suit && !isTrump(card, contract) && card.rank !== "Ass" && !state.escaped && state.hands[seat].some(c => c.suit === contract.suit && c.rank === "Ass")) {
        state.escaped = true;
        state.partnerRevealed = true;
        say("Davongelaufen.");
      }
      if (card.suit === contract.suit && card.rank === "Ass") state.partnerRevealed = true;
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
    names: state.names, totals: state.totals, intents: state.intents, declarations: state.declarations,
    incumbent: state.incumbent, challengerIndex: state.challengerIndex, bidLevel: state.bidLevel,
    contract: state.contract, declarer: state.declarer,
    partner: state.partnerRevealed || state.phase === "finished" || seat === state.partner ? state.partner : null,
    partnerRevealed: state.partnerRevealed, escaped: state.escaped, trick: state.trick,
    tricks: state.tricks, points: state.points, multiplier: state.multiplier, doublingVisits: state.doublingVisits,
    announcements: state.announcements, result: state.result, seat, hand, counts: state.hands.map(h => h.length),
    legalCards: legalCards(state, seat).map(c => c.id),
    locks: Object.fromEntries(hand.flatMap(card => { const reason = cardLock(state, seat, card); return reason ? [[card.id, reason]] : []; })),
    contracts: contractsFor(hand).filter(c => contractLevel(c) >= state.bidLevel), bidLevels: bidLevels(state, seat),
    canIntent: contractsFor(hand).some(c => contractLevel(c) >= state.intents.length + 1), canDouble: canDouble(state, seat), canPassBid: canPassBid(state, seat),
  });
}

/** Heuristic AI receives exactly the same private view as a human. */
export function chooseAiAction(view: GameView): Action {
  const strength = (contract: Contract) => {
    if (contract.kind === "sie") return 100;
    const trumps = view.hand.filter(c => isTrump(c, contract));
    const aces = view.hand.filter(c => !isTrump(c, contract) && c.rank === "Ass").length;
    const top = trumps.filter(c => c.rank === "Unter" || (c.rank === "Ober" && contract.kind !== "farbwenz" && contract.kind !== "wenz")).length;
    return trumps.length * 1.5 + top + aces * 1.5 - (contract.kind === "rufspiel" ? 6 : contract.kind === "wenz" ? 8 : 10) - (contract.tout ? 10 : 0);
  };
  const choices = [...view.contracts].sort((a, b) => strength(b) - strength(a));
  const best = choices[0];
  if (view.phase === "intent") return { type: "intent", play: view.canIntent && choices.some(c => contractLevel(c) >= view.intents.length + 1 && strength(c) > 0) };
  if (view.phase === "auction") {
    const bid = view.bidLevels.find(level => choices.some(c => contractLevel(c) >= level && strength(c) > 0));
    return { type: "bid", level: bid ?? (view.canPassBid ? null : view.bidLevels[0]) };
  }
  if (view.phase === "declare") return { type: "declare", contract: best };
  if (view.phase === "kontra" || view.phase === "re") return { type: "double", accept: false };
  if (view.phase === "trick") return { type: "collect" };
  if (view.phase === "redeal" || view.phase === "finished") return { type: "next" };
  const contract = view.contract!;
  const cards = view.hand.filter(c => view.legalCards.includes(c.id));
  const expense = (c: Card) => POINTS[c.rank] * 2 + cardStrength(c, contract) / 10;
  cards.sort((a, b) => expense(a) - expense(b));
  if (!view.trick.length) {
    const ace = cards.find(c => c.rank === "Ass" && !isTrump(c, contract));
    return { type: "play", cardId: (ace ?? cards[0]).id };
  }
  const winner = trickWinner(view.trick, contract);
  const knownTeam = contract.kind !== "rufspiel" || view.partner !== null;
  const team = [view.declarer, view.partner];
  const allyWinning = knownTeam && team.includes(winner) === team.includes(view.seat);
  if (allyWinning) cards.sort((a, b) => POINTS[b.rank] - POINTS[a.rank]);
  const winning = cards.filter(card => trickWinner([...view.trick, { seat: view.seat, card }], contract) === view.seat);
  const card = allyWinning ? cards[0] : winning[0] ?? cards[0];
  return { type: "play", cardId: card.id };
}
