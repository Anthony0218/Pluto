// Shared helpers for the card-builder-*.test.mjs suites (not a test file itself).
import assert from "node:assert/strict";
import { createGame, getAvailableActions, performAction } from "../src/games/cards/engine/index.ts";

export const seats = (count) => Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `P${index}` }));

export function start(def, count = 2, settings = {}, seed = 7) {
  return createGame(def, { players: seats(count), settings, seed });
}

/**
 * Rearranges a live state for a scenario. `zones` maps zone keys to card ids
 * (bottom → top); every card not mentioned is put in `rest` (default: the
 * first game zone listed, or removed from play into `parking`).
 */
export function arrange(state, zones, { rest } = {}) {
  const used = new Set(Object.values(zones).flat());
  for (const zone of Object.values(state.zones)) zone.cards = [];
  for (const [key, cards] of Object.entries(zones)) {
    assert.ok(state.zones[key], `zone ${key} exists`);
    for (const id of cards) assert.ok(state.cards[id], `card ${id} exists`);
    state.zones[key].cards = [...cards];
  }
  const leftovers = Object.keys(state.cards).filter((id) => !used.has(id));
  if (rest) state.zones[rest].cards.unshift(...leftovers);
  else for (const id of leftovers) delete state.cards[id];
  state.faceUp = {};
  state.marks = {};
  return state;
}

export function setRoles(state, roles) {
  for (const player of state.players) player.roles = roles[player.id] ?? [];
  for (const player of state.players) player.passed = false;
}

export function act(def, state, playerId, request) {
  const result = performAction(def, state, playerId, request);
  assert.ok(result.ok, `expected ${playerId} ${JSON.stringify(request)} to succeed: ${result.error}`);
  return result.state;
}

export function rejects(def, state, playerId, request, pattern) {
  const result = performAction(def, state, playerId, request);
  assert.equal(result.ok, false, `expected ${playerId} ${JSON.stringify(request)} to be rejected`);
  if (pattern) assert.match(result.error, pattern);
  assert.equal(result.state, state, "a rejected action returns the untouched state");
  return result.error;
}

export const actionIds = (def, state, playerId) => getAvailableActions(def, state, playerId).map((action) => action.actionId);
export const cardsOf = (state, key) => [...state.zones[key].cards];
