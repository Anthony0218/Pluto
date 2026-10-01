/**
 * Plain-language descriptions of references, so the editor and the generated
 * rulebook can say "WHEN a card is played, IF its rank is on the table …".
 */
import { RANK_NAMES, SUIT_NAMES, isRank, isSuit } from "../cards/card.ts";
import { describeCondition } from "./conditions.ts";
import type { DescribeContext } from "./params.ts";
import type { CardRef, GameEventType, PlayerRef, PlayerSetRef, ValueRef, ZoneRef } from "./types.ts";

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export const EVENT_LABELS: Record<GameEventType, string> = {
  GAME_STARTED: "the game starts",
  ROUND_STARTED: "a round starts",
  TURN_STARTED: "a turn starts",
  PHASE_STARTED: "a phase starts",
  ACTION_ATTEMPTED: "a player tries an action",
  ACTION_COMPLETED: "a player completes an action",
  CARD_PLAY_ATTEMPT: "a player tries to play a card",
  CARD_PLAYED: "a card is played",
  CARD_DRAWN: "a card is drawn",
  CARD_REVEALED: "a card is revealed",
  PLAYER_PASSED: "a player passes",
  HAND_EMPTY: "a hand becomes empty",
  ZONE_EMPTY: "a zone becomes empty",
  DRAW_PILE_EMPTY: "the draw pile runs out",
  PHASE_ENDED: "a phase ends",
  TURN_ENDED: "a turn ends",
  ROUND_ENDED: "a round ends",
  GAME_ENDED: "the game ends",
};

export function zoneName(id: string, ctx: DescribeContext = {}) {
  return ctx.def?.zones.find((zone) => zone.id === id)?.name ?? id;
}

export function phaseName(id: string, ctx: DescribeContext = {}) {
  return ctx.def?.phases.find((phase) => phase.id === id)?.name ?? id;
}

export function settingLabel(key: string, ctx: DescribeContext = {}) {
  return ctx.def?.settings?.find((setting) => setting.key === key)?.label ?? key;
}

export function rankText(rank: unknown) {
  return isRank(rank) ? RANK_NAMES[rank] : String(rank);
}

export function suitText(suit: unknown) {
  return isSuit(suit) ? SUIT_NAMES[suit] : String(suit);
}

export function describePlayer(ref: PlayerRef | undefined, ctx: DescribeContext = {}): string {
  const value = ref ?? "self";
  if (typeof value === "string") {
    return { self: "the player", actor: "the acting player", eventPlayer: "that player", current: "the current player", each: "each player" }[value] ?? value;
  }
  if (!isObject(value)) return "a player";
  if ("seat" in value) return `the player in seat ${Number(value.seat) + 1}`;
  if ("role" in value) return `the ${value.role}`;
  if ("var" in value) return `the player stored in “${value.var}”`;
  if ("next" in value) {
    const where = value.where ? ` who matches “${describeCondition(value.where, ctx)}”` : "";
    return `the next active player${where} after ${describePlayer(value.next, ctx)}${value.includeSelf ? " (or that player, if still active)" : ""}`;
  }
  if ("previous" in value) return `the player before ${describePlayer(value.previous, ctx)}${value.where ? ` who matches “${describeCondition(value.where, ctx)}”` : ""}`;
  if ("lowestCard" in value || "highestCard" in value) {
    const spec = ("lowestCard" in value ? value.lowestCard : value.highestCard) as { zone: string; where?: unknown };
    const filter = spec.where ? ` matching “${describeCondition(spec.where as never, ctx)}”` : "";
    return `the player holding the ${"lowestCard" in value ? "lowest" : "highest"} card${filter} in their ${zoneName(spec.zone, ctx)}`;
  }
  return "a player";
}

export function describePlayers(ref: PlayerSetRef | undefined, ctx: DescribeContext = {}): string {
  const value = ref ?? "active";
  if (value === "all") return "every player";
  if (value === "active") return "every active player";
  if (!isObject(value)) return "players";
  const parts: string[] = [value.scope === "all" ? "every player" : "every active player"];
  if (value.roles?.length) parts.push(`with role ${value.roles.join(" or ")}`);
  if (value.excludeRoles?.length) parts.push(`except the ${value.excludeRoles.join(" and ")}`);
  if (value.where) parts.push(`where ${describeCondition(value.where, ctx)}`);
  if (value.startFrom) parts.push(`starting with ${describePlayer(value.startFrom, ctx)}`);
  if (value.lastRoles?.length) parts.push(`(the ${value.lastRoles.join(" and ")} last)`);
  return parts.join(" ");
}

