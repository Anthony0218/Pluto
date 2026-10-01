import { boardLayers, coordKey3D, getCell, inBounds, squareName } from "./board.ts";
import { pieceAt, ruleEnabled, toBoardOffset, type Position } from "./position.ts";
import type { Coord, MoveSource, MovementRule, PieceDefinition, PieceInstance } from "./types.ts";

/**
 * Pseudo-legal move generation. Every candidate carries a human-readable reason
 * so the Rule Debugger can show *why* a square is (not) reachable. Illegal
 * candidates are only produced when `explain` is set.
 */
export type CandidateKind = "move" | "capture";

export interface MoveCandidate {
  to: Coord;
  kind: CandidateKind;
  legal: boolean;
  reason: string;
  ruleId: string;
  source: MoveSource;
  /** The offset as written in the rule (team-relative when the rule is). */
  ruleOffset: Coord;
  captureIds: string[];
  path: Coord[];
}

type Mode = "move" | "capture" | "both";

const sign = (value: number) => Math.sign(value);
const add = (a: Coord, b: Coord, k = 1): Coord => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: (a.z ?? 0) + (b.z ?? 0) * k });
const fmt = (value: number) => (value > 0 ? `+${value}` : `${value}`);
export const formatOffset = (offset: Coord) => `(${fmt(offset.x)}, ${fmt(offset.y)}${offset.z ? `, ${fmt(offset.z)}` : ""})`;

export function ruleLabel(rule: MovementRule, offset: Coord) {
  if (rule.kind === "teleport") return "teleport between teleport tiles";
  if (rule.kind === "slide") {
    const range = rule.maxDistance ? ` up to ${rule.maxDistance}` : "";
    return `slide ${formatOffset(offset)}${range}`;
  }
  return `offset ${formatOffset(offset)}`;
}

/** The definition whose movement the piece currently uses (events may override it). */
export function movementDefinition(position: Position, piece: PieceInstance) {
  const override = position.state.ruleOverrides[piece.type];
  return position.defs.get(override ?? piece.type) ?? position.defs.get(piece.type);
}

function enterCheck(position: Position, to: Coord, step: Coord): string | null {
  const cell = getCell(position.state.board, to);
  if (!cell || !cell.enabled) return `${squareName(to)} is not part of the board`;
  if (cell.tile === "blocked") return `${squareName(to)} is a blocked tile`;
  if (cell.tile === "oneWay" && cell.direction) {
    const dot = cell.direction.x * sign(step.x) + cell.direction.y * sign(step.y);
    if (dot <= 0) return `${squareName(to)} is a one-way tile entered from the wrong side`;
  }
  return null;
}

/** Intermediate squares a non-jumping leaper must cross. */
function leapPath(from: Coord, delta: Coord): Coord[] {
  const ax = Math.abs(delta.x);
  const ay = Math.abs(delta.y);
  const az = Math.abs(delta.z ?? 0);
  const steps: Coord[] = [];
  if (az && (delta.x === 0 && delta.y === 0 || az === ax && az === ay || az === ax && delta.y === 0 || az === ay && delta.x === 0)) {
    const n = Math.max(ax, ay, az);
    const unit = { x: sign(delta.x), y: sign(delta.y), z: sign(delta.z ?? 0) };
    for (let k = 1; k < n; k++) steps.push(add(from, unit, k));
    return steps;
  }
  if (delta.x === 0 || delta.y === 0 || ax === ay) {
    const n = Math.max(ax, ay);
    const unit = { x: sign(delta.x), y: sign(delta.y), z: 0 };
    for (let k = 1; k < n; k++) steps.push(add(from, unit, k));
    return steps;
  }
  // "Lame" leaper (xiangqi horse): the first orthogonal leg along the longer axis.
  const unit = ax > ay ? { x: sign(delta.x), y: 0 } : { x: 0, y: sign(delta.y) };
  for (let k = 1; k < Math.max(ax, ay); k++) steps.push(add(from, unit, k));
  return steps;
}

interface Emit {
  (candidate: MoveCandidate): void;
}

