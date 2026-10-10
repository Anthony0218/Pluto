import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { CLANS } from "../../games/MedievalKingdoms/clanData";

const positionClass = {
  "top-left": "left-3 top-3",

  "top-right": "right-3 top-3",

  "bottom-right": "right-3 bottom-3",

  "bottom-left": "left-3 bottom-3",
} as const;

const clanStyle = {
  falconstone: "border-sky-300/60 bg-slate-950/80 text-sky-100",

  blackthorn: "border-red-400/60 bg-zinc-950/85 text-red-100",

  emberclaw: "border-orange-400/60 bg-stone-950/85 text-orange-100",

  mistveil: "border-emerald-400/60 bg-emerald-950/80 text-emerald-100",
} as const;

export default function ClanCornerBadges() {
  useGameLanguage();
  return (
    <>
      {CLANS.map((clan) => (
        <div
          key={clan.id}
          className={`
              pointer-events-none
              absolute
              z-10
              max-w-40
              rounded-xl
              border
              px-3
              py-2
              backdrop-blur-sm
              ${positionClass[clan.corner]}
              ${clanStyle[clan.id]}
            `}
        >
          <div className="text-[9px] font-black uppercase tracking-[0.18em]">
            {gameUi(clan.name)}
          </div>

          <div className="mt-0.5 text-[8px] opacity-70">{gameUi(clan.motto)}</div>
        </div>
      ))}
    </>
  );
}
