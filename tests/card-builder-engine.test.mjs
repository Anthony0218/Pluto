import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RANK_ORDER,
  GameSetupError,
  Runtime,
  STANDARD_DECK,
  chooseBotAction,
  compareRanks,
  createGame,
  evaluateCondition,
  generateDeck,
  getAvailableActions,
  getPlayerView,
  parseState,
  performAction,
  registerCondition,
  serializeState,
} from "../src/games/cards/engine/index.ts";
import { blankTemplate as blank, durakTemplate as durak, highCardBattleTemplate as hcb } from "../src/games/cards/templates/index.ts";
import { act, arrange, rejects, start } from "./card-builder-helpers.mjs";

const clone = (value) => structuredClone(value);
const reveal = (def, state) => act(def, act(def, state, "p0", { actionId: "reveal" }), "p1", { actionId: "reveal" });

test("deck generation: 32 distinct cards, configurable subsets and copies", () => {
  const deck = generateDeck(STANDARD_DECK);
  assert.equal(deck.length, 32);
  assert.equal(new Set(deck.map((card) => card.id)).size, 32);
  assert.deepEqual(deck.slice(0, 3).map((card) => card.id), ["7c", "8c", "9c"]);
  assert.ok(deck.some((card) => card.id === "10h" && card.rank === "10" && card.suit === "hearts"));
  const small = generateDeck({ ...STANDARD_DECK, ranks: ["J", "Q", "K", "A"], suits: ["hearts", "spades"], copies: 2 });
  assert.equal(small.length, 16);
  assert.ok(small.some((card) => card.id === "Ah#2"));
  assert.equal(generateDeck({ ...STANDARD_DECK, suits: [] }).length, 0);
});

test("rank comparison follows each game's own order", () => {
  assert.ok(compareRanks(DEFAULT_RANK_ORDER, "A", "7") > 0);
  const lowball = ["A", "K", "Q", "J", "10", "9", "8", "7"];
  assert.ok(compareRanks(lowball, "A", "7") < 0);

  // The same High Card Battle rules with a reversed order: now 7 beats Ace.
  const reversed = { ...clone(hcb), deck: { ...clone(hcb.deck), rankOrder: lowball } };
  let state = arrange(start(reversed, 2, { shuffleWinnings: false }), { "stack:p0": ["8d", "7c"], "stack:p1": ["8s", "Ah"] });
  state = reveal(reversed, state);
  assert.equal(state.players[0].score, 1, "the 7 won under the reversed order");
});

test("cards move between zones through the engine and emit zone events", () => {
  const state = arrange(start(blank, 2), { "hand:p0": ["7h"], drawPile: ["8h"] });
  const rt = new Runtime(blank, state);
  rt.moveCard("7h", "discardPile", { faceUp: true });
  assert.deepEqual(state.zones["hand:p0"].cards, []);
  assert.deepEqual(state.zones.discardPile.cards, ["7h"]);
  const types = rt.emitted.map((event) => event.type);
  assert.deepEqual(types, ["CARD_REVEALED", "ZONE_EMPTY", "HAND_EMPTY"]);
  rt.moveCard("8h", "hand:p1", { drawn: true });
  assert.ok(rt.emitted.some((event) => event.type === "DRAW_PILE_EMPTY"));
  assert.ok(rt.emitted.some((event) => event.type === "CARD_DRAWN" && event.playerId === "p1"));
});

test("player permissions: only the current player may act in a turn-based phase", () => {
  let state = arrange(start(blank, 2), { "hand:p0": ["7h", "8h"], "hand:p1": ["9h", "10h"], drawPile: ["Jh", "Qh"] });
  assert.deepEqual(getAvailableActions(blank, state, "p1"), []);
  rejects(blank, state, "p1", { actionId: "play", cardId: "9h" }, /not your turn/);
  rejects(blank, state, "p0", { actionId: "play", cardId: "9h" }, /cannot be played/, "p0 cannot play p1's card");
  state = act(blank, state, "p0", { actionId: "play", cardId: "7h" });
  assert.equal(state.currentPlayerId, "p1");
  assert.equal(state.turnNumber, 2);
});

test("phase transitions: conditional, effect-driven and automatic chains", () => {
  let state = arrange(start(durak, 2), { "hand:p0": ["8h", "9c"], "hand:p1": ["Kc", "7d"], drawPile: ["Ad", "Ac", "As"] });
  state.variables.trumpSuit = "spades";
  const result = performAction(durak, state, state.currentPlayerId, { actionId: "attack", cardId: state.currentPlayerId === "p0" ? "8h" : "Kc" });
  assert.ok(result.ok);
  assert.equal(result.state.currentPhase, "defend", "attack → defend once a card is on the table");
  const defender = result.state.players.find((player) => player.roles.includes("defender")).id;
  const taken = performAction(durak, result.state, defender, { actionId: "take" });
  assert.ok(taken.ok);
  const phases = taken.events.filter((event) => event.type === "PHASE_STARTED").map((event) => event.phase);
  assert.deepEqual(phases, ["throwIn", "resolve", "refill", "attack"], "take jumps to throw-in; resolve and refill run automatically");
});

