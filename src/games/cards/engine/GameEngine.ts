/**
 * The authoritative game loop:
 *
 *   action → validation → state change → emitted events → triggered rules →
 *   effects → more events → end-condition check → phase transitions → …
 *
 * Pure functions over JSON: `performAction` never mutates its input and
 * returns a new state, so the same code runs in the browser (preview/test
 * mode) and on the server (edge function).
 */
import { cardLabel, generateDeck } from "../cards/card.ts";
import { actionOptions, actorAllowed, currentPhase, getAvailableActions, playersWhoCanAct } from "./actions.ts";
import { runEffects } from "./effects.ts";
import { checkEndConditions } from "./endConditions.ts";
import { enterPhase, nextTransition } from "./phases.ts";
import { resolvePlayer, resolveZoneKey } from "./refs.ts";
import { createRng, shuffleInPlace } from "./rng.ts";
import { drainEvents } from "./rules.ts";
import { ENGINE_LIMITS, EngineLimitError, Runtime, zoneKey } from "./runtime.ts";
import {
  ACTION_TYPE_SHAPE,
  type ActionRequest,
  type ActionResult,
  type GameDefinition,
  type GameResult,
  type GameState,
  type PlayerState,
  type Primitive,
  type SettingValue,
} from "./types.ts";

export interface SeatInput {
  id: string;
  name: string;
  isBot?: boolean;
}

export interface CreateGameOptions {
  players: SeatInput[];
  settings?: Record<string, unknown>;
  /** Required: all randomness derives from it. Tests pin it; live games pass a random one. */
  seed: number;
  gameVersionId?: string;
}

export class GameSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameSetupError";
  }
}

/* ----------------------------------------------------------------- Settings */

/** Lobby values clamped to the definition (unknown keys are dropped). */
export function resolveSettings(def: GameDefinition, overrides: Record<string, unknown> = {}): Record<string, SettingValue> {
  const out: Record<string, SettingValue> = {};
  for (const setting of def.settings ?? []) {
    const raw = overrides[setting.key];
    switch (setting.type) {
      case "integer": {
        const value = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : setting.default;
        out[setting.key] = Math.min(setting.max, Math.max(setting.min, value));
        break;
      }
      case "boolean":
        out[setting.key] = typeof raw === "boolean" ? raw : setting.default;
        break;
      case "select":
        out[setting.key] = typeof raw === "string" && setting.options.some((option) => option.value === raw) ? raw : setting.default;
        break;
      case "string":
        out[setting.key] = typeof raw === "string" ? raw.slice(0, setting.maxLength ?? 120) : setting.default;
        break;
    }
  }
  return out;
}

/* ------------------------------------------------------------------- Create */

export function createGame(def: GameDefinition, options: CreateGameOptions): GameState {
  const count = options.players.length;
  if (count < def.players.min || count > def.players.max) {
    throw new GameSetupError(`${def.name} needs ${def.players.min === def.players.max ? def.players.min : `${def.players.min}–${def.players.max}`} players (got ${count}).`);
  }
  if (new Set(options.players.map((player) => player.id)).size !== count) throw new GameSetupError("Player ids must be unique.");
  if (!def.zones.some((zone) => zone.id === def.setup.deckZone && zone.owner === "game")) throw new GameSetupError(`The deck zone “${def.setup.deckZone}” must be a game zone.`);
  if (!def.phases.some((phase) => phase.id === def.setup.firstPhase)) throw new GameSetupError(`The first phase “${def.setup.firstPhase}” does not exist.`);

  const players: PlayerState[] = options.players.map((seat, index) => ({
    id: seat.id,
    name: seat.name,
    seat: index,
    ...(seat.isBot ? { isBot: true } : {}),
    status: "active",
    score: 0,
    roles: [],
    passed: false,
    variables: Object.fromEntries((def.playerVariables ?? []).map((variable) => [variable.key, variable.initial])),
  }));
  const zones: GameState["zones"] = {};
  for (const zone of def.zones) {
    if (zone.owner === "game") zones[zone.id] = { cards: [], definitionId: zone.id };
    else for (const player of players) zones[zoneKey(zone.id, player.id)] = { cards: [], definitionId: zone.id, owner: player.id };
  }
  const deck = generateDeck(def.deck);
  const variables: Record<string, Primitive> = { trumpSuit: null };
  for (const variable of def.variables ?? []) variables[variable.key] = variable.initial;

  const state: GameState = {
    gameId: def.id,
    gameVersionId: options.gameVersionId ?? `${def.id}@draft`,
    players,
    zones,
    cards: Object.fromEntries(deck.map((card) => [card.id, card])),
    faceUp: {},
    marks: {},
    currentPhase: "",
    turnNumber: 1,
    roundNumber: 1,
    variables,
    settings: resolveSettings(def, options.settings),
    status: "playing",
    rng: createRng(options.seed),
    revision: 0,
    log: [],
    logSeq: 0,
    rankOrder: [...def.deck.rankOrder],
  };
  state.zones[def.setup.deckZone].cards = deck.map((card) => card.id);
  if (def.setup.shuffle) shuffleInPlace(state.rng, state.zones[def.setup.deckZone].cards);

  const rt = new Runtime(def, state);
  try {
    rt.log("info", `${def.name} begins with ${players.map((player) => player.name).join(", ")}.`);
    runEffects(def.setup.steps, rt, {});
    const first = state.currentPlayerId ?? resolvePlayer(def.setup.startingPlayer ?? { seat: 0 }, rt, {});
    if (first) state.currentPlayerId = first;
    rt.emit({ type: "GAME_STARTED" });
    enterPhase(rt, def.setup.firstPhase);
    settle(rt);
  } catch (error) {
    if (error instanceof EngineLimitError) throw new GameSetupError(error.message);
    throw error;
  }
  return state;
}

