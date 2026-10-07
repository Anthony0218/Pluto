import { useTransform } from "motion/react";
import * as m from "motion/react-m";
import { useCopy } from "./copy";
import { flybyScene } from "./flybyCatalog";
import { useLanding } from "./landingContext";
import { clamp01 } from "./landingMath";
import type { PlanetPose } from "./planetPose";

/** A subtle continuation of the flyby's title, following the same cached section
 * alignment as its artwork. Motion values update transforms without React renders. */
export default function JourneyTitle({ pose }: { pose: PlanetPose }) {
  const { category, index, withFlyby } = useLanding();
  const text = useCopy();
  const x = useTransform(pose.x, value => value * 0.85);
  const opacity = useTransform(index, value => clamp01(value) * 0.55);
  if (!withFlyby) return null;
  return <m.div className="journey-title" style={{ x, opacity }}>
    <span>{text(flybyScene(category).pick)}</span>
  </m.div>;
}
