/**
 * Blank Game — the smallest playable starting point: deal, take turns playing
 * or drawing a card, first to empty their hand wins.
 */
import { STANDARD_DECK } from "../cards/card.ts";
import type { GameDefinition } from "../engine/types.ts";

export const blankTemplate: GameDefinition = {
  schemaVersion: 1,
  id: "blank-game",
  templateId: "blank-game",
  name: "Blank Game",
  description: "A minimal starting point: deal hands, play or draw on your turn, empty your hand to win.",
  players: { min: 2, max: 4 },
  deck: { ...STANDARD_DECK, ranks: [...STANDARD_DECK.ranks], suits: [...STANDARD_DECK.suits], rankOrder: [...STANDARD_DECK.rankOrder] },
  zones: [
    { id: "drawPile", name: "Draw pile", owner: "game", visibility: "hidden", ordering: "ordered", kind: "drawPile" },
    { id: "discardPile", name: "Discard pile", owner: "game", visibility: "public", ordering: "ordered", kind: "discard" },
    { id: "hand", name: "Hand", owner: "player", visibility: "owner", ordering: "unordered", kind: "hand" },
  ],
  settings: [{ key: "handSize", label: "Starting hand size", type: "integer", default: 5, min: 1, max: 10 }],
  setup: {
    deckZone: "drawPile",
    shuffle: true,
    steps: [{ type: "deal", from: { zone: "drawPile" }, to: "hand", count: { setting: "handSize" } }],
    startingPlayer: { seat: 0 },
    firstPhase: "turn",
  },
  phases: [
    {
      id: "turn",
      name: "Turn",
      description: "The current player plays one card or draws one.",
      allowedActions: ["play", "draw"],
      onEnter: [],
      transitions: [],
    },
  ],
  actions: [
    { id: "play", type: "playCard", label: "Play", actors: "current", source: "hand", destination: { zone: "discardPile" }, effects: [{ type: "endTurn" }] },
    {
      id: "draw",
      type: "draw",
      label: "Draw",
      actors: "current",
      condition: { type: "not", child: { type: "drawPileEmpty" } },
      effects: [{ type: "drawCard", player: "actor" }, { type: "endTurn" }],
    },
  ],
  rules: [],
  events: [],
  endConditions: [{ id: "empty-hand", type: "PLAYER_HAND_EMPTY", label: "Empty your hand", outcome: "win" }],
  rulebook: {
    overview: "Describe your game in a sentence or two.",
    setup: "Explain how the cards are dealt.",
    gameplay: "Explain what players do on their turn.",
    winning: "Explain how the game ends.",
  },
};
