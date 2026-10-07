import RankEmblem from "../chess/RankEmblem";
import { getRankFromProfile } from "../../games/atlas/ranked";
import { getChessRank } from "../../games/chess/ranked/tiers";
import { timeControls, timeControlLabel } from "../../games/chess/ranked/timeControls";
import { goTimeControlLabel } from "../../games/go/ranked/config";
import { useGoRankedProfile } from "../../games/go/ranked/profile";
import { useAtlasRanks } from "../../games/atlas/useAtlasRanks";
import { ui } from "../../i18n/ui";

export type ProfileChessRating = { time_control: string; rating: number; rated_games: number };

function EloRank({ label, rating, played }: { label: string; rating: number; played: boolean }) {
  const tier = getChessRank(rating);
  return <div className="flex items-center gap-2 rounded-xl border border-amber-300/20 bg-[#06101e]/75 p-2.5">
    {played && <RankEmblem family={tier.family} size="sm" />}
    <div><span className="block text-[10px] font-bold text-indigo-200">{label}</span><strong className="block text-xs text-amber-100">{played ? ui(tier.name) : ui("Unranked")}</strong><small className="text-[10px] text-amber-200/70">{played ? `${rating} Elo` : ui("Play ranked to earn a rank")}</small></div>
  </div>;
}

export function ProfileChessRanks({ rows, loading, error }: { rows: ProfileChessRating[]; loading: boolean; error: string | null }) {
  return <div className="col-span-2 w-full sm:max-w-md" aria-label="Chess ranks">
    {error ? <p className="text-xs text-red-300" role="alert">{error}</p> : loading ? <p className="text-xs text-indigo-200" role="status">{ui("Loading...")}</p> : <div className="grid grid-cols-2 gap-2">{timeControls.map(control => {
      const row = rows.find(item => item.time_control === control.id);
      return <EloRank key={control.id} label={`Chess · ${timeControlLabel(control.id, ui)}`} rating={row?.rating ?? 1500} played={(row?.rated_games ?? 0) > 0} />;
    })}</div>}
  </div>;
}

export function ProfileGoRanks({ userId }: { userId: string }) {
  const { rows, error } = useGoRankedProfile(userId);
  return <div className="col-span-2 w-full sm:max-w-md" aria-label="Go ranks">
    {error ? <p className="text-xs text-red-300" role="alert">{error}</p> : !rows ? <p className="text-xs text-indigo-200" role="status">{ui("Loading Go ratings…")}</p> : !rows.length ? <p className="text-xs text-indigo-200">{ui("No Go ranked ratings available yet.")}</p> : <div className="grid grid-cols-2 gap-2">{rows.map(row => <EloRank key={row.time_control} label={`Go · ${goTimeControlLabel(row.time_control)}`} rating={row.rating} played={row.rated_games > 0} />)}</div>}
  </div>;
}

export function ProfileAtlasRank({ userId }: { userId: string }) {
  const { rows, loading, error } = useAtlasRanks([userId]);
  const row = rows[0];
  const rank = row ? getRankFromProfile(row) : null;
  return <div className="col-span-2 rounded-2xl border border-amber-300/20 bg-[#06101e]/75 p-3" aria-label="Atlas Arena rank">
    <span className="mb-1 block text-[10px] font-bold text-indigo-200">Atlas Arena · {ui("Ranked")}</span>
    {error ? <p role="alert" className="text-xs text-red-300">{error}</p> : loading ? <p role="status" className="text-xs text-indigo-200">{ui("Loading...")}</p> : !row || row.matches_played === 0 ? <strong className="text-sm text-amber-100">{ui("Unranked")}</strong> : <div className="flex items-center gap-3"><RankEmblem family={rank!.tier} size="sm" /><div><strong className="block text-sm text-amber-100">{row.matches_played < 3 ? ui("Placement") : rank!.provisional ? `${ui("Tentative")} ${rank!.displayName}` : rank!.displayName}</strong><small className="mt-1 block text-amber-200/70">{Math.round(row.rating)} {ui("Rating")}{row.leaderboard_rank ? ` · #${row.leaderboard_rank}` : ""}</small></div></div>}
  </div>;
}
