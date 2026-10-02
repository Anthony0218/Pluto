import assert from "node:assert/strict";
import test from "node:test";
import {
  SUITS, POINTS, DEFAULT_GAME_RULES, applyAction, bidLevels, canDouble, cardLock, chooseAiAction, contractName, contractsFor, forcedCallsFor,
  createDeck, createGame, isTrump, legalCards, resolveLegenTimeout, scoreRound, shouldAiKnock, sortHandForContract, shuffledDeck, trickWinner, viewFor,
} from "../src/games/schafkopf/schafkopf.ts";

const classicGame = (names, dealer, deck, totals, round) => createGame(names, dealer, deck, totals, round, { ...DEFAULT_GAME_RULES, legen: false });
const legenGame = (names, dealer, deck, totals, round) => createGame(names, dealer, deck, totals, round, { ...DEFAULT_GAME_RULES, legen: true });
const card = (suit, rank) => ({ id: `${suit}-${rank}`, suit, rank });
const c = (rank, suit = "Eichel") => card(suit, rank);
function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function playing(contract = { kind: "rufspiel", suit: "Eichel" }) {
  const game = classicGame();
  Object.assign(game, { phase: "play", contract, declarer: 3, partner: contract.kind === "rufspiel" ? 0 : null, turn: 0 });
  return game;
}
function intents(game, seats) {
  for (let i = 0; i < 4; i++) game = applyAction(game, game.turn, { type: "intent", play: seats.includes(game.turn) });
  return game;
}

test("Legen accepts simultaneous decisions, reveals each second packet immediately, and doubles once per knock", () => {
  assert.equal(createGame().phase, "intent", "Legen is opt-in");
  let game = legenGame(undefined, 3, shuffledDeck(rng(7)));
  assert.equal(game.phase, "legen");
  assert.deepEqual(game.hands.map(hand => hand.length), [4, 4, 4, 4]);
  assert.deepEqual(game.pendingHands.map(hand => hand.length), [4, 4, 4, 4]);
  assert.equal(viewFor(game, 0).pendingHands, undefined);
  assert.equal(viewFor(game, 0).hand.length, 4);
  game = applyAction(game, 2, { type: "legen", knock: true });
  assert.deepEqual(game.hands.map(hand => hand.length), [4, 4, 8, 4]);
  assert.deepEqual(game.pendingHands.map(hand => hand.length), [4, 4, 0, 4]);
  game = applyAction(game, 0, { type: "legen", knock: true });
  game = applyAction(game, 1, { type: "legen", knock: false });
  assert.equal(game.multiplier, 4);
  assert.equal(game.phase, "legen");
  game = applyAction(game, 3, { type: "legen", knock: false });
  assert.equal(game.phase, "intent");
  assert.deepEqual(game.hands.map(hand => hand.length), [8, 8, 8, 8]);
  assert.deepEqual(game.pendingHands.map(hand => hand.length), [0, 0, 0, 0]);
  assert.deepEqual(game.legenDecisions, [true, false, true, false]);
  game.phase = "play";
  game.contract = { kind: "rufspiel", suit: "Eichel" };
  game.declarer = 0;
  game.partner = 1;
  game.turn = 2;
  assert.equal(canDouble(game, 2), true, "Klopfen must not block Kontra");
});

test("Legen timeout passes undecided players and gives them the second packet", () => {
  let game = legenGame(undefined, 3, shuffledDeck(rng(18)));
  game = applyAction(game, 1, { type: "legen", knock: true });
  const timedOut = resolveLegenTimeout(game);
  assert.equal(timedOut.phase, "intent");
  assert.deepEqual(timedOut.legenDecisions, [false, true, false, false]);
  assert.deepEqual(timedOut.hands.map(hand => hand.length), [8, 8, 8, 8]);
  assert.deepEqual(timedOut.pendingHands.map(hand => hand.length), [0, 0, 0, 0]);
  assert.equal(timedOut.multiplier, 2);
});

test("a player who knocked must declare after four passes and may always choose an individual game", () => {
  let game = legenGame(undefined, 3, shuffledDeck(rng(29)));
  game = applyAction(game, 0, { type: "legen", knock: true });
  game = applyAction(game, 1, { type: "legen", knock: false });
  game = applyAction(game, 2, { type: "legen", knock: false });
  game = applyAction(game, 3, { type: "legen", knock: false });
  game.hands[0] = [c("Ass"), c("7"), c("Ass", "Gras"), c("7", "Gras"), c("Ass", "Schellen"), c("7", "Schellen"), c("Ober"), c("Unter")];
  game = intents(game, []);
  assert.equal(game.phase, "declare");
  assert.equal(game.declarer, 0);
  assert.equal(game.forcedCallerReason, "legen");
  const view = viewFor(game, 0);
  assert.equal(view.contracts.some(contract => contract.kind === "rufspiel"), true);
  assert.equal(view.contracts.some(contract => contract.kind === "solo"), true);
  const rufspiel = view.contracts.find(contract => contract.kind === "rufspiel");
  assert.equal(applyAction(game, 0, { type: "declare", contract: rufspiel }).phase, "play");
});

