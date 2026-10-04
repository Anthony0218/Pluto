/** Serializable per-world generator: independent rooms and hotseat turns never share randomness. */
export function randomStep(state: number): [number, number] {
  const next = (Math.imul(state >>> 0, 1664525) + 1013904223) >>> 0;
  return [next, next / 4294967296];
}
export function worldRandom(world: { randomState: number }): number {
  const [next, value] = randomStep(world.randomState);
  world.randomState = next;
  return value;
}
