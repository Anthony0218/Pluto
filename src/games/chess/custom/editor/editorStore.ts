import { resizeBoard } from "../engine/board.ts";
import { arrangeArmies } from "../engine/teams.ts";
import type {
  BoardDefinition,
  Coord,
  GameEvent,
  GameRuleType,
  GameVariant,
  PieceDefinition,
  PositionSetup,
  TeamDefinition,
  VictoryCondition,
} from "../engine/types.ts";

/** Everything undo/redo covers: the variant and the test position being edited. */
export interface EditorDocument {
  variant: GameVariant;
  testSetup: PositionSetup;
}

export interface EditorHistory {
  past: EditorDocument[];
  present: EditorDocument;
  future: EditorDocument[];
  /** Consecutive edits with the same key (typing in one field) merge into one step. */
  lastKey?: string;
  lastAt?: number;
}

export const HISTORY_LIMIT = 80;
const COALESCE_MS = 1200;

type Recipe<T> = (value: T) => T;

export type EditorAction =
  | { type: "load"; variant: GameVariant }
  | { type: "update"; recipe: Recipe<GameVariant>; coalesceKey?: string }
  | { type: "addPieceDefinition"; piece: PieceDefinition }
  | { type: "updatePieceDefinition"; id: string; recipe: Recipe<PieceDefinition>; coalesceKey?: string }
  | { type: "removePieceDefinition"; id: string }
  | { type: "updateBoard"; board: BoardDefinition; coalesceKey?: string }
  | { type: "resizeBoard"; width: number; height: number; coalesceKey?: string }
  | { type: "deleteLayer"; z: number }
  | { type: "swapLayers"; a: number; b: number }
  | { type: "addRule"; ruleType: GameRuleType }
  | { type: "removeRule"; ruleType: GameRuleType }
  | { type: "addEvent"; event: GameEvent }
  | { type: "updateEvent"; id: string; recipe: Recipe<GameEvent>; coalesceKey?: string }
  | { type: "removeEvent"; id: string }
  | { type: "setVictoryConditions"; conditions: VictoryCondition[]; coalesceKey?: string }
  | { type: "setTestSetup"; setup: PositionSetup; coalesceKey?: string }
  | { type: "addTeam"; team: TeamDefinition }
  | { type: "updateTeam"; id: string; patch: Partial<TeamDefinition>; coalesceKey?: string }
  | { type: "removeTeam"; id: string }
  | { type: "moveTeam"; id: string; delta: -1 | 1 }
  | { type: "arrangeArmies" }
  | { type: "replaceIdentity"; variant: GameVariant }
  /** Swap in new gameplay content (e.g. a base preset) as one undoable step; the test position follows. */
  | { type: "replaceContent"; variant: GameVariant }
  | { type: "undo" }
  | { type: "redo" };

export function createHistory(variant: GameVariant): EditorHistory {
  return { past: [], present: { variant, testSetup: structuredClone(variant.setup) }, future: [] };
}

function commit(history: EditorHistory, next: EditorDocument, coalesceKey?: string): EditorHistory {
  if (next === history.present) return history;
  const now = Date.now();
  if (coalesceKey && coalesceKey === history.lastKey && history.lastAt && now - history.lastAt < COALESCE_MS) {
    return { ...history, present: next, future: [], lastAt: now };
  }
  const past = [...history.past, history.present];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  return { past, present: next, future: [], lastKey: coalesceKey, lastAt: now };
}

const withVariant = (history: EditorHistory, recipe: Recipe<GameVariant>, coalesceKey?: string) =>
  commit(history, { ...history.present, variant: recipe(history.present.variant) }, coalesceKey);

