/**
 * Durak 6–A — the classic "don't be the last one holding cards" game on the
 * 36-card deck (6 to Ace). Pure configuration: every behaviour below is a generic
 * condition, effect, phase, role or end condition from the engine.
 */
import { DECK_36 } from "../cards/card.ts";
import type { ConditionNode, EffectDefinition, GameDefinition } from "../engine/types.ts";

const TABLE = ["attackTable", "defenseTable"];
const uncovered: ConditionNode = { type: "not", child: { type: "cardMarked", card: "each", mark: "covered" } };
const uncoveredCount = { countWhere: { zone: "attackTable" }, where: uncovered };

/** Defender, throw-in helpers and the current player, derived from the attacker. */
const assignBoutRoles: EffectDefinition[] = [
  { type: "assignRole", role: "defender", player: { next: { role: "attacker" } } },
  {
    type: "if",
    condition: { type: "compare", left: { setting: "throwInBy" }, op: "eq", right: "allOpponents" },
    then: [{ type: "assignRole", role: "thrower", players: { excludeRoles: ["defender"] } }],
    else: [{ type: "assignRole", role: "thrower", players: { roles: ["attacker"] } }],
  },
];

export const durakTemplate: GameDefinition = {
  schemaVersion: 1,
  id: "durak-6a",
  templateId: "durak-6a",
  name: "Durak 6–A",
  description: "Beat off attacks with higher cards or trumps — whoever is left holding cards at the end is the fool.",
  players: { min: 2, max: 5 },
  deck: { ...DECK_36, ranks: [...DECK_36.ranks], suits: [...DECK_36.suits], rankOrder: [...DECK_36.rankOrder] },
  roles: ["attacker", "defender", "thrower"],
  variables: [
    { key: "took", label: "Defender is taking the cards", initial: false },
    { key: "previousDefender", label: "Defender before a transfer", initial: null },
  ],
  zones: [
    { id: "drawPile", name: "Draw pile", owner: "game", visibility: "hidden", ordering: "ordered", kind: "drawPile" },
    { id: "discardPile", name: "Discard pile", owner: "game", visibility: "hidden", ordering: "unordered", kind: "discard" },
    { id: "hand", name: "Hand", owner: "player", visibility: "owner", ordering: "unordered", kind: "hand" },
    { id: "attackTable", name: "Attack cards", owner: "game", visibility: "public", ordering: "ordered", kind: "table" },
    { id: "defenseTable", name: "Defence cards", owner: "game", visibility: "public", ordering: "ordered", kind: "table" },
  ],
  settings: [
    { key: "handSize", label: "Starting hand size", description: "Cards dealt at the start, and the size hands are refilled to.", type: "integer", default: 6, min: 3, max: 10 },
    { key: "maxAttackCards", label: "Maximum attack cards per bout", type: "integer", default: 6, min: 1, max: 10 },
    { key: "transferEnabled", label: "Transfer mode", description: "The defender may pass the attack on with a card of the same rank before beating anything.", type: "boolean", default: false },
    {
      key: "throwInBy",
      label: "Who may throw in",
      type: "select",
      default: "allOpponents",
      options: [
        { value: "allOpponents", label: "Every other player" },
        { value: "attackerOnly", label: "Only the attacker" },
      ],
    },
    {
      key: "firstAttacker",
      label: "First attacker",
      type: "select",
      default: "lowestTrump",
      options: [
        { value: "lowestTrump", label: "Player with the lowest trump" },
        { value: "firstSeat", label: "First seat" },
      ],
    },
  ],
  setup: {
    deckZone: "drawPile",
    shuffle: true,
    steps: [
      { type: "deal", from: { zone: "drawPile" }, to: "hand", count: { setting: "handSize" } },
      // The next card is turned face up under the pile: it names trump and is drawn last.
      { type: "moveCard", card: { top: { zone: "drawPile" } }, to: { zone: "drawPile" }, position: "bottom", faceUp: true },
      { type: "setTrumpSuit", card: { bottom: { zone: "drawPile" } } },
      {
        type: "if",
        condition: { type: "compare", left: { setting: "firstAttacker" }, op: "eq", right: "lowestTrump" },
        then: [{ type: "assignRole", role: "attacker", player: { lowestCard: { zone: "hand", where: { type: "isTrump", card: "each" } }, fallback: { seat: 0 } } }],
        else: [{ type: "assignRole", role: "attacker", player: { seat: 0 } }],
      },
    ],
    startingPlayer: { role: "attacker" },
    firstPhase: "attack",
  },
  phases: [
    {
      id: "attack",
      name: "Attack",
      description: "The attacker leads any card.",
      allowedActions: ["attack"],
      onEnter: [{ type: "setVariable", var: "took", value: false }, ...assignBoutRoles, { type: "setCurrentPlayer", player: { role: "attacker" } }, { type: "resetPasses" }],
      transitions: [{ to: "defend", when: { type: "zoneCount", zone: { zone: "attackTable" }, op: "gt", value: 0 } }],
    },
    {
      id: "defend",
      name: "Defend",
      description: "The defender beats each attack card or takes them; the others may throw in cards of ranks already on the table.",
      allowedActions: ["defend", "take", "transfer", "throwIn", "pass"],
      onEnter: [{ type: "setCurrentPlayer", player: { role: "defender" } }],
      autoPass: true,
      transitions: [
        {
          to: "resolve",
          when: {
            type: "and",
            children: [
              { type: "compare", left: uncoveredCount, op: "eq", right: 0 },
              { type: "allPassed", players: { roles: ["thrower"] } },
            ],
          },
        },
      ],
    },
    {
      id: "throwIn",
      name: "Throw in",
      description: "The defender is taking; the others may add more cards of ranks on the table.",
      allowedActions: ["throwIn", "pass"],
      onEnter: [{ type: "resetPasses" }, { type: "setCurrentPlayer", player: { role: "attacker" } }],
      autoPass: true,
      transitions: [{ to: "resolve", when: { type: "allPassed", players: { roles: ["thrower"] } } }],
    },
    {
      id: "resolve",
      name: "Resolve",
      description: "Taken cards go to the defender; beaten cards are discarded.",
      automatic: true,
      allowedActions: [],
      onEnter: [
        {
          type: "if",
          condition: { type: "compare", left: { var: "took" }, op: "eq", right: true },
          then: [
            { type: "moveCards", from: { zone: "attackTable" }, to: { zone: "hand", player: { role: "defender" } } },
            { type: "moveCards", from: { zone: "defenseTable" }, to: { zone: "hand", player: { role: "defender" } } },
          ],
          else: [{ type: "discardCards", from: { zone: "attackTable" } }, { type: "discardCards", from: { zone: "defenseTable" } }],
        },
        { type: "endRound" },
      ],
      transitions: [{ to: "refill" }],
    },
    {
      id: "refill",
      name: "Refill",
      description: "Everyone draws back up — attacker first, defender last. Empty-handed players leave once the pile is gone.",
      automatic: true,
      allowedActions: [],
      onEnter: [
        { type: "drawUntilHandSize", players: { startFrom: { role: "attacker" }, lastRoles: ["defender"] }, size: { setting: "handSize" }, from: { zone: "drawPile" } },
        {
          type: "forEachPlayer",
          players: { where: { type: "and", children: [{ type: "drawPileEmpty" }, { type: "hasNoCards", player: "each" }] } },
          effects: [{ type: "markPlayerFinished", player: "each" }],
        },
        {
          type: "if",
          condition: { type: "compare", left: { var: "took" }, op: "eq", right: true },
          then: [{ type: "assignRole", role: "attacker", player: { next: { role: "defender" } } }],
          else: [{ type: "assignRole", role: "attacker", player: { next: { role: "defender" }, includeSelf: true } }],
        },
        { type: "removeRole", role: "defender" },
        { type: "removeRole", role: "thrower" },
        { type: "startRound" },
      ],
      transitions: [{ to: "attack" }],
    },
  ],
  actions: [
    {
      id: "attack",
      type: "attack",
      label: "Attack",
      description: "Lead any card from your hand.",
      actors: { roles: ["attacker"] },
      source: "hand",
      destination: { zone: "attackTable" },
      effects: [],
    },
    {
      id: "defend",
      type: "defendCard",
      label: "Beat",
      description: "Cover an attack card with a higher card of the same suit, or with a trump.",
      actors: { roles: ["defender"] },
      source: "hand",
      target: { zone: { zone: "attackTable" }, where: uncovered },
      destination: { zone: "defenseTable" },
      cardCondition: {
        type: "or",
        children: [
          { type: "and", children: [{ type: "sameSuit", card: "played", other: "target" }, { type: "rankGreater", card: "played", other: "target" }] },
          { type: "and", children: [{ type: "isTrump", card: "played" }, { type: "not", child: { type: "isTrump", card: "target" } }] },
        ],
      },
      effects: [{ type: "markCard", card: "target", mark: "covered" }, { type: "resetPasses" }],
    },
    {
      id: "take",
      type: "takeCards",
      label: "Take the cards",
      description: "Give up the defence and pick up everything on the table.",
      actors: { roles: ["defender"] },
      condition: { type: "compare", left: uncoveredCount, op: "gt", right: 0 },
      effects: [{ type: "setVariable", var: "took", value: true }, { type: "startPhase", phase: "throwIn" }],
    },
    {
      id: "transfer",
      type: "playCard",
      label: "Transfer",
      description: "Add a card of the same rank and pass the whole attack to the next player.",
      actors: { roles: ["defender"] },
      source: "hand",
      destination: { zone: "attackTable" },
      condition: {
        type: "and",
        children: [
          { type: "compare", left: { setting: "transferEnabled" }, op: "eq", right: true },
          { type: "zoneEmpty", zone: { zone: "defenseTable" } },
          { type: "compare", left: { count: { zone: "attackTable" } }, op: "lt", right: { setting: "maxAttackCards" } },
          { type: "compare", left: { handSize: { next: { role: "defender" } } }, op: "gt", right: { count: { zone: "attackTable" } } },
          { type: "compare", left: { player: { next: { role: "defender" } } }, op: "neq", right: { player: { role: "attacker" } } },
        ],
      },
      cardCondition: { type: "rankOnTable", card: "played", zones: ["attackTable"] },
      effects: [
        { type: "setVariable", var: "previousDefender", value: { player: { role: "defender" } } },
        { type: "assignRole", role: "defender", player: { next: { var: "previousDefender" } } },
        { type: "assignRole", role: "attacker", player: { var: "previousDefender" } },
        ...assignBoutRoles.slice(1),
        { type: "setCurrentPlayer", player: { role: "defender" } },
        { type: "resetPasses" },
      ],
    },
    {
      id: "throwIn",
      type: "throwIn",
      label: "Throw in",
      description: "Add a card whose rank is already on the table.",
      actors: { roles: ["thrower"] },
      source: "hand",
      destination: { zone: "attackTable" },
      condition: {
        type: "and",
        children: [
          { type: "compare", left: { count: { zone: "attackTable" } }, op: "lt", right: { setting: "maxAttackCards" } },
          { type: "compare", left: uncoveredCount, op: "lt", right: { handSize: { role: "defender" } } },
        ],
      },
      cardCondition: { type: "rankOnTable", card: "played", zones: TABLE },
      effects: [{ type: "resetPasses" }],
    },
    {
      id: "pass",
      type: "pass",
      label: "Done",
      description: "You have nothing (more) to throw in.",
      actors: { roles: ["thrower"] },
      effects: [],
    },
  ],
  rules: [],
  events: [
    { type: "PHASE_STARTED", description: "Each phase's entry effects run first: the attack phase hands out the attacker, defender and throw-in roles." },
    { type: "CARD_PLAYED", description: "Beating a card marks the attack card as covered, which drives the end of the defence." },
    { type: "PLAYER_PASSED", description: "Once every thrower has passed and all attacks are covered, the bout is resolved." },
    { type: "DRAW_PILE_EMPTY", description: "From now on, players with empty hands finish during the refill." },
  ],
  endConditions: [{ id: "fool", type: "LAST_ACTIVE_PLAYER", label: "The last player holding cards loses", outcome: "lastLoses" }],
  rulebook: {
    overview: "A shedding game for 2–5 players. You are attacked, you defend, and you try to get rid of all your cards. The one player left holding cards at the end loses.",
    setup: "Shuffle the 36 cards (6 to Ace) and deal each player a hand. Turn the next card face up and slide it under the draw pile: its suit is trump for the whole game, and it will be the last card drawn.",
    gameplay:
      "The attacker leads a card at the defender (the next player). The defender must beat every attack card — with a higher card of the same suit, or with any trump if the attack card is not a trump. While the defence is going on, the other players may throw in more cards, but only ranks that are already on the table, and never more than the defender can answer. If the defender beats everything, the cards are discarded and the defender attacks next. If the defender cannot or will not, they take every card on the table and lose their turn to attack. Afterwards, everyone draws back up to the hand size — attacker first, defender last.",
    winning: "Once the draw pile is gone, a player who runs out of cards is safe and leaves the game. The last player still holding cards is the fool and loses. If the last two players run out together, nobody loses.",
    notes: "Transfer mode (optional): before beating anything, the defender may add a card of the same rank and pass the whole attack on to the next player.",
  },
};
