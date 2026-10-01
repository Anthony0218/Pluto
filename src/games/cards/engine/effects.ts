/**
 * Reusable effects. Effects never touch state directly from outside the
 * engine: they receive the step's `Runtime`, whose methods emit the matching
 * events (moving the last card out of a zone emits ZONE_EMPTY, and so on).
 */
import { cardLabel, isSuit, type Suit } from "../cards/card.ts";
import { bestCombination, compareScores, type CombinationResult } from "./combinations.ts";
import { evaluateCondition, describeCondition } from "./conditions.ts";
import { describeCard, describePlayer, describePlayers, describeValue, describeZone, phaseName, suitText, zoneName } from "./describe.ts";
import type { DescribeContext, ParamSpec } from "./params.ts";
import { shuffleInPlace } from "./rng.ts";
import { cardsIn, resolveCard, resolveNumber, resolvePlayer, resolvePlayers, resolveValue, resolveZoneKey, resolveZoneKeys, zonesOfKind } from "./refs.ts";
import { zoneKey, type Runtime, type Scope } from "./runtime.ts";
import type { CardRef, ConditionNode, EffectDefinition, GameEventType, PlayerRef, PlayerSetRef, Primitive, ValueRef, ZoneRef } from "./types.ts";

export type EffectCategory = "cards" | "players" | "flow" | "values" | "logic";

export interface EffectType<P = Record<string, unknown>> {
  type: string;
  label: string;
  category: EffectCategory;
  params: ParamSpec[];
  /** Events this effect may emit, for static loop detection. */
  emits: GameEventType[];
  describe(params: P, ctx: DescribeContext): string;
  execute(params: P, rt: Runtime, scope: Scope): void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Map<string, EffectType<any>>();

export function registerEffect<P>(definition: EffectType<P>) {
  registry.set(definition.type, definition);
}

export function getEffectType(type: string): EffectType | undefined {
  return registry.get(type);
}

export function listEffectTypes(): EffectType[] {
  return [...registry.values()];
}

export function runEffects(effects: EffectDefinition[] | undefined, rt: Runtime, scope: Scope) {
  for (const effect of effects ?? []) {
    rt.tick(`effect “${effect.type}”`);
    const definition = registry.get(effect.type);
    if (!definition) {
      rt.log("info", `Skipped unknown effect “${effect.type}”.`);
      continue;
    }
    definition.execute(effect, rt, scope);
    if (rt.state.status === "finished" || rt.endRequest) return;
  }
}

export function describeEffect(effect: EffectDefinition, ctx: DescribeContext = {}): string {
  const definition = registry.get(effect.type);
  return definition ? definition.describe(effect, ctx) : `unknown effect “${effect.type}”`;
}

export function describeEffects(effects: EffectDefinition[] | undefined, ctx: DescribeContext = {}): string {
  if (!effects?.length) return "nothing happens";
  return effects.map((effect) => describeEffect(effect, ctx)).join(", then ");
}

/** Events an effect list may emit, including nested branches. */
export function effectEmits(effects: EffectDefinition[] | undefined): Set<GameEventType> {
  const out = new Set<GameEventType>();
  for (const effect of effects ?? []) {
    for (const event of registry.get(effect.type)?.emits ?? []) out.add(event);
    for (const nested of [effect.then, effect.else, effect.effects]) {
      if (Array.isArray(nested)) for (const event of effectEmits(nested as EffectDefinition[])) out.add(event);
    }
  }
  return out;
}

/* ----------------------------------------------------------------- Helpers */

const MOVE_EVENTS: GameEventType[] = ["ZONE_EMPTY", "HAND_EMPTY", "DRAW_PILE_EMPTY", "CARD_REVEALED"];
const DRAW_EVENTS: GameEventType[] = [...MOVE_EVENTS, "CARD_DRAWN"];
const positionParam: ParamSpec = { key: "position", kind: "position", label: "Put it on", optional: true, default: "top" };
const faceUpParam: ParamSpec = { key: "faceUp", kind: "boolean", label: "Face up", optional: true, default: false };

function defaultZone(rt: Runtime, kind: string): string | undefined {
  return zonesOfKind(rt, kind)[0];
}

/** Draws from the top of `fromKey` into a player's zone. Returns the number drawn. */
function drawInto(rt: Runtime, fromKey: string | undefined, toKey: string | undefined, count: number, playerId?: string) {
  if (!fromKey || !toKey) return 0;
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    const from = rt.zone(fromKey);
    const cardId = from?.cards[from.cards.length - 1];
    if (!cardId) break;
    rt.moveCard(cardId, toKey, { playerId, drawn: true });
    drawn++;
  }
  return drawn;
}

