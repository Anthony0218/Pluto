import type { Coord, GameVariant, MovementKind, MovementRule, PositionSetup } from "../engine/types.ts";

/* Pure helpers shared by the editor components. */

export const coordKey = (coord: Coord) => `${coord.x},${coord.y}`;

/** dataTransfer type for drag-and-drop between the piece palette and boards. */
export const DRAG_MIME = "application/x-chess-custom";

export const KIND_LABELS: Record<MovementKind, string> = { leap: "Leap", slide: "Slide", teleport: "Teleport" };

/** One-line summary of a pattern. `t` translates each fragment (the UI passes `ui`). */
export function describeRule(rule: MovementRule, t: (text: string) => string = (text) => text) {
  if (rule.kind === "teleport") return t("Teleport between teleport tiles");
  const count = rule.offsets.length;
  const range = rule.kind === "slide" ? (rule.maxDistance ? ` · ${t("up to")} ${rule.maxDistance}` : ` · ${t("any distance")}`) : "";
  const extras = [rule.firstMoveOnly && t("first move only"), rule.requiresScreen && t("needs a screen"), rule.canJump && rule.kind === "slide" && `${t("hops")} ${rule.maxJumps ?? 1}`].filter(Boolean);
  return `${t(KIND_LABELS[rule.kind])} · ${t("directions:")} ${count}${range}${extras.length ? ` · ${extras.join(" · ")}` : ""}`;
}

/** Make an offset list 8-way symmetric (mirror x, mirror y, swap axes). */
export function symmetrize(offsets: Coord[]) {
  const out: Coord[] = [];
  for (const offset of offsets) {
    for (const [x, y] of [[offset.x, offset.y], [offset.y, offset.x]]) {
      for (const sx of [1, -1]) for (const sy of [1, -1]) {
        const next = { x: x * sx, y: y * sy };
        if ((next.x || next.y) && !out.some((entry) => entry.x === next.x && entry.y === next.y)) out.push(next);
      }
    }
  }
  return out;
}

export function gridRadius(rules: MovementRule[]) {
  const furthest = Math.max(0, ...rules.flatMap((rule) => (rule.kind === "leap" ? rule.offsets.map((offset) => Math.max(Math.abs(offset.x), Math.abs(offset.y))) : [])));
  return Math.min(7, Math.max(3, furthest + 1));
}


/**
 * A short hash of everything that affects gameplay (not name, description,
 * theme or save metadata). Sessions restart only when this changes.
 */
export function gameplaySignature(variant: GameVariant, setup: PositionSetup) {
  const { board, pieces, rules, events, victoryConditions, settings, teams } = variant;
  const text = JSON.stringify([board, pieces, rules, events, victoryConditions, settings, teams, setup]);
  let hash = 5381;
  for (let index = 0; index < text.length; index++) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return (hash >>> 0).toString(36);
}
