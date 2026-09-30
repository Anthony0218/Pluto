import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import LeaderboardTable, { type LeaderboardRow } from "@/components/social/LeaderboardTable";

type EloRow = { rank: number; user_id: string; username: string; avatar_id: string | null; rating: number; rated_games: number };

export default function LeaderboardsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"elo" | "puzzles">("elo");
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    void supabase.rpc("get_chess_elo_leaderboard").then(({ data, error: queryError }) => {
      if (!alive) return;
      setRows(((data ?? []) as EloRow[]).map(row => ({ rank: row.rank, user_id: row.user_id, username: row.username, avatar_id: row.avatar_id, value: row.rating })));
      setError(queryError?.message ?? null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user]);
  return <main className="mx-auto max-w-4xl px-4 py-10 text-white sm:px-6"><header className="rounded-[28px] border-2 border-indigo-300/25 bg-[#101b34] p-7 shadow-[7px_7px_0_#090f20]"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.25em] text-amber-300"><Trophy size={17} /> Competition</p><h1 className="mt-2 text-4xl font-black">Chess leaderboards</h1><p className="mt-2 text-slate-400">Achievements are ranked separately so every board has a clear meaning.</p></header><section className="mt-7 rounded-[28px] border-2 border-indigo-300/25 bg-[#101b34] p-5 shadow-[7px_7px_0_#090f20] sm:p-7"><div role="tablist" aria-label="Chess leaderboard" className="flex flex-wrap gap-2" onKeyDown={event => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; event.preventDefault(); const next = tab === "elo" ? "puzzles" : "elo"; setTab(next); document.getElementById(`leaderboard-${next}`)?.focus(); }}><button role="tab" id="leaderboard-elo" aria-selected={tab === "elo"} aria-controls="leaderboard-panel" tabIndex={tab === "elo" ? 0 : -1} onClick={() => setTab("elo")} className={`rounded-xl border px-4 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-amber-300 ${tab === "elo" ? "border-amber-300 bg-amber-300/15" : "border-white/20"}`}>Highest Chess ELO</button><button role="tab" id="leaderboard-puzzles" aria-selected={tab === "puzzles"} aria-controls="leaderboard-panel" tabIndex={tab === "puzzles" ? 0 : -1} onClick={() => setTab("puzzles")} className={`rounded-xl border px-4 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-amber-300 ${tab === "puzzles" ? "border-amber-300 bg-amber-300/15" : "border-white/20"}`}>Perfect Really Hard puzzles</button></div><div role="tabpanel" id="leaderboard-panel" aria-labelledby={`leaderboard-${tab}`} className="mt-5">{!user ? <p className="text-slate-400"><Link to="/login" className="text-amber-300 underline">Sign in</Link> to view leaderboards.</p> : tab === "puzzles" ? <p className="rounded-xl border border-white/10 p-5 text-sm text-slate-400">This board will open when puzzle attempts have server-verified mistake records. Current puzzle completions cannot safely support a competitive ranking.</p> : loading ? <p className="text-slate-400">Loading ratings…</p> : error ? <p role="alert" className="text-red-300">{error}</p> : rows.length ? <LeaderboardTable rows={rows} valueLabel="ELO" currentUserId={user.id} /> : <p className="text-slate-400">No verified ranked matches yet.</p>}</div></section></main>;
}
