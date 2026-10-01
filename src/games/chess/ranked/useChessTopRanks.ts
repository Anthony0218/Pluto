import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { TimeControl } from "./timeControls";

type LeaderboardRow = { rank: number; user_id: string };

/** Leaderboard position (1–10) by user id, for players in the ranked top 10 of a time control. */
export function useChessTopRanks(enabled: boolean, timeControl: TimeControl = "rapid") {
  const [ranks, setRanks] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void supabase.rpc("get_chess_elo_leaderboard", { p_time_control: timeControl }).then(({ data, error }) => {
      if (!active || error) return;
      setRanks(Object.fromEntries(((data ?? []) as LeaderboardRow[]).map(row => [row.user_id, Number(row.rank)])));
    });
    return () => { active = false; };
  }, [enabled, timeControl]);
  return enabled ? ranks : {};
}
