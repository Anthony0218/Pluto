import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
type Props = {
  x: number;
  y: number;
  range: number;
  type: "move" | "attack";
};

export default function RangeZone({ x, y, range, type }: Props) {
  useGameLanguage();
  const isMove = type === "move";

  return (
    <div
      className={`
        pointer-events-none
        absolute
        z-20
        -translate-x-1/2
        -translate-y-1/2
        rounded-full
        ${
          isMove
            ? "border-2 border-sky-400/90 bg-sky-300/10 shadow-[0_0_5px_rgba(15,23,42,0.95)]"
            : "border-2 border-red-500/90 bg-red-400/[0.05] shadow-[0_0_5px_rgba(15,23,42,0.95)]"
        }
      `}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${range * 2}%`,
        aspectRatio: "1 / 1",
      }}
    >
      <div
        className={`
          absolute
          left-1/2
          -translate-x-1/2
          whitespace-nowrap
          rounded-full
          border
          border-black/40
          px-3
          py-1
          text-[9px]
          font-black
          uppercase
          tracking-[0.14em]
          ${
            isMove
              ? "top-1 bg-sky-950/95 text-white"
              : "bottom-1 bg-red-950/95 text-white"
          }
        `}
      >
        {gameUi(isMove ? "Can Move" : "Can Attack")}
      </div>
    </div>
  );
}
