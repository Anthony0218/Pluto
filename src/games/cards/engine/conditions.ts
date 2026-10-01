/**
 * Composable, side-effect-free conditions.
 *
 * A condition is JSON: `{ type: "and", children }`, `{ type: "or", children }`,
 * `{ type: "not", child }` or a registered primitive such as
 * `{ type: "rankGreater", card: "played", other: "target" }`. Only registered
 * types run; there is no expression evaluation of user text.
 */
import { compareRanks, isSuit } from "../cards/card.ts";
import { COMPARE_TEXT, describeCard, describePlayer, describePlayers, describeValue, describeZone, phaseName, rankText, suitText, zoneName } from "./describe.ts";
import type { DescribeContext, ParamSpec } from "./params.ts";
import { cardsIn, compareValues, handZones, resolveCard, resolveNumber, resolvePlayer, resolvePlayers, resolveValue, resolveZoneKeys, zonesOfKind, type CompareOp } from "./refs.ts";
import { zoneKey, type Runtime, type Scope } from "./runtime.ts";
import type { CardRef, ConditionNode, PlayerRef, PlayerSetRef, ValueRef, ZoneRef } from "./types.ts";

export type ConditionCategory = "logic" | "card" | "player" | "game";

export interface ConditionType<P = Record<string, unknown>> {
  type: string;
  label: string;
  category: ConditionCategory;
  params: ParamSpec[];
  describe(params: P, ctx: DescribeContext): string;
  evaluate(params: P, rt: Runtime, scope: Scope): boolean;
}

// The registry holds differently-typed entries; each entry is typed where it is defined.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Map<string, ConditionType<any>>();

/**
 * Adds a primitive. Trusted code may register more (internal extensions); user
 * definitions can only reference what is registered.
 */
export function registerCondition<P>(definition: ConditionType<P>) {
  if (["and", "or", "not"].includes(definition.type)) throw new Error(`"${definition.type}" is reserved`);
  registry.set(definition.type, definition);
}

export function getConditionType(type: string): ConditionType | undefined {
  return registry.get(type);
}

export function listConditionTypes(): ConditionType[] {
  return [...registry.values()];
}

export const LOGIC_CONDITIONS = [
  { type: "and", label: "All of (AND)" },
  { type: "or", label: "Any of (OR)" },
  { type: "not", label: "Not" },
] as const;

/* --------------------------------------------------------------- Evaluation */

export function evaluateCondition(node: ConditionNode | undefined, rt: Runtime, scope: Scope): boolean {
  if (!node) return true;
  if (node.type === "and") return (node.children as ConditionNode[]).every((child) => evaluateCondition(child, rt, scope));
  if (node.type === "or") return (node.children as ConditionNode[]).some((child) => evaluateCondition(child, rt, scope));
  if (node.type === "not") return !evaluateCondition(node.child as ConditionNode, rt, scope);
  const definition = registry.get(node.type);
  if (!definition) return false;
  return definition.evaluate(node, rt, scope);
}

export function describeCondition(node: ConditionNode | undefined, ctx: DescribeContext = {}): string {
  if (!node) return "always";
  if (node.type === "and" || node.type === "or") {
    const children = node.children as ConditionNode[];
    if (!children.length) return node.type === "and" ? "always" : "never";
    const parts = children.map((child) => {
      const text = describeCondition(child, ctx);
      return child.type === "and" || child.type === "or" ? `(${text})` : text;
    });
    return parts.join(node.type === "and" ? " and " : " or ");
  }
  if (node.type === "not") {
    const child = node.child as ConditionNode;
    return `not (${describeCondition(child, ctx)})`;
  }
  const definition = registry.get(node.type);
  return definition ? definition.describe(node, ctx) : `unknown condition “${node.type}”`;
}

/* ----------------------------------------------------------------- Helpers */

