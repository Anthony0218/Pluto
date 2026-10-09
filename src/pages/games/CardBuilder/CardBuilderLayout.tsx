import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** Page frame shared by the card builder pages. */
export default function CardBuilderLayout({ children, crumbs = [] }: { children: ReactNode; crumbs?: { to?: string; label: string }[] }) {
  useGameLanguage();
  return (
    <main className="relative min-h-[var(--app-height)] px-4 pb-16 pt-6 text-zinc-100 sm:px-6">
      <div className="pointer-events-none fixed inset-0 -z-0 bg-[radial-gradient(circle_at_15%_10%,rgba(16,185,129,.07),transparent_32%),radial-gradient(circle_at_85%_85%,rgba(245,158,11,.06),transparent_30%)]" />
      <div className="relative mx-auto w-full max-w-[1500px]">
        <nav aria-label={gameUi("Breadcrumb")} className="mb-4 text-xs text-zinc-500">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link className="hover:text-amber-200" to="/games">{gameUi(" Games ")}</Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link className="hover:text-amber-200" to="/games/card-builder">{gameUi(" Card Builder ")}</Link>
            </li>
            {crumbs.map((crumb) => (
              <li key={crumb.label} className="flex items-center gap-1.5">
                <span aria-hidden>/</span>
                {gameUi(crumb.to ? (
                  <Link className="hover:text-amber-200" to={crumb.to}>
                    {gameUi(crumb.label)}
                  </Link>
                ) : (
                  <span className="text-zinc-300">{gameUi(crumb.label)}</span>
                ))}
              </li>
            ))}
          </ol>
        </nav>
        {gameUi(children)}
      </div>
    </main>
  );
}

/** Top-level tabs of the card builder. */
export function CardBuilderTabs({ active }: { active: "games" | "simulation" }) {
  useGameLanguage();
  const tabs = [
    { id: "games", label: "Templates & my games", to: "/games/card-builder" },
    { id: "simulation", label: "Simulation", to: "/games/card-builder/simulation" },
  ] as const;
  return (
    <nav aria-label={gameUi("Card builder")} className="mb-6 flex gap-1 border-b border-white/[0.08]">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          to={tab.to}
          aria-current={active === tab.id ? "page" : undefined}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition ${active === tab.id ? "border-amber-300 text-amber-100" : "border-transparent text-zinc-400 hover:text-white"}`}
        >
          {gameUi(tab.label)}
        </Link>
      ))}
    </nav>
  );
}
