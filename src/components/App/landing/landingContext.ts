import { createContext, useContext, type RefObject } from "react";
import type { MotionValue } from "motion/react";
import type { UniverseCategory } from "../planetary/universeCatalog";
import type { JourneyAnchors, StopMeta } from "./landingMath";

/** Where a hero object sits, relative to the journey's top-left corner, so the flyby can start from it. */
export type HeroSpot = { x: number; y: number; size: number };
export type CaptionSpot = { x: number; y: number; width: number; fontSize: number };
export type CaptionFlight = { from: CaptionSpot; to: CaptionSpot; arrival: number; section: number; hasLine: boolean };

/** Measurements the scroll choreography needs; refreshed whenever the layout changes. */
export type StageInfo = {
  anchors: JourneyAnchors;
  stops: StopMeta[];
  hero: Record<string, HeroSpot>;
  captions: Record<string, CaptionFlight>;
  width: number;
  height: number;
};

export type Landing = {
  category: UniverseCategory;
  setCategory: (category: UniverseCategory) => void;
  /** Desktop layouts without reduced motion get the pinned flyby; everything else is a plain page. */
  withFlyby: boolean;
  stage: RefObject<StageInfo>;
  /** Bumped after every measurement so derived values recompute. */
  layout: MotionValue<number>;
  /** -1 → 0 during the flyby, then 1…n at each feature section (fractions in between). */
  index: MotionValue<number>;
  /** 0 → 1 while the flyby stage is pinned. */
  flyby: MotionValue<number>;
  /** 0 → 1 from the top of the page until the flyby stage pins: the hero objects travelling into it. */
  enter: MotionValue<number>;
  /** Artwork crossfade starts only after the next section fills half the viewport. */
  handoff: MotionValue<number>;
  /** 1 on desktop layouts, 0 on stacked ones. */
  wide: MotionValue<number>;
  /** 0 games, 1 tools, 2 learn. */
  categoryIndex: MotionValue<number>;
};

export const LandingContext = createContext<Landing | null>(null);

export function useLanding() {
  const landing = useContext(LandingContext);
  if (!landing) throw new Error("useLanding must be used inside LandingStage");
  return landing;
}