const card = (rt: Runtime, scope: Scope, ref: CardRef) => {
  const id = resolveCard(ref, rt, scope);
  return id ? rt.state.cards[id] : undefined;
};
const trumpSuit = (rt: Runtime) => (isSuit(rt.state.variables.trumpSuit) ? rt.state.variables.trumpSuit : null);
const playerHandCount = (rt: Runtime, scope: Scope, player: PlayerRef | undefined, zone?: string) => {
  const owner = resolvePlayer(player, rt, scope);
  if (!owner) return 0;
  return cardsIn(rt, (zone ? [zone] : handZones(rt)).map((id) => zoneKey(id, owner))).length;
};
const opParam = (key = "op"): ParamSpec => ({ key, kind: "compareOp", label: "Comparison", default: "eq" });

/* --------------------------------------------------------------- Card ones */

registerCondition<{ card: CardRef; rank: string }>({
  type: "rankEquals",
  label: "Card rank equals",
  category: "card",
  params: [
    { key: "card", kind: "card", label: "Card", default: "played" },
    { key: "rank", kind: "rank", label: "Rank", default: "7" },
  ],
  describe: (p, ctx) => `${describeCard(p.card, ctx)} is a ${rankText(p.rank)}`,
  evaluate: (p, rt, scope) => card(rt, scope, p.card)?.rank === p.rank,
});

registerCondition<{ card: CardRef; ranks: string[] }>({
  type: "rankIn",
  label: "Card rank is one of",
  category: "card",
  params: [
    { key: "card", kind: "card", label: "Card", default: "played" },
    { key: "ranks", kind: "ranks", label: "Ranks", default: ["A"] },
  ],
  describe: (p, ctx) => `${describeCard(p.card, ctx)} is ${(p.ranks ?? []).map(rankText).join(" or ")}`,
  evaluate: (p, rt, scope) => {
    const rank = card(rt, scope, p.card)?.rank;
    return Boolean(rank && (p.ranks ?? []).includes(rank));
  },
});

registerCondition<{ card: CardRef; suit: string }>({
  type: "suitEquals",
  label: "Card suit equals",
  category: "card",
  params: [
    { key: "card", kind: "card", label: "Card", default: "played" },
    { key: "suit", kind: "suit", label: "Suit", default: "hearts" },
  ],
  describe: (p, ctx) => `${describeCard(p.card, ctx)} is ${suitText(p.suit)}`,
  evaluate: (p, rt, scope) => card(rt, scope, p.card)?.suit === p.suit,
});

registerCondition<{ card: CardRef; other: CardRef }>({
  type: "rankGreater",
  label: "Card rank is higher than another card",
  category: "card",
  params: [
    { key: "card", kind: "card", label: "Card", default: "played" },
    { key: "other", kind: "card", label: "Other card", default: "target" },
  ],
  describe: (p, ctx) => `${describeCard(p.card, ctx)} ranks higher than ${describeCard(p.other, ctx)}`,
  evaluate: (p, rt, scope) => {
    const a = card(rt, scope, p.card);
    const b = card(rt, scope, p.other);
    return Boolean(a && b && compareRanks(rt.state.rankOrder, a.rank, b.rank) > 0);
  },
});

registerCondition<{ card: CardRef; other: CardRef }>({
  type: "rankLess",
  label: "Card rank is lower than another card",
  category: "card",
  params: [
    { key: "card", kind: "card", label: "Card", default: "played" },
    { key: "other", kind: "card", label: "Other card", default: "target" },
  ],
  describe: (p, ctx) => `${describeCard(p.card, ctx)} ranks lower than ${describeCard(p.other, ctx)}`,
  evaluate: (p, rt, scope) => {
    const a = card(rt, scope, p.card);
    const b = card(rt, scope, p.other);
    return Boolean(a && b && compareRanks(rt.state.rankOrder, a.rank, b.rank) < 0);
  },
});