export function editorReducer(history: EditorHistory, action: EditorAction): EditorHistory {
  switch (action.type) {
    case "load":
      return createHistory(action.variant);
    case "update":
      return withVariant(history, action.recipe, action.coalesceKey);
    case "addPieceDefinition":
      return withVariant(history, (variant) => ({ ...variant, pieces: [...variant.pieces, action.piece] }));
    case "updatePieceDefinition":
      return withVariant(
        history,
        (variant) => ({ ...variant, pieces: variant.pieces.map((piece) => (piece.id === action.id ? action.recipe(piece) : piece)) }),
        action.coalesceKey,
      );
    case "removePieceDefinition": {
      // Placements and promotion options go with the piece; events keep their
      // references so validation can point at what needs fixing.
      const strip = (setup: PositionSetup) => ({ ...setup, pieces: setup.pieces.filter((placed) => placed.type !== action.id) });
      const variant = history.present.variant;
      return commit(history, {
        testSetup: strip(history.present.testSetup),
        variant: {
          ...variant,
          setup: strip(variant.setup),
          pieces: variant.pieces
            .filter((piece) => piece.id !== action.id)
            .map((piece) => (piece.promotion ? { ...piece, promotion: { ...piece.promotion, options: piece.promotion.options.filter((option) => option !== action.id) } } : piece)),
        },
      });
    }
    case "updateBoard":
      return withVariant(history, (variant) => ({ ...variant, board: action.board }), action.coalesceKey);
    case "deleteLayer": {
      if (action.z === 0) return history;
      const strip = (setup: PositionSetup) => ({ ...setup, pieces: setup.pieces.filter((piece) => (piece.z ?? 0) !== action.z) });
      const variant = history.present.variant;
      const clean = (cell: BoardDefinition["cells"][number]) => cell.portalTarget?.z === action.z ? { ...cell, tile: "normal" as const, portalTarget: undefined } : cell;
      const board = { ...variant.board, cells: variant.board.cells.map(clean), layers: variant.board.layers?.filter((layer) => layer.z !== action.z).map((layer) => ({ ...layer, cells: layer.cells.map(clean) })) };
      return commit(history, { testSetup: strip(history.present.testSetup), variant: { ...variant, board, setup: strip(variant.setup) } });
    }
    case "swapLayers": {
      const { a, b } = action;
      if (a <= 0 || b <= 0 || a === b) return history;
      const variant = history.present.variant;
      if (!variant.board.layers?.some((layer) => layer.z === a) || !variant.board.layers.some((layer) => layer.z === b)) return history;
      const swap = (z: number) => z === a ? b : z === b ? a : z;
      const coord = (value: Coord): Coord => ({ ...value, z: swap(value.z ?? 0) });
      const cells = (value: BoardDefinition["cells"]) => value.map((cell) => cell.portalTarget ? { ...cell, portalTarget: coord(cell.portalTarget) } : cell);
      const setup = (value: PositionSetup): PositionSetup => ({ ...value, pieces: value.pieces.map((piece) => ({ ...piece, z: swap(piece.z ?? 0) })) });
      const board = { ...variant.board, cells: cells(variant.board.cells), layers: variant.board.layers.map((layer) => ({ ...layer, z: swap(layer.z), cells: cells(layer.cells) })) };
      const events = variant.events.map((event) => ({ ...event, trigger: { ...event.trigger, square: event.trigger.square && coord(event.trigger.square) }, conditions: event.conditions.map((condition) => ({ ...condition, square: condition.square && coord(condition.square) })), actions: event.actions.map((item) => ({ ...item, square: item.square && coord(item.square) })), elseActions: event.elseActions.map((item) => ({ ...item, square: item.square && coord(item.square) })) }));
      const victoryConditions = variant.victoryConditions.map((condition) => ({ ...condition, square: condition.square && coord(condition.square) }));
      return commit(history, { testSetup: setup(history.present.testSetup), variant: { ...variant, board, setup: setup(variant.setup), events, victoryConditions } });
    }
    case "resizeBoard": {
      // Cells stay anchored bottom-left; armies that face down (top side) move with the top edge.
      const variant = history.present.variant;
      const board = resizeBoard(variant.board, action.width, action.height);
      const shift = board.height - variant.board.height;
      const topTeams = new Set(variant.teams.filter((team) => team.forward.y < 0).map((team) => team.id));
      const move = (setup: PositionSetup): PositionSetup => ({
        ...setup,
        pieces: setup.pieces.map((piece) => (topTeams.has(piece.team) ? { ...piece, y: piece.y + shift } : piece)).filter((piece) => piece.x < board.width && piece.y >= 0 && piece.y < board.height),
      });
      return commit(history, { testSetup: move(history.present.testSetup), variant: { ...variant, board, setup: move(variant.setup) } }, action.coalesceKey);
    }
    case "addRule":
    case "removeRule": {
      const enabled = action.type === "addRule";
      return withVariant(history, (variant) => {
        const exists = variant.rules.some((rule) => rule.type === action.ruleType);
        return {
          ...variant,
          rules: exists
            ? variant.rules.map((rule) => (rule.type === action.ruleType ? { ...rule, enabled } : rule))
            : [...variant.rules, { id: `rule-${action.ruleType}`, type: action.ruleType, enabled }],
        };
      });
    }
    case "addEvent":
      return withVariant(history, (variant) => ({ ...variant, events: [...variant.events, action.event] }));
    case "updateEvent":
      return withVariant(
        history,
        (variant) => ({ ...variant, events: variant.events.map((event) => (event.id === action.id ? action.recipe(event) : event)) }),
        action.coalesceKey,
      );
    case "removeEvent":
      return withVariant(history, (variant) => ({ ...variant, events: variant.events.filter((event) => event.id !== action.id) }));
    case "setVictoryConditions":
      return withVariant(history, (variant) => ({ ...variant, victoryConditions: action.conditions }), action.coalesceKey);
    case "setTestSetup":
      return commit(history, { ...history.present, testSetup: action.setup }, action.coalesceKey);
    case "addTeam":
      return withVariant(history, (variant) => ({ ...variant, teams: [...variant.teams, action.team] }));
    case "updateTeam":
      return withVariant(history, (variant) => ({ ...variant, teams: variant.teams.map((team) => (team.id === action.id ? { ...team, ...action.patch, id: team.id } : team)) }), action.coalesceKey);
    case "moveTeam":
      return withVariant(history, (variant) => {
        const index = variant.teams.findIndex((team) => team.id === action.id);
        const target = index + action.delta;
        if (index < 0 || target < 0 || target >= variant.teams.length) return variant;
        const teams = variant.teams.slice();
        [teams[index], teams[target]] = [teams[target], teams[index]];
        return { ...variant, teams };
      });
    case "removeTeam": {
      // Its pieces and team-only restrictions go with it; events keep their
      // references so validation can point at them.
      const variant = history.present.variant;
      if (variant.teams.length <= 2) return history;
      const teams = variant.teams.filter((team) => team.id !== action.id);
      const strip = (setup: PositionSetup): PositionSetup => ({
        ...setup,
        pieces: setup.pieces.filter((piece) => piece.team !== action.id),
        startingTeam: setup.startingTeam === action.id ? teams[0].id : setup.startingTeam,
      });
      return commit(history, {
        testSetup: strip(history.present.testSetup),
        variant: {
          ...variant,
          teams,
          setup: strip(variant.setup),
          board: { ...variant.board, cells: variant.board.cells.map((cell) => (cell.team === action.id ? { ...cell, team: undefined } : cell)) },
          pieces: variant.pieces.map((piece) => (piece.teams?.includes(action.id) ? { ...piece, teams: piece.teams.filter((team) => team !== action.id).length ? piece.teams.filter((team) => team !== action.id) : undefined } : piece)),
          victoryConditions: variant.victoryConditions.map((condition) => (condition.team === action.id ? { ...condition, team: "any" } : condition)),
        },
      });
    }
    case "arrangeArmies": {
      const variant = history.present.variant;
      const pieces = arrangeArmies(variant);
      const setup = { ...variant.setup, pieces };
      return commit(history, { variant: { ...variant, setup }, testSetup: structuredClone(setup) });
    }
    case "replaceIdentity": {
      // Saving changes id/version/timestamps; that is not an undoable edit.
      const { id, version, createdAt, updatedAt, name, remixedFrom, originalVariantId } = action.variant;
      const patch = { id, version, createdAt, updatedAt, name, remixedFrom, originalVariantId };
      const apply = (doc: EditorDocument) => ({ ...doc, variant: { ...doc.variant, ...patch } });
      return { ...history, past: history.past.map(apply), present: apply(history.present), future: history.future.map(apply) };
    }
    case "replaceContent":
      return commit(history, { variant: action.variant, testSetup: structuredClone(action.variant.setup) });
    case "undo": {
      const previous = history.past.at(-1);
      if (!previous) return history;
      return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
    }
    case "redo": {
      const [next, ...rest] = history.future;
      if (!next) return history;
      return { past: [...history.past, history.present], present: next, future: rest };
    }
  }
}
