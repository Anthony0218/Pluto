import test from "node:test";
import assert from "node:assert/strict";
import { getAvailableActions, validateDefinition } from "../src/games/cards/engine/index.ts";
import { durakTemplate as durak } from "../src/games/cards/templates/index.ts";
import { act, arrange, cardsOf, rejects, setRoles, start } from "./card-builder-helpers.mjs";

/** Two (or more) players, p0 attacking p1, spades trump, in the attack phase. */
function bout(zones, { players = 2, settings = {}, rest } = {}) {
  const state = start(durak, players, settings);
  arrange(state, zones, { rest });
  state.variables.trumpSuit = "spades";
  const roles = { p0: ["attacker", "thrower"], p1: ["defender"] };
  for (let seat = 2; seat < players; seat++) roles[`p${seat}`] = ["thrower"];
  setRoles(state, roles);
  state.currentPhase = "attack";
  state.currentPlayerId = "p0";
  return state;
}

test("Durak 6–A is valid configuration and deals a 36-card game", () => {
  const report = validateDefinition(durak);
  assert.deepEqual(report.errors, []);
  const state = start(durak, 3);
  for (const id of ["p0", "p1", "p2"]) assert.equal(state.zones[`hand:${id}`].cards.length, 6);
  assert.equal(Object.keys(state.cards).length, 36);
  assert.ok(state.cards["6h"], "the 6s are in the deck");
  assert.equal(state.zones.drawPile.cards.length, 36 - 18);
  const trumpCard = state.cards[state.zones.drawPile.cards[0]];
  assert.equal(state.variables.trumpSuit, trumpCard.suit, "trump comes from the card under the pile");
  assert.ok(state.faceUp[trumpCard.id], "the trump card is face up");
  assert.equal(state.currentPhase, "attack");
  const attacker = state.players.find((player) => player.roles.includes("attacker"));
  const defender = state.players.find((player) => player.roles.includes("defender"));
  assert.equal(defender.seat, (attacker.seat + 1) % 3, "the defender sits after the attacker");
});

test("a higher card of the same suit defends; a successful defence discards the table", () => {
  let state = bout({ "hand:p0": ["8h", "9c"], "hand:p1": ["10h", "7d"], drawPile: [] }, { rest: "drawPile" });
  state = act(durak, state, "p0", { actionId: "attack", cardId: "8h" });
  assert.equal(state.currentPhase, "defend");
  state = act(durak, state, "p1", { actionId: "defend", cardId: "10h", targetCardId: "8h" });
  // p0 has no 8 or 10 to throw in, so they pass automatically and the bout resolves.
  assert.ok(cardsOf(state, "discardPile").includes("8h") && cardsOf(state, "discardPile").includes("10h"));
  assert.deepEqual(cardsOf(state, "attackTable"), []);
  assert.equal(state.currentPhase, "attack");
  assert.ok(state.players.find((player) => player.id === "p1").roles.includes("attacker"), "the successful defender attacks next");
});

test("a lower card of the same suit cannot defend", () => {
  let state = bout({ "hand:p0": ["9h"], "hand:p1": ["7h", "Jc"], drawPile: ["Qd"] });
  state = act(durak, state, "p0", { actionId: "attack", cardId: "9h" });
  rejects(durak, state, "p1", { actionId: "defend", cardId: "7h", targetCardId: "9h" }, /cannot be played on/);
  const defend = getAvailableActions(durak, state, "p1").find((action) => action.actionId === "defend");
  assert.equal(defend, undefined, "no legal defence is offered");
  assert.ok(getAvailableActions(durak, state, "p1").some((action) => action.actionId === "take"));
});

