import { formatOffset } from "@/games/chess/custom/engine/movement";
import type { Coord, MovementRule, PieceDefinition, TeamDefinition } from "@/games/chess/custom/engine/types";
import { gridRadius } from "@/games/chess/custom/editor/editorUtils";
import { ui } from "@/i18n/ui";
import PieceToken from "./PieceToken";

type Reach = { move: boolean; capture: boolean; active: boolean; firstMove: boolean };

function reachOf(rules: MovementRule[], radius: number, layerDelta: number, kind: "move" | "capture", activeId: string | undefined, out: Map<string, Reach>) {
  for (const rule of rules) {
    if (rule.kind === "teleport") continue;
    for (const offset of rule.offsets) {
      const steps = rule.kind === "slide" ? Math.min(radius * 2, rule.maxDistance || radius * 2) : 1;
      for (let k = rule.kind === "slide" ? Math.max(1, rule.minDistance ?? 1) : 1; k <= steps; k++) {
        const x = offset.x * k;
        const y = offset.y * k;
        if ((offset.z ?? 0) * k !== layerDelta) continue;
        if (Math.abs(x) > radius || Math.abs(y) > radius) break;
        const key = `${x},${y}`;
        const entry = out.get(key) ?? { move: false, capture: false, active: false, firstMove: false };
        entry[kind] = true;
        if (rule.id === activeId) entry.active = true;
        if (rule.firstMoveOnly) entry.firstMove = true;
        out.set(key, entry);
      }
    }
  }
}

/**
 * The movement preview: the piece sits in the centre, +y is "forward" for
 * team-relative rules. Blue = move, red = capture, violet = both.
 * Clicking a square toggles it in the active rule (when editable).
 */
export default function MovementGrid({
  piece,
  team,
  moveRules,
  captureRules,
  activeRuleId,
  onToggle,
  radius: fixedRadius,
  compact = false,
  layerDelta = 0,
}: {
  piece: PieceDefinition;
  team?: TeamDefinition;
  moveRules: MovementRule[];
  captureRules: MovementRule[];
  activeRuleId?: string;
  onToggle?: (offset: Coord) => void;
  radius?: number;
  compact?: boolean;
  layerDelta?: number;
}) {
  const radius = fixedRadius ?? gridRadius([...moveRules, ...captureRules]);
  const reach = new Map<string, Reach>();
  reachOf(moveRules, radius, layerDelta, "move", activeRuleId, reach);
  reachOf(captureRules, radius, layerDelta, "capture", activeRuleId, reach);
  const size = radius * 2 + 1;
  const hasTeleport = [...moveRules, ...captureRules].some((rule) => rule.kind === "teleport");

  return (
    <div>
      <div
        role="grid"
        aria-label={`Movement preview for ${piece.name}`}
        className="grid overflow-hidden rounded-xl border border-white/10 bg-black/40"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: size }, (_, row) =>
          Array.from({ length: size }, (_, column) => {
            const x = column - radius;
            const y = radius - row;
            const center = x === 0 && y === 0 && layerDelta === 0;
            const entry = reach.get(`${x},${y}`);
            const light = (x + y) % 2 === 0;
            const color = entry?.move && entry.capture ? "168,85,247" : entry?.capture ? "239,68,68" : entry?.move ? "56,189,248" : null;
            const label = center ? piece.name : `${formatOffset({ x, y, z: layerDelta })}${entry ? ` — ${entry.move && entry.capture ? "move & capture" : entry.capture ? "capture" : "move"}` : ""}`;
            return (
              <button
                key={`${x},${y}`}
                type="button"
                role="gridcell"
                disabled={!onToggle || center}
                title={label}
                aria-label={label}
                onClick={() => onToggle?.({ x, y, z: layerDelta })}
                className={`relative aspect-square transition ${onToggle && !center ? "cursor-pointer hover:brightness-150" : "cursor-default"}`}
                style={{
                  background: color ? `rgba(${color}, ${entry?.active ? 0.62 : 0.3})` : light ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                  boxShadow: entry?.active ? `inset 0 0 0 2px rgba(${color}, 0.95)` : entry?.firstMove ? "inset 0 0 0 2px rgba(252, 211, 77, 0.85)" : undefined,
                }}
              >
                {center && (
                  <span className="absolute inset-[8%] flex items-center justify-center rounded-md bg-amber-300/20 ring-1 ring-amber-300/60">
                    <PieceToken def={piece} team={team} />
                  </span>
                )}
                {entry?.firstMove && !center && <span className="absolute right-[8%] top-[4%] rounded-sm bg-amber-300/90 px-0.5 text-[7px] font-black leading-[10px] text-zinc-950">1st</span>}
              </button>
            );
          }),
        )}
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sky-400/70" />{ui("Move")}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500/70" />{ui("Capture")}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-purple-500/70" />{ui("Both")}</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm ring-2 ring-amber-300/80" />{ui("First move")}</span>
          <span className="ml-auto text-zinc-500">↑ {piece.movement.some((rule) => rule.relativeTo === "team") ? ui("forward for the owning team") : ui("towards the top")}</span>
          {hasTeleport && <span className="w-full text-fuchsia-300">✧ {ui("Also teleports between teleport tiles.")}</span>}
        </div>
      )}
    </div>
  );
}
