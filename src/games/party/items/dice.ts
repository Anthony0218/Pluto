import { RULES } from "../config.ts";
import type { Random } from "../engine/engine.ts";

export function rollBonus(random: Random): number {
  return Math.min(
    RULES.turboBootsMax,
    Math.max(0, Math.floor(random() * (RULES.turboBootsMax + 1))),
  );
}
