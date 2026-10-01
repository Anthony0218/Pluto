import { ui, useUiLanguage } from "@/i18n/ui";
import RankEmblem from "@/components/chess/RankEmblem";
import { getChessRank } from "@/games/chess/ranked/tiers";
import { ProfileAvatar } from "./ProfileAvatarPicker";

export type LeaderboardRow = { rank: number; user_id: string; username: string; avatar_id: string | null; value: number; detail?: string };

/** With `chessRanks`, each row's value is an Elo rating and the player's rank emblem is shown beside their name. */
export default function LeaderboardTable({ rows, valueLabel, currentUserId, chessRanks = false }: { rows: LeaderboardRow[]; valueLabel: string; currentUserId?: string; chessRanks?: boolean }) {
  useUiLanguage();
  return <table className="w-full table-fixed text-left text-sm"><caption className="sr-only">Top 10 by {valueLabel}</caption><thead className="border-b border-white/15 text-xs uppercase tracking-widest text-slate-400"><tr><th scope="col" className="w-12 py-3">#</th><th scope="col" className="py-3">{ui("Player")}</th><th scope="col" className="w-24 py-3 text-right">{valueLabel}</th></tr></thead><tbody>{rows.map(row => {
    const tier = chessRanks ? getChessRank(row.value) : null;
    return <tr key={row.user_id} className={`border-b border-white/10 ${row.user_id === currentUserId ? "bg-amber-300/10" : ""}`}>
      <td className={`py-3 font-black ${row.rank === 1 ? "text-yellow-300" : row.rank === 2 ? "text-slate-200" : row.rank === 3 ? "text-orange-300" : "text-amber-200"}`}>{row.rank}</td>
      <td className="py-3"><span className="flex min-w-0 items-center gap-3">
        <ProfileAvatar avatarId={row.avatar_id ?? "m1"} className="h-9 w-9 shrink-0 rounded-full" />
        <span className="min-w-0"><span className="block truncate font-semibold text-white">{row.username}</span>{tier ? <span className="block truncate text-xs font-semibold text-amber-200/80">{ui(tier.name)}</span> : row.detail && <span className="block truncate text-xs text-slate-400">{row.detail}</span>}</span>
        {tier && <RankEmblem family={tier.family} size="md" />}
      </span></td>
      <td className="py-3 text-right font-black tabular-nums text-white">{row.value}</td>
    </tr>;
  })}</tbody></table>;
}
