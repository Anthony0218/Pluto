/** Gameplay values are shared by the browser and the authoritative Edge Function. */
export const EAT = {
  /** Pluto is always on: a fixed, strong bonus-growth object (no menu setting). */
  pluto: { multiplier: 4, interval: 10, maxActive: 14, initialCount: 8 },
  lives: { count: 3, respawnDelay: 5 },
  escape: { friendshipDuration: 60, approachDuration: .65, travelDuration: 3, hellDuration: 2, pigeonHellDuration: 5 },
  hell: {
    normalDuration: 600, soloDuration: 60, transitionDuration: 2,
    cellSize: 80, columns: 44, rows: 30, left: 240, top: 320, characterScale: 2, spawnRadius: 700,
    eruptionInterval: 30, eruptionVariation: 3, eruptionWarning: 2, eruptionDuration: 1.2, eruptionRadius: 95, eruptionPush: 150,
    speedInterval: 12, warningDuration: .65, destructionDuration: .4, fallDuration: .75,
    sweepWarning: 1.1, extremeWarning: 2, baseSpeed: 230, maxSpeed: 390, radius: 90,
    slowChance: .16, fastThreshold: .76, extremeThreshold: .96, curveChance: .12,
    speedFactors: { slow: .7, normal: 1, fast: 1.55, extreme: 2.7 },
    pauseChancePerSecond: .16, pauseMin: .5, pauseMax: 1.5,
    minBlackHoles: 1, maxBlackHoles: 2,
    /** Share of sweeps whose path actually breaks the floor; the rest pass over harmlessly. */
    destructiveChance: .5,
    /** Late-game pressure: after this long in Hell the floor crumbles inward, one outer ring per interval. */
    collapseAfter: 150, collapseInterval: 5,
    /** Each fireball multiplies mass by `growth` (> 1.3225 = the 1.15x radius bite rule), so one fireball lead is enough to devour an equal rival.
     *  Past `softMass` every fireball adds a fixed `softMass * (growth - 1)` instead, so growth slows but never stops. */
    fireball: { radius: 24, growth: 1.45, softMass: 1200, initialCount: 6, interval: 2.4, maxActive: 9, holeGrowth: 7, holeMaxRadius: 150, holeEatCount: 10, holeEatAnimation: .8 },
  },
  player: { startingMass: 36, minMass: 12, minRadius: 14, radiusScale: 4,
    acceleration: 920, friction: 6, baseSpeed: 255, sizeSpeedPenalty: 0.14, minSpeedFactor: 0.58, turnSpeed: 7, bodyPush: 0.48 },
  eating: { playerEatRadiusRatio: 1.15, playerMassTransfer: 0.70, chokeDuration: 1.5,
    treeEntryDuration: .65, treeAnimation: 2.1, foodAnimation: 0.95, largeAnimation: 1.8, playerAnimation: 0.7, npcAnimation: .48 },
  food: { spawnCount: 720, respawnInterval: 0.07, skyDropsPerTick: 3, maxObjects: 1000, gravity: 310, cityBuildings: 64,
    /** Eaten houses, towers and vehicles come back; some of them crash down from the sky. */
    bigRespawnInterval: 1.2, bigSkyChance: .45, bigReserve: 80 },
  powerups: { spawnInterval: 8, maxObjects: 9, radius: 15,
    jump: { duration: 0, distance: 320, flightDuration: .95, height: 125, weight: 20, cooldown: 24, maxActive: 1 },
    strike: { duration: 0, distance: 300, burstDuration: .52, windup: .06, weight: 40, cooldown: 10, maxActive: 3,
      /** Hell runs its own frequent Strike spawner, independent of the speed/jump roll. */
      hellInterval: 4, hellMaxActive: 3 },
    speed: { duration: 15, strength: 1.5 }, shield: { duration: 15, weight: 8, cooldown: 45, maxActive: 1 },
    magnet: { duration: 15, range: 180, strength: 220 },
    multiplier: { duration: 20, strength: 2, weight: 2, cooldown: 60, maxActive: 1 }, divider: { duration: 0, strength: .5, weight: 1, cooldown: 90, maxActive: 1 } },
  match: { maxPlayers: 8, width: 4000, height: 3040, zoneStart: 120, zoneEnd: 300, zoneMassLoss: 18, victoryLap: 10, resultsFadeMs: 700 },
  camera: { minZoom: 0.8, maxZoom: 1.32, zoomCurve: 0.18, minUserZoom: 0.6, maxUserZoom: 2.5, followRate: 5, growthRate: 9 },
  network: { tickRate: 30, inputIntervalMs: 125, interpolationMs: 120, maxExtrapolationMs: 160,
    inputTimeoutMs: 650, disconnectMs: 20000, maxCatchupSeconds: 1, maxRetries: 6, lobbyPollMs: 1500,
    requestTimeoutMs: 5000, maxSnapshots: 32 },
  bots: { vision: 480, decisionInterval: 0.18, threatRange: 320, huntRange: 380 },
  visuals: { maxParticles: 96, hudIntervalMs: 100 },
} as const;

