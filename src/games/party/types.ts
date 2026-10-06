export type Difficulty = "easy" | "medium" | "hard";
export type TileType =
  | "coin"
  | "item"
  | "rare"
  | "event"
  | "deposit"
  | "bank"
  | "property"
  | "heal"
  | "duel"
  | "warp"
  | "hazard"
  | "boost"
  | "empty";
export type Phase =
  | "START_ROLL"
  | "ITEM_PHASE"
  | "ITEM_REPLACE"
  | "ITEM_AIM"
  | "DICE_ROLL"
  | "MOVEMENT"
  | "PATH_SELECTION"
  | "RESOLVE_TILE"
  | "PLUTO_OFFER"
  | "PROPERTY_OFFER"
  | "TRANSPORT_OFFER"
  | "DUEL_INTRO"
  | "DUEL_MINIGAME"
  | "DUEL_RESULTS"
  | "TURN_END"
  | "ANIMAL_PHASE"
  | "MINIGAME_INTRO"
  | "MINIGAME"
  | "MINIGAME_RESULTS"
  | "ROUND_END"
  | "GAME_OVER";
export interface BoardNode {
  id: string;
  x: number;
  y: number;
  type: TileType;
  connections: string[];
  region: number;
  plutoEligible?: boolean;
}
// A visual/strategic area of a map (an island on Sunspill, a mountain zone on Mountain).
export interface Region {
  name: string;
  x: number;
  y: number;
  color: number;
  motif: string;
}
export type MapTheme = "tropical" | "mountain";
// A paired shortcut (Cable Car, Mine Cart). Landing on either endpoint offers a ride to the other.
// The ride is not dice movement and never resolves the destination's field (see engine `RIDE_TRANSPORT`).
export interface MapTransport {
  id: string;
  kind: "cable-car" | "mine-cart";
  name: string;
  icon: string;
  endpoints: [string, string];
  endpointNames: [string, string];
  // Coins paid to ride; 0 = free (v1 balance for both transports).
  cost: number;
  prompt: string;
  rideLabel: string;
  stayLabel: string;
}
// Frozen Slide: landing on `nodeId` (after its own field resolves) forces the player along `path`; only the
// final node then resolves, once. `path` lists the nodes entered, each connected to the previous one.
export interface MapSlide {
  nodeId: string;
  path: string[];
}
// Presentation overrides for a tile type on one map (Sunspill keeps the defaults in `tilePresentation`).
export interface TileText {
  label?: string;
  icon?: string;
  color?: number;
}
// Map-specific wording used by the engine log so generic rules stay map-agnostic.
export interface MapFlavor {
  welcome: string;
  roundStart: string;
  warp: string;
  hazard: string;
  empty: string;
  // Optional toast shown when a player lands on the Nothing field.
  emptyToast?: string;
}
export interface BoardNode {
  id: string;
  x: number;
  y: number;
  type: TileType;
  connections: string[];
  region: number;
  plutoEligible?: boolean;
}
export interface BoardMap {
  id: string;
  name: string;
  theme: MapTheme;
  // Lobby picker copy.
  tagline: string;
  description: string;
  start: string;
  // Logical canvas size the node coordinates live in.
  size: { width: number; height: number };
  nodes: BoardNode[];
  spaceCount?: number;
  fieldDistribution?: Partial<Record<TileType, number>>;
  regions: Region[];
  eventHooks: string[];
  // Random Event pool (event registry ids); each event is also filtered by its own `allowedMaps`.
  eventPoolIds: string[];
  goldenPlutoCount: number;
  propertyName: string;
  flavor: MapFlavor;
  tiles?: Partial<Record<TileType, TileText>>;
  // Warp fields: source node -> destination node. Without an entry the warp goes to the next region.
  warps?: Record<string, string>;
  transports?: MapTransport[];
  slides?: MapSlide[];
  // Undirected connections an Avalanche may close (only if the board stays connected).
  blockableEdges?: [string, string][];
}
export interface Settings {
  mapId: string;
  victory: "plutos" | "coins";
  plutoTarget: number;
  coinTarget: number;
  difficulty: Difficulty;
  fillBots: boolean;
}
// Generic per-player status effects (status/effects.ts). One entry per id: re-applying refreshes it.
export type StatusEffectId = "radiation";
export interface StatusEffect {
  id: StatusEffectId;
  // Affected turns still to come. Each affected turn start consumes one; an effect at 0 is in its final
  // affected turn and is removed at that player's TURN_END.
  remainingTurns: number;
}
// Irradiated board area left by a Fallout Core. Live match state only. Active from creation through
// the end of round `expiresAfterRound`; removed at that round's ROUND_END.
export interface RadiationZone {
  id: string;
  sourcePlayerId: string;
  nodeIds: string[];
  createdRound: number;
  expiresAfterRound: number;
}
export type AnimalType = "cheetah" | "crocodile";
// A summoned animal (Wild Totem). Board entity, never a Player; moved only in the Animal Phase.
export interface AnimalInstance {
  id: string;
  type: AnimalType;
  ownerPlayerId: string;
  currentNodeId: string;
  remainingRounds: number;
  movementPerPhase: number;
  damage: number;
  // Creation order; the Animal Phase processes animals by ascending sequence.
  sequence: number;
}
export interface AnimalHit {
  playerId: string;
  nodeId: string;
  damage: number;
  knockedOut: boolean;
}
// What one animal did in the current Animal Phase (drives client animation; authoritative results).
export interface AnimalStep {
  animalId: string;
  type: AnimalType;
  ownerPlayerId: string;
  fromNodeId: string;
  // Nodes entered in order (empty when it did not move).
  path: string[];
  targetPlayerId: string | null;
  hits: AnimalHit[];
  despawned: boolean;
}
export interface AnimalPhaseState {
  sequence: number;
  startedAt: number;
  endsAt: number;
  steps: AnimalStep[];
}
export type ItemRarity = "common" | "uncommon" | "rare";
export interface ItemInstance {
  instanceId: string;
  itemId: string;
}
// Board-distance category of an aimed weapon. "global" = the weapon ignores distance (Lucky Six).
export type RangeBand = "close" | "medium" | "long" | "global";
export type AimQuality = "centered" | "partial" | "miss";
// Server-generated aiming challenge for Scatterblaster / Lucky Six (phase ITEM_AIM). The target marker
// sways along `motion`, seeded by the server when aiming starts; the server alone scores the release.
export interface AimChallenge {
  itemInstanceId: string;
  itemId: string;
  playerId: string;
  targetPlayerId: string;
  distance: number | null;
  band: RangeBand;
  startedAt: number;
  expiresAt: number;
  // Normalized field [-1, 1]²: x(t) = ax·sin(2π·fx·t + px), y likewise, t in seconds since startedAt.
  motion: { ax: number; ay: number; fx: number; fy: number; px: number; py: number };
  // Server clock at snapshot time, filled only in the network view.
  serverNow?: number;
}
// Authoritative outcome of an aimed shot, computed from the validated release.
export interface AimResult {
  quality: AimQuality;
  offset: number;
  elapsedMs: number;
  timedOut: boolean;
}
// Temporary per-turn state. It is rebuilt whenever a new turn begins and is never stored on a Player.
export interface TurnState {
  hasRolled: boolean;
  bonusMovement: number;
  bonusRolled: boolean;
  usedItemThisTurn: boolean;
  aim: AimChallenge | null;
}
export type DuelWager =
  | { type: "coins"; amount: number }
  | { type: "pluto"; amount: 1 };
