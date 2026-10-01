import type { SupabaseClient } from "@supabase/supabase-js";
import { parseVariantJson } from "../engine/serialization.ts";
import type { GameVariant } from "../engine/types.ts";
import { summarize, type VariantRepository, type VariantSummary } from "./variantRepository.ts";

/** Metadata the database keeps beside the JSON so lists never download whole variants. */
export function variantMetadata(variant: GameVariant) {
  return {
    p_name: variant.name.trim() || "Untitled variant",
    p_description: (variant.description ?? "").slice(0, 600),
    p_board_size: `${variant.board.width}x${variant.board.height}`,
    p_piece_types: variant.pieces.length,
    p_schema_version: variant.schemaVersion,
  };
}

interface VariantRow {
  client_id: string;
  name: string;
  description: string;
  board_size: string;
  piece_types: number;
  version: number;
  updated_at: string;
  created_at?: string;
  /* Card previews: only the small parts of the JSON document, never the piece rules. */
  board?: GameVariant["board"] | null;
  setup?: GameVariant["setup"] | null;
  teams?: GameVariant["teams"] | null;
  settings?: GameVariant["settings"] | null;
  victory?: GameVariant["victoryConditions"] | null;
  theme?: GameVariant["theme"] | null;
  preset?: string | null;
}

const LIST_COLUMNS = "client_id,name,description,board_size,piece_types,version,updated_at,created_at,board:data->board,setup:data->setup,teams:data->teams,settings:data->settings,victory:data->victoryConditions,theme:data->theme,preset:data->>presetId";

function rowSummary(row: VariantRow): VariantSummary {
  const fallback: VariantSummary = {
    id: row.client_id,
    name: row.name,
    description: row.description,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    version: row.version,
    boardSize: row.board_size.replace("x", "×"),
    pieceCount: row.piece_types,
  };
  if (!row.board || typeof row.board !== "object" || !Array.isArray(row.board.cells)) return fallback;
  try {
    return {
      ...summarize({
        id: row.client_id,
        name: row.name,
        description: row.description,
        updatedAt: row.updated_at,
        createdAt: row.created_at,
        version: row.version,
        presetId: row.preset ?? undefined,
        board: row.board,
        setup: row.setup ?? undefined,
        teams: row.teams ?? undefined,
        settings: row.settings ?? undefined,
        victoryConditions: row.victory ?? undefined,
        theme: row.theme ?? undefined,
        pieceCount: row.piece_types,
      }),
      boardSize: fallback.boardSize,
    };
  } catch {
    // A malformed document still lists; it just has no preview.
    return fallback;
  }
}

/**
 * Per-account storage in Supabase (`chess_custom_variants`). Rows are private
 * by RLS and written only through `save_chess_custom_variant`, so the editor's
 * variant id (`client_id`) stays the identity across devices.
 */
export function createSupabaseVariantRepository(client: SupabaseClient): VariantRepository {
  return {
    async list() {
      const { data, error } = await client
        .from("chess_custom_variants")
        .select(LIST_COLUMNS)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as unknown as VariantRow[]).map(rowSummary);
    },
    async load(id) {
      const { data, error } = await client.from("chess_custom_variants").select("data,version,updated_at").eq("client_id", id).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { variant } = parseVariantJson(JSON.stringify({ ...data.data, id, version: data.version, updatedAt: data.updated_at }), { keepIdentity: true });
      return variant;
    },
    async save(variant) {
      const { data, error } = await client.rpc("save_chess_custom_variant", { p_client_id: variant.id, ...variantMetadata(variant), p_data: variant });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as { version: number; updated_at: string };
      return { ...variant, version: row.version, updatedAt: row.updated_at };
    },
    async remove(id) {
      const { error } = await client.rpc("delete_chess_custom_variant", { p_client_id: id });
      if (error) throw error;
    },
  };
}
