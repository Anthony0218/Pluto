import type { FactionId, Position, Unit } from "./types";

type UnitType =
  | "peasant"
  | "mercenary"
  | "pumaRider"
  | "wizard"
  | "archer"
  | "witch"
  | "giant"
  | "king"
  | "villager"
  | "thief"
  | "blacksmith"
  | "shadowhound"
  | "orc"
  | "miner";

type UnitTemplate = {
  name: string;

  tier: "bronze" | "silver" | "gold";

  impact: number;
  agility: number;
  toughness: number;
  damage: number;

  maxHealth: number;

  moveRange: number;
  attackRange: number;

  ringImage?: string;
  tokenSize?: number;

  attackStyle?: "standard" | "archer";
};

export const UNIT_CATALOG: Record<string, UnitTemplate> = {
  peasant: {
    name: "Peasant Conscript",
    tier: "bronze",

    impact: 2,
    agility: 3,
    toughness: 1,
    damage: 7,

    maxHealth: 10,

    moveRange: 10,
    attackRange: 10,

    ringImage: "/MedievalKingdoms/rings/peasant-bronze.png",

    tokenSize: 48,

    attackStyle: "standard",
  },

  mercenary: {
    name: "Mercenary",
    tier: "silver",

    impact: 4,
    agility: 3,
    toughness: 3,
    damage: 10,

    maxHealth: 20,

    moveRange: 10,
    attackRange: 10,

    ringImage: "/MedievalKingdoms/rings/silver.png",

    tokenSize: 50,

    attackStyle: "standard",
  },

  pumaRider: {
    name: "Puma Rider",
    tier: "gold",

    impact: 10,
    agility: 10,
    toughness: 10,
    damage: 50,

    maxHealth: 20,

    moveRange: 20,
    attackRange: 20,

    ringImage: "/MedievalKingdoms/rings/puma-rider-gold.png",

    tokenSize: 58,

    attackStyle: "standard",
  },

  wizard: {
    name: "Wizard",
    tier: "gold",

    impact: 8,
    agility: 5,
    toughness: 3,
    damage: 20,

    maxHealth: 18,

    moveRange: 10,
    attackRange: 22,

    ringImage: "/MedievalKingdoms/rings/wizard-gold.png",

    tokenSize: 54,

    attackStyle: "standard",
  },

  archer: {
    name: "Archer",
    tier: "silver",

    impact: 6,
    agility: 8,
    toughness: 3,
    damage: 15,

    maxHealth: 17,

    moveRange: 10,
    attackRange: 24,

    ringImage: "/MedievalKingdoms/rings/silver.png",

    tokenSize: 50,

    attackStyle: "archer",
  },

  witch: {
    name: "Witch",
    tier: "gold",

    impact: 7,
    agility: 7,
    toughness: 3,
    damage: 18,

    maxHealth: 17,

    moveRange: 11,
    attackRange: 20,

    ringImage: "/MedievalKingdoms/rings/gold.png",

    tokenSize: 54,

    attackStyle: "standard",
  },

  giant: {
    name: "Giant",
    tier: "gold",

    impact: 10,
    agility: 2,
    toughness: 10,
    damage: 30,

    maxHealth: 40,

    moveRange: 7,
    attackRange: 8,

    ringImage: "/MedievalKingdoms/rings/giant-gold.png",

    tokenSize: 62,

    attackStyle: "standard",
  },

  king: {
    name: "King",
    tier: "gold",

    impact: 8,
    agility: 6,
    toughness: 7,
    damage: 18,

    maxHealth: 30,

    moveRange: 9,
    attackRange: 10,

    ringImage: "/MedievalKingdoms/rings/king-gold.png",

    tokenSize: 56,

    attackStyle: "standard",
  },

  villager: {
    name: "Villager",
    tier: "silver",

    impact: 2,
    agility: 4,
    toughness: 2,
    damage: 6,

    maxHealth: 12,

    moveRange: 10,
    attackRange: 7,

    ringImage: "/MedievalKingdoms/rings/silver.png",

    tokenSize: 48,

    attackStyle: "standard",
  },

  thief: {
    name: "Thief",
    tier: "silver",

    impact: 5,
    agility: 10,
    toughness: 2,
    damage: 12,

    maxHealth: 15,

    moveRange: 15,
    attackRange: 7,

    ringImage: "/MedievalKingdoms/rings/assassin-silver.png",

    tokenSize: 48,

    attackStyle: "standard",
  },

  blacksmith: {
    name: "Blacksmith",
    tier: "silver",

    impact: 6,
    agility: 3,
    toughness: 8,
    damage: 15,

    maxHealth: 26,

    moveRange: 8,
    attackRange: 7,

    ringImage: "/MedievalKingdoms/rings/blacksmith-silver.png",

    tokenSize: 52,

    attackStyle: "standard",
  },

  shadowhound: {
    name: "Shadowhound",
    tier: "silver",

    impact: 6,
    agility: 10,
    toughness: 5,
    damage: 14,

    maxHealth: 18,

    moveRange: 17,
    attackRange: 6,

    ringImage: "/MedievalKingdoms/rings/silver.png",

    tokenSize: 50,

    attackStyle: "standard",
  },

  orc: {
    name: "Orc",
    tier: "silver",

    impact: 8,
    agility: 4,
    toughness: 7,
    damage: 18,

    maxHealth: 28,

    moveRange: 9,
    attackRange: 7,

    ringImage: "/MedievalKingdoms/rings/orc-silver.png",

    tokenSize: 52,

    attackStyle: "standard",
  },

  miner: {
    name: "Miner",
    tier: "bronze",

    impact: 4,
    agility: 3,
    toughness: 5,
    damage: 10,

    maxHealth: 18,

    moveRange: 8,
    attackRange: 6,

    ringImage: "/MedievalKingdoms/rings/bronze.png",

    tokenSize: 48,

    attackStyle: "standard",
  },
};
export function createUnit(
  unitType: UnitType,
  id: string,
  faction: FactionId,
  position: Position,
): Unit {
  const template = UNIT_CATALOG[unitType];

  return {
    id,

    unitType,

    name: template.name,

    faction,

    tier: template.tier,

    position: {
      ...position,
    },

    impact: template.impact,

    agility: template.agility,

    toughness: template.toughness,

    damage: template.damage,

    health: template.maxHealth,

    maxHealth: template.maxHealth,

    moveRange: template.moveRange,

    attackRange: template.attackRange,

    hasMoved: false,

    hasActed: false,

    ringImage: template.ringImage,

    tokenSize: template.tokenSize,

    attackStyle: template.attackStyle ?? "standard",

    facingAngle: 0,

    defenseMode: null,

    guardTargetId: null,

    damageBoostTurns: 0,

    burnTurns: 0,

    burnDamage: 0,
  };
}
export function createFalconBridgeUnits(): Unit[] {
  return [
    createUnit("king", "falcon-king-1", "falconstone", {
      x: 60,
      y: 45,
    }),

    createUnit("wizard", "falcon-wizard-1", "falconstone", {
      x: 55,
      y: 30,
    }),

    createUnit("archer", "falcon-archer-1", "falconstone", {
      x: 45,
      y: 70,
    }),

    createUnit("orc", "falcon-orc-1", "falconstone", {
      x: 40,
      y: 40,
    }),
    createUnit("pumaRider", "blackthorn-puma-1", "blackthorn", {
      x: 25,
      y: 50,
    }),

    createUnit("wizard", "blackthorn-wizard-1", "blackthorn", {
      x: 20,
      y: 58,
    }),

    createUnit("archer", "blackthorn-archer-1", "blackthorn", {
      x: 25,
      y: 30,
    }),

    createUnit("orc", "emberclaw-orc-1", "emberclaw", {
      x: 10,
      y: 10,
    }),
    createUnit("miner", "emberclaw-miner-1", "emberclaw", {
      x: 18,
      y: 16,
    }),
    createUnit("blacksmith", "emberclaw-blacksmith-1", "emberclaw", {
      x: 14,
      y: 20,
    }),
    createUnit("peasant", "green-preasant-1", "mistveil", {
      x: 82,
      y: 14,
    }),
    createUnit("shadowhound", "green-hound-1", "mistveil", {
      x: 75,
      y: 12,
    }),
  ];
}

