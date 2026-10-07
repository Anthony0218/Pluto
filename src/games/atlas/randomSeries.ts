export type SeriesLength = 1 | 3 | 5;
export type SeriesResult = { mode: string; winnerId: string | null; scores: Record<string, number> };

export function seriesLength(value: unknown): SeriesLength {
  return value === 1 || value === "1" ? 1 : value === 5 || value === "5" ? 5 : 3;
}

export const seriesLabel = (length: number) => length === 1 ? "One game" : `Best of ${length}`;

/** Draw without replacement; an optional roulette selection is the first game. */
export function chooseRandomModes(modes: readonly string[], length: SeriesLength, first?: string, random = Math.random): string[] {
  const available = [...new Set(modes)];
  if (available.length < length) throw new Error("Not enough different modes for this series.");
  const order: string[] = [];
  if (first && available.includes(first)) order.push(...available.splice(available.indexOf(first), 1));
  while (order.length < length) order.push(...available.splice(Math.min(available.length - 1, Math.floor(random() * available.length)), 1));
  return order;
}

export function gameWinner(scores: Record<string, number>): string | null {
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1]) ? ranked[0][0] : null;
}

export function seriesWins(results: readonly SeriesResult[], ids: readonly string[]): Record<string, number> {
  return Object.fromEntries(ids.map(id => [id, results.filter(result => result.winnerId === id).length]));
}

export function seriesComplete(length: number, results: readonly SeriesResult[]): boolean {
  return results.length >= length || Object.values(seriesWins(results, results.flatMap(result => result.winnerId ? [result.winnerId] : []))).some(wins => wins >= Math.floor(length / 2) + 1);
}
