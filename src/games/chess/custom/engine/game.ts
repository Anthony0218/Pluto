import { coordKey3D, getCell, inBounds, isPlayable, sameCoord, squareName } from "./board.ts";
import { createRuntime, eliminateTeam, finishGame, fireTrigger, onlyRoyalsRemain, pushMessage, runScheduled } from "./events.ts";
import { generateCandidates, isSquareAttacked, type MoveCandidate } from "./movement.ts";
import {
  activeTeams,
  createPosition,
  getDefinition,
  isFarRank,
  isRoyal,
  opponentsOf,
  pieceAt,
  ruleEnabled,
  teamName,
  type Position,
} from "./position.ts";
import { evaluateVictory } from "./victory.ts";
import type {
  Coord,
  GameState,
  GameVariant,
  Move,
  PieceInstance,
  PositionSetup,
  TeamId,
} from "./types.ts";

/* ------------------------------------------------------------- Creation */

export function createGameState(variant: GameVariant, setup: PositionSetup = variant.setup, seed = 20261001): GameState {
  const teams = new Set(variant.teams.map((team) => team.id));
  const taken = new Set<string>();
  const pieces: PieceInstance[] = [];
  let nextId = 1;
  for (const placed of setup.pieces) {
    const key = `${placed.x},${placed.y},${placed.z ?? 0}`;
    if (taken.has(key) || !teams.has(placed.team) || !getDefinition(variant, placed.type) || !isPlayable(variant.board, placed)) continue;
    taken.add(key);
    pieces.push({ id: `p${nextId++}`, type: placed.type, team: placed.team, x: placed.x, y: placed.y, z: placed.z ?? 0, moveCount: placed.moved ? 1 : 0, origin: { x: placed.x, y: placed.y, z: placed.z ?? 0 } });
  }
  const initialCounts: GameState["initialCounts"] = {};
  for (const team of variant.teams) initialCounts[team.id] = {};
  for (const piece of pieces) initialCounts[piece.team][piece.type] = (initialCounts[piece.team][piece.type] ?? 0) + 1;

  const firstTeam = teams.has(setup.startingTeam) ? setup.startingTeam : variant.teams[0]?.id ?? "white";
  const state: GameState = {
    pieces,
    board: structuredClone(variant.board),
    turn: firstTeam,
    ply: 0,
    turnNumber: Math.max(1, setup.turnNumber || 1),
    result: null,
    enPassant: null,
    royalMode: variant.settings.royalMode,
    suddenDeath: false,
    ruleOverrides: {},
    extraTurns: {},
    skipTurns: {},
    eliminated: [],
    scheduled: [],
    firedOnce: [],
    captured: [],
    messages: [],
    effects: [],
    fired: [],
    nextId,
    seed,
    initialCounts,
  };
  const rt = createRuntime(variant, state);
  fireTrigger(rt, { type: "gameStart", context: { actor: firstTeam } });
  fireTrigger(rt, { type: "turnStart", context: { actor: firstTeam } });
  evaluateVictory(variant, state);
  resolveTurnStart(variant, state);
  return state;
}

/* -------------------------------------------------------------- Helpers */

function unit(delta: Coord): Coord | null {
  if (delta.z) return null;
  const ax = Math.abs(delta.x);
  const ay = Math.abs(delta.y);
  if (!(delta.x === 0 || delta.y === 0 || ax === ay) || (ax === 0 && ay === 0)) return null;
  return { x: Math.sign(delta.x), y: Math.sign(delta.y) };
}

function isFreeFor(position: Position, coord: Coord, mover: PieceInstance, captureIds: string[]) {
  if (!isPlayable(position.state.board, coord)) return false;
  const occupant = pieceAt(position, coord);
  return !occupant || occupant.id === mover.id || captureIds.includes(occupant.id);
}

