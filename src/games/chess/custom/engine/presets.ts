import { createRectangularBoard, parseSquare, setTile, updateCell } from "./board.ts";
import { nextRandom } from "./position.ts";
import { arrangeArmies, createCrossBoard, SIDE_FORWARD } from "./teams.ts";
import {
  VARIANT_SCHEMA_VERSION,
  type BoardDefinition,
  type Coord,
  type GameEvent,
  type GameRule,
  type GameSettings,
  type GameVariant,
  type KingCaptureSettings,
  type KingConsequence,
  type MovementRule,
  type PieceDefinition,
  type PlacedPiece,
  type RoyalMode,
  type TeamDefinition,
  type VictoryCondition,
  type VictoryType,
} from "./types.ts";

let idCounter = 0;
/** Unique, readable ids for user-created entities. */
export function createId(prefix: string) {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/* ------------------------------------------------------ Movement helpers */

export const ORTHOGONAL: Coord[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
export const DIAGONAL: Coord[] = [{ x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 }];
export const ALL_DIRECTIONS: Coord[] = [...ORTHOGONAL, ...DIAGONAL];

/** All 8 symmetric offsets of an (a, b) leap, e.g. (2, 1) → knight. */
export function leaperOffsets(a: number, b: number): Coord[] {
  const out: Coord[] = [];
  for (const [x, y] of [[a, b], [b, a]]) {
    for (const sx of [1, -1]) for (const sy of [1, -1]) {
      const offset = { x: x * sx, y: y * sy };
      if (!out.some((entry) => entry.x === offset.x && entry.y === offset.y)) out.push(offset);
    }
  }
  return out;
}

const leap = (id: string, offsets: Coord[], extra: Partial<MovementRule> = {}): MovementRule => ({
  id,
  kind: "leap",
  offsets,
  canJump: true,
  relativeTo: "board",
  ...extra,
});
const slide = (id: string, offsets: Coord[], extra: Partial<MovementRule> = {}): MovementRule => ({
  id,
  kind: "slide",
  offsets,
  relativeTo: "board",
  ...extra,
});

/** Starting points for the movement editor's "Add pattern" menu. */
export const MOVEMENT_TEMPLATES: { id: string; label: string; build: () => MovementRule }[] = [
  { id: "knight", label: "Knight leap (2×1)", build: () => leap(createId("rule"), leaperOffsets(2, 1)) },
  { id: "camel", label: "Long leap (3×1)", build: () => leap(createId("rule"), leaperOffsets(3, 1)) },
  { id: "rook", label: "Orthogonal slide", build: () => slide(createId("rule"), ORTHOGONAL) },
  { id: "bishop", label: "Diagonal slide", build: () => slide(createId("rule"), DIAGONAL) },
  { id: "queen", label: "Any-direction slide", build: () => slide(createId("rule"), ALL_DIRECTIONS) },
  { id: "king", label: "One step, any direction", build: () => leap(createId("rule"), ALL_DIRECTIONS) },
  { id: "forward", label: "One step forward", build: () => leap(createId("rule"), [{ x: 0, y: 1 }], { relativeTo: "team", canJump: false }) },
  { id: "sideways", label: "One step sideways", build: () => leap(createId("rule"), [{ x: 1, y: 0 }, { x: -1, y: 0 }]) },
  { id: "teleport", label: "Teleport between teleport tiles", build: () => ({ id: createId("rule"), kind: "teleport", offsets: [], relativeTo: "board" }) },
  { id: "empty", label: "Empty leap pattern", build: () => leap(createId("rule"), []) },
];

/* -------------------------------------------------------------- Pieces */

const PAWN_PROMOTIONS = ["queen", "rook", "bishop", "knight"];

export function createStandardPieces(): PieceDefinition[] {
  return [
    {
      id: "pawn",
      name: "Pawn",
      symbol: "",
      icon: "♟",
      model: { base: "pawn" },
      description: "Moves one square forward, two on its first move, and captures diagonally forward.",
      value: 1,
      royal: false,
      movement: [
        leap("pawn-step", [{ x: 0, y: 1 }], { relativeTo: "team", canJump: false }),
        leap("pawn-double", [{ x: 0, y: 2 }], { relativeTo: "team", canJump: false, firstMoveOnly: true }),
      ],
      capture: [leap("pawn-capture", [{ x: 1, y: 1 }, { x: -1, y: 1 }], { relativeTo: "team" })],
      captureSameAsMove: false,
      abilities: ["enPassant"],
      promotion: { zone: "both", options: PAWN_PROMOTIONS },
      spawnAmount: 8,
    },
    {
      id: "knight",
      name: "Knight",
      symbol: "N",
      icon: "♞",
      model: { base: "knight" },
      description: "Leaps in an L-shape and can jump over other pieces.",
      value: 3,
      royal: false,
      movement: [leap("knight-leap", leaperOffsets(2, 1))],
      capture: [],
      captureSameAsMove: true,
      abilities: [],
      spawnAmount: 2,
    },
    {
      id: "bishop",
      name: "Bishop",
      symbol: "B",
      icon: "♝",
      model: { base: "bishop" },
      description: "Slides any distance diagonally.",
      value: 3,
      royal: false,
      movement: [slide("bishop-slide", DIAGONAL)],
      capture: [],
      captureSameAsMove: true,
      abilities: [],
      spawnAmount: 2,
    },
    {
      id: "rook",
      name: "Rook",
      symbol: "R",
      icon: "♜",
      model: { base: "rook" },
      description: "Slides any distance orthogonally and castles with the king.",
      value: 5,
      royal: false,
      movement: [slide("rook-slide", ORTHOGONAL)],
      capture: [],
      captureSameAsMove: true,
      abilities: ["castlePartner"],
      spawnAmount: 2,
    },
    {
      id: "queen",
      name: "Queen",
      symbol: "Q",
      icon: "♛",
      model: { base: "queen" },
      description: "Slides any distance in all eight directions.",
      value: 9,
      royal: false,
      movement: [slide("queen-slide", ALL_DIRECTIONS)],
      capture: [],
      captureSameAsMove: true,
      abilities: [],
      spawnAmount: 1,
    },
    {
      id: "king",
      name: "King",
      symbol: "K",
      icon: "♚",
      model: { base: "king" },
      description: "The royal piece. Steps one square in any direction.",
      value: 100,
      royal: true,
      movement: [leap("king-step", ALL_DIRECTIONS)],
      capture: [],
      captureSameAsMove: true,
      abilities: ["castling"],
      spawnAmount: 1,
    },
  ];
}

/** Example custom pieces — built with exactly the same rule system as the standard set. */
export function createExamplePieces(): PieceDefinition[] {
  return [
    {
      id: "wizard",
      name: "Wizard",
      symbol: "W",
      icon: "🧙",
      model: { base: "bishop", accent: "orb", tint: "#38bdf8" },
      description: "Steps one square diagonally or leaps 3×1 like a camel. Colour-bound, slippery and hard to pin.",
      value: 4,
      royal: false,
      movement: [leap("wizard-step", DIAGONAL), leap("wizard-camel", leaperOffsets(3, 1))],
      capture: [],
      captureSameAsMove: true,
      abilities: [],
      spawnAmount: 1,
    },
    {
      id: "cannon",
      name: "Cannon",
      symbol: "C",
      icon: "💣",
      model: { base: "rook", accent: "spike", tint: "#f97316" },
      description: "Moves like a rook but can only capture by jumping over exactly one piece (the screen).",
      value: 4.5,
      royal: false,
      movement: [slide("cannon-move", ORTHOGONAL)],
      capture: [slide("cannon-fire", ORTHOGONAL, { requiresScreen: true })],
      captureSameAsMove: false,
      abilities: [],
      spawnAmount: 1,
    },
    {
      id: "dragon",
      name: "Dragon",
      symbol: "D",
      icon: "🐉",
      model: { base: "knight", accent: "flame", tint: "#f59e0b" },
      description: "Flies up to three squares in any direction or leaps like a knight.",
      value: 8,
      royal: false,
      movement: [slide("dragon-fly", ALL_DIRECTIONS, { maxDistance: 3 }), leap("dragon-leap", leaperOffsets(2, 1))],
      capture: [],
      captureSameAsMove: true,
      abilities: [],
      spawnAmount: 1,
    },
    {
      id: "guardian",
      name: "Guardian",
      symbol: "G",
      icon: "🛡️",
      model: { base: "rook", accent: "shield", tint: "#fbbf24", scale: 0.9 },
      description: "Cannot be captured. Steps one square in any direction but only captures orthogonally.",
      value: 3,
      royal: false,
      movement: [leap("guardian-step", ALL_DIRECTIONS)],
      capture: [leap("guardian-strike", ORTHOGONAL)],
      captureSameAsMove: false,
      abilities: ["invulnerable"],
      spawnAmount: 1,
    },
    {
      id: "bomber",
      name: "Bomber",
      symbol: "X",
      icon: "💥",
      model: { base: "pawn", accent: "spike", tint: "#ef4444" },
      description: "Steps one square orthogonally. When captured it explodes, removing the capturer and adjacent non-royal pieces.",
      value: 2,
      royal: false,
      movement: [leap("bomber-step", ORTHOGONAL)],
      capture: [],
      captureSameAsMove: true,
      abilities: ["explosive"],
      spawnAmount: 1,
    },
  ];
}

/* --------------------------------------------------------------- Teams */

export function createDefaultTeams(): TeamDefinition[] {
  return [
    { id: "white", name: "White", color: "#f5efe1", forward: { x: 0, y: 1 }, modelSet: "light" },
    { id: "black", name: "Black", color: "#1f1d1b", forward: { x: 0, y: -1 }, modelSet: "dark" },
  ];
}

/* ------------------------------------------------------- Rules & victory */

export function createDefaultRules(): GameRule[] {
  return [
    { id: "rule-castling", type: "castling", enabled: true },
    { id: "rule-en-passant", type: "enPassant", enabled: true },
    { id: "rule-forced-capture", type: "forcedCapture", enabled: false },
    { id: "rule-friendly-fire", type: "friendlyFire", enabled: false },
  ];
}

export function victory(type: VictoryType, extra: Partial<VictoryCondition> = {}): VictoryCondition {
  return { id: createId("win"), type, enabled: true, team: "any", ...extra };
}

export function createDefaultSettings(overrides: Partial<GameSettings> = {}): GameSettings {
  return {
    royalMode: "checkmate",
    kingCapture: { consequence: "instantDefeat", turns: 3, successor: "queen" },
    royalScope: "every",
    noLegalMoves: "draw",
    maxPlies: 400,
    victoryMode: "any",
    ...overrides,
  };
}

/* -------------------------------------------------- King capture presets */

export const KING_CONSEQUENCE_INFO: Record<KingConsequence, { label: string; description: string }> = {
  instantDefeat: { label: "Instant Defeat", description: "A team that loses its last king loses the game." },
  instantVictory: { label: "Capturing Team Wins", description: "Whoever captures a king wins immediately." },
  continue: { label: "Continue Playing", description: "The game goes on without the king." },
  loseAfterTurns: { label: "Lose After X Turns", description: "The kingless team loses if it has no king after X turns." },
  respawn: { label: "Respawn King", description: "The king returns to its starting square after X turns." },
  successor: { label: "Promote a Successor", description: "The chosen piece (or the most valuable one) becomes the new king." },
  suddenDeath: { label: "Sudden Death", description: "The next capture by anyone wins the game." },
  customEvent: { label: "Trigger Custom Event", description: "Creates an empty King Captured event for you to design." },
  removeRequirement: { label: "Remove King Requirement", description: "Kings stop mattering — play on without royal rules." },
};

function royalTypeOf(pieces: PieceDefinition[]) {
  return pieces.find((piece) => piece.royal)?.id ?? "king";
}

/** Compile a king-capture consequence into ordinary events (editable afterwards). */
export function kingConsequenceEvents(settings: KingCaptureSettings, pieces: PieceDefinition[], teamCount = 2): GameEvent[] {
  const base = (name: string, extra: Partial<GameEvent>): GameEvent => ({
    id: createId("event"),
    name,
    enabled: true,
    trigger: { type: "kingCaptured", team: "any" },
    delayTurns: 0,
    conditionMode: "all",
    conditions: [],
    actions: [],
    elseActions: [],
    once: false,
    source: "kingConsequence",
    ...extra,
  });
  const noRoyalsLeft = { id: createId("cond"), type: "teamRoyalCount" as const, team: "target" as const, op: "eq" as const, value: 0 };
  const plies = Math.max(1, settings.turns) * Math.max(1, teamCount);
  const royal = royalTypeOf(pieces);
  switch (settings.consequence) {
    case "instantDefeat":
      return [base("King captured → defeat", { conditions: [noRoyalsLeft], actions: [{ id: createId("act"), type: "declareLoser", team: "target" }] })];
    case "instantVictory":
      return [base("King captured → capturer wins", { actions: [{ id: createId("act"), type: "declareWinner", team: "actor" }] })];
    case "continue":
      return [base("King captured → play on", { actions: [{ id: createId("act"), type: "displayMessage", message: "A king has fallen — the battle continues!" }] })];
    case "loseAfterTurns":
      return [
        base("King captured → warning", { actions: [{ id: createId("act"), type: "displayMessage", message: `Without a king, a team falls in ${settings.turns} turns.` }] }),
        base(`No king after ${settings.turns} turns → defeat`, {
          delayTurns: plies,
          conditions: [noRoyalsLeft],
          actions: [{ id: createId("act"), type: "declareLoser", team: "target" }],
        }),
      ];
    case "respawn":
      return [
        base("King captured → respawn", {
          delayTurns: plies,
          actions: [
            { id: createId("act"), type: "spawnPiece", team: "target", at: "originSquare" },
            { id: createId("act"), type: "displayMessage", message: "The king has returned!" },
          ],
        }),
      ];
    case "successor":
      return [
        base("King captured → crown a successor", {
          conditions: [{ id: createId("cond"), type: "teamHasPiece", team: "target", pieceType: settings.successor }],
          actions: [{ id: createId("act"), type: "transformPiece", target: "firstOfType", pieceType: settings.successor, team: "target", toPieceType: royal }],
          elseActions: [{ id: createId("act"), type: "transformPiece", target: "highestValue", team: "target", toPieceType: royal }],
        }),
      ];
    case "suddenDeath":
      return [base("King captured → sudden death", { once: true, actions: [{ id: createId("act"), type: "suddenDeath" }] })];
    case "customEvent":
      return [base("King captured (custom)", { actions: [{ id: createId("act"), type: "displayMessage", message: "A king was captured!" }] })];
    case "removeRequirement":
      return [
        base("King captured → kings no longer matter", {
          once: true,
          actions: [{ id: createId("act"), type: "setRoyalMode", royalMode: "none" }],
        }),
      ];
  }
}

/** Replace the generated king-capture events, keeping every user-made event. */
export function withKingConsequence(variant: GameVariant, kingCapture: KingCaptureSettings): GameVariant {
  return {
    ...variant,
    settings: { ...variant.settings, kingCapture },
    events: [...variant.events.filter((event) => event.source !== "kingConsequence"), ...kingConsequenceEvents(kingCapture, variant.pieces, variant.teams.length)],
  };
}

export type KingBehaviorId = "standard" | "capturable" | "none" | "multiple" | "respawning" | "successor";

export const KING_BEHAVIORS: {
  id: KingBehaviorId;
  label: string;
  description: string;
  royalMode: RoyalMode;
  royalScope: GameSettings["royalScope"];
  consequence: KingConsequence;
}[] = [
  { id: "standard", label: "Standard Checkmate", description: "Kings cannot move into check. The game ends on checkmate.", royalMode: "checkmate", royalScope: "every", consequence: "instantDefeat" },
  { id: "capturable", label: "Capturable King", description: "Kings may walk into danger. The game ends when a king is actually captured.", royalMode: "capture", royalScope: "every", consequence: "instantDefeat" },
  { id: "none", label: "No King Requirement", description: "Kings are ordinary pieces. Play continues without any king.", royalMode: "none", royalScope: "every", consequence: "continue" },
  { id: "multiple", label: "Multiple Kings", description: "Several royal pieces per team. You lose when the last one falls.", royalMode: "capture", royalScope: "last", consequence: "instantDefeat" },
  { id: "respawning", label: "Respawning King", description: "A captured king returns to its starting square after a delay.", royalMode: "capture", royalScope: "every", consequence: "respawn" },
  { id: "successor", label: "Successor King", description: "When the king dies, the queen (or best remaining piece) takes the crown.", royalMode: "capture", royalScope: "every", consequence: "successor" },
];

export function matchKingBehavior(settings: GameSettings): KingBehaviorId | null {
  return (
    KING_BEHAVIORS.find(
      (behavior) => behavior.royalMode === settings.royalMode && behavior.royalScope === settings.royalScope && behavior.consequence === settings.kingCapture.consequence,
    )?.id ?? null
  );
}

export function applyKingBehavior(variant: GameVariant, id: KingBehaviorId): GameVariant {
  const behavior = KING_BEHAVIORS.find((entry) => entry.id === id);
  if (!behavior) return variant;
  const next = withKingConsequence(
    { ...variant, settings: { ...variant.settings, royalMode: behavior.royalMode, royalScope: behavior.royalScope } },
    { ...variant.settings.kingCapture, consequence: behavior.consequence },
  );
  // Checkmate only makes sense with check rules; royal capture is the alternative.
  const wantsCheckmate = behavior.royalMode === "checkmate";
  const hasCheckmate = next.victoryConditions.some((condition) => condition.type === "checkmate");
  let conditions = next.victoryConditions.map((condition) => (condition.type === "checkmate" ? { ...condition, enabled: wantsCheckmate } : condition));
  if (wantsCheckmate && !hasCheckmate) conditions = [victory("checkmate"), ...conditions];
  if (behavior.royalMode === "none" && !conditions.some((condition) => condition.enabled && condition.type !== "eventOutcome" && condition.type !== "checkmate")) {
    conditions = [...conditions, victory("captureAll")];
  }
  return { ...next, victoryConditions: conditions };
}

/* -------------------------------------------------------------- Setups */

const BACK_RANK = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

export function mirroredSetup(width: number, height: number, backRank: string[], pawnType = "pawn"): PlacedPiece[] {
  const pieces: PlacedPiece[] = [];
  const offset = Math.floor((width - backRank.length) / 2);
  backRank.forEach((type, index) => {
    pieces.push({ type, team: "white", x: index + offset, y: 0 });
    pieces.push({ type, team: "black", x: index + offset, y: height - 1 });
  });
  for (let x = 0; x < width; x++) {
    pieces.push({ type: pawnType, team: "white", x, y: 1 });
    pieces.push({ type: pawnType, team: "black", x, y: height - 2 });
  }
  return pieces;
}

function at(square: string): Coord {
  const coord = parseSquare(square);
  if (!coord) throw new Error(`Bad square ${square}`);
  return coord;
}

function linkPortals(board: BoardDefinition, a: string, b: string) {
  let next = setTile(board, at(a), "portal");
  next = setTile(next, at(b), "portal");
  next = updateCell(next, at(a), { portalTarget: at(b) });
  return updateCell(next, at(b), { portalTarget: at(a) });
}

/* ------------------------------------------------------------- Presets */

export type PresetId =
  | "standard"
  | "king-capture"
  | "no-check"
  | "large-board"
  | "portal"
  | "terrain"
  | "random-army"
  | "four-kingdoms"
  | "3d-chess"
  | "three-level"
  | "tower"
  | "portal-layers"
  | "3d-sandbox"
  | "sandbox";

export const PRESETS: { id: PresetId; name: string; tagline: string; icon: string; tags: string[] }[] = [
  { id: "standard", name: "Standard Chess", tagline: "The classic rules, expressed in the custom engine.", icon: "♔", tags: ["8×8", "Checkmate"] },
  { id: "3d-chess", name: "3D Chess", tagline: "The former 3D Chess game, editable in Chess Custom.", icon: "♜", tags: ["3D view", "Classic rules"] },
  { id: "three-level", name: "Three-Level Chess", tagline: "Three stacked boards with vertical rook movement.", icon: "▤", tags: ["3 layers", "Vertical moves"] },
  { id: "tower", name: "Tower Chess", tagline: "Four boards that narrow toward the top.", icon: "♖", tags: ["4 layers", "8×8 to 2×2"] },
  { id: "portal-layers", name: "Portal Layers", tagline: "Boards connected by cross-layer portals.", icon: "◎", tags: ["Portals", "2 layers"] },
  { id: "3d-sandbox", name: "3D Sandbox", tagline: "An empty three-layer space for your rules.", icon: "✦", tags: ["Blank", "3 layers"] },
  { id: "king-capture", name: "King Capture Chess", tagline: "No check. Take the king to win.", icon: "♚", tags: ["Capturable king"] },
  { id: "no-check", name: "No Check Chess", tagline: "Kings are ordinary pieces — wipe out the army.", icon: "⚔", tags: ["No royals", "Capture all"] },
  { id: "large-board", name: "Large Board Chess", tagline: "10×10 with Wizards and Cannons.", icon: "▦", tags: ["10×10", "Custom pieces"] },
  { id: "portal", name: "Portal Chess", tagline: "Two linked portal pairs bend the centre.", icon: "◎", tags: ["Portals"] },
  { id: "terrain", name: "Terrain Chess", tagline: "Ice, danger, walls and goal tiles.", icon: "⛰", tags: ["Special tiles", "Goal"] },
  { id: "random-army", name: "Random Army", tagline: "Mirrored random back ranks from an expanded roster.", icon: "🎲", tags: ["Random", "Custom pieces"] },
  { id: "four-kingdoms", name: "Four Kingdoms", tagline: "Four armies on a cross-shaped board. Lose your king and you're out.", icon: "✠", tags: ["4 teams", "14×14", "Last standing"] },
  { id: "sandbox", name: "Blank Sandbox", tagline: "Empty board, full piece library. Build anything.", icon: "✎", tags: ["Empty"] },
];

function baseVariant(name: string, presetId: PresetId): GameVariant {
  const now = new Date().toISOString();
  const pieces = createStandardPieces();
  const settings = createDefaultSettings();
  return {
    schemaVersion: VARIANT_SCHEMA_VERSION,
    id: createId("variant"),
    name,
    description: "",
    version: 1,
    createdAt: now,
    updatedAt: now,
    presetId,
    teams: createDefaultTeams(),
    board: createRectangularBoard(8, 8),
    pieces,
    rules: createDefaultRules(),
    events: kingConsequenceEvents(settings.kingCapture, pieces),
    victoryConditions: [victory("checkmate"), victory("eventOutcome")],
    settings,
    setup: { pieces: mirroredSetup(8, 8, BACK_RANK), startingTeam: "white", turnNumber: 1 },
    theme: { boardTheme: "classic-wood", pieceSkin: "classic" },
  };
}

export function createVariantFromPreset(id: PresetId, seed = Date.now()): GameVariant {
  const preset = PRESETS.find((entry) => entry.id === id) ?? PRESETS[0];
  let variant = baseVariant(preset.name, preset.id);
  variant.description = preset.tagline;
  switch (preset.id) {
    case "standard":
      break;
    case "3d-chess":
      variant.theme = { boardTheme: "marble", pieceSkin: "classic" };
      break;
    case "three-level":
    case "tower":
    case "portal-layers":
    case "3d-sandbox": {
      const sizes = preset.id === "tower" ? [6, 4, 2] : preset.id === "portal-layers" ? [8] : [8, 8];
      variant.board.layers = sizes.map((size, index) => ({ ...createRectangularBoard(size, size), id: `layer-${index + 1}`, name: `Layer ${index + 2}`, z: index + 1 }));
      variant.rules = variant.rules.map((rule) => rule.type === "castling" ? { ...rule, enabled: false } : rule);
      if (preset.id === "portal-layers") {
        variant.board = updateCell(setTile(variant.board, { x: 3, y: 3, z: 0 }, "portal"), { x: 3, y: 3, z: 0 }, { portalTarget: { x: 3, y: 3, z: 1 } });
        variant.board = updateCell(setTile(variant.board, { x: 3, y: 3, z: 1 }, "portal"), { x: 3, y: 3, z: 1 }, { portalTarget: { x: 3, y: 3, z: 0 } });
      } else {
        const rook = variant.pieces.find((piece) => piece.id === "rook")!;
        rook.movement.push(slide("rook-vertical", [{ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }]));
        const knight = variant.pieces.find((piece) => piece.id === "knight")!;
        knight.movement.push(leap("knight-layer", leaperOffsets(2, 1).flatMap((offset) => [{ ...offset, z: 1 }, { ...offset, z: -1 }])));
      }
      if (preset.id === "3d-sandbox") {
        variant.setup.pieces = [];
        variant = applyKingBehavior(variant, "none");
        variant.victoryConditions = [victory("captureAll"), victory("eventOutcome")];
      }
      variant.theme = { boardTheme: "marble", pieceSkin: "obsidian" };
      break;
    }
    case "king-capture":
      variant = applyKingBehavior(variant, "capturable");
      variant.theme = { boardTheme: "royal-gold", pieceSkin: "classic" };
      break;
    case "no-check":
      variant = applyKingBehavior(variant, "none");
      variant.victoryConditions = [victory("captureAll"), victory("eventOutcome")];
      variant.theme = { boardTheme: "minimal-dark", pieceSkin: "obsidian" };
      break;
    case "large-board": {
      variant.pieces = [...variant.pieces, ...createExamplePieces().filter((piece) => piece.id === "wizard" || piece.id === "cannon")];
      const pawn = variant.pieces.find((piece) => piece.id === "pawn");
      if (pawn?.promotion) pawn.promotion = { ...pawn.promotion, options: [...PAWN_PROMOTIONS, "wizard", "cannon"] };
      variant.board = createRectangularBoard(10, 10);
      variant.setup.pieces = mirroredSetup(10, 10, ["cannon", "rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook", "wizard"]);
      variant.rules = variant.rules.map((rule) => (rule.type === "castling" ? { ...rule, enabled: false } : rule));
      variant.theme = { boardTheme: "marble", pieceSkin: "marble" };
      break;
    }
    case "portal":
      variant.board = linkPortals(linkPortals(variant.board, "c4", "f5"), "f4", "c5");
      variant.theme = { boardTheme: "cyber", pieceSkin: "neon" };
      break;
    case "terrain": {
      let board = variant.board;
      for (const square of ["d4", "e4", "d5", "e5"]) board = setTile(board, at(square), "ice");
      for (const square of ["b4", "g5"]) board = setTile(board, at(square), "blocked");
      for (const square of ["a5", "h4"]) board = setTile(board, at(square), "danger");
      board = updateCell(setTile(board, at("d8"), "goal"), at("d8"), { team: "white" });
      board = updateCell(setTile(board, at("e1"), "goal"), at("e1"), { team: "black" });
      variant.board = board;
      variant.victoryConditions = [victory("checkmate"), victory("reachZone", { pieceType: "knight" }), victory("eventOutcome")];
      variant.description = "Ice slides pieces onward, danger tiles consume loiterers, walls block the flanks — and a knight on the enemy's goal tile wins.";
      variant.theme = { boardTheme: "fantasy-castle", pieceSkin: "marble" };
      break;
    }
    case "random-army": {
      variant.pieces = [...variant.pieces, ...createExamplePieces()];
      const pawn = variant.pieces.find((piece) => piece.id === "pawn");
      if (pawn?.promotion) pawn.promotion = { ...pawn.promotion, options: [...PAWN_PROMOTIONS, "dragon", "wizard"] };
      const roster = ["queen", "rook", "rook", "bishop", "knight", "wizard", "cannon", "dragon", "guardian", "bomber"];
      let rng = seed >>> 0;
      const rank: string[] = [];
      for (let slot = 0; slot < 7; slot++) {
        const [roll, next] = nextRandom(rng);
        rng = next;
        rank.push(roster[Math.floor(roll * roster.length)]);
      }
      const [kingRoll] = nextRandom(rng);
      rank.splice(1 + Math.floor(kingRoll * 6), 0, "king");
      variant.setup.pieces = mirroredSetup(8, 8, rank);
      variant.rules = variant.rules.map((rule) => (rule.type === "castling" ? { ...rule, enabled: false } : rule));
      variant.theme = { boardTheme: "obsidian", pieceSkin: "obsidian" };
      break;
    }
    case "four-kingdoms": {
      variant.teams = [
        { id: "white", name: "White", color: "#f5efe1", forward: SIDE_FORWARD.bottom, modelSet: "light" },
        { id: "red", name: "Red", color: "#dc2626", forward: SIDE_FORWARD.left, modelSet: "light" },
        { id: "black", name: "Black", color: "#1f1d1b", forward: SIDE_FORWARD.top, modelSet: "dark" },
        { id: "blue", name: "Blue", color: "#2563eb", forward: SIDE_FORWARD.right, modelSet: "dark" },
      ];
      variant.board = createCrossBoard(14, 3);
      variant = applyKingBehavior(variant, "capturable");
      variant.victoryConditions = [victory("lastTeamStanding"), victory("eventOutcome")];
      variant.rules = variant.rules.map((rule) => (rule.type === "castling" ? { ...rule, enabled: false } : rule));
      variant.setup = { pieces: arrangeArmies(variant), startingTeam: "white", turnNumber: 1 };
      variant.settings = { ...variant.settings, maxPlies: 600 };
      variant.theme = { boardTheme: "royal-gold", pieceSkin: "gilded" };
      break;
    }
    case "sandbox":
      variant.pieces = [...variant.pieces, ...createExamplePieces()];
      variant = applyKingBehavior(variant, "none");
      variant.victoryConditions = [victory("captureAll"), victory("eventOutcome")];
      variant.setup = { pieces: [], startingTeam: "white", turnNumber: 1 };
      variant.theme = { boardTheme: "sky-fortress", pieceSkin: "classic" };
      break;
  }
  return variant;
}
