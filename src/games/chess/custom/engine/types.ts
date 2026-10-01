/**
 * Chess Custom — the data model every variant is built from.
 *
 * Standard chess, portal chess, king-capture chess and user creations are all
 * plain `GameVariant` values: the engine never special-cases a preset. Everything
 * here is JSON-serializable (no functions, classes, Maps or Dates).
 */

export const VARIANT_SCHEMA_VERSION = 2;

/** Missing z in older saved variants means the ground board (z = 0). */
export type Coord = { x: number; y: number; z?: number };
export type Position3D = { x: number; y: number; z: number };
export type TeamId = string;
export type PieceTypeId = string;

/* ------------------------------------------------------------------ Board */

export const TILE_TYPES = [
  "normal",
  "blocked",
  "portal",
  "promotion",
  "goal",
  "spawn",
  "danger",
  "ice",
  "oneWay",
  "teleport",
] as const;
export type TileType = (typeof TILE_TYPES)[number];

export interface BoardCell {
  x: number;
  y: number;
  /** A disabled cell does not exist: no piece may stand on or pass through it. */
  enabled: boolean;
  tile: TileType;
  /** Portal destination (tile === "portal"). */
  portalTarget?: Coord;
  /** Restricts promotion/spawn/goal tiles to one team; undefined = every team. */
  team?: TeamId;
  /** One-way tiles may only be entered while travelling along this direction. */
  direction?: Coord;
}

export interface BoardDefinition {
  name?: string;
  width: number;
  height: number;
  /** Row-major, exactly width × height entries. Index = y * width + x. */
  cells: BoardCell[];
  /** Additional boards above the ground board. z values are positive and unique. */
  layers?: BoardLayer[];
}

export interface BoardLayer {
  id: string;
  name: string;
  z: number;
  width: number;
  height: number;
  cells: BoardCell[];
}

/* ----------------------------------------------------------------- Pieces */

/**
 * A single movement pattern.
 * - leap: jump straight to each offset (knight). `canJump: false` makes it a "lame" leaper.
 * - slide: repeat each offset as a step (rook/bishop), within min/max distance.
 * - teleport: from a teleport tile, move to any other teleport tile.
 */
export type MovementKind = "leap" | "slide" | "teleport";

export interface MovementRule {
  id: string;
  kind: MovementKind;
  offsets: Coord[];
  /** Slides: first reachable distance (default 1). */
  minDistance?: number;
  /** Slides: last reachable distance; 0 or undefined = unlimited. */
  maxDistance?: number;
  /** Leap: may pass over pieces. Slide: may hop over up to `maxJumps` pieces. */
  canJump?: boolean;
  /** Slides with canJump: how many pieces may be passed (default 1). */
  maxJumps?: number;
  /** "team" rotates offsets so +y is always the owning team's forward. */
  relativeTo: "team" | "board";
  /** Only while the piece has never moved (pawn double step). */
  firstMoveOnly?: boolean;
  /** Capture rules: the capture needs exactly one piece in between (xiangqi cannon). */
  requiresScreen?: boolean;
}

export const PIECE_ABILITIES = [
  "castling",
  "castlePartner",
  "enPassant",
  "invulnerable",
  "explosive",
] as const;
export type PieceAbility = (typeof PIECE_ABILITIES)[number];

export type PieceModelBase = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";
export type PieceModelAccent = "none" | "crown" | "orb" | "flame" | "shield" | "spike";

export interface PieceModelRef {
  base: PieceModelBase;
  accent?: PieceModelAccent;
  /** Optional emissive tint for the accent / rim, e.g. "#38bdf8". */
  tint?: string;
  scale?: number;
}

export interface PromotionRule {
  /** Where promotion happens: the far rank of the team, promotion tiles, or either. */
  zone: "farRank" | "tiles" | "both";
  options: PieceTypeId[];
}

export interface PieceDefinition {
  id: PieceTypeId;
  name: string;
  /** One or two letters used in move notation (K, N, Wz…). Empty for pawns. */
  symbol: string;
  /** Glyph shown on 2D boards (♞, ✦, 🐉…). */
  icon: string;
  model: PieceModelRef;
  description?: string;
  value: number;
  /** Royal pieces are what check, checkmate and king-capture rules protect. */
  royal: boolean;
  movement: MovementRule[];
  capture: MovementRule[];
  /** When true, `capture` is ignored and `movement` is used for both. */
  captureSameAsMove: boolean;
  abilities: PieceAbility[];
  promotion?: PromotionRule;
  /** Restrict the piece to some teams (undefined = any team). */
  teams?: TeamId[];
  /** Suggested number of copies per team for the setup palette. */
  spawnAmount?: number;
}

/* ------------------------------------------------------------------ Teams */

export interface TeamDefinition {
  id: TeamId;
  name: string;
  /** UI colour for chips and 2D pieces. */
  color: string;
  /** Unit vector: the team's "forward" (+y for the south team). */
  forward: Coord;
  /** Which of the two 3D model sets to use. */
  modelSet: "light" | "dark";
}

