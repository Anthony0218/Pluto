import type {
  CampaignBattleNode,
  CampaignDefinition,
  GameMode,
  GameModeConfig,
  Position,
} from "./types";

export const CAMPAIGN_ORDER = [
  "moonville",
  "brickstone-fortress",
  "the-guild",
  "worlds-end",
  "one-eyed-oak",
  "pit-2",
  "green-hell",
  "sir-hongkong",
  "rifts-rising",
  "meltstone",
  "first-light",
] as const;

export type CampaignId = (typeof CAMPAIGN_ORDER)[number];

function battle(
  id: string,
  name: string,
  description: string,
  position: Position,
  battleId: string,
  gameMode: GameMode,
  order: number,
  maskColor: [number, number, number],
  gameModeConfig?: GameModeConfig,
  optional = false,
): CampaignBattleNode {
  return {
    id,
    name,
    description,
    position,
    battleId,
    gameMode,
    order,
    maskColor,
    gameModeConfig,
    optional,
  };
}

/**
 * IMPORTANT:
 * The three current battlefield IDs are reused as placeholders:
 *
 *   falcon-bridge
 *   blackthorn-bridge
 *   emberclaw-bridge
 *
 * As you create more battlefield maps, change only `battleId` here and add the
 * corresponding battle definition to battleData.ts.
 */
