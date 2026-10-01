import { createId } from "../engine/presets.ts";
import type { Coord, MovementRule, PieceDefinition } from "../engine/types.ts";

/**
 * Square brushes for the movement grid. Instead of switching whole patterns
 * between "move", "capture" or "first move only", the creator paints those
 * properties onto individual squares; these helpers translate each click into
 * the engine's rule lists.
 */
export const SQUARE_BRUSHES = ["both", "move", "capture", "firstMove", "clearFirstMove", "line", "erase"] as const;
export type SquareBrush = (typeof SQUARE_BRUSHES)[number];

const same = (a: Coord, b: Coord) => a.x === b.x && a.y === b.y && (a.z ?? 0) === (b.z ?? 0);
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const direction = (offset: Coord) => {
  const divisor = gcd(gcd(offset.x, offset.y), offset.z ?? 0) || 1;
  return { x: offset.x / divisor, y: offset.y / divisor, z: (offset.z ?? 0) / divisor };
};

const isPlainLeap = (rule: MovementRule, firstMove: boolean) => rule.kind === "leap" && Boolean(rule.firstMoveOnly) === firstMove && !rule.requiresScreen;

function defaultFrame(piece: PieceDefinition): MovementRule["relativeTo"] {
  return [...piece.movement, ...piece.capture].some((rule) => rule.relativeTo === "team") ? "team" : "board";
}

function without(rules: MovementRule[], offset: Coord, predicate: (rule: MovementRule) => boolean = () => true) {
  return rules.map((rule) => (rule.kind === "leap" && predicate(rule) ? { ...rule, offsets: rule.offsets.filter((entry) => !same(entry, offset)) } : rule));
}

function withLeap(rules: MovementRule[], offset: Coord, firstMove: boolean, frame: MovementRule["relativeTo"], canJump: boolean) {
  const index = rules.findIndex((rule) => isPlainLeap(rule, firstMove) && rule.relativeTo === frame);
  if (index >= 0) {
    if (rules[index].offsets.some((entry) => same(entry, offset))) return rules;
    return rules.map((rule, position) => (position === index ? { ...rule, offsets: [...rule.offsets, offset] } : rule));
  }
  return [...rules, { id: createId("rule"), kind: "leap" as const, offsets: [offset], canJump, relativeTo: frame, firstMoveOnly: firstMove || undefined }];
}

const hasLeap = (rules: MovementRule[], offset: Coord, firstMove?: boolean) =>
  rules.some((rule) => rule.kind === "leap" && (firstMove === undefined || Boolean(rule.firstMoveOnly) === firstMove) && rule.offsets.some((entry) => same(entry, offset)));

/** Does a slide reach this offset? */
function slideReaches(rule: MovementRule, offset: Coord) {
  if (rule.kind !== "slide") return false;
  return rule.offsets.some((step) => {
    const k = step.x !== 0 ? offset.x / step.x : step.y !== 0 ? offset.y / step.y : step.z ? (offset.z ?? 0) / step.z : 0;
    return Number.isInteger(k) && k >= Math.max(1, rule.minDistance ?? 1) && (!rule.maxDistance || k <= rule.maxDistance) && step.x * k === offset.x && step.y * k === offset.y && (step.z ?? 0) * k === (offset.z ?? 0);
  });
}

/** Give the piece its own capture list (a copy of its movement) so the two can differ. */
function separate(piece: PieceDefinition): PieceDefinition {
  if (!piece.captureSameAsMove) return piece;
  return { ...piece, captureSameAsMove: false, capture: piece.movement.map((rule) => ({ ...structuredClone(rule), id: createId("rule"), firstMoveOnly: undefined })) };
}

function prune(piece: PieceDefinition): PieceDefinition {
  const keep = (rule: MovementRule) => rule.kind === "teleport" || rule.offsets.length > 0;
  return { ...piece, movement: piece.movement.filter(keep), capture: piece.capture.filter(keep) };
}

