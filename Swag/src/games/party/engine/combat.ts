import { RULES } from "../config.ts";
import { emit } from "./events.ts";
import { bumpStat } from "./stats.ts";
import type { BoardMap, Match, Player } from "../types.ts";

export function findPlayer(state: Match, playerId: string): Player {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) throw new Error("Unknown player.");
  return player;
}
export function clampHp(hp: number, maxHp: number): number {
  return Math.min(maxHp, Math.max(0, Math.trunc(hp)));
}
export function isKnockedOut(player: Player): boolean {
  return player.hp <= 0;
}
// Sends the player back to Start at full starting HP. A KO never skips a turn.
export function respawnPlayer(state: Match, map: BoardMap, player: Player) {
  player.hp = RULES.hp;
  player.currentNodeId = map.start;
  player.previousNodeId = null;
  emit(state, {
    kind: "RESPAWN",
    playerId: player.id,
    nodeId: map.start,
    text: `${player.name.toUpperCase()} RESPAWNED`,
  });
}
// Removes up to koCoins into the central bank, then respawns. Returns the coins moved.
export function knockOut(state: Match, map: BoardMap, player: Player): number {
  const lost = Math.min(player.coins, RULES.koCoins);
  bumpStat(state, player.id, "knockouts");
  player.coins -= lost;
  state.bank += lost;
  emit(state, {
    kind: "KO",
    playerId: player.id,
    amount: lost,
    text: `${player.name.toUpperCase()} WAS KO'D · ${lost} COINS TO THE BANK`,
  });
  respawnPlayer(state, map, player);
  return lost;
}
// The single entry point for HP loss: weapons, hazards, animals and effects should all call this.
export function damagePlayer(
  state: Match,
  map: BoardMap,
  playerId: string,
  amount: number,
): { dealt: number; knockedOut: boolean } {
  const player = findPlayer(state, playerId),
    damage = Math.max(0, Math.trunc(amount));
  if (damage === 0) return { dealt: 0, knockedOut: false };
  player.hp = clampHp(player.hp - damage, player.maxHp);
  emit(state, {
    kind: "DAMAGE",
    playerId,
    amount: damage,
    text: `${player.name.toUpperCase()} -${damage} HP`,
  });
  if (!isKnockedOut(player)) return { dealt: damage, knockedOut: false };
  knockOut(state, map, player);
  return { dealt: damage, knockedOut: true };
}
// Returns the HP actually restored after respecting maxHp.
export function healPlayer(
  state: Match,
  playerId: string,
  amount: number,
): number {
  const player = findPlayer(state, playerId),
    requested = Math.max(0, Math.trunc(amount)),
    healed = Math.min(requested, Math.max(0, player.maxHp - player.hp));
  player.hp = clampHp(player.hp + healed, player.maxHp);
  if (healed > 0)
    emit(state, {
      kind: "HEAL",
      playerId,
      amount: healed,
      text: `${player.name.toUpperCase()} +${healed} HP`,
    });
  return healed;
}