test("after four passes, the last player who knocked must declare", () => {
  let game = legenGame(undefined, 3, shuffledDeck(rng(91)));
  game = applyAction(game, 0, { type: "legen", knock: true });
  game = applyAction(game, 1, { type: "legen", knock: false });
  game = applyAction(game, 2, { type: "legen", knock: true });
  game = applyAction(game, 3, { type: "legen", knock: false });
  game = intents(game, []);
  assert.equal(game.phase, "declare");
  assert.equal(game.declarer, 2);
  assert.equal(game.forcedCallerReason, "legen");
});

test("AI knocks only with allowed high-trump combinations and weighs running trumps", () => {
  assert.equal(shouldAiKnock([c("Unter"), c("Unter", "Gras"), c("Unter", "Herz"), c("7")]), true);
  assert.equal(shouldAiKnock([c("Ober"), c("Ober", "Gras"), c("7"), c("8")]), true);
  assert.equal(shouldAiKnock([c("Unter"), c("Unter", "Gras"), c("Ober", "Schellen"), c("7"), c("8")]), false, "only four cards may count");
  assert.equal(shouldAiKnock([c("Unter"), c("Unter", "Gras"), c("Ober", "Schellen"), c("7", "Herz")]), true);
  assert.equal(shouldAiKnock([c("Unter"), c("Ober"), c("7", "Herz"), c("8")]), true);
  assert.equal(shouldAiKnock([c("Unter", "Schellen"), c("Ober", "Schellen"), c("7", "Herz"), c("8")]), false);
  assert.equal(shouldAiKnock([c("Ober", "Herz"), c("Ober", "Schellen"), c("7"), c("8")]), false);
  assert.equal(shouldAiKnock([c("Unter"), c("Unter", "Gras"), c("Ass"), c("10")]), false);
});

test("only advanced AI levels consider a carefully supported Spritze", () => {
  const hand = [c("Ober"), c("Ober", "Gras"), c("Ober", "Herz"), c("Ober", "Schellen"), c("Unter"), c("Unter", "Gras"), c("Unter", "Herz"), c("Unter", "Schellen")];
  const base = viewFor(classicGame(), 0);
  const view = { ...base, phase: "play", seat: 1, turn: 1, contract: { kind: "solo", suit: "Herz" }, declarer: 0, partner: null, hand, legalCards: hand.map(card => card.id), canDouble: true, spritzCount: 0 };
  assert.equal(chooseAiAction(view, "beginner", () => 0).spritz, undefined);
  assert.equal(chooseAiAction(view, "amateur", () => 0).spritz, undefined);
  assert.equal(chooseAiAction(view, "advanced", () => 0).spritz, true);
});

test("colour Wenz names and Wenz/Farbwenz suit sorting use the natural suit order", () => {
  for (const suit of SUITS) assert.equal(contractName({ kind: "farbwenz", suit }), `${suit}-Wenz`);
  const ordered = sortHandForContract([c("9"), c("Ober"), c("König"), c("Unter"), c("10")], { kind: "wenz" });
  assert.deepEqual(ordered.map(card => card.rank), ["Unter", "10", "König", "Ober", "9"]);
  const farbwenz = sortHandForContract([c("9"), c("Ober"), c("König"), c("10"), c("Unter"), c("Unter", "Gras"), c("Unter", "Herz")], { kind: "farbwenz", suit: "Eichel" });
  assert.deepEqual(farbwenz.map(card => card.id), ["Eichel-Unter", "Gras-Unter", "Herz-Unter", "Eichel-10", "Eichel-König", "Eichel-Ober", "Eichel-9"]);
});