function playerTargets(rt: Runtime, scope: Scope, params: { player?: PlayerRef; players?: PlayerSetRef }) {
  if (params.players !== undefined) return resolvePlayers(params.players, rt, scope);
  const one = resolvePlayer(params.player, rt, scope);
  return one ? [one] : [];
}

/* ------------------------------------------------------------------- Cards */

registerEffect<{ card: CardRef; to: ZoneRef; position?: "top" | "bottom"; faceUp?: boolean }>({
  type: "moveCard",
  label: "Move a card",
  category: "cards",
  params: [{ key: "card", kind: "card", label: "Card", default: "played" }, { key: "to", kind: "zone", label: "To" }, positionParam, faceUpParam],
  emits: MOVE_EVENTS,
  describe: (p, ctx) => `move ${describeCard(p.card, ctx)} to ${p.position === "bottom" ? "the bottom of " : ""}${describeZone(p.to, ctx)}${p.faceUp ? " face up" : ""}`,
  execute: (p, rt, scope) => {
    const cardId = resolveCard(p.card, rt, scope);
    const to = resolveZoneKey(p.to, rt, scope);
    if (cardId && to) rt.moveCard(cardId, to, { position: p.position, faceUp: p.faceUp });
  },
});

registerEffect<{ from: ZoneRef; to: ZoneRef; count?: ValueRef; position?: "top" | "bottom"; faceUp?: boolean }>({
  type: "moveCards",
  label: "Move several cards",
  category: "cards",
  params: [
    { key: "from", kind: "zone", label: "From" },
    { key: "to", kind: "zone", label: "To" },
    { key: "count", kind: "value", label: "How many (empty = all)", optional: true },
    positionParam,
    faceUpParam,
  ],
  emits: MOVE_EVENTS,
  describe: (p, ctx) => `move ${p.count === undefined ? "all cards" : `${describeValue(p.count, ctx)} cards`} from ${describeZone(p.from, ctx)} to ${p.position === "bottom" ? "the bottom of " : ""}${describeZone(p.to, ctx)}${p.faceUp ? " face up" : ""}`,
  execute: (p, rt, scope) => {
    const to = resolveZoneKey(p.to, rt, scope);
    if (!to) return;
    for (const fromKey of resolveZoneKeys(p.from, rt, scope)) {
      if (fromKey === to) continue;
      const from = rt.zone(fromKey)!;
      const limit = p.count === undefined ? from.cards.length : Math.max(0, Math.floor(resolveNumber(p.count, rt, scope)));
      // Top cards first; order is preserved when they land.
      const cards = from.cards.slice(Math.max(0, from.cards.length - limit));
      const ordered = p.position === "bottom" ? [...cards].reverse() : cards;
      for (const cardId of ordered) rt.moveCard(cardId, to, { position: p.position, faceUp: p.faceUp });
    }
  },
});

registerEffect<{ player?: PlayerRef; from?: ZoneRef; to?: string }>({
  type: "drawCard",
  label: "Draw a card",
  category: "cards",
  params: [
    { key: "player", kind: "player", label: "Player", default: "self" },
    { key: "from", kind: "zone", label: "From", optional: true },
    { key: "to", kind: "zoneId", label: "Into", optional: true },
  ],
  emits: DRAW_EVENTS,
  describe: (p, ctx) => `${describePlayer(p.player, ctx)} draws a card${p.from ? ` from ${describeZone(p.from, ctx)}` : ""}`,
  execute: (p, rt, scope) => {
    const player = resolvePlayer(p.player, rt, scope);
    const toZone = p.to ?? defaultZone(rt, "hand");
    const from = p.from ? resolveZoneKey(p.from, rt, scope) : defaultZone(rt, "drawPile");
    if (player && toZone) drawInto(rt, from, zoneKey(toZone, player), 1, player);
  },
});

registerEffect<{ player?: PlayerRef; count: ValueRef; from?: ZoneRef; to?: string }>({
  type: "drawCards",
  label: "Draw cards",
  category: "cards",
  params: [
    { key: "player", kind: "player", label: "Player", default: "self" },
    { key: "count", kind: "value", label: "How many", default: 1 },
    { key: "from", kind: "zone", label: "From", optional: true },
    { key: "to", kind: "zoneId", label: "Into", optional: true },
  ],
  emits: DRAW_EVENTS,
  describe: (p, ctx) => `${describePlayer(p.player, ctx)} draws ${describeValue(p.count, ctx)} cards`,
  execute: (p, rt, scope) => {
    const player = resolvePlayer(p.player, rt, scope);
    const toZone = p.to ?? defaultZone(rt, "hand");
    const from = p.from ? resolveZoneKey(p.from, rt, scope) : defaultZone(rt, "drawPile");
    if (player && toZone) drawInto(rt, from, zoneKey(toZone, player), Math.max(0, resolveNumber(p.count, rt, scope)), player);
  },
});