function classify(
  position: Position,
  piece: PieceInstance,
  def: PieceDefinition,
  to: Coord,
  mode: Mode,
  base: Omit<MoveCandidate, "kind" | "legal" | "reason" | "captureIds">,
  label: string,
  emit: Emit,
  explain: boolean,
) {
  const occupant = pieceAt(position, to);
  const { variant, state } = position;
  if (!occupant) {
    const ep = state.enPassant;
    const canEnPassant =
      mode !== "move" &&
      ep &&
      ep.square.x === to.x &&
      ep.square.y === to.y && (ep.square.z ?? 0) === (to.z ?? 0) &&
      def.abilities.includes("enPassant") &&
      ruleEnabled(variant, "enPassant");
    const victim = canEnPassant ? state.pieces.find((entry) => entry.id === ep!.pieceId) : undefined;
    if (victim && victim.team !== piece.team) {
      emit({ ...base, source: "enPassant", kind: "capture", legal: true, reason: `en passant capture (${label})`, captureIds: [victim.id] });
      return;
    }
    if (mode === "capture") {
      if (explain) emit({ ...base, kind: "capture", legal: false, reason: `capture rule needs an enemy on ${squareName(to)}`, captureIds: [] });
      return;
    }
    emit({ ...base, kind: "move", legal: true, reason: `${label}`, captureIds: [] });
    return;
  }

  const ally = occupant.team === piece.team;
  if (ally && !ruleEnabled(variant, "friendlyFire")) {
    if (explain) emit({ ...base, kind: "move", legal: false, reason: `${squareName(to)} is occupied by your own piece`, captureIds: [] });
    return;
  }
  if (mode === "move") {
    if (explain) emit({ ...base, kind: "capture", legal: false, reason: `${squareName(to)} is occupied — this rule only moves, it cannot capture`, captureIds: [] });
    return;
  }
  const targetDef = position.defs.get(occupant.type);
  if (targetDef?.abilities.includes("invulnerable")) {
    if (explain) emit({ ...base, kind: "capture", legal: false, reason: `${targetDef.name} on ${squareName(to)} cannot be captured`, captureIds: [] });
    return;
  }
  emit({ ...base, kind: "capture", legal: true, reason: `capture with ${label}`, captureIds: [occupant.id] });
}

function generateForRule(
  position: Position,
  piece: PieceInstance,
  def: PieceDefinition,
  rule: MovementRule,
  mode: Mode,
  emit: Emit,
  explain: boolean,
  lean = false,
) {
  const from = { x: piece.x, y: piece.y, z: piece.z ?? 0 };
  const { board } = position.state;
  const source: MoveSource = mode === "capture" ? "capture" : "movement";

  if (rule.firstMoveOnly && piece.moveCount > 0) {
    if (!explain) return;
    for (const offset of rule.offsets) {
      const delta = toBoardOffset(position.variant, piece.team, offset, rule.relativeTo === "team");
      const to = add(from, delta);
      if (inBounds(board, to)) {
        emit({ to, kind: "move", legal: false, reason: `${ruleLabel(rule, offset)} is only allowed on the piece's first move`, ruleId: rule.id, source, ruleOffset: offset, captureIds: [], path: [from, to] });
      }
    }
    return;
  }

  if (rule.kind === "teleport") {
    const cell = getCell(board, from);
    if (cell?.tile !== "teleport") return;
    for (const layer of boardLayers(board)) for (const target of layer.cells) {
      if (target.tile !== "teleport" || !target.enabled || (target.x === from.x && target.y === from.y && layer.z === from.z)) continue;
      const to = { x: target.x, y: target.y, z: layer.z };
      const base = { to, ruleId: rule.id, source: "teleport" as MoveSource, ruleOffset: { x: 0, y: 0 }, path: [from, to] };
      classify(position, piece, def, to, mode, base, "teleport tile link", emit, explain);
    }
    return;
  }

  for (const offset of rule.offsets) {
    if (offset.x === 0 && offset.y === 0 && !offset.z) continue;
    const delta = toBoardOffset(position.variant, piece.team, offset, rule.relativeTo === "team");
    const label = `custom ${rule.kind === "slide" ? "slide" : "movement offset"} ${formatOffset(offset)}`;

    if (rule.kind === "leap") {
      const to = add(from, delta);
      if (!inBounds(board, to)) continue;
      const base = { to, ruleId: rule.id, source, ruleOffset: offset, path: [from, to] };
      const blocked = enterCheck(position, to, delta);
      if (blocked) {
        if (explain) emit({ ...base, kind: "move", legal: false, reason: blocked, captureIds: [] });
        continue;
      }
      if (!rule.canJump) {
        const path = leapPath(from, delta);
        const obstacle = path.find((step) => enterCheck(position, step, delta) || pieceAt(position, step));
        if (obstacle) {
          if (explain) emit({ ...base, kind: "move", legal: false, reason: `path blocked at ${squareName(obstacle)} (this piece cannot jump)`, captureIds: [] });
          continue;
        }
        base.path = [from, ...path, to];
      }
      classify(position, piece, def, to, mode, base, label, emit, explain);
      continue;
    }

    // Slides
    const min = Math.max(1, rule.minDistance ?? 1);
    const max = rule.maxDistance && rule.maxDistance > 0 ? rule.maxDistance : Infinity;
    let jumpsLeft = rule.canJump ? Math.max(1, rule.maxJumps ?? 1) : 0;
    let screenSeen = false;
    let blockedBy: string | null = null;
    const path: Coord[] = [from];
    for (let k = 1; k <= max; k++) {
      const to = add(from, delta, k);
      if (!inBounds(board, to)) break;
      if (!lean) path.push(to);
      const base = { to, ruleId: rule.id, source, ruleOffset: offset, path: lean ? path : path.slice() };
      if (blockedBy) {
        if (!explain) break;
        emit({ ...base, kind: "move", legal: false, reason: blockedBy, captureIds: [] });
        continue;
      }
      const cellProblem = enterCheck(position, to, delta);
      if (cellProblem) {
        if (explain) emit({ ...base, kind: "move", legal: false, reason: cellProblem, captureIds: [] });
        blockedBy = `path blocked — ${cellProblem}`;
        continue;
      }
      const occupant = pieceAt(position, to);

      if (rule.requiresScreen && mode !== "move") {
        if (!screenSeen) {
          if (occupant) {
            screenSeen = true;
            if (explain) emit({ ...base, kind: "move", legal: false, reason: `${squareName(to)} is the screen this piece must jump to capture`, captureIds: [] });
          } else if (mode === "both" && k >= min) {
            emit({ ...base, kind: "move", legal: true, reason: label, captureIds: [] });
          }
          continue;
        }
        if (occupant) {
          classify(position, piece, def, to, "capture", base, `${label} over a screen`, emit, explain);
          blockedBy = `path blocked by the piece on ${squareName(to)}`;
        }
        continue;
      }

      if (!occupant) {
        if (k < min) {
          if (explain) emit({ ...base, kind: "move", legal: false, reason: `closer than the minimum distance (${min})`, captureIds: [] });
          continue;
        }
        classify(position, piece, def, to, mode, base, label, emit, explain);
        continue;
      }

      if (k >= min) classify(position, piece, def, to, mode, base, label, emit, explain);
      else if (explain) emit({ ...base, kind: "move", legal: false, reason: `closer than the minimum distance (${min})`, captureIds: [] });

      if (jumpsLeft > 0) {
        jumpsLeft -= 1;
        continue;
      }
      blockedBy = `path blocked by the piece on ${squareName(to)}`;
    }
  }
}