registerCondition<{ card: CardRef; other: CardRef }>({
  type: "sameRank",
  label: "Cards have the same rank",
  category: "card",
  params: [
    { key: "card", kind: "card", label: "Card", default: "played" },
    { key: "other", kind: "card", label: "Other card", default: "target" },
  ],
  describe: (p, ctx) => `${describeCard(p.card, ctx)} has the same rank as ${describeCard(p.other, ctx)}`,
  evaluate: (p, rt, scope) => {
    const a = card(rt, scope, p.card);
    const b = card(rt, scope, p.other);
    return Boolean(a && b && a.rank === b.rank);
  },
});

registerCondition<{ card: CardRef; other: CardRef }>({
  type: "sameSuit",
  label: "Cards have the same suit",
  category: "card",
  params: [
    { key: "card", kind: "card", label: "Card", default: "played" },
    { key: "other", kind: "card", label: "Other card", default: "target" },
  ],
  describe: (p, ctx) => `${describeCard(p.card, ctx)} has the same suit as ${describeCard(p.other, ctx)}`,
  evaluate: (p, rt, scope) => {
    const a = card(rt, scope, p.card);
    const b = card(rt, scope, p.other);
    return Boolean(a && b && a.suit === b.suit);
  },
});

registerCondition<{ card: CardRef }>({
  type: "isTrump",
  label: "Card is a trump",
  category: "card",
  params: [{ key: "card", kind: "card", label: "Card", default: "played" }],
  describe: (p, ctx) => `${describeCard(p.card, ctx)} is a trump`,
  evaluate: (p, rt, scope) => {
    const trump = trumpSuit(rt);
    return Boolean(trump && card(rt, scope, p.card)?.suit === trump);
  },
});

registerCondition<{ card: CardRef; zone: ZoneRef }>({
  type: "cardInZone",
  label: "Card is in zone",
  category: "card",
  params: [
    { key: "card", kind: "card", label: "Card", default: "played" },
    { key: "zone", kind: "zone", label: "Zone" },
  ],
  describe: (p, ctx) => `${describeCard(p.card, ctx)} is in ${describeZone(p.zone, ctx)}`,
  evaluate: (p, rt, scope) => {
    const id = resolveCard(p.card, rt, scope);
    return Boolean(id && cardsIn(rt, resolveZoneKeys(p.zone, rt, scope)).includes(id));
  },
});

registerCondition<{ card: CardRef; zones: string[] }>({
  type: "rankOnTable",
  label: "Card's rank is already on the table",
  category: "card",
  params: [
    { key: "card", kind: "card", label: "Card", default: "played" },
    { key: "zones", kind: "zoneIds", label: "Table zones" },
  ],
  describe: (p, ctx) => `the rank of ${describeCard(p.card, ctx)} is already in ${(p.zones ?? []).map((id) => zoneName(id, ctx)).join(" or ")}`,
  evaluate: (p, rt, scope) => {
    const id = resolveCard(p.card, rt, scope);
    if (!id) return false;
    const rank = rt.state.cards[id].rank;
    const keys = (p.zones ?? []).flatMap((zone) => resolveZoneKeys({ zone, player: "all" }, rt, scope));
    return cardsIn(rt, keys).some((other) => other !== id && rt.state.cards[other].rank === rank);
  },
});

registerCondition<{ card: CardRef; mark: string }>({
  type: "cardMarked",
  label: "Card has a mark",
  category: "card",
  params: [
    { key: "card", kind: "card", label: "Card", default: "target" },
    { key: "mark", kind: "mark", label: "Mark", default: "covered" },
  ],
  describe: (p, ctx) => `${describeCard(p.card, ctx)} is marked “${p.mark}”`,
  evaluate: (p, rt, scope) => {
    const id = resolveCard(p.card, rt, scope);
    return Boolean(id && rt.state.marks[id]?.[p.mark]);
  },
});

/* ------------------------------------------------------------- Player ones */

