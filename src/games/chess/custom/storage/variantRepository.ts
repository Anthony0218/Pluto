import { KING_BEHAVIORS, matchKingBehavior } from "../engine/presets.ts";
import { parseVariantJson } from "../engine/serialization.ts";
import type { GameVariant } from "../engine/types.ts";
import { VICTORY_LABELS } from "../engine/victory.ts";
import { buildVariantPreview, type VariantPreview } from "../library/preview.ts";

/**
 * What library cards need without loading whole variants. Fields added after
 * the first release are optional so summaries from any backend still render.
 */
export interface VariantSummary {
  id: string;
  name: string;
  description?: string;
  updatedAt: string;
  createdAt?: string;
  version: number;
  presetId?: string;
  boardSize: string;
  pieceCount: number;
  layerCount?: number;
  teamCount?: number;
  kingRule?: string;
  victory?: string[];
  preview?: VariantPreview;
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
/** Whether the autosaved draft matched its last save (or was untouched) when written. */
const DRAFT_CLEAN_KEY = "chess-custom:draft-clean:v1";

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

/** The parts of a variant a summary is built from (a backend may only send these). */
export type SummarySource = Pick<GameVariant, "id" | "name" | "updatedAt" | "version" | "board"> &
  Partial<Pick<GameVariant, "description" | "createdAt" | "presetId" | "pieces" | "setup" | "teams" | "settings" | "victoryConditions" | "theme">> & { pieceCount?: number };

export function summarize(variant: SummarySource): VariantSummary {
  const behavior = variant.settings ? KING_BEHAVIORS.find((entry) => entry.id === matchKingBehavior(variant.settings!)) : undefined;
  return {
    id: variant.id,
    name: variant.name,
    description: variant.description,
    updatedAt: variant.updatedAt,
    createdAt: variant.createdAt,
    version: variant.version,
    presetId: variant.presetId,
    boardSize: `${variant.board.width}×${variant.board.height}`,
    pieceCount: variant.pieceCount ?? variant.pieces?.length ?? 0,
    layerCount: 1 + (variant.board.layers?.length ?? 0),
    teamCount: variant.teams?.length,
    kingRule: behavior?.label ?? (variant.settings ? "Custom king rules" : undefined),
    victory: variant.victoryConditions?.filter((condition) => condition.enabled && condition.type !== "eventOutcome").map((condition) => VICTORY_LABELS[condition.type]),
    preview: buildVariantPreview({
      board: variant.board,
      setup: variant.setup,
      pieces: variant.pieces,
      teams: variant.teams,
      theme: variant.theme,
      royalTypes: variant.pieces?.filter((piece) => piece.royal).map((piece) => piece.id),
    }),
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
  /** True only when the stored draft was explicitly marked as having no unsaved edits. */
  readClean(): boolean {
    try {
      return localStorage.getItem(DRAFT_CLEAN_KEY) === "clean";
    } catch {
      return false;
    }
  },
  write(variant: GameVariant, clean = false) {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(variant));
      localStorage.setItem(DRAFT_CLEAN_KEY, clean ? "clean" : "dirty");
    } catch {
      /* Storage is optional. */
    }
  },
};
