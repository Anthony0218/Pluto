import type { SupabaseClient } from "@supabase/supabase-js";
import { parseGameDefinition, type ValidationIssue } from "../engine/validation.ts";
import type { GameDefinition } from "../engine/types.ts";
import { createGameRecord, latestVersion, publishDraft, saveDraft, type GameRecord, type GameVersion } from "../versioning.ts";

/**
 * Where creators' games live. The editor only talks to this interface; the
 * local repository works offline and signed out, the cloud one stores games
 * in Supabase through the validating `card-games` edge function.
 */
export interface CardGameRepository {
  kind: "local" | "cloud";
  list(): Promise<GameRecord[]>;
  load(id: string): Promise<GameRecord | null>;
  /** Creates the game when `id` is null. Returns the updated record. */
  saveDraft(id: string | null, definition: GameDefinition): Promise<GameRecord>;
  publish(id: string): Promise<GameRecord>;
  remove(id: string): Promise<void>;
}

const STORAGE_KEY = "card-builder:games:v1";

function readAll(): Record<string, GameRecord> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, GameRecord>;
    const out: Record<string, GameRecord> = {};
    for (const record of Object.values(parsed)) {
      // Storage may hold data from an older build: keep only versions that still parse.
      if (!record || typeof record !== "object" || !Array.isArray(record.versions)) continue;
      const versions = record.versions.filter((version) => parseGameDefinition(version.definition).definition);
      if (versions.length) out[record.id] = { ...record, versions };
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, GameRecord>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

const newId = () => `local-${crypto.randomUUID()}`;

function assertParsable(definition: GameDefinition) {
  const parsed = parseGameDefinition(definition);
  if (!parsed.definition) throw new Error(parsed.issues[0]?.message ?? "The game definition is not valid.");
}

export const localCardGameRepository: CardGameRepository = {
  kind: "local",
  async list() {
    return Object.values(readAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async load(id) {
    return readAll()[id] ?? null;
  },
  async saveDraft(id, definition) {
    assertParsable(definition);
    const all = readAll();
    const now = new Date().toISOString();
    const existing = id ? all[id] : undefined;
    const record = existing ? saveDraft(existing, definition, now) : createGameRecord(definition, { id: id ?? newId(), now });
    all[record.id] = record;
    writeAll(all);
    return record;
  },
  async publish(id) {
    const all = readAll();
    if (!all[id]) throw new Error("Save the game first.");
    const record = publishDraft(all[id], new Date().toISOString());
    all[id] = record;
    writeAll(all);
    return record;
  },
  async remove(id) {
    const all = readAll();
    delete all[id];
    writeAll(all);
  },
};

/* ------------------------------------------------------------------- Cloud */

interface GameRow {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string;
  visibility: GameRecord["visibility"];
  created_at: string;
  updated_at: string;
  card_game_versions?: { id: string; version: number; status: GameVersion["status"]; definition_json: GameDefinition; created_at: string; published_at: string | null }[];
}

function fromRow(row: GameRow): GameRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    visibility: row.visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    versions: (row.card_game_versions ?? [])
      .sort((a, b) => a.version - b.version)
      .map((version) => ({
        id: version.id,
        gameId: row.id,
        version: version.version,
        status: version.status,
        definition: { ...version.definition_json, id: row.id },
        createdAt: version.created_at,
        ...(version.published_at ? { publishedAt: version.published_at } : {}),
      })),
  };
}

export class CloudValidationError extends Error {
  issues: ValidationIssue[];
  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.issues = issues;
  }
}

export function createCloudCardGameRepository(client: SupabaseClient, ownerId: string): CardGameRepository {
  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await client.functions.invoke("card-games", { body });
    if (error) {
      // The function returns validation issues alongside the error message.
      const context = (error as { context?: Response }).context;
      const payload = context && typeof context.json === "function" ? await context.json().catch(() => null) : null;
      throw new CloudValidationError(payload?.error ?? error.message, payload?.issues ?? []);
    }
    return data as { gameId: string };
  };
  const load = async (id: string) => {
    const { data, error } = await client.from("card_games").select("*, card_game_versions(*)").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? fromRow(data as GameRow) : null;
  };
  return {
    kind: "cloud",
    async list() {
      const { data, error } = await client.from("card_games").select("*, card_game_versions(id,version,status,definition_json,created_at,published_at)").eq("owner_id", ownerId).order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data as GameRow[]).map(fromRow);
    },
    load,
    async saveDraft(id, definition) {
      const result = await invoke({ op: "saveDraft", gameId: id && !id.startsWith("local-") ? id : undefined, definition });
      const record = await load(result.gameId);
      if (!record) throw new Error("The game was saved but could not be reloaded.");
      return record;
    },
    async publish(id) {
      await invoke({ op: "publish", gameId: id });
      const record = await load(id);
      if (!record) throw new Error("The game was published but could not be reloaded.");
      return record;
    },
    async remove() {
      throw new Error("Deleting cloud games is not available yet — set the game to private instead.");
    },
  };
}

export { latestVersion };