registerCondition<{ player?: PlayerRef; zone?: string; value: ValueRef }>({
  type: "handSizeEquals",
  label: "Hand size equals",
  category: "player",
  params: [
    { key: "player", kind: "player", label: "Player", default: "self" },
    { key: "zone", kind: "zoneId", label: "Hand zone", optional: true },
    { key: "value", kind: "value", label: "Cards", default: 0 },
  ],
  describe: (p, ctx) => `${describePlayer(p.player, ctx)} has exactly ${describeValue(p.value, ctx)} cards${p.zone ? ` in their ${zoneName(p.zone, ctx)}` : " in hand"}`,
  evaluate: (p, rt, scope) => playerHandCount(rt, scope, p.player, p.zone) === resolveNumber(p.value, rt, scope),
});

registerCondition<{ player?: PlayerRef; zone?: string; value: ValueRef }>({
  type: "handSizeLess",
  label: "Hand size is less than",
  category: "player",
  params: [
    { key: "player", kind: "player", label: "Player", default: "self" },
    { key: "zone", kind: "zoneId", label: "Hand zone", optional: true },
    { key: "value", kind: "value", label: "Cards", default: 6 },
  ],
  describe: (p, ctx) => `${describePlayer(p.player, ctx)} has fewer than ${describeValue(p.value, ctx)} cards${p.zone ? ` in their ${zoneName(p.zone, ctx)}` : " in hand"}`,
  evaluate: (p, rt, scope) => playerHandCount(rt, scope, p.player, p.zone) < resolveNumber(p.value, rt, scope),
});

registerCondition<{ player?: PlayerRef }>({
  type: "isCurrentPlayer",
  label: "Player is the current player",
  category: "player",
  params: [{ key: "player", kind: "player", label: "Player", default: "self" }],
  describe: (p, ctx) => `${describePlayer(p.player, ctx)} is the current player`,
  evaluate: (p, rt, scope) => {
    const id = resolvePlayer(p.player, rt, scope);
    return Boolean(id && id === rt.state.currentPlayerId);
  },
});

registerCondition<{ player?: PlayerRef; role: string }>({
  type: "hasRole",
  label: "Player has role",
  category: "player",
  params: [
    { key: "player", kind: "player", label: "Player", default: "self" },
    { key: "role", kind: "role", label: "Role" },
  ],
  describe: (p, ctx) => `${describePlayer(p.player, ctx)} is the ${p.role}`,
  evaluate: (p, rt, scope) => Boolean(rt.player(resolvePlayer(p.player, rt, scope))?.roles.includes(p.role)),
});

registerCondition<{ player?: PlayerRef; zones?: string[] }>({
  type: "hasNoCards",
  label: "Player has no cards",
  category: "player",
  params: [
    { key: "player", kind: "player", label: "Player", default: "self" },
    { key: "zones", kind: "zoneIds", label: "Zones counted", optional: true, help: "Defaults to the hand." },
  ],
  describe: (p, ctx) => `${describePlayer(p.player, ctx)} has no cards${p.zones?.length ? ` in ${p.zones.map((id) => zoneName(id, ctx)).join(" or ")}` : " in hand"}`,
  evaluate: (p, rt, scope) => {
    const owner = resolvePlayer(p.player, rt, scope);
    if (!owner) return false;
    return cardsIn(rt, (p.zones?.length ? p.zones : handZones(rt)).map((zone) => zoneKey(zone, owner))).length === 0;
  },
});

registerCondition<{ player?: PlayerRef; zone?: string; where: ConditionNode }>({
  type: "hasMatchingCard",
  label: "Player has a matching card",
  category: "player",
  params: [
    { key: "player", kind: "player", label: "Player", default: "self" },
    { key: "zone", kind: "zoneId", label: "Zone", optional: true },
    { key: "where", kind: "condition", label: "Card matches" },
  ],
  describe: (p, ctx) => `${describePlayer(p.player, ctx)} holds a card where ${describeCondition(p.where, ctx)}`,
  evaluate: (p, rt, scope) => {
    const owner = resolvePlayer(p.player, rt, scope);
    if (!owner) return false;
    const cards = cardsIn(rt, (p.zone ? [p.zone] : handZones(rt)).map((zone) => zoneKey(zone, owner)));
    return cards.some((cardId) => evaluateCondition(p.where, rt, { ...scope, eachCard: cardId }));
  },
});

