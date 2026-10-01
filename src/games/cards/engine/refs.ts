/**
 * Resolves the declarative references used by conditions and effects
 * (players, player sets, zones, cards and values). Pure reads: nothing here
 * mutates state, so conditions can be evaluated freely for previews.
 */
import { isSuit, rankIndex } from "../cards/card.ts";
import { evaluateCondition } from "./conditions.ts";
import { zoneKey, type Runtime, type Scope } from "./runtime.ts";
import type { CardRef, ConditionNode, PlayerRef, PlayerSetRef, PlayerState, Primitive, ValueRef, ZoneRef } from "./types.ts";

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/* ------------------------------------------------------------------ Players */

function stepFrom(rt: Runtime, fromId: string | undefined, direction: 1 | -1, includeSelf: boolean, where: ConditionNode | undefined, scope: Scope): string | undefined {
  const players = [...rt.state.players].sort((a, b) => a.seat - b.seat);
  const start = players.findIndex((player) => player.id === fromId);
  if (start < 0) return undefined;
  for (let offset = includeSelf ? 0 : 1; offset <= players.length; offset++) {
    const candidate = players[(start + direction * offset + players.length * 2) % players.length];
    if (candidate.status === "active" && (!where || evaluateCondition(where, rt, { ...scope, each: candidate.id }))) return candidate.id;
  }
  return undefined;
}

function extremeCardHolder(rt: Runtime, spec: { zone: string; where?: unknown }, scope: Scope, pick: "lowest" | "highest"): string | undefined {
  let best: { player: string; index: number } | undefined;
  for (const player of rt.activePlayers()) {
    const zone = rt.zone(zoneKey(spec.zone, player.id));
    if (!zone) continue;
    for (const cardId of zone.cards) {
      if (spec.where && !evaluateCondition(spec.where as never, rt, { ...scope, each: player.id, eachCard: cardId })) continue;
      const index = rankIndex(rt.state.rankOrder, rt.state.cards[cardId].rank);
      if (!best || (pick === "lowest" ? index < best.index : index > best.index)) best = { player: player.id, index };
    }
  }
  return best?.player;
}

export function resolvePlayer(ref: PlayerRef | undefined, rt: Runtime, scope: Scope): string | undefined {
  const state = rt.state;
  const value = ref ?? "self";
  if (typeof value === "string") {
    switch (value) {
      case "self":
        return scope.each ?? scope.actor ?? scope.event?.playerId ?? state.currentPlayerId;
      case "actor":
        return scope.actor;
      case "eventPlayer":
        return scope.event?.playerId;
      case "current":
        return state.currentPlayerId;
      case "each":
        return scope.each;
      default:
        return undefined;
    }
  }
  if (!isObject(value)) return undefined;
  if ("seat" in value) return state.players.find((player) => player.seat === value.seat)?.id;
  if ("role" in value) {
    const holders = state.players.filter((player) => player.roles.includes(value.role));
    return (holders.find((player) => player.status === "active") ?? holders[0])?.id;
  }
  if ("var" in value) {
    const id = state.variables[value.var];
    return typeof id === "string" && rt.player(id) ? id : undefined;
  }
  if ("next" in value) return stepFrom(rt, resolvePlayer(value.next, rt, scope), 1, Boolean(value.includeSelf), value.where, scope);
  if ("previous" in value) return stepFrom(rt, resolvePlayer(value.previous, rt, scope), -1, false, value.where, scope);
  if ("lowestCard" in value) return extremeCardHolder(rt, value.lowestCard, scope, "lowest") ?? (value.fallback ? resolvePlayer(value.fallback, rt, scope) : undefined);
  if ("highestCard" in value) return extremeCardHolder(rt, value.highestCard, scope, "highest") ?? (value.fallback ? resolvePlayer(value.fallback, rt, scope) : undefined);
  return undefined;
}

