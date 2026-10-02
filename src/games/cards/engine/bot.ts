/**
 * A tiny generic bot for test mode and simulations: it only chooses among the
 * options the engine offers, so it works for any configured game.
 *
 * - Card plays come first: the weakest legal card (trumps count as strong).
 * - Otherwise a parameterless action is drawn by the actions' `botWeight`
 *   (default 1; pass/take default to 0 = only when nothing else is possible).
 *   The draw is deterministic: it hashes the state revision and the player.
 */
import { isSuit, rankIndex } from "../cards/card.ts";
import { getAvailableActions } from "./actions.ts";
import type { ActionRequest, GameDefinition, GameState } from "./types.ts";

const GIVE_UP = new Set(["pass", "takeCards", "fold"]);

function unitHash(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0) / 4294967296;
}

export function chooseBotAction(def: GameDefinition, state: GameState, playerId: string): ActionRequest | null {
  const available = getAvailableActions(def, state, playerId);
  if (!available.length) return null;
  const trump = isSuit(state.variables.trumpSuit) ? state.variables.trumpSuit : null;
  const strength = (cardId?: string) => {
    if (!cardId) return 0;
    const card = state.cards[cardId];
    return rankIndex(state.rankOrder, card.rank) + (card.suit === trump ? 100 : 0);
  };

  let bestCard: { request: ActionRequest; score: number } | undefined;
  for (const action of available) {
    if (GIVE_UP.has(action.type)) continue;
    for (const option of action.options) {
      const score = strength(option.cardId);
      if (!bestCard || score < bestCard.score) bestCard = { request: { actionId: action.actionId, ...option }, score };
    }
  }
  if (bestCard) return bestCard.request;

  const plain = available
    .filter((action) => !action.options.length)
    .map((action) => ({ action, weight: Math.max(0, def.actions.find((entry) => entry.id === action.actionId)?.botWeight ?? (GIVE_UP.has(action.type) ? 0 : 1)) }));
  const total = plain.reduce((sum, entry) => sum + entry.weight, 0);
  if (total > 0) {
    let roll = unitHash(`${state.revision}:${state.logSeq}:${playerId}`) * total;
    for (const entry of plain) {
      roll -= entry.weight;
      if (roll < 0) return { actionId: entry.action.actionId };
    }
  }
  const fallback = available.find((action) => action.type === "pass") ?? available[0];
  return { actionId: fallback.actionId, ...(fallback.options[0] ?? {}) };
}
