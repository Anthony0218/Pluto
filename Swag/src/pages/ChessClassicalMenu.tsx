import { Link } from "react-router-dom";

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
          className="text-sm font-semibold text-zinc-400 transition hover:text-white"
        >
          ← Schach
        </Link>

        <div className="mt-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-400">
            Classic Chess
          </p>

          <h1 className="mt-3 text-4xl font-black">Choose game mode</h1>
        </div>

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
      </div>
    </main>
  );
}
