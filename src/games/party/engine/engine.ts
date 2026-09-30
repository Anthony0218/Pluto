import { spawnPlutos } from "./economy.ts";
import { AIM_CONFIG, DUEL_FLOW, RULES } from "../config.ts";
import { mapRegistry } from "../content/maps.ts";
import { damagePlayer, findPlayer, healPlayer } from "./combat.ts";
import {
  createProperties,
  purchaseProperty,
  requireProperty,
  resolvePropertyLanding,
  upgradeProperty,
} from "../properties/properties.ts";
import { emit, log } from "./events.ts";
import { emptyStats } from "./stats.ts";
import {
  discardPending,
  findItem,
  grantItem,
  removeItem,
  replaceWithPending,
} from "../items/inventory.ts";
import {
  itemRegistry,
  randomRareItemId,
  randomStandardItemId,
} from "../items/registry.ts";
import {
  createAimChallenge,
  resolveAimRelease,
  timedOutAim,
} from "../items/aim.ts";
import type { ItemUseContext } from "../items/types.ts";
import { endDuel, settleDuel } from "../duels/duel.ts";
import { runAnimalPhase } from "../animals/runtime.ts";
import { runRandomEvent } from "../events/registry.ts";
import { openConnections, spaceNumber } from "./graph.ts";
import { activeRestrictions, expireBlockedConnections } from "./routes.ts";
import {
  availableTransport,
  expireTransportOutages,
  performSlide,
  rideTransport,
  slideAt,
} from "./transport.ts";
import {
  applyLandingRadiation,
  expireRadiationZones,
  irradiatedNodeIds,
} from "../hazards/radiation.ts";
import {
  expireTurnEndEffects,
  itemLockReason,
  runTurnStartEffects,
} from "../status/effects.ts";
import {
  applyMinigameInput,
  beginMinigamePhase,
  concludeMinigame,
  finishMinigame,
  isDuelPhase,
  isMinigamePhase,
  nextRoundOrder,
  simulateMinigame,
} from "../minigames/flow.ts";
import type {
  AimChallenge,
  AimResult,
  BoardMap,
  GameAction,
  Match,
  Player,
  Settings,
  TurnState,
} from "../types.ts";
export type Random = () => number;
// The map is fixed by the match itself (set at creation from the lobby settings); clients cannot change it.
export function mapOf(state: Pick<Match, "mapId">): BoardMap {
  return mapRegistry.get(state.mapId);
}
export function rollDie(random: Random): number {
  return Math.min(
    RULES.dieMax,
    Math.max(0, Math.floor(random() * (RULES.dieMax + 1))),
  );
}
export function newTurnState(): TurnState {
  return {
    hasRolled: false,
    bonusMovement: 0,
    bonusRolled: false,
    usedItemThisTurn: false,
    aim: null,
  };
}
export function createPlayer(
  id: string,
  name: string,
  avatarId: number,
  isBot = false,
): Player {
  return {
    id,
    name,
    avatarId,
    isBot,
    difficulty: "medium",
    ready: isBot,
    connected: true,
    coins: RULES.coins,
    goldenPlutos: 0,
    hp: RULES.hp,
    maxHp: RULES.maxHp,
    currentNodeId: "space-0",
    previousNodeId: null,
    inventory: [],
    statusEffects: [],
  };
}
export function createMatch(
  players: Player[],
  settings: Settings,
  random: Random,
): Match {
  if (
    players.length !== RULES.slots ||
    new Set(players.map((p) => p.id)).size !== RULES.slots
  )
    throw new Error("Four unique players are required.");
  const map = mapRegistry.get(settings.mapId);
  return {
    mapId: map.id,
    phase: "START_ROLL",
    players: players.map((p) => ({
      ...structuredClone(p),
      currentNodeId: map.start,
    })),
    order: [],
    turnIndex: 0,
    round: 1,
    movesRemaining: 0,
    lastRoll: null,
    startingRolls: [],
    rollGroups: [players.map((p) => p.id)],
    rollWave: 0,
    bank: 0,
    plutoNodeIds: spawnPlutos(map, [], map.goldenPlutoCount, random),
    plutoSpawn: { sequence: 0, nodeId: null },
    properties: createProperties(map),
    turn: newTurnState(),
    pendingItem: null,
    nextItemNumber: 1,
    events: [],
    eventSeq: 0,
    minigame: null,
    lastMinigameId: null,
    duel: null,
    lastDuelMinigameId: null,
    radiationZones: [],
    nextZoneNumber: 1,
    animals: [],
    nextAnimalNumber: 1,
    animalPhase: null,
    animalPhaseSeq: 0,
    blockedConnections: [],
    nextBlockNumber: 1,
    transportOutages: [],
    forcedMove: null,
    forcedMoveSeq: 0,
    log: [map.flavor.welcome],
    winner: null,
    stats: Object.fromEntries(players.map((p) => [p.id, emptyStats()])),
  };
}
export function activePlayer(state: Match): Player {
  return (
    state.players.find((p) => p.id === state.order[state.turnIndex]) ??
    state.players[0]
  );
}
export function legalPaths(state: Match, map: BoardMap): string[] {
  const p = activePlayer(state),
    open = openConnections(map, p.currentNodeId, activeRestrictions(state));
  const forward = open.filter((id) => id !== p.previousNodeId);
  return forward.length ? forward : open;
}
export function applyAction(
  current: Match,
  playerId: string,
  action: GameAction,
  settings: Settings,
  random: Random,
  now: number = Date.now(),
): Match {
  // Minigame input comes from every participant at once and is validated by the minigame module.
  if (action.type === "MINIGAME_INPUT")
    return applyMinigameInput(current, playerId, action.input, now);
  if (isDuelPhase(current.phase))
    throw new Error("Board actions are paused during the duel.");
  if (isRoundEndPhase(current.phase))
    throw new Error("Board actions are paused until the minigame is over.");
  if (activePlayer(current).id !== playerId)
    throw new Error("Wait for your turn.");
  if (
    current.phase === "ITEM_AIM" &&
    action.type !== "FIRE_ITEM" &&
    action.type !== "CANCEL_AIM"
  )
    throw new Error("Fire or cancel your shot first.");
  const state = structuredClone(current);
  if (action.type === "FIRE_ITEM" || action.type === "CANCEL_AIM") {
    const aim = state.turn.aim;
    if (state.phase !== "ITEM_AIM" || !aim || aim.playerId !== playerId)
      throw new Error("You are not aiming anything.");
    const map = mapOf(state);
    if (action.type === "CANCEL_AIM") {
      // Nothing was consumed yet: the item stays in the inventory.
      state.turn.aim = null;
      state.phase = "ITEM_PHASE";
      log(state, `${activePlayer(state).name} lowered their weapon.`);
    } else {
      const geometry = itemRegistry.get(aim.itemId).aim!.geometry(aim.band);
      resolveAimedItem(
        state,
        aim,
        resolveAimRelease(aim, geometry, action.aimX, action.aimY, action.elapsedMs, now),
        map,
        random,
        now,
      );
    }
  } else if (action.type === "ROLL_DICE") {
    if (state.phase !== "ITEM_PHASE")
      throw new Error(
        "Dice can only be rolled once at the start of your turn.",
      );
    state.lastRoll = rollDie(random);
    state.turn.hasRolled = true;
    state.movesRemaining = state.lastRoll + state.turn.bonusMovement;
    state.phase = "DICE_ROLL";
    log(
      state,
      state.turn.bonusMovement > 0
        ? `${activePlayer(state).name} rolled ${state.lastRoll} + ${state.turn.bonusMovement} Turbo bonus = ${state.movesRemaining}.`
        : `${activePlayer(state).name} rolled ${state.lastRoll}.`,
    );
  } else if (action.type === "USE_ITEM") {
    applyItemUse(state, playerId, action, settings, random, now);
  } else if (
    action.type === "REPLACE_ITEM" ||
    action.type === "DISCARD_NEW_ITEM"
  ) {
    if (state.phase !== "ITEM_REPLACE" || !state.pendingItem)
      throw new Error("There is no new item waiting for a decision.");
    if (action.type === "REPLACE_ITEM")
      replaceWithPending(state, playerId, action.replaceInstanceId);
    else discardPending(state, playerId);
    state.phase = state.plutoNodeIds.includes(activePlayer(state).currentNodeId)
      ? "PLUTO_OFFER"
      : availableTransport(state, mapOf(state), activePlayer(state).currentNodeId)
        ? "TRANSPORT_OFFER"
        : "TURN_END";
    if (state.phase === "PLUTO_OFFER")
      log(
        state,
        `Golden Pluto! ${activePlayer(state).name} can buy for ${RULES.plutoPrice} coins or leave.`,
      );
  } else if (action.type === "SELECT_PATH") {
    if (
      state.phase !== "PATH_SELECTION" ||
      !legalPaths(state, mapOf(state)).includes(action.nodeId)
    )
      throw new Error("Choose a highlighted connected path.");
    move(state, action.nodeId);
  } else if (
    action.type === "BUY_PROPERTY" ||
    action.type === "UPGRADE_PROPERTY" ||
    action.type === "LEAVE_PROPERTY"
  ) {
    const player = activePlayer(state),
      map = mapOf(state);
    if (state.phase !== "PROPERTY_OFFER")
      throw new Error("There is no property decision to make right now.");
    if (action.type === "LEAVE_PROPERTY")
      log(state, `${player.name} moved on from the ${map.propertyName}.`);
    else {
      if (action.nodeId !== player.currentNodeId)
        throw new Error("You can only act on the property you are standing on.");
      const property = requireProperty(state, action.nodeId);
      if (action.type === "BUY_PROPERTY")
        purchaseProperty(state, map, player.id, property.nodeId);
      else upgradeProperty(state, map, player.id, property.nodeId);
    }
    state.phase = "TURN_END";
  } else if (
    action.type === "RIDE_TRANSPORT" ||
    action.type === "DECLINE_TRANSPORT"
  ) {
    // The offer only exists in TRANSPORT_OFFER, so a second request after the decision (or from any other
    // phase) is rejected here: no repeated rides within one landing.
    const player = activePlayer(state),
      map = mapOf(state);
    if (state.phase !== "TRANSPORT_OFFER")
      throw new Error("There is no ride on offer right now.");
    if (action.type === "RIDE_TRANSPORT") {
      const offered = availableTransport(state, map, player.currentNodeId);
      if (!offered || offered.id !== action.transportId)
        throw new Error("That ride is not available from here.");
      rideTransport(state, map, player.id, offered.id);
    } else log(state, `${player.name} stayed put.`);
    state.phase = "TURN_END";
  } else if (action.type === "BUY_PLUTO" || action.type === "LEAVE_PLUTO") {
    const player = activePlayer(state);
    if (
      state.phase !== "PLUTO_OFFER" ||
      !state.plutoNodeIds.includes(player.currentNodeId)
    )
      throw new Error(
        "Golden Plutos can only be purchased when you land on one.",
      );
    if (action.type === "BUY_PLUTO") {
      if (player.coins < RULES.plutoPrice)
        throw new Error(
          `You need ${RULES.plutoPrice} coins to buy a Golden Pluto.`,
        );
      const remaining = state.plutoNodeIds.filter(
        (id) => id !== player.currentNodeId,
      );
      const [replacement] = spawnPlutos(
        mapOf(state),
        remaining,
        1,
        random,
        [player.currentNodeId, ...irradiatedNodeIds(state)],
      );
      player.coins -= RULES.plutoPrice;
      player.goldenPlutos++;
      state.plutoNodeIds = [...remaining, replacement];
      state.plutoSpawn = {
        sequence: state.plutoSpawn.sequence + 1,
        nodeId: replacement,
      };
      log(
        state,
        `${player.name} bought a Golden Pluto for ${RULES.plutoPrice} coins. Spent coins leave the economy.`,
      );
      log(
        state,
        `New Golden Pluto! Space ${spaceNumber(replacement)}.`,
      );
      state.winner = detectWinner(state, settings);
    } else
      log(state, `${player.name} left the Golden Pluto for another explorer.`);
    state.phase = state.winner ? "GAME_OVER" : "TURN_END";
  } else throw new Error("Unknown game action.");
  return state;
}
function announceItemUse(state: Match, playerId: string, itemId: string) {
  emit(state, {
    kind: "ITEM_USED",
    playerId,
    text: `${findPlayer(state, playerId).name.toUpperCase()} USED ${itemRegistry.get(itemId).name.toUpperCase()}`,
  });
}
// Validation order matters: every rejection happens before any state is touched.
function applyItemUse(
  state: Match,
  playerId: string,
  action: Extract<GameAction, { type: "USE_ITEM" }>,
  _settings: Settings,
  random: Random,
  now: number,
) {
  if (state.phase !== "ITEM_PHASE" || state.turn.hasRolled)
    throw new Error("Items can only be used before you roll the dice.");
  const instance = findItem(state, playerId, action.itemInstanceId),
    definition = itemRegistry.get(instance.itemId);
  const map = mapOf(state);
  // Status effects such as Radiation lock the whole inventory; the server enforces it here.
  const lock = itemLockReason(findPlayer(state, playerId));
  if (lock) throw new Error(lock);
  if (!definition.canUse(state, playerId, map))
    throw new Error(
      definition.blockedReason?.(state, playerId, map) ??
        `${definition.name} cannot be used right now.`,
    );
  if (
    definition.targeting === "node" &&
    !map.nodes.some((n) => n.id === action.targetNodeId)
  )
    throw new Error("Choose a space on the board.");
  const context: ItemUseContext = {
    playerId,
    itemInstanceId: instance.instanceId,
    map,
    random,
    now,
    targetNodeId:
      definition.targeting === "node" ? action.targetNodeId : undefined,
    targetPlayerId:
      definition.targeting === "player" ? action.targetPlayerId : undefined,
    wager: action.wager,
  };
  definition.validate?.(state, context);
  if (definition.aim) {
    // Aimed weapons are not consumed yet: the server seeds an aiming challenge and waits for FIRE_ITEM.
    state.turn.aim = createAimChallenge(
      state,
      map,
      definition,
      playerId,
      instance.instanceId,
      context.targetPlayerId!,
      random,
      now,
    );
    state.phase = "ITEM_AIM";
    log(
      state,
      `${findPlayer(state, playerId).name} aims the ${definition.name} at ${findPlayer(state, context.targetPlayerId!).name}…`,
    );
    return;
  }
  removeItem(state, playerId, instance.instanceId);
  state.turn.usedItemThisTurn = true;
  announceItemUse(state, playerId, definition.id);
  definition.execute(state, context);
}
// Consumes the aimed item and lets its definition apply the server-scored result (hit or miss).
function resolveAimedItem(
  state: Match,
  aim: AimChallenge,
  result: AimResult,
  map: BoardMap,
  random: Random,
  now: number,
) {
  removeItem(state, aim.playerId, aim.itemInstanceId);
  state.turn.aim = null;
  state.turn.usedItemThisTurn = true;
  state.phase = "ITEM_PHASE";
  announceItemUse(state, aim.playerId, aim.itemId);
  itemRegistry.get(aim.itemId).execute(state, {
    playerId: aim.playerId,
    itemInstanceId: aim.itemInstanceId,
    map,
    random,
    now,
    targetPlayerId: aim.targetPlayerId,
    aim: result,
  });
}
function clearMinigame(state: Match) {
  state.lastMinigameId = state.minigame?.minigameId ?? state.lastMinigameId;
  state.minigame = null;
}
function move(state: Match, nodeId: string) {
  const player = activePlayer(state);
  player.previousNodeId = player.currentNodeId;
  player.currentNodeId = nodeId;
  state.movesRemaining--;
  state.phase = state.movesRemaining === 0 ? "RESOLVE_TILE" : "MOVEMENT";
}
// Every new board turn starts here: fresh turn state, then turn-start status effects (Radiation damage,
// which may KO through the normal path) before the item phase opens. Duels returning to ITEM_PHASE do
// not pass through here, so they never re-trigger turn-start effects.
function beginTurn(state: Match, map: BoardMap) {
  state.turn = newTurnState();
  state.phase = "ITEM_PHASE";
  runTurnStartEffects(state, map, activePlayer(state).id);
}
function startRoll(state: Match, map: BoardMap, random: Random) {
  const groups: string[][] = [];
  state.rollWave++;
  for (const group of state.rollGroups) {
    if (group.length === 1) {
      groups.push(group);
      continue;
    }
    const rolls = group.map((playerId) => ({
      playerId,
      value: rollDie(random),
      wave: state.rollWave,
    }));
    state.startingRolls.push(...rolls);
    const scores = [...new Set(rolls.map((r) => r.value))].sort(
      (a, b) => b - a,
    );
    for (const value of scores)
      groups.push(
        rolls.filter((r) => r.value === value).map((r) => r.playerId),
      );
  }
  state.rollGroups = groups;
  if (groups.every((g) => g.length === 1)) {
    state.order = groups.flat();
    log(
      state,
      `${activePlayer(state).name} starts! Choose a route and explore.`,
    );
    beginTurn(state, map);
  } else log(state, "Starting-order tie! Only tied players roll again.");
}
// `forced` is true when the player arrived by a forced move (slide): movement-type fields (warp) do not
// chain another teleport from that landing.
export function resolveTile(
  state: Match,
  map: BoardMap,
  random: Random,
  forced = false,
) {
  const player = activePlayer(state),
    node = map.nodes.find((n) => n.id === player.currentNodeId)!;
  switch (node.type) {
    case "coin":
    case "boost":
      player.coins += RULES.coinTile;
      log(state, `${player.name} gained 3 coins.`);
      break;
    case "deposit": {
      const paid = Math.min(player.coins, RULES.bankDeposit);
      player.coins -= paid;
      state.bank += paid;
      log(state, `${player.name} paid ${paid} coins into the central bank.`);
      break;
    }
    case "bank":
      log(state, `${player.name} claimed ${state.bank} coins from the bank!`);
      player.coins += state.bank;
      state.bank = 0;
      break;
    case "heal":
      log(
        state,
        `${player.name} healed ${healPlayer(state, player.id, RULES.heal)} HP.`,
      );
      break;
    case "hazard":
      log(state, `${player.name} ${map.flavor.hazard}`);
      damagePlayer(state, map, player.id, RULES.hazard);
      break;
    case "item":
      grantItem(state, player.id, randomStandardItemId(random));
      break;
    case "rare":
      // Same inventory and full-inventory replace/discard flow as standard items.
      grantItem(state, player.id, randomRareItemId(random));
      break;
    case "warp": {
      if (forced) break;
      // A map may pair its warps (Mountain tunnel); otherwise the warp goes to the next region (ferry).
      const target =
        map.warps?.[node.id] ??
        map.nodes.find((n) => n.region === (node.region + 1) % map.regions.length)!.id;
      player.currentNodeId = target;
      player.previousNodeId = null;
      log(state, `${player.name} ${map.flavor.warp}`);
      break;
    }
    case "event":
      runRandomEvent(state, map, random, player.id);
      break;
    case "empty":
      log(state, `${player.name} ${map.flavor.empty}`);
      if (map.flavor.emptyToast)
        emit(state, { kind: "EVENT", playerId: player.id, text: map.flavor.emptyToast });
      break;
    default:
      log(
        state,
        `${player.name} found a ${node.type} space. This feature is coming soon.`,
      );
  }
}
// Players reaching the goal simultaneously are resolved in `priority` order: by default the active player
// first, then the current round order. Minigame rewards pass the minigame placement instead.
function roundPriority(state: Match): string[] {
  return [
    ...state.order.slice(state.turnIndex),
    ...state.order.slice(0, state.turnIndex),
  ];
}
export function detectWinner(
  state: Match,
  settings: Settings,
  priority: readonly string[] = roundPriority(state),
): string | null {
  return (
    priority
      .map((id) => state.players.find((p) => p.id === id)!)
      .find((p) =>
        settings.victory === "coins"
          ? p.coins >= settings.coinTarget
          : p.goldenPlutos >= settings.plutoTarget,
      )?.id ?? null
  );
}
// Phases that wait for a player decision, and timed phases before their deadline. Must agree with the
// early returns inside `advance` (each returns `current` unchanged in exactly these situations).
function isWaiting(state: Match, now: number): boolean {
  switch (state.phase) {
    case "ITEM_PHASE":
    case "ITEM_REPLACE":
    case "PATH_SELECTION":
    case "PLUTO_OFFER":
    case "PROPERTY_OFFER":
    case "TRANSPORT_OFFER":
    case "GAME_OVER":
      return true;
    case "MINIGAME_INTRO":
    case "DUEL_INTRO":
      return !!state.minigame && now < state.minigame.startedAt;
    case "MINIGAME_RESULTS":
    case "DUEL_RESULTS":
      return !!state.minigame?.resultsEndsAt && now < state.minigame.resultsEndsAt;
    case "ANIMAL_PHASE":
      return !!state.animalPhase && now < state.animalPhase.endsAt;
    case "ITEM_AIM":
      return !!state.turn.aim && now <= state.turn.aim.expiresAt + AIM_CONFIG.expiryGraceMs;
    default:
      return false;
  }
}
function isRoundEndPhase(phase: Match["phase"]): boolean {
  return (
    phase === "ANIMAL_PHASE" || phase === "ROUND_END" || isMinigamePhase(phase)
  );
}
// Only the authority calls advance; clients cannot advance phases or submit outcomes. Timed phases
// (minigame intro, play and results) wait for the injected server clock `now`.
export function advance(
  current: Match,
  settings: Settings,
  random: Random,
  now: number = Date.now(),
): Match {
  // Called every tick for every room: return early (without cloning the whole match) while nothing is due.
  if (isWaiting(current, now)) return current;
  const state = structuredClone(current),
    map = mapOf(state);
  switch (state.phase) {
    case "START_ROLL":
      startRoll(state, map, random);
      break;
    case "DICE_ROLL":
      state.phase = state.movesRemaining === 0 ? "TURN_END" : "MOVEMENT";
      break;
    case "MOVEMENT": {
      const paths = legalPaths(state, map);
      if (paths.length > 1) state.phase = "PATH_SELECTION";
      else if (paths.length === 1) move(state, paths[0]);
      else throw new Error("Map has a dead end.");
      break;
    }
    case "RESOLVE_TILE": {
      // Landing order: radiation status first, then the field, then the property, then the Pluto offer.
      const landingNodeId = activePlayer(state).currentNodeId;
      // A landing that follows a slide is a forced arrival: its field resolves once and cannot start
      // another slide, warp or ride.
      const forced =
        state.forcedMove?.pending === true &&
        state.forcedMove.playerId === activePlayer(state).id;
      if (forced) state.forcedMove!.pending = false;
      applyLandingRadiation(state, activePlayer(state).id, landingNodeId);
      resolveTile(state, map, random, forced);
      state.winner = detectWinner(state, settings);
      if (
        !forced &&
        !state.winner &&
        !state.pendingItem &&
        activePlayer(state).currentNodeId === landingNodeId &&
        slideAt(map, landingNodeId)
      ) {
        // Frozen Slide: forced movement with no input; only the final space resolves (next tick).
        performSlide(state, map, activePlayer(state).id);
        break;
      }
      const propertyOffer = resolvePropertyLanding(
        state,
        map,
        activePlayer(state).id,
        landingNodeId,
      );
      state.winner = detectWinner(state, settings);
      const stayed = activePlayer(state).currentNodeId === landingNodeId;
      const canOffer = stayed && state.plutoNodeIds.includes(landingNodeId);
      const ride =
        stayed && !forced && availableTransport(state, map, landingNodeId);
      state.phase = state.winner
        ? "GAME_OVER"
        : state.pendingItem
          ? "ITEM_REPLACE"
          : propertyOffer
            ? "PROPERTY_OFFER"
            : canOffer
              ? "PLUTO_OFFER"
              : ride
                ? "TRANSPORT_OFFER"
                : "TURN_END";
      if (state.phase === "PLUTO_OFFER")
        log(
          state,
          `Golden Pluto! ${activePlayer(state).name} can buy for ${RULES.plutoPrice} coins or leave.`,
        );
      break;
    }
    case "TURN_END":
      state.movesRemaining = 0;
      state.lastRoll = null;
      expireTurnEndEffects(state, activePlayer(state).id);
      state.turn = newTurnState();
      if (state.turnIndex === state.order.length - 1) {
        state.phase = "ANIMAL_PHASE";
        break;
      }
      state.turnIndex++;
      log(state, `${activePlayer(state).name}’s turn.`);
      beginTurn(state, map);
      break;
    case "ANIMAL_PHASE":
      // With no animals the phase passes straight through. Otherwise the first tick resolves every animal
      // (authoritative, deterministic), then the phase waits for the animation window to end.
      if (!state.animalPhase) {
        if (state.animals.length) {
          runAnimalPhase(state, map, now, activeRestrictions(state));
          break;
        }
      } else if (now < state.animalPhase.endsAt) return current;
      state.animalPhase = null;
      // Animal KOs only move coins to the bank, but the normal victory check still runs.
      state.winner = detectWinner(state, settings);
      if (state.winner) state.phase = "GAME_OVER";
      else beginMinigamePhase(state, random, now);
      break;
    case "MINIGAME_INTRO":
      if (now < state.minigame!.startedAt) return current;
      state.minigame!.status = "ACTIVE";
      state.phase = "MINIGAME";
      break;
    case "ITEM_AIM": {
      const aim = state.turn.aim;
      if (!aim) {
        state.phase = "ITEM_PHASE";
        break;
      }
      // An unreleased shot expires as a miss (the item is spent), so aiming can never stall a turn.
      if (now <= aim.expiresAt + AIM_CONFIG.expiryGraceMs) return current;
      resolveAimedItem(state, aim, timedOutAim(aim, now), map, random, now);
      break;
    }
    case "DUEL_INTRO":
      if (now < state.minigame!.startedAt) return current;
      state.minigame!.status = "ACTIVE";
      state.phase = "DUEL_MINIGAME";
      break;
    case "DUEL_MINIGAME": {
      const sim = simulateMinigame(state, now);
      if (!sim.finished) return sim.changed ? state : current;
      // Duels never pay main-minigame rewards: only the wager changes hands.
      concludeMinigame(state, random, now, DUEL_FLOW.resultsMs);
      settleDuel(state);
      const duelWinner = state.duel?.winnerPlayerId;
      state.winner = detectWinner(
        state,
        settings,
        duelWinner
          ? [duelWinner, ...roundPriority(state).filter((id) => id !== duelWinner)]
          : undefined,
      );
      state.phase = "DUEL_RESULTS";
      break;
    }
    case "DUEL_RESULTS":
      if (now < state.minigame!.resultsEndsAt!) return current;
      endDuel(state);
      if (!state.winner)
        log(state, `${activePlayer(state).name} continues their turn.`);
      break;
    case "MINIGAME": {
      const sim = simulateMinigame(state, now);
      if (!sim.finished) return sim.changed ? state : current;
      finishMinigame(state, random, now);
      // Rewards can end the match (coin victory); simultaneous winners resolve by placement.
      state.winner = detectWinner(
        state,
        settings,
        state.minigame!.results!.map((r) => r.playerId),
      );
      break;
    }
    case "MINIGAME_RESULTS":
      if (now < state.minigame!.resultsEndsAt!) return current;
      state.phase = state.winner ? "GAME_OVER" : "ROUND_END";
      if (state.winner) clearMinigame(state);
      break;
    case "ROUND_END": {
      const winnerId = state.minigame?.results?.[0]?.playerId;
      if (winnerId) state.order = nextRoundOrder(state.order, winnerId);
      clearMinigame(state);
      // Zones whose last full round just ended disappear before the next round starts.
      expireRadiationZones(state);
      // Temporary route closures and transport outages end on the same round boundary.
      expireBlockedConnections(state);
      expireTransportOutages(state, map);
      state.turnIndex = 0;
      state.round++;
      state.movesRemaining = 0;
      state.lastRoll = null;
      log(state, `Round ${state.round}. ${map.flavor.roundStart}`);
      log(state, `${activePlayer(state).name}’s turn.`);
      beginTurn(state, map);
      break;
    }
    default:
      return current;
  }
  return state;
}
