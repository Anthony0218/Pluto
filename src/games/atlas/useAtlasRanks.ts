import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type AtlasRankRow = { user_id: string; username: string | null; rating: number; deviation:number; matches_played: number; leaderboard_rank: number | null };
/** Rank positions are computed across all rated players before filtering by IDs. */
export function useAtlasRanks(ids?: string[]) {
  const key = ids ? [...new Set(ids)].sort().join(",") : "all";
  const [state, setState] = useState<{ key: string; rows: AtlasRankRow[]; loading: boolean; error: string }>({ key: "", rows: [], loading: true, error: "" });
  useEffect(() => {
    let live = true;
    const refresh = () => {
      if (!key) { setState({ key, rows: [], loading: false, error: "" }); return; }
      void Promise.resolve(supabase.rpc("get_atlas_ranked_leaderboard", { p_user_ids: key === "all" ? null : key.split(",") })).then(({ data, error }) => {
        if (live) setState({ key, rows: data ?? [], loading: false, error: error?.message ?? "" });
      }).catch(cause => { if (live) setState({ key, rows: [], loading: false, error: cause instanceof Error ? cause.message : "Could not load ranks." }); });
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [key]);
  return state.key === key ? state : { rows: [], loading: Boolean(key), error: "" };
}
