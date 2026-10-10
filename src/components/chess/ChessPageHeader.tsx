import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import type { CSSProperties, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { variants } from "@/data/chessVariants";
import { ui, useUiLanguage } from "@/i18n/ui";
import { HeaderBrand, NavigationControls } from "@/components/App/PublicHeader";
import { boardColors, boardThemes, pieceThemes, useChessSettings, type BoardTheme, type PieceTheme } from "@/context/ChessSettingsContext";
import ChessPiece from "@/components/chess/ChessPiece";
import { chessPieceAssetThemes } from "@/assets/chess/themes";
import { ChessAudioMenu } from "@/components/chess/ChessAudioSettings";
import BoardAnimationToggle from "@/components/chess/singleplayer/BoardAnimationToggle";

const previewSymbols = { k: ["♔", "♚"], q: ["♕", "♛"], r: ["♖", "♜"], b: ["♗", "♝"], n: ["♘", "♞"], p: ["♙", "♟"] } as const;
const previewTypes = ["k", "q", "r", "b", "n", "p"] as const;
// The PNGs have different transparent top margins. These heights align the visible knights.
const knightPreviewHeights = { russian: 46, geometric: 49, elegant: 48, jazz: 53 } as const;

/** A two-rank strip of the real board: white pieces over black, on the chosen board colours. */
function AppearancePreview({ pieceTheme, boardTheme }: { pieceTheme: PieceTheme; boardTheme: BoardTheme }) {
  useGameLanguage();
  const colors = boardColors[boardTheme];
  return <div aria-hidden="true" className="mt-2 grid grid-cols-6 overflow-hidden rounded-lg border-2" style={{ borderColor: colors.frame, backgroundColor: colors.frame }}>
    {(["w", "b"] as const).flatMap((color, row) => previewTypes.map((type, column) => <span key={`${color}${type}`} className="relative grid aspect-square place-items-center overflow-hidden" style={{ backgroundColor: (row + column) % 2 ? colors.dark : colors.light }}>
      {pieceTheme === "classic"
        ? <span className={`font-serif text-[22px] leading-none ${color === "w" ? "text-[#fff3d5] [text-shadow:0_1px_0_#fff,0_2px_2px_rgba(0,0,0,.75)]" : "text-[#1b1b1b] [text-shadow:0_1px_0_rgba(255,255,255,.35),0_2px_2px_rgba(0,0,0,.65)]"}`}>{gameUi(previewSymbols[type][color === "w" ? 0 : 1])}</span>
        : <span className="absolute inset-0 flex items-center justify-center"><ChessPiece type={type} color={color} theme={pieceTheme} /></span>}
    </span>))}
  </div>;
}

/** Themes are picked by number; the preview shows what each one looks like. */
function ChessAppearance() {
  useGameLanguage();
  const { pieceTheme, setPieceTheme, boardTheme, setBoardTheme } = useChessSettings();
  return <details className="chess-appearance relative z-50 text-sm text-zinc-200"><summary className="cursor-pointer rounded-lg border border-white/15 px-3 py-2 transition hover:border-amber-300/50 focus-visible:outline-2 focus-visible:outline-amber-300">{ui("Appearance")}</summary>
    <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-amber-300/30 bg-[#151515] p-3 shadow-2xl">
      <fieldset>
        <legend className="text-xs font-bold text-amber-200">{ui("Piece theme")}</legend>
        <div className="mt-2 grid grid-cols-5 gap-1.5">
          {pieceThemes.map((theme, index) => <button key={theme} type="button" aria-label={gameUi(`${ui("Piece theme")} ${index + 1}`)} aria-pressed={pieceTheme === theme} onClick={() => setPieceTheme(theme)} className={`flex min-w-0 flex-col items-center rounded-lg border p-1.5 transition hover:border-amber-300/60 focus-visible:outline-2 focus-visible:outline-amber-300 ${pieceTheme === theme ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/15 bg-white/[0.04] text-zinc-400"}`}>
            <span aria-hidden="true" className="relative block h-10 w-10 overflow-hidden rounded-md bg-[#5a4938]">{theme === "classic" ? <span className="absolute inset-0 grid place-items-center font-serif text-[38px] leading-none text-[#fff3d5]">♘</span> : <img src={chessPieceAssetThemes[theme].pieces.wN} alt="" draggable={false} className="pointer-events-none absolute bottom-0 left-1/2 w-auto max-w-none -translate-x-1/2 select-none" style={{ height: knightPreviewHeights[theme] }} />}</span>
            <span className="mt-1 text-[11px] font-semibold">{gameUi(index + 1)}</span>
          </button>)}
        </div>
      </fieldset>
      <fieldset className="mt-4">
        <legend className="text-xs font-bold text-amber-200">{ui("Board theme")}</legend>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {boardThemes.map((theme, index) => {
            const colors = boardColors[theme];
            return <button key={theme} type="button" aria-label={gameUi(`${ui("Board theme")} ${index + 1}`)} aria-pressed={boardTheme === theme} onClick={() => setBoardTheme(theme)} className={`flex min-w-0 flex-col items-center rounded-lg border p-1.5 transition hover:border-amber-300/60 focus-visible:outline-2 focus-visible:outline-amber-300 ${boardTheme === theme ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/15 bg-white/[0.04] text-zinc-400"}`}>
              <span aria-hidden="true" className="grid h-10 w-full grid-cols-4 overflow-hidden rounded-[3px] border-2" style={{ borderColor: colors.frame }}>
                {Array.from({ length: 16 }, (_, square) => <span key={square} style={{ backgroundColor: (Math.floor(square / 4) + square % 4) % 2 ? colors.dark : colors.light }} />)}
              </span>
              <span className="mt-1 text-[11px] font-semibold">{gameUi(index + 1)}</span>
            </button>;
          })}
        </div>
      </fieldset>
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
  if (segments.includes("ai") || segments.includes("singleplayer")) return "Singleplayer";
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
    <HeaderBrand name={name} mode={mode} description={gameUi(description)} />
    {children && <div className="chess-header-details">{gameUi(children)}</div>}
    {mode === "Hotseat" && !pathname.includes("/3dchess") && !pathname.startsWith("/chess-custom") && <BoardAnimationToggle />}
    <ChessAudioMenu />
    <ChessAppearance />
    <NavigationControls />
  </header>;
}
