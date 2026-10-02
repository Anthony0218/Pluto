import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  adjacentSteps,
  chessCustomPath,
  CREATE_STEP_IDS,
  CUSTOMIZE_TARGET,
  initialSimulationMode,
  leavesCreate,
  legacyChessCustomTarget,
  parseChessCustomPath,
  PLAY_MODES,
  routeArea,
  showsPlaybackBar,
  SIMULATION_SIDEBAR,
  stepLabel,
  stepNumber,
} from "../src/games/chess/custom/library/navigation.ts";
import { filterLibrary, libraryMetadata, sortLibrary, toLibraryEntries } from "../src/games/chess/custom/library/metadata.ts";
import { createStarterVariant, createUntitledVariant, ensureStarterVariant, STARTER_VARIANT_NAME, starterFlagKey, withBasePreset } from "../src/games/chess/custom/library/starter.ts";
import { GUIDE_STEPS, guideKeyAction, readGuideState, shouldAutoShowGuide, writeGuideState } from "../src/games/chess/custom/library/onboarding.ts";
import { createHistory, editorReducer } from "../src/games/chess/custom/editor/editorStore.ts";
import { BOARD_SHAPE_LABELS, createRectangularBoard } from "../src/games/chess/custom/engine/board.ts";
import { createVariantFromPreset } from "../src/games/chess/custom/engine/presets.ts";
import { parseVariantJson } from "../src/games/chess/custom/engine/serialization.ts";
import { validateVariant } from "../src/games/chess/custom/engine/validation.ts";
import { summarize } from "../src/games/chess/custom/storage/variantRepository.ts";

const memoryFlags = () => {
  const map = new Map();
  return { get: (key) => map.get(key) ?? null, set: (key, value) => map.set(key, value), map };
};
const memoryStorage = () => {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
};

/* ------------------------------------------------------------------ Routes */

test("/chess-custom opens My Games and unknown sub-paths fall back to it", () => {
  assert.deepEqual(parseChessCustomPath("/chess-custom"), { view: "library" });
  assert.deepEqual(parseChessCustomPath("/chess-custom/"), { view: "library" });
  assert.deepEqual(parseChessCustomPath("/chess-custom/nonsense"), { view: "library" });
  assert.equal(chessCustomPath({ view: "library" }), "/chess-custom");
  assert.equal(routeArea(parseChessCustomPath("/chess-custom")), "library");
});

test("every area and Create step round-trips through its URL", () => {
  for (const route of [{ view: "community" }, { view: "pluto" }, { view: "play", mode: "singleplayer" }, { view: "play", mode: "multiplayer" }, { view: "play", mode: "hotseat" }, ...CREATE_STEP_IDS.map((step) => ({ view: "create", step }))]) {
    assert.deepEqual(parseChessCustomPath(chessCustomPath(route)), route);
  }
  assert.deepEqual(parseChessCustomPath("/chess-custom/create"), { view: "create", step: "overview" });
  // Playing a variant belongs to My Games in the top navigation.
  assert.equal(routeArea({ view: "play", mode: "hotseat" }), "library");
  assert.equal(routeArea({ view: "pluto" }), "pluto");
});

test("old /games/chess/custom?section= links map onto the new structure", () => {
  assert.equal(legacyChessCustomTarget(""), "/chess-custom");
  assert.equal(legacyChessCustomTarget("?section=saved"), "/chess-custom");
  assert.equal(legacyChessCustomTarget("?section=community"), "/chess-custom/community");
  assert.equal(legacyChessCustomTarget("?section=test"), "/chess-custom/create/position");
  assert.equal(legacyChessCustomTarget("?section=board"), "/chess-custom/create/board");
  assert.equal(legacyChessCustomTarget("?section=presets&preset=portal"), "/chess-custom/create/overview?preset=portal");
  assert.equal(legacyChessCustomTarget("?preset=3d-chess"), "/chess-custom/create/overview?preset=3d-chess");
  assert.equal(legacyChessCustomTarget("?section=simulation2d"), "/chess-custom/create/simulation?view=2d");
  assert.equal(legacyChessCustomTarget("?preset=3d-chess&section=simulation&mode=singleplayer&ai=master"), "/chess-custom/play/singleplayer?preset=3d-chess&ai=master");
  assert.equal(legacyChessCustomTarget("?section=simulation&mode=local"), "/chess-custom/play/hotseat");
  assert.equal(legacyChessCustomTarget("?section=online&room=ABCD"), "/chess-custom/play/multiplayer?room=ABCD");
});

