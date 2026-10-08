import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import * as m from "motion/react-m";
import { useLandingReducedMotion as useReducedMotion } from "./motionPreference";
import { useLanding } from "./landingContext";
import { useCaptionFlight } from "./useCaptionFlight";
import { useTransform } from "motion/react";
import { buttonOf, toneOf, type ToneName } from "./tones";
import TravelingCaption from "./TravelingCaption";

type ArrivalStopProps = {
  /** The id of the item's section that follows: the arrival is `arrive-<id>`. */
  id: string;
  tone: ToneName;
  feature?: string;
  /** Tools and books carry their own artwork; the planet fades out behind the stop. */
  ownArt?: boolean;
  title: string;
  line: string;
  href: string;
  action: string;
  /** The item's own artwork, shown in the page where nothing travels behind it (stacked layouts, reduced motion). */
  art: ReactNode;
  /** Button colours for tools and books; games keep the flyby's indigo. */
  button?: { background: string; color: string };
};

/** The panel behind an arrival's text: it keeps the words readable over the bright planet and lets go as they fly to their section. */
export function CaptionScrim({ id }: { id: string }) {
  const { scrim } = useCaptionFlight(id);
  return <m.div className="caption-scrim" aria-hidden="true" style={{ opacity: scrim }} />;
}

/** The arrival's button, which fades out once the section's own button starts to appear. */
function ArrivalButton({ id, children }: { id: string; children: ReactNode }) {
  const { depart } = useCaptionFlight(id);
  const pointerEvents = useTransform(depart, value => (value < 0.1 ? "none" : "auto"));
  return <m.div className="flex" style={{ opacity: depart, pointerEvents }}>{children}</m.div>;
}

/**
 * The beat before an item's section, the same moment the flyby gives the first item: the planet (or the app tile, or the
 * book) arrives in the middle of the screen with its name, one line and a way in, then travels behind the section's text.
 */
export default function ArrivalStop({ id, tone, feature, ownArt, title, line, href, action, art, button }: ArrivalStopProps) {
  const reducedMotion = useReducedMotion();
  const { withFlyby } = useLanding();
  const colors = toneOf(tone);
  const tint = buttonOf(tone);
  const style = { "--section-accent": colors.light, "--section-glow": colors.glow, ...(!button ? { "--btn-bg": tint.background, "--btn-fg": tint.color } : {}), ...(button ? { "--btn-bg": button.background, "--btn-fg": button.color } : {}) } as CSSProperties;
  const link = <Link to={href} className="lp-btn lp-btn--primary lp-btn--lg">{action}<ArrowRight size={17} aria-hidden="true" /></Link>;
  return <section id={`arrive-${id}`} className="arrival" data-journey-stop={`arrive-${id}`} data-arrival="" data-tone={tone} data-feature={feature} data-planet={ownArt ? "off" : undefined} data-side="center" data-flat={withFlyby ? undefined : ""} style={style}>
    {!withFlyby && <div className="arrival-art" aria-hidden="true">{art}</div>}
    <m.div
      className="arrival-caption"
      initial={reducedMotion || withFlyby ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {withFlyby && <CaptionScrim id={id} />}
      <TravelingCaption id={id} title={title} line={line} />
      {/* Without the flyby the section right below has the same button, so the arrival leaves it out. */}
      {withFlyby && <ArrivalButton id={id}>{link}</ArrivalButton>}
    </m.div>
  </section>;
}
