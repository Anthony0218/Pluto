import type { VariantCard } from "../../../../data/chessVariants.ts";
import { mergeCommunityEntries, plutoCommunityCatalog } from "../library/communityCatalog.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseVariantJson } from "../engine/serialization.ts";
import type { GameVariant } from "../engine/types.ts";
import type { PublishedRecord } from "../library/metadata.ts";
import { buildVariantPreview, type VariantPreview } from "../library/preview.ts";
import { variantMetadata } from "./supabaseVariantRepository.ts";

export type CommunitySort = "top" | "new" | "played";
export type CommunityScope = "all" | "pluto" | "players";

export interface CommunityEntry {
  /** Packaged entries cannot be voted on or unpublished. Built-ins launch existing routes. */
  official?: boolean;
  configurable?: boolean;
  builtin?: VariantCard;
  playerCount?: number;
  id: string;
  /** Authored display attribution may have no linked account. */
  ownerId: string | null;
  authorName: string;
  name: string;
  description: string;
  boardSize: string;
  pieceTypes: number;
  playCount: number;
  publishedAt: string;
  upvotes: number;
  downvotes: number;
  score: number;
  myVote: -1 | 0 | 1;
}

interface CommunityRow {
  id: string;
  owner_id: string;
  author_name: string;
  name: string;
  description: string;
  board_size: string;
  piece_types: number;
  play_count: number;
  published_at: string;
  upvotes: number;
  downvotes: number;
  score: number;
  my_vote: number;
}

const toEntry = (row: CommunityRow): CommunityEntry => ({
  id: row.id,
  ownerId: row.owner_id,
  authorName: row.author_name,
  name: row.name,
  description: row.description,
  boardSize: row.board_size.replace("x", "×"),
  pieceTypes: row.piece_types,
  playCount: row.play_count,
  publishedAt: row.published_at,
  upvotes: row.upvotes,
  downvotes: row.downvotes,
  score: row.score,
  myVote: Math.sign(row.my_vote) as -1 | 0 | 1,
});

