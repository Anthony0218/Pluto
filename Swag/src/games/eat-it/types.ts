import type { FoodKind, PowerKind } from './config.ts';
export type MapId = 'city' | 'nature';
export type Vec = { x: number; y: number };
export type Input = Vec;
export type BotState = 'FORAGE' | 'FLEE' | 'HUNT' | 'POWERUP' | 'REPOSITION';
export type Player = Vec & {
  id: string; name: string; bot: boolean; color: string; mass: number; vx: number; vy: number; facing: number;
  storedJump?: boolean; storedStrike?: boolean; ability?: { kind: 'jump' | 'strike'; startedAt: number; endsAt: number; origin: Vec; direction: Vec; crossedGap?: boolean }; lastStrikeAt?: number; storedGrowth?: boolean; growthModifier?: number; stunnedUntil?: number; hellScale?: number; knockback?: Vec & { until: number };
  shieldHitAt?: number; chokingUntil?: number; nextBurp?: number; burpAt?: number;
  lives?: number; respawnAt?: number; stats?: MatchStats; escape?: EscapeState; helper?: AnimalHelper; fallingAt?: number;
  alive: boolean; placement: number | null; eliminatedBy: string | null; eliminatedAt: number | null;
  score: number; foodEaten: number; playersEaten: number; powerupsCollected: number;
  effects: Record<PowerKind, number>; input: Input; botState: BotState; nextDecision: number;
};
export type FoodObject = Vec & { id: number; kind: FoodKind; vx: number; vy: number; z: number; vz: number; rotation: number; target: string | null; capturedAt: number; spawnedAt?: number; delivery?: { from: Vec; startedAt: number; duration: number; height: number }; rewardMultiplier?: number; rewardOwner?: string; availableAt?: number; stuck?: { playerId: string; since: number; until: number }; spit?: { since: number; origin: Vec; destination: Vec; rotation: number; fromZ?: number }; entryForward?: number; entrySide?: number; treeEntryDepth?: number; fallX?: number; fallY?: number; fallPivot?: number; fallTip?: number; fallOffsetX?: number; fallOffsetY?: number };
export type PowerObject = Vec & { id: number; kind: PowerKind };
export type GameEvent = Vec & { id: number; at: number; amount?: number; status?: string; type: 'jump' | 'strike' | 'growth' | 'growthActive' | 'eruption' | 'burp' | 'food' | 'eat' | 'power' | 'collision' | 'eliminated' | 'win' | 'choke' | 'questPickup' | 'questComplete' | 'npcFeed' | 'npcEmerge' | 'npcAttack' | 'escape' | 'hellAssist' | 'respawn' | 'hellStart' | 'sweep' | 'groundWarning' | 'groundDestroyed' | 'fall' | 'lava' | 'tie'; playerId: string; victimId?: string; food?: FoodKind; power?: PowerKind; radius?: number };
export type GameState = {
  id: string; map: MapId; rng: number; nextId: number; time: number; status: 'playing' | 'finished'; winnerId: string | null;
  players: Player[]; food: FoodObject[]; powerups: PowerObject[]; events: GameEvent[];
  encounter?: Encounter;
  settings?: MatchSettings; phase?: 'normal' | 'transition' | 'hell'; hell?: HellState; result?: 'winner' | 'tie' | 'loss'; tiedIds?: string[];
  nextRare?: Partial<Record<'multiplier' | 'divider' | 'jump' | 'strike', number>>; timeline?: GameEvent[]; nextPluto?: number; spawnLocations?: Vec[];
  nextFood: number; nextPower: number; spawnSector: number;
};
export type Obstacle = Vec & { w: number; h: number; kind: 'stall' | 'planter' | 'fountain' | 'bench' | 'tree' | 'rock' | 'water' | 'log' | 'crate' };
export type Participant = { id: string; name: string; bot?: boolean };
export type RoomMember = { id: string; name: string; ready: boolean; lastSeen: number; departed?: boolean };
export type Room = { id: string; room_code: string; host_id: string; players: RoomMember[]; settings: { map: MapId; count: number; matchDuration?: number; plutoMultiplier?: number; plutoEnabled?: boolean; hellEnabled?: boolean; animalsEnabled?: boolean; livesEnabled?: boolean }; game_state: GameState | null; status: 'waiting' | 'playing' | 'finished'; version: number; last_tick: number };

