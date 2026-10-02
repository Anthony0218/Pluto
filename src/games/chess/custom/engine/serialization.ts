import { createRectangularBoard, getCell } from "./board.ts";
import { createDefaultRules, createDefaultSettings, createDefaultTeams, createId } from "./presets.ts";
import { TILE_TYPES, VARIANT_SCHEMA_VERSION, type BoardDefinition, type GameVariant } from "./types.ts";

export interface ImportResult {
  variant: GameVariant | null;
  errors: string[];
  warnings: string[];
}

export function serializeVariant(variant: GameVariant) {
  return JSON.stringify(variant, null, 2);
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Upgrade older documents to the current schema. Each future schema bump adds
 * a step here; v1 is the first published schema, so only legacy (unversioned)
 * documents need defaults filled in.
 */
export function migrateVariant(raw: Record<string, unknown>): { data: Record<string, unknown>; warnings: string[] } {
  const warnings: string[] = [];
  const data = { ...raw };
  if (typeof data.schemaVersion !== "number") {
    warnings.push("No schema version found — treated as version 1.");
    data.schemaVersion = 1;
  }
  if (data.schemaVersion === 1) {
    // v1 positions and offsets implicitly live on the ground board.
    data.schemaVersion = 2;
    warnings.push("Upgraded the single-board variant to the layered v2 schema.");
  }
  if (data.schemaVersion === 2) {
    data.schemaVersion = 3;
    // Missing alliances remain independent; existing games keep their rules.
  }
  return { data, warnings };
}

function repairBoard(input: unknown, errors: string[], warnings: string[], depth = 0): BoardDefinition | null {
  if (!isObject(input)) {
    errors.push("board is missing.");
    return null;
  }
  const width = Number(input.width);
  const height = Number(input.height);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    errors.push("board.width and board.height must be positive integers.");
    return null;
  }
  const board = createRectangularBoard(width, height);
  if (typeof input.name === "string") board.name = input.name;
  if (board.width !== width || board.height !== height) warnings.push(`Board resized to the supported range (${board.width}×${board.height}).`);
  const cells = Array.isArray(input.cells) ? input.cells : [];
  if (cells.length !== width * height) warnings.push("Board cells were incomplete and have been repaired.");
  for (const cell of cells) {
    if (!isObject(cell)) continue;
    const x = Number(cell.x);
    const y = Number(cell.y);
    const target = getCell(board, { x, y });
    if (!target) continue;
    target.enabled = cell.enabled !== false;
    target.tile = TILE_TYPES.includes(cell.tile as (typeof TILE_TYPES)[number]) ? (cell.tile as (typeof TILE_TYPES)[number]) : "normal";
    if (isObject(cell.portalTarget)) target.portalTarget = { x: Number(cell.portalTarget.x), y: Number(cell.portalTarget.y), ...(cell.portalTarget.z === undefined ? {} : { z: Number(cell.portalTarget.z) }) };
    if (typeof cell.team === "string") target.team = cell.team;
    if (isObject(cell.direction)) target.direction = { x: Math.sign(Number(cell.direction.x)), y: Math.sign(Number(cell.direction.y)) };
  }
  if (depth === 0 && Array.isArray(input.layers)) {
    board.layers = [];
    const used = new Set<number>([0]);
    for (const raw of input.layers.slice(0, 7)) {
      if (!isObject(raw) || !Number.isInteger(Number(raw.z)) || Number(raw.z) <= 0 || used.has(Number(raw.z))) {
        errors.push("Each additional board layer needs a unique positive integer z.");
        continue;
      }
      const z = Number(raw.z);
      used.add(z);
      const repaired = repairBoard(raw, errors, warnings, 1);
      if (repaired) board.layers.push({ ...repaired, id: typeof raw.id === "string" ? raw.id : `layer-${z}`, name: typeof raw.name === "string" ? raw.name : `Layer ${z + 1}`, z });
    }
  }
  return board;
}

/**
 * Parse, migrate and structurally validate JSON before it touches the editor.
 * Imports get a fresh id (recording lineage in remixedFrom); stored documents
 * are re-read with `keepIdentity` so their id and history survive.
 */
