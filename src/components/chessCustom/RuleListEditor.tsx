import { Copy, Eraser, Plus, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { formatOffset } from "@/games/chess/custom/engine/movement";
import { createId, MOVEMENT_TEMPLATES } from "@/games/chess/custom/engine/presets";
import type { MovementKind, MovementRule, PieceDefinition } from "@/games/chess/custom/engine/types";
import { describeRule, KIND_LABELS, symmetrize } from "@/games/chess/custom/editor/editorUtils";
import { ui } from "@/i18n/ui";
import { Button, Chip, IconButton, NumberField, Segmented, Toggle, labelClass } from "./ui";

type Side = "movement" | "capture";

/**
 * Advanced pattern settings (leap/slide/teleport, direction frame, jumping,
 * range, cannon screens). Which squares are moves, captures or first-move
 * squares is painted on the grid instead.
 */
export default function RuleListEditor({
  piece,
  onChange,
  activeRuleId,
  onActivate,
}: {
  piece: PieceDefinition;
  onChange: (piece: PieceDefinition, coalesceKey?: string) => void;
  activeRuleId?: string;
  onActivate: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const entries: { side: Side; rule: MovementRule }[] = [
    ...piece.movement.map((rule) => ({ side: "movement" as const, rule })),
    ...(piece.captureSameAsMove ? [] : piece.capture.map((rule) => ({ side: "capture" as const, rule }))),
  ];
  const setSide = (side: Side, rules: MovementRule[], coalesceKey?: string) => onChange({ ...piece, [side]: rules }, coalesceKey);
  const update = (side: Side, id: string, patch: Partial<MovementRule>, coalesceKey?: string) => setSide(side, piece[side].map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)), coalesceKey);
  const sideLabel = (side: Side) => (piece.captureSameAsMove ? "Move & capture" : side === "movement" ? "Move" : "Capture");

  return (
    <div className="space-y-2">
      {entries.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-zinc-500">{ui("No patterns yet — paint squares on the grid or add a pattern.")}</p>}
      {entries.map(({ side, rule }) => {
        const active = rule.id === activeRuleId;
        return (
          <div key={rule.id} className={`rounded-xl border transition ${active ? "border-sky-400/50 bg-sky-400/[0.06]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/15"}`}>
            <div className="flex items-center gap-2 px-3 py-2">
              <button type="button" onClick={() => onActivate(rule.id)} className="min-w-0 flex-1 text-left" aria-expanded={active}>
                <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-zinc-100">
                  <Chip tone={side === "capture" ? "red" : piece.captureSameAsMove ? "violet" : "sky"}>{ui(sideLabel(side))}</Chip>
                  {rule.firstMoveOnly && <Chip tone="amber">{ui("First move")}</Chip>}
                  {describeRule(rule, ui)}
                </span>
                <span className="block truncate text-[11px] text-zinc-500">
                  {rule.offsets.slice(0, 8).map(formatOffset).join(" ")}
                  {rule.offsets.length > 8 ? " …" : ""}
                </span>
              </button>
              <IconButton label={ui("Duplicate pattern")} onClick={() => setSide(side, [...piece[side], { ...structuredClone(rule), id: createId("rule") }])}>
                <Copy size={14} />
              </IconButton>
              <IconButton label={ui("Delete pattern")} onClick={() => setSide(side, piece[side].filter((entry) => entry.id !== rule.id))}>
                <Trash2 size={14} />
              </IconButton>
            </div>
            {active && (
              <div className="space-y-3 border-t border-white/[0.06] px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented
                    size="sm"
                    label="Pattern type"
                    value={rule.kind}
                    onChange={(kind) => update(side, rule.id, { kind, canJump: kind === "leap" ? true : rule.canJump })}
                    options={(Object.keys(KIND_LABELS) as MovementKind[]).map((id) => ({ id, label: KIND_LABELS[id], title: id === "leap" ? "Jump straight to each square" : id === "slide" ? "Repeat the step any number of times" : "Jump between teleport tiles" }))}
                  />
                  {rule.kind !== "teleport" && (
                    <Segmented
                      size="sm"
                      label="Direction frame"
                      value={rule.relativeTo}
                      onChange={(relativeTo) => update(side, rule.id, { relativeTo })}
                      options={[
                        { id: "board", label: "Board", title: "Same directions for both teams" },
                        { id: "team", label: "Team-relative", title: "Up means forward for whichever team owns the piece" },
                      ]}
                    />
                  )}
                </div>
                {rule.kind === "leap" && <Toggle checked={rule.canJump !== false} onChange={(canJump) => update(side, rule.id, { canJump })} label={ui("Can jump over pieces")} description={ui("Off: the path (or the first step of an L-leap) must be empty.")} />}
                {rule.kind === "slide" && (
                  <>
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <p className={labelClass}>{ui("Min distance")}</p>
                        <NumberField label="Min distance" value={rule.minDistance ?? 1} min={1} max={15} onChange={(minDistance) => update(side, rule.id, { minDistance }, `${rule.id}-min`)} />
                      </div>
                      <div>
                        <p className={labelClass}>{ui("Max distance (0 = ∞)")}</p>
                        <NumberField label="Max distance" value={rule.maxDistance ?? 0} min={0} max={15} onChange={(maxDistance) => update(side, rule.id, { maxDistance }, `${rule.id}-max`)} />
                      </div>
                    </div>
                    <Toggle checked={Boolean(rule.canJump)} onChange={(canJump) => update(side, rule.id, { canJump, maxJumps: rule.maxJumps ?? 1 })} label={ui("Can hop over pieces")} description={ui("Slides past blocking pieces, like a bishop that may jump one piece.")} />
                    {rule.canJump && (
                      <div>
                        <p className={labelClass}>{ui("Pieces it may hop")}</p>
                        <NumberField label="Pieces it may hop" value={rule.maxJumps ?? 1} min={1} max={8} onChange={(maxJumps) => update(side, rule.id, { maxJumps }, `${rule.id}-hops`)} />
                      </div>
                    )}
                    {(side === "capture" || piece.captureSameAsMove) && (
                      <Toggle checked={Boolean(rule.requiresScreen)} onChange={(requiresScreen) => update(side, rule.id, { requiresScreen })} label={ui("Capture over a screen")} description={ui("Captures only by jumping exactly one piece, like a xiangqi cannon.")} />
                    )}
                  </>
                )}
                {rule.kind !== "teleport" && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => update(side, rule.id, { offsets: symmetrize(rule.offsets) })} title={ui("Mirror every offset in all 8 directions")}>
                      <Wand2 size={13} />
                      {ui("Make symmetric")}
                    </Button>
                    <Button size="sm" onClick={() => update(side, rule.id, { offsets: [] })}>
                      <Eraser size={13} />
                      {ui("Clear squares")}
                    </Button>
                  </div>
                )}
                {rule.kind === "teleport" && <p className="text-[11px] leading-5 text-zinc-500">{ui("Place Teleport tiles on the board; this piece can jump from one to any other.")}</p>}
              </div>
            )}
          </div>
        );
      })}
      <div className="relative">
        <Button size="sm" onClick={() => setMenuOpen((open) => !open)}>
          <Plus size={14} />
          {ui("Add pattern")}
        </Button>
        {menuOpen && (
          <div role="menu" className="absolute left-0 top-full z-30 mt-1 w-64 rounded-xl border border-white/10 bg-[#111418] p-1 shadow-2xl">
            {MOVEMENT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  const rule = template.build();
                  // New patterns both move and capture; repaint squares afterwards to split them.
                  onChange(piece.captureSameAsMove ? { ...piece, movement: [...piece.movement, rule] } : { ...piece, movement: [...piece.movement, rule], capture: [...piece.capture, { ...structuredClone(rule), id: createId("rule") }] });
                  onActivate(rule.id);
                  setMenuOpen(false);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white"
              >
                {ui(template.label)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
