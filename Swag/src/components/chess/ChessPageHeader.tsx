import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Puzzle } from "lucide-react";
import { variants } from "@/data/chessVariants";
import { ui, useUiLanguage } from "@/i18n/ui";
import { NavigationControls } from "@/components/App/PublicHeader";

const accents: Record<string, string> = {
  amber: "#fbbf24", red: "#f87171", violet: "#a78bfa", rose: "#fb7185",
  sky: "#38bdf8", emerald: "#34d399", zinc: "#d4d4d8", orange: "#fb923c",
  cyan: "#22d3ee", fuchsia: "#e879f9", indigo: "#818cf8", lime: "#a3e635",
  pink: "#f472b6", teal: "#2dd4bf", blue: "#60a5fa",
};

/** Lives inside the page's own header surface, including review and setup screens. */
export default function ChessPageHeader({ children, className = "", title, icon, description }: {
  children?: ReactNode; className?: string; title?: string; icon?: ReactNode; description?: ReactNode;
}) {
  useUiLanguage();
  const { pathname, search } = useLocation();
  const variant = variants.find(item => [item.route, item.aiRoute, item.multiplayerRoute, item.rulesRoute]
    .some(route => route && (pathname === route || pathname.startsWith(`${route}/`))));
  const puzzle = new URLSearchParams(search).get("tab") === "puzzles";
  const name = title ?? variant?.title ?? (puzzle ? "Chess Puzzle" : pathname.endsWith("/rules") ? "Chess Rules" : pathname.endsWith("/variants") ? "Chess Variants" : pathname.includes("/classic") ? "Chess Classic" : "Chess");
  const accent = accents[variant?.accent ?? (puzzle ? "violet" : "amber")];
  return <header className={`chess-page-header ${className}`} style={{ "--chess-header-accent": accent } as CSSProperties}>
    <div className="chess-header-brand">
      <Link to="/" className="chess-pluto">{ui("Pluto")}</Link>
      <span className="chess-header-icon" aria-hidden="true">{icon ?? (puzzle ? <Puzzle size={22} /> : variant?.icon ?? "♞")}</span>
      <div className="min-w-0"><span className="chess-header-name">{ui(name)}</span>{description && <p className="chess-header-description">{description}</p>}</div>
    </div>
    {children && <div className="chess-header-details">{children}</div>}
    <NavigationControls />
  </header>;
}
