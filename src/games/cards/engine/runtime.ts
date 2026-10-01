/**
 * The mutable working copy of one engine step. Every state change made by an
 * effect goes through these methods, so events (ZONE_EMPTY, CARD_REVEALED, …)
 * are emitted consistently no matter which effect moved a card.
 */
import { cardLabel } from "../cards/card.ts";
import type { GameDefinition, GameEvent, GameEventType, GameState, LogEntry, PlayerState, Primitive, ZoneDefinition, ZoneState } from "./types.ts";

/** Hard limits per action. They stop runaway rule chains from user-made games. */
export const ENGINE_LIMITS = {
  /** A rule's effects may cause events, whose rules cause events, … this deep. */
  maxEventDepth: 24,
  /** Rule firings + effect executions in one action (including automatic phases). */
  maxExecutions: 4000,
  /** Phase changes in one action. */
  maxPhaseChanges: 120,
  maxLogEntries: 300,
};

export class EngineLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineLimitError";
  }
}

/** Bindings visible to conditions, values and effects. */
export interface Scope {
  actor?: string;
  /** Player being iterated (forEachPlayer, forAllPlayers, player-set filters, lowestCard). */
  each?: string;
  /** Card being iterated (countWhere, forAnyCard, card filters). */
  eachCard?: string;
  played?: string;
  target?: string;
  event?: GameEvent;
}

export const zoneKey = (zoneId: string, owner?: string) => (owner ? `${zoneId}:${owner}` : zoneId);

export class Runtime {
  readonly def: GameDefinition;
  readonly state: GameState;
  readonly queue: GameEvent[] = [];
  readonly emitted: GameEvent[] = [];
  executions = 0;
  /** Depth of the event whose rules are currently running (-1 outside rules). */
  depth = -1;
  rejected?: string;
  pendingPhase?: string;
  endRequest?: { winners: string[]; losers: string[]; draw: boolean; reason: string };
  readonly zoneDefs: Map<string, ZoneDefinition>;

  constructor(def: GameDefinition, state: GameState) {
    this.def = def;
    this.state = state;
    this.zoneDefs = new Map(def.zones.map((zone) => [zone.id, zone]));
  }

  /* ------------------------------------------------------------ Budget */

  tick(what: string) {
    this.executions++;
    if (this.executions > ENGINE_LIMITS.maxExecutions) {
      throw new EngineLimitError(`Rule execution limit reached (${ENGINE_LIMITS.maxExecutions}) while running ${what}. The game's rules probably trigger each other endlessly.`);
    }
  }

  /* ------------------------------------------------------------ Events */

  emit(event: Omit<GameEvent, "depth">) {
    const full: GameEvent = { ...event, depth: this.depth + 1 };
    if (full.depth > ENGINE_LIMITS.maxEventDepth) {
      throw new EngineLimitError(`Rule chain deeper than ${ENGINE_LIMITS.maxEventDepth} events (last: ${event.type}). A rule probably triggers itself.`);
    }
    this.queue.push(full);
    this.emitted.push(full);
  }

  log(kind: "event" | "rule" | "action" | "info", text: string, extra: { event?: GameEventType; ruleId?: string; playerId?: string } = {}) {
    const state = this.state;
    state.logSeq += 1;
    const entry: LogEntry = { seq: state.logSeq, kind, text };
    if (extra.event) entry.event = extra.event;
    if (extra.ruleId) entry.ruleId = extra.ruleId;
    if (extra.playerId) entry.playerId = extra.playerId;
    state.log.push(entry);
    if (state.log.length > ENGINE_LIMITS.maxLogEntries) state.log.splice(0, state.log.length - ENGINE_LIMITS.maxLogEntries);
  }

  /* ----------------------------------------------------------- Players */

  player(id: string | undefined): PlayerState | undefined {
    return id ? this.state.players.find((player) => player.id === id) : undefined;
  }

  playerName(id: string | undefined) {
    return this.player(id)?.name ?? "nobody";
  }

  activePlayers(): PlayerState[] {
    return this.state.players.filter((player) => player.status === "active");
  }

  /* ------------------------------------------------------------- Zones */

  zone(key: string): ZoneState | undefined {
    return this.state.zones[key];
  }

  zoneDef(key: string): ZoneDefinition | undefined {
    const zone = this.state.zones[key];
    return zone ? this.zoneDefs.get(zone.definitionId) : undefined;
  }

  findCardZone(cardId: string): string | undefined {
    for (const [key, zone] of Object.entries(this.state.zones)) if (zone.cards.includes(cardId)) return key;
    return undefined;
  }

  cardText(cardId: string | undefined) {
    const card = cardId ? this.state.cards[cardId] : undefined;
    return card ? cardLabel(card) : "a card";
  }

  zoneText(key: string) {
    const zone = this.state.zones[key];
    if (!zone) return key;
    const name = this.zoneDefs.get(zone.definitionId)?.name ?? zone.definitionId;
    return zone.owner ? `${this.playerName(zone.owner)}'s ${name}` : name;
  }

  /**
   * Moves one card. Marks are cleared (they describe the card's place on the
   * table); `faceUp` is set when given, otherwise reset.
   */
  moveCard(cardId: string, toKey: string, options: { position?: "top" | "bottom"; faceUp?: boolean; playerId?: string; drawn?: boolean } = {}) {
    const fromKey = this.findCardZone(cardId);
    const to = this.state.zones[toKey];
    if (!fromKey || !to) return false;
    const from = this.state.zones[fromKey];
    from.cards.splice(from.cards.indexOf(cardId), 1);
    if (options.position === "bottom") to.cards.unshift(cardId);
    else to.cards.push(cardId);
    delete this.state.marks[cardId];
    const wasUp = Boolean(this.state.faceUp[cardId]);
    if (options.faceUp) this.state.faceUp[cardId] = true;
    else delete this.state.faceUp[cardId];

    if (options.drawn) this.emit({ type: "CARD_DRAWN", playerId: options.playerId ?? to.owner, cardId, zone: to.definitionId, zoneOwner: to.owner });
    if (options.faceUp && !wasUp) this.emit({ type: "CARD_REVEALED", playerId: options.playerId ?? to.owner, cardId, zone: to.definitionId, zoneOwner: to.owner });
    if (from.cards.length === 0 && fromKey !== toKey) this.emitEmpty(fromKey);
    return true;
  }

  emitEmpty(key: string) {
    const zone = this.state.zones[key];
    const definition = this.zoneDefs.get(zone.definitionId);
    const base = { zone: zone.definitionId, zoneOwner: zone.owner, playerId: zone.owner };
    this.emit({ type: "ZONE_EMPTY", ...base });
    if (definition?.kind === "hand" && zone.owner) this.emit({ type: "HAND_EMPTY", ...base });
    if (definition?.kind === "drawPile") this.emit({ type: "DRAW_PILE_EMPTY", ...base });
  }

  setVariable(key: string, value: Primitive) {
    this.state.variables[key] = value;
  }
}
