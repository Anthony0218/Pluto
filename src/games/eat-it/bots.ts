import { activateAbility, canStorePower } from './abilities.ts';
import { canUnderpass, activateGrowth } from './progression.ts';
import { objectContact } from './physics.ts';
import { shrineClear } from './quests.ts';
import { EAT, FOOD, playerRadius } from './config.ts';
import { clearPath, distance, validPosition, zoneRadius } from './maps.ts';
import { angleDelta, foodFits, canopyFits, playerFits, isChoking } from './rules.ts';
import { tooLongToSwallow } from './falling.ts';
import type { GameState, Input, Player, Vec } from './types.ts';
export const BOT_POLICY = {
  // Tuned in the player's favour: slower reactions, weaker hunting, and small speed and normal-map growth handicaps.
  hard: { interval: .3, threat: .85, hunt: .7, prediction: .12, power: 220, reward: .38, hellSamples: 12, warningDelay: .2, escapeDelay: 0, speed: .96, growth: .92 },
  medium: { interval: .58, threat: .66, hunt: .34, prediction: .04, power: 170, reward: .2, hellSamples: 10, warningDelay: .5, escapeDelay: .55, speed: .9, growth: .82 },
  easy: { interval: .95, threat: .48, hunt: .1, prediction: 0, power: 120, reward: .08, hellSamples: 8, warningDelay: .85, escapeDelay: .95, speed: .83, growth: .7 },
} as const;
export const botPolicy = (s: GameState) => BOT_POLICY[s.settings?.mode === 'solo' ? s.settings.botDifficulty ?? 'medium' : 'hard'];
export function botInput(state: GameState, bot: Player): Input {
  if (isChoking(bot, state.time)) return { x: 0, y: 0 };
  const policy = botPolicy(state);
  if (bot.storedGrowth) {
    const meals = state.food.filter(f => !f.target && distance(f, bot) < 260 && foodFits(bot, f, state.time) && clearPath(state.map, bot, f));
    const friendly = state.encounter?.npc.phase === 'friendly' && state.encounter.npc.targetId === bot.id;
    if (policy === BOT_POLICY.easy || meals.length >= (policy === BOT_POLICY.hard ? 5 : 2) || friendly || meals.some(f => FOOD[f.kind].growth >= 45)) activateGrowth(state, bot);
  }
  const r = playerRadius(bot, state.time), nearby = state.players.filter(p => p.alive && p.id !== bot.id && distance(p, bot) < EAT.bots.vision && clearPath(state.map, bot, p));
  const threats = nearby.filter(p => playerRadius(p, state.time) >= r * EAT.eating.playerEatRadiusRatio && bot.effects.shield <= state.time);
  threats.sort((a, b) => distance(a, bot) - distance(b, bot));
  let target: Vec;
  const threat = threats[0];
  if (threat && distance(threat, bot) < EAT.bots.threatRange * policy.threat + playerRadius(threat, state.time)) {
    bot.botState = 'FLEE';
    const dangerFacing = Math.abs(angleDelta(threat.facing, Math.atan2(bot.y - threat.y, bot.x - threat.x))) < Math.PI / 2;
    // Add a lateral escape when looking straight into a larger mouth.
    const dx = bot.x - threat.x, dy = bot.y - threat.y;
    target = { x: bot.x + dx - (dangerFacing ? dy * 0.5 : 0), y: bot.y + dy + (dangerFacing ? dx * 0.5 : 0) };
  } else {
    const edible = nearby.filter(p => playerFits(bot, p, state.time)).sort((a, b) => distance(a, bot) - distance(b, bot))[0];
    const power = state.powerups.filter(p => canStorePower(state,bot,p.kind) && (p.kind !== 'divider' || policy === BOT_POLICY.easy && (Math.floor(state.time / 5) + state.players.indexOf(bot)) % 3 === 0 || policy === BOT_POLICY.medium && distance(p, bot) < 30) && distance(p, bot) < policy.power && clearPath(state.map, bot, p, r)).sort((a, b) => distance(a, bot) - distance(b, bot))[0];
    const food = state.food.filter(f => !f.target && canopyFits(bot, f, state.time) && foodFits(bot, f, state.time) && !tooLongToSwallow(bot, f.kind, state.time) && distance(f, bot) < EAT.bots.vision && clearPath(state.map, bot, f, r)).sort((a, b) => distance(a, bot) / FOOD[a.kind].growth ** policy.reward - distance(b, bot) / FOOD[b.kind].growth ** policy.reward)[0];
    if (power && (power.kind === 'multiplier' || power.kind === 'shield' || !edible)) { bot.botState = 'POWERUP'; target = power; }
    else if (edible && distance(edible, bot) < EAT.bots.huntRange * policy.hunt) { bot.botState = 'HUNT'; target = { x: edible.x + edible.vx * policy.prediction, y: edible.y + edible.vy * policy.prediction }; }
    else if (food) { bot.botState = 'FORAGE'; target = food; }
    else { bot.botState = 'REPOSITION'; const angle = state.time * 0.16 + state.players.indexOf(bot) * 2.4; target = { x: EAT.match.width / 2 + Math.cos(angle) * EAT.match.width * .34, y: EAT.match.height / 2 + Math.sin(angle) * EAT.match.height * .34 }; }
  }
  const center = { x: EAT.match.width / 2, y: EAT.match.height / 2 };
  if (!state.settings?.matchDuration && !state.settings?.hellEnabled && distance(bot, center) > zoneRadius(state.time) - r - 80) { target = center; bot.botState = 'REPOSITION'; }
  const desired = Math.atan2(target.y - bot.y, target.x - bot.x);
  // Steer around solids using only visible geometry, with a stable side preference.
  const side = state.players.indexOf(bot) % 2 ? -1 : 1;
  // Props that would jam (too tall to tip in) are steered around like solid ones.
  const blockers = state.food.filter(f => !f.target && distance(bot, f) < EAT.bots.vision &&
    (!foodFits(bot, f, state.time) || tooLongToSwallow(bot, f.kind, state.time)));
  for (const offset of [0, side * 0.5, -side * 0.5, side, -side, side * 1.6, -side * 1.6, Math.PI]) {
    const angle = desired + offset, input = { x: Math.cos(angle), y: Math.sin(angle) };
    const ahead = { x: bot.x + input.x * (r + 65), y: bot.y + input.y * (r + 65) };
    const avoidsDivider = policy !== BOT_POLICY.easy && state.powerups.some(item => item.kind === 'divider' && distance(item,bot) < policy.power && distance(item,ahead) < r+EAT.powerups.radius+20 && distance(item,ahead)<distance(item,bot));
    const blocked = avoidsDivider || blockers.some(f => {
      // Use the same rotated footprint as physics so the enclosing circle of a
      // long bench/car cannot falsely seal an otherwise navigable corridor.
      for (const t of [.35, .7, 1]) {
        const point = { x: bot.x + (ahead.x - bot.x) * t, y: bot.y + (ahead.y - bot.y) * t };
        if ((canUnderpass(bot, f, state.time) ? null : objectContact(point, r + 3, f)) && distance(f, point) < distance(f, bot)) return true;
      }
      return false;
    });
    if (!blocked && shrineClear(state, bot, ahead, r) && validPosition(state.map, ahead, r + 5) && clearPath(state.map, bot, ahead, r)) {
      const line = nearby.some(p=>playerFits(bot,p,state.time) && distance(p,bot)<r+EAT.powerups.strike.distance*(policy===BOT_POLICY.easy?1.6:policy===BOT_POLICY.medium?1.2:1) && Math.abs(angleDelta(angle,Math.atan2(p.y-bot.y,p.x-bot.x)))<(policy===BOT_POLICY.hard?.2:.4));
      if(bot.storedStrike && (line || bot.botState==='FLEE' && policy===BOT_POLICY.hard)) {bot.input=input;activateAbility(state,bot,'strike');}
      return input;
    }
  }
  return { x: 0, y: 0 };
}