export interface PlacedPiece {
  type: PieceTypeId;
  team: TeamId;
  x: number;
  y: number;
  z?: number;
  /** Treat as already moved (no first-move rules, no castling). */
  moved?: boolean;
}

export interface PositionSetup {
  pieces: PlacedPiece[];
  startingTeam: TeamId;
  /** Full-move number to start counting from (normally 1). */
  turnNumber: number;
}

/* ------------------------------------------------------ Rules & royalty */

export type RoyalMode = "checkmate" | "capture" | "none";

export const KING_CONSEQUENCES = [
  "instantDefeat",
  "instantVictory",
  "continue",
  "loseAfterTurns",
  "respawn",
  "successor",
  "suddenDeath",
  "customEvent",
  "removeRequirement",
] as const;
export type KingConsequence = (typeof KING_CONSEQUENCES)[number];

/** What happens when a royal piece is captured. Compiled into editable events. */
export interface KingCaptureSettings {
  consequence: KingConsequence;
  /** Full turns for loseAfterTurns / respawn. */
  turns: number;
  /** Preferred successor for "successor" (falls back to the highest-value piece). */
  successor: PieceTypeId;
}

export interface GameSettings {
  /** How royal (king) pieces behave. */
  royalMode: RoyalMode;
  kingCapture: KingCaptureSettings;
  /** With several royals in checkmate mode: must every one stay safe, or only the last? */
  royalScope: "every" | "last";
  /** Outcome for a team with no legal moves that is not in check. */
  noLegalMoves: "draw" | "lose";
  /** Draw after this many plies (0 = never). */
  maxPlies: number;
  /** ANY: a team wins when one win condition holds. ALL: every win condition must hold. */
  victoryMode: "any" | "all";
}

/**
 * Global rule switches, kept as discrete typed entries rather than loose booleans.
 * castling / enPassant also need the matching piece ability.
 */
export const GAME_RULE_TYPES = ["castling", "enPassant", "forcedCapture", "friendlyFire"] as const;
export type GameRuleType = (typeof GAME_RULE_TYPES)[number];
export interface GameRule {
  id: string;
  type: GameRuleType;
  enabled: boolean;
}

/* ----------------------------------------------------------------- Events */

export const EVENT_TRIGGERS = [
  "gameStart",
  "turnStart",
  "turnEnd",
  "pieceMove",
  "pieceCapture",
  "pieceCaptured",
  "kingCaptured",
  "pieceEnterSquare",
  "pieceLeaveSquare",
  "promotion",
  "afterTurnNumber",
  "pieceCountEquals",
  "teamPieceCountEquals",
  "onlyKingsRemain",
  "tileEntered",
] as const;
export type EventTriggerType = (typeof EVENT_TRIGGERS)[number];

/**
 * Who an event talks about. Context teams are resolved when the event fires:
 * actor = the team that moved; target = the team that lost a piece.
 */
export type TeamRef = "actor" | "target" | "opponentOfActor" | "any" | TeamId;

export interface EventTrigger {
  type: EventTriggerType;
  team?: TeamRef;
  pieceType?: PieceTypeId;
  square?: Coord;
  tile?: TileType;
  count?: number;
  turn?: number;
}

export type ConditionType =
  | "teamHasPiece"
  | "teamLacksPiece"
  | "teamPieceCount"
  | "teamRoyalCount"
  | "turnNumber"
  | "squareOccupied"
  | "randomChance";

export interface EventCondition {
  id: string;
  type: ConditionType;
  team?: TeamRef;
  pieceType?: PieceTypeId;
  square?: Coord;
  op?: "eq" | "gte" | "lte";
  value?: number;
}

export const EVENT_ACTIONS = [
  "spawnPiece",
  "removePiece",
  "transformPiece",
  "movePiece",
  "teleportPiece",
  "changeTeam",
  "changePieceRule",
  "changeTile",
  "disableTile",
  "enableTile",
  "triggerAnimation",
  "displayMessage",
  "addTurn",
  "skipTurn",
  "endGame",
  "declareWinner",
  "declareLoser",
  "declareDraw",
  "setRoyalMode",
  "suddenDeath",
] as const;
export type EventActionType = (typeof EVENT_ACTIONS)[number];

/** Which piece an action applies to. */
export type PieceSelector =
  | "contextPiece"
  | "capturedPiece"
  | "firstOfType"
  | "highestValue"
  | "atSquare";

/** Where an action happens. */
export type SquareSelector = "square" | "contextSquare" | "originSquare" | "spawnTile";

export interface EventAction {
  id: string;
  type: EventActionType;
  team?: TeamRef;
  pieceType?: PieceTypeId;
  toPieceType?: PieceTypeId;
  target?: PieceSelector;
  at?: SquareSelector;
  square?: Coord;
  tile?: TileType;
  message?: string;
  animation?: "pulse" | "glow" | "shake";
  royalMode?: RoyalMode;
}

