import { difficultyRank } from "../difficulty.ts";
import {
  AIM_CONFIG,
  DUEL_BOT_SKILL,
  LUCKY_SIX_CONFIG,
  RULES,
} from "../config.ts";
import { canChallenge, canWagerPluto, maxCoinWager } from "../duels/wager.ts";
import { botAimRelease } from "../items/aim.ts";
import { boardDistance, scatterBand } from "../items/weapons.ts";
import type {
  BoardMap,
  DuelWager,
  GameAction,
  ItemInstance,
  Match,
  Player,
  Settings,
} from "../types.ts";
import type { Random } from "./engine.ts";

// Board-bot decisions for the Milestone 7 items. Every action is still validated by the authority.

// Chance that a bot's aim (Gaussian error per axis) lands within `radius` of the target.
function hitChance(player: Player, radius: number): number {
  const sigma = AIM_CONFIG.botError[player.difficulty];
  return 1 - Math.exp(-(radius * radius) / (2 * sigma * sigma));
}
const pick = <T,>(items: readonly T[], random: Random): T =>
  items[Math.min(items.length - 1, Math.floor(random() * items.length))];
// Opponent closest to winning under the current victory condition.
function leader(opponents: Player[], settings: Settings): Player {
  return [...opponents].sort((a, b) =>
    settings.victory === "plutos"
      ? b.goldenPlutos - a.goldenPlutos || b.coins - a.coins
      : b.coins - a.coins || b.goldenPlutos - a.goldenPlutos,
  )[0];
}

function scatterblasterAction(
  state: Match,
  map: BoardMap,
  me: Player,
  item: ItemInstance,
  random: Random,
): GameAction | null {
  let best: { id: string; value: number } | null = null;
  for (const target of state.players) {
    if (target.id === me.id) continue;
    const band = scatterBand(boardDistance(map, me.currentNodeId, target.currentNodeId));
    if (!band) continue;
    const centered = hitChance(me, band.centerRadius),
      hit = hitChance(me, band.hitRadius);
    const expected = centered * band.damage.centered + (hit - centered) * band.damage.partial;
    // Prefer targets the shot could knock out.
    const value = expected + (target.hp <= band.damage.partial ? 8 : 0);
    if (value > (best?.value ?? 0)) best = { id: target.id, value };
  }
  if (!best) return null;
  if (difficultyRank(me.difficulty) <= 1 ? random() < 0.4 : best.value < 5) return null;
  return { type: "USE_ITEM", itemInstanceId: item.instanceId, targetPlayerId: best.id };
}

function luckySixAction(
  state: Match,
  me: Player,
  item: ItemInstance,
  random: Random,
  settings: Settings,
): GameAction | null {
  const opponents = state.players.filter((p) => p.id !== me.id);
  let target: Player;
  if (difficultyRank(me.difficulty) <= 1) target = pick(opponents, random);
  else {
    const killable = opponents.filter((p) => p.hp <= LUCKY_SIX_CONFIG.damage);
    target = killable.length
      ? leader(killable, settings)
      : me.difficulty === "extreme"
        ? leader(opponents, settings)
        : [...opponents].sort((a, b) => a.hp - b.hp)[0];
  }
  return { type: "USE_ITEM", itemInstanceId: item.instanceId, targetPlayerId: target.id };
}

// Chance the bot believes it has of winning a duel against `opponent` (humans count as medium).
function duelOdds(me: Player, opponent: Player): number {
  const mine = DUEL_BOT_SKILL[me.difficulty],
    theirs = DUEL_BOT_SKILL[opponent.isBot ? opponent.difficulty : "medium"];
  return mine / (mine + theirs);
}