test("AI opponents seek the called suit, trump when void, and pro draws trump", () => {
  const base = viewFor(classicGame(), 1);
  const rufspiel = { kind: "rufspiel", suit: "Eichel" };
  const opponent = { ...base, phase: "play", contract: rufspiel, declarer: 0, partner: null, seat: 1, turn: 1,
    trick: [], tricks: [], hand: [c("7"), c("Ass", "Gras"), c("7", "Herz")], legalCards: ["Eichel-7", "Gras-Ass", "Herz-7"] };
  assert.equal(chooseAiAction(opponent, "beginner", () => 0).cardId, "Eichel-7");
  const voidInCalledSuit = { ...opponent, trick: [{ seat: 0, card: c("7") }], hand: [c("7", "Gras"), c("7", "Herz")], legalCards: ["Gras-7", "Herz-7"] };
  assert.equal(chooseAiAction(voidInCalledSuit, "beginner", () => 0).cardId, "Herz-7");
  const declarer = { ...opponent, seat: 0, turn: 0, declarer: 0, hand: [c("Ass", "Gras"), c("Ober")], legalCards: ["Gras-Ass", "Eichel-Ober"] };
  assert.equal(chooseAiAction(declarer, "pro", () => 0).cardId, "Eichel-Ober");
  const partnerLast = { ...declarer, partner: 3, hand: [c("9"), c("Ass", "Gras")], legalCards: ["Eichel-9", "Gras-Ass"],
    tricks: [{ winner: 1, points: 0, plays: [{ seat: 1, card: c("7") }] }] };
  assert.equal(chooseAiAction(partnerLast, "pro", () => 0.5).cardId, "Eichel-9");
  assert.equal(chooseAiAction(partnerLast, "normal", () => 0.05).cardId, "Eichel-9");
  assert.equal(chooseAiAction(partnerLast, "normal", () => 0.2).cardId, "Gras-Ass");
  const safeTrump = { ...declarer, trick: [{ seat: 1, card: c("Ass") }, { seat: 2, card: c("10") }, { seat: 3, card: c("König") }],
    hand: [c("7", "Herz"), c("10", "Herz"), c("9", "Gras")], legalCards: ["Herz-7", "Herz-10", "Gras-9"] };
  assert.equal(chooseAiAction(safeTrump, "pro", () => 0).cardId, "Herz-7", "the lowest winning trump collects all eyes already in the trick");
  const safeGift = { ...safeTrump, partner: 3, trick: [{ seat: 1, card: c("7") }, { seat: 2, card: c("10") }, { seat: 3, card: c("Ober") }],
    hand: [c("Ass", "Gras"), c("7", "Gras")], legalCards: ["Gras-Ass", "Gras-7"] };
  assert.equal(chooseAiAction(safeGift, "beginner", () => 0).cardId, "Gras-Ass", "give maximum eyes when an ally is safely winning");
  const calledSuitVoid = { ...declarer, partner: 3, tricks: [{ winner: 1, points: 0, plays: [
    { seat: 0, card: c("7") }, { seat: 1, card: c("8", "Herz") }, { seat: 2, card: c("9") }, { seat: 3, card: c("10") },
  ] }] };
  assert.equal(chooseAiAction(calledSuitVoid, "pro", () => 0).cardId, "Gras-Ass", "do not lead trump when an opponent is known void in the called suit");
  const voidBehind = { ...calledSuitVoid, trick: [{ seat: 3, card: c("7") }], hand: [c("7", "Herz"), c("9", "Gras")], legalCards: ["Herz-7", "Gras-9"] };
  assert.equal(chooseAiAction(voidBehind, "pro", () => 0).cardId, "Gras-9", "save trump when a void opponent still has to play");
});

test("deal: 32 unique cards, eight per seat, 120 eyes, dealer rotates after all pass", () => {
  const game = classicGame(undefined, 1, shuffledDeck(rng(12)));
  assert.equal(game.turn, 2);
  assert.deepEqual(game.hands.map(hand => hand.length), [8, 8, 8, 8]);
  assert.equal(new Set(game.hands.flat().map(c => c.id)).size, 32);
  assert.equal(game.hands.flat().reduce((sum, c) => sum + POINTS[c.rank], 0), 120);
  const passed = intents(game, []);
  assert.equal(passed.phase, "redeal");
  const fresh = applyAction(passed, 0, { type: "next" }, rng(13));
  assert.equal(fresh.dealer, 2);
  assert.equal(fresh.turn, 3);
  assert.equal(fresh.round, 2);
  assert.deepEqual(fresh.totals, [0, 0, 0, 0]);
  assert.throws(() => classicGame(undefined, 0, Array(32).fill(c("7"))));
});

test("trump structure and ranking for all standard games", () => {
  const deck = createDeck();
  for (const [contract, count] of [[{ kind: "rufspiel", suit: "Eichel" }, 14], [{ kind: "solo", suit: "Gras" }, 14], [{ kind: "wenz" }, 4], [{ kind: "farbwenz", suit: "Schellen" }, 11]]) {
    assert.equal(deck.filter(c => isTrump(c, contract)).length, count);
  }
  assert.equal(trickWinner([{ seat: 0, card: c("Ass") }, { seat: 1, card: c("7", "Herz") }, { seat: 2, card: c("Unter", "Gras") }, { seat: 3, card: c("Ober", "Schellen") }], { kind: "rufspiel" }), 3);
  assert.equal(trickWinner([{ seat: 0, card: c("9") }, { seat: 1, card: c("Ober") }, { seat: 2, card: c("Ass", "Gras") }], { kind: "wenz" }), 1);
  assert.equal(trickWinner([{ seat: 0, card: c("Ober") }, { seat: 1, card: c("König") }], { kind: "wenz" }), 1);
});

