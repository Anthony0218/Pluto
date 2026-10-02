/**
 * Deterministic randomness. The generator state lives inside `GameState.rng`
 * (a plain number), so a saved match replays identically and tests can pin a
 * seed. Nothing in the engine calls Math.random.
 */

export interface RngState {
  seed: number;
  state: number;
}

export function createRng(seed: number): RngState {
  const normalized = Math.floor(Math.abs(seed)) >>> 0;
  return { seed: normalized, state: normalized || 0x9e3779b9 };
}

/** mulberry32 step: mutates `rng.state` and returns a float in [0, 1). */
export function nextRandom(rng: RngState): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(rng: RngState, maxExclusive: number): number {
  return Math.floor(nextRandom(rng) * maxExclusive);
}

/** Fisher–Yates in place. */
export function shuffleInPlace<T>(rng: RngState, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
