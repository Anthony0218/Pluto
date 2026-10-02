import type { Position } from "../../games/MedievalKingdoms/types";

export default function ContinentHoverArrow({ marker }: { marker: Position }) {
  return (
    <div
      className="
        pointer-events-none
        absolute
        z-40
        -translate-x-1/2
        -translate-y-full
        animate-bounce
      "
      style={{
        left: `${marker.x}%`,
        top: `${marker.y}%`,
        filter: "drop-shadow(0 0 5px #fbbf24) drop-shadow(0 0 12px #f59e0b)",
      }}
    >
      <svg width="42" height="70" viewBox="0 0 42 70" aria-hidden="true">
        <path
          d="
            M 17 2
            L 25 2
            L 25 42
            L 38 42
            L 21 67
            L 4 42
            L 17 42
            Z
          "
          fill="#fbbf24"
          stroke="#713f12"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        <path
          d="M 20 7 L 22 7 L 22 43 L 20 43 Z"
          fill="#fef3c7"
          opacity="0.9"
        />
      </svg>

      <div className="absolute left-1/2 top-[48px] h-4 w-4 -translate-x-1/2 rounded-full bg-amber-300/35 blur-md" />
    </div>
  );
}