test("calling requires a real non-trump suit card and an absent ace", () => {
  const hand = [c("Ober"), c("Unter", "Gras"), c("Ass", "Schellen"), c("9", "Schellen"), c("Ass", "Herz")];
  assert.equal(contractsFor(hand).filter(c => c.kind === "rufspiel").length, 0);
  assert.deepEqual(contractsFor([...hand, c("7", "Gras")]).filter(c => c.kind === "rufspiel"), [{ kind: "rufspiel", suit: "Gras" }]);
  assert.equal(contractsFor(SUITS.flatMap(s => [card(s, "Ober"), card(s, "Unter")])).some(c => c.kind === "sie"), true);
});

test("follow suit and trump lock cards, with no obligation to overtake", () => {
  const game = playing({ kind: "solo", suit: "Herz" });
  game.hands[0] = [c("7"), c("Ass"), c("Ober"), c("9", "Herz")];
  game.trick = [{ seat: 3, card: c("10") }];
  assert.deepEqual(legalCards(game).map(c => c.rank), ["7", "Ass"]);
  assert.match(cardLock(game, 0, c("Ober")), /zugeben/);
  game.trick = [{ seat: 3, card: c("Unter", "Schellen") }];
  assert.deepEqual(legalCards(game).map(c => c.rank), ["Ober", "9"]);
  game.hands[0] = [c("Ass"), c("7", "Gras")];
  assert.equal(legalCards(game).length, 2);
  assert.throws(() => applyAction(game, 1, { type: "play", cardId: game.hands[1][0].id }), /Zug/);
});

test("Ruf-Sau must fall when searched; may be discarded from the penultimate trick", () => {
  const game = playing();
  game.hands[0] = [c("Ass"), c("10"), c("7", "Gras")];
  game.trick = [{ seat: 3, card: c("7") }];
  assert.deepEqual(legalCards(game), [c("Ass")]);
  assert.throws(() => applyAction(game, 0, { type: "play", cardId: c("10").id }), /Sau/);
  game.trick = [{ seat: 3, card: c("7", "Herz") }];
  assert.deepEqual(legalCards(game), [c("10"), c("7", "Gras")]);
  game.tricks = Array.from({ length: 5 }, () => ({ winner: 3, points: 0, plays: [] }));
  assert.ok(!legalCards(game).some(card => card.rank === "Ass"));
  game.tricks.push({ winner: 3, points: 0, plays: [] });
  assert.ok(legalCards(game).some(card => card.rank === "Ass"));
  game.hands[0] = [c("Ass")];
  assert.deepEqual(legalCards(game), [c("Ass")]);
  game.hands[0] = [c("Ass"), c("10"), c("9"), c("7"), c("Ober")];
  game.trick = [{ seat: 3, card: c("8") }];
  assert.deepEqual(legalCards(game), [c("Ass")], "four cards in the called suit do not waive the obligation to play its ace when someone else leads it");
});

test("Davonlaufen needs four current cards, reveals the partner and frees the ace", () => {
  const game = playing();
  game.hands[0] = [c("Ass"), c("10"), c("9"), c("Ober")];
  assert.match(cardLock(game, 0, c("10")), /vier Karten/);
  game.hands[0].push(c("7"));
  assert.equal(cardLock(game, 0, c("10")), null);
  const escaped = applyAction(game, 0, { type: "play", cardId: c("10").id });
  assert.equal(escaped.escaped, true);
  assert.equal(escaped.partnerRevealed, true);
  escaped.turn = 0;
  escaped.trick = [{ seat: 3, card: c("8") }];
  assert.deepEqual(legalCards(escaped), [c("Ass")]);
  escaped.trick = [{ seat: 3, card: c("Ass", "Gras") }];
  assert.ok(legalCards(escaped).some(c => c.rank === "Ass"));
  escaped.trick = [];
  assert.match(cardLock(escaped, 0, c("9")), /vier Karten/);
  assert.equal(game.escaped, false, "transitions must not mutate their input");
  game.hands[0] = [c("9"), c("7", "Gras")];
  game.partnerRevealed = true;
  assert.equal(applyAction(game, 0, { type: "play", cardId: c("9").id }).escaped, false, "playing the suit after the ace was used is not Davonlaufen");
});

