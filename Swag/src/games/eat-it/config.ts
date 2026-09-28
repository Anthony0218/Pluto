/** Gameplay values are shared by the browser and the authoritative Edge Function. */
export const EAT = {
  player: { startingMass: 36, minMass: 12, minRadius: 14, maxRadius: 132, radiusScale: 4,
    acceleration: 760, friction: 6, baseSpeed: 210, sizeSpeedPenalty: 0.14, minSpeedFactor: 0.58, turnSpeed: 7, bodyPush: 0.48 },
  eating: { playerEatRadiusRatio: 1.20, mouthAngle: Math.PI * 0.64, mouthRange: 18,
    foodAttractionRange: 46, foodCapacity: 0.49, attractionSpeed: 245, playerMassTransfer: 0.70,
    foodAnimation: 0.22, playerAnimation: 0.56 },
  food: { spawnCount: 170, respawnInterval: 0.32, maxObjects: 180, gravity: 310, bounce: 0.35, friction: 3.2 },
  powerups: { spawnInterval: 7, maxObjects: 7, radius: 15,
    speed: { duration: 6, strength: 1.5 }, shield: { duration: 5 },
    magnet: { duration: 7, range: 180, strength: 220 }, growth: { duration: 0, mass: 30, indicatorDuration: 2.5 } },
  match: { maxPlayers: 8, width: 2200, height: 1600, zoneStart: 90, zoneEnd: 300, zoneMassLoss: 18 },
  camera: { minZoom: 0.62, maxZoom: 1.32, zoomCurve: 0.25, followRate: 5, growthRate: 9 },
  network: { tickRate: 30, inputIntervalMs: 125, interpolationMs: 120, maxExtrapolationMs: 160,
    inputTimeoutMs: 650, disconnectMs: 20000, maxCatchupSeconds: 1, maxRetries: 6, lobbyPollMs: 1500,
    requestTimeoutMs: 5000, maxSnapshots: 32 },
  bots: { vision: 480, decisionInterval: 0.18, threatRange: 320, huntRange: 380 },
  visuals: { maxParticles: 96, hudIntervalMs: 100 },
} as const;

export const FOOD = {
  berry: { radius: 5, mass: 2, score: 10, tier: 'small' },
  mushroom: { radius: 7, mass: 3, score: 15, tier: 'small' },
  apple: { radius: 10, mass: 5, score: 25, tier: 'medium' },
  donut: { radius: 11, mass: 6, score: 30, tier: 'medium' },
  soda: { radius: 11, mass: 5, score: 25, tier: 'medium' },
  fries: { radius: 12, mass: 7, score: 35, tier: 'medium' },
  cupcake: { radius: 12, mass: 7, score: 35, tier: 'medium' },
  burger: { radius: 18, mass: 15, score: 75, tier: 'large' },
  pizza: { radius: 19, mass: 17, score: 85, tier: 'large' },
  melon: { radius: 22, mass: 22, score: 110, tier: 'large' },
} as const;
export type FoodKind = keyof typeof FOOD;
export type PowerKind = 'speed' | 'shield' | 'magnet' | 'growth';
export const POWER_KINDS: PowerKind[] = ['speed', 'shield', 'magnet', 'growth'];
export const COLORS = ['#b9ed55', '#a58aff', '#ff9475', '#62d1e8', '#ffcf60', '#f284bc', '#83d8ac', '#929ff5'];
export const BOT_NAMES = ['Mochi', 'Chomp', 'Pickles', 'Boba', 'Nibbles', 'Waffles', 'Peach', 'Sprout'];
export const massToRadius = (mass: number) => Math.min(EAT.player.maxRadius, Math.max(EAT.player.minRadius, Math.sqrt(Math.max(0, mass)) * EAT.player.radiusScale));
export const massToSpeed = (mass: number) => EAT.player.baseSpeed * Math.max(EAT.player.minSpeedFactor, (Math.max(mass, EAT.player.startingMass) / EAT.player.startingMass) ** -EAT.player.sizeSpeedPenalty);