registerEffect<{ players?: PlayerSetRef; size: ValueRef; from?: ZoneRef; to?: string }>({
  type: "drawUntilHandSize",
  label: "Refill hands",
  category: "cards",
  params: [
    { key: "players", kind: "players", label: "Players, in order", default: "active" },
    { key: "size", kind: "value", label: "Hand size", default: 6 },
    { key: "from", kind: "zone", label: "From", optional: true },
    { key: "to", kind: "zoneId", label: "Into", optional: true },
  ],
  emits: DRAW_EVENTS,
  describe: (p, ctx) => `${describePlayers(p.players, ctx)} draws up to ${describeValue(p.size, ctx)} cards${p.from ? ` from ${describeZone(p.from, ctx)}` : ""}`,
  execute: (p, rt, scope) => {
    const toZone = p.to ?? defaultZone(rt, "hand");
    const from = p.from ? resolveZoneKey(p.from, rt, scope) : defaultZone(rt, "drawPile");
    if (!toZone) return;
    const size = resolveNumber(p.size, rt, scope);
    for (const player of resolvePlayers(p.players, rt, scope)) {
      const key = zoneKey(toZone, player);
      const missing = size - (rt.zone(key)?.cards.length ?? 0);
      if (missing > 0) drawInto(rt, from, key, missing, player);
    }
  },
});

registerEffect<{ from: ZoneRef; to: string; count: ValueRef; players?: PlayerSetRef; faceUp?: boolean }>({
  type: "deal",
  label: "Deal cards",
  category: "cards",
  params: [
    { key: "from", kind: "zone", label: "From" },
    { key: "to", kind: "zoneId", label: "Into each player's" },
    { key: "count", kind: "value", label: "Cards each (“all” = deal everything evenly)", default: 6 },
    { key: "players", kind: "players", label: "Players", optional: true, default: "active" },
    faceUpParam,
  ],
  emits: DRAW_EVENTS,
  describe: (p, ctx) =>
    p.count === "all" ? `deal all cards from ${describeZone(p.from, ctx)} evenly into each player's ${zoneName(p.to, ctx)}` : `deal ${describeValue(p.count, ctx)} cards to each player's ${zoneName(p.to, ctx)}`,
  execute: (p, rt, scope) => {
    const fromKey = resolveZoneKey(p.from, rt, scope);
    const players = resolvePlayers(p.players, rt, scope);
    if (!fromKey || !players.length) return;
    const available = rt.zone(fromKey)!.cards.length;
    const each = p.count === "all" ? Math.floor(available / players.length) : Math.max(0, Math.floor(resolveNumber(p.count, rt, scope)));
    // One card at a time around the table, like a real deal.
    for (let round = 0; round < each; round++) {
      for (const player of players) {
        const from = rt.zone(fromKey)!;
        const cardId = from.cards[from.cards.length - 1];
        if (!cardId) return;
        rt.moveCard(cardId, zoneKey(p.to, player), { faceUp: p.faceUp, playerId: player });
      }
    }
  },
});

registerEffect<{ card: CardRef }>({
  type: "revealCard",
  label: "Reveal a card",
  category: "cards",
  params: [{ key: "card", kind: "card", label: "Card", default: "played" }],
  emits: ["CARD_REVEALED"],
  describe: (p, ctx) => `reveal ${describeCard(p.card, ctx)}`,
  execute: (p, rt, scope) => {
    const cardId = resolveCard(p.card, rt, scope);
    if (!cardId || rt.state.faceUp[cardId]) return;
    rt.state.faceUp[cardId] = true;
    const zoneKeyOf = rt.findCardZone(cardId);
    const zone = zoneKeyOf ? rt.zone(zoneKeyOf) : undefined;
    rt.emit({ type: "CARD_REVEALED", cardId, zone: zone?.definitionId, zoneOwner: zone?.owner, playerId: zone?.owner });
    rt.log("event", `${cardLabel(rt.state.cards[cardId])} is revealed.`, { event: "CARD_REVEALED" });
  },
});

registerEffect<{ card: CardRef }>({
  type: "hideCard",
  label: "Turn a card face down",
  category: "cards",
  params: [{ key: "card", kind: "card", label: "Card", default: "played" }],
  emits: [],
  describe: (p, ctx) => `turn ${describeCard(p.card, ctx)} face down`,
  execute: (p, rt, scope) => {
    const cardId = resolveCard(p.card, rt, scope);
    if (cardId) delete rt.state.faceUp[cardId];
  },
});

