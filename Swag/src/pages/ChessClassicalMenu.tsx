import { useEffect, useState } from "react";

import { Link } from "react-router-dom";

type ModeAccent = "amber" | "sky" | "emerald";

type ClassicMode = {
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

const modes: ClassicMode[] = [
  {
    title: "Play vs Computer",
    description: "Play against Stockfish with selectable difficulty levels.",
    path: "/games/chess/classic/ai",
    icon: "🤖",
    eyebrow: "Challenge the engine",
    accent: "sky",
    art: {
      main: "🤖",
      left: "♙ ♘",
      right: "♛ ♚",
      footer: "STOCKFISH · LEVELS · ANALYSIS",
    },
  },
  {
    title: "Hotseat",
    description: "Two players play locally on the same computer.",
    path: "/games/chess/classic/hotseat",
    icon: "👥",
    eyebrow: "One screen. Two players.",
    accent: "amber",
    art: {
      main: "♔",
      left: "WHITE",
      right: "BLACK",
      footer: "LOCAL · TURN BY TURN",
    },
  },
  {
    title: "Multiplayer",
    description: "Create or join an online chess room.",
    path: "/games/chess/classic/multiplayer",
    icon: "🌐",
    eyebrow: "Play online",
    accent: "emerald",
    art: {
      main: "🌐",
      left: "♔ ↔",
      right: "↔ ♚",
      footer: "ROOMS · ONLINE · LIVE",
    },
  },
];

const accentClasses: Record<ModeAccent, string> = {
  amber: "border-amber-400/20 bg-amber-400/[0.06] text-amber-300",
  sky: "border-sky-400/20 bg-sky-400/[0.06] text-sky-300",
  emerald: "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300",
};

const buttonClasses: Record<ModeAccent, string> = {
  amber: "bg-amber-300 text-zinc-950 hover:bg-amber-200",
  sky: "bg-sky-300 text-zinc-950 hover:bg-sky-200",
  emerald: "bg-emerald-300 text-zinc-950 hover:bg-emerald-200",
};

const glowClasses: Record<ModeAccent, string> = {
  amber: "from-amber-500/18 via-amber-500/[0.04] to-transparent",
  sky: "from-sky-500/18 via-sky-500/[0.04] to-transparent",
  emerald: "from-emerald-500/18 via-emerald-500/[0.04] to-transparent",
};

export default function ChessClassicMenu() {
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
              ♔
            </div>

            <Link
              to="/chess"
              className="text-xs font-bold text-zinc-500 transition hover:text-white"
            >
              ← Chess
            </Link>

            <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-400/10 text-3xl text-amber-200 shadow-inner">
              ♔
            </div>

            <div className="relative mt-6">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-400">
                Classic Chess
              </p>

              <h1 className="mt-2 text-4xl font-black tracking-tight text-white">
                Choose game mode
              </h1>

              <p className="mt-4 text-sm leading-6 text-zinc-500">
                Play locally, challenge Stockfish, or connect with another
                player online.
              </p>
            </div>
          </header>

          <ClassicPreview
            modes={modes}
            activeIndex={previewIndex}
            onChange={setPreviewIndex}
          />
        </section>

        <section className="mt-7 grid gap-5 md:grid-cols-3">
          {modes.map((mode, index) => (
            <ClassicModeCard key={mode.path} mode={mode} number={index + 1} />
          ))}
        </section>
      </div>
    </main>
  );
}

function ClassicPreview({
  modes,
  activeIndex,
  onChange,
}: {
  modes: ClassicMode[];
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
                  Play
                  <span>→</span>
                </Link>
              </div>

              <ClassicArtwork mode={mode} />
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

function ClassicModeCard({
  mode,
  number,
}: {
  mode: ClassicMode;
  number: number;
}) {
  return (
    <Link
      to={mode.path}
      className="
        group
        relative
        flex
        min-h-[390px]
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
      <ClassicArtwork mode={mode} />

      <div className="mt-5 flex items-center gap-3">
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

          <h2 className="mt-1 text-xl font-black text-white">{mode.title}</h2>
        </div>
      </div>

      <p className="mt-4 text-sm leading-6 text-zinc-500">{mode.description}</p>

      <div className="mt-auto pt-5">
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
          Play
          <span>→</span>
        </div>
      </div>
    </Link>
  );
}

function ClassicArtwork({ mode }: { mode: ClassicMode }) {
  return (
    <div
      className={`
        relative
        h-36
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

      <div className="absolute left-4 top-4 text-sm font-black tracking-widest opacity-55">
        {mode.art.left}
      </div>

      <div className="absolute right-4 top-4 text-sm font-black tracking-widest opacity-55">
        {mode.art.right}
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[58%] text-6xl font-black leading-none drop-shadow-[0_8px_20px_rgba(0,0,0,.5)] transition duration-500 group-hover:scale-110 group-hover:-rotate-3">
        {mode.art.main}
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-black uppercase tracking-[0.22em] opacity-45">
        {mode.art.footer}
      </div>
    </div>
  );
}