// Temporary Duel Saber state (phases DUEL_INTRO → DUEL_MINIGAME → DUEL_RESULTS). The duel minigame
// itself runs in `Match.minigame`; this holds only the challenge, the escrowed pot and the settlement.
// Cleared when the duel ends; nothing duel-related is stored on a Player.
export interface DuelState {
  // "duel-saber": wagered transfer. "pocket-duel": no wager, the winner receives one newly created Pluto.
  kind: "duel-saber" | "pocket-duel";
  challengerPlayerId: string;
  defenderPlayerId: string;
  // null for Pocket Duel (no stake of any kind).
  wager: DuelWager | null;
  // Coins held in escrow (both stakes). Plutos are not escrowed: the loser's Pluto is transferred at
  // settlement, which is safe because every board action is locked during the duel.
  pot: number;
  minigameId: string;
  winnerPlayerId: string | null;
  // Coins / Plutos each duelist received at settlement (display only).
  payout: Record<string, { coins: number; plutos: number }> | null;
}
export type FeedbackKind =
  | "HEAL"
  | "DAMAGE"
  | "HIT"
  | "KO"
  | "RESPAWN"
  | "ITEM_GAINED"
  | "ITEM_USED"
  | "ITEM_DISCARDED"
  | "BONUS_ROLL"
  | "EXPLOSION"
  | "PROPERTY_CLAIMED"
  | "PROPERTY_UPGRADED"
  | "TOLL"
  | "PLUTO_STOLEN"
  | "MINIGAME_REWARD"
  | "SHOT"
  | "MISS"
  | "DUEL_CHALLENGE"
  | "DUEL_WAGER"
  | "DUEL_WON"
  | "DUEL_REWARD"
  | "FALLOUT"
  | "RADIATION"
  | "RADIATION_FADED"
  | "ANIMAL_SUMMONED"
  | "ANIMAL_MOVED"
  | "ANIMAL_HIT"
  | "ANIMAL_DESPAWNED"
  | "EVENT"
  | "AVALANCHE"
  | "ROUTE_REOPENED"
  | "TRANSPORT"
  | "SLIDE";
