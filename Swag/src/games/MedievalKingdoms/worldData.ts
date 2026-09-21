import type { WorldPlace } from "./types";

export const CONTINENT_MAP = {
  image: "/MedievalKingdoms/maps/continent.png",

  mask: "/MedievalKingdoms/maps/continent-mask.png",

  width: 1920,
  height: 1080,
};

export const WORLD_PLACES: WorldPlace[] = [
  {
    id: "arkstone-fortress",
    available: false,
    name: "Arkstone Fortress",
    route: "/games/medieval-kingdoms/battle/falcon-bridge",
    maskColor: [255, 40, 40],
    marker: { x: 30.3, y: 14.6 },
    lore: "A fortified northern stronghold guarding the mountain road.",
  },

  {
    id: "the-guild",
    available: false,
    name: "The Guild",
    route: "/games/medieval-kingdoms/battle/falcon-bridge",
    maskColor: [40, 220, 80],
    marker: { x: 53.8, y: 15.0 },
    lore: "A walled mercantile city whose contracts can decide entire wars.",
  },

  {
    id: "worlds-end",
    available: false,
    name: "World's End",
    route: "/games/medieval-kingdoms/battle/falcon-bridge",
    maskColor: [45, 120, 255],
    marker: { x: 89.6, y: 18.8 },
    lore: "A remote settlement beyond the last reliable road.",
  },

  {
    id: "moonville",
    available: false,
    name: "Moonville",
    route: "/games/medieval-kingdoms/battle/falcon-bridge",
    maskColor: [255, 80, 220],
    marker: { x: 12.2, y: 34.2 },
    lore: "A moonlit western town of old shrines and narrow streets.",
  },

  {
    id: "one-eyed-oak",
    available: true,
    name: "One Eyed Oak",
    route: "/games/medieval-kingdoms/battle/falcon-bridge",
    maskColor: [255, 155, 30],
    marker: { x: 33.7, y: 46.5 },
    lore: "An ancient tree said to watch every traveler who crosses the central roads.",
  },

  {
    id: "pit-2",
    available: true,
    name: "Pit 2",
    route: "/games/medieval-kingdoms/battle/blackthorn-bridge",
    maskColor: [155, 75, 255],
    marker: { x: 51.6, y: 49.0 },
    lore: "A vast crater surrounded by dense growth and dangerous approaches.",
  },

  {
    id: "green-hell",
    available: true,
    name: "Green Hell",
    route: "/games/medieval-kingdoms/battle/emberclaw-bridge",
    maskColor: [20, 190, 175],
    marker: { x: 70.8, y: 47.2 },
    lore: "A deep forest where sight lines collapse and ambushes are common.",
  },

  {
    id: "sir-hongkong",
    available: false,
    name: "Sir Hongkong",
    route: "/games/medieval-kingdoms/battle/falcon-bridge",
    maskColor: [255, 220, 35],
    marker: { x: 15.9, y: 75.8 },
    lore: "A strange tower-city built around a monumental vertical sanctuary.",
  },

  {
    id: "rifts-rising",
    available: false,
    name: "Rifts Rising",
    route: "/games/medieval-kingdoms/battle/falcon-bridge",
    maskColor: [110, 210, 255],
    marker: { x: 42.4, y: 77.7 },
    lore: "A fractured site where the land seems to rise around a radiant rift.",
  },

  {
    id: "meltstone",
    available: false,
    name: "Meltstone",
    route: "/games/medieval-kingdoms/battle/falcon-bridge",
    maskColor: [180, 115, 55],
    marker: { x: 64.6, y: 75.4 },
    lore: "A stone settlement shaped by heat, masonry and fortified workshops.",
  },

  {
    id: "first-light",
    available: false,
    name: "First Light",
    route: "/games/medieval-kingdoms/battle/falcon-bridge",
    maskColor: [255, 105, 105],
    marker: { x: 88.9, y: 74.9 },
    lore: "A mountain sanctuary where a perpetual beacon marks the eastern frontier.",
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
