import { MAX_INVENTORY_SIZE } from "../config.ts";
import { findPlayer } from "../engine/combat.ts";
import { emit } from "../engine/events.ts";
import type { Match } from "../types.ts";
import type { Random } from "../engine/engine.ts";
import { createItemInstance } from "./inventory.ts";
import { itemRegistry } from "./registry.ts";
export const SHOP_PRICES: Record<string, number> = { "mega-medkit": 6, "turbo-boots": 8, "comet-melon": 8, "scatterblaster": 12, "lucky-six": 14, "duel-saber": 12 };
export const MYSTERY_PRICE = 10;
export function shopPrice(state: Match, playerId: string, itemId: string): number | undefined {
  const price = SHOP_PRICES[itemId];
  if (!price) return undefined;
  const nodeId = findPlayer(state, playerId).currentNodeId;
  return state.boardEffects?.some((effect) => effect.kind === "sale" && effect.nodeIds.includes(nodeId)) ? price - 2 : price;
}
export function buyShopItem(state: Match, playerId: string, mystery: boolean, itemId: string | undefined, random: Random) {
  if (state.mode === "festival" || state.phase === "GAME_OVER" || state.phase === "START_ROLL") throw new Error("The shop is closed right now.");
  const player = findPlayer(state, playerId);
  if (player.lastPurchaseRound === state.round) throw new Error("Only one shop or mystery-box purchase per round.");
  if (player.inventory.length >= MAX_INVENTORY_SIZE) throw new Error("Make room in your inventory before buying.");
  const price = mystery ? MYSTERY_PRICE : shopPrice(state, playerId, itemId ?? "");
  if (!price) throw new Error("That item is not for sale.");
  if (player.coins < price) throw new Error(`You need ${price} coins.`);
  const pool = itemRegistry.all();
  const chosen = mystery ? pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))].id : itemId!;
  const item = createItemInstance(state, chosen);
  item.usableFromRound = state.round + 1;
  player.coins -= price; player.lastPurchaseRound = state.round; player.inventory.push(item);
  emit(state, { kind: "SHOP_PURCHASE", playerId, amount: price, text: `${player.name} bought ${itemRegistry.get(chosen).name} · ready in round ${state.round + 1}` });
}
