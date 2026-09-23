import type { Position, WorldPlace } from "./types";

export const CONTINENT_MAP = {
  image: "/MedievalKingdoms/maps/continent.png",
  mask: "/MedievalKingdoms/maps/continent-mask.png",
  width: 1920,
  height: 1080,
};

export const WORLD_PLACES: WorldPlace[] = [
  {
    id: "brickstone-fortress",
    name: "Brickstone Fortress",
    campaignId: "brickstone-fortress",
    maskColor: [255, 2, 2],
    marker: { x: 30.3, y: 14.6 },
    lore: "A fortified northern stronghold guarding the mountain road.",
  },
  {
    id: "the-guild",
    name: "The Guild",
    campaignId: "the-guild",
    maskColor: [254, 81, 1],
    marker: { x: 53.8, y: 15.0 },
    lore: "A walled mercantile city whose contracts can decide entire wars.",
  },
  {
    id: "worlds-end",
    name: "World's End",
    campaignId: "worlds-end",
    maskColor: [215, 78, 114],
    marker: { x: 89.6, y: 18.8 },
    lore: "A remote settlement beyond the last reliable road.",
  },
  {
    id: "moonville",
    name: "Moonville",
    campaignId: "moonville",
    maskColor: [255, 255, 3],
    marker: { x: 12.2, y: 34.2 },
    lore: "A moonlit western town of old shrines and narrow streets.",
  },
  {
    id: "one-eyed-oak",
    name: "One Eyed Oak",
    campaignId: "one-eyed-oak",
    maskColor: [2, 255, 2],
    marker: { x: 33.7, y: 46.5 },
    lore: "An ancient tree said to watch every traveler who crosses the central roads.",
  },
  {
    id: "pit",
    name: "Pit",
    campaignId: "pit",
    maskColor: [255, 2, 255],
    marker: { x: 51.6, y: 49.0 },
    lore: "A vast crater surrounded by dense growth and dangerous approaches.",
  },
  {
    id: "green-hell",
    name: "Green Hell",
    campaignId: "green-hell",
    maskColor: [203, 255, 8],
    marker: { x: 70.8, y: 47.2 },
    lore: "A deep forest where sight lines collapse and ambushes are common.",
  },
  {
    id: "sir-hongkong",
    name: "Sir Hongkong",
    campaignId: "sir-hongkong",
    maskColor: [7, 255, 255],
    marker: { x: 15.9, y: 75.8 },
    lore: "A strange tower-city built around a monumental vertical sanctuary.",
  },
  {
    id: "rifts-rising",
    name: "Rifts Rising",
    campaignId: "rifts-rising",
    maskColor: [5, 5, 255],
    marker: { x: 42.4, y: 77.7 },
    lore: "A fractured site where the land seems to rise around a radiant rift.",
  },
  {
    id: "meltstone",
    name: "Meltstone",
    campaignId: "meltstone",
    maskColor: [201, 74, 4],
    marker: { x: 64.6, y: 75.4 },
    lore: "A stone settlement shaped by heat, masonry and fortified workshops.",
  },
  {
    id: "first-light",
    name: "First Light",
    campaignId: "first-light",
    maskColor: [113, 74, 219],
    marker: { x: 88.9, y: 74.9 },
    lore: "A mountain sanctuary where a perpetual beacon marks the eastern frontier.",
  },
];

export type WorldPathType =
  | "path"
  | "encounter-common"
  | "encounter-1"
  | "encounter-2"
  | "encounter-3"
  | "encounter-bridge";

export type WorldPathRegion = {
  id: WorldPathType;
  maskColor: [number, number, number];
  name: string;
  lore: string;
  marker?: Position;
};

export const WORLD_PATH_STRUCTURE: WorldPathRegion[] = [
  {
    id: "path",
    maskColor: [215, 169, 77],
    name: "Kingdom Road",
    lore: "The main road linking the realms of the continent. Armies, merchants and travelers all depend on it.",
  },
  {
    id: "encounter-common",
    maskColor: [101, 115, 255],
    name: "Road Encounter",
    lore: "A common encounter zone where travelers may meet patrols, merchants, raiders or unexpected events.",
  },
  {
    id: "encounter-1",
    maskColor: [155, 80, 63],
    name: "Encounter Site I",
    lore: "A marked danger zone along the road, reserved for a special campaign encounter.",
  },
  {
    id: "encounter-2",
    maskColor: [49, 89, 1],
    name: "Encounter Site II",
    lore: "A distinct encounter region where the journey can branch into a special event.",
  },
  {
    id: "encounter-3",
    maskColor: [204, 89, 1],
    name: "Encounter Site III",
    lore: "A rare encounter area with its own event or challenge.",
  },
  {
    id: "encounter-bridge",
    maskColor: [154, 208, 150],
    name: "Bridge Encounter",
    lore: "A strategic crossing where passage can trigger a dedicated bridge encounter.",
  },
];

export function findWorldPlaceByColor(
  r: number,
  g: number,
  b: number,
): WorldPlace | null {
  return (
    WORLD_PLACES.find(
      (place) =>
        place.maskColor[0] === r &&
        place.maskColor[1] === g &&
        place.maskColor[2] === b,
    ) ?? null
  );
}

export function findWorldPathByColor(
  r: number,
  g: number,
  b: number,
): WorldPathRegion | null {
  return (
    WORLD_PATH_STRUCTURE.find(
      (region) =>
        region.maskColor[0] === r &&
        region.maskColor[1] === g &&
        region.maskColor[2] === b,
    ) ?? null
  );
}