/** Final square after ice slides and portals. */
function resolveLanding(position: Position, mover: PieceInstance, to: Coord, path: Coord[], captureIds: string[]) {
  let at = to;
  const route = path.slice();
  const direction = unit({ x: to.x - mover.x, y: to.y - mover.y, z: (to.z ?? 0) - (mover.z ?? 0) });
  if (direction) {
    for (let guard = 0; guard < 32 && getCell(position.state.board, at)?.tile === "ice"; guard++) {
      const next = { x: at.x + direction.x, y: at.y + direction.y, z: at.z ?? 0 };
      const cell = getCell(position.state.board, next);
      if (!cell || !isFreeFor(position, next, mover, captureIds)) break;
      if (cell.tile === "oneWay" && cell.direction && cell.direction.x * direction.x + cell.direction.y * direction.y <= 0) break;
      at = next;
      route.push(next);
    }
  }
  const cell = getCell(position.state.board, at);
  if (cell?.tile === "portal" && cell.portalTarget && inBounds(position.state.board, cell.portalTarget) && isFreeFor(position, cell.portalTarget, mover, captureIds)) {
    at = { ...cell.portalTarget };
    route.push(at);
  }
  return { landing: at, path: route };
}

function promotionOptions(position: Position, mover: PieceInstance, landing: Coord) {
  const def = position.defs.get(mover.type);
  const rule = def?.promotion;
  if (!rule || !rule.options.length) return [];
  const cell = getCell(position.state.board, landing);
  const onTile = cell?.tile === "promotion" && (!cell.team || cell.team === mover.team);
  const onRank = isFarRank(position.variant, position.state, mover.team, landing);
  const eligible = rule.zone === "tiles" ? onTile : rule.zone === "farRank" ? onRank : onTile || onRank;
  return eligible ? rule.options.filter((option) => position.defs.has(option)) : [];
}

function candidateToMoves(position: Position, mover: PieceInstance, candidate: MoveCandidate): Move[] {
  const { landing, path } = resolveLanding(position, mover, candidate.to, candidate.path, candidate.captureIds);
  const base: Move = {
    pieceId: mover.id,
    from: { x: mover.x, y: mover.y, z: mover.z ?? 0 },
    to: candidate.to,
    landing: sameCoord(landing, candidate.to) ? undefined : landing,
    captureIds: candidate.captureIds,
    source: candidate.source,
    ruleId: candidate.ruleId,
    offset: { x: candidate.to.x - mover.x, y: candidate.to.y - mover.y, z: (candidate.to.z ?? 0) - (mover.z ?? 0) },
    path,
  };
  const options = promotionOptions(position, mover, landing);
  return options.length ? options.map((promotion) => ({ ...base, promotion })) : [base];
}

function castlingMoves(position: Position, mover: PieceInstance): Move[] {
  const { variant, state } = position;
  const def = position.defs.get(mover.type);
  if (!def?.abilities.includes("castling") || !ruleEnabled(variant, "castling") || mover.moveCount > 0 || (mover.z ?? 0) !== 0) return [];
  const forward = variant.teams.find((team) => team.id === mover.team)?.forward ?? { x: 0, y: 1 };
  const right = { x: forward.y, y: -forward.x };
  const checkRules = state.royalMode === "checkmate";
  if (checkRules && isAttackedByOpponents(position, mover, mover.team)) return [];
  const moves: Move[] = [];
  for (const dir of [1, -1]) {
    const step = { x: right.x * dir, y: right.y * dir };
    for (let k = 1; k < 16; k++) {
      const square = { x: mover.x + step.x * k, y: mover.y + step.y * k };
      if (!isPlayable(state.board, square)) break;
      const occupant = pieceAt(position, square);
      if (!occupant) continue;
      const partnerDef = position.defs.get(occupant.type);
      if (occupant.team !== mover.team || !partnerDef?.abilities.includes("castlePartner") || occupant.moveCount > 0 || k < 3) break;
      const kingTo = { x: mover.x + step.x * 2, y: mover.y + step.y * 2 };
      const partnerTo = { x: mover.x + step.x, y: mover.y + step.y };
      if (checkRules && [partnerTo, kingTo].some((square) => isAttackedByOpponents(position, square, mover.team))) break;
      moves.push({
        pieceId: mover.id,
        from: { x: mover.x, y: mover.y },
        to: kingTo,
        captureIds: [],
        source: "castle",
        ruleId: "castling",
        offset: { x: step.x * 2, y: step.y * 2 },
        castle: { partnerId: occupant.id, partnerTo },
        path: [{ x: mover.x, y: mover.y }, partnerTo, kingTo],
      });
      break;
    }
  }
  return moves;
}

