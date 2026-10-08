import type { BoardMap, Match } from "../types.ts";
import { activePlayer } from "./engine.ts";
import { reachableLandings } from "./economy.ts";
import { activeRestrictions } from "./routes.ts";
import { spaceNumber } from "./graph.ts";
import { tollDescription } from "../properties/properties.ts";
export function landingDescription(state: Match, map: BoardMap, id: string): string {
  const node = map.nodes.find((node) => node.id === id)!;
  const player = activePlayer(state), property = state.properties.find((property) => property.nodeId === id);
  const effects = [];
  const relic = state.boardEffects?.some((e) => e.kind === "relic" && e.nodeIds.includes(id));
  if (map.cleansingNodeIds?.includes(id)) effects.push("✚ cleanse +10 HP");
  else if (relic) effects.push("◆ collect relic item instead of normal field");
  else if (property?.ownerPlayerId && property.ownerPlayerId !== player.id) effects.push(`Toll: ${tollDescription(property, state.round)}`);
  else effects.push(({ coin: "+3 coins", boost: "+3 coins", item: "item cache", rare: "rare item", bank: `${state.bank} bank coins`, deposit: "−3 coins", heal: "+10 HP", hazard: "−5 HP", event: "regional event", property: "outpost", warp: "shortcut", duel: "duel space", empty: "rest" })[node.type]);
  for (const e of state.boardEffects ?? []) if (e.nodeIds.includes(id) && e.kind !== "relic") effects.push(({ treasure: "💎 +5 treasure coins", breeze: "🍃 +2 bounty coins", eruption: `⚠ −10 HP at end of round ${e.expiresAfterRound}`, sanctuary: "💚 +5 extra HP", sale: "🛍 normal shop items −2 coins", relic: "" })[e.kind]);
  if (state.plutoNodeIds.includes(id)) effects.push(player.coins >= 20 ? "✦ Pluto · 20 coins" : "✦ Pluto · need 20 coins");
  if (!map.cleansingNodeIds?.includes(id) && state.radiationZones.some((zone) => zone.nodeIds.includes(id))) effects.push("☢ radiation");
  return `Space ${spaceNumber(id)}: ${effects.join(" · ")}`;
}
export function routePreview(state: Match, map: BoardMap, nextId: string) {
  const landings = [...reachableLandings(map, nextId, activePlayer(state).currentNodeId, Math.max(0, state.movesRemaining - 1), activeRestrictions(state))];
  return { landings, summaries: landings.map((id) => landingDescription(state, map, id)) };
}