registerCondition<{ player?: PlayerRef }>({
  type: "playerPassed",
  label: "Player has passed",
  category: "player",
  params: [{ key: "player", kind: "player", label: "Player", default: "self" }],
  describe: (p, ctx) => `${describePlayer(p.player, ctx)} has passed`,
  evaluate: (p, rt, scope) => Boolean(rt.player(resolvePlayer(p.player, rt, scope))?.passed),
});

registerCondition<{ player?: PlayerRef }>({
  type: "playerIsActive",
  label: "Player is still playing",
  category: "player",
  params: [{ key: "player", kind: "player", label: "Player", default: "self" }],
  describe: (p, ctx) => `${describePlayer(p.player, ctx)} is still playing`,
  evaluate: (p, rt, scope) => rt.player(resolvePlayer(p.player, rt, scope))?.status === "active",
});

/* --------------------------------------------------------------- Game ones */

registerCondition<Record<string, never>>({
  type: "drawPileEmpty",
  label: "Draw pile is empty",
  category: "game",
  params: [],
  describe: () => "the draw pile is empty",
  evaluate: (_p, rt) => zonesOfKind(rt, "drawPile").every((id) => cardsIn(rt, Object.keys(rt.state.zones).filter((key) => rt.state.zones[key].definitionId === id)).length === 0),
});

registerCondition<{ zone: ZoneRef }>({
  type: "zoneEmpty",
  label: "Zone is empty",
  category: "game",
  params: [{ key: "zone", kind: "zone", label: "Zone" }],
  describe: (p, ctx) => `${describeZone(p.zone, ctx)} is empty`,
  evaluate: (p, rt, scope) => cardsIn(rt, resolveZoneKeys(p.zone, rt, scope)).length === 0,
});

registerCondition<{ zone: ZoneRef; op: CompareOp; value: ValueRef }>({
  type: "zoneCount",
  label: "Number of cards in zone",
  category: "game",
  params: [{ key: "zone", kind: "zone", label: "Zone" }, opParam(), { key: "value", kind: "value", label: "Cards", default: 1 }],
  describe: (p, ctx) => `the number of cards in ${describeZone(p.zone, ctx)} ${COMPARE_TEXT[p.op] ?? p.op} ${describeValue(p.value, ctx)}`,
  evaluate: (p, rt, scope) => compareValues(cardsIn(rt, resolveZoneKeys(p.zone, rt, scope)).length, p.op, resolveValue(p.value, rt, scope)),
});

registerCondition<{ phase: string }>({
  type: "phaseEquals",
  label: "Current phase is",
  category: "game",
  params: [{ key: "phase", kind: "phase", label: "Phase" }],
  describe: (p, ctx) => `the phase is ${phaseName(p.phase, ctx)}`,
  evaluate: (p, rt) => rt.state.currentPhase === p.phase,
});

registerCondition<{ op: CompareOp; value: ValueRef }>({
  type: "roundNumber",
  label: "Round number",
  category: "game",
  params: [opParam(), { key: "value", kind: "value", label: "Round", default: 1 }],
  describe: (p, ctx) => `the round number ${COMPARE_TEXT[p.op] ?? p.op} ${describeValue(p.value, ctx)}`,
  evaluate: (p, rt, scope) => compareValues(rt.state.roundNumber, p.op, resolveValue(p.value, rt, scope)),
});

registerCondition<{ op: CompareOp; value: ValueRef }>({
  type: "turnNumber",
  label: "Turn number",
  category: "game",
  params: [opParam(), { key: "value", kind: "value", label: "Turn", default: 1 }],
  describe: (p, ctx) => `the turn number ${COMPARE_TEXT[p.op] ?? p.op} ${describeValue(p.value, ctx)}`,
  evaluate: (p, rt, scope) => compareValues(rt.state.turnNumber, p.op, resolveValue(p.value, rt, scope)),
});

