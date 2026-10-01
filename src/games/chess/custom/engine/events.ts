import { getCell, isPlayable, sameCoord, squareName, updateCell } from "./board.ts";
import {
  activeTeams,
  createPosition,
  findPieceAt,
  getDefinition,
  isRoyal,
  nearestEmptyCell,
  nextRandom,
  opponentsOf,
  teamName,
} from "./position.ts";
import type {
  Coord,
  EventAction,
  EventCondition,
  EventContext,
  EventTrigger,
  EventTriggerType,
  GameEvent,
  GameState,
  GameVariant,
  PieceInstance,
  TeamId,
  TeamRef,
  TileType,
} from "./types.ts";

/** Hard ceilings so a badly built event chain can never hang the game. */
export const MAX_EVENT_DEPTH = 6;
export const MAX_ACTIONS_PER_PLY = 200;

export interface TriggerPayload {
  type: EventTriggerType;
  context: EventContext;
  square?: Coord;
  tile?: TileType;
  /** For count triggers: the relevant count now. */
  count?: number;
  /** Team whose count changed (teamPieceCountEquals). */
  team?: TeamId;
}

/** Mutable runtime for one ply: `state` is a private draft owned by applyMove. */
export interface EventRuntime {
  variant: GameVariant;
  state: GameState;
  depth: number;
  actionsRun: number;
  guardTripped: boolean;
}

export function createRuntime(variant: GameVariant, state: GameState): EventRuntime {
  return { variant, state, depth: 0, actionsRun: 0, guardTripped: false };
}

export function pushMessage(state: GameState, text: string, kind: GameState["messages"][number]["kind"] = "event") {
  state.messages.push({ ply: state.ply, text, kind });
  if (state.messages.length > 60) state.messages.splice(0, state.messages.length - 60);
}

export function resolveTeam(rt: EventRuntime, ref: TeamRef | undefined, context: EventContext, fallback: "actor" | "target" = "actor"): TeamId | undefined {
  const value = ref ?? fallback;
  if (value === "any") return undefined;
  if (value === "actor") return context.actor;
  if (value === "target") return context.target ?? context.actor;
  if (value === "opponentOfActor") return context.actor ? opponentsOf(rt.variant, rt.state, context.actor)[0] : undefined;
  return value;
}

const subjectTeam = (type: EventTriggerType, context: EventContext) =>
  type === "pieceCaptured" || type === "kingCaptured" ? context.target : context.actor;
const subjectType = (type: EventTriggerType, context: EventContext) =>
  type === "pieceCaptured" || type === "kingCaptured" ? context.capturedType : context.pieceType;

function matchesTrigger(rt: EventRuntime, trigger: EventTrigger, payload: TriggerPayload) {
  const { type, context } = payload;
  if (type === "teamPieceCountEquals") {
    return payload.team === trigger.team && payload.count === trigger.count;
  }
  if (type === "pieceCountEquals") return payload.count === trigger.count;
  if (type === "afterTurnNumber") return rt.state.turnNumber === trigger.turn;
  if (trigger.team && trigger.team !== "any") {
    const wanted = resolveTeam(rt, trigger.team, context);
    if (wanted !== subjectTeam(type, context)) return false;
  }
  if (trigger.pieceType && trigger.pieceType !== subjectType(type, context)) return false;
  if ((type === "pieceEnterSquare" || type === "pieceLeaveSquare") && trigger.square && !sameCoord(trigger.square, payload.square)) return false;
  if (type === "tileEntered" && trigger.tile && trigger.tile !== payload.tile) return false;
  return true;
}

function compare(actual: number, op: EventCondition["op"] = "eq", value = 0) {
  if (op === "gte") return actual >= value;
  if (op === "lte") return actual <= value;
  return actual === value;
}

