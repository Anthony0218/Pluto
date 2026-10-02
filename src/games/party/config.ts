import type { Settings, TileType } from "./types.ts";
export const RULES = {
  slots: 4,
  coins: 20,
  hp: 20,
  maxHp: 40,
  inventory: 3,
  dieMax: 10,
  coinTile: 3,
  plutoPrice: 20,
  bankDeposit: 3,
  heal: 10,
  hazard: 5,
  koCoins: 5,
  megaMedkitHeal: 20,
  turboBootsMax: 5,
  cometMelonDamage: [15, 10, 5],
} as const;
export const MAX_INVENTORY_SIZE = RULES.inventory;
export const FEEDBACK_HISTORY = 12;
export const DEFAULT_SETTINGS: Settings = {
  mapId: "sunspill",
  victory: "plutos",
  plutoTarget: 5,
  coinTarget: 200,
  difficulty: "medium",
  fillBots: true,
};
export const COLORS = ["#ff8c69", "#a5a2ff", "#74e2bd", "#ffdc72"];

export const PROPERTY_CONFIG = {
  purchaseCost: 5,
  upgradeCost: 5,
  maxLevel: 4,
  tolls: { 1: 3, 2: 5, 3: 10 } as Record<number, number>,
  level4FallbackCoins: 15,
  level4CooldownCoins: 10,
  level4CooldownRounds: 3,
} as const;

// Main minigame placement rewards. The server applies these; clients only display them.
export const MAIN_MINIGAME_REWARDS: Record<1 | 2 | 3 | 4, number> = {
  1: 10,
  2: 5,
  3: 3,
  4: 0,
};
// Phase pacing around every minigame (the minigame's own duration comes from its definition).
export const MINIGAME_FLOW = {
  introMs: 7000,
  countdownMs: 3000,
  resultsMs: 8000,
} as const;

// ---- Milestone 7: aimed weapons and duels -------------------------------------------------------
// Aim geometry is in a normalized field [-1, 1]². `offset` is the distance between the released reticle
// and the target centre at the validated release time; the server alone maps it to damage.
export const AIM_CONFIG = {
  // A client-reported release time is accepted if it is at most this much earlier than server receipt.
  latencyToleranceMs: 300,
  // After the aim window closes the server waits this long for a late release, then scores a miss.
  expiryGraceMs: 1500,
  // Bot reticle error (standard deviation per axis) by difficulty. Hard is good but never perfect.
  botError: { easy: 0.17, medium: 0.1, hard: 0.05 },
} as const;

export interface ScatterBand {
  band: "close" | "medium" | "long";
  // Inclusive upper bound of the shortest graph distance for this band.
  maxNodes: number;
  // Visual size of the target marker (smaller when farther away).
  targetRadius: number;
  // offset <= centerRadius → centered; offset <= hitRadius → partial; otherwise miss.
  centerRadius: number;
  hitRadius: number;
  damage: { centered: number; partial: number };
}
// Board range uses shortest graph distance (engine/graph.ts), never pixels. Sunspill islands are
// 10-space rings, so 0–5 spaces covers roughly your own island and the next bridge.
export const SCATTERBLASTER_CONFIG = {
  bands: [
    { band: "close", maxNodes: 1, targetRadius: 0.15, centerRadius: 0.1, hitRadius: 0.34, damage: { centered: 20, partial: 15 } },
    { band: "medium", maxNodes: 3, targetRadius: 0.12, centerRadius: 0.08, hitRadius: 0.27, damage: { centered: 10, partial: 10 } },
    { band: "long", maxNodes: 5, targetRadius: 0.09, centerRadius: 0.06, hitRadius: 0.21, damage: { centered: 5, partial: 5 } },
  ] as readonly ScatterBand[],
  aimWindowMs: 6000,
  motion: { amplitude: [0.5, 0.4], frequencyHz: [0.22, 0.42] },
} as const;
// Global range; skill comes from a small, faster target. No spread, no partial damage.
export const LUCKY_SIX_CONFIG = {
  damage: 20,
  targetRadius: 0.075,
  hitRadius: 0.085,
  aimWindowMs: 5000,
  motion: { amplitude: [0.62, 0.55], frequencyHz: [0.45, 0.75] },
} as const;

export const DUEL_CONFIG = {
  coinPresets: [5, 10, 20] as readonly number[],
  minCustomCoins: 1,
} as const;
// Pacing around a Duel Saber duel (the duel minigame's own duration comes from its definition).
export const DUEL_FLOW = {
  introMs: 6000,
  countdownMs: 3000,
  resultsMs: 7000,
} as const;
// Rough duel win chance a bot assumes for a duelist of each kind; humans count as medium.
export const DUEL_BOT_SKILL = { easy: 0.35, medium: 0.5, hard: 0.62 } as const;

