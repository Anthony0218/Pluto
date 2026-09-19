import { Link } from "react-router-dom";

export default function ChessMenu() {
  const modes = [
    {
      title: "Chess Classic",
      description:
        "Play standard chess against another player or the computer.",
      path: "/games/chess/classic",
      icon: "♟️",
    },
    {
      title: "Chess Variants",
      description: "Play Chess960 and other alternative chess variants.",
      path: "/games/chess/variants",
      icon: "♞",
    },
    {
      title: "Chess Custom",
      description:
        "Create and play chess games with your own rules and concepts.",
      path: "/games/chess/custom",
      icon: "⚙️",
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-400">
            Schach
          </p>

          <h1 className="mt-3 text-4xl font-black">Wähle den Modus</h1>

          <p className="mx-auto mt-4 max-w-xl text-zinc-400">
            Spiele classic chess, entdecke Varianten, oder erstelle eigene
            Regeln.
          </p>
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
