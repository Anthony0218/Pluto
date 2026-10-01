/**
 * Chess Custom information architecture: three top-level areas (My Games,
 * Create, Community), an ordered Create flow, and the focused simulation.
 * Everything here is pure so routing and state transitions can be tested
 * without a browser.
 */

export const CHESS_CUSTOM_ROOT = "/chess-custom";

/* ------------------------------------------------------------ Create steps */

export const CREATE_STEPS = [
  { id: "overview", label: "Overview", hint: "Name, base preset and summary" },
  { id: "board", label: "Board", hint: "Size, shape, layers and tiles" },
  { id: "teams", label: "Teams", hint: "Armies, colours and directions" },
  { id: "pieces", label: "Pieces", hint: "Movement, captures and abilities" },
  { id: "rules", label: "Rules", hint: "King behaviour and rule switches" },
  { id: "events", label: "Events", hint: "Triggers and consequences" },
  { id: "victory", label: "Victory", hint: "How a game is won" },
  { id: "position", label: "Position", hint: "The starting layout" },
  { id: "simulation", label: "Simulation", hint: "Watch and test it in 3D" },
] as const;

export type CreateStep = (typeof CREATE_STEPS)[number]["id"];
export const CREATE_STEP_IDS = CREATE_STEPS.map((step) => step.id) as CreateStep[];

export const isCreateStep = (value: unknown): value is CreateStep => typeof value === "string" && (CREATE_STEP_IDS as string[]).includes(value);

/** "01", "02", … — the order is guidance, never a lock. */
export function stepNumber(step: CreateStep) {
  return String(CREATE_STEP_IDS.indexOf(step) + 1).padStart(2, "0");
}

export function stepLabel(step: CreateStep) {
  return CREATE_STEPS.find((entry) => entry.id === step)?.label ?? step;
}

export function adjacentSteps(step: CreateStep): { previous: CreateStep | null; next: CreateStep | null } {
  const index = CREATE_STEP_IDS.indexOf(step);
  return { previous: index > 0 ? CREATE_STEP_IDS[index - 1] : null, next: index >= 0 && index < CREATE_STEP_IDS.length - 1 ? CREATE_STEP_IDS[index + 1] : null };
}

/* ------------------------------------------------------------------ Routes */

export type PlayMode = "singleplayer" | "multiplayer" | "hotseat";
export const PLAY_MODES: { id: PlayMode; label: string; detail: string }[] = [
  { id: "singleplayer", label: "Singleplayer", detail: "Play against the AI" },
  { id: "multiplayer", label: "Multiplayer", detail: "Play against another player online" },
  { id: "hotseat", label: "Hotseat", detail: "Two players on the same device" },
];
export const isPlayMode = (value: unknown): value is PlayMode => PLAY_MODES.some((mode) => mode.id === value);

export type ChessCustomRoute =
  | { view: "library" }
  | { view: "community" }
  | { view: "create"; step: CreateStep }
  | { view: "play"; mode: PlayMode };

export type TopLevelArea = "library" | "create" | "community";

/** The top-level tab a route belongs to (playing a variant sits under My Games). */
export function routeArea(route: ChessCustomRoute): TopLevelArea {
  return route.view === "play" ? "library" : route.view;
}

export function chessCustomPath(route: ChessCustomRoute): string {
  switch (route.view) {
    case "library":
      return CHESS_CUSTOM_ROOT;
    case "community":
      return `${CHESS_CUSTOM_ROOT}/community`;
    case "create":
      return `${CHESS_CUSTOM_ROOT}/create/${route.step}`;
    case "play":
      return `${CHESS_CUSTOM_ROOT}/play/${route.mode}`;
  }
}

