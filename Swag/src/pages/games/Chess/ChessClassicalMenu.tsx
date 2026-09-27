import { ui, useUiLanguage } from "@/i18n/ui";
import { Link } from "react-router-dom";
import { NavigationControls, PlutoHomeLink } from "@/components/App/PublicHeader";

type Accent = "sky" | "emerald" | "amber";
type ModeKind = "singleplayer" | "multiplayer" | "hotseat";

type ClassicMode = {
  title: string;
  description: string;
  path: string;
  footer: string;
  eyebrow: string;
  accent: Accent;
  kind: ModeKind;
};

const modes: ClassicMode[] = [
  {
    title: "Singleplayer",
    description: "Challenge Stockfish with selectable difficulty levels.",
    path: "/games/chess/classic/ai",
    footer: "STOCKFISH · LEVELS · ANALYSIS",
    eyebrow: "Challenge the engine",
    accent: "sky",
    kind: "singleplayer",
  },
  {
    title: "Multiplayer",
    description: "Create or join an online chess room.",
    path: "/games/chess/classic/multiplayer",
    footer: "ROOMS · ONLINE · LIVE",
    eyebrow: "Play online",
    accent: "emerald",
    kind: "multiplayer",
  },
  {
    title: "Hotseat",
    description: "Two players play locally on the same computer.",
    path: "/games/chess/classic/hotseat",
    footer: "LOCAL · TURN BY TURN",
    eyebrow: "One screen · Two players",
    accent: "amber",
    kind: "hotseat",
  },
];

const accentStyles: Record<
  Accent,
  {
    border: string;
    eyebrow: string;
    iconBorder: string;
    iconBg: string;
    iconText: string;
    arrow: string;
    hoverGlow: string;
  }
> = {
  sky: {
    border: "border-sky-400/35 hover:border-sky-300/65",
    eyebrow: "text-sky-300/70",
    iconBorder: "border-sky-300/30",
    iconBg: "bg-sky-400/[0.08]",
    iconText: "text-sky-100",
    arrow: "border-sky-300/30 text-sky-300 group-hover:border-sky-300/55",
    hoverGlow: "group-hover:shadow-[0_18px_55px_rgba(14,165,233,.10)]",
  },
  emerald: {
    border: "border-emerald-400/35 hover:border-emerald-300/65",
    eyebrow: "text-emerald-300/70",
    iconBorder: "border-emerald-300/30",
    iconBg: "bg-emerald-400/[0.08]",
    iconText: "text-emerald-100",
    arrow:
      "border-emerald-300/30 text-emerald-300 group-hover:border-emerald-300/55",
    hoverGlow: "group-hover:shadow-[0_18px_55px_rgba(16,185,129,.10)]",
  },
  amber: {
    border: "border-amber-400/40 hover:border-amber-300/70",
    eyebrow: "text-amber-300/70",
    iconBorder: "border-amber-300/35",
    iconBg: "bg-amber-400/[0.09]",
    iconText: "text-amber-100",
    arrow: "border-amber-300/35 text-amber-300 group-hover:border-amber-300/60",
    hoverGlow: "group-hover:shadow-[0_18px_55px_rgba(245,158,11,.11)]",
  },
};

function SingleplayerIcon() {
  useUiLanguage();
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5.5 19c.75-3.5 3-5.25 6.5-5.25S17.75 15.5 18.5 19"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M18.25 5.75h2.25v2.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M20.5 5.75 17.8 8.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlobeIcon() {
  useUiLanguage();
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="8.25"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M3.9 12h16.2M12 3.75c2.2 2.2 3.3 4.95 3.3 8.25S14.2 18.05 12 20.25M12 3.75C9.8 5.95 8.7 8.7 8.7 12S9.8 18.05 12 20.25"
        stroke="currentColor"
        strokeWidth="1.35"
      />
    </svg>
  );
}

function PlayersIcon() {
  useUiLanguage();
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="2.75" stroke="currentColor" strokeWidth="1.6" />
      <circle
        cx="16.25"
        cy="9.1"
        r="2.15"
        stroke="currentColor"
        strokeWidth="1.45"
      />
      <path
        d="M3.75 18.5c.6-3.1 2.35-4.65 5.25-4.65s4.65 1.55 5.25 4.65"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14.1 14.7c2.95-.25 4.75 1 5.4 3.8"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ModeIcon({ kind }: { kind: ModeKind }) {
  useUiLanguage();
  if (kind === "singleplayer") return <SingleplayerIcon />;
  if (kind === "multiplayer") return <GlobeIcon />;
  return <PlayersIcon />;
}

function ModeDecoration({ kind }: { kind: ModeKind }) {
  useUiLanguage();
  if (kind === "singleplayer") {
    return (
      <>
        <div className="absolute right-24 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-sky-400/[0.07] blur-3xl" />
        <div className="absolute right-20 top-1/2 -translate-y-1/2 text-[104px] leading-none text-sky-100/[0.045]">
          ♙
        </div>
      </>
    );
  }

  if (kind === "multiplayer") {
    return (
      <>
        <div className="absolute right-24 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-emerald-400/[0.07] blur-3xl" />
        <div className="absolute right-16 top-1/2 -translate-y-1/2 text-[90px] leading-none text-emerald-100/[0.035]">
          ♞
        </div>
      </>
    );
  }

  return (
    <>
      <div className="absolute right-24 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-amber-400/[0.08] blur-3xl" />
      <div className="absolute right-16 top-1/2 -translate-y-1/2 text-[94px] leading-none text-amber-100/[0.04]">
        ♚
      </div>
    </>
  );
}

