import { getCell, sameCoord } from "./board.ts";
import { eliminateTeam } from "./events.ts";
import { activeTeams, getDefinition, isRoyal, opponentsOf, teamName } from "./position.ts";
import type { GameState, GameVariant, TeamId, VictoryCondition, VictoryType } from "./types.ts";

/** Conditions resolved elsewhere: checkmate at turn start, event outcomes by actions. */
const IMMEDIATE_TYPES: VictoryType[] = ["checkmate", "eventOutcome"];

export const VICTORY_LABELS: Record<VictoryType, string> = {
  checkmate: "Checkmate",
  royalCaptured: "King captured",
  captureAll: "Capture all pieces",
  captureSpecific: "Capture a specific piece",
  reachSquare: "Reach target square",
  reachZone: "Reach a goal tile",
  surviveTurns: "Survive X turns",
  controlSquares: "Hold X goal tiles",
  piecesRemaining: "Reduce opponents to X pieces",
  eliminateType: "Eliminate a piece type",
  lastTeamStanding: "Last team standing",
  eventOutcome: "Custom event outcome",
};

function appliesTo(condition: VictoryCondition, team: TeamId) {
  return !condition.team || condition.team === "any" || condition.team === team;
}

/** Does `team` currently satisfy `condition`? Returns a reason when it does. */
export function conditionMet(variant: GameVariant, state: GameState, condition: VictoryCondition, team: TeamId): string | null {
  if (!appliesTo(condition, team)) return null;
  const opponents = opponentsOf(variant, state, team);
  const mine = state.pieces.filter((piece) => piece.team === team);
  const theirs = state.pieces.filter((piece) => opponents.includes(piece.team));
  const typeName = getDefinition(variant, condition.pieceType ?? "")?.name ?? condition.pieceType ?? "piece";
  switch (condition.type) {
    case "royalCaptured": {
      const fallen = opponents.find(
        (opponent) =>
          state.captured.some((entry) => entry.team === opponent && entry.by === team && getDefinition(variant, entry.type)?.royal) &&
          !state.pieces.some((piece) => piece.team === opponent && isRoyal(variant, piece)),
      );
      return fallen ? `${teamName(variant, team)} captured the ${teamName(variant, fallen)} king` : null;
    }
    case "captureAll":
      return opponents.length > 0 && theirs.length === 0 ? `${teamName(variant, team)} captured every enemy piece` : null;
    case "captureSpecific":
      return state.captured.some((entry) => entry.by === team && entry.type === condition.pieceType)
        ? `${teamName(variant, team)} captured the enemy ${typeName}`
        : null;
    case "reachSquare":
      return condition.square && mine.some((piece) => sameCoord(piece, condition.square) && (!condition.pieceType || piece.type === condition.pieceType))
        ? `${teamName(variant, team)} reached the target square`
        : null;
    case "reachZone":
      return mine.some((piece) => {
        const cell = getCell(state.board, piece);
        return cell?.tile === "goal" && (!cell.team || cell.team === team) && (!condition.pieceType || piece.type === condition.pieceType);
      })
        ? `${teamName(variant, team)} reached a goal tile`
        : null;
    case "surviveTurns":
      return condition.turns && state.turnNumber > condition.turns ? `${teamName(variant, team)} survived ${condition.turns} turns` : null;
    case "controlSquares": {
      const held = mine.filter((piece) => {
        const cell = getCell(state.board, piece);
        return cell?.tile === "goal" && (!cell.team || cell.team === team);
      }).length;
      return held >= (condition.count ?? 1) ? `${teamName(variant, team)} holds ${held} goal tiles` : null;
    }
    case "piecesRemaining":
      return opponents.length > 0 && opponents.every((opponent) => state.pieces.filter((piece) => piece.team === opponent).length <= (condition.count ?? 1))
        ? `${teamName(variant, team)} reduced the enemy to ${condition.count ?? 1} pieces`
        : null;
    case "eliminateType": {
      const type = condition.pieceType;
      if (!type) return null;
      const hadAny = opponents.some((opponent) => (state.initialCounts[opponent]?.[type] ?? 0) > 0);
      return hadAny && !theirs.some((piece) => piece.type === type) ? `${teamName(variant, team)} eliminated every enemy ${typeName}` : null;
    }
    case "lastTeamStanding": {
      const alive = activeTeams(variant, state).filter((id) => state.pieces.some((piece) => piece.team === id));
      return alive.length === 1 && alive[0] === team ? `${teamName(variant, team)} is the last team standing` : null;
    }
    case "checkmate":
    case "eventOutcome":
      return null;
  }
}

/** Evaluate positional victory conditions after a ply. Mutates `state.result`. */
export function evaluateVictory(variant: GameVariant, state: GameState) {
  if (state.result) return;
  // With three or more teams, losing the last king knocks a team out instead of crowning the capturer.
  if (activeTeams(variant, state).length > 2 && variant.victoryConditions.some((condition) => condition.enabled && condition.type === "royalCaptured")) {
    for (const team of activeTeams(variant, state)) {
      const lostKing = state.captured.some((entry) => entry.team === team && getDefinition(variant, entry.type)?.royal);
      if (lostKing && !state.pieces.some((piece) => piece.team === team && isRoyal(variant, piece))) eliminateTeam(variant, state, team, `${teamName(variant, team)} lost its king`);
      if (state.result) return;
    }
  }
  const conditions = variant.victoryConditions.filter((condition) => condition.enabled && !IMMEDIATE_TYPES.includes(condition.type));
  if (!conditions.length) return;
  const winners: { team: TeamId; reason: string }[] = [];
  for (const team of activeTeams(variant, state)) {
    const relevant = conditions.filter((condition) => appliesTo(condition, team));
    if (!relevant.length) continue;
    const reasons = relevant.map((condition) => conditionMet(variant, state, condition, team));
    if (variant.settings.victoryMode === "all") {
      if (reasons.every(Boolean)) winners.push({ team, reason: reasons.join(" · ") });
    } else {
      const reason = reasons.find(Boolean);
      if (reason) winners.push({ team, reason });
    }
  }
  if (!winners.length) return;
  const draw = winners.length > 1;
  state.result = {
    winners: winners.map((entry) => entry.team),
    draw,
    reason: draw ? `Draw — ${winners.map((entry) => entry.reason).join("; ")}` : winners[0].reason,
  };
  state.messages.push({ ply: state.ply, text: state.result.reason, kind: "victory" });
}