export function resolvePlayers(ref: PlayerSetRef | undefined, rt: Runtime, scope: Scope): string[] {
  const sorted = [...rt.state.players].sort((a, b) => a.seat - b.seat);
  const value = ref ?? "active";
  if (value === "all") return sorted.map((player) => player.id);
  if (value === "active") return sorted.filter((player) => player.status === "active").map((player) => player.id);
  if (!isObject(value)) return [];
  let players: PlayerState[] = value.scope === "all" ? sorted : sorted.filter((player) => player.status === "active");
  if (value.roles?.length) players = players.filter((player) => player.roles.some((role) => value.roles!.includes(role)));
  if (value.excludeRoles?.length) players = players.filter((player) => !player.roles.some((role) => value.excludeRoles!.includes(role)));
  if (value.where) players = players.filter((player) => evaluateCondition(value.where!, rt, { ...scope, each: player.id }));
  if (value.startFrom) {
    const startId = resolvePlayer(value.startFrom, rt, scope);
    const startSeat = rt.player(startId)?.seat;
    if (startSeat !== undefined) {
      const count = sorted.length;
      players = [...players].sort((a, b) => ((a.seat - startSeat + count) % count) - ((b.seat - startSeat + count) % count));
    }
  }
  if (value.lastRoles?.length) {
    const isLast = (player: PlayerState) => player.roles.some((role) => value.lastRoles!.includes(role));
    players = [...players.filter((player) => !isLast(player)), ...players.filter(isLast)];
  }
  return players.map((player) => player.id);
}

/* -------------------------------------------------------------------- Zones */

/** All zone instances a reference names (several for `player: "all"`). */
export function resolveZoneKeys(ref: ZoneRef | undefined, rt: Runtime, scope: Scope): string[] {
  if (!ref || typeof ref.zone !== "string") return [];
  const definition = rt.zoneDefs.get(ref.zone);
  if (!definition) return [];
  if (definition.owner === "game") return rt.state.zones[ref.zone] ? [ref.zone] : [];
  if (ref.player === "all") return rt.state.players.map((player) => zoneKey(ref.zone, player.id)).filter((key) => rt.state.zones[key]);
  const owner = resolvePlayer(ref.player as PlayerRef | undefined, rt, scope);
  const key = owner ? zoneKey(ref.zone, owner) : undefined;
  return key && rt.state.zones[key] ? [key] : [];
}

export function resolveZoneKey(ref: ZoneRef | undefined, rt: Runtime, scope: Scope): string | undefined {
  return resolveZoneKeys(ref, rt, scope)[0];
}

export function cardsIn(rt: Runtime, keys: string[]): string[] {
  return keys.flatMap((key) => rt.state.zones[key]?.cards ?? []);
}

/** Zone ids of a kind (e.g. the hand zones), for defaults. */
export function zonesOfKind(rt: Runtime, kind: string): string[] {
  return rt.def.zones.filter((zone) => zone.kind === kind).map((zone) => zone.id);
}

/* -------------------------------------------------------------------- Cards */

export function resolveCard(ref: CardRef | undefined, rt: Runtime, scope: Scope): string | undefined {
  if (ref === "played") return scope.played ?? scope.event?.cardId;
  if (ref === "target") return scope.target ?? scope.event?.targetCardId;
  if (ref === "each") return scope.eachCard;
  if (!isObject(ref)) return undefined;
  if ("top" in ref) {
    const zone = rt.zone(resolveZoneKey(ref.top, rt, scope) ?? "");
    return zone?.cards[zone.cards.length - 1];
  }
  if ("bottom" in ref) return rt.zone(resolveZoneKey(ref.bottom, rt, scope) ?? "")?.cards[0];
  if ("var" in ref) {
    const id = rt.state.variables[ref.var];
    return typeof id === "string" && rt.state.cards[id] ? id : undefined;
  }
  return undefined;
}

/* ------------------------------------------------------------------- Values */

const toNumber = (value: Primitive) => (typeof value === "number" ? value : typeof value === "boolean" ? Number(value) : Number(value ?? 0) || 0);

export function handZones(rt: Runtime): string[] {
  const hands = zonesOfKind(rt, "hand");
  return hands.length ? hands : rt.def.zones.filter((zone) => zone.owner === "player").map((zone) => zone.id).slice(0, 1);
}

