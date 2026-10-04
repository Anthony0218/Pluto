import { encounterScale, questScale } from './scaling.ts';
import { newStats, recordEvent, grantGrowth, countCollected } from './progression.ts';
import { EAT, FOOD, playerRadius } from './config.ts';
import { clamp, clearPath, distance, resolveWalls, validPosition } from './maps.ts';
import { objectContact } from './physics.ts';
import { angleDelta, isChoking, mouthPosition, MOUTH, overFoodMouth } from './rules.ts';
import { random, spawnPosition } from './spawn.ts';
import type { Encounter, GameEvent, GameState, NpcPhase, Player, Vec } from './types.ts';

export const QUEST = { pigeonGrowth: 80, catGrowth: 120, feedGrowth: 30, alertRadius: 230, handReach: 42, handContact: 13, duration: EAT.escape.friendshipDuration, feedInterval: 4, attackInterval: 5, hostileDuration: 20, stunDuration: .5, shrineRadius: 66 } as const;
const neutral = (phase: NpcPhase) => ['idle', 'wandering', 'running', 'flying'].includes(phase);
export const npcRadius = (e: Encounter) => (e.npc.kind === 'pigeon' ? 16 : 22) * (e.npc.scale ?? 1);
function event(s: GameState, type: GameEvent['type'], p: Player) {
  recordEvent(s, { type, playerId: p.id, x: p.x, y: p.y });
}
export function createEncounter(s: GameState) {
  if (s.settings?.animalsEnabled === false) { delete s.encounter; return; }
  const home = spawnPosition(s, 190);
  if (!home) return;
  const position = spawnPosition(s, 110) ?? { x: home.x + 220, y: home.y };
  const shrine = s.map === 'city' ? home : null;
  const itemHome = { x: home.x + (shrine ? 105 : 0), y: home.y };
  s.encounter = { shrine, completedBy: null,
    item: { ...itemHome, home: itemHome, kind: shrine ? 'scroll' : 'catTree', ownerId: null, status: 'ground' },
    npc: { ...position, kind: shrine ? 'pigeon' : 'cat', phase: 'idle', since: 0, until: 1, facing: 0,
      destination: position, targetId: null, nextAction: 0, actionAt: -100, attacks: 0, feeds: 0, origin: position } };
}
/** Shared geometry: only this hand endpoint can claim a quest object. */
export function handPose(p: Player, s: GameState): { root: Vec; tip: Vec } | null {
  const e = s.encounter;
  if (!e || !p.alive || p.escape || e.item.status === 'removed') return null;
  const r = playerRadius(p, s.time), carrying = e.item.status === 'carried' && e.item.ownerId === p.id;
  let angle = p.facing + 1.0;
  const target = carrying ? (neutral(e.npc.phase) && distance(p, e.npc) < r + 110 ? e.npc : null) : e.item;
  if (!carrying && (e.item.status !== 'ground' || distance(p, e.item) > r + 100)) return null;
  if (target) angle = Math.atan2(target.y - p.y, target.x - p.x);
  const reach = target ? clamp(distance(p, target), r + 18, r + QUEST.handReach) : r + 32 * questScale(r);
  return { root: { x: p.x + Math.cos(angle) * r * .95, y: p.y + Math.sin(angle) * r * .95 },
    tip: { x: p.x + Math.cos(angle) * reach, y: p.y + Math.sin(angle) * reach } };
}
export function questAlert(s: GameState, p: Player, previouslyVisible = false) {
  const e = s.encounter;
  return !!e && p.alive && neutral(e.npc.phase) && !e.completedBy &&
    distance(p, e.npc) < playerRadius(p, s.time) + QUEST.alertRadius + (previouslyVisible ? 30 : 0);
}
export function npcCanEnter(s: GameState, p: Player) {
  const e = s.encounter;
  return !!e && neutral(e.npc.phase) && e.npc.phase !== 'flying' && p.alive && !p.escape && !isChoking(p, s.time) &&
    npcRadius(e) < playerRadius(p, s.time) * MOUTH.radius && overFoodMouth(p, e.npc, s.time) && clearPath(s.map, p, e.npc) && shrineClear(s, p, e.npc);
}
/** The shrine is the only fixed raised landmark. */
export function resolveShrine(s: Pick<GameState, 'encounter'>, p: Vec, radius: number) {
  const shrine = s.encounter?.shrine;
  if (!shrine || 'mass' in p) return;
  const d = distance(p, shrine), limit = radius + QUEST.shrineRadius;
  if (d < limit) { const nx = d > .001 ? (p.x - shrine.x) / d : 1, ny = d > .001 ? (p.y - shrine.y) / d : 0; p.x = shrine.x + nx * limit; p.y = shrine.y + ny * limit; }
}
export function shrineClear(s: GameState, a: Vec, b: Vec, radius = 0) {
  const shrine = s.encounter?.shrine;
  if (!shrine || 'mass' in a) return true;
  const dx = b.x - a.x, dy = b.y - a.y, t = clamp(((shrine.x - a.x) * dx + (shrine.y - a.y) * dy) / Math.max(.001, dx * dx + dy * dy), 0, 1);
  return distance(shrine, { x: a.x + dx * t, y: a.y + dy * t }) >= QUEST.shrineRadius + radius;
}
export function releaseQuest(s: GameState, playerId: string) {
  const e = s.encounter;
  if (!e) return;
  for (const f of s.food) if (f.rewardOwner === playerId) { delete f.rewardOwner; delete f.rewardMultiplier; }
  if (e.item.ownerId === playerId && e.item.status === 'carried') {
    // The original clear landmark is reserved by spawn management throughout play.
    Object.assign(e.item, e.item.home, { status: 'ground', ownerId: null });
  }
  if (e.npc.targetId === playerId) leave(s);
}
export function finishEncounter(s: GameState) {
  if (!s.encounter) return;
  s.encounter.item.status = 'removed'; s.encounter.item.ownerId = null;
  s.encounter.npc.targetId = null; s.encounter.npc.phase = 'gone';
  // End active NPC timers without altering remaining physical props.
  s.encounter.npc.until = 0; s.encounter.npc.nextAction = 0;
}
function phase(s: GameState, next: NpcPhase, duration: number) {
  const n = s.encounter!.npc; n.phase = next; n.since = s.time; n.until = s.time + duration;
}
function leave(s: GameState) {
  phase(s, 'leaving', .8); const e = s.encounter!; e.npc.targetId = null; e.npc.nextAction = 0;
  if (e.item.status !== 'delivered') { e.item.status = 'removed'; e.item.ownerId = null; }
}
function moveNpc(s: GameState, target: Vec, speed: number, dt: number, airborne = false) {
  const e = s.encounter!, n = e.npc, d = distance(n, target);
  if (d < 2) return;
  n.facing += clamp(angleDelta(n.facing, Math.atan2(target.y - n.y, target.x - n.x)), -dt * 4, dt * 4);
  if(n.phase==='friendly') n.facing=Math.atan2(target.y-n.y,target.x-n.x);
  n.x += Math.cos(n.facing) * Math.min(d, speed * dt); n.y += Math.sin(n.facing) * Math.min(d, speed * dt);
  if (airborne) { const r = npcRadius(e); n.x = clamp(n.x, r, EAT.match.width - r); n.y = clamp(n.y, r, EAT.match.height - r); return; }
  const before = { x: n.x, y: n.y };
  resolveWalls(s.map, n, npcRadius(e)); resolveShrine(s, n, npcRadius(e));
  for (const f of s.food) {
    if (f.target || f.z > 20 || FOOD[f.kind].mass < 70 || n.phase==='friendly' && FOOD[f.kind].underpassClearance>0 || distance(n, f) > FOOD[f.kind].radius + npcRadius(e)) continue;
    const contact = objectContact(n, npcRadius(e), f);
    if (contact) { n.x -= contact.nx * contact.overlap; n.y -= contact.ny * contact.overlap; }
  }
  resolveWalls(s.map, n, npcRadius(e));
  if (distance(before, n) > 1 && neutral(n.phase)) n.until = Math.min(n.until, s.time + .1);
}
/** Runs only in the shared authority loop. Clients interpolate transforms only. */
export function stepEncounter(s: GameState, dt: number) {
  if (s.settings?.animalsEnabled === false) { delete s.encounter; for (const p of s.players) { delete p.helper; delete p.escape; } return; }
  const e = s.encounter;
  if (!e) return;
  const n = e.npc, item = e.item;
  if (e.shrine && ['delivered','removed'].includes(item.status) && s.food.length < EAT.food.maxObjects) {
    s.food.push({ ...e.shrine, id:s.nextId++,kind:'shrine',vx:0,vy:0,z:0,vz:0,rotation:0,target:null,capturedAt:0 });
    e.shrine = null;
  }
  n.scale = encounterScale(s);
  if (s.status !== 'playing' || (s.phase && s.phase !== 'normal')) { finishEncounter(s); return; }
  if (n.phase === 'gone') return;
  if (n.phase === 'leaving') { if (s.time >= n.until) { n.phase = 'gone'; n.until = 0; } return; }
  if (item.ownerId && !s.players.some(p => p.id === item.ownerId && p.alive)) releaseQuest(s, item.ownerId);
  const target = s.players.find(p => p.id === n.targetId && p.alive);
  if (n.targetId && !target) { leave(s); return; }
  if (n.phase === 'friendly' && target) {
    const stats=target.stats??=newStats(); stats.companionSeconds=(stats.companionSeconds??0)+Math.max(0,Math.min(dt,n.until-(s.time-dt)));
    if(s.time+1e-6>=n.until){delete target.helper;leave(s);return;}
  }
  if (target?.escape) { n.x = target.x; n.y = target.y; n.facing = target.facing; return; }
  // Item reservation and handover happen before mouth checks, once in player order.
  for (const p of s.players) {
    const hand = handPose(p, s);
    if (!hand || isChoking(p, s.time)) continue;
    if (item.status === 'ground' && neutral(n.phase) && distance(hand.tip, item) <= QUEST.handContact && clearPath(s.map, p, item) && shrineClear(s, p, item)) {
      item.status = 'carried'; item.ownerId = p.id; event(s, 'questPickup', p);
    }
    if (item.status === 'carried' && item.ownerId === p.id) {
      const pose = handPose(p, s)!; item.x = pose.tip.x; item.y = pose.tip.y;
      if (neutral(n.phase) && distance(pose.tip, n) < npcRadius(e) + QUEST.handContact && clearPath(s.map, p, n) && shrineClear(s, p, n)) {
        item.status = 'delivered'; item.ownerId = null; e.completedBy = p.id; n.targetId = p.id;
        const stats = p.stats ??= newStats(); if (n.kind === 'pigeon') stats.pigeonQuest = true; else stats.catQuest = true;
        p.helper = { kind: n.kind, until: s.time + QUEST.duration, used: false, hell: false };
        phase(s, 'friendly', QUEST.duration); n.nextAction = s.time + QUEST.feedInterval; n.actionAt = s.time;
        event(s, 'questComplete', p); return;
      }
    }
  }
  if (n.phase === 'swallowing' && target) {
    const m = mouthPosition(target, playerRadius(target, s.time)); n.x = m.x; n.y = m.y;
    if (s.time >= n.until) {
      const reward = n.kind === 'pigeon' ? QUEST.pigeonGrowth : QUEST.catGrowth;
      grantGrowth(s, target, reward / Math.max(1, Math.sqrt(target.mass / 1800))); countCollected(target, n.kind);
      target.foodEaten++; target.score += reward * 5;
      phase(s, 'devoured', 2); event(s, 'food', target);
    }
    return;
  }
  if (n.phase === 'devoured' && target) {
    const m = mouthPosition(target, playerRadius(target, s.time)); n.x = m.x; n.y = m.y;
    if (s.time >= n.until) { phase(s, 'emerging', .65); n.origin = { x: n.x, y: n.y }; event(s, 'npcEmerge', target); }
    return;
  }
  if (n.phase === 'emerging' && target) {
    const t = clamp((s.time - n.since) / .65, 0, 1), r = playerRadius(target, s.time);
    n.x = n.origin.x + Math.cos(target.facing) * (r + 60) * t;
    n.y = n.origin.y + Math.sin(target.facing) * (r + 60) * t;
    if (n.kind === 'cat') resolveWalls(s.map, n, npcRadius(e));
    else { n.x = clamp(n.x, npcRadius(e), EAT.match.width-npcRadius(e)); n.y = clamp(n.y, npcRadius(e), EAT.match.height-npcRadius(e)); }
    if (s.time >= n.until) { phase(s, 'hostile', QUEST.hostileDuration); n.nextAction = s.time + QUEST.attackInterval; }
    return;
  }
  if ((n.phase === 'friendly' || n.phase === 'hostile') && target) {
    // Inclusive deadline permits the final discrete attack at 20 seconds.
    if (s.time + 1e-6 >= n.nextAction && n.nextAction <= n.until + 1e-6) {
      n.actionAt = s.time;
      if (n.phase === 'friendly') {
        if (s.food.length < EAT.food.maxObjects) {
          s.food.push({ x: n.x, y: n.y, id: s.nextId++, kind: 'apple', vx: 0, vy: 0, z: 38, vz: -35, rotation: 0,
            target: null, capturedAt: 0, rewardGrowth: QUEST.feedGrowth, rewardOwner: target.id, delivery: { from: { x: n.x, y: n.y }, startedAt: s.time, duration: .65, height: n.kind === 'pigeon' ? 85 : 18 } });
          n.feeds++; const stats=target.stats??=newStats();stats.companionFeeds=(stats.companionFeeds??0)+1; event(s, 'npcFeed', target);
        }
        n.nextAction += QUEST.feedInterval;
      } else {
        // A hit is discrete and requires proximity. A player can evade an obstructed cat.
        if (distance(n, target) < playerRadius(target, s.time) + 100) {
          target.stunnedUntil = Math.max(target.stunnedUntil ?? 0, s.time + QUEST.stunDuration); target.vx = target.vy = 0; n.attacks++;
          const stats = target.stats ??= newStats(); stats.hostileAttacks = (stats.hostileAttacks ?? 0) + 1;
          event(s, 'npcAttack', target);
        }
        n.nextAction += QUEST.attackInterval;
      }
    }
    if (s.time + 1e-6 >= n.until) { leave(s); return; }
    const attacking = n.phase === 'hostile' && (n.nextAction - s.time < .7 || s.time - n.actionAt < .3);
    const angle = s.time * (n.kind === 'pigeon' ? 1.7 : .7), r = attacking ? playerRadius(target, s.time) * .55 : playerRadius(target, s.time) + 48;
    moveNpc(s, { x: target.x + Math.cos(attacking ? target.facing : angle) * r, y: target.y + Math.sin(attacking ? target.facing : angle) * r }, n.phase === 'hostile' ? 340 : Math.max(300,Math.hypot(target.vx,target.vy)+180,distance(n,target)*3), dt, n.kind === 'pigeon');
    return;
  }
  for (const p of s.players) if (npcCanEnter(s, p)) {
    item.status = 'removed'; item.ownerId = null;
    n.targetId = p.id; n.origin = { x: n.x, y: n.y }; phase(s, 'swallowing', EAT.eating.npcAnimation); return;
  }
  if (s.time >= n.until) {
    const choice = random(s);
    phase(s, choice < .25 ? 'idle' : choice < .65 ? 'wandering' : n.kind === 'pigeon' ? 'flying' : 'running', 1.5 + random(s) * 3);
    for (let attempt = 0; attempt < 12; attempt++) {
      const a = random(s) * Math.PI * 2, d = 100 + random(s) * 300;
      const destination = { x: n.x + Math.cos(a) * d, y: n.y + Math.sin(a) * d };
      if (validPosition(s.map, destination, npcRadius(e)) && shrineClear(s, n, destination, npcRadius(e))) { n.destination = destination; break; }
    }
  }
  if (n.phase !== 'idle') moveNpc(s, n.destination, n.phase === 'running' ? 145 : n.phase === 'flying' ? 160 : 52, dt, n.phase === 'flying');
}