/** What a square currently means for the piece — used for the grid and tooltips. */
export function squareRole(piece: PieceDefinition, offset: Coord) {
  const captureRules = piece.captureSameAsMove ? piece.movement : piece.capture;
  const move = hasLeap(piece.movement, offset) || piece.movement.some((rule) => slideReaches(rule, offset));
  const capture = hasLeap(captureRules, offset) || captureRules.some((rule) => slideReaches(rule, offset));
  const firstMove = hasLeap(piece.movement, offset, true) && !hasLeap(piece.movement, offset, false);
  return { move, capture, firstMove };
}

export function paintSquare(source: PieceDefinition, offset: Coord, brush: SquareBrush): PieceDefinition {
  if (offset.x === 0 && offset.y === 0 && !offset.z) return source;
  const frame = defaultFrame(source);
  let piece = source;

  switch (brush) {
    case "both": {
      piece = { ...piece, movement: withLeap(without(piece.movement, offset, (rule) => Boolean(rule.firstMoveOnly)), offset, false, frame, true) };
      if (!piece.captureSameAsMove) piece = { ...piece, capture: withLeap(piece.capture, offset, false, frame, true) };
      break;
    }
    case "move": {
      piece = separate(piece);
      piece = { ...piece, capture: without(piece.capture, offset), movement: withLeap(without(piece.movement, offset, (rule) => Boolean(rule.firstMoveOnly)), offset, false, frame, true) };
      break;
    }
    case "capture": {
      piece = separate(piece);
      piece = { ...piece, movement: without(piece.movement, offset), capture: withLeap(piece.capture, offset, false, frame, true) };
      break;
    }
    case "firstMove": {
      // A first-move square is a move (a pawn's double step), never a first-move capture.
      piece = separate(piece);
      const sourceRule = piece.movement.find((rule) => rule.kind === "leap" && rule.offsets.some((entry) => same(entry, offset)));
      piece = {
        ...piece,
        capture: without(piece.capture, offset),
        movement: withLeap(without(piece.movement, offset, (rule) => !rule.firstMoveOnly), offset, true, sourceRule?.relativeTo ?? frame, sourceRule?.canJump ?? false),
      };
      break;
    }
    case "clearFirstMove": {
      if (!hasLeap(piece.movement, offset, true)) return source;
      const sourceRule = piece.movement.find((rule) => rule.kind === "leap" && rule.firstMoveOnly && rule.offsets.some((entry) => same(entry, offset)));
      piece = { ...piece, movement: withLeap(without(piece.movement, offset, (rule) => Boolean(rule.firstMoveOnly)), offset, false, sourceRule?.relativeTo ?? frame, sourceRule?.canJump ?? true) };
      break;
    }
    case "line": {
      const ray = direction(offset);
      const toggle = (rules: MovementRule[], add: boolean) => {
        const cleaned = rules.map((rule) => (rule.kind === "slide" && !rule.requiresScreen ? { ...rule, offsets: rule.offsets.filter((entry) => !same(entry, ray)) } : rule));
        if (!add) return cleaned;
        const index = cleaned.findIndex((rule) => rule.kind === "slide" && !rule.requiresScreen && !rule.firstMoveOnly);
        if (index >= 0) return cleaned.map((rule, position) => (position === index ? { ...rule, offsets: [...rule.offsets, ray] } : rule));
        return [...cleaned, { id: createId("rule"), kind: "slide" as const, offsets: [ray], relativeTo: frame }];
      };
      const present = piece.movement.some((rule) => rule.kind === "slide" && !rule.requiresScreen && rule.offsets.some((entry) => same(entry, ray)));
      piece = { ...piece, movement: toggle(piece.movement, !present) };
      if (!piece.captureSameAsMove) piece = { ...piece, capture: toggle(piece.capture, !present) };
      break;
    }
    case "erase": {
      const ray = direction(offset);
      const clear = (rules: MovementRule[]) =>
        without(rules, offset).map((rule) => (rule.kind === "slide" && slideReaches(rule, offset) ? { ...rule, offsets: rule.offsets.filter((entry) => !same(entry, ray)) } : rule));
      piece = { ...piece, movement: clear(piece.movement), capture: clear(piece.capture) };
      break;
    }
  }
  return prune(piece);
}
