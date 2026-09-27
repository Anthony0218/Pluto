import { ui, useUiLanguage } from "@/i18n/ui";
import { useAppLanguage } from "@/i18n/languageStore";
import { LanguageSelector } from "@/games/chess/i18n/chessLanguage";
import { useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { headerSections } from "../../data/navigation";

export default function PublicHeader({
  navigationOpen,
  onToggleNavigation,
}: {
  navigationOpen: boolean;
  onToggleNavigation: () => void;
}) {
  useUiLanguage();
  const { user } = useAuth();
  const { language, setLanguage } = useAppLanguage();
  const [open, setOpen] = useState<string | null>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());

  return (
    <>
      {open && (
        <div
          aria-hidden="true"
          onPointerDown={() => setOpen(null)}
          className="fixed inset-0 top-16 z-[290] bg-black/45 backdrop-blur-md"
        />
      )}
      <header className="fixed inset-x-0 top-0 z-[300] h-16 border-b border-white/[0.06] bg-[#060816]/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1800px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button id="navigation-toggle" type="button" aria-label={navigationOpen ? "Close navigation" : "Open navigation"} aria-expanded={navigationOpen} aria-controls="app-navigation" onClick={() => { setOpen(null); onToggleNavigation(); }} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-zinc-200 hover:bg-white/10">
              {navigationOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
            <Link to="/" className="text-lg font-bold" onClick={() => setOpen(null)}>{ui("Pluto")}</Link>
          </div>
          <nav
            aria-label={ui("Explore Pluto")}
            className="hidden h-full items-center gap-2 lg:flex"
            onMouseLeave={() => setOpen(null)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setOpen(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && open) {
                const active = open;
                setOpen(null);
                triggers.current.get(active)?.focus();
              }
            }}
          >
            {headerSections.map((section) => {
              const expanded = open === section.title;
              const id = `header-${section.title.replaceAll(" ", "-").toLowerCase()}`;
              return (
                <div
                  key={section.title}
                  className="relative flex h-full items-center"
                  onMouseEnter={() => setOpen(section.title)}
                >
                  <button
                    ref={(element) => {
                      if (element) triggers.current.set(section.title, element);
                    }}
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={id}
                    onClick={() => setOpen(expanded ? null : section.title)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        setOpen(section.title);
                        window.requestAnimationFrame(() =>
                          document
                            .getElementById(id)
                            ?.querySelector<HTMLAnchorElement>("a")
                            ?.focus(),
                        );
                      }
                    }}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${expanded ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/5"}`}
                  >
                    {ui(section.title)}
                    <ChevronDown
                      size={14}
                      className={expanded ? "rotate-180" : ""}
                    />
                  </button>
                  {expanded && (
                    <div
                      id={id}
                      className="absolute left-1/2 top-full w-[min(430px,90vw)] -translate-x-1/2 pt-3"
                    >
                      <div className="max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-white/10 bg-[#0c1226] p-4 shadow-2xl shadow-black/40">
                        <p className="px-3 pb-3 pt-1 text-xs font-bold uppercase tracking-widest text-indigo-300">
                          {ui(section.title)}
                        </p>
                        <div className="grid gap-1">
                          {section.items.map((item) => (
                            <Link
                              key={item.route}
                              to={item.route}
                              onClick={() => setOpen(null)}
                              className="rounded-xl p-3 transition hover:bg-indigo-500/15 focus-visible:bg-indigo-500/15"
                            >
                              <p className="font-semibold">{ui(item.title)}</p>
                              <p className="mt-1 text-sm text-zinc-400">
                                {ui(item.description)}
                              </p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSelector language={language} onChange={setLanguage} />
            {!user && (
              <Link
                to="/login"
                className="hidden text-sm text-zinc-300 sm:block"
              >{ui("Log in")}</Link>
            )}
            <Link
              to="/dashboard"
              className="hidden sm:block rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold hover:bg-indigo-400 sm:px-4"
            >{ui("HOME")}</Link>
          </div>
        </div>
      </header>
    </>
  );
}