/* ------------------------------------------------------------ Create steps */

test("Create steps are ordered, numbered and include Position instead of Test Position", () => {
  assert.deepEqual(CREATE_STEP_IDS, ["overview", "board", "teams", "pieces", "rules", "events", "victory", "position", "simulation"]);
  assert.deepEqual(CREATE_STEP_IDS.map(stepNumber), ["01", "02", "03", "04", "05", "06", "07", "08", "09"]);
  assert.equal(stepLabel("position"), "Position");
  assert.ok(!CREATE_STEP_IDS.includes("test"));
  assert.ok(!CREATE_STEP_IDS.map(stepLabel).some((label) => /test/i.test(label)));
  // Old /create/test URLs still land on Position.
  assert.deepEqual(parseChessCustomPath("/chess-custom/create/test"), { view: "create", step: "position" });
});

test("Previous / Next walk the steps in order and stop at the ends", () => {
  assert.deepEqual(adjacentSteps("overview"), { previous: null, next: "board" });
  assert.deepEqual(adjacentSteps("board"), { previous: "overview", next: "teams" });
  assert.deepEqual(adjacentSteps("position"), { previous: "victory", next: "simulation" });
  assert.deepEqual(adjacentSteps("simulation"), { previous: "position", next: null });
  // Walking Next from Overview visits every step exactly once.
  const visited = ["overview"];
  for (let step = "overview"; adjacentSteps(step).next; ) visited.push((step = adjacentSteps(step).next));
  assert.deepEqual(visited, CREATE_STEP_IDS);
});

test("any step can be opened directly — the order is not a locked wizard", () => {
  for (const step of CREATE_STEP_IDS) assert.deepEqual(parseChessCustomPath(`/chess-custom/create/${step}`), { view: "create", step });
});

test("validation issues point at Create steps (starting-position issues go to Position)", () => {
  const variant = createVariantFromPreset("standard");
  variant.setup = { ...variant.setup, pieces: [...variant.setup.pieces, { type: "ghost", team: "white", x: 4, y: 4 }] };
  const issues = validateVariant(variant);
  assert.ok(issues.some((issue) => issue.section === "position"));
  assert.ok(issues.every((issue) => CREATE_STEP_IDS.includes(issue.section)));
});

test("leaving Create is detected; moving between steps or into Play is not", () => {
  assert.equal(leavesCreate("/chess-custom/create/board", "/chess-custom"), true);
  assert.equal(leavesCreate("/chess-custom/create/board", "/chess-custom/community"), true);
  assert.equal(leavesCreate("/chess-custom/create/board", "/games/chess"), true);
  assert.equal(leavesCreate("/chess-custom/create/board", "/chess-custom/create/pieces"), false);
  assert.equal(leavesCreate("/chess-custom/create/simulation", "/chess-custom/create/overview"), false);
  assert.equal(leavesCreate("/chess-custom/create/overview", "/chess-custom/play/hotseat"), false);
  assert.equal(leavesCreate("/chess-custom", "/chess-custom/community"), false);
});

/* ------------------------------------------------------------- Board labels */

test("the rectangle template is presented as Standard and Cosmetic Only is gone from Board", () => {
  assert.equal(BOARD_SHAPE_LABELS.rectangle, "Standard");
  assert.ok(!Object.values(BOARD_SHAPE_LABELS).includes("Rectangle"));
  const board = readFileSync(new URL("../src/components/chessCustom/sections/BoardSection.tsx", import.meta.url), "utf8");
  assert.ok(!/Cosmetic only/i.test(board));
  assert.ok(!board.includes("ThemeSelector"));
});

/* ----------------------------------------------------------- Starter variant */