// ---- Milestone 8: rare items, radiation and summoned animals ------------------------------------
// Rare Item field weights (item id → relative weight). The only place rare-pool balance lives.
export const RARE_ITEM_WEIGHTS: Record<string, number> = {
  "pocket-duel": 1,
  "fallout-core": 1,
  "wild-totem": 1,
};
export const FALLOUT_CONFIG = {
  // Nodes stay irradiated for the rest of the creation round plus this many full rounds.
  zoneRounds: 3,
} as const;
export const RADIATION_CONFIG = {
  // Affected turns of the Radiation status; each deals damage at turn start and locks items.
  durationTurns: 3,
  damagePerTurn: 10,
} as const;
// Wild Totem summon weights (animal id → relative weight).
export const WILD_TOTEM_WEIGHTS: Record<string, number> = {
  cheetah: 1,
  crocodile: 1,
};
export const ANIMAL_CONFIG = {
  maxPerOwner: 1,
  cheetah: { movementPerPhase: 5, damage: 10, lifetimeRounds: 15 },
  crocodile: { movementPerPhase: 2, damage: 20, lifetimeRounds: 15 },
} as const;
// Pacing of the Animal Phase animation window (board tick is 700 ms).
export const ANIMAL_PHASE_FLOW = {
  baseMs: 1400,
  perAnimalMs: 1800,
} as const;
// Route-scoring penalties bots apply to hazards. Easy bots ignore hazards `ignoreChance` of the time.
export const BOT_HAZARD_WEIGHTS = {
  radiation: { easy: 15, medium: 35, hard: 70 },
  ignoreChance: { easy: 0.5, medium: 0, hard: 0 },
  // Hostile animal within `near` nodes of a landing: strong penalty; within `far`: moderate.
  animalNear: 2,
  animalFar: 5,
  animal: {
    easy: { near: 10, far: 0 },
    medium: { near: 40, far: 15 },
    hard: { near: 55, far: 20 },
  },
} as const;

// ---- Milestone 9: Mountain map mechanics -----------------------------------------------------------
// Rounds an Avalanche keeps a connection closed, counting the round it happens in (2 = rest of this round
// plus the whole next round; open again the round after).
export const AVALANCHE_CONFIG = { durationRounds: 2 } as const;
// Rounds a Cable Car breakdown / Mine collapse keeps that transport closed (same counting).
export const TRANSPORT_OUTAGE_CONFIG = { durationRounds: 2 } as const;
// Chance an easy bot accepts an offered ride (medium/hard decide from the route).
export const BOT_TRANSPORT = { easyAcceptChance: 0.5 } as const;

// Exact field counts of every 60-space board (GAME_SPEC section 13). Golden Plutos are overlays, not fields.
export const MAP_NODE_COUNT = 60;
export const FIELD_DISTRIBUTION: readonly (readonly [TileType, number])[] = [
  ["coin", 18],
  ["item", 12],
  ["rare", 1],
  ["event", 6],
  ["deposit", 6],
  ["bank", 1],
  ["property", 6],
  ["heal", 3],
  ["duel", 2],
  ["warp", 2],
  ["hazard", 1],
  ["boost", 1],
  ["empty", 1],
];

// ---- Milestone 10: sessions, reconnects and network limits ---------------------------------------
// The only place these timings live; the server enforces them and the client reads them for display.
export const NETWORK_CONFIG = {
  // A disconnected human keeps their seat this long. In a match the seat then becomes bot-controlled
  // (same player, `isBot = true`); in a pre-game lobby the seat is released.
  reconnectGraceMs: 60_000,
  // A session token can reclaim its seat (taking it back from the bot) for this long after disconnecting.
  sessionTtlMs: 30 * 60_000,
  // Protocol-level ping; a socket that misses one full interval is considered dead.
  heartbeatMs: 15_000,
  handshakeTimeoutMs: 5_000,
  maxPayloadBytes: 4096,
  maxMessagesPerSecond: 25,
  maxRooms: 200,
  // Per client address, per minute.
  lobbyCreatesPerMinute: 6,
  codeLookupsPerMinute: 12,
  // Consecutive unexpected engine errors after which a match is aborted back to its lobby.
  maxMatchFailures: 3,
} as const;
// Lobby/player name bounds (enforced by the protocol parser; the inputs mirror them).
export const NAME_LIMITS = { lobby: 40, player: 24 } as const;
