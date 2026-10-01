import { Plus, Trash2, Trophy } from "lucide-react";
import { useState } from "react";
import { squareName } from "@/games/chess/custom/engine/board";
import { victory } from "@/games/chess/custom/engine/presets";
import { VICTORY_TYPES, type VictoryCondition, type VictoryType } from "@/games/chess/custom/engine/types";
import { VICTORY_LABELS } from "@/games/chess/custom/engine/victory";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { ui } from "@/i18n/ui";
import { Button, EmptyState, IconButton, NumberField, Panel, SectionHeading, Segmented, Select, labelClass } from "../ui";

const DESCRIPTIONS: Record<VictoryType, string> = {
  checkmate: "The team to move is in check with no legal moves. Needs the Standard Checkmate king rule.",
  royalCaptured: "Capture the opponent's last royal piece.",
  captureAll: "Remove every enemy piece from the board.",
  captureSpecific: "Win by capturing one enemy piece of a chosen type.",
  reachSquare: "Move a piece onto a target square.",
  reachZone: "Move a piece onto a goal tile (goal tiles can belong to one team).",
  surviveTurns: "Still be in the game after a number of turns.",
  controlSquares: "Occupy several goal tiles at the same time.",
  piecesRemaining: "Reduce every opponent to at most X pieces.",
  eliminateType: "Leave the enemy with none of a chosen piece type.",
  lastTeamStanding: "Be the only team with pieces left.",
  eventOutcome: "Allow events to declare winners, losers or draws.",
};

