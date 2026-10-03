import type { GoColor } from "../rules.ts";
import type { RankedGoSnapshot } from "./types.ts";

export type GoClock = { mainMs: number; periodMs: number; periodsRemaining: number; inByoYomi: boolean; expired: boolean };

/** Mirrors the database clock projection. Only the server commits periods or a timeout. */
export function advanceGoClock(mainMs: number, periodMs: number, periodsRemaining: number, byoYomiMs: number, elapsedMs: number): GoClock {
  const elapsed = Math.max(0, elapsedMs);
  if (elapsed < mainMs) return { mainMs: mainMs - elapsed, periodMs, periodsRemaining, inByoYomi: false, expired: false };
  const overtime = elapsed - mainMs;
  const lost = overtime < periodMs ? 0 : 1 + Math.floor((overtime - periodMs) / byoYomiMs);
  const periods = Math.max(0, periodsRemaining - lost);
  const remaining = periods === 0 ? 0 : lost === 0 ? periodMs - overtime : byoYomiMs - ((overtime - periodMs) % byoYomiMs);
  return { mainMs: 0, periodMs: remaining, periodsRemaining: periods, inByoYomi: true, expired: periods === 0 };
}

export function goClock(sample: RankedGoSnapshot, color: GoColor, receivedAt: number, now: number): GoClock {
  const g = sample.game;
  const elapsed = g.status === "playing" && g.clock_started_at && g.state.currentPlayer === color
    ? Math.max(0, Date.parse(sample.serverNow) - Date.parse(g.clock_started_at)) + Math.max(0, now - receivedAt) : 0;
  return advanceGoClock(color === "black" ? g.black_time_ms : g.white_time_ms,
    color === "black" ? g.black_period_ms : g.white_period_ms,
    color === "black" ? g.black_periods_remaining : g.white_periods_remaining, g.byo_yomi_ms, elapsed);
}

export function goRemainingClock(sample: RankedGoSnapshot, color: GoColor, receivedAt: number, now: number) {
  const clock = goClock(sample, color, receivedAt, now);
  return clock.inByoYomi ? clock.periodMs : clock.mainMs;
}
