import type { AiDifficulty, GameState } from './schafkopf';
const levels = ['beginner', 'amateur', 'advanced', 'pro', 'legend'] as const;
export type DifficultyProgress = { wins: Partial<Record<AiDifficulty, number>>; processed: string[] };
export function recordDifficultyWin(progress: DifficultyProgress, game: Pick<GameState, "phase" | "result" | "round" | "contract" | "tricks">, difficulty: AiDifficulty, seat = 0, context = "local-ai"): { progress: DifficultyProgress; offer: AiDifficulty | null } {
  if (game.phase !== 'finished' || !game.result || game.result.deltas[seat] <= 0) return { progress, offer: null };
  const key = `${context}:${seat}:${game.round}:${game.contract?.kind}:${game.tricks.flatMap(trick => trick.plays.map(play => `${play.seat}:${play.card.id}`)).join(',')}`;
  if (progress.processed.includes(key)) return { progress, offer: null };
  if (difficulty === 'normal') difficulty = 'amateur';
  const wins = (progress.wins[difficulty] ?? 0) + 1;
  const next = levels[levels.indexOf(difficulty as typeof levels[number]) + 1] ?? null;
  return { progress: { wins: { ...progress.wins, [difficulty]: wins }, processed: [...progress.processed, key] }, offer: wins % 20 === 0 ? next : null };
}
export function readDifficultyProgress(): DifficultyProgress {
  try {
    const saved = JSON.parse(localStorage.getItem('schafkopf-difficulty-progress') ?? 'null');
    if (!saved || !saved.wins || !Array.isArray(saved.processed)) return { wins: {}, processed: [] };
    return { wins: Object.fromEntries(levels.map(level => [level, Number.isSafeInteger(saved.wins[level]) && saved.wins[level] >= 0 ? saved.wins[level] : 0])), processed: saved.processed.filter((key: unknown) => typeof key === 'string') };
  } catch { return { wins: {}, processed: [] }; }
}