test("AI declares individual games only with sufficiently strong trumps", () => {
  const base = viewFor(classicGame(), 0);
  const intent = (hand, contract) => chooseAiAction({ ...base, phase: "intent", hand, contracts: [contract], intents: [], canIntent: true }, "normal", () => 0.99).play;
  const solo = { kind: "solo", suit: "Herz" };
  const topFive = [c("Ober"), c("Ober", "Gras"), c("Ober", "Herz"), c("Ober", "Schellen"), c("Unter")];
  assert.equal(intent([...topFive, c("7", "Herz"), c("7"), c("8")], solo), false);
  assert.equal(intent([...topFive, c("Unter", "Gras"), c("7"), c("8")], solo), true);
  assert.equal(intent([...topFive, c("Ass", "Herz"), c("10", "Herz"), c("7")], solo), true);
  const farbwenz = { kind: "farbwenz", suit: "Herz" };
  const fourUnters = [c("Unter"), c("Unter", "Gras"), c("Unter", "Herz"), c("Unter", "Schellen")];
  assert.equal(intent([...fourUnters, c("Ass", "Herz"), c("7"), c("8"), c("9")], farbwenz), false);
  assert.equal(intent([...fourUnters, c("Ass", "Herz"), c("Ass"), c("8"), c("9")], farbwenz), true);
  assert.equal(intent([...fourUnters, c("Ass", "Herz"), c("10", "Herz"), c("8"), c("9")], farbwenz), true);
  assert.equal(intent([...fourUnters, c("7"), c("8"), c("9"), c("Ass")], { kind: "wenz" }), true);
});

test("AI Sauspiel follows trump, Ober and missing-ace limits", () => {
  const contract = { kind: "rufspiel", suit: "Eichel" };
  const view = viewFor(classicGame(undefined, 0), 0);
  const wantsToPlay = (hand, ramsch = false) => chooseAiAction({ ...view, phase: "intent", hand, contracts: [contract], intents: [], canIntent: true, rules: { ...view.rules, ramsch } }, "normal", () => .99).play;
  const four = [c("Ober"), c("Unter", "Gras"), c("7", "Herz"), c("8", "Herz"), c("7"), c("Ass", "Gras"), c("Ass", "Schellen"), c("7", "Schellen")];
  assert.equal(wantsToPlay(four), true);
  assert.equal(wantsToPlay(four.map(card => card.id === "Herz-8" ? c("9", "Gras") : card)), true, "three trumps are possible only from last seat without Ramsch");
  assert.equal(wantsToPlay(four.map(card => card.id === "Herz-8" ? c("9", "Gras") : card), true), false);
  assert.equal(wantsToPlay(four.map(card => card.id === "Gras-Ass" ? c("9", "Gras") : card)), false, "two missing aces reject Sauspiel");
});

test("auction: earlier seat may match, later seat must raise, final suit stays private", () => {
  let game = intents(classicGame(undefined, 3, shuffledDeck(rng(3))), [0, 1]);
  assert.equal(game.turn, 1);
  assert.ok(!bidLevels(game, 1).includes(1));
  game = applyAction(game, 1, { type: "bid", level: 3 });
  assert.ok(bidLevels(game, 0).includes(3));
  game = applyAction(game, 0, { type: "bid", level: 3 });
  assert.ok(!bidLevels(game, 1).includes(3));
  assert.equal(game.contract, null);
  game = applyAction(game, 1, { type: "bid", level: null });
  assert.equal(game.phase, "declare");
  assert.equal(game.declarer, 0);
  assert.throws(() => applyAction(game, 0, { type: "declare", contract: { kind: "farbwenz", suit: "Herz" } }));
  game = applyAction(game, 0, { type: "declare", contract: { kind: "wenz" } });
  assert.equal(game.phase, "play");
  assert.equal(game.turn, 0, "forehand, not declarer, leads");
});

test("intentions bind challengers; subsequent challengers cannot lower the winning bid", () => {
  let game = intents(classicGame(), [0, 1, 2, 3]);
  assert.throws(() => applyAction(game, 1, { type: "bid", level: null }), /verbindlich/);
  game = applyAction(game, 1, { type: "bid", level: 3 });
  game = applyAction(game, 0, { type: "bid", level: 3 });
  game = applyAction(game, 1, { type: "bid", level: null });
  assert.equal(game.turn, 2);
  game = applyAction(game, 2, { type: "bid", level: null });
  assert.equal(game.bidLevel, 3);
  assert.equal(game.turn, 3);
  assert.throws(() => applyAction(game, 3, { type: "bid", level: null }), /verbindlich/);
  const raisedLevel = bidLevels(game, 3)[0];
  assert.ok(raisedLevel > 3);
  game = applyAction(game, 3, { type: "bid", level: raisedLevel });
  if (bidLevels(game, 0).includes(raisedLevel)) {
    game = applyAction(game, 0, { type: "bid", level: raisedLevel });
    game = applyAction(game, 3, { type: "bid", level: null });
    assert.equal(game.declarer, 0);
  } else {
    game = applyAction(game, 0, { type: "bid", level: null });
    assert.equal(game.declarer, 3);
  }
  assert.equal(game.bidLevel, raisedLevel);
});