function isAttackedByOpponents(position: Position, coord: Coord, defender: TeamId) {
  return opponentsOf(position.variant, position.state, defender).some((team) => isSquareAttacked(position, coord, team, defender));
}

/** Piece placement after a move, without events — used for legality checks. */
function movePieces(state: GameState, move: Move): PieceInstance[] {
  const landing = move.landing ?? move.to;
  return state.pieces
    .filter((piece) => !move.captureIds.includes(piece.id))
    .map((piece) => {
      if (piece.id === move.pieceId) return { ...piece, x: landing.x, y: landing.y, z: landing.z ?? 0, type: move.promotion ?? piece.type, moveCount: piece.moveCount + 1 };
      if (move.castle && piece.id === move.castle.partnerId) return { ...piece, ...move.castle.partnerTo, moveCount: piece.moveCount + 1 };
      return piece;
    });
}

/** Royal pieces of `team` that are attacked in `state`. */
export function attackedRoyals(variant: GameVariant, state: GameState, team: TeamId): PieceInstance[] {
  const position = createPosition(variant, state);
  return state.pieces.filter((piece) => piece.team === team && isRoyal(variant, piece) && isAttackedByOpponents(position, piece, team));
}

function royalsExposed(variant: GameVariant, state: GameState, team: TeamId) {
  const royals = state.pieces.filter((piece) => piece.team === team && isRoyal(variant, piece));
  if (!royals.length) return false;
  const attacked = attackedRoyals(variant, state, team).length;
  return variant.settings.royalScope === "last" ? attacked === royals.length : attacked > 0;
}

export function isInCheck(variant: GameVariant, state: GameState, team: TeamId = state.turn) {
  return state.royalMode === "checkmate" && royalsExposed(variant, state, team);
}

/* ----------------------------------------------------------- Legal moves */

function pseudoMoves(variant: GameVariant, state: GameState, team: TeamId): Move[] {
  const position = createPosition(variant, state);
  const moves: Move[] = [];
  for (const piece of state.pieces) {
    if (piece.team !== team) continue;
    for (const candidate of generateCandidates(position, piece)) moves.push(...candidateToMoves(position, piece, candidate));
    moves.push(...castlingMoves(position, piece));
  }
  return moves;
}

function isSafe(variant: GameVariant, state: GameState, move: Move, team: TeamId) {
  if (state.royalMode !== "checkmate") return true;
  return !royalsExposed(variant, { ...state, pieces: movePieces(state, move) }, team);
}

/**
 * Legal moves for the team to move (or `asTeam`, for previews). Check rules,
 * forced capture and every piece/tile rule are applied here.
 */
export function getLegalMoves(variant: GameVariant, state: GameState, options: { pieceId?: string; asTeam?: TeamId; capturesOnly?: boolean } = {}): Move[] {
  if (state.result) return [];
  const team = options.asTeam ?? state.turn;
  let moves = pseudoMoves(variant, state, team);
  // Captures-only (search quiescence) skips legality checks for quiet moves it would discard.
  if (options.capturesOnly) moves = moves.filter((move) => move.captureIds.length || move.promotion);
  moves = moves.filter((move) => isSafe(variant, state, move, team));
  if (ruleEnabled(variant, "forcedCapture") && moves.some((move) => move.captureIds.length)) moves = moves.filter((move) => move.captureIds.length);
  return options.pieceId ? moves.filter((move) => move.pieceId === options.pieceId) : moves;
}