/** Public gallery of published variants (`chess_custom_published`) with one vote per user. */
export function createCommunityService(client: SupabaseClient) {
  const catalog = plutoCommunityCatalog();
  const allPlutoVariants = plutoCommunityCatalog(true);
  const official = (id: string) => allPlutoVariants.find((entry) => entry.id === id);
  let remoteUnavailable = false;
  return {
    get remoteUnavailable() { return remoteUnavailable; },
    async list(sort: CommunitySort, search = "", limit = 24, offset = 0, scope: CommunityScope = "all"): Promise<CommunityEntry[]> {
      if (scope === "pluto") return mergeCommunityEntries([], allPlutoVariants, sort, search).slice(offset, offset + limit);
      // Only the first offset+limit remote rows can enter the merged page.
      // Respect the RPC's 100-row cap, including on deep gallery pages.
      const remote: CommunityEntry[] = [];
      remoteUnavailable = false;
      try {
        const needed = offset + limit;
        while (remote.length < needed) {
          const count = Math.min(100, needed - remote.length);
          const { data, error } = await client.rpc("list_chess_custom_community", { p_sort: sort, p_search: search.trim(), p_limit: count, p_offset: remote.length });
          if (error) throw error;
          const rows = ((data ?? []) as CommunityRow[]).map(toEntry);
          remote.push(...rows);
          if (rows.length < count) break;
        }
      } catch {
        remoteUnavailable = true;
      }
      const scopedCatalog = scope === "players" ? catalog.filter((entry) => entry.builtin?.collections?.includes("community")) : catalog;
      return mergeCommunityEntries(remote, scopedCatalog, sort, search)
        .filter((entry) => scope !== "players" || !official(entry.id) || entry.builtin?.collections?.includes("community"))
        .slice(offset, offset + limit);
    },
    /** Loads a published variant as a fresh, validated remix the player can edit freely. */
    async load(id: string): Promise<GameVariant> {
      const packaged = official(id);
      if (packaged?.kind === "builtin") throw new Error("This built-in variant is not configurable. Play it using its existing game route.");
      if (packaged?.kind === "custom") return parseVariantJson(JSON.stringify(packaged.variant)).variant!;
      const { data, error } = await client.from("chess_custom_published").select("data,name").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("This variant is no longer published.");
      const result = parseVariantJson(JSON.stringify(data.data));
      if (!result.variant) throw new Error(result.errors[0] ?? "This variant could not be read.");
      void client.rpc("record_chess_custom_play", { p_published_id: id });
      return result.variant;
    },
    /** Which of the owner's variants are currently public, keyed by the variant's own id. */
    async listMine(ownerId: string): Promise<Record<string, PublishedRecord>> {
      const { data, error } = await client.from("chess_custom_published").select("id,source_client_id,published_at,updated_at").eq("owner_id", ownerId);
      if (error) throw error;
      return Object.fromEntries(
        ((data ?? []) as { id: string; source_client_id: string; published_at: string; updated_at: string }[]).map((row) => [
          row.source_client_id,
          { publishedId: row.id, publishedAt: row.published_at, updatedAt: row.updated_at },
        ]),
      );
    },
    /** Board previews for gallery cards; best effort, so a failure only hides thumbnails. */
    async previews(ids: string[]): Promise<Record<string, { preview: VariantPreview; layerCount: number }>> {
      const out: Record<string, { preview: VariantPreview; layerCount: number }> = {};
      for (const id of ids) {
        const entry = official(id);
        if (entry?.kind === "custom") out[id] = { preview: buildVariantPreview(entry.variant), layerCount: 1 + (entry.variant.board.layers?.length ?? 0) };
      }
      ids = ids.filter((id) => !official(id));
      if (!ids.length) return out;
      const { data, error } = await client.from("chess_custom_published").select("id,board:data->board,setup:data->setup,pieces:data->pieces,teams:data->teams,theme:data->theme").in("id", ids);
      if (error) return out;
      for (const row of (data ?? []) as { id: string; board: GameVariant["board"] | null; setup: GameVariant["setup"] | null; pieces: GameVariant["pieces"] | null; teams: GameVariant["teams"] | null; theme: GameVariant["theme"] | null }[]) {
        if (!row.board || !Array.isArray(row.board.cells)) continue;
        try {
          out[row.id] = {
            preview: buildVariantPreview({ board: row.board, setup: row.setup ?? undefined, pieces: row.pieces ?? undefined, teams: row.teams ?? undefined, theme: row.theme ?? undefined }),
            layerCount: 1 + (row.board.layers?.length ?? 0),
          };
        } catch {
          /* Skip unreadable documents. */
        }
      }
      return out;
    },
    /** Rules at a glance for the details view, without counting a play. */
    async details(id: string): Promise<Pick<GameVariant, "settings" | "victoryConditions" | "teams"> & { tags: string[]; eventCount: number; pieceNames: string[] } | null> {
      const entry = official(id);
      if (entry?.kind === "builtin") return null;
      if (entry?.kind === "custom") {
        const v = entry.variant;
        return { settings: v.settings, victoryConditions: v.victoryConditions, teams: v.teams, tags: v.tags ?? [], eventCount: v.events.filter((event) => event.enabled).length, pieceNames: v.pieces.map((piece) => piece.name) };
      }
      const { data, error } = await client
        .from("chess_custom_published")
        .select("settings:data->settings,victory:data->victoryConditions,teams:data->teams,tags:data->tags,events:data->events,pieces:data->pieces")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("This variant is no longer published.");
      const row = data as unknown as { settings: GameVariant["settings"]; victory: GameVariant["victoryConditions"] | null; teams: GameVariant["teams"] | null; tags: unknown; events: unknown[] | null; pieces: { name?: string }[] | null };
      return {
        settings: row.settings,
        victoryConditions: Array.isArray(row.victory) ? row.victory : [],
        teams: Array.isArray(row.teams) ? row.teams : [],
        tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : [],
        eventCount: Array.isArray(row.events) ? row.events.length : 0,
        pieceNames: Array.isArray(row.pieces) ? row.pieces.map((piece) => String(piece?.name ?? "")).filter(Boolean) : [],
      };
    },
    async vote(id: string, value: -1 | 0 | 1) {
      if (official(id)) throw new Error("Voting is only available for player-published variants.");
      const { data, error } = await client.rpc("vote_chess_custom_variant", { p_published_id: id, p_value: value });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as { upvotes: number; downvotes: number; my_vote: number };
      return { upvotes: row.upvotes, downvotes: row.downvotes, myVote: Math.sign(row.my_vote) as -1 | 0 | 1 };
    },
    async publish(variant: GameVariant, description: string): Promise<string> {
      const { data, error } = await client.rpc("publish_chess_custom_variant", {
        p_client_id: variant.id,
        ...variantMetadata(variant),
        p_description: description.slice(0, 600),
        p_data: variant,
      });
      if (error) throw error;
      return data as string;
    },
    async unpublish(id: string) {
      if (official(id)) throw new Error("Pluto variants cannot be unpublished.");
      const { error } = await client.rpc("unpublish_chess_custom_variant", { p_published_id: id });
      if (error) throw error;
    },
  };
}

export type CommunityService = ReturnType<typeof createCommunityService>;
