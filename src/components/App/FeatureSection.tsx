import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import * as m from "motion/react-m";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import RevealButton from "./landing/RevealButton";
import RevealTitle, { type TitleLine } from "./landing/RevealTitle";
import { toneOf, type ToneName } from "./landing/tones";
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
  /** The travelling planet takes this colour while the section is on screen. */
  tone: ToneName;
  /** Extra decoration on the planet while the section is on screen: "books", "scan" or "moons". */
  feature?: string;
  children: ReactNode;
  reverse?: boolean;
};

/** One landing section: text on one side, the demo on the other, alternating. The travelling planet sits behind the text. */
export default function FeatureSection({ id, index, eyebrow, lines, description, href, action, tone, feature, children, reverse = Number(index) % 2 === 1 }: FeatureSectionProps) {
  const reducedMotion = useReducedMotion();
  const { withFlyby } = useLanding();
  const { targetOpacity } = useCaptionFlight(id);
  const colors = toneOf(tone);
  return <section
    id={id}
    data-journey-stop={index}
    data-tone={tone}
    data-feature={feature}
    data-side={reverse ? "right" : "left"}
    style={{ "--section-accent": colors.light, "--section-glow": colors.glow } as CSSProperties}
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
        <div className="grid grid-cols-[32px_1fr] gap-4 sm:grid-cols-[48px_1fr] sm:gap-6">
          <span className="pt-1 text-xs font-medium text-zinc-500">{index}</span>
          <div>
            <m.div data-caption-target={id} style={{ opacity: targetOpacity }}><p data-caption-heading className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: colors.light }}>{eyebrow}</p></m.div>
            <RevealTitle lines={lines} className="mt-5 max-w-xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-white sm:text-5xl xl:text-6xl" />
            <p className="mt-6 max-w-lg text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">{description}</p>
            <RevealButton className="flex" flight={id}>
              <Link to={href} className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-400 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-300">
                {action}
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </RevealButton>
          </div>
        </div>
      </div>
      <div className={`min-w-0 ${reverse ? "lg:col-start-1 lg:row-start-1" : "lg:col-start-2 lg:row-start-1"}`}>{children}</div>
    </m.div>
  </section>;
}