test("events trigger rules, and rules can veto attempts", () => {
  const scoring = clone(blank);
  scoring.rules = [
    { id: "hearts", name: "Hearts score", trigger: "CARD_PLAYED", condition: { type: "suitEquals", card: "played", suit: "hearts" }, effects: [{ type: "incrementScore", player: "eventPlayer", amount: 1 }] },
    { id: "no-aces", name: "Aces are banned", trigger: "CARD_PLAY_ATTEMPT", condition: { type: "rankEquals", card: "played", rank: "A" }, effects: [{ type: "rejectAction", reason: "Aces may not be played." }] },
  ];
  let state = arrange(start(scoring, 2), { "hand:p0": ["7h", "Ac", "8c"], "hand:p1": ["8h", "9h"], drawPile: ["Jh"] });
  rejects(scoring, state, "p0", { actionId: "play", cardId: "Ac" }, /Aces may not be played/);
  state = act(scoring, state, "p0", { actionId: "play", cardId: "7h" });
  assert.equal(state.players[0].score, 1);
  state = act(scoring, state, "p1", { actionId: "play", cardId: "8h" });
  state = act(scoring, state, "p0", { actionId: "play", cardId: "8c" });
  assert.deepEqual(state.players.map((player) => player.score), [1, 1]);
});

test("rule priority: higher priority runs first and stopProcessing shadows the rest", () => {
  const def = clone(blank);
  def.variables = [{ key: "verdict", initial: null }];
  def.rules = [
    { id: "general", name: "General", trigger: "CARD_PLAYED", priority: 10, effects: [{ type: "setVariable", var: "verdict", value: "general" }] },
    { id: "special", name: "Special", trigger: "CARD_PLAYED", priority: 100, stopProcessing: true, condition: { type: "rankEquals", card: "played", rank: "7" }, effects: [{ type: "setVariable", var: "verdict", value: "special" }] },
  ];
  let state = arrange(start(def, 2), { "hand:p0": ["7h"], "hand:p1": ["8h", "9d"], drawPile: ["Jh"] });
  state = act(def, state, "p0", { actionId: "play", cardId: "7h" });
  assert.equal(state.status, "finished");
  assert.equal(state.variables.verdict, "special");
  let other = arrange(start(def, 2), { "hand:p0": ["8c", "9c"], "hand:p1": ["8h", "9d"], drawPile: ["Jh"] });
  other = act(def, other, "p0", { actionId: "play", cardId: "8c" });
  assert.equal(other.variables.verdict, "general");
  // Disabled rules never run.
  def.rules[1].enabled = false;
  let disabled = arrange(start(def, 2), { "hand:p0": ["7c", "9c"], "hand:p1": ["8h", "9d"], drawPile: ["Jh"] });
  disabled = act(def, disabled, "p0", { actionId: "play", cardId: "7c" });
  assert.equal(disabled.variables.verdict, "general");
});

test("nested AND / OR / NOT conditions", () => {
  const state = arrange(start(durak, 2), { attackTable: ["9h"], "hand:p0": ["Jh", "7s", "Ac"] });
  state.variables.trumpSuit = "spades";
  const rt = new Runtime(durak, state);
  const beats = durak.actions.find((action) => action.id === "defend").cardCondition;
  const check = (played) => evaluateCondition(beats, rt, { played, target: "9h" });
  assert.equal(check("Jh"), true, "same suit, higher");
  assert.equal(check("7s"), true, "trump on a non-trump");
  assert.equal(check("Ac"), false, "off-suit, not trump");
  const nested = {
    type: "and",
    children: [
      { type: "or", children: [{ type: "rankEquals", card: "played", rank: "A" }, { type: "suitEquals", card: "played", suit: "hearts" }] },
      { type: "not", child: { type: "or", children: [{ type: "isTrump", card: "played" }, { type: "rankEquals", card: "played", rank: "J" }] } },
    ],
  };
  assert.deepEqual(["Jh", "7s", "Ac"].map((played) => evaluateCondition(nested, rt, { played })), [false, false, true]);
  assert.equal(evaluateCondition({ type: "and", children: [] }, rt, {}), true);
  assert.equal(evaluateCondition({ type: "or", children: [] }, rt, {}), false);
  assert.equal(evaluateCondition({ type: "noSuchCondition" }, rt, {}), false, "unknown types never pass");
});

