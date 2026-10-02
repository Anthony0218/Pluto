import type { Position } from "../../games/MedievalKingdoms/types";

type Props = {
  start: Position;
  landing: Position;
  elevation: number;
  mapAspectRatio: number;
};

export default function ArcherAimOverlay({
  start,
  landing,
  elevation,
  mapAspectRatio,
}: Props) {
  const viewHeight = 100 * mapAspectRatio;

  const startY = start.y * mapAspectRatio;

  const landingY = landing.y * mapAspectRatio;

  const controlX = (start.x + landing.x) / 2;

  const controlY = Math.min(startY, landingY) - 7 - elevation * 0.055;

  return (
    <svg
      className="
        pointer-events-none
        absolute
        inset-0
        z-[75]
        h-full
        w-full
      "
      viewBox={`0 0 100 ${viewHeight}`}
      preserveAspectRatio="none"
    >
      <path
        d={`
          M ${start.x} ${startY}
          Q ${controlX} ${controlY}
            ${landing.x} ${landingY}
        `}
        fill="none"
        stroke="#111827"
        strokeWidth="2"
        strokeDasharray="5 3"
        vectorEffect="non-scaling-stroke"
      />

      <path
        d={`
          M ${start.x} ${startY}
          Q ${controlX} ${controlY}
            ${landing.x} ${landingY}
        `}
        fill="none"
        stroke="#f8fafc"
        strokeWidth="1"
        strokeDasharray="5 3"
        vectorEffect="non-scaling-stroke"
      />

      <circle
        cx={landing.x}
        cy={landingY}
        r="3"
        fill="rgba(239,68,68,0.18)"
        stroke="#111827"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />

      <circle
        cx={landing.x}
        cy={landingY}
        r="2.3"
        fill="rgba(239,68,68,0.28)"
        stroke="#ef4444"
        strokeWidth="0.8"
        vectorEffect="non-scaling-stroke"
      />

      <line
        x1={landing.x - 1.6}
        y1={landingY}
        x2={landing.x + 1.6}
        y2={landingY}
        stroke="#fff"
        strokeWidth="0.75"
        vectorEffect="non-scaling-stroke"
      />

      <line
        x1={landing.x}
        y1={landingY - 1.6}
        x2={landing.x}
        y2={landingY + 1.6}
        stroke="#fff"
        strokeWidth="0.75"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
