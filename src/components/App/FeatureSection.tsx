import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import * as m from "motion/react-m";
import { useLandingReducedMotion as useReducedMotion } from "./landing/motionPreference";
import RevealButton from "./landing/RevealButton";
import RevealTitle, { type TitleLine } from "./landing/RevealTitle";
import { buttonOf, toneOf, type ToneName } from "./landing/tones";
import { useCaptionFlight } from "./landing/useCaptionFlight";
import { useLanding } from "./landing/landingContext";

type FeatureSectionProps = {
  /** Anchor id, e.g. for the progress rail and the skip link. */
  id: string;
  index: string;
  eyebrow: string;
  lines: TitleLine[];
  description: string;
  href: string;
  action: string;
  /** A quieter second way in beside the main button, e.g. the chess variants. */
  secondary?: { href: string; label: string };
  /** The travelling planet takes this colour while the section is on screen. */
  tone: ToneName;
  /** Extra decoration on the planet while the section is on screen: "books", "scan" or "moons". */
  feature?: string;
  children: ReactNode;
  reverse?: boolean;
};

/** One landing section: text on one side, the demo on the other, alternating. The travelling planet sits behind the text. */
export default function FeatureSection({ id, index, eyebrow, lines, description, href, action, secondary, tone, feature, children, reverse = Number(index) % 2 === 1 }: FeatureSectionProps) {
  const reducedMotion = useReducedMotion();
  const { withFlyby } = useLanding();
  const { targetOpacity } = useCaptionFlight(id);
  const colors = toneOf(tone);
  const button = buttonOf(tone);
  return <section
    id={id}
    data-journey-stop={index}
    data-tone={tone}
    data-feature={feature}
    data-side={reverse ? "right" : "left"}
    style={{ "--section-accent": colors.light, "--section-glow": colors.glow, "--btn-bg": button.background, "--btn-fg": button.color } as CSSProperties}
    className="relative scroll-mt-4 border-b border-white/[0.08] py-20 md:py-28 xl:min-h-[700px] xl:py-32"
  >
    <m.div
      initial={reducedMotion || withFlyby ? false : { opacity: 0.75, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: reducedMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto grid max-w-[1500px] gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-10 xl:gap-24"
    >
      <div className={reverse ? "lg:col-start-2 lg:row-start-1" : "lg:col-start-1 lg:row-start-1"}>
        <div className="section-copy">
          <div className="section-eyebrow">
            <span className="section-number">{index}</span>
            <m.div data-caption-target={id} style={{ opacity: targetOpacity }}><p data-caption-heading className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: colors.light }}>{eyebrow}</p></m.div>
          </div>
          <RevealTitle lines={lines} className="mt-5 max-w-xl text-4xl font-black leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl xl:text-6xl" />
          <p className="mt-6 max-w-lg text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">{description}</p>
          <RevealButton className="mt-8" flight={id}>
            <div className="lp-actions">
              <Link to={href} className="lp-btn lp-btn--primary">
                {action}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              {secondary && <Link to={secondary.href} className="lp-link">{secondary.label}<ArrowRight size={14} aria-hidden="true" /></Link>}
            </div>
          </RevealButton>
        </div>
      </div>
      <div className={`min-w-0 ${reverse ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-2 lg:row-start-1"}`}>{children}</div>
    </m.div>
  </section>;
}