/* ------------------------------------------------------------------ Actions */

export interface PerformOptions {
  /** Reject the request when the state moved on since the client looked. */
  expectedRevision?: number;
}

export function performAction(def: GameDefinition, state: GameState, playerId: string, request: ActionRequest, options: PerformOptions = {}): ActionResult {
  const fail = (error: string): ActionResult => ({ ok: false, state, error });
  if (state.status !== "playing") return fail("The game is not running.");
  if (options.expectedRevision !== undefined && options.expectedRevision !== state.revision) return fail("The game has moved on — refresh and try again.");

  const phase = currentPhase(def, state);
  const action = def.actions.find((entry) => entry.id === request?.actionId);
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) return fail("You are not a player in this game.");
  if (!action) return fail("Unknown action.");
  if (!phase || phase.automatic || !phase.allowedActions.includes(action.id)) return fail(`“${action.label}” is not possible during this phase.`);
  if (!actorAllowed(state, action, phase, player)) return fail(player.status !== "active" ? "You are no longer playing." : `It is not your turn to ${action.label.toLowerCase()}.`);

  const draft = structuredClone(state);
  const rt = new Runtime(def, draft);
  const shape = ACTION_TYPE_SHAPE[action.type];
  const cardId = shape === "none" ? undefined : request.cardId;
  const targetCardId = shape === "cardAndTarget" ? request.targetCardId : undefined;
  const options_ = actionOptions(rt, action, playerId);
  if (!options_ && !cardId) return fail(`“${action.label}” is not available right now.`);
  if (shape !== "none" && !options_?.some((option) => option.cardId === cardId && option.targetCardId === targetCardId)) {
    if (!cardId) return fail("Choose a card first.");
    return fail(shape === "cardAndTarget" ? `${rt.cardText(cardId)} cannot be played on ${targetCardId ? rt.cardText(targetCardId) : "nothing"}.` : `${rt.cardText(cardId)} cannot be played now.`);
  }

  try {
    const base = { playerId, actionId: action.id, cardId, targetCardId };
    rt.emit({ type: "ACTION_ATTEMPTED", ...base });
    if (cardId) rt.emit({ type: "CARD_PLAY_ATTEMPT", ...base });
    drainEvents(rt);
    if (rt.rejected) return fail(rt.rejected);

    const scope = { actor: playerId, played: cardId, target: targetCardId };
    rt.log("action", `${player.name}: ${action.label}${cardId ? ` ${rt.cardText(cardId)}` : ""}${targetCardId ? ` on ${rt.cardText(targetCardId)}` : ""}.`, { playerId });
    if (cardId) {
      const destination = action.destination ? resolveZoneKey(action.destination, rt, scope) : undefined;
      if (destination) rt.moveCard(cardId, destination, { playerId });
      const landed = destination ? rt.zone(destination) : undefined;
      rt.emit({ type: "CARD_PLAYED", ...base, zone: landed?.definitionId, zoneOwner: landed?.owner });
    }
    if (action.type === "pass") {
      rt.player(playerId)!.passed = true;
      rt.emit({ type: "PLAYER_PASSED", playerId });
    }
    runEffects(action.effects, rt, scope);
    rt.emit({ type: "ACTION_COMPLETED", ...base });
    draft.revision += 1;
    settle(rt);
  } catch (error) {
    if (error instanceof EngineLimitError) return fail(error.message);
    throw error;
  }
  return { ok: true, state: draft, events: rt.emitted };
}

/* ------------------------------------------------------------------- Settle */

