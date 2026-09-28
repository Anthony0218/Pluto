import test from "node:test";
import assert from "node:assert/strict";
import { chooseBotCard, getLegalBotMoves } from "../src/games/watten/bot.ts";
import { advanceSingleWatten, createSingleWattenRound, cutSingleWatten, declareSingleWatten, playSingleWattenCard, raiseSingleWatten, respondSingleWattenBid, teamOf } from "../src/games/watten/singleplayer.ts";
import { canPlayWattenCard, createDeck } from "../src/utils/watten.ts";
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
