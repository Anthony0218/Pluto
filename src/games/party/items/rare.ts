import { FALLOUT_CONFIG } from "../config.ts";
import { canSummonAnimal, rollWildTotemAnimal, summonAnimal } from "../animals/runtime.ts";
import { startPocketDuel } from "../duels/duel.ts";
import { findPlayer, knockOut } from "../engine/combat.ts";
import { emit } from "../engine/events.ts";
import { createRadiationZone, irradiatePlayer } from "../hazards/radiation.ts";
import { minigameRegistry } from "../minigames/index.ts";
import type { BoardMap } from "../types.ts";
import type { ItemDefinition } from "./types.ts";
import { requireOpponent } from "./weapons.ts";

// Rare items (Rare Item field only). They use the same registry, inventory, timing and validation as
// every other item; `rarity: "rare"` is what keeps them out of the standard Random Item pool.

// Fallout Core area: the target node plus every directly connected node (graph, never pixels).
export function falloutBlastNodes(map: BoardMap, targetNodeId: string): string[] {
  const node = map.nodes.find((n) => n.id === targetNodeId);
  if (!node) throw new Error("Choose a space on the board.");
  return [node.id, ...node.connections.filter((id) => id !== node.id)];
}

export const pocketDuel: ItemDefinition = {
  id: "pocket-duel",
  name: "Pocket Duel",
  description:
    "Challenge any opponent to a random duel minigame. No wager: the winner gets 1 brand-new Golden Pluto and the loser loses nothing.",
  rarity: "rare",
  icon: "🎮",
  targeting: "player",
  canUse: (state, playerId) =>
    state.players.some((p) => p.id !== playerId) && minigameRegistry.pool("duel").length > 0,
  validate(state, { playerId, targetPlayerId }) {
    requireOpponent(state, playerId, targetPlayerId);
    if (!minigameRegistry.pool("duel").length)
      throw new Error("No duel minigames are available.");
  },
  execute(state, { playerId, targetPlayerId, random, now }) {
    startPocketDuel(state, playerId, findPlayer(state, targetPlayerId!).id, random, now);
    return state;
  },
};

// Owner rule: the owner is immune to the initial blast (they may still be irradiated later by landing
// on the zone). Everyone else standing in the area is KO'd immediately and keeps Radiation after the
// normal respawn at Start.
export const falloutCore: ItemDefinition = {
  id: "fallout-core",
  name: "Fallout Core",
  description: `Pick a space: everyone else on it or a directly connected space is KO'd and irradiated. The area stays radioactive for ${FALLOUT_CONFIG.zoneRounds} full rounds. You are immune to the blast.`,
  rarity: "rare",
  icon: "☢️",
  targeting: "node",
  canUse: () => true,
  execute(state, { playerId, targetNodeId, map }) {
    const nodes = falloutBlastNodes(map, targetNodeId!),
      owner = findPlayer(state, playerId);
    emit(state, {
      kind: "FALLOUT",
      playerId,
      nodeId: targetNodeId,
      text: `☢ ${owner.name.toUpperCase()} DETONATED A FALLOUT CORE`,
    });
    // Snapshot the victims first: a KO respawn must not change who was inside the blast.
    const victims = state.players.filter(
      (p) => p.id !== playerId && nodes.includes(p.currentNodeId),
    );
    for (const victim of victims) {
      knockOut(state, map, victim);
      irradiatePlayer(state, victim.id, "CAUGHT IN THE FALLOUT");
    }
    createRadiationZone(state, playerId, nodes);
    emit(state, {
      kind: "RADIATION",
      playerId,
      nodeId: targetNodeId,
      amount: nodes.length,
      text: `☢ ${nodes.length} SPACES IRRADIATED FOR ${FALLOUT_CONFIG.zoneRounds} ROUNDS`,
    });
    return state;
  },
};

export const wildTotem: ItemDefinition = {
  id: "wild-totem",
  name: "Wild Totem",
  description:
    "Summon a random animal (Cheetah or Crocodile) on your space. It hunts the nearest opponent every Animal Phase for 15 rounds and never hurts you.",
  rarity: "rare",
  icon: "🗿",
  canUse: (state, playerId) => canSummonAnimal(state, playerId),
  blockedReason: (state, playerId) =>
    canSummonAnimal(state, playerId) ? null : "You already have an active summoned animal.",
  execute(state, { playerId, random }) {
    summonAnimal(state, playerId, rollWildTotemAnimal(random), findPlayer(state, playerId).currentNodeId);
    return state;
  },
};
