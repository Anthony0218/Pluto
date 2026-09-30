import { AIM_CONFIG } from "../config.ts";
import type { Random } from "../engine/engine.ts";
import type { AimChallenge, AimResult, BoardMap, Match } from "../types.ts";
import type { AimGeometry, ItemDefinition } from "./types.ts";

// Aiming authority (Scatterblaster, Lucky Six).
//
// 1. USE_ITEM validates the target and range, then the server seeds a short challenge: the target marker
//    sways on a Lissajous path whose frequencies and phases are drawn from the server's random source at
//    that moment, so nothing about it is known before aiming starts.
// 2. The client drags a reticle and releases. FIRE_ITEM carries only the bounded normalized reticle
//    position and the client's elapsed aim time. The server accepts that time only inside
//    [serverElapsed - latencyToleranceMs, serverElapsed] (otherwise it uses its own), recomputes where the
//    target was, measures the offset and maps it to a quality with the item's own geometry.
// 3. Damage, KO and consumption are decided by the item definition from that quality. Clients never send
//    damage, accuracy or hit quality, and a release after the window scores a miss.

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const between = (random: Random, [min, max]: readonly [number, number]) =>
  min + random() * (max - min);

export function createAimChallenge(
  state: Match,
  map: BoardMap,
  definition: ItemDefinition,
  playerId: string,
  itemInstanceId: string,
  targetPlayerId: string,
  random: Random,
  now: number,
): AimChallenge {
  const spec = definition.aim;
  if (!spec) throw new Error(`${definition.name} is not an aimed item.`);
  const range = spec.range(state, map, playerId, targetPlayerId);
  if (!range) throw new Error("That player is out of range.");
  const [ampX, ampY] = spec.motion.amplitude;
  return {
    itemInstanceId,
    itemId: definition.id,
    playerId,
    targetPlayerId,
    distance: range.distance,
    band: range.band,
    startedAt: now,
    expiresAt: now + spec.windowMs,
    motion: {
      ax: ampX,
      ay: ampY,
      fx: round3(between(random, spec.motion.frequencyHz)),
      fy: round3(between(random, spec.motion.frequencyHz)),
      px: round3(random() * Math.PI * 2),
      py: round3(random() * Math.PI * 2),
    },
  };
}

// Where the target marker is `elapsedMs` after aiming started. Shared by server, client view and bots.
export function aimTargetPosition(
  challenge: Pick<AimChallenge, "motion">,
  elapsedMs: number,
): { x: number; y: number } {
  const t = Math.max(0, elapsedMs) / 1000,
    m = challenge.motion;
  return {
    x: m.ax * Math.sin(2 * Math.PI * m.fx * t + m.px),
    y: m.ay * Math.sin(2 * Math.PI * m.fy * t + m.py),
  };
}

export function aimQuality(offset: number, geometry: AimGeometry): AimResult["quality"] {
  return offset <= geometry.centerRadius
    ? "centered"
    : offset <= geometry.hitRadius
      ? "partial"
      : "miss";
}

const clampUnit = (v: number) =>
  Number.isFinite(v) ? Math.min(1, Math.max(-1, v)) : 0;

// Scores a release received at server time `now`. Never trusts anything but a bounded position and a
// release time inside the latency window.
export function resolveAimRelease(
  challenge: AimChallenge,
  geometry: AimGeometry,
  aimX: number,
  aimY: number,
  clientElapsedMs: number | undefined,
  now: number,
): AimResult {
  const serverElapsed = now - challenge.startedAt,
    windowMs = challenge.expiresAt - challenge.startedAt;
  const elapsedMs =
    clientElapsedMs !== undefined &&
    Number.isFinite(clientElapsedMs) &&
    clientElapsedMs <= serverElapsed &&
    clientElapsedMs >= serverElapsed - AIM_CONFIG.latencyToleranceMs
      ? clientElapsedMs
      : serverElapsed;
  if (elapsedMs < 0 || elapsedMs > windowMs)
    return { quality: "miss", offset: Infinity, elapsedMs, timedOut: true };
  const target = aimTargetPosition(challenge, elapsedMs);
  const offset = Math.hypot(clampUnit(aimX) - target.x, clampUnit(aimY) - target.y);
  return {
    quality: aimQuality(offset, geometry),
    offset: round3(offset),
    elapsedMs,
    timedOut: false,
  };
}

// The result used when the player never releases (window + grace expired).
export function timedOutAim(challenge: AimChallenge, now: number): AimResult {
  return {
    quality: "miss",
    offset: Infinity,
    elapsedMs: now - challenge.startedAt,
    timedOut: true,
  };
}

// Bot release: aims at the true target position plus a difficulty-dependent Gaussian error.
export function botAimRelease(
  challenge: AimChallenge,
  difficulty: keyof typeof AIM_CONFIG.botError,
  now: number,
  random: Random,
): { aimX: number; aimY: number; elapsedMs: number } {
  const elapsedMs = Math.max(0, now - challenge.startedAt),
    target = aimTargetPosition(challenge, elapsedMs),
    sigma = AIM_CONFIG.botError[difficulty];
  const gauss = () =>
    Math.sqrt(-2 * Math.log(Math.max(1e-9, random()))) *
    Math.cos(2 * Math.PI * random());
  return {
    aimX: round3(clampUnit(target.x + gauss() * sigma)),
    aimY: round3(clampUnit(target.y + gauss() * sigma)),
    elapsedMs,
  };
}
