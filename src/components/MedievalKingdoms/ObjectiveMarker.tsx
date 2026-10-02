import type { BattleObjective } from "../../games/MedievalKingdoms/types";

export default function ObjectiveMarker({
  objective,
}: {
  objective: BattleObjective;
}) {
  return (
    <>
      <div
        className="
          pointer-events-none
          absolute
          z-10
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          border-2
          border-amber-400/90
          bg-amber-300/10
        "
        style={{
          left: `${objective.position.x}%`,
          top: `${objective.position.y}%`,
          width: `${objective.radius * 2}%`,
          aspectRatio: "1 / 1",
        }}
      />

      <div
        className="
          pointer-events-none
          absolute
          z-20
          -translate-x-1/2
          -translate-y-1/2
          rounded-full
          border
          border-amber-300/50
          bg-black/80
          px-2
          py-1
          text-[8px]
          font-black
          uppercase
          tracking-wider
          text-amber-100
        "
        style={{
          left: `${objective.position.x}%`,
          top: `${objective.position.y}%`,
        }}
      >
        {objective.name}
      </div>
    </>
  );
}
