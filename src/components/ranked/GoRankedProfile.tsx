import { Link } from "react-router-dom";
import RankEmblem from "@/components/chess/RankEmblem";
import TopRankBadge from "@/components/chess/TopRankBadge";
import { getChessRank } from "@/games/chess/ranked/tiers";
import { goTimeControlLabel, isTop10 } from "@/games/go/ranked/config";
import { useGoRankedProfile } from "@/games/go/ranked/profile";
export default function GoRankedProfile({ userId }: { userId: string }) {
  const { rows, error } = useGoRankedProfile(userId);
  return <section className="rounded-[26px] border border-indigo-400/15 bg-[#0b1529]/90 p-5 shadow-xl shadow-black/20">
    <h2 className="text-lg font-black text-white"><Link to="/games/go/ranked">Go · Ranked</Link></h2>
    {error ? <p role="alert" className="mt-3 text-red-300">{error}</p> : !rows ? <p className="mt-3 text-zinc-400">Loading Go ratings…</p> : rows.length === 0 ? <p className="mt-3 text-zinc-400">No Go ranked ratings available yet.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{rows.map(row => {
      const tier = getChessRank(row.rating);
      return <article key={row.time_control} className={`rounded-2xl border border-amber-300/25 bg-amber-300/[.06] p-4 ${isTop10(row.leaderboard_rank) ? "top-rank-glow" : ""}`}>
        <p className="text-xs font-bold text-amber-200">{goTimeControlLabel(row.time_control)}</p>
        <div className="mt-3 flex items-center gap-3"><RankEmblem family={tier.family} size="sm" /><div><strong className="block text-sm text-amber-100">{tier.name}</strong><span className="text-sm text-white">{row.rating} Elo</span></div></div>
        <div className="mt-3 flex items-center gap-2 text-amber-200">{row.leaderboard_rank ? `#${row.leaderboard_rank}` : "Unranked"}{isTop10(row.leaderboard_rank) && <TopRankBadge rank={row.leaderboard_rank!} size="sm" />}</div>
        <p className="mt-2 text-xs leading-5 text-zinc-400">{row.rated_games} games · {row.wins} wins · {row.losses} losses · {row.draws} jigo<br />Peak {row.peak_rating} Elo</p>
      </article>;
    })}</div>}
  </section>;
}
