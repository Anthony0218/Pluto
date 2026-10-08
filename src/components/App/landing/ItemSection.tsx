import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import * as m from "motion/react-m";
import { useLandingReducedMotion as useReducedMotion } from "./motionPreference";
import RevealButton from "./RevealButton";
import RevealTitle from "./RevealTitle";
import { toneOf, type ToneName } from "./tones";
import { useLanding } from "./landingContext";
import { useCaptionFlight } from "./useCaptionFlight";

type ItemSectionProps = {
  id: string;
  /** The section's number in the visible order, e.g. "02". */
  index: string;
  tone: ToneName;
  title: string;
  description: string;
  line: string;
  href: string;
  action: string;
  /** The tool working, or the book's contents. */
  children: ReactNode;
  /** Button colours: the tool's accent, or the book cover's colours. */
  button: { background: string; color: string };
  reverse?: boolean;
};

/** Tool/book sections alternate on desktop and stack in reading order on mobile. */
export default function ItemSection({ id, index, tone, title, line, description, href, action, children, button, reverse = false }: ItemSectionProps) {
  const reducedMotion = useReducedMotion();
  const { withFlyby } = useLanding();
  const { targetOpacity } = useCaptionFlight(id);
  const colors = toneOf(tone);
  return <section id={id} data-journey-stop={id} data-tone={tone} data-planet="off" data-side={reverse ? "left" : "right"}
    style={{ "--section-accent": colors.light, "--section-glow": colors.glow, "--btn-bg": button.background, "--btn-fg": button.color } as CSSProperties}
    className="relative scroll-mt-4 border-b border-white/[0.08] py-20 md:py-24 xl:min-h-[600px] xl:py-28">
    <m.div
      initial={reducedMotion || withFlyby ? false : { opacity: 0.75, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: reducedMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto grid max-w-[1500px] gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-10 xl:gap-24"
    >
      <div className={`min-w-0 ${reverse ? "lg:col-start-2" : "lg:col-start-1"} lg:row-start-1`}>{children}</div>
      <div className={`section-copy ${reverse ? "lg:col-start-1" : "lg:col-start-2"} lg:row-start-1`}>
        <div className="section-eyebrow">
          <span className="section-number">{index}</span>
          <m.div data-caption-target={id} style={{ opacity: targetOpacity }}><p data-caption-heading className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: colors.light }}>{title}</p></m.div>
        </div>
        <RevealTitle lines={[{ text: description }]} className="mt-5 max-w-xl text-3xl font-black leading-[1.05] tracking-[-0.04em] text-white sm:text-4xl xl:text-5xl" />
        {line && <p className="mt-6 max-w-lg text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">{line}</p>}
        <RevealButton className="mt-8 flex" flight={id}>
          <Link to={href} className="lp-btn lp-btn--primary">
            {action}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </RevealButton>
      </div>
    </m.div>
  </section>;
}