export default function ChessClassicalMenu() {
  useUiLanguage();
  return (
    <main className="chess-menu-page relative left-1/2 min-h-[var(--app-height)] w-screen -translate-x-1/2 overflow-hidden bg-[#07090b] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_13%_68%,rgba(245,158,11,.09),transparent_28%),radial-gradient(circle_at_76%_23%,rgba(255,255,255,.045),transparent_30%),linear-gradient(to_bottom,#0a0d10,#07090b_58%,#040506)]" />

      <div className="pointer-events-none absolute -bottom-28 -left-24 text-[390px] leading-none text-amber-100/[0.035]">
        ♚
      </div>
      <div className="pointer-events-none absolute bottom-[-72px] left-[25%] text-[250px] leading-none text-white/[0.018]">
        ♞
      </div>
      <div className="pointer-events-none absolute right-[-50px] top-[15%] text-[290px] leading-none text-white/[0.014]">
        ♝
      </div>

      <div className="relative flex min-h-[var(--app-height)] w-full flex-col">
        <nav className="flex min-h-20 w-full flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2 sm:px-10 lg:px-14 xl:px-20">
          <div className="inline-flex items-center gap-3"><PlutoHomeLink className="mr-2" />
          <Link to="/games/chess" className="inline-flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-lg text-amber-300">
              ♛
            </span>
            <span className="font-serif text-sm tracking-[0.28em] text-zinc-200">{ui("CHESS")}</span>
          </Link>
          </div>

          <NavigationControls />
        </nav>

        <section className="grid min-h-0 flex-1 lg:grid-cols-[minmax(360px,.88fr)_minmax(600px,1.12fr)]">
          {/* LEFT — TITLE / HERO */}
          <header className="relative flex min-h-[430px] flex-col justify-center px-7 py-14 sm:px-10 lg:min-h-0 lg:px-14 lg:py-16 xl:px-20 2xl:px-24">
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-white/10 to-transparent lg:block" />

            <div className="max-w-[620px]">
              <Link
                to="/games/chess"
                className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-600 transition hover:text-white"
              >
                <span>←</span>{ui("Chess")}</Link>

              <p className="text-[11px] font-black uppercase tracking-[0.34em] text-amber-400">{ui("Classic Chess")}</p>

              <h1 className="mt-5 font-serif text-[52px] leading-[.94] tracking-[-0.035em] text-white sm:text-[66px] xl:text-[82px]">{ui("Choose")}<br />
                <span className="text-amber-200">{ui("game mode")}</span>
              </h1>

              <p className="mt-6 max-w-[520px] font-serif text-[18px] leading-8 text-zinc-400 sm:text-[20px]">{ui("Play solo, connect with another player online, or share one screen locally.")}</p>
            </div>

            <div className="mt-12 flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.28em] text-zinc-700">
              <span className="h-px w-14 bg-amber-400/45" />{ui("Solo · Online · Local")}</div>

            <div className="pointer-events-none absolute bottom-[7%] right-[7%] hidden text-[185px] leading-none text-amber-100/[0.025] xl:block">
              ♔
            </div>
          </header>

          {/* RIGHT — MODE BUTTONS */}
          <div className="relative flex min-h-[560px] items-center border-t border-white/[0.06] px-5 py-8 sm:px-8 lg:min-h-0 lg:border-t-0 lg:px-10 lg:py-12 xl:px-14 2xl:px-20">
            <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4 xl:gap-5">
              {modes.map((mode) => {
                const styles = accentStyles[mode.accent];

                return (
                  <Link
                    key={mode.path}
                    to={mode.path}
                    className={`group relative overflow-hidden rounded-[22px] border bg-black/20 p-5 shadow-[0_16px_40px_rgba(0,0,0,.22)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 sm:p-6 xl:p-7 ${styles.border} ${styles.hoverGlow}`}
                  >
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,rgba(245,158,11,.04),transparent_42%)] opacity-0 transition duration-300 group-hover:opacity-100" />
                    <ModeDecoration kind={mode.kind} />

                    <div className="relative flex items-center gap-4 sm:gap-6">
                      <div
                        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border shadow-inner transition duration-300 sm:h-[74px] sm:w-[74px] ${styles.iconBorder} ${styles.iconBg} ${styles.iconText}`}
                      >
                        <ModeIcon kind={mode.kind} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-[9px] font-black uppercase tracking-[0.26em] ${styles.eyebrow}`}
                        >
                          {ui(mode.eyebrow)}
                        </p>

                        <h2 className="mt-1.5 font-serif text-[27px] leading-tight text-white sm:text-[31px] xl:text-[34px]">
                          {ui(mode.title)}
                        </h2>

                        <p className="mt-2 max-w-[650px] text-sm leading-6 text-zinc-500 sm:text-[15px]">
                          {ui(mode.description)}
                        </p>

                        <p className="mt-3 text-[8px] font-black uppercase tracking-[0.24em] text-zinc-700">
                          {ui(mode.footer)}
                        </p>
                      </div>

                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-xl transition duration-300 group-hover:translate-x-1 sm:h-12 sm:w-12 ${styles.arrow}`}
                      >
                        →
                      </span>
                    </div>
                  </Link>
                );
              })}

              <Link
                to="/games/chess/rules"
                className="group mt-2 flex items-center justify-between border-t border-white/[0.08] px-2 pt-6 text-sm text-zinc-500 transition hover:text-white"
              >
                <span className="inline-flex items-center gap-3">
                  <span className="text-lg">♔</span>{ui("Rules & Tips")}</span>
                <span className="transition duration-300 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