/** Unknown sub-paths fall back to My Games rather than an error page. */
export function parseChessCustomPath(pathname: string): ChessCustomRoute {
  const rest = pathname.replace(/\/+$/, "").slice(CHESS_CUSTOM_ROOT.length).split("/").filter(Boolean);
  const [area, detail] = rest;
  if (area === "community") return { view: "community" };
  if (area === "create") return { view: "create", step: detail === "test" ? "position" : isCreateStep(detail) ? detail : "overview" };
  if (area === "play" && isPlayMode(detail)) return { view: "play", mode: detail };
  return { view: "library" };
}

export const isChessCustomPath = (pathname: string) => pathname === CHESS_CUSTOM_ROOT || pathname.startsWith(`${CHESS_CUSTOM_ROOT}/`);

/**
 * Leaving the Create area (to My Games, Community, or another page) is when
 * unsaved edits should be confirmed. Moving between steps, or into a play
 * session that uses the same working copy, loses nothing.
 */
export function leavesCreate(from: string, to: string) {
  if (!isChessCustomPath(from) || parseChessCustomPath(from).view !== "create") return false;
  if (!isChessCustomPath(to)) return true;
  const next = parseChessCustomPath(to).view;
  return next !== "create" && next !== "play";
}

/**
 * Old links used `/games/chess/custom?section=…`. Map them onto the new
 * structure, keeping unrelated query parameters (preset, mode, ai, room).
 */
export function legacyChessCustomTarget(search: string): string {
  const params = new URLSearchParams(search);
  const section = params.get("section");
  params.delete("section");
  let route: ChessCustomRoute;
  if (section === "simulation" || section === "simulation2d") {
    const mode = params.get("mode");
    if (mode === "singleplayer") {
      params.delete("mode");
      route = { view: "play", mode: "singleplayer" };
    } else if (mode === "local") {
      params.delete("mode");
      route = { view: "play", mode: "hotseat" };
    } else {
      if (mode === "simulation") params.delete("mode");
      if (section === "simulation2d") params.set("view", "2d");
      route = { view: "create", step: "simulation" };
    }
  } else if (section === "online") route = { view: "play", mode: "multiplayer" };
  else if (section === "community") route = { view: "community" };
  else if (section === "saved") route = { view: "library" };
  else if (section === "presets") route = { view: "create", step: "overview" };
  else if (section === "test") route = { view: "create", step: "position" };
  else if (isCreateStep(section)) route = { view: "create", step: section };
  else route = params.has("preset") ? { view: "create", step: "overview" } : { view: "library" };
  const query = params.toString();
  return `${chessCustomPath(route)}${query ? `?${query}` : ""}`;
}

/* -------------------------------------------------------------- Simulation */

export type SimulationMode = "ava" | "hva" | "hvh";
export const SIMULATION_MODES: { id: SimulationMode; label: string; detail: string }[] = [
  { id: "ava", label: "AI vs AI", detail: "Watch the variant play itself" },
  { id: "hva", label: "Player vs AI", detail: "You take the first side" },
  { id: "hvh", label: "Player vs Player", detail: "Both sides on this device" },
];

/** AI vs AI is the default when testing; play routes start in their own mode. */
export function initialSimulationMode(route: ChessCustomRoute, modeParam: string | null = null): SimulationMode {
  if (route.view === "play") return route.mode === "hotseat" ? "hvh" : "hva";
  if (modeParam === "singleplayer") return "hva";
  if (modeParam === "local" || modeParam === "hotseat") return "hvh";
  return "ava";
}

/** The video-style playback bar is only useful while watching AIs. */
export const showsPlaybackBar = (mode: SimulationMode) => mode === "ava";

/** The focused simulation keeps a deliberately small sidebar. */
export const SIMULATION_SIDEBAR = [
  { id: "play", label: "Play" },
  { id: "board", label: "Board" },
  { id: "customize", label: "Customize" },
  { id: "settings", label: "Settings" },
] as const;
export type SimulationSidebarItem = (typeof SIMULATION_SIDEBAR)[number]["id"];

/** Customize leaves the simulation and opens the editor at its first step. */
export const CUSTOMIZE_TARGET: ChessCustomRoute = { view: "create", step: "overview" };
