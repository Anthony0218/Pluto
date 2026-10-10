import { gameUi } from "../../i18n/gameUi.ts";
import { ui, useUiLanguage } from "@/i18n/ui";
import TopRankBadge from "@/components/chess/TopRankBadge";
import RankEmblem from "@/components/chess/RankEmblem";
import { getChessRank } from "@/games/chess/ranked/tiers";
import { ProfileAvatar } from "@/components/social/ProfileAvatarPicker";

export default function RankedPlayerBar({
  name,
  avatarId,
  color,
  active,
  me = false,
  rating,
  ratingChange,
  topRank,
  leaderboardRank,
  showTier = false,
  t,
}: {
  name: string;
  avatarId: string;
  color: "white" | "black";
  active: boolean;
  me?: boolean;
  rating?: number;
  ratingChange?: { before: number; after: number };
  topRank?: number;
  leaderboardRank?: number | null;
  showTier?: boolean;
  t: (key: string) => string;
}) {
  useUiLanguage();
  return (
    <div
      className={`
        ${topRank ? "top-rank-glow" : ""}
        relative
        rounded-3xl
        border
        px-4
        py-3.5
        transition-all
        duration-200

        ${
          active
            ? `
              border-amber-400/30
              bg-[linear-gradient(145deg,rgba(39,30,13,.52),rgba(7,14,22,.95))]
              shadow-[0_0_26px_rgba(251,191,36,0.07)]
            `
            : `
              border-white/10
              bg-[linear-gradient(145deg,rgba(10,18,28,.96),rgba(5,10,17,.94))]
            `
        }
      `}
    >
      {topRank && <span className="absolute -top-2.5 right-4 z-10"><TopRankBadge rank={topRank} size="sm" /></span>}
      <div className="flex items-center gap-3">
        <div
          className={`
            h-14
            w-14
            shrink-0
            overflow-hidden
            rounded-full
            ring-4 ring-white/[0.025]
            border
            ${color === "white" ? "border-amber-100/25" : "border-white/10"}
          `}
        >
          <ProfileAvatar avatarId={avatarId} className="h-full w-full" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-bold text-zinc-100">{gameUi(name)}</p>

            {gameUi(me && (
              <span
                className="
                  rounded-full
                  bg-amber-400/10
                  px-2
                  py-0.5
                  text-[8px]
                  font-black
                  uppercase
                  tracking-widest
                  text-amber-300
                "
              >
                {t("You")}
              </span>
            ))}
          </div>

          <p className="mt-0.5 text-[11px] text-zinc-500">
            {gameUi(color === "white" ? t("White") : t("Black"))}
          </p>
          {rating !== undefined && <p className="mt-1 text-xs font-bold text-amber-200">{ui("Elo")} {gameUi(ratingChange ? `${ratingChange.before} → ${ratingChange.after} (${ratingChange.after - ratingChange.before >= 0 ? "+" : ""}${ratingChange.after - ratingChange.before})` : rating)}</p>}
        </div>

        {showTier && rating !== undefined && <RankEmblem family={getChessRank(rating).family} size="sm" />}
        {leaderboardRank && <span className="text-xs font-bold text-amber-200">#{gameUi(leaderboardRank)}</span>}
        {gameUi(active && (
          <div
            className="
              flex
              shrink-0
              items-center
              gap-1.5
              rounded-full
              bg-amber-400/10
              px-2
              py-1
              text-[9px]
              font-black
              uppercase
              tracking-wider
              text-amber-300
            "
          >
            <span
              className="
                h-1.5
                w-1.5
                animate-pulse
                rounded-full
                bg-amber-400
              "
            />
            {t("Turn")}
          </div>
        ))}
      </div>
    </div>
  );
}
