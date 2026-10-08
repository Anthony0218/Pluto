import type { ReactNode } from "react";
import * as m from "motion/react-m";
import { useLandingReducedMotion as useReducedMotion } from "./motionPreference";
import { useLanding } from "./landingContext";
import { useCaptionFlight } from "./useCaptionFlight";

/**
 * A section's button arrives with its title. Where the title flies in from the arrival as the page scrolls (`flight`
 * names that caption), the button rises and fades with the same scroll progress; on plain pages it rises into place
 * a beat after the title, the first time it scrolls into view.
 */
export default function RevealButton({ children, className = "", flight }: { children: ReactNode; className?: string; flight?: string }) {
  const reducedMotion = useReducedMotion();
  const { withFlyby } = useLanding();
  const { reveal, lift } = useCaptionFlight(flight ?? "");
  if (withFlyby && flight) return <m.div className={className} style={{ opacity: reveal, y: lift }}>{children}</m.div>;
  return <m.div className={className} initial={reducedMotion ? false : { opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.8 }}
    transition={{ duration: reducedMotion ? 0 : 0.55, delay: reducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}>
    {children}
  </m.div>;
}
