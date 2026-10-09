import type { Campaign } from "./types.ts";

/** Twelve rounds contain four seasons and one year, for both politics and families. */
export function calendarYear(s: Campaign) {
  const clock = s.agreements?.calendar;
  return clock ? clock.baseYear + Math.floor((s.tick - clock.baseTick) / (12 * (s.turns?.order.length ?? 8))) : Math.floor(s.tick / 120);
}
export function ageDue(s: Campaign) {
  return s.agreements ? calendarYear(s) > s.agreements.calendar.agedYear : s.tick % 120 === 0;
}
