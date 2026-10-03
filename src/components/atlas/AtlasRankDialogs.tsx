import { Link } from "react-router-dom";
import DashboardDialog from "@/components/App/dashboard/DashboardDialog";
import { RANK_THRESHOLDS } from "@/games/atlas/ranked";
import { useAtlasRanks } from "@/games/atlas/useAtlasRanks";
import AtlasRankBadge from "./AtlasRankBadge";

export function AtlasRankGuide({ onClose }: { onClose: () => void }) {
  return <DashboardDialog title="Atlas rank information" onClose={onClose}><p className="text-sm leading-6 text-slate-300">Your rating starts at 1500. The first ten matches are placements. Placements use Glicko-2. After placements, wins and losses move 20–40 rating points depending on opponent strength and uncertainty. A 100-point division takes about five wins or losses. Bronze and Silver use beginner difficulty, Gold and Platinum intermediate, and Diamond and above expert. Both players share the difficulty of their average rating. Divisions progress from III to I. Only players with completed ranked matches appear on the leaderboard; only the top ten show a position inside their badge.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{RANK_THRESHOLDS.map((rank, index) => <article key={index} className="rounded-xl border border-white/10 bg-white/5 p-3"><AtlasRankBadge rating={Number.isFinite(rank.rating) ? rank.rating : 100} /><p className="mt-2 text-sm text-slate-400">{index === 0 ? "Below 800" : index === RANK_THRESHOLDS.length - 1 ? "2400+" : `${rank.rating}–${RANK_THRESHOLDS[index + 1].rating - 1}`} Rating</p></article>)}</div></DashboardDialog>;
}
export function AtlasLeaderboard({ onClose }: { onClose: () => void }) {
  const { rows, loading, error } = useAtlasRanks();
  return <DashboardDialog title="Atlas ranked leaderboard" onClose={onClose}>{loading ? <p>Loading leaderboard…</p> : error ? <p role="alert">{error}</p> : !rows.length ? <p>Complete the first ranked match to join the leaderboard.</p> : <ol className="space-y-2">{rows.map(row => <li key={row.user_id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"><span className="w-8 text-slate-400">{row.leaderboard_rank}</span><Link to={`/profile/${row.user_id}`} className="min-w-20 flex-1 font-bold">{row.username || "Explorer"}</Link><AtlasRankBadge rating={row.rating} position={row.leaderboard_rank} /><strong>{Math.round(row.rating)}</strong></li>)}</ol>}</DashboardDialog>;
}
