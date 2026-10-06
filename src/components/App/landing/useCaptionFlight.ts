import { useTransform } from "motion/react";
import { useLanding } from "./landingContext";
import { clamp01, lerp } from "./landingMath";

/** Transform values for the measured arrival-to-section path, updated without React renders. */
export function useCaptionFlight(id: string) {
  const { stage, layout, index, withFlyby } = useLanding();
  const progress = useTransform(() => {
    layout.get();
    const at = index.get();
    const flight = stage.current.captions[id];
    return flight ? clamp01((at - flight.arrival) / (flight.section - flight.arrival)) : 0;
  });
  const x = useTransform(() => { layout.get(); const t = progress.get(); const f = stage.current.captions[id]; return f ? (f.to.x - f.from.x) * t : 0; });
  const y = useTransform(() => { layout.get(); const t = progress.get(); const f = stage.current.captions[id]; return f ? (f.to.y - f.from.y) * t : 0; });
  const width = useTransform(() => { layout.get(); const t = progress.get(); const f = stage.current.captions[id]; return f ? lerp(f.from.width, f.to.width, t) : 560; });
  const fontSize = useTransform(() => { layout.get(); const t = progress.get(); const f = stage.current.captions[id]; return f ? lerp(f.from.fontSize, f.to.fontSize, t) : 48; });
  const targetOpacity = useTransform(() => { layout.get(); const t = progress.get(); return withFlyby && stage.current.captions[id] ? clamp01((t - 0.96) / 0.04) : 1; });
  const opacity = useTransform(() => { layout.get(); const target = targetOpacity.get(); return withFlyby && stage.current.captions[id] ? 1 - target : 0; });
  const lineOpacity = useTransform(() => { layout.get(); const t = progress.get(); return stage.current.captions[id]?.hasLine ? 1 : 1 - t; });
  return { x, y, width, fontSize, opacity, lineOpacity, targetOpacity };
}

