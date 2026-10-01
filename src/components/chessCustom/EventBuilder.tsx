import { ChevronDown, ChevronRight, Copy, Plus, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { squareName } from "@/games/chess/custom/engine/board";
import { createId } from "@/games/chess/custom/engine/presets";
import {
  EVENT_ACTIONS,
  EVENT_TRIGGERS,
  TILE_TYPES,
  type ConditionType,
  type Coord,
  type EventAction,
  type EventActionType,
  type EventCondition,
  type EventTriggerType,
  type GameEvent,
  type GameVariant,
  type PieceSelector,
  type SquareSelector,
} from "@/games/chess/custom/engine/types";
import { TILE_STYLES } from "@/games/chess/custom/themes";
import { ACTION_LABELS, TRIGGER_LABELS } from "@/games/chess/custom/editor/eventLabels";
import { ui } from "@/i18n/ui";
import { Button, Chip, IconButton, NumberField, Segmented, Select, Toggle, inputClass } from "./ui";

const CONDITION_LABELS: Record<ConditionType, string> = {
  teamHasPiece: "Team has a piece type",
  teamLacksPiece: "Team has none of a piece type",
  teamPieceCount: "Team's piece count",
  teamRoyalCount: "Team's king count",
  turnNumber: "Turn number",
  squareOccupied: "A square is occupied",
  randomChance: "Random chance",
};

const PIECE_SELECTORS: { id: PieceSelector; label: string }[] = [
  { id: "contextPiece", label: "The piece that triggered it" },
  { id: "firstOfType", label: "First piece of a type" },
  { id: "highestValue", label: "Most valuable piece" },
  { id: "atSquare", label: "The piece on a square" },
];
const SQUARE_SELECTORS: { id: SquareSelector; label: string }[] = [
  { id: "square", label: "A specific square" },
  { id: "contextSquare", label: "Where it happened" },
  { id: "originSquare", label: "That piece's starting square" },
  { id: "spawnTile", label: "A free spawn tile" },
];

const TRIGGER_TEAM = new Set<EventTriggerType>(["turnStart", "turnEnd", "pieceMove", "pieceCapture", "pieceCaptured", "kingCaptured", "pieceEnterSquare", "pieceLeaveSquare", "promotion", "tileEntered", "teamPieceCountEquals"]);
const TRIGGER_PIECE = new Set<EventTriggerType>(["pieceMove", "pieceCapture", "pieceCaptured", "pieceEnterSquare", "pieceLeaveSquare", "promotion", "tileEntered"]);

const PIECE_TARGET_ACTIONS = new Set<EventActionType>(["removePiece", "transformPiece", "movePiece", "teleportPiece", "changeTeam"]);
const SQUARE_ACTIONS = new Set<EventActionType>(["spawnPiece", "movePiece", "teleportPiece", "changeTile", "disableTile", "enableTile", "triggerAnimation"]);
const TEAM_ACTIONS = new Set<EventActionType>(["spawnPiece", "changeTeam", "addTurn", "skipTurn", "declareWinner", "declareLoser"]);
const MESSAGE_ACTIONS = new Set<EventActionType>(["displayMessage", "endGame", "declareDraw", "suddenDeath", "declareWinner", "declareLoser"]);

function useOptions(variant: GameVariant) {
  const teams = variant.teams.map((team) => ({ id: team.id, label: team.name }));
  const contextTeams = [
    { id: "actor", label: "Acting team (who moved)" },
    { id: "target", label: "Affected team (who lost a piece)" },
    { id: "opponentOfActor", label: "Opponent of the acting team" },
    ...teams,
  ];
  const pieces = variant.pieces.map((piece) => ({ id: piece.id, label: piece.name }));
  const squares = variant.board.cells.filter((cell) => cell.enabled).map((cell) => ({ id: `${cell.x},${cell.y}`, label: squareName(cell) }));
  return { teams, contextTeams, pieces, squares };
}

const coordFromId = (id: string): Coord => {
  const [x, y] = id.split(",").map(Number);
  return { x, y };
};

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

function SquareSelect({ value, onChange, options }: { value?: Coord; onChange: (coord: Coord) => void; options: { id: string; label: string }[] }) {
  return (
    <Select
      label="Square"
      className="w-24"
      value={value ? `${value.x},${value.y}` : ""}
      onChange={(id) => onChange(coordFromId(id))}
      options={[{ id: "", label: "Square…" }, ...options]}
    />
  );
}

function Stage({ label, tone, children }: { label: string; tone: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[76px_minmax(0,1fr)]">
      <span className={`self-start rounded-md px-2 py-1 text-center text-[10px] font-black tracking-[0.18em] ${tone}`}>{ui(label)}</span>
      <div className="min-w-0 space-y-2">{children}</div>
    </div>
  );
}

function ActionEditor({ action, onChange, onRemove, variant }: { action: EventAction; onChange: (action: EventAction) => void; onRemove: () => void; variant: GameVariant }) {
  const options = useOptions(variant);
  const set = (patch: Partial<EventAction>) => onChange({ ...action, ...patch });
  const target = action.target ?? "contextPiece";
  const at = action.at ?? "square";
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/25 p-2.5">
      <Row>
        <Select label="Action" className="w-auto min-w-[190px] flex-1 sm:flex-none" value={action.type} onChange={(type) => onChange({ id: action.id, type })} options={EVENT_ACTIONS.map((id) => ({ id, label: ACTION_LABELS[id] }))} />
        {action.type === "spawnPiece" && (
          <Select label="Piece type" className="w-auto" value={action.pieceType ?? ""} onChange={(pieceType) => set({ pieceType: pieceType || undefined })} options={[{ id: "", label: "Same type as the captured piece" }, ...options.pieces]} />
        )}
        {PIECE_TARGET_ACTIONS.has(action.type) && (
          <>
            <Select label="Which piece" className="w-auto" value={target} onChange={(value) => set({ target: value })} options={PIECE_SELECTORS} />
            {target === "firstOfType" && <Select label="Piece type" className="w-auto" value={action.pieceType ?? ""} onChange={(pieceType) => set({ pieceType })} options={[{ id: "", label: "Type…" }, ...options.pieces]} />}
            {(target === "firstOfType" || target === "highestValue") && action.type !== "changeTeam" && (
              <Select label="Of team" className="w-auto" value={action.team ?? "actor"} onChange={(team) => set({ team })} options={options.contextTeams} />
            )}
            {target === "atSquare" && <SquareSelect value={action.square} onChange={(square) => set({ square })} options={options.squares} />}
          </>
        )}
        {action.type === "transformPiece" && (
          <>
            <span className="text-xs text-zinc-500">{ui("into")}</span>
            <Select label="Into" className="w-auto" value={action.toPieceType ?? ""} onChange={(toPieceType) => set({ toPieceType })} options={[{ id: "", label: "Type…" }, ...options.pieces]} />
          </>
        )}
        {action.type === "changePieceRule" && (
          <>
            <Select label="Piece" className="w-auto" value={action.pieceType ?? ""} onChange={(pieceType) => set({ pieceType })} options={[{ id: "", label: "Piece…" }, ...options.pieces]} />
            <span className="text-xs text-zinc-500">{ui("now moves like")}</span>
            <Select label="Moves like" className="w-auto" value={action.toPieceType ?? ""} onChange={(toPieceType) => set({ toPieceType })} options={[{ id: "", label: "Piece…" }, ...options.pieces]} />
          </>
        )}
        {TEAM_ACTIONS.has(action.type) && (
          <Select
            label="Team"
            className="w-auto"
            value={action.team ?? (action.type === "skipTurn" || action.type === "changeTeam" ? "opponentOfActor" : action.type === "spawnPiece" || action.type === "declareLoser" ? "target" : "actor")}
            onChange={(team) => set({ team })}
            options={options.contextTeams}
          />
        )}
      </Row>
      {(SQUARE_ACTIONS.has(action.type) || action.type === "changeTile" || action.type === "setRoyalMode" || action.type === "triggerAnimation" || MESSAGE_ACTIONS.has(action.type)) && (
        <div className="mt-2">
          <Row>
            {SQUARE_ACTIONS.has(action.type) && (
              <>
                <span className="text-xs text-zinc-500">{ui("at")}</span>
                <Select label="Location" className="w-auto" value={at} onChange={(value) => set({ at: value })} options={SQUARE_SELECTORS} />
                {at === "square" && <SquareSelect value={action.square} onChange={(square) => set({ square })} options={options.squares} />}
              </>
            )}
            {action.type === "changeTile" && (
              <Select label="Tile" className="w-auto" value={action.tile ?? "normal"} onChange={(tile) => set({ tile })} options={TILE_TYPES.map((tile) => ({ id: tile, label: TILE_STYLES[tile].label }))} />
            )}
            {action.type === "triggerAnimation" && (
              <Select label="Animation" className="w-auto" value={action.animation ?? "pulse"} onChange={(animation) => set({ animation })} options={[{ id: "pulse", label: "Pulse" }, { id: "glow", label: "Glow" }, { id: "shake", label: "Shake" }]} />
            )}
            {action.type === "setRoyalMode" && (
              <Select label="King rule" className="w-auto" value={action.royalMode ?? "none"} onChange={(royalMode) => set({ royalMode })} options={[{ id: "checkmate", label: "Standard checkmate" }, { id: "capture", label: "Capturable kings" }, { id: "none", label: "No king requirement" }]} />
            )}
            {MESSAGE_ACTIONS.has(action.type) && (
              <input
                aria-label={ui("Message")}
                value={action.message ?? ""}
                maxLength={140}
                placeholder={action.type === "displayMessage" ? ui("Message to show") : ui("Optional message")}
                onChange={(event) => set({ message: event.target.value })}
                className={`${inputClass} min-w-[180px] flex-1 py-1.5`}
              />
            )}
          </Row>
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-300">
          <X size={12} />
          {ui("Remove action")}
        </button>
      </div>
    </div>
  );
}

function ConditionEditor({ condition, onChange, onRemove, variant }: { condition: EventCondition; onChange: (condition: EventCondition) => void; onRemove: () => void; variant: GameVariant }) {
  const options = useOptions(variant);
  const set = (patch: Partial<EventCondition>) => onChange({ ...condition, ...patch });
  const needsTeam = ["teamHasPiece", "teamLacksPiece", "teamPieceCount", "teamRoyalCount"].includes(condition.type);
  const needsPiece = condition.type === "teamHasPiece" || condition.type === "teamLacksPiece";
  const needsCompare = ["teamPieceCount", "teamRoyalCount", "turnNumber"].includes(condition.type);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-black/25 p-2.5">
      <Select label="Condition" className="w-auto" value={condition.type} onChange={(type) => onChange({ id: condition.id, type, team: "target", op: "eq", value: type === "randomChance" ? 50 : 0 })} options={(Object.keys(CONDITION_LABELS) as ConditionType[]).map((id) => ({ id, label: CONDITION_LABELS[id] }))} />
      {needsTeam && <Select label="Team" className="w-auto" value={condition.team ?? "target"} onChange={(team) => set({ team })} options={options.contextTeams} />}
      {needsPiece && <Select label="Piece type" className="w-auto" value={condition.pieceType ?? ""} onChange={(pieceType) => set({ pieceType })} options={[{ id: "", label: "Type…" }, ...options.pieces]} />}
      {needsCompare && (
        <>
          <Select label="Comparison" className="w-20" value={condition.op ?? "eq"} onChange={(op) => set({ op })} options={[{ id: "eq", label: "=" }, { id: "gte", label: "≥" }, { id: "lte", label: "≤" }]} />
          <NumberField label="Value" value={condition.value ?? 0} min={0} max={500} onChange={(value) => set({ value })} />
        </>
      )}
      {condition.type === "squareOccupied" && <SquareSelect value={condition.square} onChange={(square) => set({ square })} options={options.squares} />}
      {condition.type === "randomChance" && <NumberField label="Chance" value={condition.value ?? 50} min={1} max={100} suffix="%" onChange={(value) => set({ value })} />}
      <IconButton label={ui("Remove condition")} onClick={onRemove} className="ml-auto h-8 w-8">
        <X size={13} />
      </IconButton>
    </div>
  );
}

function ActionList({ actions, onChange, variant, emptyLabel }: { actions: EventAction[]; onChange: (actions: EventAction[]) => void; variant: GameVariant; emptyLabel: string }) {
  return (
    <>
      {actions.length === 0 && <p className="text-xs text-zinc-500">{emptyLabel}</p>}
      {actions.map((action, index) => (
        <ActionEditor
          key={action.id}
          action={action}
          variant={variant}
          onChange={(next) => onChange(actions.map((entry, position) => (position === index ? next : entry)))}
          onRemove={() => onChange(actions.filter((_, position) => position !== index))}
        />
      ))}
      <Button size="sm" onClick={() => onChange([...actions, { id: createId("act"), type: "displayMessage", message: "" }])}>
        <Plus size={13} />
        {ui("Add action")}
      </Button>
    </>
  );
}

export function EventCard({
  event,
  variant,
  expanded,
  onToggleExpanded,
  onChange,
  onRemove,
  onDuplicate,
  highlighted,
}: {
  event: GameEvent;
  variant: GameVariant;
  expanded: boolean;
  onToggleExpanded: () => void;
  onChange: (recipe: (event: GameEvent) => GameEvent, coalesceKey?: string) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  highlighted?: boolean;
}) {
  const options = useOptions(variant);
  const trigger = event.trigger;
  const setTrigger = (patch: Partial<GameEvent["trigger"]>) => onChange((current) => ({ ...current, trigger: { ...current.trigger, ...patch } }));
  const summary = `${ui(TRIGGER_LABELS[trigger.type])}${event.delayTurns ? ` · ${ui("wait")} ${event.delayTurns}` : ""}${event.conditions.length ? ` · ${ui("if")} ${event.conditions.length}` : ""} → ${event.actions.map((action) => ui(ACTION_LABELS[action.type])).join(", ") || ui("nothing")}`;

  return (
    <article className={`rounded-2xl border transition ${highlighted ? "border-amber-300/60" : event.enabled ? "border-white/[0.09]" : "border-white/[0.05] opacity-70"} bg-[#0d1014]/90`}>
      <header className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button type="button" onClick={onToggleExpanded} aria-expanded={expanded} aria-label={expanded ? ui("Collapse") : ui("Expand")} className="text-zinc-500 hover:text-white">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <input
          aria-label={ui("Event name")}
          value={event.name}
          maxLength={60}
          onChange={(change) => onChange((current) => ({ ...current, name: change.target.value }), `${event.id}-name`)}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-semibold text-zinc-100 outline-none hover:border-white/10 focus:border-amber-300/40"
        />
        {event.source === "kingConsequence" && <Chip tone="amber" title={ui("Created by the King capture rule; editing it is fine.")}>{ui("King rule")}</Chip>}
        {event.once && <Chip>{ui("Once")}</Chip>}
        <IconButton label={ui("Duplicate event")} onClick={onDuplicate} className="h-8 w-8">
          <Copy size={13} />
        </IconButton>
        <IconButton label={ui("Delete event")} onClick={onRemove} className="h-8 w-8">
          <Trash2 size={13} />
        </IconButton>
        <button
          type="button"
          role="switch"
          aria-checked={event.enabled}
          aria-label={ui("Enabled")}
          onClick={() => onChange((current) => ({ ...current, enabled: !current.enabled }))}
          className={`relative h-5 w-9 rounded-full border transition ${event.enabled ? "border-amber-300/70 bg-amber-300/80" : "border-white/15 bg-white/10"}`}
        >
          <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${event.enabled ? "left-[18px]" : "left-0.5"}`} />
        </button>
      </header>
      {!expanded ? (
        <p className="truncate px-4 pb-3 pl-11 text-xs text-zinc-500">{summary}</p>
      ) : (
        <div className="space-y-4 border-t border-white/[0.06] px-4 py-4">
          <Stage label="WHEN" tone="bg-sky-400/15 text-sky-200">
            <Row>
              <Select label="Trigger" className="w-auto" value={trigger.type} onChange={(type) => setTrigger({ type })} options={EVENT_TRIGGERS.map((id) => ({ id, label: TRIGGER_LABELS[id] }))} />
              {TRIGGER_TEAM.has(trigger.type) && (
                <Select
                  label="Team filter"
                  className="w-auto"
                  value={trigger.team ?? (trigger.type === "teamPieceCountEquals" ? variant.teams[0].id : "any")}
                  onChange={(team) => setTrigger({ team })}
                  options={trigger.type === "teamPieceCountEquals" ? options.teams : [{ id: "any", label: "Any team" }, ...options.teams]}
                />
              )}
              {TRIGGER_PIECE.has(trigger.type) && (
                <Select label="Piece filter" className="w-auto" value={trigger.pieceType ?? ""} onChange={(pieceType) => setTrigger({ pieceType: pieceType || undefined })} options={[{ id: "", label: "Any piece" }, ...options.pieces]} />
              )}
              {(trigger.type === "pieceEnterSquare" || trigger.type === "pieceLeaveSquare") && <SquareSelect value={trigger.square} onChange={(square) => setTrigger({ square })} options={options.squares} />}
              {trigger.type === "tileEntered" && (
                <Select label="Tile" className="w-auto" value={trigger.tile ?? "goal"} onChange={(tile) => setTrigger({ tile })} options={TILE_TYPES.filter((tile) => tile !== "normal").map((tile) => ({ id: tile, label: TILE_STYLES[tile].label }))} />
              )}
              {(trigger.type === "pieceCountEquals" || trigger.type === "teamPieceCountEquals") && <NumberField label="Count" value={trigger.count ?? 0} min={0} max={200} onChange={(count) => setTrigger({ count })} />}
              {trigger.type === "afterTurnNumber" && <NumberField label="Turn" value={trigger.turn ?? 10} min={1} max={500} onChange={(turn) => setTrigger({ turn })} />}
            </Row>
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-2 text-xs text-zinc-400">
                {ui("then wait")}
                <NumberField label="Moves to wait" value={event.delayTurns} min={0} max={200} onChange={(delayTurns) => onChange((current) => ({ ...current, delayTurns }), `${event.id}-delay`)} />
                {ui("moves")}
              </span>
              <div className="min-w-[200px]">
                <Toggle checked={event.once} onChange={(once) => onChange((current) => ({ ...current, once }))} label={ui("Only once per game")} />
              </div>
            </div>
          </Stage>

          <Stage label="IF" tone="bg-violet-400/15 text-violet-200">
            {event.conditions.length === 0 ? (
              <p className="text-xs text-zinc-500">{ui("Always — no conditions.")}</p>
            ) : (
              <Segmented size="sm" label="Condition mode" value={event.conditionMode} onChange={(conditionMode) => onChange((current) => ({ ...current, conditionMode }))} options={[{ id: "all", label: "All must be true" }, { id: "any", label: "Any may be true" }]} />
            )}
            {event.conditions.map((condition, index) => (
              <ConditionEditor
                key={condition.id}
                condition={condition}
                variant={variant}
                onChange={(next) => onChange((current) => ({ ...current, conditions: current.conditions.map((entry, position) => (position === index ? next : entry)) }))}
                onRemove={() => onChange((current) => ({ ...current, conditions: current.conditions.filter((_, position) => position !== index) }))}
              />
            ))}
            <Button size="sm" onClick={() => onChange((current) => ({ ...current, conditions: [...current.conditions, { id: createId("cond"), type: "teamHasPiece", team: "target", pieceType: variant.pieces[0]?.id }] }))}>
              <Plus size={13} />
              {ui("Add condition")}
            </Button>
          </Stage>

          <Stage label="THEN" tone="bg-emerald-400/15 text-emerald-200">
            <ActionList actions={event.actions} variant={variant} emptyLabel={ui("No actions yet.")} onChange={(actions) => onChange((current) => ({ ...current, actions }))} />
          </Stage>

          {event.conditions.length > 0 && (
            <Stage label="ELSE" tone="bg-amber-400/15 text-amber-200">
              <ActionList actions={event.elseActions} variant={variant} emptyLabel={ui("Nothing happens when the conditions fail.")} onChange={(elseActions) => onChange((current) => ({ ...current, elseActions }))} />
            </Stage>
          )}
        </div>
      )}
    </article>
  );
}
