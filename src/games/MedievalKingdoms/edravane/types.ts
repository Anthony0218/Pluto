export type Resource =
  | "grain"
  | "timber"
  | "iron"
  | "livestock"
  | "horses"
  | "herbs"
  | "luxury";
export type Stock = Record<Resource, number>;
export type Biome =
  | "plains"
  | "river"
  | "forest"
  | "hills"
  | "mountains"
  | "coast"
  | "island"
  | "tundra"
  | "steppe"
  | "glacier"
  | "volcanic"
  | "desert"
  | "marsh"
  | "sea"
  | "legacy";
export type Nation = {
  id: string;
  name: string;
  people: string;
  succession: string;
  house: string;
  color: string;
  crest: string;
  capital: string;
  anchor: [number, number];
};
export type District = {
  id: string;
  q: number;
  r: number;
  name: string;
  nation: string | null;
  owner: string | null;
  biome: Biome;
  resource: Resource;
  settlement: string;
  seat?: "capital" | "secondary";
  city?: "town" | "major";
  castle?: { level: 1 | 2 | 3 };
  farm?: boolean;
  harvestedAt?: number;
  port: boolean;
  shipyard: boolean;
  road: boolean;
  bonus?: "gold" | "silver";
  occupation?: string;
  occupiedAt?: number;
  disputed: boolean;
  unrest: number;
};
export type Person = {
  id: string;
  name: string;
  gender: "male" | "female";
  age: number;
  alive: boolean;
  parents: string[];
  spouse?: string;
  claim?: string;
  imprisonedBy?: string;
};
export type House = {
  id: string;
  name: string;
  nation: string;
  color: string;
  crest: string;
  role: "crown" | "resource" | "frontier" | "trade" | "claimant";
  ruler: string;
  family: Person[];
  treasury: number;
  stock: Stock;
  opinion: number;
  legitimacy: number;
  obligation: number;
  loyalty: number;
  reasons: string[];
  ambition: string;
  relations: Record<string, number>;
  liege: string | null;
  rebellion: boolean;
  summons: string;
  unjustifiedWars?: number;
};
export type Title = {
  id: string;
  nation: string;
  holder: string;
};
export type UnitKind = "levies" | "spearmen" | "archers" | "heavy" | "cavalry";
export type Army = {
  id: string;
  name: string;
  house: string;
  origin: string;
  hex: string;
  troops: Record<UnitKind, number>;
  /** Wounded soldiers are alive but excluded from combat-ready troops. */
  wounded?: Partial<Record<UnitKind, number>>;
  /** Stationary reserves include the castle guard; detach troops to march. */
  garrison?: boolean;
  path: string[];
  morale: number;
  loyalty?: number;
  blockading?: boolean;
  supply: number;
  fatigue: number;
  pledgedTo?: string;
  serviceUntil: number;
  objective?: string;
  voyage?: {
    path: string[];
    progress: number;
    destination: string;
    ships: number;
  };
  commander: string;
  rebel: boolean;
  delay: number;
};
export type TradeRoute = {
  id: string;
  house: string;
  from: string;
  to: string;
  path: string[];
  maritime: boolean;
  import?: boolean;
  resource: Resource;
  capacity: number;
  cost: number;
  progress: number;
  delivered: number;
  status: string;
};
export type OrderKind =
  | "move"
  | "face"
  | "hold"
  | "attack"
  | "charge"
  | "withdraw";
export type Formation = {
  id: string;
  army: string;
  kind: UnitKind;
  count: number;
  initial: number;
  x: number;
  y: number;
  facing: number;
  width: number;
  morale: number;
  fatigue: number;
  order: OrderKind;
  target: [number, number];
  exit: [number, number];
  routed: boolean;
  escaped: boolean;
  reserve: boolean;
  position?: BattlePosition;
  wounded?: number;
  dead?: number;
};
export type BattlePosition = "front" | "rear" | "flank";
export type BattleOrder = "hold" | "advance" | "flank" | "volley" | "retreat";
export type BattlePlan = {
  order: BattleOrder;
  positions: Partial<Record<UnitKind, BattlePosition>>;
};
export type BattleRounds = {
  round: number;
  plans: Record<string, BattlePlan>;
  committed: string[];
  log: string[];
  commandersDown: string[];
  reinforced: string[];
};
export type BattleReport = {
  id: string;
  hex: string;
  winner?: string;
  round: number;
  sides: {
    army: string;
    house: string;
    name: string;
    healthy: number;
    wounded: number;
    dead: number;
    escaped: boolean;
    captured: number;
  }[];
  log: string[];
};
export type Battle = {
  id: string;
  hex: string;
  armies: string[];
  approaches: Record<string, string>;
  phase: "encounter" | "combat";
  stood: string[];
  seconds: number;
  formations: Formation[];
  pauseVotes: string[];
  rounds?: BattleRounds;
};
export type Challenge = {
  id: string;
  house: string;
  hex: string;
  kind: "gold" | "silver";
  question: string;
  choices: string[];
  answer: number;
  attempts: number;
  done: boolean;
  created: number;
};
export type Reaction = {
  id: string;
  kind: "war" | "peace" | "marriage" | "attack";
  from: string;
  to: string;
  created: number;
  army?: string;
  hex?: string;
  people?: [string, string];
  negotiated?: boolean;
  reason?: WarReason;
};
export type WarReason =
  | "trade-blockade"
  | "occupied-land"
  | "captive-family"
  | "defend-ally"
  | "insult"
  | "territorial-conquest"
  | "unjustified";
