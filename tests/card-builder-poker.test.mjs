import test from "node:test";
import assert from "node:assert/strict";
import { POKER_COMBINATIONS, bestCombination, chooseBotAction, compareScores, generateDeck, getAvailableActions, validateDefinition } from "../src/games/cards/engine/index.ts";
import { pokerTemplate as poker } from "../src/games/cards/templates/index.ts";
import { act, arrange, rejects, start } from "./card-builder-helpers.mjs";

const deck = Object.fromEntries(generateDeck(poker.deck).map((card) => [card.id, card]));
const cards = (...ids) => ids.map((id) => deck[id]);
const order = poker.deck.rankOrder;
const best = (...ids) => bestCombination(cards(...ids), poker.combinations, order, 5);
const chipsInPlay = (state) => state.players.reduce((sum, player) => sum + player.score, 0) + Number(state.variables.pot);
const actions = (state, id) => getAvailableActions(poker, state, id).map((action) => action.actionId).sort();

test("Short-Deck Poker is valid and deals hold'em hands from 36 cards", () => {
  assert.deepEqual(validateDefinition(poker).errors, []);
  const state = start(poker, 3);
  assert.equal(Object.keys(state.cards).length, 36);
  for (const player of state.players) assert.equal(state.zones[`hand:${player.id}`].cards.length, 2);
  assert.equal(state.currentPhase, "betting");
  assert.equal(state.variables.pot, 3, "three antes");
  assert.deepEqual(state.players.map((player) => player.score), [49, 49, 49]);
  assert.equal(state.currentPlayerId, "p1", "the player after the dealer acts first");
});

test("combinations: declarative ladder, short-deck order and tie-breakers", () => {
  assert.equal(best("Ah", "Kh", "9h", "7h", "6h", "As", "Ad").name, "Flush", "a flush beats a full house in short deck");
  assert.equal(best("Ah", "Ad", "As", "Kc", "Kd", "7h", "8s").name, "Full house");
  assert.ok(compareScores(best("Ah", "Kh", "9h", "7h", "6h").score, best("Ac", "Ad", "As", "Kc", "Kd").score) > 0);
  assert.equal(best("Ah", "6c", "7d", "8s", "9h").name, "Straight", "an Ace may count low (A-6-7-8-9)");
  assert.equal(best("Kh", "Ah", "6c", "7d", "8s").name, "High card", "but straights never wrap around K-A-6");
  assert.equal(best("10h", "Jh", "Qh", "Kh", "Ah", "9c", "9d").name, "Straight flush");
  const kingKicker = best("Ah", "Ad", "Kc", "8s", "7h");
  const queenKicker = best("As", "Ac", "Qc", "8d", "7d");
  assert.ok(compareScores(kingKicker.score, queenKicker.score) > 0, "kickers break ties between equal pairs");
  assert.equal(compareScores(best("Ah", "Ad", "Kc", "8s", "7h").score, best("As", "Ac", "Kd", "8c", "7d").score), 0, "identical ranks split");
  // The regular ladder is just the list in its original order.
  assert.equal(POKER_COMBINATIONS.findIndex((entry) => entry.id === "full-house") > POKER_COMBINATIONS.findIndex((entry) => entry.id === "flush"), true);
});

test("betting: check, bet, call, raise and fold appear only when they make sense", () => {
  let state = start(poker, 2, { raiseCap: 1 }, 5);
  const first = state.currentPlayerId;
  const second = first === "p0" ? "p1" : "p0";
  assert.deepEqual(actions(state, first), ["bet", "check"]);
  assert.deepEqual(actions(state, second), [], "only the current player acts");
  state = act(poker, state, first, { actionId: "bet" });
  assert.equal(state.variables.currentBet, 2);
  assert.deepEqual(actions(state, second), ["call", "fold", "raise"]);
  state = act(poker, state, second, { actionId: "raise" });
  assert.equal(state.variables.currentBet, 4);
  assert.deepEqual(actions(state, first), ["call", "fold"], "the raise cap is reached");
  rejects(poker, state, first, { actionId: "raise" }, /not available/);
  state = act(poker, state, first, { actionId: "call" });
  assert.equal(state.variables.street, 1, "everyone matched: the flop comes");
  assert.equal(state.zones.board.cards.length, 3);
  assert.equal(state.variables.pot, 2 + 4 + 4);
  assert.equal(chipsInPlay(state), 100);
});

test("folding hands the pot to the last player in", () => {
  let state = start(poker, 3, {}, 8);
  const order = [state.currentPlayerId];
  state = act(poker, state, order[0], { actionId: "bet" });
  order.push(state.currentPlayerId);
  state = act(poker, state, order[1], { actionId: "fold" });
  assert.ok(!state.players.find((player) => player.id === order[1]).roles.includes("inHand"));
  order.push(state.currentPlayerId);
  assert.notEqual(order[2], order[1], "folded players are skipped");
  const before = state.players.find((player) => player.id === order[0]).score;
  state = act(poker, state, order[2], { actionId: "fold" });
  assert.equal(state.roundNumber, 2, "the next hand has started");
  const winner = state.players.find((player) => player.id === order[0]);
  assert.equal(winner.score, before + 5 - 1, "won the 3 antes + the bet back, then paid the next ante");
  assert.equal(chipsInPlay(state), 150);
});

test("a showdown pays the best hand, splitting ties", () => {
  let state = start(poker, 2, { ante: 1 }, 2);
  arrange(state, { "hand:p0": ["Ah", "Ad"], "hand:p1": ["Kc", "Kd"], deck: ["6s", "7c", "9d", "Jh", "Qs"] }, {});
  state.variables.pot = 2;
  for (let i = 0; i < 4; i++) {
    state = act(poker, state, state.currentPlayerId, { actionId: "check" });
    state = act(poker, state, state.currentPlayerId, { actionId: "check" });
  }
  assert.ok(state.log.some((entry) => /P0 shows Pair: A/.test(entry.text)));
  assert.equal(state.players[0].score, 49 + 2 - 1, "won the pot of 2 antes, then paid the next ante");
  assert.equal(state.players[1].score, 49 - 1);

  let split = start(poker, 2, { ante: 1 }, 2);
  arrange(split, { "hand:p0": ["6h", "7h"], "hand:p1": ["6c", "7c"], deck: ["Ad", "Ac", "As", "Kd", "Ks"] }, {});
  split.variables.pot = 2;
  for (let i = 0; i < 8; i++) split = act(poker, split, split.currentPlayerId, { actionId: "check" });
  assert.deepEqual(split.players.map((player) => player.score), [49, 49], "the board plays: each gets their ante back, then pays the next one");
});

test("bots play full games and never create or lose chips", () => {
  for (const [count, seed] of [[2, 1], [4, 2], [6, 3]]) {
    let state = start(poker, count, { handLimit: 15 }, seed);
    for (let i = 0; i < 5000 && state.status === "playing"; i++) {
      const actor = state.players.find((player) => chooseBotAction(poker, state, player.id));
      state = act(poker, state, actor.id, chooseBotAction(poker, state, actor.id));
      assert.equal(chipsInPlay(state), count * 50);
    }
    assert.equal(state.status, "finished");
    assert.ok(state.result.winners.length >= 1);
  }
});