function checkCondition(rt: EventRuntime, condition: EventCondition, context: EventContext) {
  const { state, variant } = rt;
  const team = resolveTeam(rt, condition.team, context, "target");
  const owned = (piece: PieceInstance) => !team || piece.team === team;
  switch (condition.type) {
    case "teamHasPiece":
      return state.pieces.some((piece) => owned(piece) && piece.type === condition.pieceType);
    case "teamLacksPiece":
      return !state.pieces.some((piece) => owned(piece) && piece.type === condition.pieceType);
    case "teamPieceCount":
      return compare(state.pieces.filter(owned).length, condition.op, condition.value);
    case "teamRoyalCount":
      return compare(state.pieces.filter((piece) => owned(piece) && isRoyal(variant, piece)).length, condition.op, condition.value);
    case "turnNumber":
      return compare(state.turnNumber, condition.op, condition.value);
    case "squareOccupied":
      return Boolean(condition.square && findPieceAt(state, condition.square));
    case "randomChance": {
      const [roll, seed] = nextRandom(state.seed);
      state.seed = seed;
      return roll * 100 < (condition.value ?? 50);
    }
  }
}

export function conditionsPass(rt: EventRuntime, event: GameEvent, context: EventContext) {
  if (event.conditions.length === 0) return true;
  const results = event.conditions.map((condition) => checkCondition(rt, condition, context));
  return event.conditionMode === "any" ? results.some(Boolean) : results.every(Boolean);
}

/* --------------------------------------------------------------- Actions */

function selectPiece(rt: EventRuntime, action: EventAction, context: EventContext): PieceInstance | undefined {
  const { state, variant } = rt;
  const team = resolveTeam(rt, action.team, context);
  switch (action.target ?? "contextPiece") {
    case "contextPiece":
      return state.pieces.find((piece) => piece.id === context.pieceId);
    case "capturedPiece":
      return state.pieces.find((piece) => piece.id === context.capturedId);
    case "firstOfType":
      return state.pieces.find((piece) => piece.type === action.pieceType && (!team || piece.team === team));
    case "highestValue": {
      const candidates = state.pieces.filter((piece) => (!team || piece.team === team) && !isRoyal(variant, piece));
      return candidates.sort((a, b) => (getDefinition(variant, b.type)?.value ?? 0) - (getDefinition(variant, a.type)?.value ?? 0))[0];
    }
    case "atSquare":
      return action.square ? findPieceAt(state, action.square) : undefined;
  }
}

function selectSquare(rt: EventRuntime, action: EventAction, context: EventContext, team: TeamId | undefined): Coord | undefined {
  switch (action.at ?? "square") {
    case "square":
      return action.square;
    case "contextSquare":
      return context.square;
    case "originSquare":
      return context.origin ?? context.square;
    case "spawnTile": {
      const position = createPosition(rt.variant, rt.state);
      const tile = rt.state.board.cells.find(
        (cell) => cell.enabled && cell.tile === "spawn" && (!cell.team || cell.team === team) && !position.occupancy[cell.y * rt.state.board.width + cell.x],
      );
      return tile ? { x: tile.x, y: tile.y } : context.origin;
    }
  }
}

/** A free, playable cell at or near the requested square. */
function freeCellNear(rt: EventRuntime, coord: Coord | undefined): Coord | null {
  if (!coord) return null;
  if (isPlayable(rt.state.board, coord) && !findPieceAt(rt.state, coord)) return coord;
  return nearestEmptyCell(createPosition(rt.variant, rt.state), coord);
}

function eventOutcomesAllowed(variant: GameVariant) {
  return variant.victoryConditions.some((condition) => condition.type === "eventOutcome" && condition.enabled);
}

export function finishGame(state: GameState, winners: TeamId[], reason: string, draw = false) {
  if (state.result) return;
  state.result = { winners, draw, reason };
  pushMessage(state, reason, "victory");
}

export function eliminateTeam(variant: GameVariant, state: GameState, team: TeamId, reason: string) {
  if (state.eliminated.includes(team)) return;
  state.eliminated.push(team);
  const remaining = activeTeams(variant, state);
  if (remaining.length === 1) finishGame(state, remaining, reason);
  else if (remaining.length === 0) finishGame(state, [], reason, true);
  else {
    // The game goes on: a knocked-out army leaves the board.
    state.pieces = state.pieces.filter((piece) => piece.team !== team);
    pushMessage(state, `${reason} — ${teamName(variant, team)} is out`, "event");
  }
}

