import { variants, type VariantCard } from "../../../../data/chessVariants.ts";
import type { GameVariant } from "../engine/types.ts";
import type { CommunityEntry, CommunitySort } from "../storage/communityService.ts";
import { createPlutoVariant, PLUTO_PUBLISHED_AT } from "./plutoVariants.ts";

export type CatalogEntry = CommunityEntry & ({ kind: "builtin"; configurable: false; builtin: VariantCard } | { kind: "custom"; configurable: true; variant: GameVariant });

/** Reuses the menu registry; no copied built-in rules, routes or descriptions. */
export function plutoCommunityCatalog(includeUpcoming = false): CatalogEntry[] {
  const common = { ownerId: "pluto", authorName: "Pluto", playCount: 0, publishedAt: PLUTO_PUBLISHED_AT, upvotes: 0, downvotes: 0, score: 0, myVote: 0 as const, official: true };
  // Menu variants first, then the Custom-only ones, then upcoming entries.
  const rank = (card: VariantCard) => (!card.available ? 2 : card.customOnly ? 1 : 0);
  const ordered = variants
    .filter((card) => includeUpcoming || card.available)
    .map((card, index) => ({ card, index }))
    .sort((a, b) => rank(a.card) - rank(b.card) || a.index - b.index)
    .map(({ card }) => card);
  return ordered.map((card): CatalogEntry => {
    if (card.customId) {
      const variant = createPlutoVariant(card.customId);
      return { ...common, collections: card.collections, id: card.customId, kind: "custom", configurable: true, variant, playerCount: variant.teams.length, name: variant.name, description: variant.description ?? "", boardSize: `${variant.board.width}×${variant.board.height}`, pieceTypes: variant.pieces.length };
    }
    return { ...common, collections: card.collections, ownerId: card.source === "community" ? null : common.ownerId, authorName: card.author ?? common.authorName, id: `pluto-builtin-${card.id}`, kind: "builtin", configurable: false, builtin: card, playerCount: card.id === "four-player" ? 4 : 2, name: card.title, description: card.description, boardSize: "", pieceTypes: 0 };
  });
}

export function mergeCommunityEntries(remote: CommunityEntry[], catalog: CommunityEntry[], sort: CommunitySort, search = ""): CommunityEntry[] {
  const query = search.trim().toLocaleLowerCase();
  const entries = [...new Map([...remote, ...catalog].map((entry) => [entry.id, entry])).values()]
    .filter((entry) => `${entry.name}\n${entry.description}\n${entry.authorName}`.toLocaleLowerCase().includes(query));
  const rank = (entry: CommunityEntry) => sort === "new" ? Date.parse(entry.publishedAt) : sort === "played" ? entry.playCount : entry.score;
  // Pin packaged games in menu order; selected sorting applies to player uploads.
  const order = new Map(catalog.map((entry, index) => [entry.id, index]));
  return entries.sort((a, b) => {
    const ai = order.get(a.id), bi = order.get(b.id);
    if (ai !== undefined || bi !== undefined) return (ai ?? Infinity) - (bi ?? Infinity);
    return rank(b) - rank(a) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id);
  });
}
