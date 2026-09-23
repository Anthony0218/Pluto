import type { Player } from "./naturaData";

export const FLYING_FISH_W = 960;
export const FLYING_FISH_H = 540;
export const FLYING_FISH_PHASE_SECONDS = 9;
export const FLYING_FISH_ROUND_SECONDS = 54;
export const FLYING_FISH_MAX_LIVES = 3;

export type FlyingFishPhase = "ready" | "sky" | "water" | "end";
export type FlyingFishObstacleKind = "seabird" | "tuna";
export type FlyingFishParticleKind = "bubble" | "feather" | "splash";

export type FlyingFishPlayerState = {
  x: number;
  y: number;
  vx: number;
  score: number;
  lives: number;
  invulnerable: number;
  caught: number;
  active: boolean;
};

export type FlyingFishObstacle = {
  id: number;
  kind: FlyingFishObstacleKind;
  x: number;
  y: number;
  vy: number;
  radius: number;
  wobble: number;
  passed: [boolean, boolean];
  dead?: boolean;
};

export type FlyingFishParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  kind: FlyingFishParticleKind;
};

export type FlyingFishState = {
  phase: FlyingFishPhase;
  phaseTimer: number;
  roundTimer: number;
  elapsed: number;
  spawnTimer: number;
  transition: number;
  obstacleId: number;
  players: [FlyingFishPlayerState, FlyingFishPlayerState];
  obstacles: FlyingFishObstacle[];
  particles: FlyingFishParticle[];
  winner: Player | null;
  reason: string;
};

export type FlyingFishFact = {
  animal: "FLYING FISH" | "TUNA" | "SEABIRDS";
  title: string;
  text: string;
  label: string;
  url: string;
};

export const FLYING_FISH_FACTS: FlyingFishFact[] = [
  {
    animal: "FLYING FISH",
    title: "They glide rather than flap.",
    text: "Flying fish have greatly enlarged fins used for gliding above the water after they burst through the surface.",
    label: "Australian Museum",
    url: "https://publications.australian.museum/blog/amri-news/flying-without-wings/",
  },
  {
    animal: "FLYING FISH",
    title: "Some can glide for hundreds of metres.",
    text: "Flying fish can glide for hundreds of metres in good conditions; many species also use an enlarged lower tail lobe to skim the surface and extend a glide.",
    label: "Australian Museum",
    url: "https://publications.australian.museum/blog/amri-news/flying-without-wings/",
  },
  {
    animal: "TUNA",
    title: "Tuna are real flying-fish predators.",
    text: "NOAA describes flying fish as an important prey item for tunas, which makes the underwater chase in this mode biologically plausible.",
    label: "NOAA Fisheries",
    url: "https://www.fisheries.noaa.gov/feature-story/prey-size-plastics-are-invading-larval-fish-nurseries",
  },
  {
    animal: "TUNA",
    title: "Their bodies are built for speed.",
    text: "Tunas have streamlined bodies and feed high in the food chain on fish, squid and crustaceans.",
    label: "NOAA Fisheries",
    url: "https://www.fisheries.noaa.gov/species/pacific-yellowfin-tuna",
  },
  {
    animal: "SEABIRDS",
    title: "The danger does not stop at the surface.",
    text: "Pelagic seabirds also eat flying fish. The gull-like silhouettes in the sky phase are a stylized arcade stand-in for those seabird predators.",
    label: "NOAA Fisheries",
    url: "https://www.fisheries.noaa.gov/feature-story/prey-size-plastics-are-invading-larval-fish-nurseries",
  },
  {
    animal: "FLYING FISH",
    title: "The air is an escape route.",
    text: "Their unusual gliding behaviour is widely understood as an adaptation that helps flying fish escape fast ocean predators.",
    label: "National Wildlife Federation",
    url: "https://www.nwf.org/Educational-Resources/Wildlife-Guide/Fish/Flying-Fish",
  },
];