function hasAnyLegalMove(variant: GameVariant, state: GameState, team: TeamId) {
  const position = createPosition(variant, state);
  for (const piece of state.pieces) {
    if (piece.team !== team) continue;
    for (const candidate of generateCandidates(position, piece)) {
      for (const move of candidateToMoves(position, piece, candidate)) if (isSafe(variant, state, move, team)) return true;
    }
    if (castlingMoves(position, piece).length) return true;
  }
  return false;
}

/* ------------------------------------------------------------- Turn flow */

/**
 * Checks the team about to move. Two-team games end on checkmate or
 * stalemate; with three or more teams a mated (or emptied) team is knocked out
 * and a stalemated team passes, so the remaining teams play on.
 */
function resolveTurnStart(variant: GameVariant, state: GameState, passes = 0) {
  if (state.result) return;
  const multi = activeTeams(variant, state).length > 2;
  const continueWithNext = (nextPasses: number) => {
    if (state.result) return;
    advanceTurn(variant, state, state.turn);
    resolveTurnStart(variant, state, nextPasses);
  };
  const hasPieces = state.pieces.some((piece) => piece.team === state.turn);
  if (!hasPieces && multi) {
    eliminateTeam(variant, state, state.turn, `${teamName(variant, state.turn)} has no pieces left`);
    return continueWithNext(0);
  }
  if (!hasPieces || !hasAnyLegalMove(variant, state, state.turn)) {
    const mated = isInCheck(variant, state, state.turn);
    const checkmateWins = variant.victoryConditions.some((condition) => condition.type === "checkmate" && condition.enabled);
    if (mated && checkmateWins) {
      if (multi) {
        eliminateTeam(variant, state, state.turn, `${teamName(variant, state.turn)} is checkmated`);
        return continueWithNext(0);
      }
      const winners = opponentsOf(variant, state, state.turn);
      finishGame(state, winners, `Checkmate — ${winners.map((team) => teamName(variant, team)).join(" & ")} wins`);
      return;
    }
    if (variant.settings.noLegalMoves === "lose") {
      eliminateTeam(variant, state, state.turn, `${teamName(variant, state.turn)} has no legal moves and loses`);
      return continueWithNext(0);
    }
    if (multi && passes < activeTeams(variant, state).length - 1) {
      pushMessage(state, `${teamName(variant, state.turn)} has no legal moves and passes`);
      return continueWithNext(passes + 1);
    }
    finishGame(state, [], `${mated ? "Checkmate is not a win condition" : "Stalemate"} — ${teamName(variant, state.turn)} has no legal moves`, true);
    return;
  }
  if (variant.settings.maxPlies > 0 && state.ply >= variant.settings.maxPlies) {
    finishGame(state, [], `Draw — turn limit of ${variant.settings.maxPlies} moves reached`, true);
  }
}

function advanceTurn(variant: GameVariant, state: GameState, actor: TeamId) {
  const order = variant.teams.map((team) => team.id);
  state.ply += 1;
  if ((state.extraTurns[actor] ?? 0) > 0 && !state.eliminated.includes(actor)) {
    state.extraTurns[actor] -= 1;
    pushMessage(state, `${teamName(variant, actor)} takes an extra turn`);
    state.turn = actor;
    return;
  }
  let index = order.indexOf(actor);
  let next: TeamId | null = null;
  let wrapped = false;
  for (let guard = 0; guard < order.length * 3; guard++) {
    index = (index + 1) % order.length;
    if (index === 0) wrapped = true;
    const candidate = order[index];
    if (state.eliminated.includes(candidate)) continue;
    if ((state.skipTurns[candidate] ?? 0) > 0) {
      state.skipTurns[candidate] -= 1;
      pushMessage(state, `${teamName(variant, candidate)} skips a turn`);
      continue;
    }
    next = candidate;
    break;
  }
  state.turn = next ?? activeTeams(variant, state)[0] ?? actor;
  if (wrapped) state.turnNumber += 1;
}

function pieceCounts(state: GameState) {
  const byTeam: Record<TeamId, number> = {};
  for (const piece of state.pieces) byTeam[piece.team] = (byTeam[piece.team] ?? 0) + 1;
  return { total: state.pieces.length, byTeam };
}

