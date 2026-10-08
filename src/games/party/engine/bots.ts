import { difficultyRank } from "../difficulty.ts";
import { activePlayer, legalPaths } from "./engine.ts";
import type { Random } from "./engine.ts";
import { BOT_TRANSPORT, DEFAULT_SETTINGS, PROPERTY_CONFIG, RULES } from "../config.ts";
import { distanceToPluto, reachableLandings } from "./economy.ts";
import { graphDistances } from "./graph.ts";
import { activeRestrictions } from "./routes.ts";
import {
  availableTransport,
  slideDestination,
  transportDestination,
} from "./transport.ts";
import { cometMelonDamage } from "../items/definitions.ts";
import { itemRegistry } from "../items/registry.ts";
import { botFire, playerTargetedItemAction } from "./itemBots.ts";
import {
  falloutCoreAction,
  hazardScorer,
  pocketDuelAction,
  wildTotemAction,
} from "./rareBots.ts";
import { itemLockReason } from "../status/effects.ts";
import type { BoardMap, GameAction, Match, Settings } from "../types.ts";

// Bots use items during the item phase; every choice is still validated by the authority.
function itemAction(
  state: Match,
  map: BoardMap,
  playerId: string,
  random: Random,
  settings: Settings,
): GameAction | null {
  const player = state.players.find((p) => p.id === playerId)!;
  // Radiation (or any item-locking status) blocks the whole inventory; do not even try.
  if (itemLockReason(player)) return null;
  for (const item of player.inventory) {
    const definition = itemRegistry.get(item.itemId);
    if ((item.usableFromRound ?? 0) > state.round || !definition.canUse(state, playerId, map)) continue;
    if (item.itemId === "mega-medkit" && player.hp > player.maxHp / 2) continue;
    // Rare items have their own heuristics.
    const rare =
      item.itemId === "pocket-duel"
        ? pocketDuelAction(state, player, item, random, settings)
        : item.itemId === "fallout-core"
          ? falloutCoreAction(state, map, player, item, random, settings)
          : item.itemId === "wild-totem"
            ? wildTotemAction(state, map, player, item, random)
            : undefined;
    if (rare !== undefined) {
      if (rare) return rare;
      continue;
    }
    if (definition.targeting === "player") {
      const action = playerTargetedItemAction(state, map, player, item, random, settings);
      if (action) return action;
      continue;
    }
    if (definition.targeting !== "node")
      return { type: "USE_ITEM", itemInstanceId: item.instanceId };
    let best: { nodeId: string; score: number } | null = null;
    for (const node of map.nodes) {
      const distances = graphDistances(map, node.id, 2);
      const score = state.players
        .filter((p) => p.id !== playerId)
        .reduce(
          (sum, p) => sum + cometMelonDamage(distances.get(p.currentNodeId)),
          0,
        );
      if (score > (best?.score ?? 0)) best = { nodeId: node.id, score };
    }
    if (best && best.score >= 10)
      return {
        type: "USE_ITEM",
        itemInstanceId: item.instanceId,
        targetNodeId: best.nodeId,
      };
  }
  return null;
}
// Hard bots keep enough coins for a Golden Pluto they can plausibly reach.
function savingForPluto(
  state: Match,
  map: BoardMap,
  playerId: string,
  settings: Settings,
): boolean {
  const player = state.players.find((p) => p.id === playerId)!;
  return (
    settings.victory === "plutos" &&
    player.coins >= RULES.plutoPrice - PROPERTY_CONFIG.purchaseCost &&
    distanceToPluto(
      map,
      player.currentNodeId,
      state.plutoNodeIds,
      activeRestrictions(state),
    ) <= 10
  );
}
export function propertyDecision(
  state: Match,
  map: BoardMap,
  random: Random,
  settings: Settings,
): GameAction {
  const player = activePlayer(state),
    property = state.properties.find((p) => p.nodeId === player.currentNodeId);
  if (!property) return { type: "LEAVE_PROPERTY" };
  const buying = property.ownerPlayerId === null,
    cost = buying ? PROPERTY_CONFIG.purchaseCost : PROPERTY_CONFIG.upgradeCost,
    coins = player.coins;
  let want = false;
  if (coins >= cost)
    if (difficultyRank(player.difficulty) <= 1) want = random() < 0.5;
    else if (difficultyRank(player.difficulty) <= 3) want = coins >= 10;
    else {
      const saving = savingForPluto(state, map, player.id, settings);
      want = buying
        ? coins >= 8 && !saving
        : property.level === 3
          ? !saving
          : coins >= 10 && !saving;
    }
  return want
    ? {
        type: buying ? "BUY_PROPERTY" : "UPGRADE_PROPERTY",
        nodeId: property.nodeId,
      }
    : { type: "LEAVE_PROPERTY" };
}
// Nodes a bot is heading for: the Golden Pluto(s), or in coin games a worthwhile bank when there is one.
function objectiveNodes(state: Match, map: BoardMap, settings: Settings): string[] {
  if (settings.victory === "coins" && state.bank >= 10) {
    const bank = map.nodes.find((n) => n.type === "bank");
    if (bank) return [bank.id];
  }
  return state.plutoNodeIds;
}
// Cable Car / Mine Cart offer. Easy bots flip a coin; medium rides when the destination is closer to the
// objective; hard also weighs the hazards (radiation, hostile animals) around the destination. Every
// choice is still validated by the authority like a human request.
export function transportDecision(
  state: Match,
  map: BoardMap,
  random: Random,
  settings: Settings,
): GameAction {
  const player = activePlayer(state),
    offer = availableTransport(state, map, player.currentNodeId),
    stay: GameAction = { type: "DECLINE_TRANSPORT" };
  if (!offer || player.coins < offer.cost) return stay;
  const ride: GameAction = { type: "RIDE_TRANSPORT", transportId: offer.id };
  if (difficultyRank(player.difficulty) <= 1)
    return random() < BOT_TRANSPORT.easyAcceptChance ? ride : stay;
  const destination = transportDestination(offer, player.currentNodeId)!,
    restrictions = activeRestrictions(state),
    objectives = objectiveNodes(state, map, settings),
    gain =
      distanceToPluto(map, player.currentNodeId, objectives, restrictions) -
      distanceToPluto(map, destination, objectives, restrictions);
  if (difficultyRank(player.difficulty) <= 3) return gain > 0 ? ride : stay;
  const danger = hazardScorer(state, map, player, random)(destination);
  return gain - danger / 10 >= 2 ? ride : stay;
}
export function botAction(
  state: Match,
  map: BoardMap,
  random: Random,
  settings: Settings = DEFAULT_SETTINGS,
  now: number = Date.now(),
): GameAction | null {
  const player = activePlayer(state);
  if (state.phase === "ZERO_BONUS") return { type: "ZERO_REWARD", reward: player.hp <= player.maxHp - 5 ? "heal" : "coins" };
  if (state.phase === "ITEM_AIM") return botFire(state, player, random, now);
  if (state.phase === "PLUTO_OFFER")
    return {
      type:
        player.coins >= RULES.plutoPrice && settings.victory === "plutos"
          ? "BUY_PLUTO"
          : "LEAVE_PLUTO",
    };
  if (state.phase === "PROPERTY_OFFER")
    return propertyDecision(state, map, random, settings);
  if (state.phase === "TRANSPORT_OFFER")
    return transportDecision(state, map, random, settings);
  if (state.phase === "ITEM_REPLACE") return { type: "DISCARD_NEW_ITEM" };
  if (state.phase === "ITEM_PHASE" && player.difficulty === "extreme" && player.lastPurchaseRound !== state.round && player.inventory.length < 3 && state.mode !== "festival") {
    const neededHeal = player.hp <= 15 && !player.inventory.some((i) => i.itemId === "mega-medkit");
    if (neededHeal && player.coins >= 6) return { type: "BUY_ITEM", mystery: false, itemId: "mega-medkit" };
    if (settings.victory === "plutos" && player.coins >= 34 && !savingForPluto(state, map, player.id, settings)) return { type: "BUY_ITEM", mystery: false, itemId: player.inventory.some((i) => i.itemId === "turbo-boots") ? "lucky-six" : "turbo-boots" };
  }
  if (state.phase === "ITEM_PHASE")
    return itemAction(state, map, player.id, random, settings) ?? { type: "ROLL_DICE" };
  if (state.phase !== "PATH_SELECTION") return null;
  const paths = legalPaths(state, map);
  const pursue =
    settings.victory === "plutos" && player.coins >= RULES.plutoPrice;
  const hazard = hazardScorer(state, map, player, random);
  const restrictions = activeRestrictions(state);
  // Value of ending a move on `landing`; a Frozen Slide space is valued by where the slide really ends.
  const landingValue = (landing: string): number => {
      const node = map.nodes.find((n) => n.id === landing)!;
      return (
        (map.cleansingNodeIds?.includes(landing) ? (player.maxHp - player.hp) * 3 + (player.statusEffects.length ? 65 : 0) : 0) +
        (state.boardEffects?.some((e) => e.kind === "eruption" && e.nodeIds.includes(landing)) ? -45 : 0) +
        (state.boardEffects?.some((e) => e.kind === "treasure" && e.nodeIds.includes(landing)) ? 25 : 0) +
        (state.boardEffects?.some((e) => e.kind === "relic" && e.nodeIds.includes(landing)) ? player.inventory.length < 3 ? 25 : 5 : 0) +
        (state.boardEffects?.some((e) => e.kind === "sanctuary" && e.nodeIds.includes(landing)) ? Math.min(5, player.maxHp - player.hp) * 3 : 0) +
        (state.boardEffects?.some((e) => e.kind === "sale" && e.nodeIds.includes(landing)) && player.lastPurchaseRound !== state.round && player.coins >= 4 ? 10 : 0) +
        (node.type === "coin"
          ? 15
          : node.type === "bank"
            ? Math.min(state.bank, 60)
            : node.type === "heal" && player.hp < 20
              ? 30
              : node.type === "hazard"
                ? -25
                : node.type === "deposit"
                  ? -5
                  : 0) +
        (pursue && state.plutoNodeIds.includes(landing) ? 100 : 0) -
        hazard(landing)
      );
  };
  const scores = paths.map((id) => {
    const landings = reachableLandings(
      map,
      id,
      player.currentNodeId,
      state.movesRemaining - 1,
      restrictions,
    );
    const values = [...landings].map((landing) => {
      const slideEnd = slideDestination(map, landing);
      return landingValue(landing) + (slideEnd ? landingValue(slideEnd) : 0);
    });
    return {
      id,
      score:
        Math.max(...values) -
        (pursue
          ? distanceToPluto(map, id, state.plutoNodeIds, restrictions) * 3
          : 0) +
        random() *
          ({ beginner: 320, easy: 180, medium: 100, hard: 60, extreme: 0 }[player.difficulty]),
    };
  });
  scores.sort((a, b) => b.score - a.score);
  return { type: "SELECT_PATH", nodeId: scores[0].id };
}
// The always-legal fallback for a seat the server controls (bots and timed-out humans): used when a
// heuristic throws or its choice is rejected, so one bad decision can never stall a match. Declines
// every optional offer, rolls, keeps items and takes the first open route.
export function safeBotAction(state: Match, map: BoardMap): GameAction | null {
  switch (state.phase) {
    case "ZERO_BONUS":
      return { type: "ZERO_REWARD", reward: "coins" };
    case "ITEM_PHASE":
      return { type: "ROLL_DICE" };
    case "ITEM_AIM":
      // Firing always resolves (a miss consumes the item); cancelling could loop back into aiming.
      return { type: "FIRE_ITEM", aimX: 0, aimY: 0 };
    case "ITEM_REPLACE":
      return { type: "DISCARD_NEW_ITEM" };
    case "PLUTO_OFFER":
      return { type: "LEAVE_PLUTO" };
    case "PROPERTY_OFFER":
      return { type: "LEAVE_PROPERTY" };
    case "TRANSPORT_OFFER":
      return { type: "DECLINE_TRANSPORT" };
    case "PATH_SELECTION": {
      const [first] = legalPaths(state, map);
      return first ? { type: "SELECT_PATH", nodeId: first } : null;
    }
    default:
      return null;
  }
}
