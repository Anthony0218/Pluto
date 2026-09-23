import type {
  BattlefieldObject,
  Unit,
} from "../../games/MedievalKingdoms/types";

function objectStateText(
  object: BattlefieldObject,
): string | null {
  if (
    object.usesRemaining !== undefined
  ) {
    return object.usesRemaining > 0
      ? `Uses remaining: ${object.usesRemaining}`
      : "Depleted";
  }

  if (
    object.type === "bridgeControl"
  ) {
    return object.active
      ? "Gate state: raised"
      : "Gate state: lowered";
  }

  return null;
}

export default function BattlefieldObjectPanel({
  object,
  selectedUnit,
  inRange,
  onInteract,
  onClose,
}: {
  object: BattlefieldObject;
  selectedUnit: Unit | null;
  inRange: boolean;
  onInteract: () => void;
  onClose: () => void;
}) {
  const stateText =
    objectStateText(
      object,
    );

  return (
    <div className="absolute bottom-4 left-4 z-[120] w-[min(380px,calc(100%-2rem))] rounded-2xl border-2 border-[#9a7441] bg-[#3b2a1b]/96 p-4 text-[#f5e2ba] shadow-2xl backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#d6ad5c]">
            {object.interactive
              ? "Battlefield object"
              : "Battlefield zone"}
          </div>

          <div className="mt-1 text-lg font-black text-[#ffe4a3]">
            {
              object.name
            }
          </div>
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
          className="rounded-md border border-[#725533] bg-[#2b1e14] px-2 py-1 text-xs"
        >
          ×
        </button>
      </div>

      <p className="mt-3 text-xs leading-5 text-[#c8ae82]">
        {
          object.description
        }
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[9px]">
        <div className="rounded-lg border border-[#6d5131] bg-[#2d2015]/80 px-2 py-2">
          <div className="text-[#9f8867]">x / y</div>
          <div className="font-black">{object.position.x} / {object.position.y}</div>
        </div>

        <div className="rounded-lg border border-[#6d5131] bg-[#2d2015]/80 px-2 py-2">
          <div className="text-[#9f8867]">visual</div>
          <div className="font-black">{object.visualSize}%</div>
        </div>

        <div className="rounded-lg border border-[#6d5131] bg-[#2d2015]/80 px-2 py-2">
          <div className="text-[#9f8867]">effect radius</div>
          <div className="font-black">{object.radius}</div>
        </div>
      </div>

      {stateText && (
        <div className="mt-3 rounded-lg border border-[#82623b] bg-[#2d2015]/80 px-3 py-2 text-[10px] font-bold text-[#efd29a]">
          {
            stateText
          }
        </div>
      )}

      {object.interactive ? (
        <>
          <div className="mt-3 rounded-lg border border-[#6d5131] bg-[#2d2015]/80 px-3 py-2 text-[10px]">
            {!selectedUnit
              ? "Select one of your units first."
              : inRange
                ? `${selectedUnit.name} is close enough to interact.`
                : `${selectedUnit.name} is too far away.`}
          </div>

          <button
            type="button"
            disabled={
              !selectedUnit ||
              !inRange ||
              (object.usesRemaining !== undefined &&
                object.usesRemaining <= 0)
            }
            onClick={
              onInteract
            }
            className="mt-3 w-full rounded-xl border-2 border-[#b88a43] bg-[#c59b4b] px-4 py-2 text-sm font-black text-[#3a2818] hover:bg-[#e1bd69] disabled:cursor-not-allowed disabled:opacity-35"
          >
            Interact
          </button>
        </>
      ) : (
        <div className="mt-3 rounded-lg border border-[#765533] bg-[#2c2017]/75 px-3 py-2 text-[10px] text-[#d8c29b]">
          Passive terrain / hazard — its effect is applied automatically.
        </div>
      )}
    </div>
  );
}
