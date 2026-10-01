/**
 * Short-Deck Poker — a 36-card (6 to Ace) hold'em with antes and fixed-limit
 * betting. Configured from generic pieces only:
 *
 * - chips are the player score, the pot and the current bet are variables;
 * - the betting verbs (check, call, bet, raise, fold) are parameterless actions
 *   whose conditions and effects do the arithmetic;
 * - "still in the hand" is a role, so folding is just losing that role;
 * - the hand ranking is a list of declarative combinations, weakest first —
 *   with the short-deck twist that a flush beats a full house;
 * - a betting round ends when every player in the hand has acted and matched
 *   the bet (or is all-in), using the same "everyone passed" idea as Durak.
 *
 * Simplifications: no blinds (antes only) and no side pots — an all-in player
 * can win the whole pot.
 */
import { DECK_36 } from "../cards/card.ts";
import { POKER_COMBINATIONS } from "../engine/combinations.ts";
import type { ConditionNode, EffectDefinition, GameDefinition, ValueRef } from "../engine/types.ts";

const inHand = { roles: ["inHand"] };
/** Players who can still make decisions: in the hand and not all-in. */
const canAct: ConditionNode = {
  type: "and",
  children: [
    { type: "hasRole", player: "each", role: "inHand" },
    { type: "compare", left: { score: "each" }, op: "gt", right: 0 },
  ],
};
const committed = (player: "actor" | "each" = "actor"): ValueRef => ({ playerVar: "committed", player });
const toCall: ValueRef = { sub: [{ var: "currentBet" }, committed()] };
const nextToAct: EffectDefinition = { type: "endTurn", where: canAct };

/** Moves `pay` chips from the acting player into the pot. */
const pay = (amount: ValueRef): EffectDefinition[] => [
  { type: "setVariable", var: "pay", value: amount },
  { type: "incrementScore", player: "actor", amount: { sub: [0, { var: "pay" }] } },
  { type: "incrementVariable", var: "pot", amount: { var: "pay" } },
  { type: "incrementPlayerVariable", player: "actor", var: "committed", amount: { var: "pay" } },
];

const shortDeckLadder = (() => {
  const ladder = POKER_COMBINATIONS.map((combination) => ({ ...combination }));
  const flush = ladder.findIndex((combination) => combination.id === "flush");
  const fullHouse = ladder.findIndex((combination) => combination.id === "full-house");
  [ladder[flush], ladder[fullHouse]] = [ladder[fullHouse], ladder[flush]];
  return ladder;
})();