registerEffect<{ zone: ZoneRef }>({
  type: "shuffleZone",
  label: "Shuffle a zone",
  category: "cards",
  params: [{ key: "zone", kind: "zone", label: "Zone" }],
  emits: [],
  describe: (p, ctx) => `shuffle ${describeZone(p.zone, ctx)}`,
  execute: (p, rt, scope) => {
    for (const key of resolveZoneKeys(p.zone, rt, scope)) shuffleInPlace(rt.state.rng, rt.zone(key)!.cards);
  },
});

registerEffect<{ from: ZoneRef; to?: ZoneRef }>({
  type: "discardCards",
  label: "Discard cards",
  category: "cards",
  params: [
    { key: "from", kind: "zone", label: "From" },
    { key: "to", kind: "zone", label: "Discard pile", optional: true },
  ],
  emits: MOVE_EVENTS,
  describe: (p, ctx) => `discard all cards from ${describeZone(p.from, ctx)}${p.to ? ` to ${describeZone(p.to, ctx)}` : ""}`,
  execute: (p, rt, scope) => {
    const to = p.to ? resolveZoneKey(p.to, rt, scope) : defaultZone(rt, "discard");
    if (!to) return;
    for (const fromKey of resolveZoneKeys(p.from, rt, scope)) for (const cardId of [...rt.zone(fromKey)!.cards]) rt.moveCard(cardId, to);
  },
});

registerEffect<{ from: ZoneRef[]; player?: PlayerRef; to: string; position?: "top" | "bottom"; shuffle?: ValueRef }>({
  type: "awardCards",
  label: "Give cards to a player",
  category: "cards",
  params: [
    { key: "from", kind: "zone", label: "From zones" },
    { key: "player", kind: "player", label: "Winner", default: "self" },
    { key: "to", kind: "zoneId", label: "Into their" },
    positionParam,
    { key: "shuffle", kind: "value", label: "Shuffle the won cards first", optional: true, default: false },
  ],
  emits: MOVE_EVENTS,
  describe: (p, ctx) => `${describePlayer(p.player, ctx)} collects all cards from ${(Array.isArray(p.from) ? p.from : [p.from]).map((zone) => describeZone(zone, ctx)).join(" and ")} into the ${p.position === "bottom" ? "bottom of their " : "their "}${zoneName(p.to, ctx)}`,
  execute: (p, rt, scope) => {
    const player = resolvePlayer(p.player, rt, scope);
    if (!player) return;
    const toKey = zoneKey(p.to, player);
    const sources = (Array.isArray(p.from) ? p.from : [p.from]).flatMap((zone) => resolveZoneKeys(zone, rt, scope));
    // Collect in a deterministic order: zone by zone, bottom to top.
    const won = sources.flatMap((key) => [...(rt.zone(key)?.cards ?? [])]);
    if (p.shuffle !== undefined && resolveValue(p.shuffle, rt, scope) === true) shuffleInPlace(rt.state.rng, won);
    const ordered = p.position === "bottom" ? [...won].reverse() : won;
    for (const cardId of ordered) rt.moveCard(cardId, toKey, { position: p.position, playerId: player });
    if (won.length) rt.log("info", `${rt.playerName(player)} collects ${won.length} card${won.length === 1 ? "" : "s"}.`, { playerId: player });
  },
});

registerEffect<{ card: CardRef; mark: string; value?: Primitive }>({
  type: "markCard",
  label: "Mark a card",
  category: "cards",
  params: [
    { key: "card", kind: "card", label: "Card", default: "target" },
    { key: "mark", kind: "mark", label: "Mark", default: "covered" },
    { key: "value", kind: "value", label: "Value", optional: true, default: true },
  ],
  emits: [],
  describe: (p, ctx) => `mark ${describeCard(p.card, ctx)} as “${p.mark}”`,
  execute: (p, rt, scope) => {
    const cardId = resolveCard(p.card, rt, scope);
    if (!cardId) return;
    const value = p.value === undefined ? true : resolveValue(p.value as ValueRef, rt, scope);
    rt.state.marks[cardId] = { ...rt.state.marks[cardId], [p.mark]: value };
  },
});

registerEffect<{ card?: CardRef; suit?: string }>({
  type: "setTrumpSuit",
  label: "Set the trump suit",
  category: "cards",
  params: [
    { key: "card", kind: "card", label: "From card", optional: true },
    { key: "suit", kind: "suit", label: "Or a fixed suit", optional: true },
  ],
  emits: [],
  describe: (p, ctx) => (p.card ? `the suit of ${describeCard(p.card, ctx)} becomes trump` : `${suitText(p.suit)} become trump`),
  execute: (p, rt, scope) => {
    let suit: Suit | null = null;
    if (p.card) {
      const cardId = resolveCard(p.card, rt, scope);
      if (cardId) suit = rt.state.cards[cardId].suit;
    } else if (isSuit(p.suit)) suit = p.suit;
    rt.setVariable("trumpSuit", suit);
    if (suit) rt.log("info", `Trump suit: ${suitText(suit)}.`);
  },
});