test("the starter variant is an ordinary standard variant", () => {
  const starter = createStarterVariant();
  assert.equal(starter.name, STARTER_VARIANT_NAME);
  assert.equal(starter.board.width, 8);
  assert.equal(starter.presetId, "standard");
  assert.equal(validateVariant(starter).filter((issue) => issue.severity === "error").length, 0);
  // Two starters never share an id.
  assert.notEqual(createStarterVariant().id, starter.id);
});

test("the starter is created only once, and never for a library that already has variants", async () => {
  const saved = [];
  const repository = { save: async (variant) => (saved.push(variant), variant) };
  const flags = memoryFlags();
  const first = await ensureStarterVariant({ repository, scope: "local", existingCount: 0, flags });
  assert.equal(first?.name, STARTER_VARIANT_NAME);
  // Page reloads, or the player deleted it: no second starter.
  assert.equal(await ensureStarterVariant({ repository, scope: "local", existingCount: 0, flags }), null);
  assert.equal(await ensureStarterVariant({ repository, scope: "local", existingCount: 1, flags }), null);
  assert.equal(saved.length, 1);

  // An existing player is marked as seeded, so emptying the library later adds nothing.
  const veteran = memoryFlags();
  assert.equal(await ensureStarterVariant({ repository, scope: "user:1", existingCount: 3, flags: veteran }), null);
  assert.equal(veteran.get(starterFlagKey("user:1")), "existing");
  assert.equal(await ensureStarterVariant({ repository, scope: "user:1", existingCount: 0, flags: veteran }), null);
  assert.equal(saved.length, 1);
});

test("concurrent starter checks (e.g. a double-mounted effect) save one starter", async () => {
  let saves = 0;
  const repository = { save: async (variant) => (saves++, await new Promise((resolve) => setTimeout(resolve, 5)), variant) };
  const flags = memoryFlags();
  const [a, b] = await Promise.all([ensureStarterVariant({ repository, scope: "race", existingCount: 0, flags }), ensureStarterVariant({ repository, scope: "race", existingCount: 0, flags })]);
  assert.equal(saves, 1);
  assert.equal(a?.id, b?.id);
});

test("a failed starter save does not mark the library as seeded", async () => {
  const flags = memoryFlags();
  await assert.rejects(ensureStarterVariant({ repository: { save: async () => Promise.reject(new Error("offline")) }, scope: "flaky", existingCount: 0, flags }));
  assert.equal(flags.get(starterFlagKey("flaky")), null);
});

/* ------------------------------------------------------- Library & sharing */

test("saved variants become library cards with previews, layers and rules", () => {
  const layered = createVariantFromPreset("three-level");
  const entry = toLibraryEntries([summarize(layered)])[0];
  assert.equal(entry.name, "Three-Level Chess");
  assert.equal(entry.layerCount, 3);
  assert.equal(entry.preview.layers.length, 3);
  assert.equal(entry.preview.pieces.length, layered.setup.pieces.length);
  assert.ok(entry.preview.pieces.some((piece) => piece.royal));
  assert.ok(entry.kingRule);
  assert.equal(entry.meta.visibility, "private");
});

test("sharing state: published variants are public, everything else private", () => {
  const summary = summarize(createVariantFromPreset("standard"));
  assert.equal(libraryMetadata(summary).visibility, "private");
  const record = { publishedId: "p1", publishedAt: summary.updatedAt, updatedAt: summary.updatedAt };
  const meta = libraryMetadata(summary, { [summary.id]: record }, "owner");
  assert.equal(meta.visibility, "public");
  assert.equal(meta.publishedId, "p1");
  assert.equal(meta.ownerId, "owner");
  assert.equal(meta.publishedOutdated, false);
  // Editing after publishing flags the public copy as outdated.
  const edited = { ...summary, updatedAt: new Date(Date.parse(summary.updatedAt) + 60_000).toISOString() };
  assert.equal(libraryMetadata(edited, { [summary.id]: record }).publishedOutdated, true);
  // Unsharing (record removed) makes it private again.
  assert.equal(libraryMetadata(summary, {}).visibility, "private");
});

