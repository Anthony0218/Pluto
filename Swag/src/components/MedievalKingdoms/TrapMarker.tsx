import type { Trap } from "../../games/MedievalKingdoms/types";
export default function TrapMarker({
  trap,
  visible,
}: {
  trap: Trap;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div
      className="pointer-events-none absolute z-25 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${trap.position.x}%`, top: `${trap.position.y}%` }}
    >
      <div className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#c69948] bg-[#4b2f1d]/70 shadow-[0_0_13px_rgba(198,153,72,0.8)]">
        <div className="absolute h-6 w-6 animate-spin rounded-full border border-dashed border-[#f3d38a]" />
        <span className="text-lg text-[#ffe8a3]">✦</span>
      </div>
    </div>
  );
}