function runAction(rt: EventRuntime, action: EventAction, context: EventContext) {
  const { state, variant } = rt;
  rt.actionsRun += 1;
  const team = resolveTeam(rt, action.team, context);
  switch (action.type) {
    case "spawnPiece": {
      const type = action.pieceType ?? context.capturedType;
      const owner = team ?? context.target ?? context.actor;
      if (!type || !owner || !getDefinition(variant, type)) return;
      const at = freeCellNear(rt, selectSquare(rt, action, context, owner));
      if (!at) return pushMessage(state, `No free square to spawn ${getDefinition(variant, type)?.name}`, "warning");
      state.pieces.push({ id: `p${state.nextId++}`, type, team: owner, x: at.x, y: at.y, moveCount: 0, origin: at });
      state.effects.push({ kind: "spawn", at });
      return;
    }
    case "removePiece": {
      const piece = selectPiece(rt, action, context);
      if (!piece) return;
      state.pieces = state.pieces.filter((entry) => entry !== piece);
      state.effects.push({ kind: "capture", at: { x: piece.x, y: piece.y } });
      return;
    }
    case "transformPiece": {
      const piece = selectPiece(rt, action, context);
      if (!piece || !action.toPieceType || !getDefinition(variant, action.toPieceType)) return;
      const before = getDefinition(variant, piece.type)?.name ?? piece.type;
      piece.type = action.toPieceType;
      state.effects.push({ kind: "transform", at: { x: piece.x, y: piece.y } });
      pushMessage(state, `${before} on ${squareName(piece)} becomes ${getDefinition(variant, piece.type)?.name}`);
      return;
    }
    case "movePiece":
    case "teleportPiece": {
      const piece = selectPiece(rt, action, context);
      const to = selectSquare(rt, action, context, piece?.team);
      if (!piece || !to || !isPlayable(state.board, to) || findPieceAt(state, to)) return;
      const from = { x: piece.x, y: piece.y };
      piece.x = to.x;
      piece.y = to.y;
      state.effects.push({ kind: action.type === "teleportPiece" ? "portal" : "pulse", at: from, to });
      if (rt.depth < MAX_EVENT_DEPTH) {
        const nested = { ...context, pieceId: piece.id, pieceType: piece.type, square: to };
        rt.depth += 1;
        fireTrigger(rt, { type: "pieceEnterSquare", context: nested, square: to });
        const tile = getCell(state.board, to)?.tile;
        if (tile && tile !== "normal") fireTrigger(rt, { type: "tileEntered", context: nested, tile, square: to });
        rt.depth -= 1;
      } else {
        rt.guardTripped = true;
      }
      return;
    }
    case "changeTeam": {
      const piece = selectPiece(rt, action, context);
      const next = resolveTeam(rt, action.team ?? "opponentOfActor", context);
      if (piece && next) piece.team = next;
      return;
    }
    case "changePieceRule":
      if (action.pieceType && action.toPieceType) {
        state.ruleOverrides[action.pieceType] = action.toPieceType;
        pushMessage(state, `${getDefinition(variant, action.pieceType)?.name ?? action.pieceType} now moves like a ${getDefinition(variant, action.toPieceType)?.name ?? action.toPieceType}`);
      }
      return;
    case "changeTile":
    case "disableTile":
    case "enableTile": {
      const at = selectSquare(rt, action, context, team);
      if (!at || !getCell(state.board, at)) return;
      if (action.type === "changeTile") state.board = updateCell(state.board, at, { tile: action.tile ?? "normal", enabled: true });
      if (action.type === "enableTile") state.board = updateCell(state.board, at, { enabled: true });
      if (action.type === "disableTile") {
        state.board = updateCell(state.board, at, { enabled: false });
        state.pieces = state.pieces.filter((piece) => !sameCoord(piece, at));
      }
      state.effects.push({ kind: "tile", at });
      return;
    }
    case "triggerAnimation": {
      const at = selectSquare(rt, action, context, team) ?? context.square;
      if (at) state.effects.push({ kind: action.animation ?? "pulse", at });
      return;
    }
    case "displayMessage":
      if (action.message) pushMessage(state, action.message);
      return;
    case "addTurn":
      if (team) state.extraTurns[team] = (state.extraTurns[team] ?? 0) + 1;
      return;
    case "skipTurn": {
      const skipped = resolveTeam(rt, action.team ?? "opponentOfActor", context);
      if (skipped) state.skipTurns[skipped] = (state.skipTurns[skipped] ?? 0) + 1;
      return;
    }
    case "endGame":
    case "declareWinner":
    case "declareLoser":
    case "declareDraw": {
      if (!eventOutcomesAllowed(variant)) {
        pushMessage(state, "An event tried to end the game, but “Custom event outcome” is disabled in Victory", "warning");
        return;
      }
      if (action.type === "declareDraw") return finishGame(state, [], action.message || "Draw declared by an event", true);
      if (action.type === "declareWinner" && team) return finishGame(state, [team], action.message || `${teamName(variant, team)} wins by event`);
      if (action.type === "declareLoser" && team) return eliminateTeam(variant, state, team, action.message || `${teamName(variant, team)} loses by event`);
      if (action.type === "endGame") {
        const scores = activeTeams(variant, state).map((id) => ({
          id,
          score: state.pieces.filter((piece) => piece.team === id).reduce((sum, piece) => sum + (getDefinition(variant, piece.type)?.value ?? 0), 0),
        }));
        const best = Math.max(...scores.map((entry) => entry.score));
        const leaders = scores.filter((entry) => entry.score === best).map((entry) => entry.id);
        finishGame(state, leaders.length === 1 ? leaders : [], action.message || "Game ended by event — material decides", leaders.length !== 1);
      }
      return;
    }
    case "setRoyalMode":
      if (action.royalMode) {
        state.royalMode = action.royalMode;
        pushMessage(state, action.royalMode === "none" ? "Kings are no longer required" : `King rule is now “${action.royalMode}”`);
      }
      return;
    case "suddenDeath":
      state.suddenDeath = true;
      pushMessage(state, action.message || "Sudden death — the next capture wins");
      return;
  }
}