export const pokerTemplate: GameDefinition = {
  schemaVersion: 1,
  id: "short-deck-poker",
  templateId: "short-deck-poker",
  name: "Short-Deck Poker",
  description: "Hold'em with the 36-card deck: two cards each, five on the board, fixed-limit betting. Fewer cards make big hands common — and a flush beats a full house.",
  players: { min: 2, max: 6 },
  deck: { ...DECK_36, ranks: [...DECK_36.ranks], suits: [...DECK_36.suits], rankOrder: [...DECK_36.rankOrder] },
  roles: ["dealer", "inHand", "winner"],
  scoreLabel: "Chips",
  combinations: shortDeckLadder,
  variables: [
    { key: "pot", label: "Pot", initial: 0, visible: true },
    { key: "currentBet", label: "Bet to match", initial: 0, visible: true },
    { key: "raises", label: "Raises this street", initial: 0 },
    { key: "street", label: "Street (0 pre-flop, 1 flop, 2 turn, 3 river)", initial: 0 },
    { key: "pay", label: "Chips being paid (scratch)", initial: 0 },
    { key: "share", label: "Each winner's share (scratch)", initial: 0 },
  ],
  playerVariables: [
    { key: "committed", label: "Chips put in this street", initial: 0 },
    { key: "handName", label: "Best hand at showdown", initial: null },
  ],
  zones: [
    { id: "deck", name: "Deck", owner: "game", visibility: "hidden", ordering: "ordered", kind: "drawPile" },
    { id: "board", name: "Board", owner: "game", visibility: "public", ordering: "ordered", kind: "table" },
    { id: "muck", name: "Folded cards", owner: "game", visibility: "hidden", ordering: "unordered", kind: "discard" },
    { id: "hand", name: "Hole cards", owner: "player", visibility: "owner", ordering: "unordered", kind: "hand" },
  ],
  settings: [
    { key: "startingChips", label: "Starting chips", type: "integer", default: 50, min: 10, max: 500 },
    { key: "ante", label: "Ante per hand", type: "integer", default: 1, min: 0, max: 10 },
    { key: "betSize", label: "Bet / raise size", type: "integer", default: 2, min: 1, max: 50 },
    { key: "raiseCap", label: "Raises per street", type: "integer", default: 3, min: 0, max: 10 },
    { key: "handLimit", label: "Hands to play", description: "After this many hands, the player with the most chips wins.", type: "integer", default: 30, min: 1, max: 500 },
  ],
  setup: {
    deckZone: "deck",
    shuffle: true,
    steps: [
      { type: "forEachPlayer", effects: [{ type: "incrementScore", player: "each", amount: { setting: "startingChips" } }] },
      { type: "assignRole", role: "dealer", player: { seat: 0 } },
    ],
    startingPlayer: { seat: 0 },
    firstPhase: "deal",
  },
  phases: [
    {
      id: "deal",
      name: "Deal",
      description: "Collect and shuffle, take the antes, deal two hole cards to everyone still playing.",
      automatic: true,
      allowedActions: [],
      onEnter: [
        { type: "moveCards", from: { zone: "hand", player: "all" }, to: { zone: "deck" } },
        { type: "moveCards", from: { zone: "board" }, to: { zone: "deck" } },
        { type: "moveCards", from: { zone: "muck" }, to: { zone: "deck" } },
        { type: "shuffleZone", zone: { zone: "deck" } },
        { type: "assignRole", role: "inHand", players: "active" },
        { type: "removeRole", role: "winner" },
        {
          type: "forEachPlayer",
          players: "all",
          effects: [
            { type: "setPlayerVariable", player: "each", var: "committed", value: 0 },
            { type: "setPlayerVariable", player: "each", var: "handName", value: null },
          ],
        },
        { type: "setVariable", var: "currentBet", value: 0 },
        { type: "setVariable", var: "raises", value: 0 },
        { type: "setVariable", var: "street", value: 0 },
        { type: "resetPasses" },
        {
          type: "forEachPlayer",
          players: inHand,
          effects: [
            { type: "setVariable", var: "pay", value: { min: [{ setting: "ante" }, { score: "each" }] } },
            { type: "incrementScore", player: "each", amount: { sub: [0, { var: "pay" }] } },
            { type: "incrementVariable", var: "pot", amount: { var: "pay" } },
          ],
        },
        { type: "deal", from: { zone: "deck" }, to: "hand", count: 2, players: inHand },
        { type: "setCurrentPlayer", player: { next: { role: "dealer" }, where: canAct } },
      ],
      transitions: [{ to: "betting" }],
    },
    {
      id: "betting",
      name: "Betting",
      description: "In turn, players check, bet, call, raise or fold until everyone still in has matched the bet.",
      allowedActions: ["check", "call", "bet", "raise", "fold"],
      onEnter: [],
      transitions: [
        { to: "payout", when: { type: "compare", left: { playerCount: inHand }, op: "lte", right: 1 } },
        {
          to: "nextStreet",
          when: {
            type: "forAllPlayers",
            players: inHand,
            condition: {
              type: "or",
              children: [
                { type: "and", children: [{ type: "playerPassed", player: "each" }, { type: "compare", left: committed("each"), op: "eq", right: { var: "currentBet" } }] },
                { type: "compare", left: { score: "each" }, op: "lte", right: 0 },
              ],
            },
          },
        },
      ],
    },
    {
      id: "nextStreet",
      name: "Next street",
      description: "Clear the bets and turn the flop (3 cards), then the turn and the river (1 card each).",
      automatic: true,
      allowedActions: [],
      onEnter: [
        { type: "incrementVariable", var: "street", amount: 1 },
        { type: "setVariable", var: "currentBet", value: 0 },
        { type: "setVariable", var: "raises", value: 0 },
        { type: "forEachPlayer", players: "all", effects: [{ type: "setPlayerVariable", player: "each", var: "committed", value: 0 }] },
        { type: "resetPasses" },
        {
          type: "if",
          condition: { type: "compare", left: { var: "street" }, op: "eq", right: 1 },
          then: [{ type: "moveCards", from: { zone: "deck" }, to: { zone: "board" }, count: 3 }],
          else: [
            {
              type: "if",
              condition: { type: "compare", left: { var: "street" }, op: "lte", right: 3 },
              then: [{ type: "moveCards", from: { zone: "deck" }, to: { zone: "board" }, count: 1 }],
            },
          ],
        },
        { type: "setCurrentPlayer", player: { next: { role: "dealer" }, where: canAct } },
      ],
      transitions: [{ to: "showdown", when: { type: "compare", left: { var: "street" }, op: "gte", right: 4 } }, { to: "betting" }],
    },
    {
      id: "showdown",
      name: "Showdown",
      description: "Everyone still in shows their cards; the best five-card combination wins.",
      automatic: true,
      allowedActions: [],
      onEnter: [
        { type: "forEachPlayer", players: inHand, effects: [{ type: "revealZone", zone: { zone: "hand", player: "each" } }] },
        { type: "rankHands", players: inHand, zones: [{ zone: "hand", player: "each" }, { zone: "board" }], size: 5, role: "winner", nameVar: "handName" },
      ],
      transitions: [{ to: "payout" }],
    },
    {
      id: "payout",
      name: "Payout",
      description: "The winner takes the pot (split on a tie; odd chips stay for the next hand). Busted players are out; the dealer button moves on.",
      automatic: true,
      allowedActions: [],
      onEnter: [
        {
          type: "if",
          condition: { type: "compare", left: { playerCount: inHand }, op: "eq", right: 1 },
          then: [{ type: "assignRole", role: "winner", players: inHand }],
        },
        { type: "setVariable", var: "share", value: { div: [{ var: "pot" }, { playerCount: { roles: ["winner"] } }] } },
        {
          type: "forEachPlayer",
          players: { roles: ["winner"] },
          effects: [
            { type: "incrementScore", player: "each", amount: { var: "share" } },
            { type: "incrementVariable", var: "pot", amount: { sub: [0, { var: "share" }] } },
          ],
        },
        { type: "forEachPlayer", players: { where: { type: "compare", left: { score: "each" }, op: "lte", right: 0 } }, effects: [{ type: "eliminatePlayer", player: "each" }] },
        { type: "assignRole", role: "dealer", player: { next: { role: "dealer" } } },
        { type: "endRound" },
        { type: "startRound" },
      ],
      transitions: [{ to: "deal" }],
    },
  ],
  actions: [
    {
      id: "check",
      type: "check",
      label: "Check",
      description: "Stay in without adding chips (only when there is nothing to call).",
      actors: "current",
      botWeight: 6,
      condition: { type: "compare", left: committed(), op: "eq", right: { var: "currentBet" } },
      effects: [{ type: "setPassed", player: "actor" }, nextToAct],
    },
    {
      id: "call",
      type: "call",
      label: "Call",
      description: "Match the current bet (or go all-in with what you have).",
      actors: "current",
      botWeight: 6,
      condition: { type: "compare", left: committed(), op: "lt", right: { var: "currentBet" } },
      effects: [...pay({ min: [toCall, { score: "actor" }] }), { type: "setPassed", player: "actor" }, nextToAct],
    },
    {
      id: "bet",
      type: "bet",
      label: "Bet",
      description: "Open the betting with the fixed bet size.",
      actors: "current",
      botWeight: 2,
      condition: {
        type: "and",
        children: [
          { type: "compare", left: { var: "currentBet" }, op: "eq", right: 0 },
          { type: "compare", left: { score: "actor" }, op: "gte", right: { setting: "betSize" } },
        ],
      },
      effects: [{ type: "setVariable", var: "currentBet", value: { setting: "betSize" } }, ...pay(toCall), { type: "resetPasses" }, { type: "setPassed", player: "actor" }, nextToAct],
    },
    {
      id: "raise",
      type: "raise",
      label: "Raise",
      description: "Increase the bet by the fixed size (limited raises per street).",
      actors: "current",
      botWeight: 1,
      condition: {
        type: "and",
        children: [
          { type: "compare", left: { var: "currentBet" }, op: "gt", right: 0 },
          { type: "compare", left: { var: "raises" }, op: "lt", right: { setting: "raiseCap" } },
          { type: "compare", left: { score: "actor" }, op: "gte", right: { add: [toCall, { setting: "betSize" }] } },
        ],
      },
      effects: [
        { type: "incrementVariable", var: "currentBet", amount: { setting: "betSize" } },
        { type: "incrementVariable", var: "raises", amount: 1 },
        ...pay(toCall),
        { type: "resetPasses" },
        { type: "setPassed", player: "actor" },
        nextToAct,
      ],
    },
    {
      id: "fold",
      type: "fold",
      label: "Fold",
      description: "Give up this hand.",
      actors: "current",
      botWeight: 1,
      condition: { type: "compare", left: committed(), op: "lt", right: { var: "currentBet" } },
      effects: [{ type: "removeRole", role: "inHand", player: "actor" }, { type: "moveCards", from: { zone: "hand", player: "actor" }, to: { zone: "muck" } }, nextToAct],
    },
  ],
  rules: [],
  events: [
    { type: "PHASE_STARTED", description: "Each phase's entry effects run the dealing, the streets, the showdown and the payout." },
    { type: "PLAYER_PASSED", description: "Checking or calling marks a player as done for the street; a bet or raise clears everyone else's mark." },
  ],
  endConditions: [
    { id: "last-player", type: "LAST_ACTIVE_PLAYER", label: "Everyone else is out of chips", outcome: "lastWins" },
    { id: "hand-limit", type: "HIGHEST_SCORE", label: "Most chips after the last hand", when: { type: "roundNumber", op: "gt", value: { setting: "handLimit" } }, measure: "score" },
  ],
  rulebook: {
    overview: "Hold'em played with the 36-card deck from 6 to Ace. Make the best five-card combination from your two hole cards and five shared board cards — or make everyone else give up.",
    setup: "Everyone starts with the same stack of chips. Each hand, players pay a small ante into the pot and get two private cards.",
    gameplay:
      "Starting left of the dealer, players take turns: check (when there is nothing to pay), bet, call, raise or fold. Bets and raises have a fixed size, and the number of raises per street is limited. After the first betting round, three board cards are turned (the flop), then one (the turn), then one more (the river), with a betting round after each. If only one player is left in, they take the pot at once.",
    winning:
      "At the showdown the best combination wins the pot. With fewer cards in the deck, the order differs from regular poker: a flush beats a full house, and an Ace can also count low in A-6-7-8-9. Players who run out of chips are out; the last player with chips — or the richest after the last hand — wins.",
    notes: "There are no blinds and no side pots: an all-in player can still win the whole pot.",
  },
};
