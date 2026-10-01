import test from "node:test";
import assert from "node:assert/strict";
import { validateDefinition } from "../src/games/cards/engine/index.ts";
import { highCardBattleTemplate as hcb, kingsAndSevensTemplate as kas } from "../src/games/cards/templates/index.ts";
import { act, arrange, cardsOf, rejects, start } from "./card-builder-helpers.mjs";

const reveal = (def, state) => act(def, act(def, state, "p0", { actionId: "reveal" }), "p1", { actionId: "reveal" });
const total = (state) => Object.values(state.zones).reduce((sum, zone) => sum + zone.cards.length, 0);

/** Stacks are bottom → top. */
function battle(stack0, stack1, settings = {}, def = hcb) {
  const state = start(def, 2, { shuffleWinnings: false, ...settings });
  return arrange(state, { "stack:p0": stack0, "stack:p1": stack1 });
}

test("High Card Battle is valid and splits the deck evenly", () => {
  assert.deepEqual(validateDefinition(hcb).errors, []);
  const state = start(hcb, 2);
  assert.equal(state.zones["stack:p0"].cards.length, 16);
  assert.equal(state.zones["stack:p1"].cards.length, 16);
  assert.equal(state.currentPhase, "reveal");
});

test("the higher card wins both cards", () => {
  let state = battle(["7c", "Ah"], ["8c", "7d"]);
  state = act(hcb, state, "p0", { actionId: "reveal" });
  assert.ok(state.faceUp.Ah, "revealed cards are face up");
  rejects(hcb, state, "p0", { actionId: "reveal" }, /not available/);
  state = act(hcb, state, "p1", { actionId: "reveal" });
  assert.deepEqual(cardsOf(state, "stack:p0"), ["Ah", "7d", "7c"], "won cards go under the winner's stack");
  assert.deepEqual(cardsOf(state, "stack:p1"), ["8c"]);
  assert.equal(state.players[0].score, 1);
  assert.equal(state.currentPhase, "reveal");
  assert.equal(state.roundNumber, 2);
});

test("a tie starts a battle: face-down cards, then reveal again", () => {
  let state = battle(["Kh", "8h", "9h"], ["7c", "8c", "9c"]);
  state = act(hcb, state, "p0", { actionId: "reveal" });
  const result = act(hcb, state, "p1", { actionId: "reveal" });
  state = result;
  assert.equal(state.variables.tied, true);
  assert.ok(state.log.some((entry) => entry.ruleId === "tie"), "the tie rule fired");
  assert.equal(state.currentPhase, "reveal");
  assert.deepEqual(cardsOf(state, "table:p0"), ["9h", "8h"]);
  assert.deepEqual(cardsOf(state, "table:p1"), ["9c", "8c"]);
  assert.ok(!state.faceUp["8h"] && !state.faceUp["8c"], "battle cards are face down");
  assert.equal(state.roundNumber, 1, "the round is still open");

  state = reveal(hcb, state);
  assert.equal(cardsOf(state, "stack:p0").length, 6, "the winner takes all six cards");
  assert.equal(cardsOf(state, "table:p0").length + cardsOf(state, "table:p1").length, 0);
});

test("repeated ties keep growing the pot until someone wins — and taking every card ends the game", () => {
  let state = battle(["Kh", "7h", "10h", "8h", "9h"], ["7c", "8s", "10c", "8c", "9c"]);
  const before = total(state);
  state = reveal(hcb, state); // 9 v 9
  state = reveal(hcb, state); // 10 v 10
  assert.equal(cardsOf(state, "table:p0").length, 4);
  assert.equal(total(state), before, "no card is created or lost");
  state = reveal(hcb, state); // K v 7
  assert.equal(cardsOf(state, "stack:p0").length, 10);
  assert.equal(total(state), before);
  assert.equal(state.status, "finished");
  assert.deepEqual(state.result.winners, ["p0"]);
  assert.equal(state.result.endConditionId, "all-cards");
});

test("a player who cannot continue a battle loses", () => {
  let state = battle(["Kh", "Ah", "9h"], ["9c"]);
  state = reveal(hcb, state); // tie; p1 has nothing to put face down or reveal
  assert.equal(state.status, "finished");
  assert.deepEqual(state.result.winners, ["p0"]);
  assert.equal(state.players[1].status, "eliminated");
});