registerCondition<{ players?: PlayerSetRef }>({
  type: "allPassed",
  label: "All players have passed",
  category: "game",
  params: [{ key: "players", kind: "players", label: "Players", default: "active" }],
  describe: (p, ctx) => `${describePlayers(p.players, ctx)} has passed`,
  evaluate: (p, rt, scope) => resolvePlayers(p.players, rt, scope).every((id) => rt.player(id)?.passed),
});

registerCondition<{ op: CompareOp; value: ValueRef }>({
  type: "activePlayerCount",
  label: "Number of active players",
  category: "game",
  params: [opParam(), { key: "value", kind: "value", label: "Players", default: 1 }],
  describe: (p, ctx) => `the number of active players ${COMPARE_TEXT[p.op] ?? p.op} ${describeValue(p.value, ctx)}`,
  evaluate: (p, rt, scope) => compareValues(rt.activePlayers().length, p.op, resolveValue(p.value, rt, scope)),
});

registerCondition<{ zone: string }>({
  type: "eventZoneIs",
  label: "The event happened in zone",
  category: "game",
  params: [{ key: "zone", kind: "zoneId", label: "Zone" }],
  describe: (p, ctx) => `it happened in the ${zoneName(p.zone, ctx)}`,
  evaluate: (p, _rt, scope) => scope.event?.zone === p.zone,
});

registerCondition<{ left: ValueRef; op: CompareOp; right: ValueRef }>({
  type: "compare",
  label: "Compare two values",
  category: "game",
  params: [
    { key: "left", kind: "value", label: "Value", default: { setting: "" } },
    opParam(),
    { key: "right", kind: "value", label: "Compared with", default: true },
  ],
  describe: (p, ctx) => `${describeValue(p.left, ctx)} ${COMPARE_TEXT[p.op] ?? p.op} ${describeValue(p.right, ctx)}`,
  evaluate: (p, rt, scope) => compareValues(resolveValue(p.left, rt, scope), p.op, resolveValue(p.right, rt, scope)),
});

/* ------------------------------------------------------------- Quantifiers */

registerCondition<{ players?: PlayerSetRef; condition: ConditionNode }>({
  type: "forAllPlayers",
  label: "Every player matches",
  category: "player",
  params: [
    { key: "players", kind: "players", label: "Players", default: "active" },
    { key: "condition", kind: "condition", label: "Each player" },
  ],
  describe: (p, ctx) => `for ${describePlayers(p.players, ctx)}: ${describeCondition(p.condition, ctx)}`,
  evaluate: (p, rt, scope) => resolvePlayers(p.players, rt, scope).every((id) => evaluateCondition(p.condition, rt, { ...scope, each: id })),
});

registerCondition<{ players?: PlayerSetRef; condition: ConditionNode }>({
  type: "forAnyPlayer",
  label: "Some player matches",
  category: "player",
  params: [
    { key: "players", kind: "players", label: "Players", default: "active" },
    { key: "condition", kind: "condition", label: "That player" },
  ],
  describe: (p, ctx) => `for at least one of ${describePlayers(p.players, ctx)}: ${describeCondition(p.condition, ctx)}`,
  evaluate: (p, rt, scope) => resolvePlayers(p.players, rt, scope).some((id) => evaluateCondition(p.condition, rt, { ...scope, each: id })),
});

registerCondition<{ zone: ZoneRef; condition: ConditionNode }>({
  type: "forAnyCard",
  label: "Some card in a zone matches",
  category: "card",
  params: [
    { key: "zone", kind: "zone", label: "Zone" },
    { key: "condition", kind: "condition", label: "That card" },
  ],
  describe: (p, ctx) => `some card in ${describeZone(p.zone, ctx)} matches: ${describeCondition(p.condition, ctx)}`,
  evaluate: (p, rt, scope) => cardsIn(rt, resolveZoneKeys(p.zone, rt, scope)).some((cardId) => evaluateCondition(p.condition, rt, { ...scope, eachCard: cardId })),
});

