import assert from "node:assert/strict";
import test from "node:test";
import {
  SUITS, POINTS, applyAction, bidLevels, canDouble, cardLock, chooseAiAction, contractsFor,
  createDeck, createGame, isTrump, legalCards, scoreRound, shuffledDeck, trickWinner, viewFor,
} from "../src/games/schafkopf/schafkopf.ts";

const card = (suit, rank) => ({ id: `${suit}-${rank}`, suit, rank });
const c = (rank, suit = "Eichel") => card(suit, rank);
function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
function playing(contract = { kind: "rufspiel", suit: "Eichel" }) {
  const game = createGame();
  Object.assign(game, { phase: "play", contract, declarer: 3, partner: contract.kind === "rufspiel" ? 0 : null, turn: 0 });
  return game;
}
function intents(game, seats) {
  for (let i = 0; i < 4; i++) game = applyAction(game, game.turn, { type: "intent", play: seats.includes(game.turn) });
  return game;
}

test("deal: 32 unique cards, eight per seat, 120 eyes, dealer rotates after all pass", () => {
  const game = createGame(undefined, 1, shuffledDeck(rng(12)));
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
  assert.throws(() => createGame(undefined, 0, Array(32).fill(c("7"))));
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

test("Ruf-Sau must fall when searched; cannot be discarded before the last trick", () => {
  const game = playing();
  game.hands[0] = [c("Ass"), c("10"), c("7", "Gras")];
  game.trick = [{ seat: 3, card: c("7") }];
  assert.deepEqual(legalCards(game), [c("Ass")]);
  assert.throws(() => applyAction(game, 0, { type: "play", cardId: c("10").id }), /Sau/);
  game.trick = [{ seat: 3, card: c("7", "Herz") }];
  assert.deepEqual(legalCards(game), [c("10"), c("7", "Gras")]);
  game.hands[0] = [c("Ass")];
  assert.deepEqual(legalCards(game), [c("Ass")]);
});

test("Davonlaufen counts current non-trump cards, reveals partner and frees the ace", () => {
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
  assert.ok(legalCards(escaped).some(c => c.rank === "9"));
  escaped.trick = [{ seat: 3, card: c("Ass", "Gras") }];
  assert.ok(legalCards(escaped).some(c => c.rank === "Ass"));
  assert.equal(game.escaped, false, "transitions must not mutate their input");
  game.hands[0] = [c("9"), c("7", "Gras")];
  game.partnerRevealed = true;
  assert.equal(applyAction(game, 0, { type: "play", cardId: c("9").id }).escaped, false, "playing the suit after the ace was used is not Davonlaufen");
});

test("auction: earlier seat may match, later seat must raise, final suit stays private", () => {
  let game = intents(createGame(undefined, 3, shuffledDeck(rng(3))), [0, 1]);
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
  assert.equal(game.phase, "kontra");
  assert.equal(game.turn, 0, "forehand, not declarer, leads");
});

test("intentions bind challengers; subsequent challengers cannot lower the winning bid", () => {
  let game = intents(createGame(), [0, 1, 2, 3]);
  assert.throws(() => applyAction(game, 1, { type: "bid", level: null }), /verbindlich/);
  game = applyAction(game, 1, { type: "bid", level: 3 });
  game = applyAction(game, 0, { type: "bid", level: 3 });
  game = applyAction(game, 1, { type: "bid", level: null });
  assert.equal(game.turn, 2);
  game = applyAction(game, 2, { type: "bid", level: null });
  assert.equal(game.bidLevel, 3);
  assert.equal(game.turn, 3);
  assert.throws(() => applyAction(game, 3, { type: "bid", level: null }), /verbindlich/);
  game = applyAction(game, 3, { type: "bid", level: 4 });
  game = applyAction(game, 0, { type: "bid", level: 4 });
  game = applyAction(game, 3, { type: "bid", level: null });
  assert.equal(game.declarer, 0);
  assert.equal(game.bidLevel, 4);
});

test("Kontra and Re enforce teams, timing, and the normal winning threshold", () => {
  const game = playing();
  assert.equal(canDouble(game, 0), false);
  assert.equal(canDouble(game, 1), true);
  let doubled = applyAction(game, 1, { type: "double", accept: true });
  assert.equal(doubled.multiplier, 2);
  assert.equal(doubled.turn, 0);
  assert.equal(canDouble(doubled, 1), false);
  doubled = applyAction(doubled, 3, { type: "double", accept: true });
  assert.equal(doubled.multiplier, 4);
  assert.equal(canDouble(doubled, 0), false);
  game.trick = [{ seat: 2, card: c("7") }, { seat: 3, card: c("8") }];
  assert.equal(canDouble(game, 1), false);
  assert.throws(() => applyAction(game, 1, { type: "double", accept: true }));
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
  let sie = createGame(undefined, 3, [...special.slice(0, 4), ...rest.slice(0, 12), ...special.slice(4), ...rest.slice(12)]);
  sie = intents(sie, [0]);
  sie = applyAction(sie, 0, { type: "declare", contract: { kind: "sie" } });
  assert.equal(sie.phase, "finished");
  assert.equal(sie.result.value, (5 + 8) * 4);
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
    let game = createGame(undefined, seed % 4, shuffledDeck(rng(seed)));
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
  assert.ok(finished > 150, `only ${finished} non-passed games`);
});