/* ----------------------------------------------------------------- Players */

registerEffect<{ player: PlayerRef }>({
  type: "setCurrentPlayer",
  label: "Set the current player",
  category: "players",
  params: [{ key: "player", kind: "player", label: "Player", default: "self" }],
  emits: [],
  describe: (p, ctx) => `${describePlayer(p.player, ctx)} becomes the current player`,
  execute: (p, rt, scope) => {
    const player = resolvePlayer(p.player, rt, scope);
    if (player) rt.state.currentPlayerId = player;
  },
});

const skipParam: ParamSpec = { key: "where", kind: "condition", label: "Only players who", optional: true, help: "Skip players that do not match (e.g. folded players)." };

registerEffect<{ where?: ConditionNode }>({
  type: "nextPlayer",
  label: "Move to the next player",
  category: "players",
  params: [skipParam],
  emits: [],
  describe: (p, ctx) => `the next active player${p.where ? ` who matches “${describeCondition(p.where, ctx)}”` : ""} becomes the current player`,
  execute: (p, rt, scope) => {
    const next = resolvePlayer({ next: "current", where: p.where }, rt, scope);
    if (next) rt.state.currentPlayerId = next;
  },
});

registerEffect<{ where?: ConditionNode }>({
  type: "endTurn",
  label: "End the turn",
  category: "flow",
  params: [skipParam],
  emits: ["TURN_ENDED", "TURN_STARTED"],
  describe: (p, ctx) => `the turn ends and passes to the next active player${p.where ? ` who matches “${describeCondition(p.where, ctx)}”` : ""}`,
  execute: (p, rt, scope) => {
    rt.emit({ type: "TURN_ENDED", playerId: rt.state.currentPlayerId });
    const next = resolvePlayer({ next: "current", where: p.where }, rt, scope);
    if (next) rt.state.currentPlayerId = next;
    rt.state.turnNumber += 1;
    rt.emit({ type: "TURN_STARTED", playerId: rt.state.currentPlayerId });
  },
});

registerEffect<{ role: string; player?: PlayerRef; players?: PlayerSetRef; exclusive?: boolean }>({
  type: "assignRole",
  label: "Give a role",
  category: "players",
  params: [
    { key: "role", kind: "role", label: "Role" },
    { key: "player", kind: "player", label: "Player", optional: true, default: "self" },
    { key: "players", kind: "players", label: "Or several players", optional: true },
    { key: "exclusive", kind: "boolean", label: "Take it from everyone else first", optional: true, default: true },
  ],
  emits: [],
  describe: (p, ctx) => `${p.players !== undefined ? describePlayers(p.players, ctx) : describePlayer(p.player, ctx)} becomes ${p.exclusive === false ? "a" : "the"} ${p.role}`,
  execute: (p, rt, scope) => {
    const targets = playerTargets(rt, scope, p);
    if (p.exclusive !== false) for (const player of rt.state.players) player.roles = player.roles.filter((role) => role !== p.role);
    for (const id of targets) {
      const player = rt.player(id);
      if (player && !player.roles.includes(p.role)) player.roles.push(p.role);
    }
  },
});

registerEffect<{ role: string; player?: PlayerRef; players?: PlayerSetRef }>({
  type: "removeRole",
  label: "Remove a role",
  category: "players",
  params: [
    { key: "role", kind: "role", label: "Role" },
    { key: "player", kind: "player", label: "From one player", optional: true },
    { key: "players", kind: "players", label: "From players", optional: true, default: "all" },
  ],
  emits: [],
  describe: (p, ctx) => `${p.player !== undefined ? describePlayer(p.player, ctx) : describePlayers(p.players ?? "all", ctx)} loses the ${p.role} role`,
  execute: (p, rt, scope) => {
    const targets = p.player !== undefined ? playerTargets(rt, scope, { player: p.player }) : resolvePlayers(p.players ?? "all", rt, scope);
    for (const id of targets) {
      const player = rt.player(id);
      if (player) player.roles = player.roles.filter((role) => role !== p.role);
    }
  },
});

registerEffect<{ players?: PlayerSetRef }>({
  type: "resetPasses",
  label: "Clear passes",
  category: "players",
  params: [{ key: "players", kind: "players", label: "Players", optional: true, default: "all" }],
  emits: [],
  describe: (p, ctx) => `${describePlayers(p.players ?? "all", ctx)} may act again (passes are cleared)`,
  execute: (p, rt, scope) => {
    for (const id of resolvePlayers(p.players ?? "all", rt, scope)) {
      const player = rt.player(id);
      if (player) player.passed = false;
    }
  },
});