export const CAMPAIGNS: Record<CampaignId, CampaignDefinition> = {
  moonville: {
    id: "moonville",

    name: "Moon Ville",
    subtitle: "The War Begins",

    description: "The campaign begins beneath Moon Ville's pale western sky.",

    regionMap: "/MedievalKingdoms/maps/regions/moonville.png",

    regionMask: "/MedievalKingdoms/maps/regions/moonville-mask.png",

    battles: [
      battle(
        "lunar-sanctum",
        "Lunar Sanctum (PLACEHOLDER)",
        "Break the first enemy patrol before it reaches the town.",
        { x: 32, y: 72 },
        "falcon-bridge",
        "elimination",
        1,

        [241, 255, 3],
      ),

      battle(
        "moon-crossing",
        "Moon Crossing",
        "Seize the crossing and secure a route into Moon Ville.",
        { x: 49, y: 49 },
        "blackthorn-bridge",
        "capture",
        2,

        [255, 186, 3],
      ),

      battle(
        "moon-outskirts",
        "Moon Ville Outskirts",
        "Survive the final assault and claim Moon Ville.",
        { x: 76, y: 25 },
        "emberclaw-bridge",
        "survival",
        3,

        [3, 255, 60],

        { targetRound: 8 },
      ),
    ],
  },
  "brickstone-fortress": {
    id: "brickstone-fortress",
    name: "Arkstone Fortress",
    subtitle: "The Northern Gate",
    description:
      "Fight through mountain approaches and open the road to Arkstone.",
    regionMap: "/MedievalKingdoms/regions/arkstone-fortress.png",
    regionMask: "/MedievalKingdoms/maps/regions/arkstone-fortress-mask.png",
    battles: [
      battle(
        "arkstone-pass",
        "Arkstone Pass",
        "Clear the narrow approach to the fortress.",
        { x: 20, y: 68 },
        "blackthorn-bridge",
        "elimination",
        1,
        [0, 255, 0],
      ),
      battle(
        "arkstone-gate",
        "Fortress Gate",
        "Take the fortified gate before enemy reinforcements arrive.",
        { x: 50, y: 45 },
        "falcon-bridge",
        "capture",
        2,
        [0, 255, 0],
      ),
      battle(
        "arkstone-citadel",
        "Citadel Court",
        "Hold the courtyard until the fortress breaks.",
        { x: 78, y: 24 },
        "emberclaw-bridge",
        "defense",
        3,
        [0, 255, 0],
        { targetRound: 9 },
      ),
    ],
  },

  "the-guild": {
    id: "the-guild",
    name: "The Guild",
    subtitle: "Contracts and Steel",
    description:
      "The mercantile city is divided between rival houses and hired armies.",
    regionMap: "/MedievalKingdoms/regions/the-guild.png",
    regionMask: "/MedievalKingdoms/maps/regions/the-guild-mask.png",
    battles: [
      battle(
        "guild-road",
        "Caravan Road",
        "Defeat the forces blocking the trade road.",
        { x: 19, y: 70 },
        "falcon-bridge",
        "elimination",
        1,
        [0, 255, 0],
      ),
      battle(
        "guild-market",
        "Grand Market",
        "Control the market square long enough to break the mercenary lines.",
        { x: 52, y: 49 },
        "blackthorn-bridge",
        "kingOfTheHill",
        2,
        [0, 255, 0],
        { scoreToWin: 3 },
      ),
      battle(
        "guild-hall",
        "Guild Hall",
        "Capture the seat of the city's ruling council.",
        { x: 78, y: 27 },
        "emberclaw-bridge",
        "capture",
        3,
        [0, 255, 0],
      ),
    ],
  },

  "worlds-end": {
    id: "worlds-end",
    name: "World's End",
    subtitle: "Beyond the Last Road",
    description:
      "A distant frontier where armies disappear into stone and mist.",
    regionMap: "/MedievalKingdoms/regions/worlds-end.png",
    regionMask: "/MedievalKingdoms/maps/regions/worlds-end-mask.png",
    battles: [
      battle(
        "end-road",
        "The Last Road",
        "Push through the frontier guard.",
        { x: 21, y: 70 },
        "emberclaw-bridge",
        "breakthrough",
        1,
        [0, 255, 0],
      ),
      battle(
        "end-watch",
        "End Watch",
        "Hold the frontier watch against repeated attacks.",
        { x: 50, y: 46 },
        "blackthorn-bridge",
        "survival",
        2,
        [0, 255, 0],
        { targetRound: 8 },
      ),
      battle(
        "end-crown",
        "Crown of the Edge",
        "Defeat the commander guarding the end of the known road.",
        { x: 76, y: 25 },
        "falcon-bridge",
        "boss",
        3,
        [0, 255, 0],
      ),
    ],
  },

  "one-eyed-oak": {
    id: "one-eyed-oak",
    name: "One Eyed Oak",
    subtitle: "The Watching Tree",
    description:
      "Ancient roads converge around a tree older than the kingdoms.",
    regionMap: "/MedievalKingdoms/regions/one-eyed-oak.png",
    regionMask: "/MedievalKingdoms/maps/regions/one-eyed-oak-mask.png",
    battles: [
      battle(
        "oak-road",
        "Oak Road",
        "Drive enemy scouts from the old road.",
        { x: 22, y: 72 },
        "falcon-bridge",
        "elimination",
        1,
        [0, 255, 0],
      ),
      battle(
        "oak-clearing",
        "The Clearing",
        "Control the ground beneath the old branches.",
        { x: 49, y: 48 },
        "blackthorn-bridge",
        "kingOfTheHill",
        2,
        [0, 255, 0],
        { scoreToWin: 4 },
      ),
      battle(
        "oak-heart",
        "Heart of the Oak",
        "Secure the campaign's final objective.",
        { x: 75, y: 25 },
        "emberclaw-bridge",
        "capture",
        3,
        [0, 255, 0],
      ),
    ],
  },

  "pit-2": {
    id: "pit-2",
    name: "Pit 2",
    subtitle: "The Crater War",
    description: "Broken roads and steep crater walls split the battlefield.",
    regionMap: "/MedievalKingdoms/regions/pit-2.png",
    regionMask: "/MedievalKingdoms/maps/regions/pit-2-mask.png",
    battles: [
      battle(
        "pit-rim",
        "Crater Rim",
        "Destroy the enemy force holding the rim.",
        { x: 20, y: 69 },
        "emberclaw-bridge",
        "elimination",
        1,
        [0, 255, 0],
      ),
      battle(
        "pit-descent",
        "The Descent",
        "Break through the crater approaches.",
        { x: 49, y: 47 },
        "blackthorn-bridge",
        "breakthrough",
        2,
        [0, 255, 0],
      ),
      battle(
        "pit-core",
        "Pit Core",
        "Survive long enough to secure the crater.",
        { x: 77, y: 27 },
        "falcon-bridge",
        "survival",
        3,
        [0, 255, 0],
        { targetRound: 9 },
      ),
    ],
  },

  "green-hell": {
    id: "green-hell",
    name: "Green Hell",
    subtitle: "War Beneath the Canopy",
    description: "Dense forest turns every trail into an ambush.",
    regionMap: "/MedievalKingdoms/regions/green-hell.png",
    regionMask: "/MedievalKingdoms/maps/regions/green-hell-mask.png",
    battles: [
      battle(
        "green-edge",
        "Forest Edge",
        "Eliminate the defenders at the jungle threshold.",
        { x: 21, y: 70 },
        "blackthorn-bridge",
        "elimination",
        1,
        [0, 255, 0],
      ),
      battle(
        "green-shrine",
        "Overgrown Shrine",
        "Hold the shrine against rival clans.",
        { x: 51, y: 48 },
        "emberclaw-bridge",
        "kingOfTheHill",
        2,
        [0, 255, 0],
        { scoreToWin: 4 },
      ),
      battle(
        "green-heart",
        "Heart of Green Hell",
        "Defeat the final guardian of the forest.",
        { x: 78, y: 25 },
        "falcon-bridge",
        "boss",
        3,
        [0, 255, 0],
      ),
    ],
  },

  "sir-hongkong": {
    id: "sir-hongkong",
    name: "Sir Hongkong",
    subtitle: "The Vertical City",
    description: "A strange tower-city rises above roads cut into sheer stone.",
    regionMap: "/MedievalKingdoms/regions/sir-hongkong.png",
    regionMask: "/MedievalKingdoms/maps/regions/sir-hongkong-mask.png",
    battles: [
      battle(
        "hongkong-lower",
        "Lower Approach",
        "Secure the roads beneath the tower.",
        { x: 20, y: 71 },
        "falcon-bridge",
        "capture",
        1,
        [0, 255, 0],
      ),
      battle(
        "hongkong-stairs",
        "The Great Stairs",
        "Break through the defenders and reach the upper district.",
        { x: 49, y: 48 },
        "emberclaw-bridge",
        "breakthrough",
        2,
        [0, 255, 0],
      ),
      battle(
        "hongkong-tower",
        "Tower Sanctuary",
        "Hold the sanctuary until the city surrenders.",
        { x: 77, y: 24 },
        "blackthorn-bridge",
        "defense",
        3,
        [0, 255, 0],
        { targetRound: 9 },
      ),
    ],
  },

  "rifts-rising": {
    id: "rifts-rising",
    name: "Rifts Rising",
    subtitle: "The Fractured Land",
    description:
      "The earth has split around a radiant rift and unstable crossings.",
    regionMap: "/MedievalKingdoms/regions/rifts-rising.png",
    regionMask: "/MedievalKingdoms/maps/regions/rifts-rising-mask.png",
    battles: [
      battle(
        "rift-edge",
        "Rift Edge",
        "Clear the outer fracture.",
        { x: 22, y: 71 },
        "blackthorn-bridge",
        "elimination",
        1,
        [0, 255, 0],
      ),
      battle(
        "rift-crossing",
        "Broken Crossing",
        "Capture the only stable route over the fracture.",
        { x: 50, y: 47 },
        "falcon-bridge",
        "capture",
        2,
        [0, 255, 0],
      ),
      battle(
        "rift-core",
        "Rift Core",
        "Survive the forces gathering around the radiant core.",
        { x: 77, y: 25 },
        "emberclaw-bridge",
        "survival",
        3,
        [0, 255, 0],
        { targetRound: 10 },
      ),
    ],
  },

  meltstone: {
    id: "meltstone",
    name: "Meltstone",
    subtitle: "Forges of War",
    description:
      "Fortified workshops and furnace roads form a brutal industrial front.",
    regionMap: "/MedievalKingdoms/regions/meltstone.png",
    regionMask: "/MedievalKingdoms/maps/regions/meltstone-mask.png",
    battles: [
      battle(
        "melt-road",
        "Forge Road",
        "Eliminate the defenders around the outer workshops.",
        { x: 20, y: 70 },
        "emberclaw-bridge",
        "elimination",
        1,
        [0, 255, 0],
      ),
      battle(
        "melt-forge",
        "Great Forge",
        "Control the forge complex.",
        { x: 50, y: 47 },
        "blackthorn-bridge",
        "kingOfTheHill",
        2,
        [0, 255, 0],
        { scoreToWin: 4 },
      ),
      battle(
        "melt-citadel",
        "Meltstone Citadel",
        "Capture the final fortified workshop.",
        { x: 78, y: 25 },
        "falcon-bridge",
        "capture",
        3,
        [0, 255, 0],
      ),
    ],
  },

  "first-light": {
    id: "first-light",
    name: "First Light",
    subtitle: "The Final Campaign",
    description:
      "The last campaign climbs toward the beacon at the eastern frontier.",
    regionMap: "/MedievalKingdoms/regions/first-light.png",
    regionMask: "/MedievalKingdoms/maps/regions/first-light-mask.png",
    battles: [
      battle(
        "light-approach",
        "Approach to First Light",
        "Break the last defensive line.",
        { x: 20, y: 71 },
        "falcon-bridge",
        "breakthrough",
        1,
        [0, 255, 0],
      ),
      battle(
        "light-beacon",
        "The Beacon",
        "Hold the beacon while the final armies converge.",
        { x: 50, y: 47 },
        "blackthorn-bridge",
        "defense",
        2,
        [0, 255, 0],
        { targetRound: 10 },
      ),
      battle(
        "final-battle",
        "First Light",
        "Defeat the final enemy force and complete the campaign.",
        { x: 78, y: 24 },
        "emberclaw-bridge",
        "boss",
        3,
        [0, 255, 0],
      ),
    ],
  },
};

export function getCampaign(
  campaignId: string | undefined,
): CampaignDefinition | null {
  if (!campaignId) return null;

  return CAMPAIGNS[campaignId as CampaignId] ?? null;
}

export function getCampaignBattle(
  campaignId: string | undefined,
  battleNodeId: string | undefined,
): CampaignBattleNode | null {
  const campaign = getCampaign(campaignId);

  if (!campaign || !battleNodeId) {
    return null;
  }

  return campaign.battles.find((node) => node.id === battleNodeId) ?? null;
}
