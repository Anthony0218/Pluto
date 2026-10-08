export type Trait = "ambitious" | "loyal" | "greedy" | "proud" | "cautious" | "brave";
export type CharacterSkills = { diplomacy: number; command: number; stewardship: number; intrigue: number };
export type SuccessionLaw = "primogeniture" | "partition" | "elective" | "clan";
export type CouncilOffice = "marshal" | "steward" | "chancellor" | "spymaster";
export type DemandKind = "lower-taxes" | "council-seat" | "border-estate" | "protect-trade";
export type FeudalContract = { taxRate: number; office?: CouncilOffice; protectedTrade?: boolean; grantedEstate?: string };
export type VassalDemand = { kind: DemandKind; status: "open" | "fulfilled" | "broken"; since: number; deadline?: number };
export type PeaceTerms = { kind: "white" | "recover" | "release" | "open-trade" | "cede" | "claimant" | "tribute"; hex?: string; claimant?: string; coins?: number; militaryAccess?: boolean };
export type Conflict = { id: string; from: string; to: string; reason: WarReason; objective?: string; started: number };
export type Treaty = { from: string; to: string; until: number; access: boolean; trade: boolean; tribute: number; tributeUntil: number; tributeRemaining?: number };
export type Siege = { id: string; army: string; hex: string; defender: string; turns: number; food: number; engines: boolean; offered?: boolean };
export type ScoutMission = { house: string; hex: string; until: number };
export type ArmyReport = { army: string; house: string; name: string; hex: string; low: number; high: number; seen: number };
export type ChronicleEvent = { id: string; tick: number; round: number; kind: "diplomacy" | "succession" | "battle" | "politics" | "siege" | "economy"; house: string; other?: string; hex?: string; person?: string; title: string; detail: string };

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
  depot?: boolean;
  watchtower?: boolean;
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
  claims?: string[];
  imprisonedBy?: string;
  traits?: Trait[];
  skills?: CharacterSkills;
  lastChildYear?: number;
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
  contract?: FeudalContract;
  demand?: VassalDemand;
  successionLaw?: SuccessionLaw;
  designatedHeir?: string;
  regent?: string;
  prestige?: number;
  bargains?: string[];
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
  provisions?: number;
  supplySource?: string;
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
  kind: "war" | "peace" | "marriage" | "attack" | "surrender";
  from: string;
  to: string;
  created: number;
  army?: string;
  hex?: string;
  people?: [string, string];
  negotiated?: boolean;
  reason?: WarReason;
  terms?: PeaceTerms;
  siege?: string;
  partnerHouse?: string;
};
export type WarReason =
  | "trade-blockade"
  | "occupied-land"
  | "captive-family"
  | "defend-ally"
  | "insult"
  | "territorial-conquest"
  | "dynastic-claim"
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
  strategyRules?: 1;
  conflicts?: Conflict[];
  treaties?: Treaty[];
  sieges?: Siege[];
  scouts?: ScoutMission[];
  intelligence?: Record<string, ArmyReport[]>;
  events?: ChronicleEvent[];
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
  | { type: "peace"; nation: string; terms?: PeaceTerms }
  | { type: "bargain"; house: string; offer: DemandKind; hex?: string; office?: CouncilOffice }
  | { type: "successionLaw"; law: SuccessionLaw }
  | { type: "nominate"; person: string }
  | { type: "infrastructure"; hex: string; building: "road" | "depot" | "watchtower" }
  | { type: "scout"; hex: string }
  | { type: "siege"; army: string; hex: string; stance: "blockade" | "assault" | "negotiate" | "lift" }
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
      people?: [string, string];
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
