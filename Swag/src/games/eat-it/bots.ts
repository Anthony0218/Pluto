import { EAT, FOOD, massToRadius } from './config.ts';
import { clearPath, distance, validPosition, zoneRadius } from './maps.ts';
import { angleDelta, foodFits } from './rules.ts';
import type { GameState, Input, Player, Vec } from './types.ts';
export function botInput(state: GameState, bot: Player): Input {
  const r = massToRadius(bot.mass), nearby = state.players.filter(p => p.alive && p.id !== bot.id && distance(p, bot) < EAT.bots.vision && clearPath(state.map, bot, p));
  const threats = nearby.filter(p => massToRadius(p.mass) >= r * EAT.eating.playerEatRadiusRatio && bot.effects.shield <= state.time);
  threats.sort((a, b) => distance(a, bot) - distance(b, bot));
  let target: Vec;
  const threat = threats[0];
  if (threat && distance(threat, bot) < EAT.bots.threatRange + massToRadius(threat.mass)) {
    bot.botState = 'FLEE';
    const dangerFacing = Math.abs(angleDelta(threat.facing, Math.atan2(bot.y - threat.y, bot.x - threat.x))) < Math.PI / 2;
    // Add a lateral escape when looking straight into a larger mouth.
    const dx = bot.x - threat.x, dy = bot.y - threat.y;
    target = { x: bot.x + dx - (dangerFacing ? dy * 0.5 : 0), y: bot.y + dy + (dangerFacing ? dx * 0.5 : 0) };
  } else {
    const edible = nearby.filter(p => r >= massToRadius(p.mass) * EAT.eating.playerEatRadiusRatio && p.effects.shield <= state.time).sort((a, b) => distance(a, bot) - distance(b, bot))[0];
    const power = state.powerups.filter(p => distance(p, bot) < 260 && clearPath(state.map, bot, p, r)).sort((a, b) => distance(a, bot) - distance(b, bot))[0];
    const food = state.food.filter(f => !f.target && foodFits(bot, f) && distance(f, bot) < EAT.bots.vision && clearPath(state.map, bot, f, r)).sort((a, b) => distance(a, bot) / Math.sqrt(FOOD[a.kind].mass) - distance(b, bot) / Math.sqrt(FOOD[b.kind].mass))[0];
    if (power && (power.kind === 'growth' || power.kind === 'shield' || !edible)) { bot.botState = 'POWERUP'; target = power; }
    else if (edible && distance(edible, bot) < EAT.bots.huntRange) { bot.botState = 'HUNT'; target = { x: edible.x + edible.vx * 0.2, y: edible.y + edible.vy * 0.2 }; }
    else if (food) { bot.botState = 'FORAGE'; target = food; }
    else { bot.botState = 'REPOSITION'; const angle = state.time * 0.16 + state.players.indexOf(bot) * 2.4; target = { x: 1100 + Math.cos(angle) * 400, y: 800 + Math.sin(angle) * 340 }; }
  }
  const center = { x: EAT.match.width / 2, y: EAT.match.height / 2 };
  if (distance(bot, center) > zoneRadius(state.time) - r - 80) { target = center; bot.botState = 'REPOSITION'; }
  const desired = Math.atan2(target.y - bot.y, target.x - bot.x);
  // Steer around solids using only visible geometry, with a stable side preference.
  const side = state.players.indexOf(bot) % 2 ? -1 : 1;
  for (const offset of [0, side * 0.5, -side * 0.5, side, -side, side * 1.6, -side * 1.6, Math.PI]) {
    const angle = desired + offset, input = { x: Math.cos(angle), y: Math.sin(angle) };
    const ahead = { x: bot.x + input.x * (r + 65), y: bot.y + input.y * (r + 65) };
    if (validPosition(state.map, ahead, r + 5) && clearPath(state.map, bot, ahead, r)) return input;
  }
  return { x: 0, y: 0 };
}