export function createGreenHellUnits(): Unit[] {
  return [
    createUnit("king", "emberclaw-king-1", "emberclaw", {
      x: 70,
      y: 35,
    }),

    createUnit("wizard", "emberclaw-wizard-1", "emberclaw", {
      x: 82,
      y: 38,
    }),

    createUnit("archer", "emberclaw-archer-1", "emberclaw", {
      x: 85,
      y: 70,
    }),

    createUnit("orc", "emberclaw-orc-1", "emberclaw", {
      x: 60,
      y: 40,
    }),
    createUnit("pumaRider", "blackthorn-puma-1", "blackthorn", {
      x: 25,
      y: 50,
    }),

    createUnit("wizard", "blackthorn-wizard-1", "blackthorn", {
      x: 20,
      y: 58,
    }),

    createUnit("archer", "blackthorn-archer-1", "blackthorn", {
      x: 25,
      y: 30,
    }),

    createUnit("orc", "emberclaw-orc-1", "falconstone", {
      x: 10,
      y: 10,
    }),
    createUnit("miner", "emberclaw-miner-1", "falconstone", {
      x: 18,
      y: 16,
    }),
    createUnit("blacksmith", "emberclaw-blacksmith-1", "falconstone", {
      x: 14,
      y: 20,
    }),
    createUnit("peasant", "green-preasant-1", "mistveil", {
      x: 82,
      y: 14,
    }),
    createUnit("shadowhound", "green-hound-1", "mistveil", {
      x: 75,
      y: 12,
    }),
  ];
}

export function createPitUnits() {
  return [
    createUnit("king", "blackthorn-king-1", "blackthorn", {
      x: 60,
      y: 42,
    }),

    createUnit("wizard", "blackthorn-wizard-1", "blackthorn", {
      x: 55,
      y: 30,
    }),

    createUnit("archer", "blackthorn-archer-1", "blackthorn", {
      x: 40,
      y: 80,
    }),

    createUnit("orc", "blackthorn-orc-1", "blackthorn", {
      x: 48,
      y: 44,
    }),
    createUnit("pumaRider", "falcon-puma-1", "falconstone", {
      x: 25,
      y: 50,
    }),

    createUnit("wizard", "falcon-wizard-1", "falconstone", {
      x: 30,
      y: 62,
    }),

    createUnit("archer", "falcon-archer-1", "falconstone", {
      x: 25,
      y: 30,
    }),

    createUnit("orc", "emberclaw-orc-1", "emberclaw", {
      x: 28,
      y: 10,
    }),
    createUnit("miner", "emberclaw-miner-1", "emberclaw", {
      x: 18,
      y: 16,
    }),
    createUnit("blacksmith", "emberclaw-blacksmith-1", "emberclaw", {
      x: 14,
      y: 20,
    }),
    createUnit("peasant", "green-preasant-1", "mistveil", {
      x: 82,
      y: 14,
    }),
    createUnit("shadowhound", "green-hound-1", "mistveil", {
      x: 75,
      y: 12,
    }),
  ];
}