test("Kontra and Re enforce teams, timing, and the normal winning threshold", () => {
  const game = playing();
  game.turn = 1;
  assert.equal(canDouble(game, 0), false);
  assert.equal(canDouble(game, 1), true);
  let doubled = applyAction(game, 1, { type: "play", cardId: legalCards(game, 1)[0].id, spritz: true });
  assert.equal(doubled.multiplier, 2);
  assert.deepEqual(doubled.spritzSeats, [1]);
  assert.equal(doubled.turn, 2);
  assert.equal(canDouble(doubled, 1), false);
  doubled = applyAction(doubled, 2, { type: "play", cardId: legalCards(doubled, 2)[0].id });
  assert.equal(canDouble(doubled, 3), false, "Re requires the following trick");
  doubled.trick = [];
  doubled.tricks = [{ winner: 0, points: 0, plays: [] }];
  doubled.turn = 0;
  doubled = applyAction(doubled, 0, { type: "play", cardId: legalCards(doubled, 0)[0].id, spritz: true });
  assert.equal(doubled.multiplier, 4);
  assert.equal(canDouble(doubled, 1), false, "Sub requires one more trick");
  doubled.trick = [];
  doubled.tricks.push({ winner: 1, points: 0, plays: [] });
  doubled.turn = 1;
  assert.equal(canDouble(doubled, 1), true);
  doubled = applyAction(doubled, 1, { type: "play", cardId: legalCards(doubled, 1)[0].id, spritz: true });
  assert.equal(doubled.multiplier, 8);
  doubled.trick = [];
  doubled.tricks.push({ winner: 0, points: 0, plays: [] });
  doubled.turn = 0;
  assert.equal(canDouble(doubled, 0), true);
  doubled = applyAction(doubled, 0, { type: "play", cardId: legalCards(doubled, 0)[0].id, spritz: true });
  assert.equal(doubled.multiplier, 16);
  game.trick = [{ seat: 2, card: c("7") }, { seat: 3, card: c("8") }];
  game.hands[1].pop();
  assert.equal(canDouble(game, 1), false);
  assert.throws(() => applyAction(game, 1, { type: "play", cardId: game.hands[1][0].id, spritz: true }));
});

test("scoring: 60/61 and asymmetric Schneider thresholds, zero-eye trick prevents Schwarz", () => {
  const game = playing({ kind: "solo", suit: "Herz" });
  game.declarer = 0;
  game.tricks = Array.from({ length: 8 }, (_, i) => ({ winner: i === 0 ? 1 : 0, points: 0, plays: [] }));
  for (const [points, won, schneider] of [[60, false, false], [61, true, false], [30, false, true], [31, false, false], [90, true, false], [91, true, true], [120, true, true]]) {
    game.points = [points, 120 - points, 0, 0];
    const result = scoreRound(game);
    assert.equal(result.declarerWon, won, `${points}: win`);
    assert.equal(result.schneider, schneider, `${points}: Schneider`);
    assert.equal(result.schwarz, false);
    assert.equal(result.deltas.reduce((a, b) => a + b, 0), 0);
    assert.equal(Math.abs(result.deltas[0]), result.value * 3);
  }
});

test("custom Schneider, Schwarz and Laufende amounts change the round value", () => {
  const game = playing({ kind: "solo", suit: "Herz" });
  game.declarer = 0;
  game.points = [120, 0, 0, 0];
  game.tricks = Array.from({ length: 8 }, () => ({ winner: 0, points: 0, plays: [] }));
  const trumps = createDeck().filter(card => isTrump(card, game.contract));
  game.initialHands = [trumps.filter(card => card.rank === "Ober").slice(0, 3), [], [], []];
  game.rules = { ...game.rules, schneiderValue: 4, schwarzValue: 6, laufendeValue: 2 };
  const result = scoreRound(game);
  assert.equal(result.schneider, true);
  assert.equal(result.schwarz, true);
  assert.equal(result.laufende, 3);
  assert.equal(result.value, game.rules.soloValue + 4 + 6 + 3 * 2);
});

