/**
 * Card Builder — data model.
 *
 * - `GameDefinition` describes how a game works. It is plain JSON built only
 *   from allowlisted condition, effect, action, event and end-condition types.
 * - `GameState` is one running match. Also plain JSON (no functions, classes,
 *   Maps or Dates) so it can be persisted, sent over the network and replayed.
 * - The rulebook inside a definition is documentation only; the engine never
 *   reads it.
 */
import type { Card, DeckDefinition, Rank, Suit } from "../cards/card.ts";
import type { CombinationDefinition } from "./combinations.ts";
import type { RngState } from "./rng.ts";

export const DEFINITION_SCHEMA_VERSION = 1;

/* ------------------------------------------------------------------ Events */

export const GAME_EVENT_TYPES = [
  "GAME_STARTED",
  "ROUND_STARTED",
  "TURN_STARTED",
  "PHASE_STARTED",
  "ACTION_ATTEMPTED",
  "ACTION_COMPLETED",
  "CARD_PLAY_ATTEMPT",
  "CARD_PLAYED",
  "CARD_DRAWN",
  "CARD_REVEALED",
  "PLAYER_PASSED",
  "HAND_EMPTY",
  "ZONE_EMPTY",
  "DRAW_PILE_EMPTY",
  "PHASE_ENDED",
  "TURN_ENDED",
  "ROUND_ENDED",
  "GAME_ENDED",
] as const;
export type GameEventType = (typeof GAME_EVENT_TYPES)[number];

export interface GameEvent {
  type: GameEventType;
  playerId?: string;
  cardId?: string;
  targetCardId?: string;
  /** Zone definition id (and its owner for player zones). */
  zone?: string;
  zoneOwner?: string;
  phase?: string;
  actionId?: string;
  /** Rule-chain depth: 0 for events caused directly by an action or the engine. */
  depth: number;
}

/* -------------------------------------------------------------- References */

/**
 * Who an effect or condition is about. Strings are contextual:
 * - "self": the player being iterated (forEachPlayer), else the acting player, else the event's player, else the current player
 * - "actor": the player performing the action
 * - "eventPlayer": the player attached to the triggering event
 * - "current": the current player
 * - "each": the player being iterated by forEachPlayer / forAllPlayers / forAnyPlayer
 */
export type PlayerRef =
  | "self"
  | "actor"
  | "eventPlayer"
  | "current"
  | "each"
  | { seat: number }
  | { role: string }
  | { var: string }
  | { next: PlayerRef; includeSelf?: boolean; where?: ConditionNode }
  | { previous: PlayerRef; where?: ConditionNode }
  | { lowestCard: { zone: string; where?: ConditionNode }; fallback?: PlayerRef }
  | { highestCard: { zone: string; where?: ConditionNode }; fallback?: PlayerRef };

/** Several players, always in seat order (optionally rotated to start at `startFrom`). */
export type PlayerSetRef =
  | "all"
  | "active"
  | {
      scope?: "all" | "active";
      roles?: string[];
      excludeRoles?: string[];
      startFrom?: PlayerRef;
      /** Players holding these roles are moved to the end (e.g. the defender draws last). */
      lastRoles?: string[];
      where?: ConditionNode;
    };

/** A zone instance. Player-owned zones need a player (default "self"); "all" = every player's copy (read-only uses). */
export interface ZoneRef {
  zone: string;
  player?: PlayerRef | "all";
}

/**
 * A single card. "played"/"target" come from the event or action, "each" is the
 * card being iterated (countWhere, forAnyCard, card filters).
 */
export type CardRef = "played" | "target" | "each" | { top: ZoneRef } | { bottom: ZoneRef } | { var: string };

export type Primitive = string | number | boolean | null;

export type ValueRef =
  | Primitive
  | { const: Primitive }
  | { setting: string }
  | { var: string }
  | { playerVar: string; player?: PlayerRef }
  | { score: PlayerRef }
  | { count: ZoneRef }
  | { countWhere: ZoneRef; where: ConditionNode }
  | { handSize: PlayerRef }
  | { cardRank: CardRef }
  | { cardSuit: CardRef }
  | { rankValue: CardRef }
  | { player: PlayerRef }
  | { builtin: "round" | "turn" | "phase" | "activePlayers" | "trumpSuit" }
  | { playerCount: PlayerSetRef }
  | { div: [ValueRef, ValueRef] }
  | { add: ValueRef[] }
  | { sub: [ValueRef, ValueRef] }
  | { min: ValueRef[] }
  | { max: ValueRef[] };

/* --------------------------------------------------------------- Conditions */

export type ConditionNode =
  | { type: "and"; children: ConditionNode[] }
  | { type: "or"; children: ConditionNode[] }
  | { type: "not"; child: ConditionNode }
  | PrimitiveCondition;

/** Parameters are checked against the condition registry's parameter specs. */
export interface PrimitiveCondition {
  type: string;
  [param: string]: unknown;
}

