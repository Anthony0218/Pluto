/**
 * Generic end conditions. Checked after every settled step, in definition
 * order. Some only mark players as finished (several players can finish
 * before the match is over); the rest end the match with winners, losers or a
 * draw.
 */
import { evaluateCondition, describeCondition } from "./conditions.ts";
import { describePlayers, describeValue, zoneName } from "./describe.ts";
import type { DescribeContext } from "./params.ts";
import { cardsIn, handZones, resolveNumber, resolvePlayers } from "./refs.ts";
import { zoneKey, type Runtime } from "./runtime.ts";
import type { EndConditionDefinition, EndConditionType, GameResult } from "./types.ts";

export const END_CONDITION_LABELS: Record<EndConditionType, string> = {
  PLAYER_HAND_EMPTY: "A player empties their hand",
  LAST_ACTIVE_PLAYER: "Only one player is left",
  LAST_PLAYER_WITH_CARDS: "Only one player still has cards",
  FIRST_TO_SCORE: "First to reach a score",
  HIGHEST_SCORE: "Highest score when …",
  CUSTOM_DECLARATIVE_CONDITION: "Custom condition",
};

const cardCount = (rt: Runtime, playerId: string, zones: string[]) => cardsIn(rt, zones.map((zone) => zoneKey(zone, playerId))).length;

/** Returns a result when the match is over; may also mark players finished. */
export function checkEndConditions(rt: Runtime): GameResult | undefined {
  const state = rt.state;
  for (const condition of rt.def.endConditions) {
    if (condition.phases?.length && !condition.phases.includes(state.currentPhase)) continue;
    const result = checkOne(rt, condition);
    if (result) return { ...result, endConditionId: condition.id };
  }
  return undefined;
}

function others(rt: Runtime, ids: string[]) {
  return rt.state.players.filter((player) => !ids.includes(player.id)).map((player) => player.id);
}

function checkOne(rt: Runtime, condition: EndConditionDefinition): Omit<GameResult, "endConditionId"> | undefined {
  const state = rt.state;
  const active = rt.activePlayers();
  switch (condition.type) {
    case "PLAYER_HAND_EMPTY": {
      if (condition.when && !evaluateCondition(condition.when, rt, {})) return undefined;
      const zones = condition.zones?.length ? condition.zones : handZones(rt);
      const empty = active.filter((player) => cardCount(rt, player.id, zones) === 0);
      if (!empty.length) return undefined;
      if (condition.outcome === "finish") {
        for (const player of empty) {
          player.status = "finished";
          player.finishPlace = state.players.filter((other) => other.finishPlace).length + 1;
          rt.log("info", `${player.name} has no cards left and finishes in place ${player.finishPlace}.`, { playerId: player.id });
        }
        return undefined;
      }
      const winners = empty.map((player) => player.id);
      return { winners, losers: others(rt, winners), draw: false, reason: `${empty.map((player) => player.name).join(" and ")} emptied their hand.` };
    }
    case "LAST_ACTIVE_PLAYER": {
      if (state.players.length < 2 || active.length > 1) return undefined;
      if (!active.length) return { winners: [], losers: [], draw: true, reason: "Everyone ran out of cards at the same time." };
      return lastOne(rt, active[0].id, condition);
    }
    case "LAST_PLAYER_WITH_CARDS": {
      const zones = condition.zones?.length ? condition.zones : handZones(rt);
      const holders = active.filter((player) => cardCount(rt, player.id, zones) > 0);
      if (state.players.length < 2 || holders.length > 1) return undefined;
      if (!holders.length) return { winners: [], losers: [], draw: true, reason: "Nobody has any cards left." };
      return lastOne(rt, holders[0].id, condition);
    }
    case "FIRST_TO_SCORE": {
      const target = resolveNumber(condition.target, rt, {}, Infinity);
      const reached = active.filter((player) => player.score >= target);
      if (!reached.length) return undefined;
      const best = Math.max(...reached.map((player) => player.score));
      const winners = reached.filter((player) => player.score === best).map((player) => player.id);
      return { winners, losers: others(rt, winners), draw: false, reason: `${winners.map((id) => rt.playerName(id)).join(" and ")} reached ${target} points.` };
    }
    case "HIGHEST_SCORE": {
      if (!condition.when || !evaluateCondition(condition.when, rt, {})) return undefined;
      const measure = condition.measure ?? "score";
      const value = (id: string) => (measure === "score" ? rt.player(id)!.score : cardCount(rt, id, measure.zones));
      const pool = (active.length ? active : state.players).map((player) => player.id);
      const best = Math.max(...pool.map(value));
      const winners = pool.filter((id) => value(id) === best);
      return {
        winners,
        losers: others(rt, winners),
        draw: winners.length > 1,
        reason: `${measure === "score" ? "Highest score" : "Most cards"}: ${winners.map((id) => rt.playerName(id)).join(" and ")}.`,
      };
    }
    case "CUSTOM_DECLARATIVE_CONDITION": {
      if (!condition.when || !evaluateCondition(condition.when, rt, {})) return undefined;
      const winners = condition.winners ? resolvePlayers(condition.winners, rt, {}) : [];
      const losers = condition.losers ? resolvePlayers(condition.losers, rt, {}) : condition.winners ? others(rt, winners) : [];
      return { winners, losers, draw: Boolean(condition.draw), reason: condition.label || "The game's end condition was met." };
    }
    default:
      return undefined;
  }
}

