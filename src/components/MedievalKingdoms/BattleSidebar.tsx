import { useState } from "react";
import {
  ATTACK_ACTIONS,
  DEFENSE_ACTIONS,
  SKILL_ACTIONS,
} from "../../games/MedievalKingdoms/actionCatalog";
import { CLANS } from "../../games/MedievalKingdoms/clanData";
import { terrainLabel } from "../../games/MedievalKingdoms/terrain";
import type {
  AimStage,
  AttackActionId,
  BattleDefinition,
  BattleState,
  DefenseActionId,
  PreviewAction,
  SkillActionId,
  TerrainType,
  Unit,
} from "../../games/MedievalKingdoms/types";
import ActionIcon, { type ActionIconId } from "./ActionIcon";
import ActionTimingMeter from "./ActionTimingMeter";
import ArcherElevationMeter from "./ArcherElevationMeter";

type Props = {
  battle: BattleDefinition;
  game: BattleState;
  hoveredUnit: Unit | null;
  pinnedUnit: Unit | null;
  selectedUnit: Unit | null;
  pinnedTerrain: TerrainType | null;
  moveMode: boolean;
  aimMode: boolean;
  aimStage: AimStage;
  aimAngle: number;
  elevation: number;
  timingValue: number;
  meleeScore: number | null;
  hasMeleeTargets: boolean;
  currentAttackAction: AttackActionId | null;
  currentSkillAction: SkillActionId | null;
  onPinHovered: () => void;
  onSelectPinned: () => void;
  onStartMove: () => void;
  onFinishPinned: () => void;
  onChooseAttack: (action: AttackActionId) => void;
  onChooseDefense: (action: DefenseActionId, guardTargetId?: string) => void;
  onChooseSkill: (action: SkillActionId) => void;
  onPreviewAction: (action: PreviewAction) => void;
  onLockDirection: () => void;
  onCancelAction: () => void;
  onFire: () => void;
  onMeleeStrike: () => void;
  onEndTurn: () => void;
};

export default function BattleSidebar(props: Props) {
  const { battle, game, hoveredUnit, pinnedUnit, pinnedTerrain } = props;

  return (
    <aside className="space-y-4">
      {pinnedUnit ? (
        <UnitPanel {...props} unit={pinnedUnit} terrain={pinnedTerrain} />
      ) : hoveredUnit ? (
        <HoverPanel unit={hoveredUnit} onPin={props.onPinHovered} />
      ) : (
        <BattleIntel battle={battle} game={game} />
      )}

      <TurnPanel game={game} onEndTurn={props.onEndTurn} />

      <ClanPanel />
    </aside>
  );
}

