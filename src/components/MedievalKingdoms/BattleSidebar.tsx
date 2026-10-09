import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
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
  useGameLanguage();
  const { battle, game, hoveredUnit, pinnedUnit, pinnedTerrain } = props;

  return (
    <aside className="space-y-4">
      {gameUi(pinnedUnit ? (
        <UnitPanel {...props} unit={pinnedUnit} terrain={pinnedTerrain} />
      ) : hoveredUnit ? (
        <HoverPanel unit={hoveredUnit} onPin={props.onPinHovered} />
      ) : (
        <BattleIntel battle={battle} game={game} />
      ))}

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
  useGameLanguage();
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
          {gameUi(unit.ringImage ? (
            <img
              src={unit.ringImage}
              alt={gameUi(unit.name)}
              className="h-full w-full object-contain"
            />
          ) : null)}
        </div>
        <div className="min-w-0">
          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#bfa67c]">{gameUi(" unit scroll ")}</div>
          <div className="mt-1 text-lg font-black text-[#ffe8ad]">
            {gameUi(unit.name)}
          </div>
          <div className="text-xs text-[#c7ae82]">
            {gameUi(unit.faction)} · {gameUi(unit.tier)}
          </div>
          <div className="mt-2 text-xs font-black">
            {gameUi(unit.health)}/{gameUi(unit.maxHealth)}{gameUi(" HP ")}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {gameUi(unit.defenseMode && (
              <StatusBadge icon={unit.defenseMode} label={gameUi(unit.defenseMode)} />
            ))}
            {gameUi(unit.damageBoostTurns > 0 && (
              <StatusBadge icon="damageBoost" label={gameUi("blessed")} />
            ))}
            {unit.burnTurns > 0 && <StatusBadge icon="burn" label={gameUi("burning")} />}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        <Stat label={gameUi("Impact")} value={unit.impact} />
        <Stat label={gameUi("Agility")} value={unit.agility} />
        <Stat label={gameUi("Tough")} value={unit.toughness} />
        <Stat label={gameUi("Damage")} value={unit.damage} />
        <Stat label={gameUi("Move")} value={unit.moveRange} />
        <Stat label={gameUi("Range")} value={unit.attackRange} />
        <Stat label={gameUi("Moved")} value={unit.hasMoved ? "yes" : "no"} />
        <Stat label={gameUi("Acted")} value={unit.hasActed ? "yes" : "no"} />
      </div>

      {gameUi(terrain && (
        <div className="mt-3 rounded-lg border border-[#765633]/60 bg-[#2e2015]/70 px-3 py-2 text-xs">
          <span className="text-[#ae966f]">{gameUi("Terrain: ")}</span>
          <span className="font-bold text-[#f5dfb4]">
            {gameUi(terrainLabel(terrain))}
          </span>
        </div>
      ))}

      {gameUi(moveMode && selected && (
        <ModePanel>
          <div className="flex items-center gap-2 font-black text-[#ffe5a6]">
            <ActionIcon id="move" className="h-5 w-5" />{gameUi(" Movement mode ")}</div>
          <p className="mt-2 text-xs leading-5 text-[#cfb78e]">{gameUi(" Drag this figure to its destination. Clicking the map is kept as a fallback. ")}</p>
          <CancelButton onClick={onCancelAction} label={gameUi("Cancel Move")} />
        </ModePanel>
      ))}

      {gameUi(aimMode && selected && (
        <ModePanel>
          <div className="text-xs font-black text-[#ffe7b0]">
            {gameUi(ATTACK_ACTIONS.find((a) => a.id === currentAttackAction)?.name ??
              SKILL_ACTIONS.find((a) => a.id === currentSkillAction)?.name ??
              "Action")}
          </div>
          {gameUi(aimStage === "direction" && (
            <div className="mt-1 text-[11px] text-[#bda77f]">{gameUi(" Direction ")}{gameUi(Math.round(aimAngle))}°
            </div>
          ))}
          {gameUi(aimStage === "elevation" && (
            <div className="mt-3">
              <ArcherElevationMeter elevation={elevation} />
            </div>
          ))}
          {gameUi(aimStage === "power" && (
            <div className="mt-3">
              <ActionTimingMeter
                title={gameUi("Power timing")}
                value={timingValue}
                lowLabel="safe"
                highLabel="max"
              />
            </div>
          ))}
          {gameUi(aimStage === "distance" && (
            <div className="mt-3">
              <ActionTimingMeter
                title={gameUi("Distance timing")}
                value={timingValue}
                lowLabel="near"
                highLabel="far"
              />
            </div>
          ))}
          {gameUi(aimStage === "meleeTarget" && (
            <div className="mt-3">
              <p className="text-xs leading-5 text-[#d0b88d]">
                {gameUi(hasMeleeTargets
                  ? "Click a highlighted nearby enemy to start the collapsing-ring timing challenge."
                  : "No enemy is currently within melee range.")}
              </p>
              <button
                type="button"
                onClick={() => {
                  onCancelAction();
                  setMenu("attack");
                }}
                className="mt-3 w-full rounded-lg border border-[#9b7444] bg-[#4a3521] px-3 py-2 text-xs font-black text-[#f6dfb1] hover:bg-[#604526]"
              >{gameUi(" ← Choose another attack ")}</button>
            </div>
          ))}
          {gameUi(aimStage === "meleeTiming" && (
            <>
              <p className="mt-3 text-xs leading-5 text-[#d0b88d]">{gameUi(" Strike when the moving ring reaches the golden center. ")}</p>
              {gameUi(meleeScore !== null && (
                <div className="mt-2 text-sm font-black text-[#ffe39a]">{gameUi(" Timing ")}{gameUi(Math.round(meleeScore * 100))}%
                </div>
              ))}
              <button
                type="button"
                onClick={onMeleeStrike}
                className="mt-3 w-full rounded-lg border-2 border-[#cf9f45] bg-[#7f351e] px-3 py-2 text-xs font-black text-[#fff0bf] hover:bg-[#9c4628]"
              >{gameUi(" Strike Now ")}</button>
              <button
                type="button"
                onClick={() => {
                  onCancelAction();
                  setMenu("attack");
                }}
                className="mt-2 w-full rounded-lg border border-[#765633] bg-[#2e2015] px-3 py-2 text-xs font-black text-[#d7bd91] hover:bg-[#4a3521]"
              >{gameUi(" ← Choose another attack ")}</button>
            </>
          ))}
          {gameUi(currentSkillAction && (
            <p className="mt-3 text-xs leading-5 text-[#d0b88d]">
              {gameUi(skillInstruction(currentSkillAction))}
            </p>
          ))}
          {gameUi(!currentSkillAction &&
            aimStage !== "meleeTarget" &&
            aimStage !== "meleeTiming" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {gameUi(aimStage === "direction" &&
                (currentAttackAction === "power" ||
                  currentAttackAction === "area" ||
                  currentAttackAction === "archer") ? (
                  <button
                    type="button"
                    onClick={onLockDirection}
                    className="rounded-lg border border-[#b88b46] bg-[#d8c18c] px-3 py-2 text-xs font-black text-[#392819] hover:bg-[#f0dca9]"
                  >{gameUi(" Lock Direction ")}</button>
                ) : (
                  <button
                    type="button"
                    onClick={onFire}
                    className="rounded-lg border border-[#9a4c2f] bg-[#7f351e] px-3 py-2 text-xs font-black text-[#fff0bf] hover:bg-[#9c4628]"
                  >{gameUi(" Fire / Execute ")}</button>
                ))}
                <CancelButton onClick={onCancelAction} />
              </div>
            ))}
          {gameUi(currentSkillAction && (
            <CancelButton onClick={onCancelAction} label={gameUi("Cancel Skill")} />
          ))}
        </ModePanel>
      ))}

      {gameUi(friendly && !aimMode && !moveMode && (
        <>
          {gameUi(menu === "main" && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <MainButton
                icon="move"
                label={gameUi("Move")}
                disabled={unit.hasMoved}
                onClick={onStartMove}
              />
              <MainButton
                icon="quick"
                label={gameUi("Attack")}
                disabled={unit.hasActed}
                onClick={() => setMenu("attack")}
              />
              <MainButton
                icon="shield"
                label={gameUi("Defend")}
                disabled={unit.hasActed}
                onClick={() => setMenu("defend")}
              />
              <MainButton
                icon="heal"
                label={gameUi("Skills")}
                disabled={unit.hasActed}
                onClick={() => setMenu("skills")}
              />
              <MainButton
                icon="finish"
                label={gameUi("Finish")}
                onClick={onFinishPinned}
              />
              <button
                type="button"
                onClick={onSelectPinned}
                className={`flex items-center justify-center rounded-xl border px-3 py-2 text-xs font-black ${selected ? "border-[#e5bd64] bg-[#77531f] text-[#fff0bd]" : "border-[#765633] bg-[#2f2116] hover:bg-[#4a3521]"}`}
              >
                {gameUi(selected ? "Selected" : "Select")}
              </button>
            </div>
          ))}
          {gameUi(menu === "attack" && (
            <ActionMenu
              title={gameUi("Attack Arts")}
              actions={ATTACK_ACTIONS}
              kind="attack"
              onBack={() => setMenu("main")}
              onPreview={onPreviewAction}
              onChoose={(id) => {
                onChooseAttack(id as AttackActionId);
                setMenu("main");
              }}
            />
          ))}
          {gameUi(menu === "defend" && (
            <ActionMenu
              title={gameUi("Defensive Stances")}
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
          ))}
          {gameUi(menu === "skills" && (
            <ActionMenu
              title={gameUi("Arts & Spells")}
              actions={SKILL_ACTIONS}
              kind="skill"
              onBack={() => setMenu("main")}
              onPreview={onPreviewAction}
              onChoose={(id) => {
                onChooseSkill(id as SkillActionId);
                setMenu("main");
              }}
            />
          ))}
          {gameUi(menu === "guard" && (
            <div className="mt-4">
              <MenuHeading
                title={gameUi("Guard Ally")}
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
                      {gameUi(ally.ringImage ? (
                        <img
                          src={ally.ringImage}
                          alt={gameUi(ally.name)}
                          className="h-full w-full object-contain"
                        />
                      ) : null)}
                    </div>
                    <div>
                      <div className="text-xs font-black text-[#f8e5bc]">
                        {gameUi(ally.name)}
                      </div>
                      <div className="text-[10px] text-[#b9a078]">
                        {gameUi(ally.health)}/{gameUi(ally.maxHealth)}{gameUi(" HP ")}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      ))}
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
  useGameLanguage();
  return (
    <div className="mt-4">
      <MenuHeading title={gameUi(title)} onBack={onBack} />
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
                {gameUi(action.name)}
              </div>
              <div className="mt-1 text-[10px] leading-4 text-[#bda47b]">
                {gameUi(action.description)}
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
  useGameLanguage();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-xl border border-[#84613a] bg-[#4a3521]/80 px-3 py-2 text-xs font-black text-[#f6dfb1] hover:border-[#d1a553] hover:bg-[#604526] disabled:cursor-not-allowed disabled:opacity-35"
    >
      <ActionIcon id={icon} className="h-5 w-5" />
      {gameUi(label)}
    </button>
  );
}
function StatusBadge({ icon, label }: { icon: ActionIconId; label: string }) {
  useGameLanguage();
  return (
    <div className="flex items-center gap-1 rounded-full border border-[#8f6d40] bg-[#2e2015] px-2 py-1 text-[9px] font-black uppercase text-[#e9cf98]">
      <ActionIcon id={icon} className="h-3.5 w-3.5" />
      {gameUi(label)}
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
  useGameLanguage();
  return (
    <div className="rounded-2xl border-2 border-[#8d693b]/70 bg-[#3b2a1b]/95 p-4 text-[#f5e4c1] shadow-[inset_0_0_25px_rgba(0,0,0,0.18)]">
      {gameUi(children)}
    </div>
  );
}
function ModePanel({ children }: { children: React.ReactNode }) {
  useGameLanguage();
  return (
    <div className="mt-3 rounded-xl border border-[#9d7440]/70 bg-[#2e2015]/80 p-3">
      {gameUi(children)}
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
  useGameLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 rounded-lg border border-[#765633] bg-[#2e2015] px-3 py-2 text-xs font-black hover:bg-[#4a3521]"
    >
      {gameUi(label)}
    </button>
  );
}
function MenuHeading({ title, onBack }: { title: string; onBack: () => void }) {
  useGameLanguage();
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#e0bd71]">
        {gameUi(title)}
      </div>
      <button
        type="button"
        onClick={onBack}
        className="text-[10px] font-bold text-[#a88f68] hover:text-[#ffe4a6]"
      >{gameUi(" ← Back ")}</button>
    </div>
  );
}
function HoverPanel({ unit, onPin }: { unit: Unit; onPin: () => void }) {
  useGameLanguage();
  return (
    <MedievalCard>
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#b99d73]">{gameUi(" Hover preview ")}</div>
      <div className="mt-2 font-black text-[#ffe7ad]">{gameUi(unit.name)}</div>
      <div className="text-xs text-[#bca37a]">
        {gameUi(unit.faction)} · {gameUi(unit.health)}/{gameUi(unit.maxHealth)}{gameUi(" HP ")}</div>
      <button
        type="button"
        onClick={onPin}
        className="mt-3 w-full rounded-lg border border-[#83623b] bg-[#4a3521] px-3 py-2 text-xs font-black hover:bg-[#604526]"
      >{gameUi(" Pin details ")}</button>
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
  useGameLanguage();
  return (
    <MedievalCard>
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#e1b95e]">{gameUi(" Battlefield Chronicle ")}</div>
      <div className="mt-1 text-lg font-black text-[#ffe7ad]">
        {gameUi(battle.name)}
      </div>
      <p className="mt-3 text-xs leading-5 text-[#c5ac83]">{gameUi(battle.lore)}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat label={gameUi("Round")} value={`${game.round}/${game.maxRounds}`} />
        <Stat label={gameUi("Objective")} value={game.objective.name} />
        {CLANS.map((clan) => (
          <Stat
            key={clan.id}
            label={gameUi(clan.name)}
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
  useGameLanguage();
  const active = game.units.filter(
    (unit) => unit.faction === game.activeFaction,
  );
  const available = active.filter(
    (unit) => !(unit.hasMoved && unit.hasActed),
  ).length;
  return (
    <MedievalCard>
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#b99d73]">{gameUi(" Active clan ")}</div>
      <div className="mt-1 text-lg font-black capitalize text-[#ffe7ad]">
        {gameUi(game.activeFaction)}
      </div>
      <div className="mt-2 text-xs text-[#c1a77c]">
        {gameUi(available)}/{gameUi(active.length)}{gameUi(" units available ")}</div>
      <button
        type="button"
        disabled={Boolean(game.winner)}
        onClick={onEndTurn}
        className="mt-3 w-full rounded-xl border-2 border-[#b98a45] bg-[#c69a45] px-4 py-3 text-sm font-black text-[#3a2818] hover:bg-[#e1bd69] disabled:opacity-40"
      >{gameUi(" End Turn ")}</button>
    </MedievalCard>
  );
}
function ClanPanel() {
  useGameLanguage();
  return (
    <MedievalCard>
      <div className="text-xs font-black uppercase tracking-[0.2em] text-[#b99d73]">{gameUi(" Clans ")}</div>
      <div className="mt-3 space-y-3">
        {CLANS.map((clan) => (
          <div key={clan.id}>
            <div className="text-xs font-black text-[#f0d59b]">{gameUi(clan.name)}</div>
            <div className="text-[10px] text-[#aa916b]">{gameUi(clan.motto)}</div>
          </div>
        ))}
      </div>
    </MedievalCard>
  );
}
function Stat({ label, value }: { label: string; value: string | number }) {
  useGameLanguage();
  return (
    <div className="rounded-lg border border-[#6f5030]/60 bg-[#2d2015]/80 px-2 py-2">
      <div className="text-[9px] uppercase tracking-wide text-[#a98e68]">
        {gameUi(label)}
      </div>
      <div className="mt-0.5 text-xs font-black text-[#f0dab0]">{gameUi(value)}</div>
    </div>
  );
}
