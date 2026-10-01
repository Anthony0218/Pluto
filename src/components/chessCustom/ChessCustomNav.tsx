import { Link } from "react-router-dom";
import { chessCustomPath, routeArea, type ChessCustomRoute, type TopLevelArea } from "@/games/chess/custom/library/navigation";
import { ui } from "@/i18n/ui";
import { HelpIcon } from "./icons/ChessCustomIcons";
import { AREA_ICONS } from "./icons/stepIcons";

const AREAS: { id: TopLevelArea; label: string; to: ChessCustomRoute }[] = [
  { id: "library", label: "My Games", to: { view: "library" } },
  { id: "create", label: "Create", to: { view: "create", step: "overview" } },
  { id: "community", label: "Community", to: { view: "community" } },
];

/** The three Chess Custom areas. Editor steps live inside Create, never up here. */
export default function ChessCustomNav({ route, onShowGuide }: { route: ChessCustomRoute; onShowGuide: () => void }) {
  const active = routeArea(route);
  return (
    <div className="relative z-30 -mx-4 border-b border-white/[0.06] bg-[#07090b]/90 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
      <div className="flex items-center gap-2">
        <nav aria-label={ui("Chess Custom")} className="min-w-0 flex-1">
          <ul className="grid grid-cols-3 gap-1 sm:flex sm:gap-2">
            {AREAS.map((area) => {
              const Icon = AREA_ICONS[area.id];
              const current = active === area.id;
              return (
                <li key={area.id}>
                  <Link
                    to={chessCustomPath(area.to)}
                    data-guide={`nav-${area.id}`}
                    aria-current={current ? "page" : undefined}
                    className={`group relative flex flex-col items-center gap-1 rounded-t-xl px-3 pb-2.5 pt-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-300 sm:flex-row sm:gap-2 sm:px-4 sm:text-sm ${
                      current ? "text-amber-50" : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <Icon size={20} className={current ? "text-amber-300" : "text-zinc-500 transition group-hover:text-zinc-300"} />
                    <span className={current ? "font-bold" : ""}>{ui(area.label)}</span>
                    {/* The underline (not only colour) marks the current area. */}
                    <span aria-hidden="true" className={`absolute inset-x-3 -bottom-px h-[3px] rounded-full transition ${current ? "bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 shadow-[0_0_12px_rgba(252,211,77,.55)]" : "bg-transparent"}`} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <button
          type="button"
          onClick={onShowGuide}
          aria-label={ui("Show Guide")}
          title={ui("Show Guide")}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-xs font-semibold text-zinc-300 transition hover:border-amber-300/40 hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-amber-300"
        >
          <HelpIcon size={18} />
          <span className="hidden md:inline">{ui("Show Guide")}</span>
        </button>
      </div>
    </div>
  );
}