test("library sorting and search", () => {
  const make = (name, updatedAt, createdAt) => ({ ...summarize({ ...createVariantFromPreset("standard"), name, updatedAt, createdAt }) });
  const a = make("Alpha", "2026-01-03T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
  const b = make("beta", "2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z");
  const c = make("Gamma", "2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z");
  const entries = toLibraryEntries([a, b, c], { [b.id]: { publishedId: "x", publishedAt: b.updatedAt, updatedAt: b.updatedAt } });
  assert.deepEqual(sortLibrary(entries, "updated").map((entry) => entry.name), ["Alpha", "Gamma", "beta"]);
  assert.deepEqual(sortLibrary(entries, "name").map((entry) => entry.name), ["Alpha", "beta", "Gamma"]);
  assert.deepEqual(sortLibrary(entries, "created").map((entry) => entry.name), ["Gamma", "beta", "Alpha"]);
  assert.equal(sortLibrary(entries, "visibility")[0].name, "beta");
  assert.deepEqual(filterLibrary(entries, "GAM").map((entry) => entry.name), ["Gamma"]);
});

test("existing saved variants keep loading: legacy documents and sparse summaries", () => {
  // A v1-era document without schema version, metadata or visibility.
  const legacy = { id: "variant-old", name: "Portal Kingdom", version: 4, board: createRectangularBoard(8, 8), pieces: createVariantFromPreset("standard").pieces };
  const { variant, errors } = parseVariantJson(JSON.stringify(legacy), { keepIdentity: true });
  assert.deepEqual(errors, []);
  assert.equal(variant.id, "variant-old");
  assert.equal(variant.version, 4);
  const entry = toLibraryEntries([summarize(variant)])[0];
  assert.equal(entry.meta.visibility, "private");
  assert.equal(entry.layerCount, 1);
  // A summary from an older backend row (no createdAt, no preview) still has metadata.
  const sparse = { id: "x", name: "Old row", updatedAt: "2026-01-01T00:00:00.000Z", version: 1, boardSize: "8×8", pieceCount: 6 };
  const meta = libraryMetadata(sparse);
  assert.equal(meta.createdAt, sparse.updatedAt);
  assert.equal(meta.visibility, "private");
});

/* ------------------------------------------------------- Create New / Edit */

test("Create New starts an untitled standard variant; a base preset keeps the player's identity", () => {
  const fresh = createUntitledVariant();
  assert.equal(fresh.name, "Untitled Chess Variant");
  assert.equal(chessCustomPath({ view: "create", step: "overview" }), "/chess-custom/create/overview");
  const renamed = { ...fresh, name: "Portal Kingdom", description: "Mine", tags: ["portals"] };
  const based = withBasePreset(renamed, createVariantFromPreset("three-level"));
  assert.equal(based.id, fresh.id);
  assert.equal(based.name, "Portal Kingdom");
  assert.equal(based.description, "Mine");
  assert.deepEqual(based.tags, ["portals"]);
  assert.equal(based.board.layers.length, 2);
  assert.equal(based.presetId, "three-level");
});

test("applying a base preset is one undoable step and resets the test position", () => {
  const start = createUntitledVariant();
  let history = createHistory(start);
  history = editorReducer(history, { type: "setTestSetup", setup: { ...start.setup, pieces: [] } });
  history = editorReducer(history, { type: "replaceContent", variant: withBasePreset(start, createVariantFromPreset("tower")) });
  assert.equal(history.present.variant.presetId, "tower");
  assert.deepEqual(history.present.testSetup, history.present.variant.setup);
  history = editorReducer(history, { type: "undo" });
  assert.equal(history.present.variant.presetId, "standard");
});

test("Edit loads the selected variant itself, not a copy", () => {
  const saved = createVariantFromPreset("portal");
  const history = editorReducer(createHistory(createUntitledVariant()), { type: "load", variant: saved });
  assert.equal(history.present.variant.id, saved.id);
  assert.equal(history.past.length, 0);
});

/* ------------------------------------------------------------- Play modes */

test("Play offers Singleplayer, Multiplayer and Hotseat — no Simulation, no 'Local Multiplayer'", () => {
  assert.deepEqual(PLAY_MODES.map((mode) => mode.label), ["Singleplayer", "Multiplayer", "Hotseat"]);
  assert.ok(!PLAY_MODES.some((mode) => /local|simulation/i.test(`${mode.label} ${mode.detail}`)));
  assert.equal(chessCustomPath({ view: "play", mode: "hotseat" }), "/chess-custom/play/hotseat");
});

/* -------------------------------------------------------------- Simulation */

test("Simulation defaults to AI vs AI; play routes start in their own mode", () => {
  assert.equal(initialSimulationMode({ view: "create", step: "simulation" }), "ava");
  assert.equal(initialSimulationMode({ view: "create", step: "simulation" }, "singleplayer"), "hva");
  assert.equal(initialSimulationMode({ view: "create", step: "simulation" }, "local"), "hvh");
  assert.equal(initialSimulationMode({ view: "play", mode: "singleplayer" }), "hva");
  assert.equal(initialSimulationMode({ view: "play", mode: "hotseat" }), "hvh");
});

test("the playback bar shows only for AI vs AI", () => {
  assert.equal(showsPlaybackBar("ava"), true);
  assert.equal(showsPlaybackBar("hva"), false);
  assert.equal(showsPlaybackBar("hvh"), false);
});

test("the simulation sidebar is exactly Play, Board, Customize, Settings; Customize opens Create → Overview", () => {
  assert.deepEqual(SIMULATION_SIDEBAR.map((item) => item.label), ["Play", "Board", "Customize", "Settings"]);
  assert.equal(chessCustomPath(CUSTOMIZE_TARGET), "/chess-custom/create/overview");
  const view = readFileSync(new URL("../src/components/chessCustom/simulation/SimulationView.tsx", import.meta.url), "utf8");
  assert.ok(!/\bLibraryDrawer\b|\bRulesDrawer\b|label: "(Rules|Library|Move History)"/.test(view), "no Library, Rules or Move History sidebar entries");
  const drawers = readFileSync(new URL("../src/components/chessCustom/simulation/SimulationDrawers.tsx", import.meta.url), "utf8");
  assert.match(drawers, /export type Drawer = "play" \| "board" \| "settings" \| null;/);
});

/* -------------------------------------------------------------- Onboarding */

test("the guide shows once for new visitors on My Games and never again after finishing or skipping", () => {
  const storage = memoryStorage();
  const library = { view: "library" };
  assert.equal(readGuideState(storage), null);
  assert.equal(shouldAutoShowGuide(readGuideState(storage), library, false), false, "waits for the library");
  assert.equal(shouldAutoShowGuide(readGuideState(storage), library, true), true);
  assert.equal(shouldAutoShowGuide(readGuideState(storage), { view: "create", step: "board" }, true), false);
  writeGuideState(storage, "completed");
  assert.equal(shouldAutoShowGuide(readGuideState(storage), library, true), false);
  const skipped = memoryStorage();
  writeGuideState(skipped, "dismissed");
  assert.equal(shouldAutoShowGuide(readGuideState(skipped), library, true), false);
  // Broken storage never throws and simply shows the guide.
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(readGuideState(broken), null);
  assert.doesNotThrow(() => writeGuideState(broken, "completed"));
});

test("the guide covers the workflow and is keyboard navigable", () => {
  assert.deepEqual(GUIDE_STEPS.map((step) => step.id), ["library", "create", "steps", "play", "share", "community"]);
  assert.equal(guideKeyAction("ArrowRight", 0, 6), "next");
  assert.equal(guideKeyAction("ArrowRight", 5, 6), "finish");
  assert.equal(guideKeyAction("ArrowLeft", 0, 6), null);
  assert.equal(guideKeyAction("ArrowLeft", 3, 6), "previous");
  assert.equal(guideKeyAction("Escape", 2, 6), "skip");
  // Manual reopening is a Show Guide button in the Chess Custom navigation.
  const nav = readFileSync(new URL("../src/components/chessCustom/ChessCustomNav.tsx", import.meta.url), "utf8");
  assert.ok(nav.includes('"Show Guide"') && nav.includes("onShowGuide"));
});
