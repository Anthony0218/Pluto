import { createUnit } from "./unitCatalog";
import type { Unit } from "./types";

export type CampaignEffect = {
  id: string;
  title: string;
  description: string;
  duration?: string;
  icon: "rally" | "shield" | "wound" | "haste";
};

export type BrickstoneUnit = {
  unit: Unit;
  role: string;
  symbol: "shield" | "swords" | "rider" | "bow";
  buffs: CampaignEffect[];
  debuffs: CampaignEffect[];
};

export type CampaignLogEntry = { id: number; time: string; message: string; kind: "report" | "selection" | "supplies" };

// PROVISIONAL SCENE DATA: placements, effects, current health, garrison and logs
// demonstrate the location UI only. They do not mutate campaign progress or the
// combat engine. Base stats come from the established roster, not a second ruleset.
export const BRICKSTONE_SCENE = {
  name: "Brickstone Fortress",
  subtitle: "The northern approach",
  image: "/MedievalKingdoms/maps/regions/brickstone-fortress.png",
  fortress: { x: 79, y: 32, status: "Contested", garrison: 48, supplies: "12 days", defenses: "Fortified" },
  initialUnitId: "brickstone-conscript",
  // Visual range only; map-to-centimeter calibration is not finalized.
  rangePreviewScale: 0.65,
  initialLog: [
    { id: 3, time: "09:42", message: "Scouts report movement along the eastern road.", kind: "report" },
    { id: 2, time: "09:38", message: "Fortress stores counted: supplies for 12 days.", kind: "supplies" },
    { id: 1, time: "09:30", message: "Falconstone patrol reached the northern approach.", kind: "report" },
  ] as CampaignLogEntry[],
} as const;

export const BRICKSTONE_UNITS: BrickstoneUnit[] = [
  {
    unit: createUnit("peasant", "brickstone-conscript", "falconstone", { x: 28, y: 53 }),
    role: "Falconstone · Infantry", symbol: "shield",
    buffs: [
      { id: "rally", title: "Rallying Cry", duration: "2 turns", description: "Steadied by a nearby banner.", icon: "rally" },
      { id: "stance", title: "Defensive Stance", duration: "3 turns", description: "Holding position on the approach.", icon: "shield" },
    ],
    debuffs: [],
  },
  {
    unit: { ...createUnit("mercenary", "brickstone-mercenary", "falconstone", { x: 43, y: 43 }), name: "Söldner", health: 16 },
    role: "Falconstone · Mercenary", symbol: "swords",
    buffs: [],
    debuffs: [{ id: "weary", title: "Road Weary", duration: "1 turn", description: "Recovering after the mountain march.", icon: "wound" }],
  },
  {
    unit: createUnit("pumaRider", "brickstone-rider", "falconstone", { x: 39, y: 72 }),
    role: "Falconstone · Mounted scout", symbol: "rider",
    buffs: [{ id: "haste", title: "Sure-footed", duration: "2 turns", description: "A sure footing on the hillside.", icon: "haste" }],
    debuffs: [],
  },
  {
    unit: createUnit("archer", "brickstone-patrol", "blackthorn", { x: 55, y: 58 }),
    role: "Blackthorn · Ranged patrol", symbol: "bow",
    buffs: [{ id: "cover", title: "Watchful", description: "Watching the road from higher ground.", icon: "shield" }],
    debuffs: [],
  },
];
