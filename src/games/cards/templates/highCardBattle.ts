/**
 * High Card Battle — a traditional two-player "higher card takes both" game,
 * configured entirely from generic engine features.
 *
 * Each round both players reveal the top card of their stack; rules on the
 * compare phase decide the winner, and the resolve phase pays out according to
 * the lobby settings (tie behaviour, where won cards go, shuffling).
 */
import { STANDARD_DECK } from "../cards/card.ts";
import type { ConditionNode, EffectDefinition, GameDefinition, RuleDefinition } from "../engine/types.ts";

const top = (seat: number) => ({ top: { zone: "table", player: { seat } } });
const isCompare: ConditionNode = { type: "phaseEquals", phase: "compare" };
const bothRevealed: ConditionNode = { type: "forAllPlayers", players: "active", condition: { type: "compare", left: { playerVar: "revealed", player: "each" }, op: "eq", right: true } };
const tied: ConditionNode = { type: "compare", left: { var: "tied" }, op: "eq", right: true };
const setting = (key: string, value: string | boolean): ConditionNode => ({ type: "compare", left: { setting: key }, op: "eq", right: value });

/** "Higher rank wins" for both seats; shared with Kings & Sevens. */
export function higherCardRules(priority: number): RuleDefinition[] {
  return [0, 1].map((seat) => ({
    id: `higher-wins-seat-${seat + 1}`,
    name: `Higher card wins (seat ${seat + 1})`,
    description: "General rule: the higher-ranked revealed card takes the round.",
    trigger: "PHASE_STARTED",
    priority,
    stopProcessing: true,
    condition: { type: "and", children: [isCompare, { type: "rankGreater", card: top(seat), other: top(1 - seat) }] },
    effects: [{ type: "setVariable", var: "roundWinner", value: { player: { seat } } }],
  }));
}

export const tieRule: RuleDefinition = {
  id: "tie",
  name: "Equal ranks tie",
  description: "Nobody wins the comparison when both revealed cards have the same rank.",
  trigger: "PHASE_STARTED",
  priority: 0,
  condition: { type: "and", children: [isCompare, { type: "sameRank", card: top(0), other: top(1) }] },
  effects: [{ type: "setVariable", var: "tied", value: true }],
};

/** Every player's table goes to the round winner, to the bottom of their stack or their captured pile. */
export const payWinner: EffectDefinition[] = [
  {
    type: "if",
    condition: setting("collectTo", "capturedPile"),
    then: [{ type: "awardCards", from: [{ zone: "table", player: "all" }], player: { var: "roundWinner" }, to: "captured", shuffle: { setting: "shuffleWinnings" } }],
    else: [{ type: "awardCards", from: [{ zone: "table", player: "all" }], player: { var: "roundWinner" }, to: "stack", position: "bottom", shuffle: { setting: "shuffleWinnings" } }],
  },
];

