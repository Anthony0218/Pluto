import test from "node:test";
import assert from "node:assert/strict";
import { chooseBotCard, getLegalBotMoves } from "../src/games/watten/bot.ts";
import { advanceSingleWatten, createSingleWattenRound, cutSingleWatten, declareSingleWatten, playSingleWattenCard, raiseSingleWatten, respondSingleWattenBid, teamOf } from "../src/games/watten/singleplayer.ts";
import { canPlayWattenCard, createDeck, getPreviousPlayer, getWattenCardRole } from "../src/utils/watten.ts";
import { getWattenHelpComparison } from "../src/games/watten/help.ts";
function dealtRound(count, dealer = count - 1, scores, round = 1, targetScore = 15) {
  const state = createSingleWattenRound(count, dealer, scores, round, targetScore);
  return cutSingleWatten(state, 16, getPreviousPlayer(dealer, count));
}
const card = (suit, rank) => ({ id: `${suit}-${rank}`, suit, rank });
function knowledge(trick, count = 3) { return { seat: 1, playerCount: count, trick, playedCardIds: new Set(trick.map(item => item.card.id)), tricksWon: { "0": 0, "1": 0, "2": 0, "3": 0 }, trump: "Herz", schlag: "Ober", teamOf: id => teamOf(id, count, 0) }; }

test("bot saves a Kritische when an ordinary Trumpf wins", () => {
  const hand = [card("Herz", "9"), card("Herz", "König")];
  const choice = chooseBotCard(hand, knowledge([{ playerId: "0", card: card("Gras", "8") }]));
  assert.equal(choice.id, "Herz-9");
});

test("bot recognizes Kritische outrank Hauptschlag", () => {
  const hand = [card("Herz", "9"), card("Herz", "König")];
  const choice = chooseBotCard(hand, knowledge([{ playerId: "0", card: card("Herz", "Ober") }]));
  assert.equal(choice.id, "Herz-König");
});

test("bot filters cards under the existing Trumpf oder Kritisch rule", () => {
  const hand = [card("Gras", "Ass"), card("Herz", "9")];
  const publicState = knowledge([{ playerId: "0", card: card("Herz", "Ober") }]);
  assert.deepEqual(getLegalBotMoves(hand, publicState).map(item => item.id), ["Herz-9"]);
});

test("three and four player rounds finish with legal moves", () => {
  for (const count of [3, 4]) {
    let game = dealtRound(count);
    game = declareSingleWatten(game, "Herz", "Ober");
    let moves = 0;
    while (game.phase !== "roundOver" && game.phase !== "matchOver") {
      if (game.phase === "trickPause") { game = advanceSingleWatten(game); continue; }
      const hand = game.hands[game.turn];
      const legal = hand.filter(item => canPlayWattenCard(item, hand, game.trick, game.tricksWon, game.trump, game.schlag));
      assert.ok(legal.length > 0);
      game = playSingleWattenCard(game, legal[0].id);
      assert.ok(++moves <= count * 5);
    }
    assert.equal(game.scores.filter(score => score > 0).length, count === 3 ? 1 + Number(game.caller !== Number(game.lastTrickWinner)) : 2);
  }
});

test("singleplayer shows every cutting turn and deals five unique cards after cutting", () => {
  for (const count of [3, 4]) {
    for (let dealer = 0; dealer < count; dealer++) {
      const state = createSingleWattenRound(count, dealer);
      assert.equal(state.phase, "cut");
      assert.ok(state.hands.every(hand => hand.length === 0));
      const cutter = getPreviousPlayer(dealer, count);
      assert.throws(() => cutSingleWatten(state, 16, (cutter + 1) % count));
      const game = cutSingleWatten(state, 16, cutter);
      assert.ok(game.hands.every(hand => hand.length === 5));
      assert.equal(new Set(game.hands.flat().map(item => item.id)).size, count * 5);
    }
  }
});

test("singleplayer cutting awards consecutive critical cards to cutter and dealer", () => {
  for (const count of [3, 4]) {
    const state = createSingleWattenRound(count, 1), deck = createDeck();
    const critical = ["Herz-König", "Schellen-7"];
    const rest = deck.filter(card => !critical.includes(card.id));
    const ordered = [...rest.slice(0, 3), ...critical.map(id => deck.find(card => card.id === id)), ...rest.slice(3)];
    const game = cutSingleWatten({ ...state, deck: ordered }, 5);
    assert.deepEqual(game.cutCards.map(card => card.id), critical.toReversed());
    assert.ok(game.hands[0].some(card => card.id === "Schellen-7"));
    assert.ok(game.hands[1].some(card => card.id === "Herz-König"));
  }
});