// Structured notifications ride inside the authoritative match snapshot next to the text log.
export interface FeedbackEvent {
  id: number;
  kind: FeedbackKind;
  text: string;
  playerId?: string;
  amount?: number;
  nodeId?: string;
}
// Temporarily closed connection (Avalanche today; bridge collapses later). Match state, never map content:
// the map graph is never mutated. Active for the rest of the creation round R and rounds up to and including
// `expiresAfterRound`; removed at that round's ROUND_END (blocked in round 5 for 2 rounds: rounds 5 and 6,
// open again in round 7).
export interface BlockedConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  expiresAfterRound: number;
  source: string;
}
// A transport (Cable Car, Mine Cart) that is out of service. Same expiry convention as BlockedConnection.
export interface TransportOutage {
  transportId: string;
  expiresAfterRound: number;
  source: string;
}
// Last forced (non-dice) movement, for client animation and camera. `pending` is true between a slide and
// the landing resolution of its final node; it prevents that landing from chaining another forced move.
export interface ForcedMove {
  sequence: number;
  kind: "slide" | "cable-car" | "mine-cart";
  playerId: string;
  fromNodeId: string;
  path: string[];
  pending: boolean;
}
export type PropertyLevel = 0 | 1 | 2 | 3 | 4;
// Authoritative ownership record for one property node (level 0 = unowned).
export interface PropertyState {
  nodeId: string;
  ownerPlayerId: string | null;
  level: PropertyLevel;
  level4LastTriggeredRound: number | null;
}
export type MinigameType = "main" | "duel";
export type MinigamePosition = 1 | 2 | 3 | 4;
// The only thing the match engine learns from a finished minigame.
export interface MinigameResult {
  playerId: string;
  position: MinigamePosition;
  score?: number;
}
// Live, temporary minigame session. Lives only in match memory and is cleared at ROUND_END.
// `state` is owned by the minigame module; the board engine never inspects it.
export interface MinigameRuntime {
  minigameId: string;
  participants: string[];
  status: "INTRO" | "ACTIVE" | "FINISHED";
  introStartedAt: number;
  startedAt: number;
  endsAt: number;
  resultsEndsAt: number | null;
  state: unknown;
  results: MinigameResult[] | null;
  rewards: Record<string, number> | null;
  rewardsApplied: boolean;
  // Server clock at snapshot time, filled only in the network view so clients can sync timers.
  serverNow?: number;
}
// Bounded primitive record; the active minigame parses it strictly.
export type MinigameInput = Record<string, string | number | boolean>;
export interface Player {
  id: string;
  name: string;
  avatarId: number;
  isBot: boolean;
  difficulty: Difficulty;
  ready: boolean;
  connected: boolean;
  coins: number;
  goldenPlutos: number;
  hp: number;
  maxHp: number;
  currentNodeId: string;
  previousNodeId: string | null;
  inventory: ItemInstance[];
  statusEffects: StatusEffect[];
  // Set by the authority while a human is disconnected: the server time when their seat is handed to a
  // bot. Absent/null while connected.
  reconnectDeadline?: number | null;
  // True when a human's seat was handed to a bot after the reconnect grace period (same player slot).
  botTakeover?: boolean;
}
// Factual per-player tallies for the final results screen (not used by any rule).
export interface PlayerMatchStats {
  minigameWins: number;
  duelWins: number;
  knockouts: number;
}
export interface RollEntry {
  playerId: string;
  value: number;
  wave: number;
}
export interface Match {
  // Authoritative map for this match, fixed at creation. Clients never choose or change it.
  mapId: string;
  phase: Phase;
  players: Player[];
  order: string[];
  turnIndex: number;
  round: number;
  movesRemaining: number;
  lastRoll: number | null;
  startingRolls: RollEntry[];
  rollGroups: string[][];
  rollWave: number;
  bank: number;
  plutoNodeIds: string[];
  plutoSpawn: { sequence: number; nodeId: string | null };
  properties: PropertyState[];
  turn: TurnState;
  pendingItem: ItemInstance | null;
  nextItemNumber: number;
  events: FeedbackEvent[];
  eventSeq: number;
  minigame: MinigameRuntime | null;
  lastMinigameId: string | null;
  duel: DuelState | null;
  lastDuelMinigameId: string | null;
  radiationZones: RadiationZone[];
  nextZoneNumber: number;
  animals: AnimalInstance[];
  nextAnimalNumber: number;
  // Set while the Animal Phase is resolving/animating; null otherwise.
  animalPhase: AnimalPhaseState | null;
  animalPhaseSeq: number;
  blockedConnections: BlockedConnection[];
  nextBlockNumber: number;
  transportOutages: TransportOutage[];
  forcedMove: ForcedMove | null;
  forcedMoveSeq: number;
  log: string[];
  winner: string | null;
  stats: Record<string, PlayerMatchStats>;
}
export interface Lobby {
  code: string;
  name: string;
  public: boolean;
  hostId: string;
  settings: Settings;
  players: Player[];
  match: Match | null;
}
export interface LobbySummary {
  code: string;
  name: string;
  count: number;
  mapId: string;
  public: boolean;
}
export type GameAction =
  | { type: "ROLL_DICE" }
  | { type: "SELECT_PATH"; nodeId: string }
  | { type: "BUY_PROPERTY"; nodeId: string }
  | { type: "UPGRADE_PROPERTY"; nodeId: string }
  | { type: "LEAVE_PROPERTY" }
  | { type: "RIDE_TRANSPORT"; transportId: string }
  | { type: "DECLINE_TRANSPORT" }
  | { type: "BUY_PLUTO" }
  | { type: "LEAVE_PLUTO" }
  | {
      type: "USE_ITEM";
      itemInstanceId: string;
      targetNodeId?: string;
      targetPlayerId?: string;
      wager?: DuelWager;
    }
  // Release of an aimed shot: bounded normalized reticle position and the client's elapsed aim time,
  // which the server accepts only inside a small latency window. Damage is never sent.
  | { type: "FIRE_ITEM"; aimX: number; aimY: number; elapsedMs?: number }
  | { type: "CANCEL_AIM" }
  | { type: "REPLACE_ITEM"; replaceInstanceId: string }
  | { type: "DISCARD_NEW_ITEM" }
  | { type: "MINIGAME_INPUT"; input: MinigameInput };