/** All pseudo-legal (and, with `explain`, rejected) destinations for a piece. */
export function generateCandidates(
  position: Position,
  piece: PieceInstance,
  options: { explain?: boolean; capturesOnly?: boolean } = {},
): MoveCandidate[] {
  const def = position.defs.get(piece.type);
  const ruleDef = movementDefinition(position, piece);
  if (!def || !ruleDef) return [];
  const explain = Boolean(options.explain);
  const out: MoveCandidate[] = [];
  const emit: Emit = (candidate) => out.push(candidate);

  // Attack detection only needs capture targets: no paths, no de-duplication.
  const lean = Boolean(options.capturesOnly) && !explain;
  if (ruleDef.captureSameAsMove) {
    for (const rule of ruleDef.movement) generateForRule(position, piece, def, rule, options.capturesOnly ? "capture" : "both", emit, explain, lean);
  } else {
    if (!options.capturesOnly) for (const rule of ruleDef.movement) generateForRule(position, piece, def, rule, "move", emit, explain);
    for (const rule of ruleDef.capture) generateForRule(position, piece, def, rule, "capture", emit, explain, lean);
  }
  if (lean) return out.filter((candidate) => candidate.legal);

  // One entry per destination: a legal capture/move beats an explanation of why another rule failed.
  const best = new Map<string, MoveCandidate>();
  for (const candidate of out) {
    const key = coordKey3D(candidate.to);
    const current = best.get(key);
    if (!current || (!current.legal && candidate.legal) || (current.legal && candidate.legal && candidate.kind === "capture" && current.kind === "move")) {
      best.set(key, candidate);
    }
  }
  if (explain) return [...best.values()];
  return [...best.values()].filter((candidate) => candidate.legal);
}

/** Would `byTeam` be able to capture a piece standing on `coord`? */
export function isSquareAttacked(position: Position, coord: Coord, byTeam: string, defenderTeam: string): boolean {
  let probe = position;
  if (!pieceAt(position, coord)) {
    const occupancy = new Map(position.occupancy);
    occupancy.set(coordKey3D(coord), {
      id: "__probe__",
      type: "__probe__",
      team: defenderTeam,
      x: coord.x,
      y: coord.y,
      z: coord.z ?? 0,
      moveCount: 0,
      origin: coord,
    });
    probe = { ...position, occupancy };
  }
  for (const attacker of position.state.pieces) {
    if (attacker.team !== byTeam) continue;
    const hits = generateCandidates(probe, attacker, { capturesOnly: true });
    if (hits.some((hit) => hit.kind === "capture" && coordKey3D(hit.to) === coordKey3D(coord))) return true;
  }
  return false;
}