export interface GameEvent {
  id: string;
  name: string;
  enabled: boolean;
  trigger: EventTrigger;
  /** Plies to wait after the trigger before conditions are checked. */
  delayTurns: number;
  conditionMode: "all" | "any";
  conditions: EventCondition[];
  actions: EventAction[];
  elseActions: EventAction[];
  /** Fire at most once per game. */
  once: boolean;
  /** Generated by a king-capture consequence preset (replaced when that preset changes). */
  source?: "kingConsequence";
}

/* --------------------------------------------------------------- Victory */

export const VICTORY_TYPES = [
  "checkmate",
  "royalCaptured",
  "captureAll",
  "captureSpecific",
  "reachSquare",
  "reachZone",
  "surviveTurns",
  "controlSquares",
  "piecesRemaining",
  "eliminateType",
  "lastTeamStanding",
  "eventOutcome",
] as const;
export type VictoryType = (typeof VICTORY_TYPES)[number];

export interface VictoryCondition {
  id: string;
  type: VictoryType;
  enabled: boolean;
  /** Which teams may win this way ("any" = all teams). */
  team?: TeamRef;
  pieceType?: PieceTypeId;
  square?: Coord;
  count?: number;
  turns?: number;
}

/* ---------------------------------------------------------------- Variant */

export interface VariantTheme {
  boardTheme: string;
  pieceSkin: string;
}

export interface GameVariant {
  schemaVersion: number;
  id: string;
  name: string;
  description?: string;
  /** Revision counter, bumped on every save. */
  version: number;
  createdAt: string;
  updatedAt: string;
  /** Remix lineage — ready for future community sharing. */
  originalVariantId?: string;
  remixedFrom?: string;
  authorId?: string;
  presetId?: string;
  tags?: string[];

  teams: TeamDefinition[];
  board: BoardDefinition;
  pieces: PieceDefinition[];
  rules: GameRule[];
  events: GameEvent[];
  victoryConditions: VictoryCondition[];
  settings: GameSettings;
  setup: PositionSetup;
  theme: VariantTheme;
  /** Reserved for future scripting/extensions; ignored by the engine. */
  extensions?: Record<string, unknown>;
}

/* ------------------------------------------------------------ Game state */

export interface PieceInstance {
  id: string;
  type: PieceTypeId;
  team: TeamId;
  x: number;
  y: number;
  z?: number;
  moveCount: number;
  /** Where the piece started (used by respawn actions). */
  origin: Coord;
  /** Plies spent on a danger tile. */
  dangerPlies?: number;
}

export type MoveSource = "movement" | "capture" | "castle" | "enPassant" | "teleport";

export interface Move {
  pieceId: string;
  from: Coord;
  to: Coord;
  /** Where the piece really ends (after portals / ice). */
  landing?: Coord;
  captureIds: string[];
  source: MoveSource;
  ruleId: string;
  /** Offset that produced the move, in board space. */
  offset: Coord;
  promotion?: PieceTypeId;
  castle?: { partnerId: string; partnerTo: Coord };
  /** Squares the piece passes through, for animation. */
  path: Coord[];
}

export interface GameResult {
  winners: TeamId[];
  draw: boolean;
  reason: string;
}

export interface GameMessage {
  ply: number;
  text: string;
  kind: "info" | "event" | "victory" | "warning";
}

export type EffectKind =
  | "capture"
  | "royalCapture"
  | "promotion"
  | "portal"
  | "spawn"
  | "transform"
  | "pulse"
  | "glow"
  | "shake"
  | "tile";

export interface VisualEffect {
  kind: EffectKind;
  at: Coord;
  to?: Coord;
}

export interface ScheduledEvent {
  eventId: string;
  atPly: number;
  context: EventContext;
}

export interface EventContext {
  actor?: TeamId;
  target?: TeamId;
  pieceId?: string;
  pieceType?: PieceTypeId;
  capturedId?: string;
  capturedType?: PieceTypeId;
  square?: Coord;
  origin?: Coord;
}

export interface FiredEvent {
  eventId: string;
  name: string;
  branch: "then" | "else" | "scheduled";
  ply: number;
}

export interface GameState {
  pieces: PieceInstance[];
  /** Live board (events may change tiles). */
  board: BoardDefinition;
  turn: TeamId;
  ply: number;
  turnNumber: number;
  result: GameResult | null;
  enPassant: { square: Coord; pieceId: string } | null;
  royalMode: RoyalMode;
  suddenDeath: boolean;
  /** pieceType → pieceType whose movement it uses (changePieceRule). */
  ruleOverrides: Record<PieceTypeId, PieceTypeId>;
  extraTurns: Record<TeamId, number>;
  skipTurns: Record<TeamId, number>;
  eliminated: TeamId[];
  scheduled: ScheduledEvent[];
  firedOnce: string[];
  captured: { type: PieceTypeId; team: TeamId; by: TeamId }[];
  messages: GameMessage[];
  /** Effects produced by the most recent move. */
  effects: VisualEffect[];
  /** Events fired by the most recent move. */
  fired: FiredEvent[];
  nextId: number;
  /** Deterministic RNG state so replays and rewinds are exact. */
  seed: number;
  /** Piece counts at game start, per team and type (victory reachability). */
  initialCounts: Record<TeamId, Record<PieceTypeId, number>>;
}