export type ClientMessage =
  | { type: "HELLO"; token?: string }
  | { type: "LIST"; query: string }
  | { type: "CREATE"; name: string; playerName: string; public: boolean }
  | { type: "JOIN"; code: string; playerName: string }
  | { type: "READY"; ready: boolean }
  | { type: "SETTINGS"; settings: Settings }
  | { type: "ADD_BOT" }
  | { type: "REMOVE"; playerId: string }
  | { type: "BOT_DIFFICULTY"; playerId: string; difficulty: Difficulty }
  | { type: "START" }
  | { type: "LEAVE" }
  // Host only, after GAME_OVER: everyone returns to the same lobby with fresh players.
  | { type: "RETURN_TO_LOBBY" }
  // Application-level liveness check (the client uses it after returning from the background).
  | { type: "PING" }
  | { type: "ACTION"; action: GameAction };
// Machine-readable error categories so the client can react (e.g. stop reconnecting when replaced).
export type ErrorCode =
  | "INVALID"
  | "LOBBY_NOT_FOUND"
  | "LOBBY_FULL"
  | "MATCH_STARTED"
  | "RATE_LIMITED"
  | "SERVER_FULL"
  | "SESSION_REPLACED"
  | "MATCH_ERROR"
  | "SERVER_ERROR"
  | "SHUTDOWN";
export type ServerMessage =
  // `resumed` is true when the token matched an existing session (seat and room restored).
  | { type: "SESSION"; token: string; playerId: string; resumed: boolean; reconnectGraceMs: number }
  // `serverNow` lets clients show server-timed countdowns (reconnect deadlines) without clock drift.
  | { type: "STATE"; lobby: Lobby | null; serverNow?: number }
  | { type: "LOBBIES"; lobbies: LobbySummary[] }
  | { type: "PONG" }
  | { type: "ERROR"; message: string; code?: ErrorCode };
