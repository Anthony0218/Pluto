import { activateAbility } from './abilities.ts';
import { activateEscape } from './escape.ts';
import { matchSettings, respawn, activateGrowth } from './progression.ts';
import { EAT } from './config.ts';
import { checkWinner, createGame, eliminate, fillBots, sanitizeInput, stepGame } from './engine.ts';
import type { MapId, Room } from './types.ts';

export function parseSettings(body: Record<string, unknown>): Room['settings'] {
  if (!['city', 'nature', 'candy', 'frozen'].includes(String(body.map))) throw new Error('Unknown map');
  if (typeof body.count !== 'number' || !Number.isInteger(body.count) || body.count < 2 || body.count > EAT.match.maxPlayers) throw new Error('Choose 2–8 players');
  const config = matchSettings({ matchDuration: body.matchDuration as number, plutoMultiplier: body.plutoMultiplier as number, plutoEnabled: body.plutoEnabled !== false, hellEnabled: body.hellEnabled !== false, animalsEnabled: body.animalsEnabled !== false, livesEnabled: body.livesEnabled !== false });
  return { map: body.map as MapId, count: body.count, matchDuration: config.matchDuration, plutoMultiplier: config.plutoMultiplier, plutoEnabled: config.plutoEnabled, hellEnabled: config.hellEnabled, animalsEnabled: config.animalsEnabled, livesEnabled: config.livesEnabled };
}
/** Server clock only. Replayed/faster requests cannot advance simulation faster. */
export function advanceRoom(room: Room, now: number): boolean {
  const state = room.game_state; if (!state || room.status !== 'playing') return false;
  const tickMs = 1000 / EAT.network.tickRate;
  const elapsed = Math.max(0, now - room.last_tick);
  const ticks = Math.min(Math.floor((elapsed + 0.0001) / tickMs), EAT.network.tickRate * EAT.network.maxCatchupSeconds);
  let changed = ticks > 0;
  for (const member of room.players) {
    const p = state.players.find(p => p.id === member.id);
    if (!p) continue;
    if (now - member.lastSeen > EAT.network.inputTimeoutMs && (p.input.x !== 0 || p.input.y !== 0)) { p.input = { x: 0, y: 0 }; changed = true; }
    if (now - member.lastSeen > EAT.network.disconnectMs && !member.departed) {
      member.departed = true; changed = true; p.lives = 0; delete p.respawnAt; eliminate(state, p);
    }
  }
  checkWinner(state);
  for (let i = 0; i < ticks; i++) stepGame(state);
  room.last_tick = elapsed > 1000 * EAT.network.maxCatchupSeconds ? now : room.last_tick + ticks * tickMs;
  if (state.status === 'finished') room.status = 'finished';
  if (room.players.find(p => p.id === room.host_id)?.departed) room.host_id = room.players.find(p => !p.departed)?.id ?? room.host_id;
  return changed;
}
/** Mutates a private copy; the Edge Function commits with a version comparison. */
export function applyRoomAction(room: Room, userId: string, name: string, body: Record<string, unknown>, now: number, seed: number, matchId: string): boolean {
  const op = body.op;
  if (!['get', 'join', 'ready', 'start', 'input', 'leave', 'rematch', 'escape', 'respawn', 'growth', 'jump', 'strike', 'shock'].includes(String(op))) throw new Error('Unknown operation');
  let member = room.players.find(p => p.id === userId);
  let changed = false;
  if (!member) {
    if (op !== 'join') throw new Error('Join this room first');
    if (room.status !== 'waiting' || room.players.length >= room.settings.count) throw new Error('This room is full or already playing');
    if (room.players.length === 0) room.host_id = userId;
    member = { id: userId, name, ready: false, lastSeen: now }; room.players.push(member); changed = true;
  }
  // Input applies only to future ticks, never retroactively to the elapsed interval.
  changed = advanceRoom(room, now) || changed;
  // A Realtime UPDATE prompts a lobby read. Reads must not create another UPDATE.
  // Active inputs heartbeat each packet; waiting/results screens only every few polls.
  if (now !== member.lastSeen && (room.status === 'playing' || now - member.lastSeen >= EAT.network.lobbyPollMs * 3)) {
    member.lastSeen = now; changed = true;
  }
  if (op === 'jump' || op === 'strike' || op === 'shock') {
    const state = room.game_state, player = state?.players.find(p => p.id === userId);
    if (state && player && !member.departed && room.status === 'playing') changed = activateAbility(state, player, op) || changed;
  } else if (op === 'growth') {
    const state = room.game_state, player = state?.players.find(p => p.id === userId);
    if (state && player && !member.departed && room.status === 'playing') changed = activateGrowth(state, player) || changed;
  } else if (op === 'respawn') {
    const state = room.game_state, player = state?.players.find(p => p.id === userId);
    if (state && player && !member.departed && room.status === 'playing') changed = respawn(state, player) || changed;
  } else if (op === 'escape') {
    const state = room.game_state, player = state?.players.find(p => p.id === userId);
    if (state && player && !member.departed && room.status === 'playing') changed = activateEscape(state, player) || changed;
  } else if (op === 'input') {
    const player = room.game_state?.players.find(p => p.id === userId);
    if (player?.alive && !member.departed && room.status === 'playing') {
      const next = sanitizeInput(body.input);
      if (player.input.x !== next.x || player.input.y !== next.y) { player.input = next; changed = true; }
    }
  } else if (op === 'ready') {
    if (room.status !== 'waiting') throw new Error('The match has already started');
    member.ready = !member.ready; changed = true;
  } else if (op === 'start') {
    if (room.host_id !== userId) throw new Error('Only the host can start');
    if (room.status !== 'waiting' || !room.players.every(p => p.ready)) throw new Error('Every player must be ready');
    room.game_state = createGame(room.settings.map, fillBots(room.players, room.settings.count), seed, matchId, { ...room.settings, mode: 'multiplayer' });
    room.status = 'playing'; room.last_tick = now; room.players.forEach(p => { p.lastSeen = now; p.departed = false; }); changed = true;
  } else if (op === 'rematch') {
    if (room.host_id !== userId || room.status !== 'finished') throw new Error('Only the host can reopen a finished room');
    room.players = room.players.filter(p => !p.departed && (p.id === userId || now - p.lastSeen <= EAT.network.disconnectMs));
    room.status = 'waiting'; room.game_state = null; room.players.forEach(p => { p.ready = false; }); changed = true;
  } else if (op === 'leave') {
    member.departed = true; changed = true;
    if (room.status === 'playing' && room.game_state) {
      const player = room.game_state.players.find(p => p.id === userId);
      if (player) { player.lives = 0; delete player.respawnAt; eliminate(room.game_state, player); }
      checkWinner(room.game_state); if (room.game_state.status === 'finished') room.status = 'finished';
    }
    // Keep participants in completed matches so the result trigger can identify humans.
    if (room.status === 'waiting') room.players = room.players.filter(p => p.id !== userId);
    if (room.host_id === userId) room.host_id = room.players.find(p => p.id !== userId && !p.departed)?.id ?? userId;
  }
  return changed;
}
