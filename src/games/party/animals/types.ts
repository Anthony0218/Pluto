import type { AnimalType } from "../types.ts";

// Data-only description of a summonable animal. Movement, targeting, contact and lifetime are shared
// (animals/runtime.ts); an animal differs only by these numbers and its presentation.
export interface AnimalDefinition {
  id: AnimalType;
  name: string;
  icon: string;
  description: string;
  movementPerPhase: number;
  damage: number;
  lifetimeRounds: number;
}
