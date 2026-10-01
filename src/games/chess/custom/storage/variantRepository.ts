import { parseVariantJson } from "../engine/serialization.ts";
import type { GameVariant } from "../engine/types.ts";

export interface VariantSummary {
  id: string;
  name: string;
  description?: string;
  updatedAt: string;
  version: number;
  presetId?: string;
  boardSize: string;
  pieceCount: number;
}

/**
 * Persistence boundary for variants. The editor only talks to this interface,
 * so a backend (e.g. Supabase) repository can replace the local one without
 * touching UI code. Methods are async for that reason.
 */
export interface VariantRepository {
  list(): Promise<VariantSummary[]>;
  load(id: string): Promise<GameVariant | null>;
  save(variant: GameVariant): Promise<GameVariant>;
  remove(id: string): Promise<void>;
}

const STORAGE_KEY = "chess-custom:variants:v1";
const DRAFT_KEY = "chess-custom:draft:v1";

function readAll(): Record<string, GameVariant> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const out: Record<string, GameVariant> = {};
    // Re-validate on read: storage may hold data from an older build.
    for (const value of Object.values(parsed)) {
      const { variant } = parseVariantJson(JSON.stringify(value), { keepIdentity: true });
      if (variant) out[variant.id] = variant;
    }
    return out;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, GameVariant>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function summarize(variant: GameVariant): VariantSummary {
  return {
    id: variant.id,
    name: variant.name,
    description: variant.description,
    updatedAt: variant.updatedAt,
    version: variant.version,
    presetId: variant.presetId,
    boardSize: `${variant.board.width}×${variant.board.height}`,
    pieceCount: variant.pieces.length,
  };
}

export const localVariantRepository: VariantRepository = {
  async list() {
    return Object.values(readAll())
      .map(summarize)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async load(id) {
    return readAll()[id] ?? null;
  },
  async save(variant) {
    const all = readAll();
    const previous = all[variant.id];
    const saved: GameVariant = {
      ...variant,
      version: previous ? previous.version + 1 : Math.max(1, variant.version),
      updatedAt: new Date().toISOString(),
    };
    all[variant.id] = saved;
    writeAll(all);
    return saved;
  },
  async remove(id) {
    const all = readAll();
    delete all[id];
    writeAll(all);
  },
};

/** Crash-safe autosave of the document being edited (not a saved variant). */
export const draftStorage = {
  read(): GameVariant | null {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      return raw ? parseVariantJson(raw, { keepIdentity: true }).variant : null;
    } catch {
      return null;
    }
  },
  write(variant: GameVariant) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(variant));
    } catch {
      /* Storage is optional. */
    }
  },
};