export function describeZone(ref: ZoneRef | undefined, ctx: DescribeContext = {}): string {
  if (!ref) return "a zone";
  const owner = ctx.def?.zones.find((zone) => zone.id === ref.zone)?.owner;
  const name = zoneName(ref.zone, ctx);
  if (owner === "game") return `the ${name}`;
  if (ref.player === "all") return `every player's ${name}`;
  const who = describePlayer(ref.player as PlayerRef | undefined, ctx);
  return who === "the player" ? `their ${name}` : `${who}'s ${name}`;
}

export function describeCard(ref: CardRef | undefined, ctx: DescribeContext = {}): string {
  if (ref === "played") return "the played card";
  if (ref === "target") return "the target card";
  if (ref === "each") return "the card";
  if (!isObject(ref)) return "a card";
  if ("top" in ref) return `the top card of ${describeZone(ref.top, ctx)}`;
  if ("bottom" in ref) return `the bottom card of ${describeZone(ref.bottom, ctx)}`;
  if ("var" in ref) return `the card stored in “${ref.var}”`;
  return "a card";
}

export function describeValue(ref: ValueRef | undefined, ctx: DescribeContext = {}): string {
  if (ref === undefined || ref === null) return "nothing";
  if (typeof ref !== "object") return isRank(ref) ? rankText(ref) : isSuit(ref) ? suitText(ref) : String(ref);
  if ("const" in ref) return describeValue(ref.const, ctx);
  if ("setting" in ref) return `the “${settingLabel(ref.setting, ctx)}” setting`;
  if ("var" in ref) return `“${ref.var}”`;
  if ("playerVar" in ref) return `${describePlayer(ref.player, ctx)}'s “${ref.playerVar}”`;
  if ("score" in ref) return `${describePlayer(ref.score, ctx)}'s score`;
  if ("count" in ref) return `the number of cards in ${describeZone(ref.count, ctx)}`;
  if ("countWhere" in ref) return `the number of cards in ${describeZone(ref.countWhere, ctx)} where ${describeCondition(ref.where, ctx)}`;
  if ("handSize" in ref) return `${describePlayer(ref.handSize, ctx)}'s hand size`;
  if ("cardRank" in ref) return `the rank of ${describeCard(ref.cardRank, ctx)}`;
  if ("cardSuit" in ref) return `the suit of ${describeCard(ref.cardSuit, ctx)}`;
  if ("rankValue" in ref) return `the strength of ${describeCard(ref.rankValue, ctx)}`;
  if ("player" in ref) return describePlayer(ref.player, ctx);
  if ("builtin" in ref) return { round: "the round number", turn: "the turn number", phase: "the current phase", activePlayers: "the number of active players", trumpSuit: "the trump suit" }[ref.builtin] ?? ref.builtin;
  if ("playerCount" in ref) return `the number of players in “${describePlayers(ref.playerCount, ctx)}”`;
  if ("div" in ref) return `${describeValue(ref.div[0], ctx)} ÷ ${describeValue(ref.div[1], ctx)} (rounded down)`;
  if ("add" in ref) return ref.add.map((item) => describeValue(item, ctx)).join(" + ");
  if ("sub" in ref) return `${describeValue(ref.sub[0], ctx)} − ${describeValue(ref.sub[1], ctx)}`;
  if ("min" in ref) return `the smaller of ${ref.min.map((item) => describeValue(item, ctx)).join(" and ")}`;
  if ("max" in ref) return `the larger of ${ref.max.map((item) => describeValue(item, ctx)).join(" and ")}`;
  return "a value";
}

export const COMPARE_TEXT: Record<string, string> = { eq: "is", neq: "is not", gt: "is more than", gte: "is at least", lt: "is less than", lte: "is at most" };