test("Tout loses even with 120 eyes if an opponent takes a zero-eye trick; Sie pays fourfold", () => {
  const game = playing({ kind: "solo", suit: "Herz", tout: true });
  game.declarer = 0;
  game.points = [120, 0, 0, 0];
  game.tricks = Array.from({ length: 8 }, (_, i) => ({ winner: i === 0 ? 1 : 0, points: 0, plays: [] }));
  assert.equal(scoreRound(game).declarerWon, false);
  game.tricks[0].winner = 0;
  assert.equal(scoreRound(game).declarerWon, true);
  const special = SUITS.flatMap(suit => [card(suit, "Ober"), card(suit, "Unter")]);
  const rest = createDeck().filter(c => !special.some(s => s.id === c.id));
  let sie = classicGame(undefined, 3, [...special.slice(0, 4), ...rest.slice(0, 12), ...special.slice(4), ...rest.slice(12)]);
  sie = intents(sie, [0]);
  sie = applyAction(sie, 0, { type: "declare", contract: { kind: "sie" } });
  assert.equal(sie.phase, "finished");
  assert.equal(sie.result.value, (sie.rules.soloValue + 8 * sie.rules.laufendeValue) * 4);
  assert.equal(sie.result.declarerPoints, 120);
});

test("views disclose no opponent hands, initial deal or hidden partner", () => {
  const game = playing();
  const view = viewFor(game, 2);
  assert.equal(view.partner, null);
  assert.equal(view.hands, undefined);
  assert.equal(view.initialHands, undefined);
  assert.deepEqual(view.hand, game.hands[2]);
  assert.equal(viewFor(game, 0).partner, 0);
  view.hand.pop();
  assert.equal(game.hands[2].length, 8);
  assert.throws(() => viewFor(game, -1));
});

test("server transition rejects malformed, stale and duplicate card actions", () => {
  const game = playing({ kind: "wenz" });
  const action = { type: "play", cardId: game.hands[0][0].id };
  const moved = applyAction(game, 0, action);
  assert.throws(() => applyAction(moved, 0, action), /Zug/);
  assert.throws(() => applyAction(game, 0, { type: "play", cardId: "fake-card" }));
  assert.throws(() => applyAction(game, 0, { type: "next" }));
  assert.throws(() => applyAction(game, 0, { type: "bid", level: 8 }));
  assert.throws(() => applyAction(game, 7, action));
});

test("250 complete AI games preserve cards, eyes, legal moves and zero-sum totals", () => {
  let finished = 0;
  for (let seed = 1; seed <= 250; seed++) {
    let game = classicGame(undefined, seed % 4, shuffledDeck(rng(seed)));
    for (let moves = 0; !["finished", "redeal"].includes(game.phase); moves++) {
      assert.ok(moves < 130, `game ${seed} stuck in ${game.phase}`);
      const view = viewFor(game, game.turn);
      if (game.phase === "play") assert.ok(view.legalCards.length > 0);
      const previous = game;
      game = applyAction(game, game.turn, chooseAiAction(view));
      assert.equal(game.revision, previous.revision + 1);
      const played = game.tricks.flatMap(t => t.plays.map(p => p.card));
      const current = game.phase === "trick" ? [] : game.trick.map(p => p.card);
      const cards = [...game.hands.flat(), ...played, ...current];
      assert.equal(cards.length, 32);
      assert.equal(new Set(cards.map(c => c.id)).size, 32);
    }
    if (game.phase === "finished") {
      finished++;
      assert.equal(game.tricks.length, 8);
      assert.equal(game.points.reduce((a, b) => a + b, 0), 120);
      assert.equal(game.hands.flat().length, 0);
      assert.equal(game.totals.reduce((a, b) => a + b, 0), 0);
    }
  }
  assert.ok(finished > 100, `only ${finished} non-passed games`);
});

test("forced Eichel-Ober call offers missing aces before lower cards", () => {
  const hand = [c("Ober"), c("Ass"), c("10"), c("Ass", "Gras"), c("König", "Schellen"), c("Unter"), c("8", "Herz"), c("7", "Herz")];
  assert.deepEqual(forcedCallsFor(hand).map(contract => `${contract.suit}-${contract.calledRank}`), ["Schellen-Ass"]);
  const allAces = [c("Ober"), c("Ass"), c("Ass", "Gras"), c("Ass", "Schellen"), c("Unter"), c("7", "Herz"), c("8", "Herz"), c("9", "Herz")];
  assert.ok(forcedCallsFor(allAces).some(contract => contract.suit === "Eichel" && contract.calledRank === "10"));
  assert.ok(forcedCallsFor(allAces).every(contract => contract.calledRank !== "Ass"));
  const game = playing({ kind: "rufspiel", suit: "Eichel", calledRank: "10" });
  game.hands[0] = [c("10"), c("9"), c("7", "Gras")];
  game.trick = [{ seat: 3, card: c("7") }];
  assert.deepEqual(legalCards(game, 0), [c("10")]);
  assert.equal(applyAction(game, 0, { type: "play", cardId: c("10").id }).partnerRevealed, true);
});

