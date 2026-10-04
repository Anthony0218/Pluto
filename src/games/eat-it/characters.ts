export const EMOTIONS = ['angry', 'sad', 'bored', 'hungry', 'happy', 'surprised'] as const;
export type CharacterEmotion = typeof EMOTIONS[number];

/** Match-seeded appearance: all clients agree without consuming gameplay randomness. */
export function characterEmotion(seed: number, id: string): CharacterEmotion {
  let hash = seed | 0;
  for (const letter of id) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  return EMOTIONS[(hash >>> 0) % EMOTIONS.length];
}