export type ObjectCategory = 'tiny' | 'small' | 'medium' | 'large' | 'very-large' | 'huge';
export type ObjectShape = 'lamp' | 'mailbox' | 'meter' | 'campfire' | 'scarecrow' | 'beehive' | 'food' | 'coin' | 'leaf' | 'stone' | 'flower' | 'book' | 'ball' | 'pot' | 'chair' | 'bench' | 'bicycle' | 'bin' | 'sign' | 'barrel' | 'tree' | 'log' | 'vehicle' | 'sofa' | 'table' | 'machine' | 'boat' | 'building' | 'pluto' | 'cup' | 'cone' | 'box' | 'skateboard' | 'hydrant' | 'acorn' | 'pinecone' | 'nest' | 'tent' | 'hay' | 'cart' | 'phone' | 'shrine';
function object(width: number, height: number, mass: number, growth: number, category: ObjectCategory, shape: ObjectShape, color: string, city: number, nature: number) {
  return { width, height, radius: Math.hypot(width, height) / 2, mass, growth, score: growth * 5, category, tier: category, shape, color,
    visualFootprint: { width, height }, physicalFootprint: { width, height },
    underpassClearance: shape === 'vehicle' ? 28 : shape === 'building' ? 34 : 0,
    renderLayer: shape === 'vehicle' || shape === 'building' ? 'raised' : 'ground',
    devourArea: width * height,
    icon: shape, physicsCategory: shape === 'building' ? 'structure' : mass >= 180 ? 'heavy' : 'loose',
    maps: [...(city ? ['city'] : []), ...(nature ? ['nature'] : [])],
    spawnZone: shape === 'building' ? 'block' : shape === 'vehicle' ? 'street' : ['tree', 'flower', 'pot', 'bench'].includes(shape) ? 'green' : 'loose',
    skyDrop: !['building', 'vehicle', 'shrine'].includes(shape) && !['huge', 'very-large'].includes(category),
    rarity: { city, nature }, building: shape === 'building',
    bounce: category === 'tiny' ? .6 : category === 'small' ? .4 : category === 'medium' ? .22 : .06,
    friction: shape === 'building' ? 12 : category === 'tiny' ? 2.2 : 3.8 };
}
// Bounds include every visible part. Weight controls inertia; growth is a separate reward.
export const FOOD = {
  plutoTiny: object(22, 22, 8, 6, 'tiny', 'pluto', '#bea58d', 0, 0),
  plutoSmall: object(42, 42, 30, 18, 'small', 'pluto', '#bea58d', 0, 0),
  plutoMedium: object(80, 80, 150, 45, 'medium', 'pluto', '#bea58d', 0, 0),
  plutoLarge: object(140, 140, 850, 100, 'large', 'pluto', '#bea58d', 0, 0),
  plutoGiant: object(240, 240, 4000, 220, 'huge', 'pluto', '#bea58d', 0, 0),
  shrine: { ...object(150, 120, 6500, 240, 'huge', 'shrine', '#af7456', 0, 0), building: true, underpassClearance: 0 },
  coffeeCup: object(20, 24, 4, 5, 'tiny', 'cup', '#e4bf97', 8, 0),
  phone: object(12, 22, 2, 4, 'tiny', 'phone', '#506878', 7, 0),
  trafficCone: object(30, 30, 12, 12, 'small', 'cone', '#f28b45', 6, 0),
  cardboardBox: object(36, 34, 12, 14, 'small', 'box', '#bf9968', 6, 1),
  skateboard: object(52, 18, 15, 16, 'small', 'skateboard', '#a782cb', 5, 0),
  fireHydrant: object(32, 32, 80, 24, 'medium', 'hydrant', '#d56651', 4, 0),
  shoppingCart: object(68, 44, 60, 30, 'medium', 'cart', '#9ab6bd', 4, 0),
  acorn: object(13, 16, 2, 3, 'tiny', 'acorn', '#bc8e54', 0, 12),
  pinecone: object(14, 22, 2, 3, 'tiny', 'pinecone', '#9d7756', 0, 10),
  birdNest: object(32, 30, 6, 10, 'small', 'nest', '#ac8658', 0, 6),
  bucket: object(28, 28, 8, 12, 'small', 'cup', '#91b6bf', 1, 5),
  woodenCrate: object(52, 46, 65, 27, 'medium', 'box', '#a88155', 0, 5),
  tent: object(110, 90, 85, 48, 'large', 'tent', '#d5a65c', 0, 4),
  hayBale: object(95, 72, 190, 50, 'large', 'hay', '#d3b168', 0, 4),
  woodenCart: object(115, 76, 250, 65, 'large', 'cart', '#ab845a', 0, 3),
  berry: object(14, 18, 2, 2, 'tiny', 'food', '#9473b9', 8, 18),
  mushroom: object(20, 20, 3, 3, 'tiny', 'food', '#bd7861', 0, 8),
  apple: object(24, 30, 5, 5, 'small', 'food', '#e87361', 8, 8),
  donut: object(24, 24, 6, 6, 'small', 'food', '#efa2b5', 6, 0),
  soda: object(16, 26, 5, 5, 'small', 'food', '#72bfd5', 6, 0),
  fries: object(28, 30, 7, 7, 'small', 'food', '#e59c55', 5, 0),
  cupcake: object(28, 38, 7, 7, 'small', 'food', '#ceb1e8', 4, 0),
  burger: object(44, 40, 15, 15, 'medium', 'food', '#deb272', 4, 0),
  pizza: object(44, 44, 17, 17, 'medium', 'food', '#f4ca66', 4, 0),
  melon: object(46, 46, 22, 22, 'medium', 'food', '#8db56f', 0, 6),
  coin: object(10, 10, 1, 2, 'tiny', 'coin', '#edc756', 8, 0),
  leaf: object(18, 8, 1, 2, 'tiny', 'leaf', '#80a75e', 1, 15),
  stone: object(16, 12, 8, 3, 'tiny', 'stone', '#a1ada4', 2, 10),
  flower: object(18, 22, 2, 3, 'tiny', 'flower', '#efb5ce', 3, 10),
  book: object(20, 28, 8, 7, 'small', 'book', '#669abe', 5, 0),
  football: object(26, 26, 4, 8, 'small', 'ball', '#e9dbb8', 4, 2),
  plantPot: object(28, 32, 15, 10, 'small', 'pot', '#bc8367', 5, 3),
  chair: object(36, 42, 30, 18, 'medium', 'chair', '#b69365', 4, 2),
  bicycle: object(70, 30, 35, 23, 'medium', 'bicycle', '#658e9c', 4, 1),
  bench: object(90, 28, 70, 28, 'medium', 'bench', '#b59569', 4, 3),
  trashCan: object(40, 44, 60, 24, 'medium', 'bin', '#739885', 4, 1),
  streetSign: object(28, 72, 55, 25, 'medium', 'sign', '#72a8b0', 4, 1),
  barrel: object(42, 48, 90, 30, 'medium', 'barrel', '#ad8661', 3, 4),
  bush: object(48, 44, 40, 27, 'medium', 'tree', '#769b57', 2, 8),
  log: object(100, 30, 130, 38, 'medium', 'log', '#aa8460', 0, 8),
  motorcycle: object(92, 46, 180, 45, 'large', 'bicycle', '#bf816c', 3, 0),
  vendingMachine: object(62, 100, 260, 55, 'large', 'machine', '#8bacb5', 3, 0),
  couch: object(110, 54, 200, 50, 'large', 'sofa', '#ba8eae', 3, 0),
  table: object(96, 70, 190, 45, 'large', 'table', '#c19e74', 3, 3),
  dumpster: object(100, 68, 360, 65, 'large', 'bin', '#779883', 2, 0),
  treeTrunk: object(80, 28, 240, 48, 'large', 'log', '#aa8460', 1, 5),
  smallTree: object(60, 70, 140, 38, 'medium', 'tree', '#8fae64', 3, 8),
  tree: object(110, 130, 450, 75, 'large', 'tree', '#719451', 2, 7),
  car: object(160, 78, 1200, 100, 'very-large', 'vehicle', '#80acbe', 3, 0),
  boat: object(170, 66, 900, 95, 'very-large', 'boat', '#dabf8f', 0, 3),
  tractor: object(135, 100, 1800, 110, 'very-large', 'vehicle', '#aaad68', 0, 3),
  foodTruck: object(190, 94, 2200, 130, 'very-large', 'vehicle', '#d39a77', 2, 0),
  kiosk: object(115, 108, 2200, 100, 'very-large', 'building', '#e3b375', 2, 0),
  shed: object(130, 112, 2400, 110, 'very-large', 'building', '#b39371', 1, 3),
  cabin: object(170, 140, 4000, 150, 'huge', 'building', '#ac8664', 0, 3),
  house: object(195, 170, 5000, 180, 'huge', 'building', '#dbc39d', 5, 0),
  cafe: object(205, 145, 5500, 190, 'huge', 'building', '#d89981', 3, 0),
  garage: object(180, 152, 4600, 165, 'huge', 'building', '#9eacb1', 3, 0),
  barn: object(235, 185, 7000, 230, 'huge', 'building', '#b67c69', 0, 2),
  cottage: object(205, 180, 6000, 200, 'huge', 'building', '#cfb78d', 0, 2),
  apartment: object(290, 250, 12000, 300, 'huge', 'building', '#a8b6b9', 2, 0),
  townhouse: object(150, 150, 3400, 130, 'very-large', 'building', '#c9a08a', 4, 0),
  mansion: object(285, 240, 11000, 290, 'huge', 'building', '#e6d2b0', 2, 0),
  officeTower: object(230, 210, 16000, 360, 'huge', 'building', '#8fa7b8', 2, 0),
  skyscraper: object(250, 245, 24000, 460, 'huge', 'building', '#7f97ad', 2, 0),
  farmhouse: object(250, 205, 8000, 240, 'huge', 'building', '#d8c39a', 0, 2),
  windmill: object(210, 210, 14000, 340, 'huge', 'building', '#e3d6bd', 0, 2),
  giantBoulder: object(240, 200, 15000, 330, 'huge', 'stone', '#98a29b', 0, 2),
  hotDog: object(34, 16, 4, 6, 'tiny', 'food', '#e0a65e', 6, 0),
  iceCream: object(18, 30, 3, 5, 'tiny', 'food', '#f4c7d9', 6, 0),
  newspaper: object(26, 20, 3, 4, 'tiny', 'book', '#e6e2d6', 6, 0),
  mailbox: object(30, 30, 45, 22, 'medium', 'mailbox', '#5f86c4', 4, 0),
  parkingMeter: object(18, 18, 30, 16, 'small', 'meter', '#8a9aa3', 4, 0),
  scooter: object(56, 22, 20, 18, 'small', 'bicycle', '#e2795f', 4, 0),
  streetLamp: object(26, 26, 70, 26, 'medium', 'lamp', '#4d5c63', 4, 0),
  taxi: object(150, 74, 1100, 95, 'very-large', 'vehicle', '#f2c94c', 3, 0),
  bus: object(250, 96, 3600, 170, 'huge', 'vehicle', '#d9654f', 2, 0),
  pumpkin: object(36, 32, 10, 11, 'small', 'food', '#ec9a3c', 0, 6),
  carrot: object(10, 28, 2, 3, 'tiny', 'food', '#f08a3a', 0, 8),
  beehive: object(26, 32, 6, 9, 'small', 'beehive', '#e3b64a', 0, 5),
  campfire: object(54, 54, 40, 24, 'medium', 'campfire', '#8a5a3c', 0, 4),
  scarecrow: object(56, 30, 35, 26, 'medium', 'scarecrow', '#c9a25a', 0, 4),
  wheelbarrow: object(72, 42, 50, 28, 'medium', 'cart', '#7d9a6a', 0, 4),
  canoe: object(150, 42, 400, 70, 'large', 'boat', '#c4734f', 0, 3),
} as const;
export type FoodKind = keyof typeof FOOD;
export type PowerKind = 'speed' | 'shield' | 'magnet' | 'multiplier' | 'divider' | 'jump' | 'strike';
export const POWER_KINDS: PowerKind[] = ['speed', 'shield', 'magnet', 'multiplier', 'divider', 'jump', 'strike'];
export const COLORS = ['#b9ed55', '#a58aff', '#ff9475', '#62d1e8', '#ffcf60', '#f284bc', '#83d8ac', '#929ff5'];
export const BOT_NAMES = ['Mochi', 'Chomp', 'Pickles', 'Boba', 'Nibbles', 'Waffles', 'Peach', 'Sprout'];
export const massToRadius = (mass: number) => Math.max(EAT.player.minRadius, Math.sqrt(Math.max(0, mass)) * EAT.player.radiusScale);
export const massToSpeed = (mass: number) => EAT.player.baseSpeed * Math.max(EAT.player.minSpeedFactor, (Math.max(mass, EAT.player.startingMass) / EAT.player.startingMass) ** -EAT.player.sizeSpeedPenalty);

