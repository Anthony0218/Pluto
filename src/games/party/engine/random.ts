// Weighted server-side pick. Entries are read in declaration order, so a seeded source is reproducible.
export function pickWeighted(
  weights: Readonly<Record<string, number>>,
  random: () => number,
  allowed: (id: string) => boolean = () => true,
): string {
  const entries = Object.entries(weights).filter(([id, w]) => w > 0 && allowed(id));
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (!entries.length || !(total > 0)) throw new Error("Nothing to choose from.");
  let roll = Math.min(Math.max(random(), 0), 0.999999999) * total;
  for (const [id, weight] of entries) {
    if (roll < weight) return id;
    roll -= weight;
  }
  return entries[entries.length - 1][0];
}
