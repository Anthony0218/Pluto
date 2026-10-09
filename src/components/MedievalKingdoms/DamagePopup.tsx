import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import type { Position } from "../../games/MedievalKingdoms/types";

export default function DamagePopup({
  position,
  damage,
  hit,
  label,
}: {
  position: Position;
  damage: number;
  hit: boolean;
  label?: string;
}) {
  useGameLanguage();
  return (
    <div
      className="pointer-events-none absolute z-[180] -translate-x-1/2 -translate-y-1/2 animate-bounce"
      style={{
        left: `${position.x}%`,
        top: `${Math.max(3, position.y - 5)}%`,
      }}
    >
      {gameUi(hit ? (
        <div className="rounded-xl border-2 border-[#ffe8ac] bg-[#8c341f]/95 px-4 py-2 text-base font-black text-[#fff1c6] shadow-[0_0_18px_rgba(170,70,35,0.85)]">
          {gameUi(label ?? "HIT")}! −{gameUi(damage)}{gameUi(" HP ")}</div>
      ) : (
        <div className="rounded-xl border border-[#b28a52] bg-[#3b2a1b]/95 px-4 py-2 text-sm font-black text-[#f3dfb8] shadow-xl">
          {gameUi(label ?? "MISS")}
        </div>
      ))}
    </div>
  );
}
