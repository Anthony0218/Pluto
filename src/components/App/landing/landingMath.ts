// Pure helpers behind the landing page's scroll choreography. Kept free of React so they can be unit tested.

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
export const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
export const smoothstep = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

/** Piecewise-linear lookup of `values` at `x`, clamped to the first and last key. */
export function sample(x: number, keys: readonly number[], values: readonly number[]) {
  if (x <= keys[0]) return values[0];
  for (let i = 1; i < keys.length; i++) {
    if (x <= keys[i]) return lerp(values[i - 1], values[i], (x - keys[i - 1]) / (keys[i] - keys[i - 1]));
  }
  return values[values.length - 1];
}

const parseHex = (hex: string): [number, number, number] => {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

/** Like `sample`, for "#rrggbb" colours. */
export function sampleColor(x: number, keys: readonly number[], colors: readonly string[]) {
  const channels = colors.map(parseHex);
  const [r, g, b] = [0, 1, 2].map(channel => Math.round(sample(x, keys, channels.map(color => color[channel]))));
  return `rgb(${r}, ${g}, ${b})`;
}

/** How strongly stop `stop` is active at journey index `index`: 1 on the stop, 0 beyond `reach` away. */
export const stopWeight = (index: number, stop: number, reach = 0.7) => clamp01(1 - Math.abs(index - stop) / reach);

/** `side` is where the planet sits: 1 behind a right-hand text column, -1 behind a left-hand one, 0 in the middle. */
export type StopMeta = {
  tone: string;
  feature: string | null;
  side: 1 | 0 | -1;
  /** The section shows its own artwork, so the planet fades out behind it. */
  hidden?: boolean;
  /** An arrival: the next item's planet at full size in the middle of the screen, just before that item's section. */
  arrival?: boolean;
};

export type PoseTable = {
  keys: number[];
  /** Horizontal offset from the middle, in % of the width. */
  x: number[];
  /** Vertical offset from the middle, in % of the height. */
  y: number[];
  scale: number[];
  opacity: number[];
  tilt: number[];
  tones: string[];
};

const RING_TILTS = [-32, 12, -8, 24, -20, 16];

/**
 * Where the travelling planet sits for every journey index. Index -1/0 are the start and end of the flyby;
 * 1…n are the feature sections, each with the planet behind that section's text column (`side`).
 */
export function buildPoseTable(stops: readonly StopMeta[], wide: boolean): PoseTable {
  const first = stops[0]?.tone ?? "chess";
  const keys = [-1, 0, ...stops.map((_, index) => index + 1)];
  const sides = [stops[0]?.side ?? 1, stops[0]?.side ?? 1, ...stops.map(stop => stop.side)];
  const rest = (value: number) => [value, value, ...stops.map(() => value)];
  return wide ? {
    keys,
    x: [0, 0, ...stops.map(stop => stop.arrival ? 0 : stop.side * 27)],
    y: [0, -4, ...stops.map(stop => stop.arrival ? -8 : 0)],
    scale: [0.26, 1, ...stops.map(stop => stop.arrival ? 1 : 0.9)],
    opacity: [1, 1, ...stops.map(stop => stop.hidden ? 0 : stop.arrival ? 1 : 0.5)],
    tilt: [-19, -19, ...stops.map((stop, index) => stop.arrival ? -19 : RING_TILTS[index % RING_TILTS.length])],
    tones: [first, first, ...stops.map(stop => stop.tone)],
  } : {
    keys,
    x: sides.map(side => side * 34),
    y: rest(-18),
    scale: rest(0.4),
    opacity: [0.3, 0.3, ...stops.map(stop => stop.hidden ? 0 : 0.3)],
    tilt: [-19, -19, ...stops.map((stop, index) => stop.arrival ? -19 : RING_TILTS[index % RING_TILTS.length])],
    tones: [first, first, ...stops.map(stop => stop.tone)],
  };
}

/**
 * Journey stops (1-based, in page order) of the `k`-th tool or book on the Tools and Learn tabs. The first one arrives
 * through the flyby, so its artwork is there from the end of the flyby (stop 0); every later one gets an arrival stop right before its section.
 */
export const itemStops = (k: number) => k === 0 ? { arrival: 0, section: 1 } : { arrival: 2 * k, section: 2 * k + 1 };

/**
 * How strongly the artwork of the item whose section is stop `section` (and whose arrival, if it has one, is stop
 * `arrival`) is shown at journey index `index`: 1 from its arrival to its section, fading out over `reach` either side.
 */
export function itemWeight(index: number, arrival: number, section: number, reach = 0.7) {
  return clamp01(1 - (index < arrival ? arrival - index : index > section ? index - section : 0) / reach);
}

/** How strongly any stop with `feature` is active at journey index `index`. */
export function featureWeight(index: number, stops: readonly StopMeta[], feature: string) {
  let weight = 0;
  stops.forEach((stop, position) => { if (stop.feature === feature) weight = Math.max(weight, stopWeight(index, position + 1)); });
  return weight;
}

export type JourneyAnchors = {
  /** Height of the scrolling viewport. */
  viewport: number;
  /** Scroll offsets where the pinned flyby stage starts and stops being pinned; null when there is no flyby. */
  flyby: { start: number; end: number } | null;
  /** Scroll offsets at which each feature section is centred in the viewport, in page order. */
  stops: number[];
};

export function flybyProgress(scroll: number, anchors: JourneyAnchors) {
  const { flyby } = anchors;
  if (!flyby || flyby.end <= flyby.start) return 0;
  return clamp01((scroll - flyby.start) / (flyby.end - flyby.start));
}

/** Keep hero artwork visible until the next section occupies half the viewport. */
export function heroHandoffProgress(scroll: number, anchors: JourneyAnchors) {
  if (!anchors.flyby || anchors.viewport <= 0) return 0;
  const fadeStart = Math.max(0, anchors.flyby.start - anchors.viewport / 2);
  return smoothstep(clamp01((scroll - fadeStart) / Math.max(1, anchors.flyby.start - fadeStart)));
}

// The planet rests around each stop and only travels while the gap between two sections crosses the viewport.
const plateau = (fraction: number) => smoothstep((fraction - 0.25) / 0.5);
/** Share of the gap between the flyby and the first section during which the arrived object stays put. */
const FIRST_HOLD = 0.3;

/**
 * Where the persistent planet is on its journey: -1 → 0 while the flyby is pinned, then 0 at the end of the
 * flyby, 1…n at each feature section, with a smooth, resting transition between neighbours.
 */
export function journeyIndex(scroll: number, anchors: JourneyAnchors) {
  const { flyby, stops, viewport } = anchors;
  if (flyby && scroll < flyby.end) return -1 + flybyProgress(scroll, anchors);
  if (!stops.length) return 0;
  const points = [flyby ? flyby.end : stops[0] - viewport, ...stops];
  if (scroll <= points[0]) return 0;
  for (let i = 0; i < points.length - 1; i++) {
    if (scroll <= points[i + 1]) {
      const span = points[i + 1] - points[i];
      const fraction = span > 0 ? (scroll - points[i]) / span : 1;
      // The first object stays where the flyby delivered it for a while before it travels behind the first section.
      return i + (i === 0 ? smoothstep((fraction - FIRST_HOLD) / (0.85 - FIRST_HOLD)) : plateau(fraction));
    }
  }
  return points.length - 1;
}

/** A point on a tilted ellipse. `depth` is +1 at the near side of the orbit and -1 at the far side. */
export function orbitPoint(angle: number, radiusX: number, radiusY: number, tilt: number) {
  const x = Math.cos(angle) * radiusX;
  const y = Math.sin(angle) * radiusY;
  return { x: x * Math.cos(tilt) - y * Math.sin(tilt), y: x * Math.sin(tilt) + y * Math.cos(tilt), depth: Math.sin(angle) };
}
