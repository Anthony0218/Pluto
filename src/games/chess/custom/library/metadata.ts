import type { VariantSummary } from "../storage/variantRepository.ts";

/**
 * Library metadata lives beside a variant, never inside its gameplay data:
 * the rule engine knows nothing about who owns a variant or whether it is
 * public. Visibility is derived from the community gallery, so variants saved
 * before sharing existed (or never published) are simply private.
 */
export type VariantVisibility = "private" | "public";

export interface PublishedRecord {
  publishedId: string;
  publishedAt: string;
  updatedAt: string;
}

export interface VariantMetadata {
  ownerId?: string;
  visibility: VariantVisibility;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedId?: string;
  /** The library copy changed after it was last published. */
  publishedOutdated: boolean;
}

export interface LibraryEntry extends VariantSummary {
  meta: VariantMetadata;
}

export function libraryMetadata(summary: VariantSummary, published: Record<string, PublishedRecord> = {}, ownerId?: string | null): VariantMetadata {
  const record = published[summary.id];
  return {
    ...(ownerId ? { ownerId } : {}),
    visibility: record ? "public" : "private",
    createdAt: summary.createdAt ?? summary.updatedAt,
    updatedAt: summary.updatedAt,
    ...(record ? { publishedAt: record.publishedAt, publishedId: record.publishedId } : {}),
    publishedOutdated: Boolean(record && Date.parse(summary.updatedAt) > Date.parse(record.updatedAt) + 1000),
  };
}

export const toLibraryEntries = (summaries: VariantSummary[], published?: Record<string, PublishedRecord>, ownerId?: string | null): LibraryEntry[] =>
  summaries.map((summary) => ({ ...summary, meta: libraryMetadata(summary, published, ownerId) }));

export type LibrarySort = "updated" | "name" | "created" | "visibility";
export const LIBRARY_SORTS: { id: LibrarySort; label: string }[] = [
  { id: "updated", label: "Last edited" },
  { id: "name", label: "Name" },
  { id: "created", label: "Created" },
  { id: "visibility", label: "Public first" },
];

export function sortLibrary(entries: LibraryEntry[], sort: LibrarySort): LibraryEntry[] {
  const byUpdated = (a: LibraryEntry, b: LibraryEntry) => b.meta.updatedAt.localeCompare(a.meta.updatedAt);
  const copy = entries.slice();
  switch (sort) {
    case "name":
      return copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || byUpdated(a, b));
    case "created":
      return copy.sort((a, b) => b.meta.createdAt.localeCompare(a.meta.createdAt) || byUpdated(a, b));
    case "visibility":
      return copy.sort((a, b) => (a.meta.visibility === b.meta.visibility ? 0 : a.meta.visibility === "public" ? -1 : 1) || byUpdated(a, b));
    default:
      return copy.sort(byUpdated);
  }
}

export function filterLibrary(entries: LibraryEntry[], query: string): LibraryEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) => `${entry.name} ${entry.description ?? ""}`.toLowerCase().includes(needle));
}