/**
 * Copy everything a move can mutate. The board, initial counts and scheduled
 * contexts are never mutated in place (events replace the board immutably),
 * so they are shared — this keeps search fast.
 */
function cloneState(previous: GameState): GameState {
  return {
    ...previous,
    pieces: previous.pieces.map((piece) => ({ ...piece })),
    result: previous.result ? { ...previous.result, winners: previous.result.winners.slice() } : null,
    enPassant: previous.enPassant ? { ...previous.enPassant } : null,
    ruleOverrides: { ...previous.ruleOverrides },
    extraTurns: { ...previous.extraTurns },
    skipTurns: { ...previous.skipTurns },
    eliminated: previous.eliminated.slice(),
    scheduled: previous.scheduled.slice(),
    firedOnce: previous.firedOnce.slice(),
    captured: previous.captured.slice(),
    messages: previous.messages.slice(),
    effects: [],
    fired: [],
  };
}

/** Apply a legal move and run every consequence: tiles, events, victory. Pure: returns a new state. */
export function applyMove(variant: GameVariant, previous: GameState, move: Move): GameState {
  const state = cloneState(previous);
  const rt = createRuntime(variant, state);
  const mover = state.pieces.find((piece) => piece.id === move.pieceId);
  if (!mover || state.result) return previous;

  const actor = mover.team;
  const from = { x: mover.x, y: mover.y, z: mover.z ?? 0 };
  const movedType = mover.type;
  const countsBefore = pieceCounts(state);
  const royalsOnlyBefore = onlyRoyalsRemain(variant, state);
  const suddenDeathBefore = state.suddenDeath;

  const captured = state.pieces.filter((piece) => move.captureIds.includes(piece.id));
  state.pieces = state.pieces.filter((piece) => !move.captureIds.includes(piece.id));
  for (const victim of captured) {
    state.captured.push({ type: victim.type, team: victim.team, by: actor });
    state.effects.push({ kind: isRoyal(variant, victim) ? "royalCapture" : "capture", at: { x: victim.x, y: victim.y, z: victim.z ?? 0 } });
  }

  const landing = move.landing ?? move.to;
  mover.x = landing.x;
  mover.y = landing.y;
  mover.z = landing.z ?? 0;
  mover.moveCount += 1;
  if (move.landing) state.effects.push({ kind: "portal", at: move.to, to: move.landing });
  if (move.castle) {
    const partner = state.pieces.find((piece) => piece.id === move.castle!.partnerId);
    if (partner) {
      partner.x = move.castle.partnerTo.x;
      partner.y = move.castle.partnerTo.y;
      partner.moveCount += 1;
    }
  }
  if (move.promotion) {
    mover.type = move.promotion;
    state.effects.push({ kind: "promotion", at: landing });
    pushMessage(state, `${getDefinition(variant, movedType)?.name} promotes to ${getDefinition(variant, move.promotion)?.name}`, "info");
  }

  // En passant window: a first-move straight double step leaves a capturable square behind.
  state.enPassant = null;
  const rule = getDefinition(variant, movedType)?.movement.find((entry) => entry.id === move.ruleId);
  const step = unit(move.offset);
  if (rule?.firstMoveOnly && step && Math.max(Math.abs(move.offset.x), Math.abs(move.offset.y)) === 2 && !move.captureIds.length) {
    state.enPassant = { square: { x: from.x + step.x, y: from.y + step.y, z: from.z }, pieceId: mover.id };
  }

  // Explosive pieces take the capturer and every adjacent non-royal piece with them.
  for (const victim of captured) {
    if (!getDefinition(variant, victim.type)?.abilities.includes("explosive")) continue;
    const blast = state.pieces.filter((piece) => Math.abs(piece.x - victim.x) <= 1 && Math.abs(piece.y - victim.y) <= 1 && (piece.z ?? 0) === (victim.z ?? 0) && !isRoyal(variant, piece));
    state.pieces = state.pieces.filter((piece) => !blast.includes(piece));
    for (const piece of blast) state.captured.push({ type: piece.type, team: piece.team, by: actor });
    state.effects.push({ kind: "shake", at: { x: victim.x, y: victim.y } });
    pushMessage(state, `${getDefinition(variant, victim.type)?.name} exploded on ${squareName(victim)}`);
  }

  // Events
  const context = { actor, pieceId: mover.id, pieceType: movedType, square: landing, origin: mover.origin };
  fireTrigger(rt, { type: "pieceLeaveSquare", context, square: from });
  fireTrigger(rt, { type: "pieceMove", context });
  fireTrigger(rt, { type: "pieceEnterSquare", context, square: landing });
  const tile = getCell(state.board, landing)?.tile;
  if (tile && tile !== "normal") fireTrigger(rt, { type: "tileEntered", context, square: landing, tile });
  for (const victim of captured) {
    const captureContext = {
      actor,
      target: victim.team,
      pieceId: mover.id,
      pieceType: movedType,
      capturedId: victim.id,
      capturedType: victim.type,
      square: { x: victim.x, y: victim.y },
      origin: victim.origin,
    };
    fireTrigger(rt, { type: "pieceCapture", context: captureContext });
    fireTrigger(rt, { type: "pieceCaptured", context: captureContext });
    if (getDefinition(variant, victim.type)?.royal) fireTrigger(rt, { type: "kingCaptured", context: captureContext });
  }
  if (move.promotion) fireTrigger(rt, { type: "promotion", context: { ...context, pieceType: move.promotion } });

  if (suddenDeathBefore && captured.length) finishGame(state, [actor], `Sudden death — ${teamName(variant, actor)} made the next capture`);

  // Danger tiles: a piece still standing on one after a full turn is lost.
  for (const piece of state.pieces.filter((entry) => entry.team === actor)) {
    if (getCell(state.board, piece)?.tile === "danger") piece.dangerPlies = (piece.dangerPlies ?? 0) + 1;
    else piece.dangerPlies = 0;
  }
  const doomed = state.pieces.filter((piece) => (piece.dangerPlies ?? 0) >= 2);
  if (doomed.length) {
    state.pieces = state.pieces.filter((piece) => !doomed.includes(piece));
    for (const piece of doomed) {
      state.effects.push({ kind: "capture", at: { x: piece.x, y: piece.y, z: piece.z ?? 0 } });
      pushMessage(state, `${getDefinition(variant, piece.type)?.name} was lost on a danger tile`);
    }
  }

  fireTrigger(rt, { type: "turnEnd", context: { actor } });

  // Count-based triggers fire when the count changes to the configured value.
  const countsAfter = pieceCounts(state);
  if (countsAfter.total !== countsBefore.total) fireTrigger(rt, { type: "pieceCountEquals", context: { actor }, count: countsAfter.total });
  for (const team of variant.teams) {
    const now = countsAfter.byTeam[team.id] ?? 0;
    if (now !== (countsBefore.byTeam[team.id] ?? 0)) fireTrigger(rt, { type: "teamPieceCountEquals", context: { actor, target: team.id }, team: team.id, count: now });
  }
  if (!royalsOnlyBefore && onlyRoyalsRemain(variant, state)) fireTrigger(rt, { type: "onlyKingsRemain", context: { actor } });

  evaluateVictory(variant, state);
  if (!state.result) {
    const turnBefore = state.turnNumber;
    advanceTurn(variant, state, actor);
    runScheduled(rt);
    if (state.turnNumber !== turnBefore) fireTrigger(rt, { type: "afterTurnNumber", context: { actor: state.turn } });
    fireTrigger(rt, { type: "turnStart", context: { actor: state.turn } });
    evaluateVictory(variant, state);
    resolveTurnStart(variant, state);
  }
  if (rt.guardTripped) pushMessage(state, "An event chain was stopped by the loop guard", "warning");
  return state;
}

