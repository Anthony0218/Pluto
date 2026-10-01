import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { ui, useUiLanguage } from "@/i18n/ui";
import { Link } from "react-router-dom";

type ChessMode = {
  title: string;
  description: string;
  path: string;
  icon: string;
  eyebrow: string;
  disabled?: boolean;
};

const modes: ChessMode[] = [
  {
    title: "Chess Classic",
    description: "Play the original game — solo, online, or locally.",
    path: "/games/chess/classic",
    icon: "♟",
    eyebrow: "The original game",
  },
  {
    title: "Chess Variants",
    description:
      "Explore different rules, unusual boards, and experimental ideas.",
    path: "/games/chess/variants",
    icon: "♞",
    eyebrow: "Break the rules",
  },
  {
    title: "Chess Custom",
    description: "Design pieces, boards, rules and events — then watch your variant play in 3D.",
    path: "/games/chess/custom",
    icon: "⚙",
    eyebrow: "Build your own",
  },
];

export default function ChessMenu() {
  useUiLanguage();
  return (
    /*
      `left-1/2 w-screen -translate-x-1/2` deliberately breaks out of a parent
      max-width/container so this page always fills the full viewport width.
    */
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
        <ChessPageHeader className="chess-menu-header">



        </ChessPageHeader>

        <section className="grid min-h-0 flex-1 lg:grid-cols-[minmax(360px,.88fr)_minmax(600px,1.12fr)]">
          <header className="relative flex min-h-[430px] flex-col justify-center px-7 py-14 sm:px-10 lg:min-h-0 lg:px-14 lg:py-16 xl:px-20 2xl:px-24">
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-white/10 to-transparent lg:block" />

            <div className="max-w-[620px]">
              <p className="text-[11px] font-black uppercase tracking-[0.34em] text-amber-400">{ui("Chess")}</p>
              <h1 className="mt-5 font-serif text-[52px] leading-[.94] tracking-[-0.035em] text-white sm:text-[66px] xl:text-[82px]">{ui("Choose your game")}</h1>
              <p className="mt-6 max-w-[500px] font-serif text-[18px] leading-8 text-zinc-400 sm:text-[20px]">{ui("Three ways to play. Same timeless game. Pick the experience that fits you.")}</p>
            </div>

            <div className="mt-12 flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.28em] text-zinc-700">
              <span className="h-px w-14 bg-amber-400/45" />{ui("Classic · Variants · Custom")}</div>          </header>

          <div className="relative flex min-h-[560px] items-center border-t border-white/[0.06] px-5 py-8 sm:px-8 lg:min-h-0 lg:border-t-0 lg:px-10 lg:py-12 xl:px-14 2xl:px-20">
            <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4 xl:gap-5">
              {modes.map((mode, index) => {
                const cardClassName = `group relative overflow-hidden rounded-[22px] border bg-black/20 p-5 shadow-[0_16px_40px_rgba(0,0,0,.22)] backdrop-blur-md sm:p-6 xl:p-7 ${mode.disabled ? "cursor-not-allowed border-white/[0.06]" : "transition duration-300 hover:-translate-y-0.5"} ${
                    index === 0
                      ? "border-amber-300/45 bg-amber-300/[0.035]"
                      : mode.disabled ? "" : "border-white/[0.09] hover:border-amber-300/30 hover:bg-white/[0.035]"
                  }`;
                const content = <>
                  {!mode.disabled && <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,rgba(245,158,11,.065),transparent_38%)] opacity-0 transition duration-300 group-hover:opacity-100" />}

                  <div className="relative flex items-center gap-4 sm:gap-6">
                    <div
                      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border text-[30px] shadow-inner transition duration-300 sm:h-[74px] sm:w-[74px] ${
                        index === 0
                          ? "border-amber-300/35 bg-amber-300/10 text-amber-200"
                          : mode.disabled
                            ? "border-white/[0.06] bg-white/[0.02] text-zinc-600"
                            : "border-white/10 bg-white/[0.035] text-zinc-400 group-hover:border-amber-300/25 group-hover:text-zinc-100"
                      }`}
                    >
                      {mode.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[9px] font-black uppercase tracking-[0.26em] ${index === 0 ? "text-amber-300/70" : "text-zinc-600"}`}
                      >
                        {ui(mode.eyebrow)}
                      </p>
                      <h2 className={`mt-1.5 font-serif text-[27px] leading-tight sm:text-[31px] xl:text-[34px] ${mode.disabled ? "text-zinc-500" : "text-white"}`}>
                        {ui(mode.title)} {mode.disabled && <span className="ml-2 inline-block align-middle rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 font-sans text-[10px] font-bold uppercase tracking-wider text-amber-200">{ui("Coming soon")}</span>}
                      </h2>
                      <p className="mt-2 max-w-[650px] text-sm leading-6 text-zinc-500 sm:text-[15px]">
                        {ui(mode.description)}
                      </p>
                    </div>

                    {!mode.disabled && <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-xl transition duration-300 group-hover:translate-x-1 sm:h-12 sm:w-12 ${
                        index === 0
                          ? "border-amber-300/45 text-amber-300"
                          : "border-white/10 text-zinc-500 group-hover:border-amber-300/35 group-hover:text-amber-300"
                      }`}
                    >
                      →
                    </span>}
                  </div>
                </>;
                return mode.disabled
                  ? <div key={mode.path} aria-disabled="true" className={cardClassName}>{content}</div>
                  : <Link key={mode.path} to={mode.path} className={cardClassName}>{content}</Link>;
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