// Roles are kept when a player finishes: "the next player after the defender" must still work.
function lastOne(rt: Runtime, lastId: string, condition: EndConditionDefinition): Omit<GameResult, "endConditionId"> {
  const name = rt.playerName(lastId);
  if (condition.outcome === "lastLoses") {
    // Players who already finished, or are still in, win; eliminated players lose too.
    const losers = [lastId, ...rt.state.players.filter((player) => player.status === "eliminated").map((player) => player.id)];
    return { winners: others(rt, losers), losers, draw: false, reason: `${name} is the last player left holding cards and loses.` };
  }
  const why = condition.type === "LAST_PLAYER_WITH_CARDS" ? "holds every remaining card" : "is the last player standing";
  return { winners: [lastId], losers: others(rt, [lastId]), draw: false, reason: `${name} ${why}.` };
}

export function describeEndCondition(condition: EndConditionDefinition, ctx: DescribeContext = {}): string {
  const zones = (ids?: string[]) => (ids?.length ? ids.map((id) => zoneName(id, ctx)).join(" + ") : "hand");
  const gate = condition.phases?.length ? ` (checked during ${condition.phases.join(", ")})` : "";
  switch (condition.type) {
    case "PLAYER_HAND_EMPTY":
      return `${condition.when ? `When ${describeCondition(condition.when, ctx)}, a` : "A"} player whose ${zones(condition.zones)} is empty ${condition.outcome === "finish" ? "finishes (and is safe)" : "wins"}${gate}.`;
    case "LAST_ACTIVE_PLAYER":
      return `When only one player is still playing, that player ${condition.outcome === "lastLoses" ? "loses" : "wins"}${gate}.`;
    case "LAST_PLAYER_WITH_CARDS":
      return `When only one player has cards in their ${zones(condition.zones)}, that player ${condition.outcome === "lastLoses" ? "loses" : "wins"}${gate}.`;
    case "FIRST_TO_SCORE":
      return `The first player to reach ${describeValue(condition.target, ctx)} points wins${gate}.`;
    case "HIGHEST_SCORE":
      return `When ${describeCondition(condition.when, ctx)}, the player with the ${condition.measure && condition.measure !== "score" ? `most cards in ${zones(condition.measure.zones)}` : "highest score"} wins${gate}.`;
    case "CUSTOM_DECLARATIVE_CONDITION":
      return `When ${describeCondition(condition.when, ctx)}, the game ends${condition.draw ? " in a draw" : ""}${condition.winners ? ` — ${describePlayers(condition.winners, ctx)} wins` : ""}${condition.losers ? ` — ${describePlayers(condition.losers, ctx)} loses` : ""}${gate}.`;
    default:
      return "Unknown end condition.";
  }
}
