import { pinnedGoRow } from "@/games/go/ranked/leaderboard";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import LeaderboardTable, { type LeaderboardRow } from "@/components/social/LeaderboardTable";
import { useGoRankedProfile } from "@/games/go/ranked/profile";
import type { GoTimeControl } from "@/games/go/ranked/config";
type EloRow = Omit<LeaderboardRow, "value"> & { rating: number };
export default function GoRankedLeaderboard({ mode }: { mode: GoTimeControl }) {
  const { user, profile } = useAuth();
  const own = useGoRankedProfile(user?.id);
  const [page, setPage] = useState({ mode, offset: 0 });
  const offset = page.mode === mode ? page.offset : 0;
  const [board, setBoard] = useState<{ mode: string; offset: number; rows: LeaderboardRow[]; more: boolean; error: string | null } | null>(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.rpc("get_go_elo_leaderboard", { p_time_control: mode, p_limit: 51, p_offset: offset });
      if (alive) setBoard({ mode, offset, rows: ((data ?? []) as EloRow[]).slice(0, 50).map(row => ({ ...row, value: row.rating })), more: (data?.length ?? 0) > 50, error: error?.message ?? null });
    };
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    window.addEventListener("focus", load); window.addEventListener("go-ranked-settled", load);
    return () => { alive = false; clearInterval(timer); window.removeEventListener("focus", load); window.removeEventListener("go-ranked-settled", load); };
  }, [mode, offset, user]);
  const visible = board?.mode === mode && board.offset === offset ? board : null;
  const ownRow = own.rows?.find(row => row.time_control === mode);
  const ownLeaderboardRow: LeaderboardRow | null = user && ownRow?.leaderboard_rank ? { rank: ownRow.leaderboard_rank, user_id: user.id, username: profile?.display_name || profile?.username || "You", avatar_id: profile?.avatar_id ?? null, value: ownRow.rating } : null;
  const pinned = visible ? pinnedGoRow(visible.rows, ownLeaderboardRow) : null;
  return <div>
    {!visible ? <p className="text-zinc-400">Loading…</p> : visible.error ? <p role="alert" className="text-red-300">{visible.error}</p> : <>
      {visible.rows.length ? <LeaderboardTable rows={visible.rows} valueLabel="Elo" currentUserId={user?.id} chessRanks top10Badges /> : <p className="text-zinc-400">No verified ranked matches yet.</p>}
      {(offset > 0 || visible.more) && <div className="mt-4 flex justify-between gap-4"><button className="rounded-xl border border-white/20 px-4 py-2 text-sm disabled:opacity-40" disabled={!offset} onClick={() => setPage({ mode, offset: Math.max(0, offset - 50) })}>Previous</button><button className="rounded-xl border border-white/20 px-4 py-2 text-sm disabled:opacity-40" disabled={!visible.more} onClick={() => setPage({ mode, offset: offset + 50 })}>Next</button></div>}
      {pinned && <div className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/[.04] px-3"><p className="pt-3 text-xs font-bold text-amber-200">Your Rank</p><LeaderboardTable rows={[pinned]} valueLabel="Elo" currentUserId={user?.id} chessRanks top10Badges /></div>}
      {own.error && <p role="alert" className="mt-3 text-red-300">{own.error}</p>}
    </>}
  </div>;
}
