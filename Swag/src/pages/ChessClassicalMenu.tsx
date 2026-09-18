import { Link } from "react-router-dom";

import chessIcon from "../../public/images/chess-game-icon.png";

export default function ChessClassicMenu() {
  const modes = [
    {
      title: "Play vs Computer",
      description: "Play against Stockfish with selectable difficulty levels.",
      path: "/chess/classic/ai",
      icon: "🤖",
    },
    {
      title: "Hotseat",
      description: "Two players play locally on the same computer.",
      path: "/chess/classic/hotseat",
      icon: "👥",
    },
    {
      title: "Multiplayer",
      description: "Create or join an online chess room.",
      path: "/chess/classic/multiplayer",
      icon: "🌐",
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/chess"
          className="
            text-sm
            font-semibold
            text-zinc-400
            transition
            hover:text-white
          "
        >
          ← Schach
        </Link>

        {/* =====================================================
            HEADER
           ===================================================== */}

        <div className="mt-8 text-center">
          <p
            className="
              text-xs
              font-bold
              uppercase
              tracking-[0.3em]
              text-amber-400
            "
          >
            Classic Chess
          </p>

          <h1 className="mt-3 text-4xl font-black">Choose game mode</h1>
        </div>

        {/* =====================================================
            GAME MODES
           ===================================================== */}

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {modes.map((mode) => (
            <Link
              key={mode.path}
              to={mode.path}
              className="
                group
                rounded-3xl
                border
                border-white/10
                bg-zinc-900
                p-7
                transition
                hover:-translate-y-1
                hover:border-amber-400/50
                hover:bg-zinc-800
              "
            >
              <div className="text-5xl">{mode.icon}</div>

              <h2 className="mt-6 text-2xl font-black">{mode.title}</h2>

              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {mode.description}
              </p>

              <p className="mt-6 text-sm font-bold text-amber-400">Spielen →</p>
            </Link>
          ))}
        </div>

        {/* =====================================================
            CHESS RULES / LEARN CARD
           ===================================================== */}

        <Link
          to="/chess/rules"
          className="
            group
            relative
            mt-8
            block
            min-h-[230px]
            overflow-hidden
            rounded-3xl
            border
            border-white/10
            transition
            duration-300
            hover:-translate-y-1
            hover:border-amber-400/50
          "
        >
          {/* BACKGROUND IMAGE */}

          <div
            className="
              absolute
              inset-0
              bg-cover
              bg-center
              transition
              duration-500
              group-hover:scale-105
            "
            style={{
              backgroundImage: `url(${chessIcon})`,
            }}
          />

          {/* DARK OVERLAY */}

          <div
            className="
              absolute
              inset-0
              bg-gradient-to-r
              from-black/95
              via-black/75
              to-black/30
              transition
              duration-300
              group-hover:via-black/65
            "
          />

          {/* CONTENT */}

          <div
            className="
              relative
              z-10
              flex
              min-h-[230px]
              items-center
              p-8
              sm:p-10
            "
          >
            <div className="max-w-xl">
              <div
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-amber-400/20
                  bg-amber-400/10
                  px-3
                  py-1.5
                  text-[10px]
                  font-black
                  uppercase
                  tracking-[0.2em]
                  text-amber-300
                "
              >
                ♔ Learn Chess
              </div>

              <h2
                className="
                  mt-4
                  text-3xl
                  font-black
                  tracking-tight
                  text-white
                  sm:text-4xl
                "
              >
                Chess Rules & Tips
              </h2>

              <p
                className="
                  mt-3
                  max-w-lg
                  text-sm
                  leading-6
                  text-zinc-300
                "
              >
                Learn how the pieces move, understand check and checkmate,
                discover important openings, and recognize common tactical and
                strategic situations.
              </p>

              <div
                className="
                  mt-6
                  inline-flex
                  items-center
                  gap-2
                  text-sm
                  font-black
                  text-amber-400
                  transition
                  group-hover:gap-3
                  group-hover:text-amber-300
                "
              >
                Rules & Tips
                <span>→</span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </main>
  );
}