function UnitPanel({
  unit,
  selectedUnit,
  game,
  terrain,
  moveMode,
  aimMode,
  aimStage,
  aimAngle,
  elevation,
  timingValue,
  meleeScore,
  hasMeleeTargets,
  currentAttackAction,
  currentSkillAction,
  onSelectPinned,
  onStartMove,
  onFinishPinned,
  onChooseAttack,
  onChooseDefense,
  onChooseSkill,
  onPreviewAction,
  onLockDirection,
  onCancelAction,
  onFire,
  onMeleeStrike,
}: Props & { unit: Unit; terrain: TerrainType | null }) {
  const [menu, setMenu] = useState<
    "main" | "attack" | "defend" | "skills" | "guard"
  >("main");
  const friendly = unit.faction === game.activeFaction;
  const selected = selectedUnit?.id === unit.id;
  const allies = game.units.filter(
    (ally) => ally.faction === unit.faction && ally.id !== unit.id,
  );

  return (
    <MedievalCard>
      <div className="flex gap-4">
        <div className="h-28 w-28 shrink-0 overflow-hidden rounded-full border-2 border-[#b98a45] bg-[#25190f]">
          {unit.ringImage ? (
            <img
              src={unit.ringImage}
              alt={unit.name}
              className="h-full w-full object-contain"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#bfa67c]">
            unit scroll
          </div>
          <div className="mt-1 text-lg font-black text-[#ffe8ad]">
            {unit.name}
          </div>
          <div className="text-xs text-[#c7ae82]">
            {unit.faction} · {unit.tier}
          </div>
          <div className="mt-2 text-xs font-black">
            {unit.health}/{unit.maxHealth} HP
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {unit.defenseMode && (
              <StatusBadge icon={unit.defenseMode} label={unit.defenseMode} />
            )}
            {unit.damageBoostTurns > 0 && (
              <StatusBadge icon="damageBoost" label="blessed" />
            )}
            {unit.burnTurns > 0 && <StatusBadge icon="burn" label="burning" />}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <Stat label="Impact" value={unit.impact} />
        <Stat label="Agility" value={unit.agility} />
        <Stat label="Tough" value={unit.toughness} />
        <Stat label="Damage" value={unit.damage} />
        <Stat label="Move" value={unit.moveRange} />
        <Stat label="Range" value={unit.attackRange} />
        <Stat label="Moved" value={unit.hasMoved ? "yes" : "no"} />
        <Stat label="Acted" value={unit.hasActed ? "yes" : "no"} />
      </div>

      {terrain && (
        <div className="mt-3 rounded-lg border border-[#765633]/60 bg-[#2e2015]/70 px-3 py-2 text-xs">
          <span className="text-[#ae966f]">Terrain: </span>
          <span className="font-bold text-[#f5dfb4]">
            {terrainLabel(terrain)}
          </span>
        </div>
      )}

      {moveMode && selected && (
        <ModePanel>
          <div className="flex items-center gap-2 font-black text-[#ffe5a6]">
            <ActionIcon id="move" className="h-5 w-5" />
            Movement mode
          </div>
          <p className="mt-2 text-xs leading-5 text-[#cfb78e]">
            Drag this figure to its destination. Clicking the map is kept as a
            fallback.
          </p>
          <CancelButton onClick={onCancelAction} label="Cancel Move" />
        </ModePanel>
      )}

      {aimMode && selected && (
        <ModePanel>
          <div className="text-xs font-black text-[#ffe7b0]">
            {ATTACK_ACTIONS.find((a) => a.id === currentAttackAction)?.name ??
              SKILL_ACTIONS.find((a) => a.id === currentSkillAction)?.name ??
              "Action"}
          </div>
          {aimStage === "direction" && (
            <div className="mt-1 text-[11px] text-[#bda77f]">
              Direction {Math.round(aimAngle)}°
            </div>
          )}
          {aimStage === "elevation" && (
            <div className="mt-3">
              <ArcherElevationMeter elevation={elevation} />
            </div>
          )}
          {aimStage === "power" && (
            <div className="mt-3">
              <ActionTimingMeter
                title="Power timing"
                value={timingValue}
                lowLabel="safe"
                highLabel="max"
              />
            </div>
          )}
          {aimStage === "distance" && (
            <div className="mt-3">
              <ActionTimingMeter
                title="Distance timing"
                value={timingValue}
                lowLabel="near"
                highLabel="far"
              />
            </div>
          )}
          {aimStage === "meleeTarget" && (
            <div className="mt-3">
              <p className="text-xs leading-5 text-[#d0b88d]">
                {hasMeleeTargets
                  ? "Click a highlighted nearby enemy to start the collapsing-ring timing challenge."
                  : "No enemy is currently within melee range."}
              </p>
              <button
                type="button"
                onClick={() => {
                  onCancelAction();
                  setMenu("attack");
                }}
                className="mt-3 w-full rounded-lg border border-[#9b7444] bg-[#4a3521] px-3 py-2 text-xs font-black text-[#f6dfb1] hover:bg-[#604526]"
              >
                ← Choose another attack
              </button>
            </div>
          )}
          {aimStage === "meleeTiming" && (
            <>
              <p className="mt-3 text-xs leading-5 text-[#d0b88d]">
                Strike when the moving ring reaches the golden center.
              </p>
              {meleeScore !== null && (
                <div className="mt-2 text-sm font-black text-[#ffe39a]">
                  Timing {Math.round(meleeScore * 100)}%
                </div>
              )}
              <button
                type="button"
                onClick={onMeleeStrike}
                className="mt-3 w-full rounded-lg border-2 border-[#cf9f45] bg-[#7f351e] px-3 py-2 text-xs font-black text-[#fff0bf] hover:bg-[#9c4628]"
              >
                Strike Now
              </button>
              <button
                type="button"
                onClick={() => {
                  onCancelAction();
                  setMenu("attack");
                }}
                className="mt-2 w-full rounded-lg border border-[#765633] bg-[#2e2015] px-3 py-2 text-xs font-black text-[#d7bd91] hover:bg-[#4a3521]"
              >
                ← Choose another attack
              </button>
            </>
          )}
          {currentSkillAction && (
            <p className="mt-3 text-xs leading-5 text-[#d0b88d]">
              {skillInstruction(currentSkillAction)}
            </p>
          )}
          {!currentSkillAction &&
            aimStage !== "meleeTarget" &&
            aimStage !== "meleeTiming" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {aimStage === "direction" &&
                (currentAttackAction === "power" ||
                  currentAttackAction === "area" ||
                  currentAttackAction === "archer") ? (
                  <button
                    type="button"
                    onClick={onLockDirection}
                    className="rounded-lg border border-[#b88b46] bg-[#d8c18c] px-3 py-2 text-xs font-black text-[#392819] hover:bg-[#f0dca9]"
                  >
                    Lock Direction
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onFire}
                    className="rounded-lg border border-[#9a4c2f] bg-[#7f351e] px-3 py-2 text-xs font-black text-[#fff0bf] hover:bg-[#9c4628]"
                  >
                    Fire / Execute
                  </button>
                )}
                <CancelButton onClick={onCancelAction} />
              </div>
            )}
          {currentSkillAction && (
            <CancelButton onClick={onCancelAction} label="Cancel Skill" />
          )}
        </ModePanel>
      )}

      {friendly && !aimMode && !moveMode && (
        <>
          {menu === "main" && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MainButton
                icon="move"
                label="Move"
                disabled={unit.hasMoved}
                onClick={onStartMove}
              />
              <MainButton
                icon="quick"
                label="Attack"
                disabled={unit.hasActed}
                onClick={() => setMenu("attack")}
              />
              <MainButton
                icon="shield"
                label="Defend"
                disabled={unit.hasActed}
                onClick={() => setMenu("defend")}
              />
              <MainButton
                icon="heal"
                label="Skills"
                disabled={unit.hasActed}
                onClick={() => setMenu("skills")}
              />
              <MainButton
                icon="finish"
                label="Finish"
                onClick={onFinishPinned}
              />
              <button
                type="button"
                onClick={onSelectPinned}
                className={`flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-black ${selected ? "border-[#e5bd64] bg-[#77531f] text-[#fff0bd]" : "border-[#765633] bg-[#2f2116] hover:bg-[#4a3521]"}`}
              >
                {selected ? "Selected" : "Select"}
              </button>
            </div>
          )}
          {menu === "attack" && (
            <ActionMenu
              title="Attack Arts"
              actions={ATTACK_ACTIONS}
              kind="attack"
              onBack={() => setMenu("main")}
              onPreview={onPreviewAction}
              onChoose={(id) => {
                onChooseAttack(id as AttackActionId);
                setMenu("main");
              }}
            />
          )}
          {menu === "defend" && (
            <ActionMenu
              title="Defensive Stances"
              actions={DEFENSE_ACTIONS}
              kind="defense"
              onBack={() => setMenu("main")}
              onPreview={onPreviewAction}
              onChoose={(id) => {
                if (id === "guard") {
                  setMenu("guard");
                  return;
                }
                onChooseDefense(id as DefenseActionId);
                setMenu("main");
              }}
            />
          )}
          {menu === "skills" && (
            <ActionMenu
              title="Arts & Spells"
              actions={SKILL_ACTIONS}
              kind="skill"
              onBack={() => setMenu("main")}
              onPreview={onPreviewAction}
              onChoose={(id) => {
                onChooseSkill(id as SkillActionId);
                setMenu("main");
              }}
            />
          )}
          {menu === "guard" && (
            <div className="mt-4">
              <MenuHeading
                title="Guard Ally"
                onBack={() => setMenu("defend")}
              />
              <div className="space-y-2">
                {allies.map((ally) => (
                  <button
                    key={ally.id}
                    type="button"
                    onClick={() => {
                      onChooseDefense("guard", ally.id);
                      setMenu("main");
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-[#806039] bg-[#4a3521]/65 p-2 text-left hover:bg-[#604526]"
                  >
                    <div className="h-10 w-10 overflow-hidden rounded-full border border-[#9b7545] bg-[#25190f]">
                      {ally.ringImage ? (
                        <img
                          src={ally.ringImage}
                          alt={ally.name}
                          className="h-full w-full object-contain"
                        />
                      ) : null}
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#f8e5bc]">
                        {ally.name}
                      </div>
                      <div className="text-[10px] text-[#b9a078]">
                        {ally.health}/{ally.maxHealth} HP
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </MedievalCard>
  );
}

function ActionMenu({
  title,
  actions,
  kind,
  onBack,
  onPreview,
  onChoose,
}: {
  title: string;
  actions: Array<{ id: string; name: string; description: string }>;
  kind: "attack" | "defense" | "skill";
  onBack: () => void;
  onPreview: (action: PreviewAction) => void;
  onChoose: (id: string) => void;
}) {
  return (
    <div className="mt-4">
      <MenuHeading title={title} onBack={onBack} />
      <div className="space-y-2">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onMouseEnter={() => onPreview({ kind, id: action.id as never })}
            onMouseLeave={() => onPreview(null)}
            onFocus={() => onPreview({ kind, id: action.id as never })}
            onBlur={() => onPreview(null)}
            onClick={() => {
              onPreview(null);
              onChoose(action.id);
            }}
            className="group flex w-full gap-3 rounded-xl border border-[#7e5d38] bg-[#49331f]/75 p-3 text-left transition hover:border-[#d2a957] hover:bg-[#5c4227] focus:outline-none focus:ring-2 focus:ring-[#d9b65f]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#a47b42] bg-[#2c1e13] text-[#f0d592] group-hover:text-[#ffe8ad]">
              <ActionIcon id={action.id as ActionIconId} className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-black text-[#f6dfb1]">
                {action.name}
              </div>
              <div className="mt-1 text-[10px] leading-4 text-[#bda47b]">
                {action.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MainButton({
  icon,
  label,
  disabled = false,
  onClick,
}: {
  icon: ActionIconId;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-xl border border-[#84613a] bg-[#4a3521]/80 px-3 py-2 text-xs font-black text-[#f6dfb1] hover:border-[#d1a553] hover:bg-[#604526] disabled:cursor-not-allowed disabled:opacity-35"
    >
      <ActionIcon id={icon} className="h-5 w-5" />
      {label}
    </button>
  );
}
function StatusBadge({ icon, label }: { icon: ActionIconId; label: string }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-[#8f6d40] bg-[#2e2015] px-2 py-1 text-[9px] font-black uppercase text-[#e9cf98]">
      <ActionIcon id={icon} className="h-3.5 w-3.5" />
      {label}
    </div>
  );
}
function skillInstruction(action: SkillActionId) {
  switch (action) {
    case "heal":
      return "Click a friendly unit to heal it.";
    case "damageBoost":
      return "Click a friendly unit to bless its damage.";
    case "burn":
      return "Click an enemy unit to launch the fire spell.";
    case "trap":
      return "Click the battlefield to place the rune trap.";
    case "teleport":
      return "Click a valid battlefield point to teleport the caster.";
  }
}
function MedievalCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-[#8d693b]/70 bg-[#3b2a1b]/95 p-4 text-[#f5e4c1] shadow-[inset_0_0_25px_rgba(0,0,0,0.18)]">
      {children}
    </div>
  );
}
function ModePanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-xl border border-[#9d7440]/70 bg-[#2e2015]/80 p-3">
      {children}
    </div>
  );
}
function CancelButton({
  onClick,
  label = "Cancel",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 rounded-lg border border-[#765633] bg-[#2e2015] px-3 py-2 text-xs font-black hover:bg-[#4a3521]"
    >
      {label}
    </button>
  );
}
function MenuHeading({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#e0bd71]">
        {title}
      </div>
      <button
        type="button"
        onClick={onBack}
        className="text-[10px] font-bold text-[#a88f68] hover:text-[#ffe4a6]"
      >
        ← Back
      </button>
    </div>
  );
}
function HoverPanel({ unit, onPin }: { unit: Unit; onPin: () => void }) {
  return (
    <MedievalCard>
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#b99d73]">
        Hover preview
      </div>
      <div className="mt-2 font-black text-[#ffe7ad]">{unit.name}</div>
      <div className="text-xs text-[#bca37a]">
        {unit.faction} · {unit.health}/{unit.maxHealth} HP
      </div>
      <button
        type="button"
        onClick={onPin}
        className="mt-3 w-full rounded-lg border border-[#83623b] bg-[#4a3521] px-3 py-2 text-xs font-black hover:bg-[#604526]"
      >
        Pin details
      </button>
    </MedievalCard>
  );
}
function BattleIntel({
  battle,
  game,
}: {
  battle: BattleDefinition;
  game: BattleState;
}) {
  return (
    <MedievalCard>
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#e1b95e]">
        Battlefield Chronicle
      </div>
      <div className="mt-1 text-lg font-black text-[#ffe7ad]">
        {battle.name}
      </div>
      <p className="mt-3 text-xs leading-5 text-[#c5ac83]">{battle.lore}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat label="Round" value={`${game.round}/${game.maxRounds}`} />
        <Stat label="Objective" value={game.objective.name} />
        {CLANS.map((clan) => (
          <Stat
            key={clan.id}
            label={clan.name}
            value={game.units.filter((unit) => unit.faction === clan.id).length}
          />
        ))}
      </div>
    </MedievalCard>
  );
}
function TurnPanel({
  game,
  onEndTurn,
}: {
  game: BattleState;
  onEndTurn: () => void;
}) {
  const active = game.units.filter(
    (unit) => unit.faction === game.activeFaction,
  );
  const available = active.filter(
    (unit) => !(unit.hasMoved && unit.hasActed),
  ).length;
  return (
    <MedievalCard>
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#b99d73]">
        Active clan
      </div>
      <div className="mt-1 text-lg font-black capitalize text-[#ffe7ad]">
        {game.activeFaction}
      </div>
      <div className="mt-2 text-xs text-[#c1a77c]">
        {available}/{active.length} units available
      </div>
      <button
        type="button"
        disabled={Boolean(game.winner)}
        onClick={onEndTurn}
        className="mt-3 w-full rounded-xl border-2 border-[#b98a45] bg-[#c69a45] px-4 py-3 text-sm font-black text-[#3a2818] hover:bg-[#e1bd69] disabled:opacity-40"
      >
        End Turn
      </button>
    </MedievalCard>
  );
}
function ClanPanel() {
  return (
    <MedievalCard>
      <div className="text-xs font-black uppercase tracking-[0.2em] text-[#b99d73]">
        Clans
      </div>
      <div className="mt-3 space-y-3">
        {CLANS.map((clan) => (
          <div key={clan.id}>
            <div className="text-xs font-black text-[#f0d59b]">{clan.name}</div>
            <div className="text-[10px] text-[#aa916b]">{clan.motto}</div>
          </div>
        ))}
      </div>
    </MedievalCard>
  );
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[#6f5030]/60 bg-[#2d2015]/80 px-2 py-2">
      <div className="text-[9px] uppercase tracking-wide text-[#a98e68]">
        {label}
      </div>
      <div className="mt-0.5 text-xs font-black text-[#f0dab0]">{value}</div>
    </div>
  );
}
