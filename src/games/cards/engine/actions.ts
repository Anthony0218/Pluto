/**
 * What a player may do right now. The UI renders exactly this list and the
 * engine validates every request against the same function, so the client
 * never re-implements game logic.
 */
import { evaluateCondition } from "./conditions.ts";
import { cardsIn, resolveZoneKeys } from "./refs.ts";
import { Runtime, zoneKey } from "./runtime.ts";
import { ACTION_TYPE_SHAPE, type ActionDefinition, type ActionOption, type AvailableAction, type GameDefinition, type GameState, type PhaseDefinition, type PlayerState } from "./types.ts";

export function actorAllowed(state: GameState, action: ActionDefinition, phase: PhaseDefinition, player: PlayerState): boolean {
  if (player.status !== "active") return false;
  if (phase.activeRoles?.length && !player.roles.some((role) => phase.activeRoles!.includes(role))) return false;
  if (action.actors === "all") return true;
  if (action.actors === "current") return state.currentPlayerId === player.id;
  return player.roles.some((role) => (action.actors as { roles: string[] }).roles.includes(role));
}

/** The source zone key of a card action for this player. */
export function sourceZoneKey(def: GameDefinition, action: ActionDefinition, playerId: string): string | undefined {
  if (!action.source) return undefined;
  const zone = def.zones.find((entry) => entry.id === action.source);
  if (!zone) return undefined;
  return zone.owner === "player" ? zoneKey(zone.id, playerId) : zone.id;
}

/** Valid parameter combinations, or null when the action is unavailable. */
export function actionOptions(rt: Runtime, action: ActionDefinition, playerId: string): ActionOption[] | null {
  const player = rt.player(playerId);
  if (!player) return null;
  const scope = { actor: playerId };
  if (action.condition && !evaluateCondition(action.condition, rt, scope)) return null;
  const shape = ACTION_TYPE_SHAPE[action.type];
  if (shape === "none") {
    if (action.type === "pass" && player.passed) return null;
    return [];
  }
  const source = sourceZoneKey(rt.def, action, playerId);
  const cards = source ? (rt.zone(source)?.cards ?? []) : [];
  const options: ActionOption[] = [];
  if (shape === "card") {
    for (const cardId of cards) {
      if (!action.cardCondition || evaluateCondition(action.cardCondition, rt, { ...scope, played: cardId, eachCard: cardId })) options.push({ cardId });
    }
  } else {
    const targets = action.target ? cardsIn(rt, resolveZoneKeys(action.target.zone, rt, scope)) : [];
    const validTargets = targets.filter((targetId) => !action.target?.where || evaluateCondition(action.target.where, rt, { ...scope, target: targetId, eachCard: targetId }));
    for (const cardId of cards) {
      for (const targetCardId of validTargets) {
        if (!action.cardCondition || evaluateCondition(action.cardCondition, rt, { ...scope, played: cardId, target: targetCardId, eachCard: cardId })) {
          options.push({ cardId, targetCardId });
        }
      }
    }
  }
  return options.length ? options : null;
}

export function currentPhase(def: GameDefinition, state: GameState): PhaseDefinition | undefined {
  return def.phases.find((phase) => phase.id === state.currentPhase);
}

/** Actions `playerId` may take now, each with its valid card/target choices. */
export function getAvailableActions(def: GameDefinition, state: GameState, playerId: string): AvailableAction[] {
  if (state.status !== "playing") return [];
  const phase = currentPhase(def, state);
  const player = state.players.find((entry) => entry.id === playerId);
  if (!phase || !player || phase.automatic) return [];
  // Read-only: conditions never mutate, so the live state can be inspected directly.
  const rt = new Runtime(def, state);
  const out: AvailableAction[] = [];
  for (const actionId of phase.allowedActions) {
    const action = def.actions.find((entry) => entry.id === actionId);
    if (!action || !actorAllowed(state, action, phase, player)) continue;
    const options = actionOptions(rt, action, playerId);
    if (options) out.push({ actionId: action.id, type: action.type, label: action.label, options });
  }
  return out;
}

/** Every player who can act right now (used for stalemate detection and bots). */
export function playersWhoCanAct(def: GameDefinition, state: GameState): string[] {
  return state.players.filter((player) => getAvailableActions(def, state, player.id).length > 0).map((player) => player.id);
}