export function parseVariantJson(text: string, options: { keepIdentity?: boolean } = {}): ImportResult {
  const errors: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { variant: null, errors: [`Not valid JSON: ${(error as Error).message}`], warnings: [] };
  }
  if (!isObject(raw)) return { variant: null, errors: ["Expected a JSON object describing a variant."], warnings: [] };
  const { data, warnings } = migrateVariant(raw);
  if ((data.schemaVersion as number) > VARIANT_SCHEMA_VERSION) {
    errors.push(`This variant was made with a newer schema (v${data.schemaVersion}). This app supports v${VARIANT_SCHEMA_VERSION}.`);
  }
  if (typeof data.name !== "string" || !data.name.trim()) errors.push("name is required.");
  const board = repairBoard(data.board, errors, warnings);
  if (!Array.isArray(data.pieces) || !data.pieces.length) errors.push("pieces must be a non-empty array.");
  else {
    data.pieces.forEach((piece, index) => {
      if (!isObject(piece) || typeof piece.id !== "string" || typeof piece.name !== "string") errors.push(`pieces[${index}] needs an id and a name.`);
      else if (!Array.isArray(piece.movement)) errors.push(`pieces[${index}] (${piece.name}) needs a movement array.`);
    });
  }
  for (const key of ["events", "victoryConditions", "rules"] as const) {
    if (data[key] !== undefined && !Array.isArray(data[key])) errors.push(`${key} must be an array.`);
  }
  if (data.setup !== undefined && (!isObject(data.setup) || !Array.isArray(data.setup.pieces))) errors.push("setup.pieces must be an array.");
  if (errors.length || !board) return { variant: null, errors, warnings };

  const now = new Date().toISOString();
  const keep = options.keepIdentity && typeof data.id === "string";
  const stringOrUndefined = (value: unknown) => (typeof value === "string" ? value : undefined);
  const teams = Array.isArray(data.teams) && data.teams.length >= 2 ? (data.teams as GameVariant["teams"]) : createDefaultTeams();
  for (const team of teams) {
    if (team.alliance !== undefined && (typeof team.alliance !== "string" || !team.alliance.trim() || team.alliance.length > 24)) {
      return { variant: null, errors: ["Alliance must be a non-empty name of at most 24 characters."], warnings };
    }
  }
  const pieces = (data.pieces as GameVariant["pieces"]).map((piece) => ({
    ...piece,
    symbol: piece.symbol ?? "",
    icon: piece.icon || "●",
    model: piece.model ?? { base: "pawn" },
    value: Number(piece.value) || 1,
    royal: Boolean(piece.royal),
    capture: Array.isArray(piece.capture) ? piece.capture : [],
    captureSameAsMove: piece.captureSameAsMove ?? true,
    abilities: Array.isArray(piece.abilities) ? piece.abilities : [],
  }));
  const setup = isObject(data.setup) ? (data.setup as unknown as GameVariant["setup"]) : { pieces: [], startingTeam: teams[0].id, turnNumber: 1 };
  const variant: GameVariant = {
    schemaVersion: VARIANT_SCHEMA_VERSION,
    id: keep ? (data.id as string) : createId("variant"),
    name: String(data.name).slice(0, 80),
    description: stringOrUndefined(data.description) ?? "",
    version: keep ? Number(data.version) || 1 : 1,
    createdAt: keep ? stringOrUndefined(data.createdAt) ?? now : now,
    updatedAt: keep ? stringOrUndefined(data.updatedAt) ?? now : now,
    originalVariantId: stringOrUndefined(data.originalVariantId) ?? (keep ? undefined : stringOrUndefined(data.id)),
    remixedFrom: keep ? stringOrUndefined(data.remixedFrom) : stringOrUndefined(data.id),
    authorId: stringOrUndefined(data.authorId),
    presetId: stringOrUndefined(data.presetId),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : undefined,
    teams,
    board,
    pieces,
    rules: Array.isArray(data.rules) ? (data.rules as GameVariant["rules"]) : createDefaultRules(),
    events: Array.isArray(data.events) ? (data.events as GameVariant["events"]) : [],
    victoryConditions: Array.isArray(data.victoryConditions) ? (data.victoryConditions as GameVariant["victoryConditions"]) : [],
    settings: {
      ...createDefaultSettings(),
      ...(isObject(data.settings) ? (data.settings as Partial<GameVariant["settings"]>) : {}),
    },
    setup: {
      pieces: Array.isArray(setup.pieces) ? setup.pieces : [],
      startingTeam: typeof setup.startingTeam === "string" ? setup.startingTeam : teams[0].id,
      turnNumber: Number(setup.turnNumber) || 1,
    },
    theme: isObject(data.theme) ? (data.theme as unknown as GameVariant["theme"]) : { boardTheme: "classic-wood", pieceSkin: "classic" },
    extensions: isObject(data.extensions) ? data.extensions : undefined,
  };
  return { variant, errors: [], warnings };
}
