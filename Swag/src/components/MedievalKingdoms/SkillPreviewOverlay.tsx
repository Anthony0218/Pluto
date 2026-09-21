import type {
  Position,
  SkillActionId,
} from "../../games/MedievalKingdoms/types";

import ActionIcon from "./ActionIcon";

export default function SkillPreviewOverlay({
  kind,
  start,
  target,
}: {
  kind: SkillActionId;
  start: Position;
  target: Position;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[74] opacity-30">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <line
          x1={start.x}
          y1={start.y}
          x2={target.x}
          y2={target.y}
          stroke="#f3d38a"
          strokeWidth="1"
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />

        <circle
          cx={target.x}
          cy={target.y}
          r={kind === "trap" ? 4 : 3}
          fill={
            kind === "burn" ? "rgba(249,115,22,.25)" : "rgba(231,199,122,.22)"
          }
          stroke={kind === "burn" ? "#f97316" : "#e7c77a"}
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div
        className="absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#e7c77a] bg-[#4a3521]/70 text-[#ffe6a6] shadow-[0_0_15px_rgba(231,199,122,.7)]"
        style={{
          left: `${target.x}%`,
          top: `${target.y}%`,
        }}
      >
        <ActionIcon id={kind} className="h-6 w-6" />
      </div>
    </div>
  );
}
