import type { FogMoveRecord } from "./fogOfWarChess";

export type FogStats = {
  captures: number;
  whiteCaptures: number;
  blackCaptures: number;
  checks: number;
  promotions: number;
  longestCaptureRun: number;
  latestCapture: FogMoveRecord | null;
};

export function buildFogStats(records: FogMoveRecord[]): FogStats {
  let captures = 0;
  let whiteCaptures = 0;
  let blackCaptures = 0;
  let checks = 0;
  let promotions = 0;
  let run = 0;
  let longestCaptureRun = 0;
  let latestCapture: FogMoveRecord | null = null;
  for (const record of records) {
    if (record.captured) {
      captures += 1;
      record.color === "w" ? whiteCaptures += 1 : blackCaptures += 1;
      run += 1;
      longestCaptureRun = Math.max(longestCaptureRun, run);
      latestCapture = record;
    } else run = 0;
    if (record.san.endsWith("+") || record.san.endsWith("#")) checks += 1;
    if (record.promotion) promotions += 1;
  }
  return { captures, whiteCaptures, blackCaptures, checks, promotions, longestCaptureRun, latestCapture };
}
