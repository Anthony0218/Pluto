import { RULES } from "../config.ts";
import { activePlayer } from "../engine/engine.ts";
import { itemRegistry } from "../items/registry.ts";
import type { BoardMap, BoardNode, Match, TileType } from "../types.ts";

export type FieldKind = TileType | "cleanse";
export function fieldKind(map: BoardMap, node: BoardNode): FieldKind {
  return map.cleansingNodeIds?.includes(node.id) ? "cleanse" : node.type;
}
export function fieldMaterial(map: BoardMap, node: BoardNode) {
  const motif = map.regions[node.region].motif;
  if (map.theme === "mountain" && ["lake", "cave", "summit", "cliff"].includes(motif))
    return { kind: "ice", base: "#8ebccc", trim: "#deffff", roughness: .25, segments: 6 } as const;
  if (["temple", "volcano", "mine", "cliff"].includes(motif))
    return { kind: "stone", base: "#737c88", trim: "#cad0c3", roughness: .95, segments: 8 } as const;
  return { kind: "wood", base: "#8d6348", trim: "#e6bc82", roughness: .9, segments: 20 } as const;
}
export interface BoardLanding {
  id: string;
  nodeId: string;
  playerId: string;
  kind: FieldKind;
  amount: number;
  label: string;
  icon: string;
  targetNodeId?: string;
  cleansed: boolean;
  startedAt: number;
}
// A field resolves after arrival, not on every movement step. Comparing authoritative snapshots also
// covers coin/deposit/warp fields, which deliberately do not emit separate server feedback events.
export function boardLanding(before: Match, after: Match, map: BoardMap, now: number): BoardLanding | null {
  if (before.phase !== "RESOLVE_TILE" || before.round !== after.round || before.turnIndex !== after.turnIndex) return null;
  const player = activePlayer(before), next = after.players.find((p) => p.id === player.id);
  if (!next || (after.phase === "RESOLVE_TILE" && player.currentNodeId === next.currentNodeId)) return null;
  const node = map.nodes.find((n) => n.id === player.currentNodeId);
  if (!node) return null;
  const kind = fieldKind(map, node) === "cleanse" ? "cleanse" : before.boardEffects?.some((e) => e.kind === "relic" && e.nodeIds.includes(node.id)) ? "item" : fieldKind(map, node);
  const events = after.events.filter((e) => e.id > before.eventSeq && e.playerId === player.id);
  const event = after.events.find((e) => e.id > before.eventSeq && e.kind === "EVENT");
  const healed = events.filter((e) => e.kind === "HEAL").reduce((n, e) => n + (e.amount ?? 0), 0);
  const item = after.pendingItem ?? next.inventory.find((i) => !player.inventory.some((old) => old.instanceId === i.instanceId));
  const definition = item ? itemRegistry.get(item.itemId) : null;
  const amount = kind === "coin" || kind === "boost" ? RULES.coinTile : kind === "deposit" ? Math.min(player.coins, RULES.bankDeposit) : kind === "bank" ? before.bank : kind === "heal" || kind === "cleanse" ? healed : kind === "hazard" ? RULES.hazard : 0;
  const labels: Partial<Record<FieldKind, string>> = {
    coin: `+${amount} coins`, boost: `+${amount} coins`, deposit: `${amount} deposited`, bank: `+${amount} coins`,
    heal: amount ? `+${amount} HP` : "HP full", cleanse: amount ? `Clean! +${amount} HP` : "All clear!", hazard: `−${amount} HP`,
    item: definition?.name ?? "Item found", rare: definition?.name ?? "Rare item found", event: event?.text.split("!")[0].slice(0, 38) ?? "Event revealed!", warp: next.currentNodeId !== node.id ? "Off you go!" : "Arrived",
  };
  return { id: `${after.round}:${after.turnIndex}:${node.id}:${after.eventSeq}:${now}`, nodeId: node.id, playerId: player.id, kind, amount,
    label: labels[kind] ?? "Arrived", icon: definition?.icon ?? (kind === "event" ? /COIN|TREASURE|BREEZE|BOUNTY|WINDFALL/.test(event?.text ?? "") ? "◉" : "!" : kind === "heal" || kind === "cleanse" ? "✚" : kind === "coin" || kind === "bank" || kind === "deposit" ? "◉" : "✦"),
    ...(kind === "warp" && next.currentNodeId !== node.id && { targetNodeId: next.currentNodeId }),
    cleansed: kind === "cleanse" && player.statusEffects.length > 0, startedAt: now };
}
