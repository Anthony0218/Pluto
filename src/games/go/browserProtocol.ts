import type { GoState } from "./rules.ts";
import { applyGoMove, createInitialGoState, isLegalGoMove } from "./rules.ts";
import type { KataGoAnalyzeRequest, KataGoAnalysisPayload } from "../../vendor/browser-katago/engine/katago/types.ts";
import { situationalKey } from "../../vendor/browser-katago/utils/superko.ts";
import { goCoordinate, parseGoCoordinate, type GoAnalysis } from "./analysis.ts";

export function browserGoRequest(state: GoState, id: number, modelUrl: string): KataGoAnalyzeRequest {
  const board = (position: GoState) => Array.from({ length: position.boardSize }, (_, row) => position.board.slice(row * position.boardSize, (row + 1) * position.boardSize));
  const frames = [createInitialGoState(state.boardSize, state.komi)];
  for (const move of state.moveHistory) {
    if (move.type !== "resign") frames.push(applyGoMove(frames.at(-1)!, move));
  }
  const current = frames.at(-1)!;
  return {
    type: "katago:analyze", id, modelUrl, backend: "webgpu", analysisGroup: "interactive",
    board: board(current), previousBoard: frames.length > 1 ? board(frames.at(-2)!) : undefined,
    previousPreviousBoard: frames.length > 2 ? board(frames.at(-3)!) : undefined,
    currentPlayer: current.currentPlayer,
    moveHistory: current.moveHistory.slice(-5).map(move => ({ player: move.player, x: move.type === "place" ? move.col : -1, y: move.type === "place" ? move.row : -1 })),
    repetitionHistory: frames.map(frame => situationalKey(board(frame), frame.currentPlayer)),
    komi: state.komi, rules: "chinese", visits: 64, maxTimeMs: 3000,
    topK: 5, analysisPvLen: 12, batchSize: 1, maxChildren: 24, ownershipMode: "none", reuseTree: false,
    nnRandomize: false, conservativePass: true,
  };
}
export function browserGoResult(state: GoState, data: KataGoAnalysisPayload): GoAnalysis {
  if (!Number.isFinite(data.rootScoreLead) || !Number.isFinite(data.rootWinRate)) throw new Error("Invalid browser engine evaluation");
  return {
    turnNumber: state.moveHistory.length,
    rootInfo: { scoreLead: data.rootScoreLead, winrate: data.rootWinRate, visits: data.rootVisits },
    moveInfos: data.moves.flatMap(line => {
      const move = line.x < 0 || line.y < 0 ? { type: "pass" as const } : { type: "place" as const, row: line.y, col: line.x };
      if (!isLegalGoMove(state, move)) return [];
      let position = state;
      const pv: string[] = [];
      for (const coordinate of line.pv) {
        try {
          const next = parseGoCoordinate(coordinate, state.boardSize);
          if (!isLegalGoMove(position, next)) break;
          pv.push(coordinate); position = applyGoMove(position, next);
        } catch { break; }
      }
      return [{ move: goCoordinate(move, state.boardSize), order: line.order, scoreLead: line.scoreLead, winrate: line.winRate, visits: line.visits, pv }];
    }),
  };
}
