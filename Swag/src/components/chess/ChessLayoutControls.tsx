import { ui, useUiLanguage } from "@/i18n/ui";
import { useState } from "react";
import { useLocation } from "react-router-dom";
export default function ChessLayoutControls() {
  useUiLanguage();
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState(false);
  if (!pathname.startsWith("/games/chess")) return null;
  return <>
    {hidden && <style>{ui(`.chess-game-grid > aside { display: none !important; } .chess-game-grid { grid-template-columns: minmax(0,var(--board-size,800px)) !important; width: min(100%,var(--board-size,800px)) !important; }`)}</style>}
    <button type="button" aria-pressed={!hidden} onClick={() => setHidden(!hidden)} className="chess-sidebar-toggle fixed bottom-4 left-4 z-[100] rounded-xl border border-white/15 bg-[#091019] px-3 py-2 text-xs text-zinc-200 shadow-xl">{hidden ? ui("Show sidebars") : ui("Hide sidebars")}</button>
  </>;
}