/* ------------------------------------------------------------- Notation */

export function moveNotation(variant: GameVariant, before: GameState, move: Move, after?: GameState) {
  const mover = before.pieces.find((piece) => piece.id === move.pieceId);
  const def = mover ? getDefinition(variant, mover.type) : undefined;
  let text: string;
  if (move.castle) {
    text = sideDistance(before, move) <= 3 ? "O-O" : "O-O-O";
  } else {
    const symbol = def?.symbol ?? "";
    const capture = move.captureIds.length ? "x" : "";
    const prefix = symbol || (capture ? squareName(move.from)[0] : "");
    text = `${prefix}${capture}${squareName(move.to)}`;
    if (move.landing) text += `↯${squareName(move.landing)}`;
    if (move.promotion) text += `=${getDefinition(variant, move.promotion)?.symbol || getDefinition(variant, move.promotion)?.name || move.promotion}`;
    if ((move.from.z ?? 0) !== (move.to.z ?? 0) || (move.to.z ?? 0) !== 0 || (move.landing?.z ?? move.to.z ?? 0) !== (move.to.z ?? 0)) {
      const layerName = (coord: Coord) => `L${(coord.z ?? 0) + 1}:${squareName(coord)}`;
      text = `${symbol || def?.name || "Piece"} ${layerName(move.from)}${capture ? "×" : "→"}${layerName(move.to)}${move.landing ? `↯${layerName(move.landing)}` : ""}${move.promotion ? `=${getDefinition(variant, move.promotion)?.name ?? move.promotion}` : ""}`;
    }
  }
  if (after?.result && !after.result.draw && after.result.reason.startsWith("Checkmate")) text += "#";
  else if (after && !after.result && isInCheck(variant, after, after.turn)) text += "+";
  return text;
}

