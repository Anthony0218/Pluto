import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeGoRankedProfile, type GoRankedProfileRow } from "./profileData.ts";
export type { GoRankedProfileRow } from "./profileData.ts";
/** Poll exact positions because another player's result can change your rank. */
export function useGoRankedProfile(userId?: string) {
  const [data, setData] = useState<{ userId: string; rows: GoRankedProfileRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const load = async () => {
      const result = await supabase.rpc("get_go_ranked_profile", { p_user_id: userId });
      if (!alive) return;
      setError(result.error?.message ?? null);
      if (!result.error) setData({ userId, rows: normalizeGoRankedProfile(result.data) });
    };
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    window.addEventListener("focus", load);
    window.addEventListener("go-ranked-settled", load);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("focus", load); window.removeEventListener("go-ranked-settled", load); };
  }, [userId]);
  return { rows: data && data.userId === userId ? data.rows : null, error };
}