export function resolveValue(ref: ValueRef | undefined, rt: Runtime, scope: Scope): Primitive {
  if (ref === undefined) return null;
  if (ref === null || typeof ref !== "object") return ref;
  const state = rt.state;
  if ("const" in ref) return ref.const;
  if ("setting" in ref) return state.settings[ref.setting] ?? null;
  if ("var" in ref) return state.variables[ref.var] ?? null;
  if ("playerVar" in ref) return rt.player(resolvePlayer(ref.player, rt, scope))?.variables[ref.playerVar] ?? null;
  if ("score" in ref) return rt.player(resolvePlayer(ref.score, rt, scope))?.score ?? 0;
  if ("count" in ref) return cardsIn(rt, resolveZoneKeys(ref.count, rt, scope)).length;
  if ("countWhere" in ref) {
    return cardsIn(rt, resolveZoneKeys(ref.countWhere, rt, scope)).filter((cardId) => evaluateCondition(ref.where, rt, { ...scope, eachCard: cardId })).length;
  }
  if ("handSize" in ref) {
    const owner = resolvePlayer(ref.handSize, rt, scope);
    return owner ? cardsIn(rt, handZones(rt).map((zone) => zoneKey(zone, owner))).length : 0;
  }
  if ("cardRank" in ref) {
    const id = resolveCard(ref.cardRank, rt, scope);
    return id ? state.cards[id].rank : null;
  }
  if ("cardSuit" in ref) {
    const id = resolveCard(ref.cardSuit, rt, scope);
    return id ? state.cards[id].suit : null;
  }
  if ("rankValue" in ref) {
    const id = resolveCard(ref.rankValue, rt, scope);
    return id ? rankIndex(state.rankOrder, state.cards[id].rank) : null;
  }
  if ("player" in ref) return resolvePlayer(ref.player, rt, scope) ?? null;
  if ("builtin" in ref) {
    switch (ref.builtin) {
      case "round":
        return state.roundNumber;
      case "turn":
        return state.turnNumber;
      case "phase":
        return state.currentPhase;
      case "activePlayers":
        return rt.activePlayers().length;
      case "trumpSuit":
        return isSuit(state.variables.trumpSuit) ? state.variables.trumpSuit : null;
      default:
        return null;
    }
  }
  if ("playerCount" in ref) return resolvePlayers(ref.playerCount, rt, scope).length;
  if ("div" in ref) {
    const divisor = toNumber(resolveValue(ref.div[1], rt, scope));
    return divisor ? Math.floor(toNumber(resolveValue(ref.div[0], rt, scope)) / divisor) : 0;
  }
  if ("add" in ref) return ref.add.reduce<number>((sum, item) => sum + toNumber(resolveValue(item, rt, scope)), 0);
  if ("sub" in ref) return toNumber(resolveValue(ref.sub[0], rt, scope)) - toNumber(resolveValue(ref.sub[1], rt, scope));
  if ("min" in ref) return Math.min(...ref.min.map((item) => toNumber(resolveValue(item, rt, scope))));
  if ("max" in ref) return Math.max(...ref.max.map((item) => toNumber(resolveValue(item, rt, scope))));
  return null;
}

export function resolveNumber(ref: ValueRef | undefined, rt: Runtime, scope: Scope, fallback = 0): number {
  const value = resolveValue(ref, rt, scope);
  if (value === null || value === undefined) return fallback;
  const number = toNumber(value);
  return Number.isFinite(number) ? number : fallback;
}

export type CompareOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte";
export const COMPARE_OPS: CompareOp[] = ["eq", "neq", "gt", "gte", "lt", "lte"];

export function compareValues(left: Primitive, op: CompareOp, right: Primitive): boolean {
  if (op === "eq" || op === "neq") {
    const numeric = (typeof left === "number" && typeof right === "string") || (typeof left === "string" && typeof right === "number");
    const equal = numeric ? String(left) === String(right) : left === right;
    return op === "eq" ? equal : !equal;
  }
  const a = toNumber(left);
  const b = toNumber(right);
  if (op === "gt") return a > b;
  if (op === "gte") return a >= b;
  if (op === "lt") return a < b;
  return a <= b;
}