function sideDistance(state: GameState, move: Move) {
  const partner = state.pieces.find((piece) => piece.id === move.castle?.partnerId);
  return partner ? Math.abs(partner.x - move.from.x) + Math.abs(partner.y - move.from.y) : 0;
}

/* -------------------------------------------------------------- Debugger */

export interface MoveExplanation {
  to: Coord;
  kind: "move" | "capture" | "special";
  legal: boolean;
  reason: string;
  ruleId: string;
}

/** Every square the piece's rules touch, with a reason it is or is not legal. */
export function explainPiece(variant: GameVariant, state: GameState, pieceId: string): MoveExplanation[] {
  const piece = state.pieces.find((entry) => entry.id === pieceId);
  if (!piece) return [];
  const position = createPosition(variant, state);
  const legal = getLegalMoves(variant, { ...state, result: null }, { pieceId, asTeam: piece.team });
  const legalKeys = new Set(legal.map((move) => coordKey3D(move.to)));
  const forced = ruleEnabled(variant, "forcedCapture");
  const entries: MoveExplanation[] = generateCandidates(position, piece, { explain: true }).map((candidate) => {
    const key = coordKey3D(candidate.to);
    const special = candidate.source === "enPassant" || candidate.source === "teleport";
    if (candidate.legal && !legalKeys.has(key)) {
      return {
        to: candidate.to,
        kind: candidate.kind,
        legal: false,
        reason: forced && !candidate.captureIds.length ? "forced capture is on and a capture is available" : "would leave your king in check",
        ruleId: candidate.ruleId,
      };
    }
    const landing = legal.find((move) => sameCoord(move.to, candidate.to) && move.landing)?.landing;
    return {
      to: candidate.to,
      kind: special || landing ? "special" : candidate.kind,
      legal: candidate.legal,
      reason: landing ? `${candidate.reason}, then ${getCell(state.board, candidate.to)?.tile === "ice" ? "slides on ice" : "teleports"} to ${squareName(landing)}` : candidate.reason,
      ruleId: candidate.ruleId,
    };
  });
  for (const move of legal) {
    if (move.castle) entries.push({ to: move.to, kind: "special", legal: true, reason: "castling with an unmoved partner", ruleId: "castling" });
  }
  return entries;
}
