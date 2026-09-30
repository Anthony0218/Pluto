import { RULES } from "../config.ts";
import { damagePlayer, findPlayer, healPlayer } from "../engine/combat.ts";
import { emit } from "../engine/events.ts";
import { graphDistances } from "../engine/graph.ts";
import { rollBonus } from "./dice.ts";
import type { ItemDefinition } from "./types.ts";

// Damage by graph distance from the target node; distances beyond the table deal nothing.
export function cometMelonDamage(distance: number | undefined): number {
  return distance === undefined ? 0 : (RULES.cometMelonDamage[distance] ?? 0);
}

export const megaMedkit: ItemDefinition = {
  id: "mega-medkit",
  name: "Mega Medkit",
  description: `Restore ${RULES.megaMedkitHeal} HP, up to ${RULES.maxHp}. Unusable at full HP.`,
  rarity: "common",
  icon: "🧰",
  canUse: (state, playerId) => {
    const player = findPlayer(state, playerId);
    return player.hp < player.maxHp;
  },
  execute(state, { playerId }) {
    healPlayer(state, playerId, RULES.megaMedkitHeal);
    return state;
  },
};

export const turboBoots: ItemDefinition = {
  id: "turbo-boots",
  name: "Turbo Boots",
  description: `Bonus 0–${RULES.turboBootsMax} spaces added to this turn's roll. Use before rolling.`,
  rarity: "common",
  icon: "👟",
  canUse: (state) => !state.turn.bonusRolled,
  execute(state, { playerId, random }) {
    const bonus = rollBonus(random);
    state.turn.bonusMovement = bonus;
    state.turn.bonusRolled = true;
    emit(state, {
      kind: "BONUS_ROLL",
      playerId,
      amount: bonus,
      text: `${findPlayer(state, playerId).name.toUpperCase()} TURBO BOOTS +${bonus} MOVES`,
    });
    return state;
  },
};

export const cometMelon: ItemDefinition = {
  id: "comet-melon",
  name: "Comet Melon",
  description:
    "Pick a space: 15 damage there, 10 one space away, 5 two away. Never hurts you.",
  rarity: "uncommon",
  icon: "🍉",
  targeting: "node",
  canUse: () => true,
  execute(state, { playerId, targetNodeId, map }) {
    if (!targetNodeId || !map.nodes.some((n) => n.id === targetNodeId))
      throw new Error("Choose a space on the board.");
    const owner = findPlayer(state, playerId),
      distances = graphDistances(
        map,
        targetNodeId,
        RULES.cometMelonDamage.length - 1,
      );
    emit(state, {
      kind: "EXPLOSION",
      playerId,
      nodeId: targetNodeId,
      text: `${owner.name.toUpperCase()} THREW A COMET MELON`,
    });
    // Snapshot positions first: a KO respawn during resolution must not change who is in range.
    const victims = state.players
      .filter((p) => p.id !== playerId)
      .map((p) => ({
        player: p,
        damage: cometMelonDamage(distances.get(p.currentNodeId)),
      }))
      .filter((v) => v.damage > 0);
    for (const { player, damage } of victims) {
      emit(state, {
        kind: "HIT",
        playerId: player.id,
        amount: damage,
        text: `${owner.name.toUpperCase()} HIT ${player.name.toUpperCase()} FOR ${damage}`,
      });
      damagePlayer(state, map, player.id, damage);
    }
    return state;
  },
};
