import { FINISH_ROW, STREET_CROSS_CONFIG as CONFIG } from "./config.ts";
import type { Runner } from "./logic.ts";

export interface StreetRunnerDisplay { x: number; y: number; hits: number; finishedAt: number | null }
// Presentation only. Match normalized server movement, cap stale prediction, and never predict the
// stunned portion of a snapshot. New checkpoint hits and finishes remain immediate and authoritative.
export function streetRunnerTarget(runner: Runner, simTime: number, now: number, intent = { dx: runner.dx, dy: runner.dy }) {
  const moving = runner.finishedAt === null && now >= runner.stunnedUntil;
  const seconds = moving ? Math.max(0, Math.min(now - Math.max(simTime, runner.stunnedUntil), 150)) / 1000 : 0;
  const norm = Math.max(1, Math.hypot(intent.dx, intent.dy));
  return {
    x: Math.max(CONFIG.player.radius, Math.min(CONFIG.width - CONFIG.player.radius, runner.x + intent.dx / norm * CONFIG.player.speed * seconds)),
    y: Math.max(CONFIG.player.radius, Math.min(FINISH_ROW + 0.5, runner.y + intent.dy / norm * CONFIG.player.speed * seconds)),
  };
}
export function smoothStreetRunner(previous: StreetRunnerDisplay | undefined, runner: Runner, target: { x: number; y: number }, frameSeconds: number): StreetRunnerDisplay {
  const reset = !previous || previous.hits !== runner.hits || previous.finishedAt !== runner.finishedAt;
  const blend = reset ? 1 : 1 - Math.exp(-20 * Math.max(0, Math.min(frameSeconds, 0.05)));
  return { x: (previous?.x ?? target.x) + (target.x - (previous?.x ?? target.x)) * blend,
    y: (previous?.y ?? target.y) + (target.y - (previous?.y ?? target.y)) * blend,
    hits: runner.hits, finishedAt: runner.finishedAt };
}
