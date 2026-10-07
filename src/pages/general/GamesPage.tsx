import { ui, useUiLanguage } from "@/i18n/ui";
import { Link } from "react-router-dom";
import { gameList } from "../../data/games";

export default function GamesPage() {
  useUiLanguage();
  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <div className="mb-10">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-400">
            Spiele
          </p>

          <h1 className="mt-2 text-4xl font-black sm:text-5xl">
            Wähle ein Spiel
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
            Spiele klassische Brettspiele, Varianten oder Multiplayer mit
            anderen Spielern.
          </p>
        </div>

        {/* GAME GRID */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {gameList.map((game) => (
            <Link
              key={game.route}
              to={game.route}
              aria-disabled={game.comingSoon ? true : undefined}
              tabIndex={game.comingSoon ? -1 : undefined}
              onClick={game.comingSoon ? (event) => event.preventDefault() : undefined}
              className={`
                group
                overflow-hidden
                rounded-[28px]
                border
                border-white/10
                bg-zinc-900/80
                shadow-xl
                shadow-black/20
                transition
                duration-300
                ${game.comingSoon ? "cursor-not-allowed" : "hover:-translate-y-1 hover:border-amber-400/30 hover:bg-zinc-900 hover:shadow-2xl hover:shadow-black/40"}
              `}
            >
              {/* IMAGE */}
              <div className="relative aspect-[16/9] overflow-hidden bg-black/30">
                <img
                  src={game.image}
                  alt={game.name}
                  className={`
                    h-full
                    w-full
                    object-cover
                    transition
                    duration-500
                    ${game.comingSoon ? "" : "group-hover:scale-105"}
                  `}
                />

                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />

                {/* CATEGORY + STATUS */}
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <span
                    className="
                      rounded-full
                      border
                      border-white/10
                      bg-black/60
                      px-3
                      py-1
                      text-[10px]
                      font-black
                      uppercase
                      tracking-wider
                      text-amber-300
                      backdrop-blur-md
                    "
                  >
                    {game.category}
                  </span>

                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider backdrop-blur-md ${
                      game.comingSoon
                        ? "border-sky-400/25 bg-sky-400/15 text-sky-200"
                        : game.finished
                          ? "border-emerald-400/25 bg-emerald-400/15 text-emerald-200"
                          : "border-amber-400/25 bg-amber-400/15 text-amber-200"
                    }`}
                  >
                    {ui(game.comingSoon ? "Coming soon" : game.finished ? "Ready to play" : "In progress")}
                  </span>
                </div>
              </div>

              {/* CONTENT */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className={`text-xl font-black transition ${game.comingSoon ? "" : "group-hover:text-amber-300"}`}>
                      {game.name}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      {game.description}
                    </p>
                  </div>

                  <span
                    className={`
                      mt-1
                      flex
                      h-9
                      w-9
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      border
                      border-white/10
                      bg-white/5
                      text-lg
                      text-zinc-500
                      transition
                      ${game.comingSoon ? "" : "group-hover:border-amber-400/30 group-hover:bg-amber-400/10 group-hover:text-amber-300"}
                    `}
                  >
                    →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
