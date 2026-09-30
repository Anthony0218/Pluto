import { ANIMAL_CONFIG, ANIMAL_PHASE_FLOW, WILD_TOTEM_WEIGHTS } from "../config.ts";
import { damagePlayer, findPlayer } from "../engine/combat.ts";
import { emit } from "../engine/events.ts";
import {
  findShortestPath,
  graphDistances,
  NO_RESTRICTIONS,
  type RouteRestrictions,
} from "../engine/graph.ts";
import { pickWeighted } from "../engine/random.ts";
import type {
  AnimalHit,
  AnimalInstance,
  AnimalStep,
  AnimalType,
  BoardMap,
  Match,
} from "../types.ts";
import { animalRegistry } from "./registry.ts";

// Shared runtime for every summoned animal. Animals are board entities (`match.animals`), never
// players: they do not resolve tiles, collect anything, use warps, or suffer radiation. They act only
// in the Animal Phase, which the authority runs after the last board turn of a round.

export function activeAnimalOf(state: Match, ownerPlayerId: string): AnimalInstance | undefined {
  return state.animals.find((a) => a.ownerPlayerId === ownerPlayerId);
}
export function canSummonAnimal(state: Match, ownerPlayerId: string): boolean {
  return (
    state.animals.filter((a) => a.ownerPlayerId === ownerPlayerId).length < ANIMAL_CONFIG.maxPerOwner
  );
}

// Server-side Wild Totem roll; clients never pick the animal.
export function rollWildTotemAnimal(random: () => number): AnimalType {
  return pickWeighted(WILD_TOTEM_WEIGHTS, random, (id) =>
    animalRegistry.all().some((a) => a.id === id),
  ) as AnimalType;
}

const animalLabel = (state: Match, animal: Pick<AnimalInstance, "ownerPlayerId" | "type">) =>
  `${findPlayer(state, animal.ownerPlayerId).name.toUpperCase()}'S ${animalRegistry.get(animal.type).name.toUpperCase()}`;

// Places a new animal on `nodeId`. It first moves in the next Animal Phase.
export function summonAnimal(
  state: Match,
  ownerPlayerId: string,
  type: AnimalType,
  nodeId: string,
): AnimalInstance {
  if (!canSummonAnimal(state, ownerPlayerId))
    throw new Error("You already have an active summoned animal.");
  const definition = animalRegistry.get(type),
    sequence = state.nextAnimalNumber++;
  const animal: AnimalInstance = {
    id: `animal-${sequence}`,
    type,
    ownerPlayerId,
    currentNodeId: nodeId,
    remainingRounds: definition.lifetimeRounds,
    movementPerPhase: definition.movementPerPhase,
    damage: definition.damage,
    sequence,
  };
  state.animals.push(animal);
  emit(state, {
    kind: "ANIMAL_SUMMONED",
    playerId: ownerPlayerId,
    nodeId,
    text: `${findPlayer(state, ownerPlayerId).name.toUpperCase()} SUMMONED A ${definition.name.toUpperCase()}!`,
  });
  return animal;
}

// Nearest non-owner player by shortest legal graph distance; ties go to the earlier seat
// (`match.players` order). Players in `skip` (already hit this phase) are ignored.
export function chooseAnimalTarget(
  state: Match,
  map: BoardMap,
  animal: AnimalInstance,
  restrictions: RouteRestrictions = NO_RESTRICTIONS,
  skip: ReadonlySet<string> = new Set(),
): { playerId: string; distance: number } | null {
  const distances = graphDistances(map, animal.currentNodeId, Infinity, restrictions);
  let best: { playerId: string; distance: number } | null = null;
  for (const player of state.players) {
    if (player.id === animal.ownerPlayerId || skip.has(player.id)) continue;
    const distance = distances.get(player.currentNodeId);
    if (distance === undefined) continue;
    if (!best || distance < best.distance) best = { playerId: player.id, distance };
  }
  return best;
}

