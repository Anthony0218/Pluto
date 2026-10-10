import { useTransform, type MotionValue } from "motion/react";
import { useLanding } from "./landingContext";
import { buildPoseTable, featureWeight, sample, sampleColor, smoothstep, stopWeight, type PoseTable, type StopMeta } from "./landingMath";
import { surfaceKey } from "../planetary/planetSurfaces";
import { toneOf, type Tone } from "./tones";

export const PLANET_ART_MAX = 480;
/** Diameter of the travelling planet at scale 1: the same expression the stylesheet uses for `--planet-size`. */
export const planetArtSize = (layerHeight: number) => Math.min(PLANET_ART_MAX, layerHeight * 0.62);

type Table = { stops: StopMeta[]; wide: boolean; pose: PoseTable; colors: Record<keyof Tone, string[]> };
let cache: Table | null = null;
function tableFor(stops: StopMeta[], wide: boolean): Table {
  if (cache && cache.stops === stops && cache.wide === wide) return cache;
  const pose = buildPoseTable(stops, wide);
  const palette = pose.tones.map(toneOf);
  const colors = { light: palette.map(tone => tone.light), base: palette.map(tone => tone.base), dark: palette.map(tone => tone.dark), glow: palette.map(tone => tone.glow), ring: palette.map(tone => tone.ring) };
  cache = { stops, wide, pose, colors };
  return cache;
}

export type PlanetPose = {
  /** Offsets from the middle of the layer, in pixels. */
  x: MotionValue<number>;
  y: MotionValue<number>;
  scale: MotionValue<number>;
  opacity: MotionValue<number>;
  light: MotionValue<string>;
  base: MotionValue<string>;
  dark: MotionValue<string>;
  glow: MotionValue<string>;
  ring: MotionValue<string>;
  /** Ring angle in degrees. */
  tilt: MotionValue<number>;
  /** The game whose picture covers the planet (a `planetSurfaces` key) and how strongly; weight 0 means the plain planet. */
  surface: MotionValue<{ tone: string; weight: number }>;
  books: MotionValue<number>;
  scan: MotionValue<number>;
  moons: MotionValue<number>;
};

/**
 * The travelling planet's pose for the current scroll position. At the top of the page it starts where the hero's
 * Chess planet is and flies to the middle of the flyby stage; from there it moves behind each section's text and
 * takes that section's colour. On the Tools and Learn tabs it only appears once the flyby is over.
 */
export function usePlanetPose(): PlanetPose {
  const { index, wide, stage, layout, enter, categoryIndex } = useLanding();
  const table = () => { layout.get(); return tableFor(stage.current.stops, wide.get() === 1); };
  /** How far the hero → flyby handoff still has to go (0 once the stage is pinned) and where the hero planet is. */
  const handoff = () => {
    const info = stage.current;
    const entered = enter.get();
    const games = categoryIndex.get() === 0;
    const spot = info.anchors.flyby && games ? info.hero["/games/chess"] : undefined;
    return spot ? { remaining: 1 - smoothstep(entered), spot, info } : null;
  };

  const x = useTransform(() => {
    const { pose } = table();
    const hand = handoff();
    return (sample(index.get(), pose.keys, pose.x) / 100) * stage.current.width + (hand ? hand.remaining * (hand.spot.x - hand.info.width / 2) : 0);
  });
  const y = useTransform(() => {
    const { pose } = table();
    const hand = handoff();
    return (sample(index.get(), pose.keys, pose.y) / 100) * stage.current.height + (hand ? hand.remaining * (hand.spot.y - hand.info.height / 2) : 0);
  });
  const scale = useTransform(() => {
    const { pose } = table();
    const base = sample(index.get(), pose.keys, pose.scale);
    const hand = handoff();
    return hand ? base + hand.remaining * (hand.spot.size / planetArtSize(hand.info.height) - base) : base;
  });
  const opacity = useTransform(() => {
    const { pose } = table();
    const at = index.get();
    const games = categoryIndex.get() === 0;
    const entered = enter.get();
    const intro = games ? 1 : smoothstep(at / 0.7);
    const hero = stage.current.anchors.flyby ? smoothstep(entered / 0.1) : 1;
    // Outside Games the planet only exists for sections that want it: the flyby's own keys do not fade it in.
    const base = games ? sample(at, pose.keys, pose.opacity) : sample(at, pose.keys.slice(2), pose.opacity.slice(2));
    return base * intro * hero;
  });
  const tilt = useTransform(() => { const { pose } = table(); return sample(index.get(), pose.keys, pose.tilt); });
  const surface = useTransform(() => {
    layout.get();
    const at = index.get();
    let best = { tone: "", weight: 0 };
    stage.current.stops.forEach((stop, position) => {
      const tone = surfaceKey(stop.tone);
      // The first section's game is already on the planet when the flyby delivers it.
      const weight = tone ? (position === 0 && at < 1 ? 1 : stopWeight(at, position + 1)) : 0;
      if (tone && weight > best.weight) best = { tone, weight };
    });
    return best;
  });
  const read = { index, layout, stage, table };
  return {
    x, y, scale, opacity, tilt, surface,
    light: useToneColor("light", read), base: useToneColor("base", read), dark: useToneColor("dark", read), glow: useToneColor("glow", read), ring: useToneColor("ring", read),
    books: useFeatureWeight("books", read), scan: useFeatureWeight("scan", read), moons: useFeatureWeight("moons", read),
  };
}

type Reader = { index: MotionValue<number>; layout: MotionValue<number>; stage: ReturnType<typeof useLanding>["stage"]; table: () => Table };

function useToneColor(channel: keyof Tone, { index, table }: Reader) {
  return useTransform(() => { const { pose, colors } = table(); return sampleColor(index.get(), pose.keys, colors[channel]); });
}

function useFeatureWeight(name: string, { index, layout, stage }: Reader) {
  return useTransform(() => { layout.get(); return featureWeight(index.get(), stage.current.stops, name); });
}
