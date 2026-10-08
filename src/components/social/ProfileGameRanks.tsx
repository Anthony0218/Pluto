import type { ReactNode } from "react";
import RankEmblem from "../chess/RankEmblem";
import { getRankFromProfile } from "../../games/atlas/ranked";
import { getChessRank } from "../../games/chess/ranked/tiers";
import { timeControls, timeControlLabel } from "../../games/chess/ranked/timeControls";
import { goTimeControlLabel } from "../../games/go/ranked/config";
import { useGoRankedProfile } from "../../games/go/ranked/profile";
import { useAtlasRanks } from "../../games/atlas/useAtlasRanks";
import { ui } from "../../i18n/ui";

export type ProfileChessRating = { time_control: string; rating: number; rated_games: number };

/** One rating cell. The three rank groups below render their cells straight into the header's grid (`contents`), so every mode's box is the same size. */
function RankCell({ label, name, detail, emblem }: { label: string; name: string; detail: string; emblem?: ReactNode }) {
  return <div className="flex min-w-0 items-center gap-2 rounded-xl border border-amber-300/20 bg-[#06101e]/75 p-2.5">
    {emblem}
    <div className="min-w-0"><span className="block text-[10px] font-bold leading-4 text-indigo-200">{label}</span><strong className="block text-xs text-amber-100">{name}</strong><small className="block text-[10px] leading-4 text-amber-200/70">{detail}</small></div>
  </div>;
}

function EloRank({ label, rating, played }: { label: string; rating: number; played: boolean }) {
  const tier = getChessRank(rating);
  return <RankCell label={label} name={played ? ui(tier.name) : ui("Unranked")} detail={played ? `${rating} Elo` : ui("Play ranked to earn a rank")} emblem={played ? <RankEmblem family={tier.family} size="sm" /> : undefined} />;
}

export function ProfileChessRanks({ rows, loading, error }: { rows: ProfileChessRating[]; loading: boolean; error: string | null }) {
  return <div className="contents" role="group" aria-label="Chess ranks">
    {error ? <p className="col-span-full text-xs text-red-300" role="alert">{error}</p> : loading ? <p className="col-span-full text-xs text-indigo-200" role="status">{ui("Loading...")}</p> : timeControls.map(control => {
      const row = rows.find(item => item.time_control === control.id);
      return <EloRank key={control.id} label={`Chess · ${timeControlLabel(control.id, ui)}`} rating={row?.rating ?? 1500} played={(row?.rated_games ?? 0) > 0} />;
    })}
  </div>;
}

export function ProfileGoRanks({ userId }: { userId: string }) {
  const { rows, error } = useGoRankedProfile(userId);
  return <div className="contents" role="group" aria-label="Go ranks">
    {error ? <p className="col-span-full text-xs text-red-300" role="alert">{error}</p> : !rows ? <p className="col-span-full text-xs text-indigo-200" role="status">{ui("Loading Go ratings…")}</p> : !rows.length ? <p className="col-span-full text-xs text-indigo-200">{ui("No Go ranked ratings available yet.")}</p> : rows.map(row => <EloRank key={row.time_control} label={`Go · ${goTimeControlLabel(row.time_control)}`} rating={row.rating} played={row.rated_games > 0} />)}
  </div>;
}

export function ProfileAtlasRank({ userId }: { userId: string }) {
  const { rows, loading, error } = useAtlasRanks([userId]);
  const row = rows[0];
  const rank = row ? getRankFromProfile(row) : null;
  const label = `Atlas Arena · ${ui("Ranked")}`;
  return <div className="contents" role="group" aria-label="Atlas Arena rank">
    {error ? <p role="alert" className="col-span-full text-xs text-red-300">{error}</p> : loading ? <p role="status" className="col-span-full text-xs text-indigo-200">{ui("Loading...")}</p> : !row || row.matches_played === 0
      ? <RankCell label={label} name={ui("Unranked")} detail={ui("Play ranked to earn a rank")} />
      : <RankCell label={label} name={row.matches_played < 3 ? ui("Placement") : rank!.provisional ? `${ui("Tentative")} ${rank!.displayName}` : rank!.displayName} detail={`${Math.round(row.rating)} ${ui("Rating")}${row.leaderboard_rank ? ` · #${row.leaderboard_rank}` : ""}`} emblem={<RankEmblem family={rank!.tier} size="sm" />} />}
  </div>;
}
