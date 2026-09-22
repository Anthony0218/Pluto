import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

import chessIcon from "../../public/images/chess-game-icon.png";

type ModeAccent = "amber" | "violet" | "sky" | "emerald" | "rose";

type ChessMode = {
  title: string;
  description: string;
  path: string;
  icon: string;
  eyebrow: string;
  accent: ModeAccent;
  art: {
    main: string;
    left: string;
    right: string;
    footer: string;
  };
};

const modes: ChessMode[] = [
  {
    title: "Chess Classic",
    description: "Play standard chess against another player or the computer.",
    path: "/games/chess/classic",
    icon: "♟",
    eyebrow: "The original game",
    accent: "amber",
    art: {
      main: "♔",
      left: "♜ ♞ ♝",
      right: "♛ ♚",
      footer: "CLASSIC · AI · HOTSEAT · ONLINE",
    },
  },
  {
    title: "Chess Variants",
    description:
      "Explore completely different rule systems, unusual boards and experimental chess ideas.",
    path: "/games/chess/variants",
    icon: "♞",
    eyebrow: "Break the rules",
    accent: "violet",
    art: {
      main: "◈",
      left: "💣 ↻",
      right: "🎰 ☠",
      footer: "MUTATE · ROTATE · SURVIVE",
    },
  },
  {
    title: "Chess Custom",
    description:
      "Create and play chess games with your own rules, concepts and experimental setups.",
    path: "/games/chess/custom",
    icon: "⚙",
    eyebrow: "Build your own",
    accent: "sky",
    art: {
      main: "⚙",
      left: "♙ + ?",
      right: "▦ ✦",
      footer: "DESIGN · TEST · PLAY",
    },
  },
];

const accentClasses: Record<ModeAccent, string> = {
  amber: "border-amber-400/20 bg-amber-400/[0.06] text-amber-300",
  violet: "border-violet-400/20 bg-violet-400/[0.06] text-violet-300",
  sky: "border-sky-400/20 bg-sky-400/[0.06] text-sky-300",
  emerald: "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300",
  rose: "border-rose-400/20 bg-rose-400/[0.06] text-rose-300",
};

const buttonClasses: Record<ModeAccent, string> = {
  amber: "bg-amber-300 text-zinc-950 hover:bg-amber-200",
  violet: "bg-violet-300 text-zinc-950 hover:bg-violet-200",
  sky: "bg-sky-300 text-zinc-950 hover:bg-sky-200",
  emerald: "bg-emerald-300 text-zinc-950 hover:bg-emerald-200",
  rose: "bg-rose-300 text-zinc-950 hover:bg-rose-200",
};

const glowClasses: Record<ModeAccent, string> = {
  amber: "from-amber-500/18 via-amber-500/[0.04] to-transparent",
  violet: "from-violet-500/18 via-violet-500/[0.04] to-transparent",
  sky: "from-sky-500/18 via-sky-500/[0.04] to-transparent",
  emerald: "from-emerald-500/18 via-emerald-500/[0.04] to-transparent",
  rose: "from-rose-500/18 via-rose-500/[0.04] to-transparent",
};

export default function ChessMenu() {
  const [previewIndex, setPreviewIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPreviewIndex((current) => (current + 1) % modes.length);
    }, 3800);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div
        className="
          pointer-events-none
          fixed
          inset-0
          bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.07),transparent_34%)]
        "
      />

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <header
            className="
              relative
              flex
              min-h-[360px]
              flex-col
              overflow-hidden
              rounded-3xl
              border
              border-amber-400/10
              bg-zinc-900/60
              p-6
              shadow-xl
              shadow-black/20
              backdrop-blur-md
              lg:aspect-square
            "
          >
            <div
              className="
                pointer-events-none
                absolute
                -right-14
                -top-14
                text-[210px]
                font-black
                leading-none
                text-amber-300/[0.025]
              "
            >
              ♞
            </div>

            <div
              className="
                flex
                h-14
                w-14
                items-center
                justify-center
                rounded-2xl
                border
                border-amber-500/20
                bg-amber-400/10
                text-3xl
                text-amber-200
                shadow-inner
              "
            >
              ♞
            </div>

            <div className="relative mt-7">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-400">
                Chess
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-tight text-white">
                Choose your game
              </h1>

              <p className="mt-3 text-xs leading-5 text-zinc-500">
                Play traditional chess, explore experimental variants, or build
                your own rules.
              </p>
            </div>
          </header>

          <ModePreview
            modes={modes}
            activeIndex={previewIndex}
            onChange={setPreviewIndex}
          />
        </section>

        <section className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="grid gap-4 md:grid-cols-3">
            {modes.map((mode, index) => (
              <ModeCard key={mode.path} mode={mode} number={index + 1} />
            ))}
          </div>

          <Link
            to="/games/chess/rules"
            className="
              group
              relative
              min-h-[310px]
              overflow-hidden
              rounded-3xl
              border
              border-white/10
              shadow-xl
              shadow-black/20
              transition
              duration-300
              hover:-translate-y-1
              hover:border-amber-400/40
              lg:min-h-full
            "
          >
            <div
              className="
                absolute
                inset-0
                bg-cover
                bg-center
                transition
                duration-700
                group-hover:scale-105
              "
              style={{
                backgroundImage: `url(${chessIcon})`,
              }}
            />

            <div
              className="
                absolute
                inset-0
                bg-gradient-to-b
                from-zinc-950/45
                via-zinc-950/75
                to-zinc-950
              "
            />

            <div
              className="
                pointer-events-none
                absolute
                inset-0
                bg-[radial-gradient(circle_at_50%_18%,rgba(251,191,36,.12),transparent_28%)]
              "
            />

            <div className="relative z-10 flex h-full min-h-[310px] flex-col p-5 sm:p-6">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                ♔ Learn Chess
              </div>

              <div className="mt-auto">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-400/80">
                  Rules · Tactics · Strategy
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
                  Chess Rules & Tips
                </h2>

                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Learn how the pieces move, understand check and checkmate,
                  discover tactical ideas and build a stronger strategic
                  foundation.
                </p>

                <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-black text-zinc-950 transition group-hover:gap-3 group-hover:bg-amber-200">
                  Rules & Tips
                  <span>→</span>
                </div>
              </div>
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}