// Attacks every valid occupant of `nodeId` once per phase (seat order), via the generic damage/KO path.
function contact(
  state: Match,
  map: BoardMap,
  animal: AnimalInstance,
  nodeId: string,
  hitIds: Set<string>,
  hits: AnimalHit[],
) {
  const victims = state.players.filter(
    (p) => p.currentNodeId === nodeId && p.id !== animal.ownerPlayerId && !hitIds.has(p.id),
  );
  for (const victim of victims) {
    hitIds.add(victim.id);
    emit(state, {
      kind: "ANIMAL_HIT",
      playerId: victim.id,
      amount: animal.damage,
      nodeId,
      text: `${animalRegistry.get(animal.type).name.toUpperCase()} HIT ${victim.name.toUpperCase()} FOR ${animal.damage} HP`,
    });
    const result = damagePlayer(state, map, victim.id, animal.damage);
    hits.push({ playerId: victim.id, nodeId, damage: result.dealt, knockedOut: result.knockedOut });
  }
}

// One animal's turn: contact on its own space, pick a target, follow the shortest legal path up to its
// movement allowance, attacking whenever it enters an occupied space. It stops on its target's space.
export function moveAnimal(
  state: Match,
  map: BoardMap,
  animal: AnimalInstance,
  restrictions: RouteRestrictions = NO_RESTRICTIONS,
): AnimalStep {
  const hitIds = new Set<string>(),
    hits: AnimalHit[] = [],
    fromNodeId = animal.currentNodeId,
    entered: string[] = [];
  contact(state, map, animal, animal.currentNodeId, hitIds, hits);
  const target = chooseAnimalTarget(state, map, animal, restrictions, hitIds);
  const path = target
    ? (findShortestPath(map, animal.currentNodeId, findPlayer(state, target.playerId).currentNodeId, restrictions) ?? [])
    : [];
  for (const nodeId of path.slice(0, animal.movementPerPhase)) {
    animal.currentNodeId = nodeId;
    entered.push(nodeId);
    contact(state, map, animal, nodeId, hitIds, hits);
  }
  if (entered.length)
    emit(state, {
      kind: "ANIMAL_MOVED",
      playerId: animal.ownerPlayerId,
      nodeId: animal.currentNodeId,
      amount: entered.length,
      text: `${animalRegistry.get(animal.type).name.toUpperCase()} MOVES ${entered.length} SPACE${entered.length === 1 ? "" : "S"}`,
    });
  return {
    animalId: animal.id,
    type: animal.type,
    ownerPlayerId: animal.ownerPlayerId,
    fromNodeId,
    path: entered,
    targetPlayerId: target?.playerId ?? null,
    hits,
    despawned: false,
  };
}

// The Animal Phase: every active animal in creation order moves and attacks, then ages by one round;
// animals at 0 remaining rounds despawn. Records the steps for the client animation window.
export function runAnimalPhase(
  state: Match,
  map: BoardMap,
  now: number,
  restrictions: RouteRestrictions = NO_RESTRICTIONS,
) {
  const ordered = [...state.animals].sort((a, b) => a.sequence - b.sequence);
  const steps: AnimalStep[] = [];
  for (const animal of ordered) {
    const step = moveAnimal(state, map, animal, restrictions);
    animal.remainingRounds--;
    if (animal.remainingRounds <= 0) {
      step.despawned = true;
      emit(state, {
        kind: "ANIMAL_DESPAWNED",
        playerId: animal.ownerPlayerId,
        nodeId: animal.currentNodeId,
        text: `${animalLabel(state, animal)} DESPAWNED`,
      });
    }
    steps.push(step);
  }
  state.animals = ordered.filter((a) => a.remainingRounds > 0);
  state.animalPhase = {
    sequence: ++state.animalPhaseSeq,
    startedAt: now,
    endsAt: now + ANIMAL_PHASE_FLOW.baseMs + ANIMAL_PHASE_FLOW.perAnimalMs * steps.length,
    steps,
  };
}