export const highCardBattleTemplate: GameDefinition = {
  schemaVersion: 1,
  id: "high-card-battle",
  templateId: "high-card-battle",
  name: "High Card Battle",
  description: "Flip, compare, collect. The higher card takes the pile — and a tie starts a battle.",
  players: { min: 2, max: 2 },
  deck: { ...STANDARD_DECK, ranks: [...STANDARD_DECK.ranks], suits: [...STANDARD_DECK.suits], rankOrder: [...STANDARD_DECK.rankOrder] },
  variables: [
    { key: "roundWinner", label: "Winner of the current comparison", initial: null },
    { key: "tied", label: "The comparison was a tie", initial: false },
  ],
  playerVariables: [{ key: "revealed", label: "Revealed this round", initial: false }],
  zones: [
    { id: "dealPile", name: "Deck", owner: "game", visibility: "hidden", ordering: "ordered", kind: "drawPile" },
    { id: "stack", name: "Draw stack", owner: "player", visibility: "hidden", ordering: "ordered", kind: "stack" },
    { id: "table", name: "Battle spot", owner: "player", visibility: "public", ordering: "ordered", kind: "table" },
    { id: "captured", name: "Captured cards", owner: "player", visibility: "hidden", ordering: "unordered", kind: "captured" },
    { id: "discardPile", name: "Out of play", owner: "game", visibility: "public", ordering: "unordered", kind: "discard" },
  ],
  settings: [
    {
      key: "tieMode",
      label: "On a tie",
      type: "select",
      default: "battle",
      options: [
        { value: "battle", label: "Battle: face-down cards, then reveal again" },
        { value: "returnCards", label: "Each player takes their card back" },
        { value: "discard", label: "Both cards leave the game" },
      ],
    },
    { key: "tieFaceDownCards", label: "Face-down cards in a battle", type: "integer", default: 1, min: 0, max: 3 },
    {
      key: "collectTo",
      label: "Won cards go to",
      type: "select",
      default: "bottomOfStack",
      options: [
        { value: "bottomOfStack", label: "The bottom of the winner's stack" },
        { value: "capturedPile", label: "A captured pile, shuffled in when the stack runs out" },
      ],
    },
    { key: "shuffleWinnings", label: "Shuffle won cards", description: "Prevents endless loops where the same cards keep meeting.", type: "boolean", default: true },
    { key: "maxRounds", label: "Round limit", description: "After this many rounds, the player with the most cards wins.", type: "integer", default: 500, min: 10, max: 2000 },
  ],
  setup: {
    deckZone: "dealPile",
    shuffle: true,
    steps: [{ type: "deal", from: { zone: "dealPile" }, to: "stack", count: "all" }],
    startingPlayer: { seat: 0 },
    firstPhase: "reveal",
  },
  phases: [
    {
      id: "reveal",
      name: "Reveal",
      description: "Both players turn over the top card of their stack.",
      allowedActions: ["reveal"],
      onEnter: [
        { type: "forEachPlayer", effects: [{ type: "setPlayerVariable", player: "each", var: "revealed", value: false }] },
        // A player who cannot reveal (no cards left to continue a battle) is out.
        {
          type: "forEachPlayer",
          players: { where: { type: "hasNoCards", player: "each", zones: ["stack", "captured"] } },
          effects: [{ type: "eliminatePlayer", player: "each" }],
        },
      ],
      transitions: [{ to: "compare", when: bothRevealed }],
    },
    {
      id: "compare",
      name: "Compare",
      description: "The rules decide whose card is stronger.",
      automatic: true,
      allowedActions: [],
      onEnter: [
        { type: "setVariable", var: "roundWinner", value: null },
        { type: "setVariable", var: "tied", value: false },
      ],
      transitions: [{ to: "resolve" }],
    },
    {
      id: "resolve",
      name: "Resolve",
      description: "The winner collects; a tie is handled as configured.",
      automatic: true,
      allowedActions: [],
      onEnter: [
        {
          type: "if",
          condition: tied,
          then: [
            {
              type: "if",
              condition: setting("tieMode", "battle"),
              then: [
                {
                  type: "forEachPlayer",
                  effects: [{ type: "moveCards", from: { zone: "stack", player: "each" }, to: { zone: "table", player: "each" }, count: { setting: "tieFaceDownCards" } }],
                },
              ],
            },
            {
              type: "if",
              condition: setting("tieMode", "returnCards"),
              then: [{ type: "forEachPlayer", effects: [{ type: "moveCards", from: { zone: "table", player: "each" }, to: { zone: "stack", player: "each" }, position: "bottom" }] }],
            },
            {
              type: "if",
              condition: setting("tieMode", "discard"),
              then: [{ type: "forEachPlayer", effects: [{ type: "moveCards", from: { zone: "table", player: "each" }, to: { zone: "discardPile" } }] }],
            },
          ],
          else: [...payWinner, { type: "incrementScore", player: { var: "roundWinner" }, amount: 1 }, { type: "endRound" }, { type: "startRound" }],
        },
      ],
      transitions: [{ to: "reveal" }],
    },
  ],
  actions: [
    {
      id: "reveal",
      type: "reveal",
      label: "Reveal",
      description: "Turn over the top card of your stack.",
      actors: "all",
      condition: {
        type: "and",
        children: [
          { type: "compare", left: { playerVar: "revealed", player: "actor" }, op: "eq", right: false },
          { type: "zoneCount", zone: { zone: "stack", player: "actor" }, op: "gt", value: 0 },
        ],
      },
      effects: [
        { type: "moveCard", card: { top: { zone: "stack", player: "actor" } }, to: { zone: "table", player: "actor" }, faceUp: true },
        { type: "setPlayerVariable", player: "actor", var: "revealed", value: true },
      ],
    },
  ],
  rules: [
    ...higherCardRules(10),
    tieRule,
    {
      id: "reshuffle-captured",
      name: "Recycle captured cards",
      description: "When a stack runs out, its owner's captured cards are shuffled into a new stack.",
      trigger: "ZONE_EMPTY",
      priority: 0,
      condition: { type: "and", children: [{ type: "eventZoneIs", zone: "stack" }, { type: "zoneCount", zone: { zone: "captured", player: "eventPlayer" }, op: "gt", value: 0 }] },
      effects: [
        { type: "moveCards", from: { zone: "captured", player: "eventPlayer" }, to: { zone: "stack", player: "eventPlayer" } },
        { type: "shuffleZone", zone: { zone: "stack", player: "eventPlayer" } },
      ],
    },
  ],
  events: [
    { type: "PHASE_STARTED", description: "When the compare phase starts, the comparison rules decide the round (higher priority first)." },
    { type: "CARD_REVEALED", description: "Revealing turns the top card of your stack face up on your battle spot." },
    { type: "ZONE_EMPTY", description: "An empty stack is refilled from that player's captured cards." },
  ],
  endConditions: [
    { id: "all-cards", type: "LAST_PLAYER_WITH_CARDS", label: "One player controls every card", zones: ["stack", "captured", "table"], outcome: "lastWins" },
    { id: "last-standing", type: "LAST_ACTIVE_PLAYER", label: "The other player cannot continue", outcome: "lastWins" },
    {
      id: "round-limit",
      type: "HIGHEST_SCORE",
      label: "Round limit reached",
      when: { type: "roundNumber", op: "gt", value: { setting: "maxRounds" } },
      measure: { zones: ["stack", "captured", "table"] },
    },
  ],
  rulebook: {
    overview: "A two-player game of pure nerve: turn over cards, and the higher one takes both. Win by collecting the whole deck.",
    setup: "Shuffle the 32 cards and split them evenly into two face-down stacks, one per player.",
    gameplay:
      "Both players reveal the top card of their stack at the same time. The higher rank takes both cards and puts them under their stack. If the ranks are equal it is a battle: each player adds a face-down card, then reveals a new card on top — the next comparison takes everything on the table. Battles can repeat.",
    winning: "You win when you hold every card, or when your opponent cannot continue a battle. With the round limit enabled, the player with more cards wins once it is reached.",
    notes: "Lobby settings change the tie behaviour, how many face-down cards a battle costs, where won cards go, and whether they are shuffled.",
  },
};
