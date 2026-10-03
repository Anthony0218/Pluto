import RankEmblem from "@/components/chess/RankEmblem";
import { getRankFromRating } from "@/games/atlas/ranked";

export default function AtlasRankBadge({ rating, position }: { rating: number; position?: number | null }) {
  const rank = getRankFromRating(rating);
  const top = Number.isInteger(position) && position! >= 1 && position! <= 10;
  return <span className="atlas-rank-badge" title={`${rank.displayName} · ${Math.round(rating)} Rating`}><span className="atlas-rank-emblem"><RankEmblem family={rank.tier} size="sm" />{top && <b aria-label={`Top ${position}`}>#{position}</b>}</span><span>{rank.displayName}</span></span>;
}
