import { RADIATION_CONFIG } from "../config.ts";
import { Registry } from "../content/registry.ts";
import { damagePlayer, findPlayer } from "../engine/combat.ts";
import { emit } from "../engine/events.ts";
import type {
  BoardMap,
  Match,
  Player,
  StatusEffect,
  StatusEffectId,
} from "../types.ts";

// Generic status effects stored in `Player.statusEffects` (one entry per id, never stacked).
// Lifecycle of an effect with N turns:
//   applied (any time)       → remainingTurns = N (re-applying refreshes it to N)
//   each own TURN START      → onTurnStart runs, remainingTurns -= 1
//   own TURN_END at 0        → removed
// So an N-turn effect covers exactly N of the player's turns, including the item phase of the last one.
export interface StatusDefinition {
  id: StatusEffectId;
  name: string;
  icon: string;
  // Short, always-visible HUD explanation.
  summary: string;
  // When set, the player cannot use items while the effect is present; the text is the reason.
  itemLock?: string;
  onTurnStart?(state: Match, map: BoardMap, player: Player): void;
}

export const radiationStatus: StatusDefinition = {
  id: "radiation",
  name: "Radiation",
  icon: "☢",
  summary: `-${RADIATION_CONFIG.damagePerTurn} HP each turn · Items disabled`,
  itemLock: "ITEMS DISABLED — RADIATION",
  onTurnStart(state, map, player) {
    emit(state, {
      kind: "RADIATION",
      playerId: player.id,
      amount: RADIATION_CONFIG.damagePerTurn,
      text: `☢ RADIATION: ${player.name.toUpperCase()} -${RADIATION_CONFIG.damagePerTurn} HP`,
    });
    // Normal damage/KO path: a radiation KO pays the usual coin penalty and does not cleanse the effect.
    damagePlayer(state, map, player.id, RADIATION_CONFIG.damagePerTurn);
  },
};

export const statusRegistry = new Registry<StatusDefinition>();
statusRegistry.register(radiationStatus);

export function findStatus(
  player: Player,
  id: StatusEffectId,
): StatusEffect | undefined {
  return player.statusEffects.find((effect) => effect.id === id);
}

// Adds the effect or refreshes an existing one to `turns` (no stacking).
export function applyStatus(
  state: Match,
  playerId: string,
  id: StatusEffectId,
  turns: number,
): "applied" | "refreshed" {
  statusRegistry.get(id);
  const player = findPlayer(state, playerId),
    existing = findStatus(player, id);
  if (existing) {
    existing.remainingTurns = turns;
    return "refreshed";
  }
  player.statusEffects.push({ id, remainingTurns: turns });
  return "applied";
}

// First item-locking effect's reason, or null when the player may use items.
export function itemLockReason(player: Player): string | null {
  for (const effect of player.statusEffects) {
    const lock = statusRegistry.get(effect.id).itemLock;
    if (lock) return lock;
  }
  return null;
}

// Runs at the start of the player's own turn, before the item phase opens.
export function runTurnStartEffects(state: Match, map: BoardMap, playerId: string) {
  // Stable order; each effect is looked up again because a KO respawn may run in between.
  for (const id of findPlayer(state, playerId).statusEffects.map((e) => e.id)) {
    const player = findPlayer(state, playerId),
      effect = findStatus(player, id);
    if (!effect || effect.remainingTurns <= 0) continue;
    effect.remainingTurns--;
    statusRegistry.get(id).onTurnStart?.(state, map, player);
  }
}

// Runs at the player's TURN_END: effects whose last affected turn just ended are removed.
export function expireTurnEndEffects(state: Match, playerId: string) {
  const player = findPlayer(state, playerId);
  player.statusEffects = player.statusEffects.filter((e) => e.remainingTurns > 0);
}
