import { compareChessRevision } from '../multiplayer/position.ts';

export type ClockGame = {
  white_time_ms: number | null; black_time_ms: number | null; clock_started_at: string | null;
  fen: string; status: string; version: number; ranked_round?: number;
  ranked_cards_drawn?: string[] | null;
};
export type ClockSample = { game: ClockGame; serverNow: string; receivedAt: number };
/** Wall-clock changes in the browser never affect the estimate or adjudicate a loss. */
export function remainingClock(sample: ClockSample, color: 'white' | 'black', now: number, pendingAt?: number): number {
  const { game } = sample;
  const base = (color === 'white' ? game.white_time_ms : game.black_time_ms) ?? 300000;
  if (game.status !== 'playing' || !game.clock_started_at) return base;
  const active = game.fen.split(' ')[1] === 'w' ? 'white' : 'black';
  const sinceServer = Math.max(0, Date.parse(sample.serverNow) - Date.parse(game.clock_started_at));
  const localElapsed = Math.max(0, now - sample.receivedAt);
  const beforeMove = pendingAt === undefined ? localElapsed : Math.max(0, pendingAt - sample.receivedAt);
  const elapsed = color === active ? sinceServer + Math.min(localElapsed, beforeMove) : pendingAt === undefined ? 0 : Math.max(0, now - pendingAt);
  return Math.max(0, base - elapsed);
}
export function formatClock(ms: number): string {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
/** Realtime changes switch/freeze the display without awaiting another HTTP read. */
export function reconcileClock(sample: ClockSample | null, game: ClockGame, now: number): ClockSample | null {
  if (game.white_time_ms === null || game.black_time_ms === null || (sample && compareChessRevision(game, sample.game) <= 0)) return sample;
  const serverNow = sample ? new Date(Date.parse(sample.serverNow) + Math.max(0, now - sample.receivedAt)).toISOString() : game.clock_started_at;
  return serverNow ? { game, serverNow, receivedAt: now } : sample;
}
