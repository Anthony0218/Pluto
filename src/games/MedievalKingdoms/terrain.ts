import type { TerrainInfo, TerrainType } from "./types";

export const TERRAIN: Record<TerrainType, TerrainInfo> = {
  normal: {
    type: "normal",
    walkable: true,
    lethal: false,
    movementMultiplier: 1,
    defenseBonus: 0,
  },

  blocked: {
    type: "blocked",
    walkable: false,
    lethal: false,
    movementMultiplier: 0,
    defenseBonus: 0,
  },

  river: {
    type: "river",
    walkable: true,
    lethal: true,
    movementMultiplier: 1,
    defenseBonus: 0,
  },

  forest: {
    type: "forest",
    walkable: true,
    lethal: false,
    movementMultiplier: 1.5,
    defenseBonus: 2,
  },

  highGround: {
    type: "highGround",
    walkable: true,
    lethal: false,
    movementMultiplier: 1.15,
    defenseBonus: 1,
  },

  special: {
    type: "special",
    walkable: true,
    lethal: false,
    movementMultiplier: 1,
    defenseBonus: 0,
  },
};

export function terrainLabel(type: TerrainType): string {
  switch (type) {
    case "forest":
      return "Forest cover";

    case "highGround":
      return "High ground";

    case "river":
      return "Lethal gorge";

    case "blocked":
      return "Impassable";

    case "special":
      return "Special field";

    default:
      return "Open ground";
  }
}
