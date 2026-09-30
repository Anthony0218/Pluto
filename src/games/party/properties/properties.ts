import { PROPERTY_CONFIG } from "../config.ts";
import { findPlayer } from "../engine/combat.ts";
import { emit } from "../engine/events.ts";
import type {
  BoardMap,
  Match,
  Player,
  PropertyLevel,
  PropertyState,
} from "../types.ts";

export function createProperties(map: BoardMap): PropertyState[] {
  return map.nodes
    .filter((n) => n.type === "property")
    .map((n) => ({
      nodeId: n.id,
      ownerPlayerId: null,
      level: 0,
      level4LastTriggeredRound: null,
    }));
}
export function findProperty(
  state: Match,
  nodeId: string,
): PropertyState | undefined {
  return state.properties.find((p) => p.nodeId === nodeId);
}
export function requireProperty(state: Match, nodeId: string): PropertyState {
  const property = findProperty(state, nodeId);
  if (!property) throw new Error("That space is not a property.");
  return property;
}
export const propertyOwner = (state: Match, property: PropertyState) =>
  property.ownerPlayerId
    ? state.players.find((p) => p.id === property.ownerPlayerId)
    : undefined;
export function propertiesOwnedBy(state: Match, playerId: string) {
  return state.properties.filter((p) => p.ownerPlayerId === playerId);
}
// Level 4 may steal a Golden Pluto again once `level4CooldownRounds` rounds have passed.
export function plutoStealRoundsLeft(
  property: PropertyState,
  round: number,
): number {
  if (property.level4LastTriggeredRound === null) return 0;
  return Math.max(
    0,
    PROPERTY_CONFIG.level4CooldownRounds -
      (round - property.level4LastTriggeredRound),
  );
}
export const isLevel4PlutoStealReady = (
  property: PropertyState,
  round: number,
) => property.level === 4 && plutoStealRoundsLeft(property, round) === 0;
export function tollDescription(property: PropertyState, round: number) {
  if (property.level < 1) return "none";
  if (property.level < 4)
    return `${PROPERTY_CONFIG.tolls[property.level]} coins`;
  return isLevel4PlutoStealReady(property, round)
    ? `1 Golden Pluto (or ${PROPERTY_CONFIG.level4FallbackCoins} coins)`
    : `${PROPERTY_CONFIG.level4CooldownCoins} coins`;
}
export function canPurchaseProperty(
  player: Player,
  property: PropertyState,
): string | null {
  if (player.currentNodeId !== property.nodeId)
    return "You must be standing on the property.";
  if (property.ownerPlayerId !== null) return "That property is already owned.";
  if (player.coins < PROPERTY_CONFIG.purchaseCost)
    return `You need ${PROPERTY_CONFIG.purchaseCost} coins.`;
  return null;
}
export function canUpgradeProperty(
  player: Player,
  property: PropertyState,
): string | null {
  if (player.currentNodeId !== property.nodeId)
    return "You must be standing on the property.";
  if (property.ownerPlayerId !== player.id)
    return "You can only upgrade your own property.";
  if (property.level >= PROPERTY_CONFIG.maxLevel)
    return "This property is already Level 4.";
  if (player.coins < PROPERTY_CONFIG.upgradeCost)
    return `You need ${PROPERTY_CONFIG.upgradeCost} coins.`;
  return null;
}
export function purchaseProperty(
  state: Match,
  map: BoardMap,
  playerId: string,
  nodeId: string,
) {
  const player = findPlayer(state, playerId),
    property = requireProperty(state, nodeId),
    problem = canPurchaseProperty(player, property);
  if (problem) throw new Error(problem);
  player.coins -= PROPERTY_CONFIG.purchaseCost;
  property.ownerPlayerId = player.id;
  property.level = 1;
  emit(state, {
    kind: "PROPERTY_CLAIMED",
    playerId,
    nodeId,
    amount: PROPERTY_CONFIG.purchaseCost,
    text: `${player.name.toUpperCase()} CLAIMED AN ${map.propertyName.toUpperCase()}`,
  });
}
export function upgradeProperty(
  state: Match,
  map: BoardMap,
  playerId: string,
  nodeId: string,
) {
  const player = findPlayer(state, playerId),
    property = requireProperty(state, nodeId),
    problem = canUpgradeProperty(player, property);
  if (problem) throw new Error(problem);
  player.coins -= PROPERTY_CONFIG.upgradeCost;
  property.level = (property.level + 1) as PropertyLevel;
  emit(state, {
    kind: "PROPERTY_UPGRADED",
    playerId,
    nodeId,
    amount: property.level,
    text: `${map.propertyName.toUpperCase()} UPGRADED TO LEVEL ${property.level}`,
  });
}
// Moves at most what the payer has; balances never go negative.
export function transferCoins(from: Player, to: Player, amount: number) {
  const paid = Math.max(0, Math.min(from.coins, amount));
  from.coins -= paid;
  to.coins += paid;
  return paid;
}
function payToll(state: Match, visitor: Player, owner: Player, amount: number) {
  const paid = transferCoins(visitor, owner, amount);
  emit(state, {
    kind: "TOLL",
    playerId: visitor.id,
    amount: paid,
    text: `${visitor.name.toUpperCase()} PAID ${owner.name.toUpperCase()} ${paid} COINS`,
  });
  return paid;
}
export function resolvePropertyToll(
  state: Match,
  map: BoardMap,
  visitorId: string,
  property: PropertyState,
) {
  const visitor = findPlayer(state, visitorId),
    owner = propertyOwner(state, property);
  if (!owner || owner.id === visitor.id || property.level < 1) return;
  if (property.level < 4) {
    payToll(state, visitor, owner, PROPERTY_CONFIG.tolls[property.level]);
    return;
  }
  if (isLevel4PlutoStealReady(property, state.round)) {
    if (visitor.goldenPlutos > 0) {
      visitor.goldenPlutos--;
      owner.goldenPlutos++;
      property.level4LastTriggeredRound = state.round;
      emit(state, {
        kind: "PLUTO_STOLEN",
        playerId: owner.id,
        amount: 1,
        text: `${owner.name.toUpperCase()} STOLE 1 GOLDEN PLUTO FROM ${visitor.name.toUpperCase()}`,
      });
    } else payToll(state, visitor, owner, PROPERTY_CONFIG.level4FallbackCoins);
    return;
  }
  emit(state, {
    kind: "TOLL",
    playerId: visitor.id,
    text: `LEVEL-4 ${map.propertyName.toUpperCase()} IS ON COOLDOWN`,
  });
  payToll(state, visitor, owner, PROPERTY_CONFIG.level4CooldownCoins);
}
// Called once when a turn ends on a property. Returns true when the active player must decide.
export function resolvePropertyLanding(
  state: Match,
  map: BoardMap,
  playerId: string,
  nodeId: string,
): boolean {
  const property = findProperty(state, nodeId);
  if (!property) return false;
  const player = findPlayer(state, playerId);
  if (property.ownerPlayerId === null)
    return canPurchaseProperty(player, property) === null;
  if (property.ownerPlayerId === player.id)
    return canUpgradeProperty(player, property) === null;
  resolvePropertyToll(state, map, playerId, property);
  return false;
}
