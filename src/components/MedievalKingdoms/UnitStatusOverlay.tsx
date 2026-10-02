import type { DefenseActionId, Unit } from "../../games/MedievalKingdoms/types";
import ActionIcon from "./ActionIcon";

export default function UnitStatusOverlay({
  unit,
  previewDefense = null,
}: {
  unit: Unit;
  previewDefense?: DefenseActionId | null;
}) {
  const defense = previewDefense ?? unit.defenseMode;
  return (
    <>
      {defense && (
        <div
          className={`pointer-events-none absolute -inset-2 z-[-1] rounded-full border-2 ${previewDefense ? "border-[#e7c77a]/50 opacity-35" : "border-[#e7c77a]/85 animate-pulse"} shadow-[0_0_12px_rgba(231,199,122,0.65)]`}
        />
      )}
      {defense && (
        <div
          className={`pointer-events-none absolute -right-3 -top-3 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-[#d9b665] bg-[#4a3521]/95 text-[#f8e7bd] ${previewDefense ? "opacity-40" : ""}`}
        >
          <ActionIcon id={defense} className="h-4 w-4" />
        </div>
      )}
      {unit.damageBoostTurns > 0 && (
        <div className="pointer-events-none absolute -left-3 -top-3 z-50 flex h-7 w-7 items-center justify-center rounded-full border border-[#e0b94f] bg-[#5a421c]/95 text-[#ffe68a] shadow-[0_0_10px_rgba(224,185,79,0.75)]">
          <ActionIcon id="damageBoost" className="h-4 w-4" />
        </div>
      )}
      {unit.burnTurns > 0 && (
        <>
          <div className="pointer-events-none absolute -inset-1 z-50 animate-pulse rounded-full border-2 border-orange-500/70 shadow-[0_0_16px_rgba(249,115,22,0.9)]" />
          <div className="pointer-events-none absolute -bottom-4 left-1/2 z-50 -translate-x-1/2 text-xl drop-shadow-[0_0_7px_rgba(255,90,0,1)]">
            🔥
          </div>
        </>
      )}
    </>
  );
}
