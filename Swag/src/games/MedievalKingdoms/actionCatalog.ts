import type { AttackActionId, DefenseActionId, SkillActionId } from "./types";

export const ATTACK_ACTIONS: Array<{
  id: AttackActionId;
  name: string;
  description: string;
}> = [
  {
    id: "quick",
    name: "Quick Attack",
    description:
      "Time the rotating direction pointer. Balanced accuracy and damage.",
  },
  {
    id: "melee",
    name: "Melee Precision",
    description:
      "Choose a nearby enemy. Strike when the collapsing ring reaches the golden center.",
  },
  {
    id: "power",
    name: "Power Strike",
    description:
      "Lock direction, then time a power meter. More power gives more damage but lowers accuracy slightly.",
  },
  {
    id: "sweep",
    name: "Sweep / Cone",
    description: "Attack every enemy inside a forward cone at reduced damage.",
  },
  {
    id: "charge",
    name: "Charge / Pounce",
    description:
      "Rush in the chosen direction and strike an enemy near the destination.",
  },
  {
    id: "area",
    name: "Area Blast",
    description:
      "Lock direction, then time distance. Damages enemies around the landing point.",
  },
  {
    id: "knockback",
    name: "Knockback Strike",
    description: "A directional attack that pushes a hit target away.",
  },
  {
    id: "archer",
    name: "Archer Shot",
    description:
      "Lock direction, then estimate elevation/range and release at the right moment.",
  },
];

export const DEFENSE_ACTIONS: Array<{
  id: DefenseActionId;
  name: string;
  description: string;
}> = [
  {
    id: "brace",
    name: "Brace",
    description: "Reduces incoming damage and knockback.",
  },
  {
    id: "dodge",
    name: "Dodge",
    description: "Strongly lowers enemy hit chance.",
  },
  {
    id: "counter",
    name: "Counter",
    description:
      "Nearby melee attackers can take automatic retaliation damage.",
  },
  {
    id: "guard",
    name: "Guard Ally",
    description:
      "Choose an ally; this unit absorbs part of incoming damage while close.",
  },
  {
    id: "shield",
    name: "Directional Shield",
    description:
      "Strong protection against attacks arriving from the unit's front arc.",
  },
  {
    id: "cover",
    name: "Take Cover",
    description:
      "Ranged attacks become less accurate. Best in forest, ruins and high ground.",
  },
  {
    id: "fortify",
    name: "Fortify",
    description: "Spend the turn digging in for major damage reduction.",
  },
  {
    id: "evade",
    name: "Evade / Retreat",
    description:
      "Lower hit chance and automatically step away after being attacked.",
  },
];

export const SKILL_ACTIONS: Array<{
  id: SkillActionId;
  name: string;
  description: string;
}> = [
  {
    id: "heal",
    name: "Healing Light",
    description: "Click a friendly target to restore HP.",
  },
  {
    id: "damageBoost",
    name: "War Blessing",
    description: "Click a friendly target to grant a temporary damage bonus.",
  },
  {
    id: "trap",
    name: "Rune Trap",
    description: "Click the battlefield to place a damaging rune trap.",
  },
  {
    id: "teleport",
    name: "Teleport",
    description:
      "Click a valid battlefield point to instantly relocate the caster.",
  },
  {
    id: "burn",
    name: "Burn",
    description:
      "Click an enemy to launch a fire spell and apply burning damage over time.",
  },
];
