import { ProfileAvatar } from "./ProfileAvatarPicker";

export type LeaderboardRow = { rank: number; user_id: string; username: string; avatar_id: string | null; value: number };

export default function LeaderboardTable({ rows, valueLabel, currentUserId }: { rows: LeaderboardRow[]; valueLabel: string; currentUserId?: string }) {
  return <table className="w-full table-fixed text-left text-sm"><caption className="sr-only">Top 10 by {valueLabel}</caption><thead className="border-b border-white/15 text-xs uppercase tracking-widest text-slate-400"><tr><th scope="col" className="w-12 py-3">#</th><th scope="col" className="py-3">Player</th><th scope="col" className="w-24 py-3 text-right">{valueLabel}</th></tr></thead><tbody>{rows.map(row => <tr key={row.user_id} className={`border-b border-white/10 ${row.user_id === currentUserId ? "bg-amber-300/10" : ""}`}><td className="py-3 font-black text-amber-200">{row.rank}</td><td className="py-3"><span className="flex min-w-0 items-center gap-3"><ProfileAvatar avatarId={row.avatar_id ?? "m1"} className="h-9 w-9 shrink-0 rounded-full" /><span className="truncate font-semibold text-white">{row.username}</span></span></td><td className="py-3 text-right font-black tabular-nums text-white">{row.value}</td></tr>)}</tbody></table>;
}
