import test from "node:test";
import assert from "node:assert/strict";
import { chooseBotCard, getLegalBotMoves } from "../src/games/watten/bot.ts";
import { advanceSingleWatten, createSingleWattenRound, cutSingleWatten, declareSingleWatten, playSingleWattenCard, raiseSingleWatten, respondSingleWattenBid, teamOf } from "../src/games/watten/singleplayer.ts";
import { canPlayWattenCard, createDeck, getWattenCardRole } from "../src/utils/watten.ts";
import { getWattenHelpComparison } from "../src/games/watten/help.ts";
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
    let game = createSingleWattenRound(count);
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

test("singleplayer cut awards consecutive critical cards and deals five unique cards", () => {
  for (const count of [3, 4]) {
    const start = createSingleWattenRound(count, 1);
    assert.equal(start.phase, "cut");
    const deck = createDeck();
    const critical = ["Herz-König", "Schellen-7"];
    const ordered = [...deck.filter(item => !critical.includes(item.id)).slice(0, 3),
      ...critical.map(id => deck.find(item => item.id === id)),
      ...deck.filter(item => !critical.includes(item.id)).slice(3)];
    const game = cutSingleWatten({ ...start, deck: ordered }, 5);
    assert.deepEqual(game.cutCards.map(item => item.id), critical.toReversed());
    assert.ok(game.hands.every(hand => hand.length === 5));
    assert.equal(new Set(game.hands.flat().map(item => item.id)).size, count * 5);
    assert.equal(game.hands[0].some(item => item.id === "Schellen-7"), true);
    assert.equal(game.hands[1].some(item => item.id === "Herz-König"), true);
  }
});

test("declining a raise awards the previously accepted value only once", () => {
  let game = declareSingleWatten(createSingleWattenRound(3), "Herz", "Ober");
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
  let game = declareSingleWatten(createSingleWattenRound(3), "Herz", "Ober");
  game = raiseSingleWatten(game, 0);
  assert.throws(() => respondSingleWattenBid(game, 3, true));
  assert.throws(() => respondSingleWattenBid({ ...game, phase: "roundOver" }, 1, true));
  assert.equal(respondSingleWattenBid(game, 1, true).roundValue, 3);
});

test("singleplayer rejects an illegal forced response without changing the trick", () => {
  const game = { ...declareSingleWatten(createSingleWattenRound(3), "Herz", "Ober"), turn: 0,
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
  let game = { ...declareSingleWatten(createSingleWattenRound(3), "Herz", "Ober"),
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
