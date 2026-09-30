import type { Position } from "../../games/MedievalKingdoms/types";

export default function AreaTargetOverlay({
  start,
  target,
  radius,
  mapAspectRatio,
}: {
  start: Position;
  target: Position;
  radius: number;
  mapAspectRatio: number;
}) {
  const viewHeight = 100 * mapAspectRatio;

  return (
    <svg
      className="
        pointer-events-none
        absolute
        inset-0
        z-[76]
        h-full
        w-full
      "
      viewBox={`0 0 100 ${viewHeight}`}
      preserveAspectRatio="none"
    >
      <line
        x1={start.x}
        y1={start.y * mapAspectRatio}
        x2={target.x}
        y2={target.y * mapAspectRatio}
        stroke="#111827"
        strokeWidth="2"
        strokeDasharray="5 3"
        vectorEffect="non-scaling-stroke"
      />

      <line
        x1={start.x}
        y1={start.y * mapAspectRatio}
        x2={target.x}
        y2={target.y * mapAspectRatio}
        stroke="#f8fafc"
        strokeWidth="1"
        strokeDasharray="5 3"
        vectorEffect="non-scaling-stroke"
      />

      <circle
        cx={target.x}
        cy={target.y * mapAspectRatio}
        r={radius}
        fill="rgba(168,85,247,0.18)"
        stroke="#a855f7"
        strokeWidth="1.3"
        vectorEffect="non-scaling-stroke"
      />

      <circle
        cx={target.x}
        cy={target.y * mapAspectRatio}
        r="1"
        fill="#fff"
        stroke="#111827"
        strokeWidth="0.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