registerEffect<{ player?: PlayerRef; var: string; amount: ValueRef }>({
  type: "incrementPlayerVariable",
  label: "Add to a player variable",
  category: "values",
  params: [
    { key: "player", kind: "player", label: "Player", default: "self" },
    { key: "var", kind: "playerVariable", label: "Variable" },
    { key: "amount", kind: "value", label: "Amount", default: 1 },
  ],
  emits: [],
  describe: (p, ctx) => `add ${describeValue(p.amount, ctx)} to ${describePlayer(p.player, ctx)}'s “${p.var}”`,
  execute: (p, rt, scope) => {
    const player = rt.player(resolvePlayer(p.player, rt, scope));
    if (player) player.variables[p.var] = (Number(player.variables[p.var] ?? 0) || 0) + resolveNumber(p.amount, rt, scope);
  },
});

registerEffect<{ player?: PlayerRef; amount: ValueRef }>({
  type: "incrementScore",
  label: "Add to score",
  category: "players",
  params: [
    { key: "player", kind: "player", label: "Player", default: "self" },
    { key: "amount", kind: "value", label: "Points", default: 1 },
  ],
  emits: [],
  describe: (p, ctx) => `${describePlayer(p.player, ctx)} scores ${describeValue(p.amount, ctx)}`,
  execute: (p, rt, scope) => {
    const player = rt.player(resolvePlayer(p.player, rt, scope));
    const amount = resolveNumber(p.amount, rt, scope);
    if (player && amount) {
      player.score += amount;
      rt.log("info", `${player.name}: ${amount > 0 ? "+" : "−"}${Math.abs(amount)} ${(rt.def.scoreLabel ?? "points").toLowerCase()} (now ${player.score}).`, { playerId: player.id });
    }
  },
});

registerEffect<{ player?: PlayerRef }>({
  type: "markPlayerFinished",
  label: "Player finishes",
  category: "players",
  params: [{ key: "player", kind: "player", label: "Player", default: "self" }],
  emits: [],
  describe: (p, ctx) => `${describePlayer(p.player, ctx)} finishes (leaves the game safely)`,
  execute: (p, rt, scope) => {
    const player = rt.player(resolvePlayer(p.player, rt, scope));
    if (!player || player.status !== "active") return;
    player.status = "finished";
    player.finishPlace = rt.state.players.filter((other) => other.finishPlace).length + 1;
    rt.log("info", `${player.name} is out of cards and finishes in place ${player.finishPlace}.`, { playerId: player.id });
  },
});

registerEffect<{ player?: PlayerRef }>({
  type: "eliminatePlayer",
  label: "Eliminate player",
  category: "players",
  params: [{ key: "player", kind: "player", label: "Player", default: "self" }],
  emits: [],
  describe: (p, ctx) => `${describePlayer(p.player, ctx)} is eliminated`,
  execute: (p, rt, scope) => {
    const player = rt.player(resolvePlayer(p.player, rt, scope));
    if (!player || player.status !== "active") return;
    player.status = "eliminated";
    rt.log("info", `${player.name} is eliminated.`, { playerId: player.id });
  },
});

registerEffect<{ player?: PlayerRef; value?: boolean }>({
  type: "setPassed",
  label: "Mark a player as done",
  category: "players",
  params: [
    { key: "player", kind: "player", label: "Player", default: "self" },
    { key: "value", kind: "boolean", label: "Done (passed)", optional: true, default: true },
  ],
  emits: ["PLAYER_PASSED"],
  describe: (p, ctx) => (p.value === false ? `${describePlayer(p.player, ctx)} may act again` : `${describePlayer(p.player, ctx)} is done for now (counts as passed)`),
  execute: (p, rt, scope) => {
    const player = rt.player(resolvePlayer(p.player, rt, scope));
    if (!player) return;
    const done = p.value !== false;
    if (done && !player.passed) rt.emit({ type: "PLAYER_PASSED", playerId: player.id });
    player.passed = done;
  },
});

registerEffect<{ zone: ZoneRef }>({
  type: "revealZone",
  label: "Reveal every card in a zone",
  category: "cards",
  params: [{ key: "zone", kind: "zone", label: "Zone" }],
  emits: ["CARD_REVEALED"],
  describe: (p, ctx) => `reveal every card in ${describeZone(p.zone, ctx)}`,
  execute: (p, rt, scope) => {
    for (const key of resolveZoneKeys(p.zone, rt, scope)) {
      const zone = rt.zone(key)!;
      for (const cardId of zone.cards) {
        if (rt.state.faceUp[cardId]) continue;
        rt.state.faceUp[cardId] = true;
        rt.emit({ type: "CARD_REVEALED", cardId, zone: zone.definitionId, zoneOwner: zone.owner, playerId: zone.owner });
      }
    }
  },
});