test("additional condition types can be registered by trusted code", () => {
  registerCondition({
    type: "test-isFaceCard",
    label: "Card is a face card",
    category: "card",
    params: [{ key: "card", kind: "card", label: "Card" }],
    describe: () => "the card is a face card",
    evaluate: (params, rt, scope) => ["J", "Q", "K"].includes(rt.state.cards[scope.played]?.rank),
  });
  const state = arrange(start(blank, 2), { "hand:p0": ["Kh"] });
  assert.equal(evaluateCondition({ type: "test-isFaceCard", card: "played" }, new Runtime(blank, state), { played: "Kh" }), true);
});

test("invalid actions are rejected without touching the state", () => {
  const state = arrange(start(blank, 2), { "hand:p0": ["7h"], "hand:p1": ["9h"], drawPile: ["Jh"] });
  rejects(blank, state, "p0", { actionId: "fly" }, /Unknown action/);
  rejects(blank, state, "nobody", { actionId: "play", cardId: "7h" }, /not a player/);
  rejects(blank, state, "p0", { actionId: "play" }, /Choose a card/);
  rejects(blank, state, "p0", { actionId: "play", cardId: "Jh" }, /cannot be played/);
  const stale = performAction(blank, state, "p0", { actionId: "play", cardId: "7h" }, { expectedRevision: 99 });
  assert.equal(stale.ok, false);
  const done = act(blank, state, "p0", { actionId: "play", cardId: "7h" });
  assert.equal(done.status, "finished");
  rejects(blank, done, "p1", { actionId: "play", cardId: "9h" }, /not running/);
});

test("end conditions: emptying the hand, score targets and custom conditions", () => {
  const state = arrange(start(blank, 2), { "hand:p0": ["7h"], "hand:p1": ["9h"], drawPile: ["Jh"] });
  const won = act(blank, state, "p0", { actionId: "play", cardId: "7h" });
  assert.deepEqual(won.result.winners, ["p0"]);
  assert.deepEqual(won.result.losers, ["p1"]);

  const custom = clone(blank);
  custom.endConditions = [
    { id: "pile", type: "CUSTOM_DECLARATIVE_CONDITION", label: "The discard pile reaches 2 cards", when: { type: "zoneCount", zone: { zone: "discardPile" }, op: "gte", value: 2 }, winners: { where: { type: "isCurrentPlayer", player: "each" } } },
  ];
  let game = arrange(start(custom, 2), { "hand:p0": ["7h", "8h"], "hand:p1": ["9h", "10h"], drawPile: ["Jh"] });
  game = act(custom, game, "p0", { actionId: "play", cardId: "7h" });
  game = act(custom, game, "p1", { actionId: "play", cardId: "9h" });
  assert.equal(game.status, "finished");
  assert.deepEqual(game.result.winners, ["p0"], "after p1's play it is p0's turn");
  assert.equal(game.result.reason, "The discard pile reaches 2 cards");
});

test("rule loops are stopped and the action is rolled back", () => {
  const looping = clone(blank);
  looping.rules = [
    { id: "a", name: "Round on play", trigger: "CARD_PLAYED", effects: [{ type: "startRound" }] },
    { id: "b", name: "Round again", trigger: "ROUND_STARTED", effects: [{ type: "startRound" }] },
  ];
  const state = arrange(start(looping, 2), { "hand:p0": ["7h", "8h"], "hand:p1": ["9h"], drawPile: ["Jh"] });
  const error = rejects(looping, state, "p0", { actionId: "play", cardId: "7h" });
  assert.match(error, /Rule chain|limit/);
  assert.deepEqual(state.zones["hand:p0"].cards, ["7h", "8h"]);
  assert.equal(state.roundNumber, 1);

  const autoLoop = clone(blank);
  autoLoop.phases = [
    { id: "a", name: "A", automatic: true, allowedActions: [], onEnter: [], transitions: [{ to: "b" }] },
    { id: "b", name: "B", automatic: true, allowedActions: [], onEnter: [], transitions: [{ to: "a" }] },
  ];
  autoLoop.setup = { ...autoLoop.setup, firstPhase: "a" };
  assert.throws(() => start(autoLoop, 2), (err) => err instanceof GameSetupError && /phase changes/.test(err.message));
});

test("a game where nobody can act stops instead of hanging", () => {
  const stuck = clone(blank);
  stuck.actions = stuck.actions.map((action) => ({ ...action, condition: { type: "compare", left: 1, op: "eq", right: 2 } }));
  const state = start(stuck, 2);
  assert.equal(state.status, "finished");
  assert.equal(state.result.draw, true);
  assert.match(state.result.reason, /Nobody can act/);
});