function ConditionCard({ condition, onChange, onRemove }: { condition: VictoryCondition; onChange: (next: VictoryCondition, coalesceKey?: string) => void; onRemove: () => void }) {
  const { variant } = useEditor();
  const set = (patch: Partial<VictoryCondition>, coalesceKey?: string) => onChange({ ...condition, ...patch }, coalesceKey);
  const pieces = variant.pieces.map((piece) => ({ id: piece.id, label: piece.name }));
  const immediate = condition.type === "checkmate" || condition.type === "eventOutcome";
  return (
    <div className={`rounded-2xl border p-4 transition ${condition.enabled ? "border-white/[0.09] bg-[#0d1014]/90" : "border-white/[0.05] bg-black/20 opacity-70"}`}>
      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={condition.enabled}
          aria-label={ui("Enabled")}
          onClick={() => set({ enabled: !condition.enabled })}
          className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition ${condition.enabled ? "border-amber-300/70 bg-amber-300/80" : "border-white/15 bg-white/10"}`}
        >
          <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${condition.enabled ? "left-[18px]" : "left-0.5"}`} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-zinc-100">{ui(VICTORY_LABELS[condition.type])}</p>
          <p className="mt-0.5 text-xs leading-5 text-zinc-500">{ui(DESCRIPTIONS[condition.type])}</p>
        </div>
        <IconButton label={ui("Remove condition")} onClick={onRemove} className="h-8 w-8">
          <Trash2 size={13} />
        </IconButton>
      </div>
      {!immediate && (
        <div className="mt-3 flex flex-wrap items-end gap-3 pl-12">
          <label>
            <span className={labelClass}>{ui("Who can win this way")}</span>
            <Select label="Team" className="mt-1 w-auto" value={condition.team ?? "any"} onChange={(team) => set({ team })} options={[{ id: "any", label: "Any team" }, ...variant.teams.map((team) => ({ id: team.id, label: team.name }))]} />
          </label>
          {["captureSpecific", "eliminateType", "reachSquare", "reachZone"].includes(condition.type) && (
            <label>
              <span className={labelClass}>{ui("Piece type")}</span>
              <Select
                label="Piece type"
                className="mt-1 w-auto"
                value={condition.pieceType ?? ""}
                onChange={(pieceType) => set({ pieceType: pieceType || undefined })}
                options={[{ id: "", label: condition.type === "reachSquare" || condition.type === "reachZone" ? "Any piece" : "Choose…" }, ...pieces]}
              />
            </label>
          )}
          {condition.type === "reachSquare" && (
            <label>
              <span className={labelClass}>{ui("Square")}</span>
              <Select
                label="Square"
                className="mt-1 w-24"
                value={condition.square ? `${condition.square.x},${condition.square.y}` : ""}
                onChange={(id) => {
                  const [x, y] = id.split(",").map(Number);
                  set({ square: { x, y } });
                }}
                options={[{ id: "", label: "…" }, ...variant.board.cells.filter((cell) => cell.enabled).map((cell) => ({ id: `${cell.x},${cell.y}`, label: squareName(cell) }))]}
              />
            </label>
          )}
          {(condition.type === "controlSquares" || condition.type === "piecesRemaining") && (
            <div>
              <span className={labelClass}>{condition.type === "controlSquares" ? ui("Goal tiles") : ui("Pieces or fewer")}</span>
              <div className="mt-1">
                <NumberField label="Count" value={condition.count ?? 1} min={0} max={200} onChange={(count) => set({ count }, `${condition.id}-count`)} />
              </div>
            </div>
          )}
          {condition.type === "surviveTurns" && (
            <div>
              <span className={labelClass}>{ui("Turns")}</span>
              <div className="mt-1">
                <NumberField label="Turns" value={condition.turns ?? 20} min={1} max={500} onChange={(turns) => set({ turns }, `${condition.id}-turns`)} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VictorySection() {
  const { variant, dispatch } = useEditor();
  const [menuOpen, setMenuOpen] = useState(false);
  const conditions = variant.victoryConditions;
  const setConditions = (next: VictoryCondition[], coalesceKey?: string) => dispatch({ type: "setVictoryConditions", conditions: next, coalesceKey });

  return (
    <div>
      <SectionHeading
        eyebrow="Victory"
        title="How the game is won"
        description={ui("Combine as many conditions as you like. Checkmate and event outcomes always end the game immediately; the others follow the ANY / ALL rule below.")}
        actions={
          <div className="relative">
            <Button tone="primary" onClick={() => setMenuOpen((open) => !open)}>
              <Plus size={15} />
              {ui("Add condition")}
            </Button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-full z-30 mt-1 max-h-80 w-64 overflow-y-auto rounded-xl border border-white/10 bg-[#111418] p-1 shadow-2xl">
                {VICTORY_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setConditions([...conditions, victory(type, type === "surviveTurns" ? { turns: 20 } : type === "piecesRemaining" ? { count: 1 } : type === "controlSquares" ? { count: 2 } : {})]);
                      setMenuOpen(false);
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                  >
                    {ui(VICTORY_LABELS[type])}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />
      <Panel className="mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-100">{ui("Win when")}</p>
            <p className="text-xs text-zinc-500">{ui("ANY: one condition is enough. ALL: a team must satisfy every enabled condition at once.")}</p>
          </div>
          <Segmented
            label="Victory mode"
            value={variant.settings.victoryMode}
            onChange={(victoryMode) => dispatch({ type: "update", recipe: (current) => ({ ...current, settings: { ...current.settings, victoryMode } }) })}
            options={[
              { id: "any", label: "ANY condition" },
              { id: "all", label: "ALL conditions" },
            ]}
          />
        </div>
      </Panel>
      {conditions.length === 0 ? (
        <EmptyState icon={<Trophy size={20} />} title={ui("No victory conditions")}>
          {ui("Without one, games can only end in a draw. Add at least one condition.")}
        </EmptyState>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {conditions.map((condition, index) => (
            <ConditionCard
              key={condition.id}
              condition={condition}
              onChange={(next, coalesceKey) => setConditions(conditions.map((entry, position) => (position === index ? next : entry)), coalesceKey)}
              onRemove={() => setConditions(conditions.filter((_, position) => position !== index))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
