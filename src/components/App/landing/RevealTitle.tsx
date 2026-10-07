import * as m from "motion/react-m";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export type TitleLine = { text: string; accent?: boolean };

const word = { hidden: { y: "105%", opacity: 0 }, show: { y: "0%", opacity: 1 } };

/** A heading whose words rise into place, one after another, the first time it scrolls into view. */
export default function RevealTitle({ lines, className = "" }: { lines: TitleLine[]; className?: string }) {
  const reducedMotion = useReducedMotion();
  return <m.h2 className={className} initial={reducedMotion ? "show" : "hidden"} whileInView="show" viewport={{ once: true, amount: 0.7 }} transition={{ staggerChildren: 0.055 }}>
    {lines.map(line => <span key={line.text} className={`block${line.accent ? " section-accent" : ""}`}>
      {line.text.split(" ").map((part, index) => <span key={index} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
        <m.span className="inline-block" variants={word} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>{part}{" "}</m.span>
      </span>)}
    </span>)}
  </m.h2>;
}
