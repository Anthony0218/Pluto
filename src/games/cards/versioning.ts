/**
 * Game → Version 1, Version 2, … Versions are immutable once published: an
 * edit to a published game always creates a new draft version, and a session
 * keeps pointing at the exact version it started with. Pure functions; the
 * local and Supabase repositories both follow these semantics (the database
 * additionally enforces them with a trigger).
 */
import { validateDefinition } from "./engine/validation.ts";
import type { GameDefinition } from "./engine/types.ts";

export type Visibility = "private" | "unlisted" | "public";
export type VersionStatus = "draft" | "published";

export interface GameVersion {
  id: string;
  gameId: string;
  version: number;
  status: VersionStatus;
  definition: GameDefinition;
  createdAt: string;
  publishedAt?: string;
}

export interface GameRecord {
  id: string;
  ownerId: string | null;
  name: string;
  slug: string;
  description: string;
  visibility: Visibility;
  createdAt: string;
  updatedAt: string;
  versions: GameVersion[];
}

export class VersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VersionError";
  }
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled-game"
  );
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

const versionId = (gameId: string, version: number) => `${gameId}@v${version}`;

export function createGameRecord(definition: GameDefinition, options: { id: string; ownerId?: string | null; now: string }): GameRecord {
  const def = { ...structuredClone(definition), id: options.id };
  return {
    id: options.id,
    ownerId: options.ownerId ?? null,
    name: def.name,
    slug: slugify(def.name),
    description: def.description,
    visibility: "private",
    createdAt: options.now,
    updatedAt: options.now,
    versions: [{ id: versionId(options.id, 1), gameId: options.id, version: 1, status: "draft", definition: def, createdAt: options.now }],
  };
}

export const latestVersion = (record: GameRecord) => record.versions[record.versions.length - 1];
export const latestDraft = (record: GameRecord) => record.versions.findLast((version) => version.status === "draft");
export const latestPublished = (record: GameRecord) => record.versions.findLast((version) => version.status === "published");
export const findVersion = (record: GameRecord, id: string) => record.versions.find((version) => version.id === id);

/**
 * Saves an edit. The open draft is replaced; if the latest version is
 * published, a new draft version is appended instead. Never mutates `record`.
 */
export function saveDraft(record: GameRecord, definition: GameDefinition, now: string): GameRecord {
  const def = { ...structuredClone(definition), id: record.id };
  const latest = latestVersion(record);
  const versions = [...record.versions];
  if (latest?.status === "draft") {
    versions[versions.length - 1] = { ...latest, definition: def, createdAt: latest.createdAt };
  } else {
    const version = (latest?.version ?? 0) + 1;
    versions.push({ id: versionId(record.id, version), gameId: record.id, version, status: "draft", definition: def, createdAt: now });
  }
  return { ...record, name: def.name, slug: slugify(def.name), description: def.description, updatedAt: now, versions };
}

/** Publishes the open draft. Fails when there is none or it has validation errors. */
export function publishDraft(record: GameRecord, now: string): GameRecord {
  const draft = latestDraft(record);
  if (!draft || draft !== latestVersion(record)) throw new VersionError("There is no draft to publish — edit the game first.");
  const report = validateDefinition(draft.definition);
  if (!report.canPublish) throw new VersionError(`Fix ${report.errors.length} validation error${report.errors.length === 1 ? "" : "s"} before publishing.`);
  const published: GameVersion = deepFreeze({ ...draft, definition: structuredClone(draft.definition), status: "published", publishedAt: now });
  return { ...record, updatedAt: now, versions: [...record.versions.slice(0, -1), published] };
}

/** Guard used by repositories before writing: published versions never change. */
export function assertVersionWritable(previous: GameVersion | undefined, next: GameVersion) {
  if (previous?.status === "published" && JSON.stringify(previous.definition) !== JSON.stringify(next.definition)) {
    throw new VersionError(`Version ${previous.version} is published and cannot be changed.`);
  }
}