test("all passing chooses Ramsch or the Eichel-Ober owner and records each round", () => {
  const deck = createDeck();
  const ramsch = createGame(undefined, 3, deck, undefined, 1, { ...DEFAULT_GAME_RULES, ramsch: true });
  const afterPass = intents(ramsch, []);
  assert.equal(afterPass.contract.kind, "ramsch");
  assert.equal(afterPass.phase, "play");
  const forced = createGame(undefined, 3, deck, undefined, 1, { ...DEFAULT_GAME_RULES, ramsch: true, eichelOberMuss: true });
  const afterForce = intents(forced, []);
  assert.equal(afterForce.phase, "declare");
  assert.equal(afterForce.declarer, afterForce.hands.findIndex(hand => hand.some(card => card.id === "Eichel-Ober")));
  assert.ok(viewFor(afterForce, afterForce.declarer).contracts.every(contract => contract.kind === "rufspiel"));
  const redeal = intents(classicGame(undefined, 3, deck), []);
  assert.equal(redeal.history.length, 1);
  const next = applyAction(redeal, redeal.turn, { type: "next" }, rng(1));
  assert.equal(next.history.length, 1);
  assert.equal(next.round, 2);
});

test("Ramsch completes with zero-sum payments and a ledger entry", () => {
  let game = intents(createGame(undefined, 3, shuffledDeck(rng(18)), undefined, 1, { ...DEFAULT_GAME_RULES, ramsch: true }), []);
  for (let moves = 0; game.phase !== "finished"; moves++) {
    assert.ok(moves < 40);
    game = applyAction(game, game.turn, chooseAiAction(viewFor(game, game.turn), "normal", rng(moves + 2)));
  }
  assert.equal(game.tricks.length, 8);
  assert.equal(game.points.reduce((sum, points) => sum + points, 0), 120);
  assert.equal(game.result.deltas.reduce((sum, amount) => sum + amount, 0), 0);
  assert.equal(game.history.length, 1);
  assert.equal(game.history[0].contract, "Ramsch");
});

test("Ramsch pays a double share to each player without a trick", () => {
  const game = classicGame();
  Object.assign(game, {
    contract: { kind: "ramsch" },
    points: [70, 30, 20, 0],
    tricks: [0, 0, 0, 0, 1, 1, 1, 1].map(winner => ({ plays: [], winner, points: 0 })),
  });
  const result = scoreRound(game);
  assert.deepEqual(result.ramschDoubleWinners, [2, 3]);
  assert.deepEqual(result.deltas, [-50, 10, 20, 20]);
  assert.equal(result.deltas.reduce((sum, amount) => sum + amount, 0), 0);
});

test("forced lower-card Sauspiel plays through and reveals its partner", () => {
  let game = intents(createGame(undefined, 3, createDeck(), undefined, 1, { ...DEFAULT_GAME_RULES, eichelOberMuss: true }), []);
  const call = viewFor(game, game.turn).contracts.find(contract => contract.kind === "rufspiel" && contract.suit === "Eichel");
  assert.equal(call.calledRank, "9");
  game = applyAction(game, game.turn, { type: "declare", contract: call });
  for (let moves = 0; game.phase !== "finished"; moves++) {
    assert.ok(moves < 40);
    game = applyAction(game, game.turn, chooseAiAction(viewFor(game, game.turn), "normal", rng(moves + 7)));
  }
  assert.equal(game.partnerRevealed, true);
  assert.equal(game.tricks.length, 8);
  assert.equal(game.points.reduce((sum, points) => sum + points, 0), 120);
  assert.equal(game.history[0].contract, "Sauspiel auf Eichel-9");
});

test("AI completes full rounds with Legen and keeps all 32 cards accounted for", () => {
  let finished = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const random = rng(seed + 1000);
    let game = legenGame(undefined, seed % 4, shuffledDeck(random));
    for (let moves = 0; !["finished", "redeal"].includes(game.phase); moves++) {
      assert.ok(moves < 140, `game ${seed} stuck in ${game.phase}`);
      game = applyAction(game, game.turn, chooseAiAction(viewFor(game, game.turn), "pro", random), random);
      const current = game.phase === "trick" ? [] : game.trick.map(play => play.card);
      const cards = [...game.hands.flat(), ...game.pendingHands.flat(), ...game.tricks.flatMap(trick => trick.plays.map(play => play.card)), ...current];
      assert.equal(cards.length, 32);
      assert.equal(new Set(cards.map(card => card.id)).size, 32);
    }
    if (game.phase === "finished") {
      finished++;
      assert.equal(game.points.reduce((sum, points) => sum + points, 0), 120);
      assert.equal(game.totals.reduce((sum, total) => sum + total, 0), 0);
    }
  }
  assert.ok(finished > 15);
});
