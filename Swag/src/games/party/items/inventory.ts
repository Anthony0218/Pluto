import { MAX_INVENTORY_SIZE } from "../config.ts";
import { findPlayer } from "../engine/combat.ts";
import { emit } from "../engine/events.ts";
import type { ItemInstance, Match } from "../types.ts";
import { itemRegistry } from "./registry.ts";

export function createItemInstance(state: Match, itemId: string): ItemInstance {
  itemRegistry.get(itemId);
  return { instanceId: `item-${state.nextItemNumber++}`, itemId };
}
export function findItem(
  state: Match,
  playerId: string,
  instanceId: string,
): ItemInstance {
  const item = findPlayer(state, playerId).inventory.find(
    (i) => i.instanceId === instanceId,
  );
  if (!item) throw new Error("You do not have that item.");
  return item;
}
export function removeItem(state: Match, playerId: string, instanceId: string) {
  findItem(state, playerId, instanceId);
  const player = findPlayer(state, playerId);
  player.inventory = player.inventory.filter(
    (i) => i.instanceId !== instanceId,
  );
}
// Adds when there is room. A full inventory parks the item as pending so nothing is silently lost.
export function grantItem(
  state: Match,
  playerId: string,
  itemId: string,
): "added" | "pending" {
  const player = findPlayer(state, playerId),
    item = createItemInstance(state, itemId),
    name = itemRegistry.get(itemId).name;
  if (player.inventory.length >= MAX_INVENTORY_SIZE) {
    state.pendingItem = item;
    emit(state, {
      kind: "ITEM_GAINED",
      playerId,
      text: `${player.name.toUpperCase()} FOUND ${name.toUpperCase()} · INVENTORY FULL`,
    });
    return "pending";
  }
  player.inventory.push(item);
  emit(state, {
    kind: "ITEM_GAINED",
    playerId,
    text: `${player.name.toUpperCase()} GOT ${name.toUpperCase()}`,
  });
  return "added";
}
export function replaceWithPending(
  state: Match,
  playerId: string,
  replaceInstanceId: string,
) {
  const pending = state.pendingItem;
  if (!pending) throw new Error("There is no new item to place.");
  const player = findPlayer(state, playerId),
    index = player.inventory.findIndex(
      (i) => i.instanceId === replaceInstanceId,
    );
  if (index < 0) throw new Error("Choose one of your three items to replace.");
  const old = itemRegistry.get(player.inventory[index].itemId);
  player.inventory[index] = pending;
  state.pendingItem = null;
  emit(state, {
    kind: "ITEM_DISCARDED",
    playerId,
    text: `${player.name.toUpperCase()} SWAPPED ${old.name.toUpperCase()} FOR ${itemRegistry.get(pending.itemId).name.toUpperCase()}`,
  });
}
export function discardPending(state: Match, playerId: string) {
  const pending = state.pendingItem;
  if (!pending) throw new Error("There is no new item to discard.");
  state.pendingItem = null;
  emit(state, {
    kind: "ITEM_DISCARDED",
    playerId,
    text: `${findPlayer(state, playerId).name.toUpperCase()} DISCARDED ${itemRegistry.get(pending.itemId).name.toUpperCase()}`,
  });
}
