import type { FactionId, Unit } from "../../games/MedievalKingdoms/types";
import ActionIcon, { type ActionIconId } from "./ActionIcon";

type Props = {
  units: Unit[];
  faction: FactionId;
  selectedUnitId: string | null;
  onSelect: (unit: Unit) => void;
};

export default function ArmyStatusBar({
  units,
  faction,
  selectedUnitId,
  onSelect,
}: Props) {
  const army = units.filter((unit) => unit.faction === faction);
  return (
    <div className="mt-4 rounded-2xl border-2 border-[#80603a]/70 bg-[#3a291b]/95 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-[#c5a56e]">
          {faction} warband
        </div>
        <div className="text-[10px] text-[#9f8560]">choose a unit</div>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {army.map((unit) => {
          const selected = unit.id === selectedUnitId;
          return (
            <button
              key={unit.id}
              type="button"
              onClick={() => onSelect(unit)}
              className={`min-w-[195px] rounded-xl border p-2 text-left transition ${selected ? "border-[#e2b95b] bg-[#765320]/55" : "border-[#735332] bg-[#4a3521]/65 hover:bg-[#5c4228]"}`}
            >
              <div className="flex items-center gap-2">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-[#9b7444] bg-[#24180f]">
                  {unit.ringImage ? (
                    <img
                      src={unit.ringImage}
                      alt={unit.name}
                      className="h-full w-full object-contain"
                    />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-black text-[#f5dfb2]">
                    {unit.name}
                  </div>
                  <div className="mt-0.5 text-[10px] text-[#ac936d]">
                    {unit.health}/{unit.maxHealth} HP
                  </div>
                  <div className="mt-1 flex gap-1">
                    {unit.defenseMode && (
                      <SmallStatus icon={unit.defenseMode} />
                    )}
                    {unit.damageBoostTurns > 0 && (
                      <SmallStatus icon="damageBoost" />
                    )}
                    {unit.burnTurns > 0 && <SmallStatus icon="burn" />}
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-[9px]">
                <Status label="Move" ready={!unit.hasMoved} />
                <Status label="Attack" ready={!unit.hasActed} />
                <Status label="Defend" ready={!unit.hasActed} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
function SmallStatus({ icon }: { icon: ActionIconId }) {
  return (
    <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#9b7545] bg-[#2e2015] text-[#e8cb8c]">
      <ActionIcon id={icon} className="h-3 w-3" />
    </div>
  );
}
function Status({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div
      className={`rounded-md border px-1.5 py-1 text-center font-black ${ready ? "border-[#769157] bg-[#425431]/65 text-[#d4e8b1]" : "border-[#5e4932] bg-[#302319] text-[#826d52]"}`}
    >
      {label}
      <div className="text-[8px]">{ready ? "READY" : "USED"}</div>
    </div>
  );
}
