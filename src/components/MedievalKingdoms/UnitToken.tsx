import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useState } from "react";
import type { DefenseActionId, Unit } from "../../games/MedievalKingdoms/types";
import UnitStatusOverlay from "./UnitStatusOverlay";

type Props = {
  unit: Unit;
  selected: boolean;
  hitFlash: boolean;
  aimTarget: boolean;
  draggableMove: boolean;
  previewDefense?: DefenseActionId | null;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
  onRightClick: () => void;
  onDragStart?: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: () => void;
};

const factionRing: Record<Unit["faction"], string> = {
  falconstone: "ring-sky-300",
  blackthorn: "ring-red-400",
  emberclaw: "ring-orange-400",
  mistveil: "ring-emerald-400",
};

export default function UnitToken({
  unit,
  selected,
  hitFlash,
  aimTarget,
  draggableMove,
  previewDefense = null,
  onHover,
  onLeave,
  onClick,
  onRightClick,
  onDragStart,
  onDragEnd,
}: Props) {
  useGameLanguage();
  const [imageFailed, setImageFailed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const size = unit.tokenSize ?? 52;
  const initials = unit.name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      type="button"
      draggable={draggableMove}
      onDragStart={(event) => {
        setIsDragging(true);
        onDragStart?.(event);
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragEnd?.();
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onRightClick();
      }}
      className={`relative rounded-full ring-2 ${isDragging ? "opacity-0" : ""} ring-offset-1 ring-offset-black/30 transition duration-150 ${factionRing[unit.faction]} ${draggableMove ? "cursor-grab active:cursor-grabbing" : ""} ${selected ? "scale-110 drop-shadow-[0_0_10px_rgba(253,224,71,1)]" : "hover:scale-105"} ${aimTarget ? "scale-110 ring-4 ring-white drop-shadow-[0_0_14px_rgba(255,255,255,1)]" : ""} ${hitFlash ? "scale-125 animate-pulse ring-4 ring-red-500 brightness-150 drop-shadow-[0_0_22px_rgba(239,68,68,1)]" : ""} ${unit.hasMoved && unit.hasActed ? "opacity-55 grayscale-[25%]" : ""}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <UnitStatusOverlay unit={unit} previewDefense={previewDefense} />
      {gameUi(unit.ringImage && !imageFailed ? (
        <img
          src={unit.ringImage}
          alt={gameUi(unit.name)}
          draggable={false}
          onError={() => setImageFailed(true)}
          className="h-full w-full pointer-events-none select-none object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-[#4a3521] text-[10px] font-black text-[#f7e8c6]">
          {gameUi(initials)}
        </div>
      ))}
      <div className="pointer-events-none absolute left-1/2 top-full z-40 mt-0.5 -translate-x-1/2 whitespace-nowrap rounded border border-[#7c5b35]/80 bg-[#3a291b]/95 px-1.5 py-0.5 text-[8px] font-black text-[#f6e4bd]">
        {gameUi(unit.health)}{gameUi(" HP ")}</div>
    </button>
  );
}
