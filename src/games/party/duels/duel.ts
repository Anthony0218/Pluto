import { findPlayer } from "../engine/combat.ts";
import { bumpStat } from "../engine/stats.ts";
import { emit, log } from "../engine/events.ts";
import { minigameRegistry } from "../minigames/index.ts";
import {
  selectDuelMinigame,
  startDuelMinigame,
} from "../minigames/flow.ts";
import type { MinigameRegistry } from "../minigames/registry.ts";
import type { Random } from "../minigames/types.ts";
import type { DuelWager, Match } from "../types.ts";
import { describeWager } from "./wager.ts";

// Duel Saber flow. A duel interrupts the active player's ITEM_PHASE:
//   ITEM_PHASE → (USE_ITEM duel-saber) → DUEL_INTRO → DUEL_MINIGAME → DUEL_RESULTS → ITEM_PHASE
// or → GAME_OVER when the settlement reaches a victory goal. `match.turn` is never touched, so the
// challenger resumes exactly where they were (not rolled, same Turbo bonus). The round counter, turn
// order and main-minigame rewards are not involved.
//
// Pocket Duel (rare item) runs through exactly the same phases with `kind: "pocket-duel"` and no wager:
// nothing is escrowed, and the winner receives one newly created Golden Pluto; the loser loses nothing.
// This is the only duel outcome that changes the match's Pluto total (Duel Saber only transfers).

// Escrows the stakes and starts a random duel minigame. Callers validate first (see validateWager).
export function startDuel(
  state: Match,
  challengerId: string,
  defenderId: string,
  wager: DuelWager,
  random: Random,
  now: number,
  registry: MinigameRegistry = minigameRegistry,
) {
  const challenger = findPlayer(state, challengerId),
    defender = findPlayer(state, defenderId);
  const minigameId = selectDuelMinigame(state.lastDuelMinigameId, random, registry);
  let pot = 0;
  if (wager.type === "coins") {
    if (challenger.coins < wager.amount || defender.coins < wager.amount)
      throw new Error("Both duelists must be able to cover the wager.");
    challenger.coins -= wager.amount;
    defender.coins -= wager.amount;
    pot = wager.amount * 2;
  }
  state.duel = {
    kind: "duel-saber",
    challengerPlayerId: challengerId,
    defenderPlayerId: defenderId,
    wager,
    pot,
    minigameId,
    winnerPlayerId: null,
    payout: null,
  };
  startDuelMinigame(state, minigameId, [challengerId, defenderId], random, now, registry);
  emit(state, {
    kind: "DUEL_CHALLENGE",
    playerId: challengerId,
    text: `${challenger.name.toUpperCase()} CHALLENGED ${defender.name.toUpperCase()}`,
  });
  emit(state, {
    kind: "DUEL_WAGER",
    playerId: challengerId,
    amount: wager.type === "coins" ? wager.amount : 1,
    text: `WAGER: ${describeWager(wager)}`,
  });
  log(state, `Duel minigame: ${registry.get(minigameId).name}!`);
}

// Starts a wager-free Pocket Duel. Callers validate the target first.
export function startPocketDuel(
  state: Match,
  challengerId: string,
  defenderId: string,
  random: Random,
  now: number,
  registry: MinigameRegistry = minigameRegistry,
) {
  const challenger = findPlayer(state, challengerId),
    defender = findPlayer(state, defenderId);
  const minigameId = selectDuelMinigame(state.lastDuelMinigameId, random, registry);
  state.duel = {
    kind: "pocket-duel",
    challengerPlayerId: challengerId,
    defenderPlayerId: defenderId,
    wager: null,
    pot: 0,
    minigameId,
    winnerPlayerId: null,
    payout: null,
  };
  startDuelMinigame(state, minigameId, [challengerId, defenderId], random, now, registry);
  emit(state, {
    kind: "DUEL_CHALLENGE",
    playerId: challengerId,
    text: `${challenger.name.toUpperCase()} STARTED A POCKET DUEL WITH ${defender.name.toUpperCase()}`,
  });
  log(state, `Pocket Duel minigame: ${registry.get(minigameId).name}! Winner gets a brand-new Golden Pluto.`);
}

// Pays the pot / moves the Pluto to the duel winner (results[0]). Idempotent via `payout`.
// Duel Saber only transfers coins and Plutos; Pocket Duel creates exactly one Pluto for the winner.
export function settleDuel(state: Match) {
  const duel = state.duel,
    winnerId = state.minigame?.results?.[0]?.playerId;
  if (!duel || duel.payout || !winnerId) return;
  const loserId =
    winnerId === duel.challengerPlayerId ? duel.defenderPlayerId : duel.challengerPlayerId;
  const winner = findPlayer(state, winnerId),
    loser = findPlayer(state, loserId);
  duel.winnerPlayerId = winnerId;
  bumpStat(state, winnerId, "duelWins");
  duel.payout = {
    [winnerId]: { coins: 0, plutos: 0 },
    [loserId]: { coins: 0, plutos: 0 },
  };
  emit(state, {
    kind: "DUEL_WON",
    playerId: winnerId,
    text: `${winner.name.toUpperCase()} WON THE DUEL`,
  });
  if (duel.kind === "pocket-duel") {
    winner.goldenPlutos += 1;
    duel.payout[winnerId].plutos = 1;
    emit(state, {
      kind: "DUEL_REWARD",
      playerId: winnerId,
      amount: 1,
      text: `${winner.name.toUpperCase()} RECEIVED 1 NEW GOLDEN PLUTO`,
    });
  } else if (duel.wager?.type === "coins") {
    winner.coins += duel.pot;
    duel.payout[winnerId].coins = duel.pot;
    emit(state, {
      kind: "DUEL_REWARD",
      playerId: winnerId,
      amount: duel.pot,
      text: `${winner.name.toUpperCase()} RECEIVED ${duel.pot} COINS`,
    });
    duel.pot = 0;
  } else if (duel.wager?.type === "pluto" && loser.goldenPlutos >= 1) {
    // Every board action is locked during the duel, so the loser still holds the staked Pluto.
    loser.goldenPlutos -= 1;
    winner.goldenPlutos += 1;
    duel.payout[winnerId].plutos = 1;
    duel.payout[loserId].plutos = -1;
    emit(state, {
      kind: "DUEL_REWARD",
      playerId: winnerId,
      amount: 1,
      text: `1 GOLDEN PLUTO TRANSFERRED FROM ${loser.name.toUpperCase()} TO ${winner.name.toUpperCase()}`,
    });
  }
}

// Clears all duel-only state. The phase returns to the challenger's ITEM_PHASE unless the match is over.
export function endDuel(state: Match) {
  state.lastDuelMinigameId = state.minigame?.minigameId ?? state.lastDuelMinigameId;
  state.minigame = null;
  state.duel = null;
  state.phase = state.winner ? "GAME_OVER" : "ITEM_PHASE";
}