export function resolveEvent(rt: EventRuntime, event: GameEvent, context: EventContext, scheduled = false) {
  const { state } = rt;
  const pass = conditionsPass(rt, event, context);
  const actions = pass ? event.actions : event.elseActions;
  if (event.once && !scheduled && !state.firedOnce.includes(event.id)) state.firedOnce.push(event.id);
  state.fired.push({ eventId: event.id, name: event.name, branch: pass ? "then" : "else", ply: state.ply });
  for (const action of actions) {
    if (state.result) return;
    if (rt.actionsRun >= MAX_ACTIONS_PER_PLY) {
      rt.guardTripped = true;
      return;
    }
    runAction(rt, action, context);
  }
}

export function fireTrigger(rt: EventRuntime, payload: TriggerPayload) {
  const { state, variant } = rt;
  for (const event of variant.events) {
    if (state.result) return;
    if (!event.enabled || event.trigger.type !== payload.type) continue;
    if (event.once && state.firedOnce.includes(event.id)) continue;
    if (!matchesTrigger(rt, event.trigger, payload)) continue;
    if (event.delayTurns > 0) {
      state.scheduled.push({ eventId: event.id, atPly: state.ply + event.delayTurns, context: payload.context });
      if (event.once) state.firedOnce.push(event.id);
      state.fired.push({ eventId: event.id, name: event.name, branch: "scheduled", ply: state.ply });
      continue;
    }
    resolveEvent(rt, event, payload.context);
  }
}

/** Run delayed events whose time has come. */
export function runScheduled(rt: EventRuntime) {
  const { state, variant } = rt;
  const due = state.scheduled.filter((entry) => entry.atPly <= state.ply);
  if (!due.length) return;
  state.scheduled = state.scheduled.filter((entry) => entry.atPly > state.ply);
  for (const entry of due) {
    const event = variant.events.find((candidate) => candidate.id === entry.eventId);
    if (event?.enabled) resolveEvent(rt, event, entry.context, true);
  }
}

export function onlyRoyalsRemain(variant: GameVariant, state: GameState) {
  return state.pieces.length > 0 && state.pieces.every((piece) => isRoyal(variant, piece));
}

