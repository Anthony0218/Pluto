export type FactionId = "falconstone" | "blackthorn" | "emberclaw" | "mistveil";

export type ClanId = FactionId;
export type UnitTier = "bronze" | "silver" | "gold";

export type AttackActionId =
  | "quick"
  | "melee"
  | "power"
  | "sweep"
  | "charge"
  | "area"
  | "knockback"
  | "archer";

export type DefenseActionId =
  | "brace"
  | "dodge"
  | "counter"
  | "guard"
  | "shield"
  | "cover"
  | "fortify"
  | "evade";

export type SkillActionId =
  | "heal"
  | "damageBoost"
  | "trap"
  | "teleport"
  | "burn";

export type AimStage =
  | "direction"
  | "power"
  | "distance"
  | "elevation"
  | "meleeTarget"
  | "meleeTiming"
  | null;

export type PreviewAction =
  | { kind: "attack"; id: AttackActionId }
  | { kind: "defense"; id: DefenseActionId }
  | { kind: "skill"; id: SkillActionId }
  | null;

export type Position = { x: number; y: number };

export type GameMode =
  | "elimination"
  | "capture"
  | "kingOfTheHill"
  | "defense"
  | "survival"
  | "boss"
  | "escort"
  | "breakthrough"
  | "artifact";

export type GameModeConfig = {
  targetRound?: number;
  scoreToWin?: number;
  bossUnitId?: string;
  escortUnitId?: string;
  playerFaction?: FactionId;
};

export type CampaignBattleNode = {
  id: string;
  name: string;
  description: string;

  position: Position;

  battleId: string;
  gameMode: GameMode;
  order: number;

  maskColor: [number, number, number];

  gameModeConfig?: GameModeConfig;
  optional?: boolean;
};

export type CampaignDefinition = {
  id: string;
  name: string;
  subtitle: string;
  description: string;

  regionMap: string;
  regionMask: string;

  battles: CampaignBattleNode[];
};

export type CampaignProgress = {
  completedCampaigns: string[];
  completedBattles: string[];
  currentCampaignId: string;
};

export type BattleModeState = {
  scores: Partial<Record<FactionId, number>>;
};
export type RegionId = "moonville" | "brickstone-fortress" | "one-eyed-oak";

export type TerrainType =
  | "normal"
  | "blocked"
  | "river"
  | "forest"
  | "highGround"
  | "special";

export type TerrainInfo = {
  type: TerrainType;
  walkable: boolean;
  lethal: boolean;
  movementMultiplier: number;
  defenseBonus: number;
};

export type BattlefieldObjectType =
  | "market"
  | "highGroundPlatform"
  | "healingShrine"
  | "ballista"
  | "capturePoint"
  | "watchtower"
  | "blacksmith"
  | "cliffEdge"
  | "supplyCrate"
  | "manaShrine"
  | "bridgeControl"
  | "barricade"
  | "forest"
  | "bossAltar"
  | "trapTile"
  | "teleportRune"
  | "jumpPad"
  | "mud"
  | "ice"
  | "sacredCircle"
  | "cursedCircle"
  | "riverCurrent"
  | "fogArea";

export type BattlefieldObject = {
  id: string;
  type: BattlefieldObjectType;
  name: string;
  description: string;

  // All placement / visual sizing lives in battlefieldObjects.ts.
  // x/y are percentages of the battlefield image.
  position: Position;

  // Gameplay radius, in the same map-distance system used by units.
  radius: number;

  // Responsive visual diameter as a percentage of battlefield width.
  // Change this to make the rendered circle/object larger or smaller.
  visualSize: number;

  // Optional width/height ratio for wide zones such as rivers/fog.
  visualAspectRatio?: number;

  // Optional rotation for elongated zones.
  rotation?: number;

  // How close a unit must be to use an interactive object.
  interactRange: number;

  // Passive zones/hazards are still clickable for information, but do not
  // show the Interact button.
  interactive: boolean;

  // Optional state/config used by special map objects.
  active?: boolean;
  usesRemaining?: number;
  linkedObjectId?: string;
  targetPosition?: Position;
};

export type Trap = {
  id: string;
  ownerFaction: FactionId;
  ownerUnitId: string;
  position: Position;
  radius: number;
  damage: number;
};

export type Unit = {
  id: string;
  unitType: string;
  name: string;
  faction: FactionId;
  tier: UnitTier;
  position: Position;

  impact: number;
  agility: number;
  toughness: number;
  damage: number;

  health: number;
  maxHealth: number;

  moveRange: number;
  attackRange: number;

  hasMoved: boolean;
  hasActed: boolean;

  ringImage?: string;
  tokenSize?: number;
  attackStyle?: "standard" | "archer";

  facingAngle: number;
  defenseMode: DefenseActionId | null;
  guardTargetId: string | null;

  damageBoostTurns: number;
  burnTurns: number;
  burnDamage: number;
};

export type BattleObjective = {
  id: string;
  name: string;
  position: Position;
  radius: number;
  controlledBy: FactionId | null;
};

export type BattleState = {
  round: number;
  activeFaction: FactionId;
  units: Unit[];
  traps: Trap[];
  objective: BattleObjective;
  winner: FactionId | null;
  maxRounds: number;
  objects: BattlefieldObject[];
  modeState: BattleModeState;
};

export type BattleDefinition = {
  id: string;
  regionId: string;

  name: string;
  subtitle: string;
  lore: string;

  mapImage: string;
  terrainMask: string;
  mapAspectRatio: number;

  startingFaction: FactionId;

  maxRounds: number;

  objective: BattleObjective;

  objects: BattlefieldObject[];
  units: Unit[];
};

export type AttackResult = {
  state: BattleState;
  hit: boolean;
  damage: number;
  hitChance: number;
  targetId?: string | null;
};

export type HitEffect = {
  targetId: string;
  damage: number;
  hit: boolean;
  position: Position;
  label?: string;
};

export type MultiAttackResult = {
  state: BattleState;
  hits: HitEffect[];
};

export type DamageRange = {
  min: number;
  max: number;
};

export type MovementResult = {
  state: BattleState;
  moved: boolean;
  died: boolean;
  message: string;
  trapTriggered?: boolean;
  trapDamage?: number;
};

export type ClanDefinition = {
  id: ClanId;
  name: string;
  motto: string;
  lore: string;
  corner: "top-left" | "top-right" | "bottom-right" | "bottom-left";
};

export type WorldPlace = {
  id: string;
  name: string;
  campaignId: string;
  maskColor: [number, number, number];
  lore: string;
  marker: Position;
};