function duelSaberAction(
  state: Match,
  me: Player,
  item: ItemInstance,
  random: Random,
  settings: Settings,
): GameAction | null {
  const legal = state.players.filter((p) => canChallenge(me, p));
  if (!legal.length) return null;
  const challengeWith = (target: Player, wager: DuelWager): GameAction => ({
    type: "USE_ITEM",
    itemInstanceId: item.instanceId,
    targetPlayerId: target.id,
    wager,
  });
  if (difficultyRank(me.difficulty) <= 1) {
    // Mostly random legal choice.
    const target = pick(legal, random),
      max = maxCoinWager(me, target),
      options: DuelWager[] = [5, 10, 20]
        .filter((a) => a <= max)
        .map((amount) => ({ type: "coins", amount }));
    if (max >= 1) options.push({ type: "coins", amount: 1 + Math.floor(random() * max) });
    if (canWagerPluto(me, target)) options.push({ type: "pluto", amount: 1 });
    return challengeWith(target, pick(options, random));
  }
  if (difficultyRank(me.difficulty) <= 3) {
    // Small, safe coin stakes against whoever can cover them; never most of its own coins.
    const budget = Math.floor(me.coins / 3);
    const target = [...legal].sort((a, b) => b.coins - a.coins)[0],
      max = Math.min(maxCoinWager(me, target), budget),
      amount = max >= 10 ? 10 : max >= 5 ? 5 : max;
    return amount >= 1 ? challengeWith(target, { type: "coins", amount }) : null;
  }
  // Hard: weigh its duel odds, the victory condition and how close everyone is to the goal.
  const ranked = [...legal].sort((a, b) => duelOdds(me, b) - duelOdds(me, a));
  if (settings.victory === "plutos") {
    const plutoTarget = ranked.find(
      (p) =>
        canWagerPluto(me, p) &&
        duelOdds(me, p) >= 0.5 &&
        (p.goldenPlutos >= settings.plutoTarget - 1 ||
          me.goldenPlutos >= settings.plutoTarget - 1 ||
          p.goldenPlutos >= me.goldenPlutos),
    );
    if (plutoTarget) return challengeWith(plutoTarget, { type: "pluto", amount: 1 });
    // Otherwise only spend coins it does not need for the next Pluto.
    const spare = me.coins - RULES.plutoPrice;
    const target = ranked[0],
      amount = Math.min(maxCoinWager(me, target), spare, 10);
    return amount >= 5 && duelOdds(me, target) >= 0.5
      ? challengeWith(target, { type: "coins", amount })
      : null;
  }
  const target = ranked[0],
    odds = duelOdds(me, target),
    max = maxCoinWager(me, target),
    needed = settings.coinTarget - me.coins;
  if (odds < 0.45 || max < 1) return null;
  // A pot that reaches the goal is worth going all in for; otherwise scale the stake with the odds.
  const amount =
    needed > 0 && needed <= max ? needed : Math.min(max, odds >= 0.55 ? 20 : 10);
  return challengeWith(target, { type: "coins", amount: Math.max(1, amount) });
}

// Returns an action for a player-targeted Milestone 7 item, or null to keep it for later.
export function playerTargetedItemAction(
  state: Match,
  map: BoardMap,
  me: Player,
  item: ItemInstance,
  random: Random,
  settings: Settings,
): GameAction | null {
  switch (item.itemId) {
    case "scatterblaster":
      return scatterblasterAction(state, map, me, item, random);
    case "lucky-six":
      return luckySixAction(state, me, item, random, settings);
    case "duel-saber":
      return duelSaberAction(state, me, item, random, settings);
    default:
      return null;
  }
}

// A bot releases its shot shortly after aiming starts, with difficulty-based error.
export function botFire(state: Match, me: Player, random: Random, now: number): GameAction | null {
  const aim = state.turn.aim;
  if (!aim || aim.playerId !== me.id) return null;
  if (now - aim.startedAt < 600) return null;
  const release = botAimRelease(aim, me.difficulty, Math.min(now, aim.expiresAt), random);
  return { type: "FIRE_ITEM", ...release };
}

