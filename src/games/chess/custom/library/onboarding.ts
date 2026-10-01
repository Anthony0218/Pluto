import type { ChessCustomRoute } from "./navigation.ts";

/** Completion or dismissal is remembered per browser; the guide can always be reopened. */
export const GUIDE_STORAGE_KEY = "chess-custom:guide:v1";
export type GuideState = "completed" | "dismissed";

export interface GuideStep {
  id: string;
  title: string;
  body: string;
  /** `data-guide` targets, tried in order; none found shows a centred card. */
  targets: string[];
  /** Show the numbered Create steps inside the card. */
  showSteps?: boolean;
}

export const GUIDE_STEPS: GuideStep[] = [
  { id: "library", title: "My Chess Games", body: "This is where all of your custom chess variants are stored.", targets: ["nav-library"] },
  {
    id: "create",
    title: "Create a variant",
    body: "Design your own rule set, pieces, boards — even multi-layer 3D chess.",
    targets: ["create-new", "nav-create"],
  },
  {
    id: "steps",
    title: "Built step by step",
    body: "Create is organised into numbered steps. Follow them in order or jump to any step.",
    targets: ["create-steps", "nav-create"],
    showSteps: true,
  },
  { id: "play", title: "Play", body: "Saved variants can be played in Singleplayer, Multiplayer or Hotseat.", targets: ["card-play"] },
  { id: "share", title: "Share", body: "Sharing publishes a variant to Community. You can make it private again at any time.", targets: ["card-share"] },
  { id: "community", title: "Community", body: "Discover variants made by other players, play them, and remix your own copy.", targets: ["nav-community"] },
];

export interface GuideStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function readGuideState(storage: GuideStorage | null | undefined): GuideState | null {
  try {
    const value = storage?.getItem(GUIDE_STORAGE_KEY);
    return value === "completed" || value === "dismissed" ? value : null;
  } catch {
    return null;
  }
}

export function writeGuideState(storage: GuideStorage | null | undefined, state: GuideState) {
  try {
    storage?.setItem(GUIDE_STORAGE_KEY, state);
  } catch {
    /* Storage is optional; the guide just may show again. */
  }
}

/** New visitors see the guide once, on My Games, after their library has loaded. */
export function shouldAutoShowGuide(state: GuideState | null, route: ChessCustomRoute, libraryReady: boolean) {
  return state === null && route.view === "library" && libraryReady;
}

/** Keyboard model for the guide card. */
export function guideKeyAction(key: string, index: number, total: number): "next" | "previous" | "finish" | "skip" | null {
  if (key === "Escape") return "skip";
  if (key === "ArrowRight") return index === total - 1 ? "finish" : "next";
  if (key === "ArrowLeft") return index > 0 ? "previous" : null;
  return null;
}
