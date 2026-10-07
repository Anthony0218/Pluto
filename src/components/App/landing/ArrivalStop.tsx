import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import * as m from "motion/react-m";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useLanding } from "./landingContext";
import RevealButton from "./RevealButton";
import { toneOf, type ToneName } from "./tones";
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

/**
 * The beat before an item's section, the same moment the flyby gives the first item: the planet (or the app tile, or the
 * book) arrives in the middle of the screen with its name, one line and a way in, then travels behind the section's text.
 */
export default function ArrivalStop({ id, tone, feature, ownArt, title, line, href, action, art, button }: ArrivalStopProps) {
  const reducedMotion = useReducedMotion();
  const { withFlyby } = useLanding();
  const colors = toneOf(tone);
  const style = { "--section-accent": colors.light, "--section-glow": colors.glow, ...(button ? { "--item-bg": button.background, "--item-fg": button.color } : {}) } as CSSProperties;
  return <section id={`arrive-${id}`} className="arrival" data-journey-stop={`arrive-${id}`} data-arrival="" data-tone={tone} data-feature={feature} data-planet={ownArt ? "off" : undefined} data-side="center" data-flat={withFlyby ? undefined : ""} style={style}>
    {!withFlyby && <div className="arrival-art" aria-hidden="true">{art}</div>}
    <m.div
      className="arrival-caption"
      initial={reducedMotion || withFlyby ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <TravelingCaption id={id} title={title} line={line} />
      <RevealButton className="flex justify-center">
        <Link to={href} className={button ? "item-open arrival-open" : "flyby-cta"}>
          {action}
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </RevealButton>
    </m.div>
  </section>;
}
