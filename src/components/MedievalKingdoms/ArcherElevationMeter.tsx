import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
export default function ArcherElevationMeter({
  elevation,
}: {
  elevation: number;
}) {
  useGameLanguage();
  return (
    <div className="rounded-xl border border-[#86623a]/70 bg-[#2e2015]/80 p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#bfa77e]">{gameUi(" Elevation timing ")}</div>

      <div className="mt-2 flex items-end gap-3">
        <div className="relative h-36 w-8 overflow-hidden rounded-full border border-[#80603a] bg-[#25190f]">
          <div
            className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-slate-500 via-zinc-200 to-white"
            style={{
              height: `${elevation}%`,
            }}
          />

          <div
            className="absolute left-[-4px] right-[-4px] h-[3px] bg-red-400 shadow-[0_0_8px_rgba(248,113,113,1)]"
            style={{
              bottom: `${elevation}%`,
            }}
          />
        </div>

        <div className="text-xs text-[#bfa77e]">
          <div>{gameUi(" Low angle ")}<br />{gameUi(" short shot ")}</div>

          <div className="mt-5">{gameUi(" High angle ")}<br />{gameUi(" long shot ")}</div>

          <div className="mt-4 text-lg font-black text-[#ffe7ad]">
            {gameUi(Math.round(elevation))}°
          </div>
        </div>
      </div>
    </div>
  );
}
