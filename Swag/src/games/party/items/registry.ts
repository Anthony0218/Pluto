import { RARE_ITEM_WEIGHTS } from "../config.ts";
import { Registry } from "../content/registry.ts";
import type { Random } from "../engine/engine.ts";
import { pickWeighted } from "../engine/random.ts";
import { cometMelon, megaMedkit, turboBoots } from "./definitions.ts";
import { duelSaber } from "./duelSaber.ts";
import { falloutCore, pocketDuel, wildTotem } from "./rare.ts";
import type { ItemDefinition } from "./types.ts";
import { luckySix, scatterblaster } from "./weapons.ts";

export const itemRegistry = new Registry<ItemDefinition>();
for (const item of [
  megaMedkit,
  turboBoots,
  cometMelon,
  scatterblaster,
  luckySix,
  duelSaber,
  pocketDuel,
  falloutCore,
  wildTotem,
])
  itemRegistry.register(item);

// Random Item fields award any implemented standard (non-rare) item.
export function randomStandardItemId(random: Random): string {
  const pool = itemRegistry.all().filter((item) => item.rarity !== "rare");
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))].id;
}

// Rare Item fields award one registered rare item, weighted by RARE_ITEM_WEIGHTS (server-side roll).
// Weights naming unregistered or non-rare items are ignored, so the pool can never leak standard items.
export function randomRareItemId(
  random: Random,
  weights: Readonly<Record<string, number>> = RARE_ITEM_WEIGHTS,
): string {
  const rare = new Set(itemRegistry.all().filter((i) => i.rarity === "rare").map((i) => i.id));
  return pickWeighted(weights, random, (id) => rare.has(id));
}