test("any trump beats a non-trump, but a lower trump cannot beat a higher trump", () => {
  let state = bout({ "hand:p0": ["Ah", "Kd"], "hand:p1": ["7s", "8d"], drawPile: ["Qd"] });
  state = act(durak, state, "p0", { actionId: "attack", cardId: "Ah" });
  state = act(durak, state, "p1", { actionId: "defend", cardId: "7s", targetCardId: "Ah" });
  assert.ok(cardsOf(state, "discardPile").includes("7s"), "the trump beat the ace and the bout was discarded");

  let trumps = bout({ "hand:p0": ["10s"], "hand:p1": ["8s", "Js"], drawPile: ["Qd"] });
  trumps = act(durak, trumps, "p0", { actionId: "attack", cardId: "10s" });
  rejects(durak, trumps, "p1", { actionId: "defend", cardId: "8s", targetCardId: "10s" });
  trumps = act(durak, trumps, "p1", { actionId: "defend", cardId: "Js", targetCardId: "10s" });
  assert.equal(trumps.marks["10s"]?.covered, undefined, "marks are cleared once the table is discarded");
  assert.ok(cardsOf(trumps, "discardPile").includes("10s"));
});

test("throw-ins must match a rank already on the table and respect the limits", () => {
  let state = bout({ "hand:p0": ["8h", "8d", "9c", "8c"], "hand:p1": ["Kc", "Qc"], drawPile: ["Qd"] });
  state = act(durak, state, "p0", { actionId: "attack", cardId: "8h" });
  rejects(durak, state, "p0", { actionId: "throwIn", cardId: "9c" }, /cannot be played now/);
  state = act(durak, state, "p0", { actionId: "throwIn", cardId: "8d" });
  assert.deepEqual(cardsOf(state, "attackTable"), ["8h", "8d"]);
  // Two uncovered attacks and the defender holds two cards: no third card may be added.
  rejects(durak, state, "p0", { actionId: "throwIn", cardId: "8c" }, /cannot be played now/);
});

test("taking moves every table card into the defender's hand", () => {
  let state = bout({ "hand:p0": ["8h", "8d", "9c"], "hand:p1": ["Kc", "Qc", "7d"], drawPile: [] });
  state = act(durak, state, "p0", { actionId: "attack", cardId: "8h" });
  state = act(durak, state, "p0", { actionId: "throwIn", cardId: "8d" });
  state = act(durak, state, "p1", { actionId: "take" });
  // Throw-in phase: p0 has only 9c, which matches nothing, so the bout resolves straight away.
  for (const card of ["8h", "8d", "Kc", "Qc", "7d"]) assert.ok(cardsOf(state, "hand:p1").includes(card), `${card} is in the defender's hand`);
  assert.deepEqual(cardsOf(state, "attackTable"), []);
  const p0 = state.players.find((player) => player.id === "p0");
  assert.ok(p0.roles.includes("attacker"), "after taking, the defender is skipped: the next player attacks");
});

test("refill draws attacker first, defender last, up to the hand size", () => {
  let state = bout({ "hand:p0": ["8h", "9c", "Jc"], "hand:p1": ["10h", "Jd", "Qd"], drawPile: ["7c", "7d", "7h"] }, { settings: { handSize: 4 } });
  state = act(durak, state, "p0", { actionId: "attack", cardId: "8h" });
  state = act(durak, state, "p1", { actionId: "defend", cardId: "10h", targetCardId: "8h" });
  assert.deepEqual(cardsOf(state, "hand:p0").sort(), ["7d", "7h", "9c", "Jc"].sort(), "the attacker drew the top two cards");
  assert.deepEqual(cardsOf(state, "hand:p1").sort(), ["7c", "Jd", "Qd"].sort(), "the defender got what was left");
  assert.equal(cardsOf(state, "drawPile").length, 0);
});