registerEffect<{ players?: PlayerSetRef; zones: ZoneRef[]; size?: ValueRef; role: string; nameVar?: string }>({
  type: "rankHands",
  label: "Find the best hand",
  category: "cards",
  params: [
    { key: "players", kind: "players", label: "Players", default: "active" },
    { key: "zones", kind: "zone", label: "Cards from (use “each player” for own zones)", default: [{ zone: "hand", player: "each" }] },
    { key: "size", kind: "value", label: "Best hand of", optional: true, default: 5 },
    { key: "role", kind: "role", label: "Winners get role", default: "winner" },
    { key: "nameVar", kind: "playerVariable", label: "Store hand name in", optional: true },
  ],
  emits: [],
  describe: (p, ctx) =>
    `compare the best ${p.size === undefined ? 5 : describeValue(p.size, ctx)}-card combination of ${describePlayers(p.players, ctx)} (from ${(Array.isArray(p.zones) ? p.zones : [p.zones]).map((zone) => describeZone(zone, ctx)).join(" + ")}); the best become “${p.role}”`,
  execute: (p, rt, scope) => {
    const combinations = rt.def.combinations ?? [];
    const order = rt.state.rankOrder.filter((rank) => rt.def.deck.ranks.includes(rank));
    const size = p.size === undefined ? 5 : resolveNumber(p.size, rt, scope, 5);
    const results: { player: string; result: CombinationResult }[] = [];
    for (const player of resolvePlayers(p.players, rt, scope)) {
      const inner = { ...scope, each: player };
      const cards = (Array.isArray(p.zones) ? p.zones : [p.zones]).flatMap((zone) => cardsIn(rt, resolveZoneKeys(zone, rt, inner))).map((id) => rt.state.cards[id]);
      const result = bestCombination(cards, combinations, order, size);
      if (!result) continue;
      results.push({ player, result });
      if (p.nameVar) rt.player(player)!.variables[p.nameVar] = result.name;
      rt.log("info", `${rt.playerName(player)} shows ${result.name}: ${result.cards.map((id) => cardLabel(rt.state.cards[id])).join(" ")}.`, { playerId: player });
    }
    for (const player of rt.state.players) player.roles = player.roles.filter((role) => role !== p.role);
    if (!results.length) return;
    const best = results.reduce((top, entry) => (compareScores(entry.result.score, top.result.score) > 0 ? entry : top)).result.score;
    for (const entry of results) if (compareScores(entry.result.score, best) === 0) rt.player(entry.player)!.roles.push(p.role);
  },
});

/* ------------------------------------------------------------------ Values */

registerEffect<{ var: string; value: ValueRef }>({
  type: "setVariable",
  label: "Set a variable",
  category: "values",
  params: [
    { key: "var", kind: "variable", label: "Variable" },
    { key: "value", kind: "value", label: "Value", default: 0 },
  ],
  emits: [],
  describe: (p, ctx) => `set “${p.var}” to ${describeValue(p.value, ctx)}`,
  execute: (p, rt, scope) => rt.setVariable(p.var, resolveValue(p.value, rt, scope)),
});

registerEffect<{ var: string; amount: ValueRef }>({
  type: "incrementVariable",
  label: "Add to a variable",
  category: "values",
  params: [
    { key: "var", kind: "variable", label: "Variable" },
    { key: "amount", kind: "value", label: "Amount", default: 1 },
  ],
  emits: [],
  describe: (p, ctx) => `add ${describeValue(p.amount, ctx)} to “${p.var}”`,
  execute: (p, rt, scope) => {
    const current = Number(rt.state.variables[p.var] ?? 0) || 0;
    rt.setVariable(p.var, current + resolveNumber(p.amount, rt, scope));
  },
});

registerEffect<{ player?: PlayerRef; var: string; value: ValueRef }>({
  type: "setPlayerVariable",
  label: "Set a player variable",
  category: "values",
  params: [
    { key: "player", kind: "player", label: "Player", default: "self" },
    { key: "var", kind: "playerVariable", label: "Variable" },
    { key: "value", kind: "value", label: "Value", default: true },
  ],
  emits: [],
  describe: (p, ctx) => `set ${describePlayer(p.player, ctx)}'s “${p.var}” to ${describeValue(p.value, ctx)}`,
  execute: (p, rt, scope) => {
    const player = rt.player(resolvePlayer(p.player, rt, scope));
    if (player) player.variables[p.var] = resolveValue(p.value, rt, scope);
  },
});

/* -------------------------------------------------------------------- Flow */

