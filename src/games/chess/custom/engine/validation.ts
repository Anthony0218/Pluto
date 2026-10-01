import { boardLayers, coordKey3D, findBoardRegions, getCell, inBounds, isPlayable, squareName } from "./board.ts";
import { sideOf } from "./teams.ts";
import { VICTORY_LABELS } from "./victory.ts";
import type { Coord, GameVariant, PieceTypeId } from "./types.ts";

export type IssueSeverity = "error" | "warning" | "info";
export type IssueSection = "overview" | "board" | "teams" | "pieces" | "rules" | "events" | "victory" | "position";

export interface ValidationIssue {
  id: string;
  severity: IssueSeverity;
  section: IssueSection;
  message: string;
  /** Entity the issue is about (piece id, event id, …) for jump-to navigation. */
  targetId?: string;
}

/**
 * Non-blocking checks. Nothing here prevents testing a variant — creators are
 * allowed to experiment with broken games; we only explain what may go wrong.
 */
export function validateVariant(variant: GameVariant): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (severity: IssueSeverity, section: IssueSection, message: string, targetId?: string) =>
    issues.push({ id: `${section}-${issues.length}`, severity, section, message, targetId });
  const pieceIds = new Set(variant.pieces.map((piece) => piece.id));
  const teamIds = new Set(variant.teams.map((team) => team.id));
  const pieceName = (id: PieceTypeId) => variant.pieces.find((piece) => piece.id === id)?.name ?? id;
  const { board } = variant;
  const allCells = boardLayers(board).flatMap((layer) => layer.cells.map((cell) => ({ ...cell, z: layer.z })));

  /* Victory */
  const enabled = variant.victoryConditions.filter((condition) => condition.enabled);
  const decisive = enabled.filter((condition) => condition.type !== "eventOutcome");
  const eventsCanWin = variant.events.some((event) => event.enabled && [...event.actions, ...event.elseActions].some((action) => ["declareWinner", "declareLoser", "endGame"].includes(action.type)));
  if (!decisive.length && !(eventsCanWin && enabled.some((condition) => condition.type === "eventOutcome"))) {
    add("error", "victory", "No victory condition exists — games can only end in a draw.");
  }
  for (const condition of enabled) {
    const label = VICTORY_LABELS[condition.type];
    if (condition.type === "checkmate" && variant.settings.royalMode !== "checkmate") {
      add("warning", "victory", `“${label}” can never happen: the king rule is not Standard Checkmate.`, condition.id);
    }
    if (condition.type === "royalCaptured" && variant.settings.royalMode === "checkmate") {
      add("info", "victory", `“${label}” rarely triggers with Standard Checkmate — kings cannot normally be captured.`, condition.id);
    }
    if (condition.type === "reachSquare") {
      if (!condition.square || !isPlayable(board, condition.square)) add("error", "victory", `“${label}” points at a square that is not on the board.`, condition.id);
    }
    if ((condition.type === "reachZone" || condition.type === "controlSquares") && !allCells.some((cell) => cell.enabled && cell.tile === "goal")) {
      add("error", "victory", `“${label}” needs goal tiles, but the board has none.`, condition.id);
    }
    if (condition.type === "controlSquares") {
      const goals = allCells.filter((cell) => cell.enabled && cell.tile === "goal").length;
      if ((condition.count ?? 1) > goals && goals > 0) add("error", "victory", `“${label}” asks for ${condition.count} goal tiles but only ${goals} exist.`, condition.id);
    }
    if ((condition.type === "captureSpecific" || condition.type === "eliminateType") && condition.pieceType) {
      if (!pieceIds.has(condition.pieceType)) add("error", "victory", `“${label}” references a deleted piece type (${condition.pieceType}).`, condition.id);
      else if (!variant.setup.pieces.some((piece) => piece.type === condition.pieceType)) {
        add("warning", "victory", `“${label}” may never be reachable — no ${pieceName(condition.pieceType)} is in the starting position.`, condition.id);
      }
    }
    if ((condition.type === "captureSpecific" || condition.type === "eliminateType") && !condition.pieceType) {
      add("error", "victory", `“${label}” has no piece type selected.`, condition.id);
    }
    if (condition.type === "surviveTurns" && !condition.turns) add("error", "victory", `“${label}” needs a number of turns.`, condition.id);
    if (condition.team && condition.team !== "any" && !teamIds.has(condition.team)) add("error", "victory", `“${label}” references a missing team.`, condition.id);
  }

  /* Teams & setup */
  if (variant.teams.length < 2) add("error", "teams", "A game needs at least two teams.");
  if (teamIds.size !== variant.teams.length) add("error", "teams", "Two teams share the same internal id.");
  if (variant.teams.length > 1 && variant.teams.every((team) => team.alliance && team.alliance === variant.teams[0].alliance)) add("error", "teams", "At least two opposing alliances or independent armies are required.");
  for (const team of variant.teams) {
    if (team.alliance !== undefined && (typeof team.alliance !== "string" || !team.alliance.trim() || team.alliance.length > 24)) add("error", "teams", "Alliance names must contain 1–24 characters.");
  }
  const sides = new Map<string, string[]>();
  for (const team of variant.teams) sides.set(sideOf(team), [...(sides.get(sideOf(team)) ?? []), team.name]);
  for (const [side, names] of sides) if (names.length > 1) add("info", "teams", `${names.join(" and ")} both play from the ${side} side — their armies may overlap.`);
  for (const team of variant.teams) {
    const pieces = variant.setup.pieces.filter((piece) => piece.team === team.id);
    if (!pieces.length) add("warning", "position", `${team.name} has no pieces in the starting position.`);
    else if (variant.settings.royalMode !== "none" && !pieces.some((piece) => variant.pieces.find((def) => def.id === piece.type)?.royal)) {
      add("warning", "position", `King required but missing — ${team.name} has no royal piece.`);
    }
  }
  const occupied = new Set<string>();
  for (const placed of variant.setup.pieces) {
    const key = coordKey3D(placed);
    if (!pieceIds.has(placed.type)) add("error", "position", `Starting position uses a deleted piece type (${placed.type}) on ${squareName(placed)}.`);
    if (!inBounds(board, placed)) add("warning", "position", `A ${pieceName(placed.type)} is outside the board and will be ignored.`);
    else if (!isPlayable(board, placed)) add("warning", "position", `${pieceName(placed.type)} on ${squareName(placed)} stands on a disabled or blocked cell and will be ignored.`);
    if (occupied.has(key)) add("warning", "position", `Two pieces share ${squareName(placed)}; only the first is used.`);
    occupied.add(key);
  }

  /* Pieces */
  const symbols = new Map<string, string>();
  for (const piece of variant.pieces) {
    const moves = piece.movement.filter((rule) => rule.kind === "teleport" || rule.offsets.length > 0);
    if (!moves.length) add("warning", "pieces", `${piece.name} has no legal movement.`, piece.id);
    if (!piece.captureSameAsMove && !piece.capture.some((rule) => rule.kind === "teleport" || rule.offsets.length > 0)) {
      add("info", "pieces", `${piece.name} can never capture.`, piece.id);
    }
    for (const rule of [...piece.movement, ...piece.capture]) {
      if (rule.kind === "slide" && rule.maxDistance && rule.minDistance && rule.minDistance > rule.maxDistance) {
        add("error", "pieces", `${piece.name}: a slide's minimum distance is larger than its maximum.`, piece.id);
      }
      if (rule.kind === "teleport" && !allCells.some((cell) => cell.enabled && cell.tile === "teleport")) {
        add("warning", "pieces", `${piece.name} teleports between teleport tiles, but the board has none.`, piece.id);
      }
    }
    if (piece.promotion) {
      if (!piece.promotion.options.length) add("warning", "pieces", `${piece.name} can promote but has no promotion options.`, piece.id);
      for (const option of piece.promotion.options) {
        if (!pieceIds.has(option)) add("error", "pieces", `${piece.name} promotes to a missing piece (${option}).`, piece.id);
      }
      if (piece.promotion.zone === "tiles" && !allCells.some((cell) => cell.enabled && cell.tile === "promotion")) {
        add("warning", "pieces", `${piece.name} promotes on promotion tiles, but the board has none.`, piece.id);
      }
    }
    if (piece.symbol) {
      const other = symbols.get(piece.symbol.toUpperCase());
      if (other) add("info", "pieces", `${piece.name} and ${other} share the notation symbol “${piece.symbol}”.`, piece.id);
      symbols.set(piece.symbol.toUpperCase(), piece.name);
    }
  }
  const castlingOn = variant.rules.some((rule) => rule.type === "castling" && rule.enabled);
  if (castlingOn && !variant.pieces.some((piece) => piece.abilities.includes("castling"))) {
    add("info", "rules", "Castling is enabled, but no piece has the Castling ability.");
  }
  const royals = variant.setup.pieces.filter((piece) => variant.pieces.find((def) => def.id === piece.type)?.royal);
  if (variant.settings.royalMode === "checkmate" && variant.settings.royalScope === "every" && variant.teams.some((team) => royals.filter((piece) => piece.team === team.id).length > 1)) {
    add("info", "rules", "A team has several kings under Standard Checkmate — every one of them must stay out of check.");
  }

  /* Board */
  if (board.cells.length !== board.width * board.height) add("error", "board", "The board data is corrupted (cell count mismatch).");
  for (const layer of board.layers ?? []) {
    if (layer.z <= 0 || !Number.isInteger(layer.z)) add("error", "board", `Layer ${layer.name} needs a positive integer z.`);
    if (layer.cells.length !== layer.width * layer.height) add("error", "board", `Layer ${layer.name} has a cell count mismatch.`);
  }
  if (new Set((board.layers ?? []).map((layer) => layer.z)).size !== (board.layers ?? []).length) add("error", "board", "Two board layers share the same z coordinate.");
  const portalLinks: [Coord, Coord][] = [];
  for (const cell of allCells) {
    if (!cell.enabled || cell.tile !== "portal") continue;
    if (!cell.portalTarget) add("error", "board", `Portal on ${squareName(cell)} has no destination.`, `${cell.x},${cell.y}`);
    else if (!isPlayable(board, cell.portalTarget)) add("error", "board", `Portal on ${squareName(cell)} leads to ${squareName(cell.portalTarget)}, which is not playable.`, `${cell.x},${cell.y}`);
    else portalLinks.push([cell, cell.portalTarget]);
  }
  if (board.cells.filter((cell) => cell.enabled && cell.tile === "teleport").length === 1) {
    add("warning", "board", "Only one teleport tile exists — teleporting needs at least two.");
  }
  const regions = findBoardRegions(board);
  if (regions.length > 1) {
    // Portals and teleport tiles join regions.
    const regionOf = new Map<string, number>();
    regions.forEach((region, index) => region.forEach((coord) => regionOf.set(`${coord.x},${coord.y}`, index)));
    const parent = regions.map((_, index) => index);
    const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index])));
    const join = (a: Coord, b: Coord) => {
      const ra = regionOf.get(`${a.x},${a.y}`);
      const rb = regionOf.get(`${b.x},${b.y}`);
      if (ra !== undefined && rb !== undefined) parent[find(ra)] = find(rb);
    };
    portalLinks.forEach(([a, b]) => join(a, b));
    const teleports = board.cells.filter((cell) => cell.enabled && cell.tile === "teleport");
    teleports.slice(1).forEach((cell) => join(teleports[0], cell));
    const groups = new Set(regions.map((_, index) => find(index)));
    if (groups.size > 1) add("warning", "board", `The board has ${groups.size} disconnected sections — only leaping pieces can cross the gaps.`);
  }
  if (!board.cells.some((cell) => isPlayable(board, cell))) add("error", "board", "The board has no playable cells.");

  /* Events */
  const checkPiece = (id: PieceTypeId | undefined, eventId: string, eventName: string) => {
    if (id && !pieceIds.has(id)) add("error", "events", `“${eventName}” references a deleted piece type (${id}).`, eventId);
  };
  const checkTeam = (ref: string | undefined, eventId: string, eventName: string) => {
    if (ref && !["actor", "target", "opponentOfActor", "any"].includes(ref) && !teamIds.has(ref)) add("error", "events", `“${eventName}” references a missing team (${ref}).`, eventId);
  };
  const checkSquare = (square: Coord | undefined, eventId: string, eventName: string) => {
    if (square && !getCell(board, square)) add("error", "events", `“${eventName}” references a square outside the board.`, eventId);
  };
  for (const event of variant.events) {
    if (!event.enabled) continue;
    const { trigger } = event;
    checkPiece(trigger.pieceType, event.id, event.name);
    checkTeam(trigger.team, event.id, event.name);
    checkSquare(trigger.square, event.id, event.name);
    for (const condition of event.conditions) {
      checkPiece(condition.pieceType, event.id, event.name);
      checkTeam(condition.team, event.id, event.name);
    }
    const actions = [...event.actions, ...event.elseActions];
    if (!actions.length) add("info", "events", `“${event.name}” has no actions.`, event.id);
    for (const action of actions) {
      checkPiece(action.pieceType, event.id, event.name);
      checkPiece(action.toPieceType, event.id, event.name);
      checkTeam(action.team, event.id, event.name);
      if ((action.at ?? "square") === "square") checkSquare(action.square, event.id, event.name);
      if (["spawnPiece", "changeTile", "disableTile", "enableTile"].includes(action.type) && (action.at ?? "square") === "square" && !action.square) {
        add("error", "events", `“${event.name}”: ${action.type} needs a square.`, event.id);
      }
      if (["transformPiece", "changePieceRule"].includes(action.type) && !action.toPieceType) add("error", "events", `“${event.name}”: choose the piece type to change into.`, event.id);
    }
    const types = actions.map((action) => action.type);
    const reenters = (trigger.type === "pieceEnterSquare" || trigger.type === "tileEntered") && types.some((type) => type === "movePiece" || type === "teleportPiece");
    const turnLoop = (trigger.type === "turnStart" || trigger.type === "turnEnd") && !event.once && types.some((type) => type === "addTurn" || type === "skipTurn");
    if (reenters) add("warning", "events", `Infinite event loop may exist: “${event.name}” moves pieces onto squares that can re-trigger it (a loop guard will stop it).`, event.id);
    if (turnLoop) add("warning", "events", `“${event.name}” grants or skips turns every turn — a team may never get to move.`, event.id);
    if (trigger.type === "afterTurnNumber" && !trigger.turn) add("error", "events", `“${event.name}” needs a turn number.`, event.id);
  }

  return issues;
}

export function issueCounts(issues: ValidationIssue[]) {
  return {
    error: issues.filter((issue) => issue.severity === "error").length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
    info: issues.filter((issue) => issue.severity === "info").length,
  };
}