test("an empty hand only finishes a player once the draw pile is gone", () => {
  let refilled = bout({ "hand:p0": ["8h"], "hand:p1": ["10h", "Jd"], drawPile: ["7c", "7d", "9d", "Ac"] });
  refilled = act(durak, refilled, "p0", { actionId: "attack", cardId: "8h" });
  refilled = act(durak, refilled, "p1", { actionId: "defend", cardId: "10h", targetCardId: "8h" });
  const p0 = refilled.players.find((player) => player.id === "p0");
  assert.equal(p0.status, "active", "the pile still had cards, so p0 refilled and plays on");
  assert.ok(refilled.zones["hand:p0"].cards.length > 0);
  assert.equal(refilled.status, "playing");
});

test("several players can finish; the final player holding cards loses", () => {
  let state = bout({ "hand:p0": ["8h"], "hand:p1": ["10h", "Jd"], "hand:p2": ["9c", "7d"], drawPile: [] }, { players: 3 });
  state = act(durak, state, "p0", { actionId: "attack", cardId: "8h" });
  state = act(durak, state, "p1", { actionId: "defend", cardId: "10h", targetCardId: "8h" });
  const byId = (id) => state.players.find((player) => player.id === id);
  assert.equal(byId("p0").status, "finished");
  assert.equal(byId("p0").finishPlace, 1);
  assert.equal(state.status, "playing", "two players are still in");
  assert.ok(byId("p1").roles.includes("attacker"));
  assert.ok(byId("p2").roles.includes("defender"));

  state = act(durak, state, "p1", { actionId: "attack", cardId: "Jd" });
  rejects(durak, state, "p2", { actionId: "defend", cardId: "9c", targetCardId: "Jd" });
  state = act(durak, state, "p2", { actionId: "take" });
  assert.equal(state.status, "finished");
  assert.deepEqual(state.result.losers, ["p2"]);
  assert.deepEqual(state.result.winners.sort(), ["p0", "p1"]);
  assert.equal(state.players.find((player) => player.id === "p2").result, "loser");
});

test("transfer mode passes the attack on with a card of the same rank", () => {
  let state = bout({ "hand:p0": ["8h", "Qc"], "hand:p1": ["8d", "Kc"], "hand:p2": ["9c", "7d", "Jh"], drawPile: ["Ad"] }, { players: 3, settings: { transferEnabled: true } });
  state = act(durak, state, "p0", { actionId: "attack", cardId: "8h" });
  state = act(durak, state, "p1", { actionId: "transfer", cardId: "8d" });
  const roles = Object.fromEntries(state.players.map((player) => [player.id, player.roles]));
  assert.ok(roles.p1.includes("attacker") && roles.p2.includes("defender"));
  assert.deepEqual(cardsOf(state, "attackTable"), ["8h", "8d"]);

  const off = bout({ "hand:p0": ["8h", "Qc"], "hand:p1": ["8d", "Kc"], "hand:p2": ["9c", "7d", "Jh"], drawPile: ["Ad"] }, { players: 3 });
  const next = act(durak, off, "p0", { actionId: "attack", cardId: "8h" });
  assert.ok(!getAvailableActions(durak, next, "p1").some((action) => action.actionId === "transfer"), "transfer is a lobby option");
});

test("only the attacker may lead and only the defender may beat", () => {
  const state = bout({ "hand:p0": ["8h"], "hand:p1": ["10h"], drawPile: ["Ad"] });
  rejects(durak, state, "p1", { actionId: "attack", cardId: "10h" }, /not your turn/);
  const next = act(durak, state, "p0", { actionId: "attack", cardId: "8h" });
  rejects(durak, next, "p0", { actionId: "defend", cardId: "10h", targetCardId: "8h" }, /not your turn/);
});

test("the 6s are the lowest cards: a 7 beats a 6 of the same suit", () => {
  let state = bout({ "hand:p0": ["6h", "Kc"], "hand:p1": ["7h", "6d"], drawPile: ["Qd"] });
  state = act(durak, state, "p0", { actionId: "attack", cardId: "6h" });
  state = act(durak, state, "p1", { actionId: "defend", cardId: "7h", targetCardId: "6h" });
  assert.ok(cardsOf(state, "discardPile").includes("6h"));
});