test("tie behaviour is configurable", () => {
  let returned = battle(["Ah", "9h"], ["Kc", "9c"], { tieMode: "returnCards" });
  returned = reveal(hcb, returned);
  assert.deepEqual(cardsOf(returned, "stack:p0"), ["9h", "Ah"], "each card goes back under its owner's stack");
  assert.deepEqual(cardsOf(returned, "stack:p1"), ["9c", "Kc"]);

  let discarded = battle(["Ah", "9h"], ["Kc", "9c"], { tieMode: "discard" });
  discarded = reveal(hcb, discarded);
  assert.deepEqual(cardsOf(discarded, "discardPile").sort(), ["9c", "9h"]);

  let twoDown = battle(["Ah", "Kh", "Qh", "9h"], ["Kc", "Qc", "Jc", "9c"], { tieFaceDownCards: 2 });
  twoDown = reveal(hcb, twoDown);
  assert.equal(cardsOf(twoDown, "table:p0").length, 3, "the revealed card plus two face-down cards");
});

test("captured-pile collection recycles cards when a stack runs out", () => {
  let state = battle(["8h", "Ah"], ["Kc", "7d"], { collectTo: "capturedPile" });
  state = reveal(hcb, state);
  assert.deepEqual(cardsOf(state, "captured:p0").sort(), ["7d", "Ah"]);
  state = reveal(hcb, state); // 8h v Kc: p1 wins; p0's stack is now empty
  assert.equal(cardsOf(state, "stack:p0").length, 2, "captured cards were shuffled into the empty stack");
  assert.equal(cardsOf(state, "captured:p0").length, 0);
  assert.ok(state.log.some((entry) => entry.ruleId === "reshuffle-captured"));
});

test("the round limit ends long games with the player holding more cards", () => {
  let state = start(hcb, 2, { maxRounds: 10 }, 3);
  for (let i = 0; i < 200 && state.status === "playing"; i++) state = reveal(hcb, state);
  assert.equal(state.status, "finished");
  assert.ok(["round-limit", "all-cards", "last-standing"].includes(state.result.endConditionId));
  if (state.result.endConditionId === "round-limit") assert.equal(state.roundNumber, 11);
});

/* -------------------------------------------------------- Kings & Sevens */

function duel(top0, top1) {
  const state = start(kas, 2, { shuffleWinnings: false });
  arrange(state, { "stack:p0": ["Qd", top0], "stack:p1": ["Jd", top1] });
  return reveal(kas, state);
}
const roundWinner = (state) => state.players.find((player) => player.score > 0)?.id;

test("rule priority: special rules override the general higher-card rule", () => {
  assert.deepEqual(validateDefinition(kas).errors, []);
  assert.equal(roundWinner(duel("7c", "Ac")), "p0", "7 beats Ace (priority 100)");
  assert.equal(roundWinner(duel("Ac", "7d")), "p1", "…for either seat");
  assert.equal(roundWinner(duel("Kc", "Ad")), "p0", "King beats Ace (priority 50 overrides higher rank)");
  assert.equal(roundWinner(duel("Kc", "7d")), "p1", "but a 7 beats a King");
  assert.equal(roundWinner(duel("9c", "8d")), "p0", "otherwise the higher card wins (priority 10)");
  const tied = duel("9c", "9d");
  assert.equal(tied.variables.tied, true);
  assert.equal(roundWinner(tied), undefined);
  const fired = duel("7c", "Ac").log.filter((entry) => entry.kind === "rule").map((entry) => entry.ruleId);
  assert.deepEqual(fired, ["seven-topples-seat-1"], "stopProcessing keeps lower-priority rules from running");
});

test("hearts score bonus points and the first to the target wins", () => {
  const hearts = duel("Kh", "9h");
  assert.equal(hearts.players[0].score, 3, "1 for the win + 2 hearts");

  let state = start(kas, 2, { targetScore: 5 }, 11);
  for (let i = 0; i < 100 && state.status === "playing"; i++) state = reveal(kas, state);
  assert.equal(state.status, "finished");
  const winner = state.players.find((player) => player.result === "winner");
  assert.ok(winner.score >= 5 || state.result.endConditionId === "out-of-cards");
});
