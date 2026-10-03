/** Lichess CC0 opening positions. The first four FEN fields identify the playable position. */
let bookPromise: Promise<Record<string, string[] | null>> | null = null;
const loadBook = () => bookPromise ??= import("./openingBook.json", { with: { type: "json" } })
  .then(({ default: positions }) => positions as Record<string, string[] | null>)
  .catch(() => ({}));

export async function openingBookMove(fenAfter: string, ply: number): Promise<{ eco: string; name: string | null } | null> {
  // Opening theory applies to the beginning of a standard game, not a late transposition.
  if (ply < 1 || ply > 30) return null;
  const key = fenAfter.split(" ").slice(0, 4).join(" ");
  const book = await loadBook();
  if (!Object.hasOwn(book, key)) return null;
  const named = book[key];
  return { eco: named?.[0] ?? "", name: named?.[1] ?? null };
}
