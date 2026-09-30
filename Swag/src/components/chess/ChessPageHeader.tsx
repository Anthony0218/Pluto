import type { CSSProperties, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { variants } from "@/data/chessVariants";
import { ui, useUiLanguage } from "@/i18n/ui";
import { HeaderBrand, NavigationControls } from "@/components/App/PublicHeader";
import { boardColors, boardThemes, pieceThemes, useChessSettings, type BoardTheme, type PieceTheme } from "@/context/ChessSettingsContext";
import ChessPiece from "@/components/chess/ChessPiece";
import { ChessAudioMenu } from "@/components/chess/ChessAudioSettings";
import BoardAnimationToggle from "@/components/chess/singleplayer/BoardAnimationToggle";

const previewSymbols = { k: ["♔", "♚"], q: ["♕", "♛"], r: ["♖", "♜"], b: ["♗", "♝"], n: ["♘", "♞"], p: ["♙", "♟"] } as const;
const previewTypes = ["k", "q", "r", "b", "n", "p"] as const;

/** A two-rank strip of the real board: white pieces over black, on the chosen board colours. */
function AppearancePreview({ pieceTheme, boardTheme }: { pieceTheme: PieceTheme; boardTheme: BoardTheme }) {
  const colors = boardColors[boardTheme];
  return <div aria-hidden="true" className="mt-2 grid grid-cols-6 overflow-hidden rounded-lg border-2" style={{ borderColor: colors.frame, backgroundColor: colors.frame }}>
    {(["w", "b"] as const).flatMap((color, row) => previewTypes.map((type, column) => <span key={`${color}${type}`} className="relative grid aspect-square place-items-center overflow-hidden" style={{ backgroundColor: (row + column) % 2 ? colors.dark : colors.light }}>
      {pieceTheme === "classic"
        ? <span className={`font-serif text-[22px] leading-none ${color === "w" ? "text-[#fff3d5] [text-shadow:0_1px_0_#fff,0_2px_2px_rgba(0,0,0,.75)]" : "text-[#1b1b1b] [text-shadow:0_1px_0_rgba(255,255,255,.35),0_2px_2px_rgba(0,0,0,.65)]"}`}>{previewSymbols[type][color === "w" ? 0 : 1]}</span>
        : <span className="absolute inset-0 flex items-center justify-center"><ChessPiece type={type} color={color} theme={pieceTheme} /></span>}
    </span>))}
  </div>;
}

/** Themes are picked by number; the preview shows what each one looks like. */
function ChessAppearance() {
  const { pieceTheme, setPieceTheme, boardTheme, setBoardTheme } = useChessSettings();
  const select = "mt-1 w-full rounded-lg border border-white/20 bg-[#202020] px-2 py-2 text-white";
  return <details className="chess-appearance relative z-50 text-sm text-zinc-200"><summary className="cursor-pointer rounded-lg border border-white/15 px-3 py-2 transition hover:border-amber-300/50 focus-visible:outline-2 focus-visible:outline-amber-300">{ui("Appearance")}</summary>
    <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-amber-300/30 bg-[#151515] p-3 shadow-2xl">
      <label className="block text-xs font-bold text-amber-200">{ui("Piece theme")}<select value={pieceTheme} onChange={event => setPieceTheme(event.target.value as PieceTheme)} className={select}>{pieceThemes.map((theme, index) => <option key={theme} value={theme}>{index + 1}</option>)}</select></label>
      <label className="mt-3 block text-xs font-bold text-amber-200">{ui("Board theme")}<select value={boardTheme} onChange={event => setBoardTheme(event.target.value as BoardTheme)} className={select}>{boardThemes.map((theme, index) => <option key={theme} value={theme}>{index + 1}</option>)}</select></label>
      <AppearancePreview pieceTheme={pieceTheme} boardTheme={boardTheme} />
    </div>
  </details>;
}

const accents: Record<string, string> = {
  amber: "#fbbf24", red: "#f87171", violet: "#a78bfa", rose: "#fb7185",
  sky: "#38bdf8", emerald: "#34d399", zinc: "#d4d4d8", orange: "#fb923c",
  cyan: "#22d3ee", fuchsia: "#e879f9", indigo: "#818cf8", lime: "#a3e635",
  pink: "#f472b6", teal: "#2dd4bf", blue: "#60a5fa",
};

/** The play mode the URL belongs to, so every game page can show "Pluto : Game / Mode · detail". */
function playMode(pathname: string) {
  const segments = pathname.split("/");
  if (segments.includes("rules")) return undefined;
  if (segments.includes("hotseat")) return "Hotseat";
  if (segments.includes("ai")) return "Singleplayer";
  if (segments.includes("multiplayer") || segments.includes("ranked")) return "Multiplayer";
  return undefined;
}

/** Lives inside the page's own header surface, including review and setup screens. */
export default function ChessPageHeader({ children, className = "", title, description }: {
  children?: ReactNode; className?: string; title?: string; description?: ReactNode;
}) {
  useUiLanguage();
  const { pathname, search } = useLocation();
  const variant = variants.find(item => [item.route, item.aiRoute, item.multiplayerRoute, item.rulesRoute]
    .some(route => route && (pathname === route || pathname.startsWith(`${route}/`))));
  const puzzle = pathname === "/games/chess/puzzles" || new URLSearchParams(search).get("tab") === "puzzles";
  const name = title ?? variant?.title ?? (puzzle ? "Chess Puzzle" : pathname.endsWith("/rules") ? "Chess Rules" : pathname.endsWith("/variants") ? "Chess Variants" : pathname.includes("/classic") ? "Classic Chess" : "Chess");
  const accent = accents[variant?.accent ?? (puzzle ? "violet" : "amber")];
  const mode = playMode(pathname);
  return <header className={`chess-page-header ${className}`} style={{ "--chess-header-accent": accent } as CSSProperties}>
    <HeaderBrand name={name} mode={mode} description={description} />
    {children && <div className="chess-header-details">{children}</div>}
    {mode === "Hotseat" && !pathname.includes("/3dchess") && <BoardAnimationToggle />}
    <ChessAudioMenu />
    <ChessAppearance />
    <NavigationControls />
  </header>;
}