export type NpcPhase = 'idle' | 'wandering' | 'flying' | 'running' | 'swallowing' | 'devoured' | 'emerging' | 'friendly' | 'hostile' | 'leaving' | 'gone';
export type QuestItem = Vec & { kind: 'scroll' | 'catTree'; home: Vec; ownerId: string | null; status: 'ground' | 'carried' | 'delivered' | 'removed' };
export type Encounter = {
  npc: Vec & { scale?: number; kind: 'pigeon' | 'cat'; phase: NpcPhase; since: number; until: number; facing: number; destination: Vec; targetId: string | null; nextAction: number; actionAt: number; attacks: number; feeds: number; origin: Vec };
  item: QuestItem;
  shrine: Vec | null;
  completedBy: string | null;
};

export type AnimalKind = 'pigeon' | 'cat';
export type AnimalHelper = { kind: AnimalKind; until: number; used: boolean; hell: boolean };
export type EscapeState = { kind: AnimalKind; startedAt: number; endsAt: number; origin: Vec; animalOrigin: Vec; destination: Vec; path: Vec[]; pathIndex: number; hell: boolean; gapDistance: number; gapSince?: number; landing?: boolean };
export type BotDifficulty = 'easy' | 'medium' | 'hard';
export type MatchSettings = { matchDuration: number; mode: 'solo' | 'multiplayer'; animalsEnabled: boolean; livesEnabled: boolean; botsEnabled: boolean; botDifficulty: BotDifficulty; hellEnabled: boolean; plutoEnabled: boolean; plutoMultiplier: number };
export type MatchStats = { jumpUses?: number; gapJumps?: number; strikeUses?: number; strikeDevours?: number; companionSeconds?: number; companionFeeds?: number; vehicles?: number; collected?: Record<string, number>; totalGrowth?: number; growthActivations?: number; hostileAttacks?: number; maxMass: number; normalFinalMass: number; deaths: number; respawns: number; plutos: number; plutoBonus: number; pigeonQuest: boolean; catQuest: boolean; escapes: number; hellAssists: number; hellTime: number; hellCause: string | null; fellInLava: boolean; survivedHell: boolean; buildings: number; trees: number; chokes: number; friendlyGrowth: number; hostileLoss: number };
export type LavaEruption = Vec & { id: number; warningAt: number; eruptAt: number; endsAt: number; hit: string[] };
export type BlackHole = Vec & { from: Vec; destination: Vec; warningAt?: number; warnUntil: number; sweep: number; control?: Vec; speedCategory?: 'slow' | 'normal' | 'fast' | 'extreme'; speed?: number; progress?: number; pathLength?: number; pausedUntil?: number; pauseUsed?: boolean };
export type HellState = { blackHoles?: BlackHole[]; finalists?: string[]; nextEruption?: number; eruptions?: LavaEruption[]; startedAt: number; readyAt: number; participants: string[]; cells: number[]; blackHole: Vec & { from: Vec; destination: Vec; warningAt?: number; warnUntil: number; sweep: number; control?: Vec; speedCategory?: 'slow' | 'normal' | 'fast' | 'extreme'; speed?: number; progress?: number; pathLength?: number; pausedUntil?: number; pauseUsed?: boolean } };
/** A Pluto is an ordinary physical consumable; only its reward and spawn table differ. */
export type PlutoGrowthObject = FoodObject & { kind: 'plutoTiny' | 'plutoSmall' | 'plutoMedium' | 'plutoLarge' | 'plutoGiant' };
