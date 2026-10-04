import RankEmblem from "@/components/chess/RankEmblem";
import { getRankFromRating, getRankFromProfile } from "@/games/atlas/ranked";

export default function AtlasRankBadge({ rating, position, deviation, matchesPlayed }: { rating: number; position?: number | null; deviation?:number; matchesPlayed?:number }) {
  const rank = deviation!==undefined && matchesPlayed!==undefined ? getRankFromProfile({rating,deviation,matches_played:matchesPlayed}) : getRankFromRating(rating);
  const provisional=matchesPlayed!==undefined&&matchesPlayed<10;
  const top = Number.isInteger(position) && position! >= 1 && position! <= 10;
  return <span className="atlas-rank-badge" title={`${rank.displayName} · ${Math.round(rating)} Rating`}><span className="atlas-rank-emblem"><RankEmblem family={rank.tier} size="sm" />{top && <b aria-label={`Top ${position}`}>#{position}</b>}</span><span>{provisional?(matchesPlayed!<3?"Placement":`Tentative ${rank.displayName}`):rank.displayName}</span></span>;
}
