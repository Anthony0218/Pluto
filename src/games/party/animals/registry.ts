import { ANIMAL_CONFIG } from "../config.ts";
import { Registry } from "../content/registry.ts";
import type { AnimalDefinition } from "./types.ts";

export const cheetah: AnimalDefinition = {
  id: "cheetah",
  name: "Cheetah",
  icon: "🐆",
  description: `Fast hunter: ${ANIMAL_CONFIG.cheetah.movementPerPhase} spaces per Animal Phase, ${ANIMAL_CONFIG.cheetah.damage} damage on contact.`,
  ...ANIMAL_CONFIG.cheetah,
};
export const crocodile: AnimalDefinition = {
  id: "crocodile",
  name: "Crocodile",
  icon: "🐊",
  description: `Slow ambusher: ${ANIMAL_CONFIG.crocodile.movementPerPhase} spaces per Animal Phase, ${ANIMAL_CONFIG.crocodile.damage} damage on contact.`,
  ...ANIMAL_CONFIG.crocodile,
};

export const animalRegistry = new Registry<AnimalDefinition>();
animalRegistry.register(cheetah);
animalRegistry.register(crocodile);