registerEffect<{ phase: string }>({
  type: "startPhase",
  label: "Go to phase",
  category: "flow",
  params: [{ key: "phase", kind: "phase", label: "Phase" }],
  emits: ["PHASE_ENDED", "PHASE_STARTED"],
  describe: (p, ctx) => `go to the ${phaseName(p.phase, ctx)} phase`,
  execute: (p, rt) => {
    rt.pendingPhase = p.phase;
  },
});

registerEffect<{ to?: string }>({
  type: "endPhase",
  label: "End the phase",
  category: "flow",
  params: [{ key: "to", kind: "phase", label: "Next phase (empty = the next one in the list)", optional: true }],
  emits: ["PHASE_ENDED", "PHASE_STARTED"],
  describe: (p, ctx) => (p.to ? `end the phase and go to ${phaseName(p.to, ctx)}` : "end the phase"),
  execute: (p, rt) => {
    if (p.to) {
      rt.pendingPhase = p.to;
      return;
    }
    const phases = rt.def.phases;
    const index = phases.findIndex((phase) => phase.id === rt.state.currentPhase);
    rt.pendingPhase = phases[(index + 1) % phases.length]?.id;
  },
});

registerEffect<Record<string, never>>({
  type: "startRound",
  label: "Start a new round",
  category: "flow",
  params: [],
  emits: ["ROUND_STARTED"],
  describe: () => "a new round starts",
  execute: (_p, rt) => {
    rt.state.roundNumber += 1;
    rt.emit({ type: "ROUND_STARTED" });
  },
});

registerEffect<Record<string, never>>({
  type: "endRound",
  label: "End the round",
  category: "flow",
  params: [],
  emits: ["ROUND_ENDED"],
  describe: () => "the round ends",
  execute: (_p, rt) => rt.emit({ type: "ROUND_ENDED" }),
});

registerEffect<{ winners?: PlayerSetRef; losers?: PlayerSetRef; draw?: boolean; reason?: string }>({
  type: "endGame",
  label: "End the game",
  category: "flow",
  params: [
    { key: "winners", kind: "players", label: "Winners", optional: true },
    { key: "losers", kind: "players", label: "Losers", optional: true },
    { key: "draw", kind: "boolean", label: "It is a draw", optional: true },
    { key: "reason", kind: "text", label: "Reason", optional: true },
  ],
  emits: ["GAME_ENDED"],
  describe: (p, ctx) => (p.draw ? "the game ends in a draw" : `the game ends${p.winners ? ` — ${describePlayers(p.winners, ctx)} wins` : ""}${p.losers ? ` — ${describePlayers(p.losers, ctx)} loses` : ""}`),
  execute: (p, rt, scope) => {
    rt.endRequest = {
      winners: p.winners ? resolvePlayers(p.winners, rt, scope) : [],
      losers: p.losers ? resolvePlayers(p.losers, rt, scope) : [],
      draw: Boolean(p.draw),
      reason: p.reason || "A rule ended the game.",
    };
  },
});

registerEffect<{ reason: string }>({
  type: "rejectAction",
  label: "Reject the attempted action",
  category: "flow",
  params: [{ key: "reason", kind: "text", label: "Message to the player", default: "That move is not allowed." }],
  emits: [],
  describe: (p) => `reject the action (“${p.reason}”)`,
  execute: (p, rt) => {
    rt.rejected = p.reason || "That move is not allowed.";
  },
});

/* ------------------------------------------------------------------- Logic */

registerEffect<{ condition: ConditionNode; then: EffectDefinition[]; else?: EffectDefinition[] }>({
  type: "if",
  label: "If … then … otherwise",
  category: "logic",
  params: [
    { key: "condition", kind: "condition", label: "If" },
    { key: "then", kind: "effects", label: "Then" },
    { key: "else", kind: "effects", label: "Otherwise", optional: true },
  ],
  emits: [],
  describe: (p, ctx) => `if ${describeCondition(p.condition, ctx)}: ${describeEffects(p.then, ctx)}${p.else?.length ? `; otherwise ${describeEffects(p.else, ctx)}` : ""}`,
  execute: (p, rt, scope) => runEffects(evaluateCondition(p.condition, rt, scope) ? p.then : p.else, rt, scope),
});

registerEffect<{ players?: PlayerSetRef; effects: EffectDefinition[] }>({
  type: "forEachPlayer",
  label: "For each player",
  category: "logic",
  params: [
    { key: "players", kind: "players", label: "Players", optional: true, default: "active" },
    { key: "effects", kind: "effects", label: "Do" },
  ],
  emits: [],
  describe: (p, ctx) => `for ${describePlayers(p.players, ctx)}: ${describeEffects(p.effects, ctx)}`,
  execute: (p, rt, scope) => {
    for (const id of resolvePlayers(p.players, rt, scope)) {
      runEffects(p.effects, rt, { ...scope, each: id });
      if (rt.endRequest) return;
    }
  },
});