export const playerRadius = (p: { mass: number; hellScale?: number }, _time = 0) => { void _time; return massToRadius(p.mass) * (p.hellScale ?? 1); };
export const MATCH_DURATIONS = [120, 600, 1200] as const;
export const matchDuration = (s: { settings?: { matchDuration?: number } }) => s.settings?.matchDuration ?? EAT.hell.normalDuration;
export const FIREBALL_NAME = 'Fireball';
export const POWER_NAME: Record<PowerKind, string> = { speed: 'Speed Boost', shield: 'Shield', magnet: 'Magnet', multiplier: '2x Growth', divider: 'Growth /2', jump: 'Jump', strike: 'Strike' };

export const PLUTO_TIERS = [{ kind: 'plutoTiny', weight: 55 }, { kind: 'plutoSmall', weight: 25 }, { kind: 'plutoMedium', weight: 12 }, { kind: 'plutoLarge', weight: 6 }, { kind: 'plutoGiant', weight: 2 }] as const;
export const isPluto = (kind: FoodKind) => FOOD[kind].shape === 'pluto';
/** Houses, towers, vehicles and other very large props: kept topped up by respawns. */
export const isBigProp = (kind: FoodKind) => !['pluto', 'shrine'].includes(FOOD[kind].shape) && (FOOD[kind].building || FOOD[kind].shape === 'vehicle' || ['huge', 'very-large'].includes(FOOD[kind].category));

/** Camera zoom only partially offsets growth; above the zoom floor, screen radius grows as mass^0.24. */
export const cameraZoom = (mass: number) => Math.max(EAT.camera.minZoom, Math.min(EAT.camera.maxZoom, EAT.camera.maxZoom * (EAT.player.startingMass / Math.max(EAT.player.startingMass, mass)) ** EAT.camera.zoomCurve));
