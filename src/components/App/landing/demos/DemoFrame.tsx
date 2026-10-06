import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useCopy } from "../copy";
import { toneOf, type ToneName } from "../tones";

/** The shared card every landing demo sits in: title, a "demo" badge in the game's colour, and a link to the real game. */
export default function DemoFrame({ tone, title, icon, children, href, action, className = "" }: {
  tone: ToneName; title: string; icon?: ReactNode; children: ReactNode; href?: string; action?: string; className?: string;
}) {
  const text = useCopy();
  const colors = toneOf(tone);
  return <section className={`demo-frame ${className}`} style={{ "--demo-accent": colors.glow, "--demo-base": colors.base } as CSSProperties} aria-label={title}>
    <header className="demo-head">
      <span className="demo-title">{icon}{title}</span>
      <span className="demo-badge">{text("demoBadge")}</span>
    </header>
    <div className="demo-body">{children}</div>
    {href && action && <footer className="demo-foot"><Link to={href} className="demo-link">{action}<ArrowRight size={15} aria-hidden="true" /></Link></footer>}
  </section>;
}

