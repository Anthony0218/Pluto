import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
export default function ActionTimingMeter({
  title,
  value,
  lowLabel,
  highLabel,
}: {
  title: string;
  value: number;
  lowLabel: string;
  highLabel: string;
}) {
  useGameLanguage();
  return (
    <div className="rounded-xl border border-[#86623a]/70 bg-[#2e2015]/80 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#bfa77e]">
        {gameUi(title)}
      </div>

      <div className="mt-3">
        <div className="relative h-5 overflow-hidden rounded-full border border-zinc-600 bg-[#25190f]">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-zinc-600 via-zinc-200 to-amber-300"
            style={{
              width: `${value}%`,
            }}
          />

          <div
            className="absolute bottom-[-3px] top-[-3px] w-[3px] bg-red-400 shadow-[0_0_8px_rgba(248,113,113,1)]"
            style={{
              left: `${value}%`,
            }}
          />
        </div>

        <div className="mt-2 flex justify-between text-[9px] font-bold uppercase tracking-wide text-[#a58b66]">
          <span>{gameUi(lowLabel)}</span>
          <span className="text-sm text-[#ffe7ad]">{gameUi(Math.round(value))}%</span>
          <span>{gameUi(highLabel)}</span>
        </div>
      </div>
    </div>
  );
}
