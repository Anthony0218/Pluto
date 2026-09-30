import { findPlayer } from "../engine/combat.ts";
import { startDuel } from "../duels/duel.ts";
import { hasDuelTarget, validateWager } from "../duels/wager.ts";
import { minigameRegistry } from "../minigames/index.ts";
import type { ItemDefinition } from "./types.ts";
import { requireOpponent } from "./weapons.ts";

// Mandatory challenge: once legally activated, the target cannot refuse. The item is consumed when the
// duel starts (validation happens first, so an illegal target or wager never consumes it).
export const duelSaber: ItemDefinition = {
  id: "duel-saber",
  name: "Duel Saber",
  description:
    "Challenge any opponent to a 1v1 duel minigame for 5, 10, 20 or a custom number of coins, or 1 Golden Pluto. Winner takes the pot.",
  rarity: "uncommon",
  icon: "⚔️",
  targeting: "player",
  canUse: (state, playerId) =>
    hasDuelTarget(state, playerId) && minigameRegistry.pool("duel").length > 0,
  validate(state, { playerId, targetPlayerId, wager }) {
    const defender = requireOpponent(state, playerId, targetPlayerId);
    validateWager(findPlayer(state, playerId), defender, wager);
    if (!minigameRegistry.pool("duel").length)
      throw new Error("No duel minigames are available.");
  },
  execute(state, { playerId, targetPlayerId, wager, random, now }) {
    const defender = findPlayer(state, targetPlayerId!);
    startDuel(
      state,
      playerId,
      defender.id,
      validateWager(findPlayer(state, playerId), defender, wager),
      random,
      now,
    );
    return state;
  },
};
