import { useEffect, useRef, useState } from "react";

import type { Position } from "../../games/MedievalKingdoms/types";

type Props = {
  start: Position;
  end: Position;

  kind: "straight" | "archer";

  arcHeight?: number;

  mapAspectRatio: number;

  onDone: () => void;
};

export default function ProjectileOverlay({
  start,
  end,
  kind,
  arcHeight = 12,
  mapAspectRatio,
  onDone,
}: Props) {
  const [t, setT] = useState(0);

  const doneRef = useRef(false);

  useEffect(() => {
    const duration = kind === "archer" ? 1350 : 950;

    const startedAt = performance.now();

    let frame = 0;

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);

      setT(progress);

      if (progress < 1) {
        frame = requestAnimationFrame(animate);

        return;
      }

      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    };

    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, [kind, onDone]);

  const viewHeight = 100 * mapAspectRatio;

  const sx = start.x;

  const sy = start.y * mapAspectRatio;

  const ex = end.x;

  const ey = end.y * mapAspectRatio;

  const linearX = sx + (ex - sx) * t;

  const linearY = sy + (ey - sy) * t;

  const arc = kind === "archer" ? arcHeight * 4 * t * (1 - t) : 0;

  const x = linearX;

  const y = linearY - arc;

  const previousT = Math.max(0, t - 0.02);

  const previousX = sx + (ex - sx) * previousT;

  const previousLinearY = sy + (ey - sy) * previousT;

  const previousArc =
    kind === "archer" ? arcHeight * 4 * previousT * (1 - previousT) : 0;

  const previousY = previousLinearY - previousArc;

  const angle = (Math.atan2(y - previousY, x - previousX) * 180) / Math.PI;

  return (
    <svg
      className="
        pointer-events-none
        absolute
        inset-0
        z-[150]
        h-full
        w-full
      "
      viewBox={`0 0 100 ${viewHeight}`}
      preserveAspectRatio="none"
    >
      {/* Travel trail */}
      <line
        x1={sx}
        y1={sy}
        x2={x}
        y2={y}
        stroke="rgba(15,23,42,0.65)"
        strokeWidth="3.4"
        vectorEffect="non-scaling-stroke"
      />

      <line
        x1={sx}
        y1={sy}
        x2={x}
        y2={y}
        stroke="rgba(226,232,240,0.8)"
        strokeWidth="1.35"
        vectorEffect="non-scaling-stroke"
      />

      <g
        transform={`
          translate(${x} ${y})
          rotate(${angle})
        `}
      >
        {/* Big silver arrow body */}
        <line
          x1="-4.5"
          y1="0"
          x2="2.5"
          y2="0"
          stroke="#111827"
          strokeWidth="4.2"
          vectorEffect="non-scaling-stroke"
        />

        <line
          x1="-4.5"
          y1="0"
          x2="2.5"
          y2="0"
          stroke="#e5e7eb"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />

        <polygon
          points="4.8,0 1.4,-2.6 1.4,2.6"
          fill="#f8fafc"
          stroke="#111827"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        <polygon
          points="-4.3,0 -6.3,-2.1 -5.3,0 -6.3,2.1"
          fill="#cbd5e1"
          stroke="#111827"
          strokeWidth="0.7"
          vectorEffect="non-scaling-stroke"
        />
      </g>

      <circle
        cx={x}
        cy={y}
        r="1.8"
        fill="rgba(255,255,255,0.18)"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="0.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
