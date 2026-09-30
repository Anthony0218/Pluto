import {
  createFalconBridgeUnits,
  createGreenHellUnits,
  createPitUnits,
} from "./unitCatalog";

import {
  BLACKTHORN_BRIDGE_OBJECTS,
  EMBERCLAW_BRIDGE_OBJECTS,
  FALCON_BRIDGE_OBJECTS,
  ONE_EYED_OAK_OBJECTS,
} from "./battlefieldObjects";
import type { BattleDefinition, BattleState } from "./types";

export const BATTLES: Record<string, BattleDefinition> = {
  "falcon-bridge": {
    id: "falcon-bridge",
    regionId: "moonville",
    name: "Moonville Lunar (ONLY PLACEHOLDER, GAME DOES NOT WORK YET)",
    subtitle: "Battle for the crossing",
    lore: "The ancient bridge controls the western approaches to Falconstone.",

    mapImage: "/MedievalKingdoms/maps/falcon-bridge.png",

    terrainMask: "/MedievalKingdoms/maps/falcon-bridge-mask.png",

    mapAspectRatio: 1080 / 1920,

    startingFaction: "falconstone",

    maxRounds: 20,

    objective: {
      id: "falcon-bridge-objective",

      name: "Central Bridge",

      position: {
        x: 50,
        y: 50,
      },

      radius: 6,

      controlledBy: null,
    },

    objects: FALCON_BRIDGE_OBJECTS,

    units: createFalconBridgeUnits(),
  },

  "blackthorn-bridge": {
    id: "blackthorn-bridge",

    regionId: "moonville",

    name: "Blackthorn Bridge",

    subtitle: "War beneath the canopy",

    lore: "Dense woodland conceals ancient ruins, hidden paths and ambushes.",

    mapImage: "/MedievalKingdoms/maps/blackthorn.png",

    terrainMask: "/MedievalKingdoms/maps/blackthorn-mask.png",

    mapAspectRatio: 1080 / 1920,

    startingFaction: "blackthorn",

    maxRounds: 20,

    objective: {
      id: "green-hell-objective",

      name: "Ancient Grove",

      position: {
        x: 53,
        y: 48,
      },

      radius: 7,

      controlledBy: null,
    },

    objects: BLACKTHORN_BRIDGE_OBJECTS,

    units: createGreenHellUnits(),
  },

  "emberclaw-bridge": {
    id: "emberclaw-bridge",

    regionId: "brickstone-fortress",

    name: "Brickstone Fortress",

    subtitle: "Battle at the crater",

    lore: "A deep crater divides the battlefield and forces armies onto narrow approaches.",

    mapImage: "/MedievalKingdoms/maps/emberclaw.png",

    terrainMask: "/MedievalKingdoms/maps/emberclaw-mask.png",

    mapAspectRatio: 1080 / 1920,

    startingFaction: "emberclaw",

    maxRounds: 20,

    objective: {
      id: "pit-2-objective",

      name: "Crater Rim",

      position: {
        x: 50,
        y: 47,
      },

      radius: 6,

      controlledBy: null,
    },

    objects: EMBERCLAW_BRIDGE_OBJECTS,

    units: createPitUnits(),
  },

  "one-eyed-oak": {
    id: "one-eyed-oak",

    regionId: "one-eyed-oak",

    name: "One Eyed Oak",

    subtitle: "Battle beneath the ancient tree",

    lore: "The old oak dominates the crossroads and has witnessed generations of war.",

    mapImage: "/MedievalKingdoms/maps/one-eyed-oak.png",

    terrainMask: "/MedievalKingdoms/maps/one-eyed-oak-mask.png",

    mapAspectRatio: 1080 / 1920,

    startingFaction: "falconstone",

    maxRounds: 20,

    objective: {
      id: "oak-objective",

      name: "One Eyed Oak",

      position: {
        x: 50,
        y: 50,
      },

      radius: 7,

      controlledBy: null,
    },

    objects: ONE_EYED_OAK_OBJECTS,

    units: createFalconBridgeUnits(),
  },
};

export function createInitialBattleState(battleId: string): BattleState {
  const battle = BATTLES[battleId] ?? BATTLES["falcon-bridge"];

  return {
    round: 1,

    activeFaction: battle.startingFaction,

    units: structuredClone(battle.units),

    traps: [],

    objects: structuredClone(battle.objects),

    objective: structuredClone(battle.objective),

    winner: null,

    maxRounds: battle.maxRounds,

    modeState: {
      scores: {},
    },
  };
}