/* ------------------------------------------------------------------ Effects */

export interface EffectDefinition {
  type: string;
  [param: string]: unknown;
}

/* ------------------------------------------------------------------ Actions */

export const ACTION_TYPES = ["playCard", "attack", "defendCard", "throwIn", "pass", "takeCards", "draw", "reveal", "confirmPhase", "check", "call", "bet", "raise", "fold"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/** Which parameters an action type needs from the player. */
export const ACTION_TYPE_SHAPE: Record<ActionType, "card" | "cardAndTarget" | "none"> = {
  playCard: "card",
  attack: "card",
  throwIn: "card",
  defendCard: "cardAndTarget",
  pass: "none",
  takeCards: "none",
  draw: "none",
  reveal: "none",
  confirmPhase: "none",
  check: "none",
  call: "none",
  bet: "none",
  raise: "none",
  fold: "none",
};

export type ActorSpec = "current" | "all" | { roles: string[] };

export interface ActionDefinition {
  id: string;
  type: ActionType;
  label: string;
  description?: string;
  /** Who may use it (always further limited to active players). */
  actors: ActorSpec;
  /** Must be true for the action to be offered (evaluated for the acting player). */
  condition?: ConditionNode;
  /** Card actions: the acting player's zone the card comes from. */
  source?: string;
  /** Card actions: where the played card goes (default: the source zone's discard pile is not assumed). */
  destination?: ZoneRef;
  /** Card actions: the card must satisfy this ("played" = candidate card, "target" = chosen target). */
  cardCondition?: ConditionNode;
  /** defendCard: which cards may be targeted. */
  target?: { zone: ZoneRef; where?: ConditionNode };
  /** Run after the default behaviour (card moved / pass recorded). */
  effects: EffectDefinition[];
  /** How often test bots pick this among parameterless options (default 1; 0 = only when nothing else). */
  botWeight?: number;
}

/* ------------------------------------------------------------------- Zones */

export type ZoneKind = "drawPile" | "hand" | "discard" | "table" | "stack" | "captured" | "other";

export interface ZoneDefinition {
  id: string;
  name: string;
  owner: "game" | "player";
  visibility: "public" | "owner" | "hidden";
  ordering: "ordered" | "unordered";
  /** Drives HAND_EMPTY / DRAW_PILE_EMPTY events and the generated rulebook. */
  kind?: ZoneKind;
}

/* ------------------------------------------------------------------- Setup */

export interface SetupDefinition {
  /** Game zone that receives the freshly generated deck. */
  deckZone: string;
  shuffle: boolean;
  /** Effects run once, in order, when the match starts (dealing, trump, roles…). */
  steps: EffectDefinition[];
  /** Becomes the current player after the steps (if no step chose one). */
  startingPlayer?: PlayerRef;
  firstPhase: string;
}

/* ------------------------------------------------------------------ Phases */

export interface PhaseTransition {
  to: string;
  /** Missing = always (use as the last, fallback transition). */
  when?: ConditionNode;
}

export interface PhaseDefinition {
  id: string;
  name: string;
  description?: string;
  allowedActions: string[];
  /** Further limits who may act in this phase. */
  activeRoles?: string[];
  onEnter: EffectDefinition[];
  onExit?: EffectDefinition[];
  /** Checked after every action; the first matching one moves the game on. */
  transitions: PhaseTransition[];
  /** No player input: transitions are evaluated right after entry. */
  automatic?: boolean;
  /** A player whose only option is "pass" passes automatically. */
  autoPass?: boolean;
}

/* -------------------------------------------------------------------- Rules */

export interface RuleDefinition {
  id: string;
  name: string;
  description?: string;
  trigger: GameEventType;
  condition?: ConditionNode;
  effects: EffectDefinition[];
  /** Higher runs first. Default 0. */
  priority?: number;
  /** When this rule fires, lower-priority rules ignore the same event. */
  stopProcessing?: boolean;
  enabled?: boolean;
}

/** Documentation of the events a game cares about (shown in the editor). */
export interface EventDefinition {
  type: GameEventType;
  description: string;
}

/* ----------------------------------------------------------- End conditions */

export const END_CONDITION_TYPES = ["PLAYER_HAND_EMPTY", "LAST_ACTIVE_PLAYER", "LAST_PLAYER_WITH_CARDS", "FIRST_TO_SCORE", "HIGHEST_SCORE", "CUSTOM_DECLARATIVE_CONDITION"] as const;
export type EndConditionType = (typeof END_CONDITION_TYPES)[number];

export interface EndConditionDefinition {
  id: string;
  type: EndConditionType;
  label?: string;
  /** PLAYER_HAND_EMPTY / LAST_PLAYER_WITH_CARDS: zones whose cards count. */
  zones?: string[];
  /** PLAYER_HAND_EMPTY: "win" ends the game with that player winning; "finish" only marks them finished. */
  /** LAST_*: whether the last remaining player wins or loses. */
  outcome?: "win" | "finish" | "lastWins" | "lastLoses";
  /** FIRST_TO_SCORE target. */
  target?: ValueRef;
  /** HIGHEST_SCORE / CUSTOM: when to check. HIGHEST_SCORE without it checks only when nothing else ended the game. */
  when?: ConditionNode;
  /** HIGHEST_SCORE: what is compared. */
  measure?: "score" | { zones: string[] };
  /** CUSTOM: who wins / loses (default: winners = "self"-less → use sets). */
  winners?: PlayerSetRef;
  losers?: PlayerSetRef;
  draw?: boolean;
  /** Only evaluated while one of these phases is current. */
  phases?: string[];
}

/* ----------------------------------------------------------------- Settings */

export type GameSettingDefinition =
  | { key: string; label: string; description?: string; type: "integer"; default: number; min: number; max: number }
  | { key: string; label: string; description?: string; type: "boolean"; default: boolean }
  | { key: string; label: string; description?: string; type: "select"; default: string; options: { value: string; label: string }[] }
  | { key: string; label: string; description?: string; type: "string"; default: string; maxLength?: number };

export type SettingValue = number | boolean | string;

export interface VariableDefinition {
  key: string;
  label?: string;
  initial: Primitive;
  /** Shown on the game table (e.g. the pot). */
  visible?: boolean;
}

/* --------------------------------------------------------------- Definition */

export interface Rulebook {
  overview: string;
  setup: string;
  gameplay: string;
  winning: string;
  notes?: string;
}

export interface GameDefinition {
  schemaVersion: number;
  id: string;
  name: string;
  description: string;
  players: { min: number; max: number };
  deck: DeckDefinition;
  zones: ZoneDefinition[];
  setup: SetupDefinition;
  phases: PhaseDefinition[];
  actions: ActionDefinition[];
  rules: RuleDefinition[];
  events: EventDefinition[];
  endConditions: EndConditionDefinition[];
  settings?: GameSettingDefinition[];
  /** Game-wide variables (`trumpSuit` is built in). */
  variables?: VariableDefinition[];
  /** Per-player variables, initialised for every seat. */
  playerVariables?: VariableDefinition[];
  /** Roles players can hold (attacker, defender, …). */
  roles?: string[];
  /** Card combinations, weakest first (hand rankings), used by the rankHands effect. */
  combinations?: CombinationDefinition[];
  /** What a player's score is called on the table ("Chips", "Points"). */
  scoreLabel?: string;
  rulebook: Rulebook;
  /** Template this game was created from, for reference only. */
  templateId?: string;
}

/* -------------------------------------------------------------------- State */

export type PlayerStatus = "active" | "finished" | "eliminated";

export interface PlayerState {
  id: string;
  name: string;
  seat: number;
  isBot?: boolean;
  status: PlayerStatus;
  score: number;
  roles: string[];
  passed: boolean;
  variables: Record<string, Primitive>;
  /** 1 = first to finish. */
  finishPlace?: number;
  result?: "winner" | "loser" | "draw";
}

export interface ZoneState {
  /** Bottom → top. For player zones the owner is recorded. */
  cards: string[];
  definitionId: string;
  owner?: string;
}

export interface GameResult {
  winners: string[];
  losers: string[];
  draw: boolean;
  reason: string;
  endConditionId?: string;
}

export interface LogEntry {
  seq: number;
  kind: "event" | "rule" | "action" | "info";
  text: string;
  event?: GameEventType;
  ruleId?: string;
  playerId?: string;
}

export interface GameState {
  gameId: string;
  gameVersionId: string;
  players: PlayerState[];
  /** Key: zone id for game zones, `${zoneId}:${playerId}` for player zones. */
  zones: Record<string, ZoneState>;
  /** Every card in the match by id. */
  cards: Record<string, Card>;
  /** Cards turned face up regardless of their zone's visibility. */
  faceUp: Record<string, boolean>;
  /** Per-card annotations (e.g. `covered`). Cleared when a card changes zone. */
  marks: Record<string, Record<string, Primitive>>;
  currentPlayerId?: string;
  currentPhase: string;
  turnNumber: number;
  roundNumber: number;
  variables: Record<string, Primitive>;
  settings: Record<string, SettingValue>;
  status: "waiting" | "playing" | "finished";
  result?: GameResult;
  rng: RngState;
  /** Incremented on every accepted action; clients send it to detect stale moves. */
  revision: number;
  log: LogEntry[];
  logSeq: number;
  rankOrder: Rank[];
}

export type TrumpSuit = Suit | null;

/* ------------------------------------------------------------------ Actions */

export interface ActionRequest {
  actionId: string;
  cardId?: string;
  targetCardId?: string;
}

export interface ActionOption {
  cardId?: string;
  targetCardId?: string;
}

export interface AvailableAction {
  actionId: string;
  type: ActionType;
  label: string;
  /** Empty for parameterless actions. */
  options: ActionOption[];
}

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; state: GameState; error: string };