test("custom target persists across rounds and determines bids and match completion", () => {
  const game = declareSingleWatten(dealtRound(3, 2, [8, 0, 0], 1, 11), "Herz", "Ober");
  const raised = raiseSingleWatten(game, 0);
  const roundOver = respondSingleWattenBid(raised, 1, false);
  assert.equal(roundOver.phase, "roundOver");
  const next = advanceSingleWatten(roundOver);
  assert.equal(next.targetScore, 11);
  assert.deepEqual(next.scores, [10, 0, 0]);
  assert.throws(() => raiseSingleWatten({ ...game, scores: [9, 0, 0] }, 0));
  const winning = respondSingleWattenBid({ ...raised, scores: [10, 0, 0] }, 1, false);
  assert.equal(winning.phase, "matchOver");
});

test("declining a raise awards the previously accepted value only once", () => {
  let game = declareSingleWatten(dealtRound(3), "Herz", "Ober");
  game = raiseSingleWatten(game, 0);
  assert.equal(game.pendingBid.value, 3);
  game = respondSingleWattenBid(game, 1, false);
  assert.equal(game.phase, "roundOver");
  assert.equal(game.scores[0], 2);
  assert.equal(game.scores[1], 0);
  assert.throws(() => respondSingleWattenBid(game, 1, false));
});

test("help compares only legal cards on the current public trick", () => {
  const hand = [card("Gras", "Ass"), card("Herz", "9"), card("Herz", "König")];
  const options = { hand, trick: [{ playerId: "1", card: card("Herz", "Ober") }], tricksWon: { "0": 0, "1": 0, "2": 0 }, trump: "Herz", schlag: "Ober", playerId: "0", active: true };
  assert.equal(getWattenHelpComparison({ ...options, card: hand[0] }), null);
  assert.equal(getWattenHelpComparison({ ...options, card: hand[1] }), false);
  assert.equal(getWattenHelpComparison({ ...options, card: hand[2] }), true);
  assert.equal(getWattenHelpComparison({ ...options, card: hand[2], active: false }), null);
  assert.equal(getWattenHelpComparison({ ...options, card: hand[2], trick: [] }), null);
  assert.equal(getWattenHelpComparison({ ...options, card: card("Schellen", "7") }), null);
  assert.equal(getWattenCardRole(card("Gras", "König"), "", "Herz", "Ober"), "Normale Karte");
});

test("a bid cannot be answered outside play or by an absent seat", () => {
  let game = declareSingleWatten(dealtRound(3), "Herz", "Ober");
  game = raiseSingleWatten(game, 0);
  assert.throws(() => respondSingleWattenBid(game, 3, true));
  assert.throws(() => respondSingleWattenBid({ ...game, phase: "roundOver" }, 1, true));
  assert.equal(respondSingleWattenBid(game, 1, true).roundValue, 3);
});

test("singleplayer rejects an illegal forced response without changing the trick", () => {
  const game = { ...declareSingleWatten(dealtRound(3), "Herz", "Ober"), turn: 0,
    hands: [[card("Gras", "Ass"), card("Herz", "9")], [], []],
    trick: [{ playerId: "1", card: card("Herz", "Ober") }] };
  assert.throws(() => playSingleWattenCard(game, "Gras-Ass"), /Illegal card/);
  assert.equal(game.trick.length, 1);
  assert.equal(playSingleWattenCard(game, "Herz-9").trick.length, 2);
});

test("singleplayer finishes at the target score and a fresh game resets scoring", () => {
  const deck = createDeck();
  const winningIds = ["Herz-König", "Schellen-7", "Eichel-7", "Gras-8", "Gras-9"];
  const rest = deck.filter(item => !winningIds.includes(item.id));
  let game = { ...declareSingleWatten(dealtRound(3), "Herz", "Ober"),
    hands: [winningIds.map(id => deck.find(item => item.id === id)), rest.slice(0, 5), rest.slice(5, 10)],
    scores: [14, 0, 0], turn: 0 };
  while (game.phase !== "matchOver") {
    if (game.phase === "trickPause") { game = advanceSingleWatten(game); continue; }
    const hand = game.hands[game.turn];
    game = playSingleWattenCard(game, hand.find(item => canPlayWattenCard(item, hand, game.trick, game.tricksWon, game.trump, game.schlag)).id);
  }
  assert.equal(game.scores[0], 16);
  assert.throws(() => advanceSingleWatten(game));
  assert.deepEqual(createSingleWattenRound(3).scores, [0, 0, 0]);
});
