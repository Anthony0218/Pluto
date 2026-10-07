import type { CSSProperties, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import * as m from "motion/react-m";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import RevealButton from "./RevealButton";
import RevealTitle from "./RevealTitle";
import { toneOf, type ToneName } from "./tones";
import { useLanding } from "./landingContext";
import { useCaptionFlight } from "./useCaptionFlight";

type ItemSectionProps = {
  id: string;
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
export default function ItemSection({ id, tone, title, line, description, href, action, children, button, reverse = false }: ItemSectionProps) {
  const reducedMotion = useReducedMotion();
  const { withFlyby } = useLanding();
  const { targetOpacity } = useCaptionFlight(id);
  const colors = toneOf(tone);
  return <section id={id} data-journey-stop={id} data-tone={tone} data-planet="off" data-side={reverse ? "left" : "right"}
    style={{ "--section-accent": colors.light, "--section-glow": colors.glow, "--item-bg": button.background, "--item-fg": button.color } as CSSProperties}
    className="relative scroll-mt-4 border-b border-white/[0.08] py-20 md:py-24 xl:min-h-[600px] xl:py-28">
    <m.div
      initial={reducedMotion || withFlyby ? false : { opacity: 0.75, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: reducedMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto grid max-w-[1500px] gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-10 xl:gap-24"
    >
      <div className={`min-w-0 ${reverse ? "lg:col-start-2" : "lg:col-start-1"} lg:row-start-1`}>{children}</div>
      <div className={`${reverse ? "lg:col-start-1" : "lg:col-start-2"} lg:row-start-1`}>
        <m.div data-caption-target={id} style={{ opacity: targetOpacity }}>
          {withFlyby ? <h2 data-caption-heading className="max-w-xl text-4xl font-black leading-none tracking-[-0.04em] text-white sm:text-5xl xl:text-6xl">{title}</h2>
            : <RevealTitle lines={[{ text: title }]} className="max-w-xl text-4xl font-black leading-none tracking-[-0.04em] text-white sm:text-5xl xl:text-6xl" />}
          <p data-caption-line className="caption-section-line">{line}</p>
        </m.div>
        <p className="mt-6 max-w-lg text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8">{description}</p>
        <RevealButton className="flex" flight={id}>
          <Link to={href} className="item-open group">
            {action}
            <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </RevealButton>
      </div>
    </m.div>
  </section>;
}