/** Runs rules, end checks, phase transitions and auto-passes until nothing changes. */
function settle(rt: Runtime) {
  let phaseChanges = 0;
  for (;;) {
    drainEvents(rt);
    rt.rejected = undefined;
    if (rt.state.status !== "playing") return;
    if (rt.endRequest) return finish(rt, rt.endRequest);
    const result = checkEndConditions(rt);
    if (result) return finish(rt, result);

    const next = rt.pendingPhase ?? nextTransition(rt);
    rt.pendingPhase = undefined;
    if (next) {
      phaseChanges++;
      if (phaseChanges > ENGINE_LIMITS.maxPhaseChanges) {
        throw new EngineLimitError(`More than ${ENGINE_LIMITS.maxPhaseChanges} phase changes in one step — the automatic phases loop forever.`);
      }
      enterPhase(rt, next);
      continue;
    }
    if (applyAutoPass(rt)) continue;
    break;
  }
  if (rt.state.status === "playing" && playersWhoCanAct(rt.def, rt.state).length === 0) {
    const phase = currentPhase(rt.def, rt.state);
    finish(rt, { winners: [], losers: [], draw: true, reason: `Nobody can act in the ${phase?.name ?? rt.state.currentPhase} phase, so the game stops as a draw.` });
  }
}

function applyAutoPass(rt: Runtime): boolean {
  const phase = currentPhase(rt.def, rt.state);
  if (!phase?.autoPass) return false;
  let changed = false;
  for (const player of rt.activePlayers()) {
    if (player.passed) continue;
    const available = getAvailableActions(rt.def, rt.state, player.id);
    if (available.length && available.every((action) => action.type === "pass")) {
      player.passed = true;
      rt.log("info", `${player.name} has nothing to add and passes.`, { playerId: player.id });
      rt.emit({ type: "PLAYER_PASSED", playerId: player.id });
      changed = true;
    }
  }
  return changed;
}

function finish(rt: Runtime, result: Omit<GameResult, "endConditionId"> & { endConditionId?: string }) {
  const state = rt.state;
  rt.endRequest = undefined;
  rt.pendingPhase = undefined;
  state.result = JSON.parse(JSON.stringify(result));
  for (const player of state.players) {
    const outcome = result.winners.includes(player.id) ? "winner" : result.losers.includes(player.id) ? "loser" : result.draw ? "draw" : undefined;
    if (outcome) player.result = outcome;
  }
  rt.emit({ type: "GAME_ENDED" });
  drainEvents(rt);
  state.status = "finished";
  rt.queue.length = 0;
  rt.log("info", `Game over — ${result.reason}`);
}

/* --------------------------------------------------------------- Visibility */

/** Whether `viewerId` may see a card's face (null viewer = spectator). */
export function isCardVisible(def: GameDefinition, state: GameState, key: string, cardId: string, viewerId: string | null): boolean {
  if (state.faceUp[cardId]) return true;
  const zone = state.zones[key];
  const definition = def.zones.find((entry) => entry.id === zone?.definitionId);
  if (!definition) return false;
  if (definition.visibility === "public") return true;
  if (definition.visibility === "owner") return Boolean(viewerId && zone.owner === viewerId);
  return false;
}

/**
 * What one player is allowed to know. Hidden cards become anonymous
 * placeholders and the RNG state is removed (it would reveal future shuffles).
 */
export function getPlayerView(def: GameDefinition, state: GameState, viewerId: string | null): GameState {
  const view = structuredClone(state);
  const cards: GameState["cards"] = {};
  let hidden = 0;
  for (const [key, zone] of Object.entries(view.zones)) {
    zone.cards = zone.cards.map((cardId) => {
      if (isCardVisible(def, state, key, cardId, viewerId)) {
        cards[cardId] = state.cards[cardId];
        return cardId;
      }
      delete view.marks[cardId];
      return `hidden-${++hidden}`;
    });
  }
  view.cards = cards;
  view.rng = { seed: 0, state: 0 };
  return view;
}

/* ------------------------------------------------------------ Serialization */

export function serializeState(state: GameState): string {
  return JSON.stringify(state);
}

export function parseState(json: string): GameState {
  const value = JSON.parse(json) as GameState;
  if (!value || typeof value !== "object" || !Array.isArray(value.players) || typeof value.zones !== "object" || typeof value.rng?.state !== "number") {
    throw new Error("Not a saved card game state.");
  }
  return value;
}

/** Short, human-readable description of a request (for logs and the UI). */
export function describeRequest(def: GameDefinition, state: GameState, request: ActionRequest): string {
  const action = def.actions.find((entry) => entry.id === request.actionId);
  const card = request.cardId ? state.cards[request.cardId] : undefined;
  const target = request.targetCardId ? state.cards[request.targetCardId] : undefined;
  return `${action?.label ?? request.actionId}${card ? ` ${cardLabel(card)}` : ""}${target ? ` on ${cardLabel(target)}` : ""}`;
}