export type DiplomaticInsult = {
  from: string;
  to: string;
  tick: number;
  round: number;
  resolved?: boolean;
};
export type WarDeclaration = {
  from: string;
  to: string;
  reason: WarReason;
  tick: number;
};
export type CampaignTurn = {
  order: string[];
  index: number;
  round: number;
  pending: Reaction[];
  ending?: string;
  prepared?: string;
};
export type Campaign = {
  version: 2;
  estateRules?: 1;
  turns?: CampaignTurn;
  world: "Edravane";
  mode: "single" | "multi";
  tick: number;
  rng: number;
  serial: number;
  paused: boolean;
  districts: District[];
  houses: House[];
  titles: Title[];
  armies: Army[];
  routes: TradeRoute[];
  wars: string[];
  warDeclarations?: WarDeclaration[];
  insults?: DiplomaticInsult[];
  battles: Battle[];
  battleReports?: BattleReport[];
  appliedResults: string[];
  challenges: Challenge[];
  rewards: Record<
    string,
    {
      count: number;
      next: number;
    }
  >;
  log: string[];
  prices: Stock;
  config: {
    maritimeHazard: number;
    serviceTicks: number;
    tickSeconds: number;
  };
};
export type Actor = {
  house: string;
  host?: boolean;
};
export type Command =
  | { type: "endTurn" }
  | { type: "insult"; house: string }
  | { type: "peace"; nation: string }
  | {
      type: "respond";
      reaction: string;
      choice: "accept" | "decline" | "defend" | "withdraw" | "peace";
      army?: string;
    }
  | { type: "harvest"; hex: string }
  | { type: "upgradeCastle"; hex: string }
  | { type: "muster"; army: string; count: number }
  | { type: "blockade"; army: string; enabled: boolean }
  | { type: "attack"; army: string; hex: string; reason?: WarReason }
  | {
      type: "move";
      army: string;
      hex: string;
    }
  | {
      type: "embark";
      army: string;
      hex: string;
    }
  | {
      type: "objective";
      army: string;
      hex: string;
    }
  | {
      type: "war";
      nation: string;
      reason?: WarReason;
    }
  | {
      type: "summon";
      house: string;
    }
  | {
      type: "concession";
      house: string;
    }
  | {
      type: "pretender";
      house: string;
    }
  | {
      type: "marry";
      house: string;
    }
  | {
      type: "succession";
    }
  | {
      type: "recruit";
      army: string;
      kind: UnitKind;
      count?: 20 | 100;
    }
  | {
      type: "route";
      from: string;
      to: string;
      resource: Resource;
      maritime: boolean;
      import?: boolean;
    }
  | {
      type: "shipyard";
      hex: string;
    }
  | {
      type: "annex";
      hex: string;
    }
  | {
      type: "challenge";
      hex: string;
    }
  | {
      type: "answer";
      challenge: string;
      choice: number;
    }
  | {
      type: "battlePlan";
      battle: string;
      army: string;
      round: number;
      plan: BattlePlan;
    }
  | {
      type: "battleReinforce";
      battle: string;
      army: string;
      reserve: string;
    }
  | {
      type: "stand";
      battle: string;
      army: string;
    }
  | {
      type: "retreat";
      battle: string;
      army: string;
    }
  | {
      type: "order";
      battle: string;
      formation: string;
      order: OrderKind;
      x: number;
      y: number;
      facing: number;
      width: number;
    }
  | {
      type: "pause";
      paused: boolean;
    }
  | {
      type: "battlePause";
      battle: string;
      approve: boolean;
    };
