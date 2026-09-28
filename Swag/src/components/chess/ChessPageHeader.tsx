import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Puzzle } from "lucide-react";
import { variants } from "@/data/chessVariants";
import { ui, useUiLanguage } from "@/i18n/ui";
import { NavigationControls } from "@/components/App/PublicHeader";
import { boardThemes, pieceThemes, useChessSettings, type BoardTheme, type PieceTheme } from "@/context/ChessSettingsContext";
import ChessPiece from "@/components/chess/ChessPiece";

function ChessAppearance() {
  const { pieceTheme, setPieceTheme, boardTheme, setBoardTheme } = useChessSettings();
  return <details className="chess-appearance relative z-50 text-sm text-zinc-200"><summary className="cursor-pointer rounded-lg border border-white/15 px-3 py-2 transition hover:border-amber-300/50 focus-visible:outline-2 focus-visible:outline-amber-300">{ui("Appearance")}</summary>
    <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-amber-300/30 bg-[#151515] p-3 shadow-2xl">
      <label className="block text-xs font-bold text-amber-200">{ui("Piece theme")}<select value={pieceTheme} onChange={event => setPieceTheme(event.target.value as PieceTheme)} className="mt-1 w-full rounded-lg border border-white/20 bg-[#202020] px-2 py-2 text-white">{pieceThemes.map(theme => <option key={theme} value={theme}>{ui(({ classic: "Classic", russian: "Russian Classic", geometric: "Geometric", elegant: "Elegant", jazz: "Jazz / Art Deco" } as Record<PieceTheme, string>)[theme])}</option>)}</select></label>
      <div aria-hidden="true" className="mt-2 flex justify-center overflow-hidden rounded-lg border border-white/15">{(["k", "n", "p", "k", "n", "p"] as const).map((type, index) => <span key={`${type}-${index}`} className={`grid h-12 w-9 place-items-center ${index % 2 ? "bg-[#80634d]" : "bg-[#ead7b7]"}`}>{pieceTheme === "classic" ? <span className="text-3xl text-black">{index < 3 ? ({ k: "♔", n: "♘", p: "♙" } as const)[type] : ({ k: "♚", n: "♞", p: "♟" } as const)[type]}</span> : <ChessPiece type={type} color={index < 3 ? "w" : "b"} theme={pieceTheme} />}</span>)}</div>
      <label className="mt-3 block text-xs font-bold text-amber-200">{ui("Board theme")}<select value={boardTheme} onChange={event => setBoardTheme(event.target.value as BoardTheme)} className="mt-1 w-full rounded-lg border border-white/20 bg-[#202020] px-2 py-2 text-white">{boardThemes.map(theme => <option key={theme} value={theme}>{ui(theme[0].toUpperCase() + theme.slice(1))}</option>)}</select></label>
    </div>
  </details>;
}

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
  const puzzle = pathname === "/games/chess/puzzles" || new URLSearchParams(search).get("tab") === "puzzles";
  const name = title ?? variant?.title ?? (puzzle ? "Chess Puzzle" : pathname.endsWith("/rules") ? "Chess Rules" : pathname.endsWith("/variants") ? "Chess Variants" : pathname.includes("/classic") ? "Chess Classic" : "Chess");
  const accent = accents[variant?.accent ?? (puzzle ? "violet" : "amber")];
  return <header className={`chess-page-header ${className}`} style={{ "--chess-header-accent": accent } as CSSProperties}>
    <div className="chess-header-brand">
      <Link to="/" className="chess-pluto">{ui("Pluto")}</Link>
      <span className="chess-header-icon" aria-hidden="true">{icon ?? (puzzle ? <Puzzle size={22} /> : variant?.icon ?? "♞")}</span>
      <div className="min-w-0"><span className="chess-header-name">{ui(name)}</span>{description && <p className="chess-header-description">{description}</p>}</div>
    </div>
    {children && <div className="chess-header-details">{children}</div>}
    <ChessAppearance />
    <NavigationControls />
  </header>;
}