function ModePreview({
  modes,
  activeIndex,
  onChange,
}: {
  modes: ChessMode[];
  activeIndex: number;
  onChange: (index: number) => void;
}) {
  return (
    <section
      className="
        relative
        min-h-[360px]
        overflow-hidden
        rounded-3xl
        border
        border-white/10
        bg-zinc-900/65
        shadow-xl
        shadow-black/20
        backdrop-blur-md
      "
    >
      <div
        className="
          relative
          flex
          h-full
          transition-transform
          duration-700
          ease-[cubic-bezier(.22,1,.36,1)]
        "
        style={{
          transform: `translateX(-${activeIndex * 100}%)`,
        }}
      >
        {modes.map((mode) => (
          <div key={mode.path} className="min-w-full p-5 sm:p-6">
            <div className="grid min-h-[310px] items-center gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
              <div>
                <p
                  className={`text-[10px] font-black uppercase tracking-[0.24em] ${
                    accentClasses[mode.accent]
                  }
                      border-0 bg-transparent`}
                >
                  {mode.eyebrow}
                </p>

                <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  {mode.title}
                </h2>

                <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-500">
                  {mode.description}
                </p>

                <Link
                  to={mode.path}
                  className={`
                      mt-6
                      inline-flex
                      items-center
                      gap-2
                      rounded-xl
                      px-4
                      py-3
                      text-sm
                      font-black
                      transition
                      ${buttonClasses[mode.accent]}
                    `}
                >
                  Open mode
                  <span>→</span>
                </Link>
              </div>

              <ModeArtwork mode={mode} />
            </div>
          </div>
        ))}
      </div>

      <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between">
        <div className="flex gap-1.5">
          {modes.map((mode, index) => (
            <button
              key={mode.path}
              type="button"
              onClick={() => onChange(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === activeIndex
                  ? "w-7 bg-white/65"
                  : "w-1.5 bg-white/15 hover:bg-white/30"
              }`}
              aria-label={mode.title}
            />
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              onChange((activeIndex - 1 + modes.length) % modes.length)
            }
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/25 text-lg font-black text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={() => onChange((activeIndex + 1) % modes.length)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/25 text-lg font-black text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}

function ModeCard({ mode, number }: { mode: ChessMode; number: number }) {
  return (
    <Link
      to={mode.path}
      className="
        group
        relative
        flex
        min-h-[300px]
        flex-col
        overflow-hidden
        rounded-3xl
        border
        border-white/10
        bg-zinc-900/70
        p-4
        shadow-xl
        shadow-black/20
        transition
        duration-300
        hover:-translate-y-1.5
        hover:border-white/20
        hover:bg-zinc-900
      "
    >
      <ModeArtwork mode={mode} compact />

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`
              flex
              h-10
              w-10
              shrink-0
              items-center
              justify-center
              rounded-xl
              border
              text-xl
              ${accentClasses[mode.accent]}
            `}
          >
            {mode.icon}
          </div>

          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
              {String(number).padStart(2, "0")} · {mode.eyebrow}
            </p>

            <h2 className="mt-1 text-lg font-black text-white">{mode.title}</h2>
          </div>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-zinc-500">{mode.description}</p>

      <div className="mt-auto pt-4">
        <div
          className={`
            flex
            w-full
            items-center
            justify-center
            gap-2
            rounded-xl
            px-4
            py-3
            text-sm
            font-black
            transition
            ${buttonClasses[mode.accent]}
          `}
        >
          Open mode
          <span>→</span>
        </div>
      </div>
    </Link>
  );
}

function ModeArtwork({
  mode,
  compact = false,
}: {
  mode: ChessMode;
  compact?: boolean;
}) {
  return (
    <div
      className={`
        relative
        ${compact ? "h-24" : "h-36"}
        overflow-hidden
        rounded-2xl
        border
        ${accentClasses[mode.accent]}
        bg-gradient-to-br
        ${glowClasses[mode.accent]}
      `}
    >
      <div
        className="
          pointer-events-none
          absolute
          inset-0
          opacity-[0.08]
          [background-image:linear-gradient(rgba(255,255,255,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.55)_1px,transparent_1px)]
          [background-size:25%_25%]
        "
      />

      <div className="absolute left-4 top-4 whitespace-pre text-sm font-black tracking-widest opacity-55">
        {mode.art.left}
      </div>

      <div className="absolute right-4 top-4 whitespace-pre text-sm font-black tracking-widest opacity-55">
        {mode.art.right}
      </div>

      <div
        className={`
          absolute
          left-1/2
          top-1/2
          -translate-x-1/2
          -translate-y-[58%]
          font-black
          leading-none
          drop-shadow-[0_8px_20px_rgba(0,0,0,.5)]
          transition
          duration-500
          group-hover:scale-110
          group-hover:-rotate-3
          ${compact ? "text-4xl" : "text-6xl"}
        `}
      >
        {mode.art.main}
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-black uppercase tracking-[0.22em] opacity-45">
        {mode.art.footer}
      </div>
    </div>
  );
}
