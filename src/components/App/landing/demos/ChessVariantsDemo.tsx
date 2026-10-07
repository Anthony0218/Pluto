import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import * as m from "motion/react-m";
import { menuVariants } from "@/data/chessVariants";
import { ui, useUiLanguage } from "@/i18n/ui";
import DemoFrame from "./DemoFrame";

const accents: Record<string, string> = { red: "#f87171", violet: "#a78bfa", amber: "#fbbf24", rose: "#fb7185", sky: "#38bdf8", emerald: "#34d399", zinc: "#a1a1aa", orange: "#fb923c", cyan: "#22d3ee", fuchsia: "#e879f9", indigo: "#818cf8", lime: "#a3e635", pink: "#f472b6", teal: "#2dd4bf", blue: "#60a5fa" };

/** A taste of the variants: each card links straight to that variant. */
export default function ChessVariantsDemo() {
  useUiLanguage();
  const variants = menuVariants.filter(variant => variant.available && !variant.customOnly && variant.route).slice(0, 6);
  return <DemoFrame tone="chess" title={ui("Chess Variants")} href="/games/chess/variants" action={ui("All variants")}>
    <ul className="variant-grid">
      {variants.map((variant, index) => <m.li key={variant.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
        <Link to={variant.route!} className="variant-card" style={{ "--variant": accents[variant.accent] ?? "#a5b4fc" } as React.CSSProperties}>
          <span className="variant-icon" aria-hidden="true">{variant.icon}</span>
          <strong>{ui(variant.title)}</strong>
          <small>{ui(variant.subtitle)}</small>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </m.li>)}
    </ul>
  </DemoFrame>;
}
