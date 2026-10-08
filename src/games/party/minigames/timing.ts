// Timing games judge the frame the player saw, rather than the later packet arrival.
// Clients send elapsed time, never a score; the authority bounds its age and computes the result.
export const TIMING_INPUT_GRACE_MS = 250;
const TIMING_FUTURE_TOLERANCE_MS = 25;

export function validTimingElapsed(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

export function timingInputAt(startedAt: number, receivedAt: number, elapsedMs?: number): number {
  if (elapsedMs === undefined) return receivedAt;
  if (!validTimingElapsed(elapsedMs)) throw new Error("Invalid beat timing.");
  const displayedAt = startedAt + elapsedMs;
  if (displayedAt < receivedAt - TIMING_INPUT_GRACE_MS || displayedAt > receivedAt + TIMING_FUTURE_TOLERANCE_MS)
    throw new Error("This beat is out of sync. Wait for the next one.");
  return Math.min(displayedAt, receivedAt);
}