test("state is plain JSON: a serialized match continues identically", () => {
  const players = 3;
  let live = start(durak, players, {}, 42);
  for (let i = 0; i < 25 && live.status === "playing"; i++) {
    const actor = live.players.find((player) => chooseBotAction(durak, live, player.id));
    live = act(durak, live, actor.id, chooseBotAction(durak, live, actor.id));
  }
  const json = serializeState(live);
  assert.ok(!json.includes("function"));
  let restored = parseState(json);
  assert.deepEqual(restored, live);
  for (let i = 0; i < 40 && live.status === "playing"; i++) {
    const actor = live.players.find((player) => chooseBotAction(durak, live, player.id));
    const request = chooseBotAction(durak, live, actor.id);
    live = act(durak, live, actor.id, request);
    restored = act(durak, restored, actor.id, request);
  }
  assert.deepEqual(restored, live, "same seed + same actions = same state, including future shuffles");
  assert.throws(() => parseState("{}"));
});

test("seeded randomness is deterministic", () => {
  const order = (seed) => start(durak, 2, {}, seed).zones["hand:p0"].cards.join();
  assert.equal(order(5), order(5));
  assert.notEqual(order(5), order(6));
  const a = createGame(hcb, { players: [{ id: "x", name: "X" }, { id: "y", name: "Y" }], seed: 9 });
  const b = createGame(hcb, { players: [{ id: "x", name: "X" }, { id: "y", name: "Y" }], seed: 9 });
  assert.deepEqual(a, b);
});

test("player views hide other hands, face-down cards and the shuffle state", () => {
  const state = start(durak, 2, {}, 1);
  const view = getPlayerView(durak, state, "p0");
  assert.deepEqual(view.zones["hand:p0"].cards, state.zones["hand:p0"].cards);
  assert.ok(view.zones["hand:p1"].cards.every((id) => id.startsWith("hidden-")));
  for (const id of state.zones["hand:p1"].cards) assert.equal(view.cards[id], undefined);
  const trump = state.zones.drawPile.cards[0];
  assert.equal(view.zones.drawPile.cards[0], trump, "the face-up trump card stays visible");
  assert.ok(view.zones.drawPile.cards.slice(1).every((id) => id.startsWith("hidden-")));
  assert.deepEqual(view.rng, { seed: 0, state: 0 });
});

test("the generic bot finishes every template", () => {
  for (const [def, count] of [[durak, 4], [hcb, 2], [blank, 3]]) {
    let state = start(def, count, {}, 123);
    for (let i = 0; i < 3000 && state.status === "playing"; i++) {
      const actor = state.players.find((player) => chooseBotAction(def, state, player.id));
      assert.ok(actor, `${def.id}: someone can act in ${state.currentPhase}`);
      state = act(def, state, actor.id, chooseBotAction(def, state, actor.id));
    }
    assert.equal(state.status, "finished", `${def.id} finished`);
  }
});

test("player counts outside the definition are refused", () => {
  assert.throws(() => start(hcb, 3), GameSetupError);
  assert.throws(() => start(durak, 1), GameSetupError);
  assert.throws(() => createGame(durak, { players: [{ id: "a", name: "A" }, { id: "a", name: "B" }], seed: 1 }), /unique/);
});

test("lobby settings are clamped to their definition", () => {
  const state = start(durak, 2, { handSize: 99, transferEnabled: "yes", throwInBy: "everyone", bogus: 1 });
  assert.equal(state.settings.handSize, 10);
  assert.equal(state.settings.transferEnabled, false);
  assert.equal(state.settings.throwInBy, "allOpponents");
  assert.equal("bogus" in state.settings, false);
});

test("headless simulations are deterministic and summarize per seat", async () => {
  const { simulateGame, summarizeSimulations } = await import("../src/games/cards/engine/index.ts");
  const runs = [1, 2, 3, 4, 5, 6].map((seed) => simulateGame(durak, { players: 3, seed }));
  assert.deepEqual(simulateGame(durak, { players: 3, seed: 2 }), runs[1], "same seed, same game");
  const summary = summarizeSimulations(runs, 3);
  assert.equal(summary.games, 6);
  assert.equal(summary.finished + summary.stalled + summary.errors, 6);
  assert.equal(summary.errors, 0);
  assert.equal(summary.seats.length, 3);
  assert.ok(summary.seats.reduce((sum, seat) => sum + seat.losses, 0) >= summary.finished - summary.draws, "every decided Durak game has a fool");
  assert.ok(summary.averageActions > 10);
  const broken = simulateGame(hcb, { players: 5, seed: 1 });
  assert.equal(broken.outcome, "error", "player counts outside the game are reported, not thrown");
});
