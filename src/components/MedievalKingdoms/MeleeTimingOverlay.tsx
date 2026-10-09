import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import type { Position } from "../../games/MedievalKingdoms/types";

export default function MeleeTimingOverlay({
  position,
  pulse,
  interactive,
  preview = false,
  onStrike,
}: {
  position: Position;
  pulse: number;
  interactive: boolean;
  preview?: boolean;
  onStrike?: () => void;
}) {
  useGameLanguage();
  const diameter = 38 + pulse * 118;
  const score = Math.max(0, Math.min(1, 1 - pulse));

  return (
    <div
      className={`absolute z-[115] -translate-x-1/2 -translate-y-1/2 ${preview ? "opacity-35" : ""}`}
      style={{ left: `${position.x}%`, top: `${position.y}%` }}
    >
      <button
        type="button"
        disabled={!interactive}
        onClick={(event) => {
          event.stopPropagation();
          onStrike?.();
        }}
        className={`relative flex h-44 w-44 items-center justify-center rounded-full ${interactive ? "cursor-crosshair" : "cursor-default"}`}
        aria-label={gameUi("Strike at the current melee timing")}
      >
        <div className="absolute h-40 w-40 rounded-full border-2 border-[#8b5a2b]/80 bg-[#8b5a2b]/10" />
        <div className="absolute h-28 w-28 rounded-full border-2 border-[#c0c0c0]/90 bg-[#c0c0c0]/10" />
        <div className="absolute h-16 w-16 rounded-full border-2 border-[#d6a62e] bg-[#d6a62e]/15 shadow-[0_0_15px_rgba(214,166,46,0.45)]" />
        <div className="absolute h-4 w-4 rounded-full bg-[#fff2b2] shadow-[0_0_12px_rgba(255,226,112,1)]" />
        <div
          className="absolute rounded-full border-[4px] border-[#f4e4b8] shadow-[0_0_10px_rgba(78,52,28,0.9),0_0_20px_rgba(244,228,184,0.8)]"
          style={{ width: `${diameter}px`, height: `${diameter}px` }}
        />
        {gameUi(!preview && (
          <div className="absolute top-full mt-2 whitespace-nowrap rounded-lg border border-[#b98a45]/50 bg-[#3b2a1b]/95 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#f7e8c6]">
            {gameUi(score > 0.9
              ? "Perfect!"
              : score > 0.65
                ? "Strong"
                : score > 0.35
                  ? "Good"
                  : "Weak")}
          </div>
        ))}
      </button>
    </div>
  );
}
