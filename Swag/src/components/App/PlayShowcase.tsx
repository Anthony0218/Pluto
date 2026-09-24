import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

import { gameList } from "../../data/games";

export default function PlayShowcase() {
  const visibleGames = gameList.slice(0, 4);

  return (
    <div className="relative">
      {/* GLOW */}
      <div
        className="
          pointer-events-none
          absolute inset-16
          rounded-full
          bg-indigo-500/15
          blur-[100px]
        "
      />

      <div
        className="
          relative
          overflow-hidden
          rounded-[28px]
          border border-white/[0.08]
          bg-[#080d1c]/70
          p-3
          shadow-2xl shadow-black/30
          backdrop-blur-xl
          sm:p-4
        "
      >
        {/* LARGE FIRST GAME */}
        {visibleGames[0] && (
          <Link
            to={visibleGames[0].route}
            className="
              group
              relative
              block
              min-h-[300px]
              overflow-hidden
              rounded-[22px]
              border border-white/[0.07]
              bg-[#0b1020]
            "
          >
            <img
              src={visibleGames[0].image}
              alt={visibleGames[0].name}
              className="
                absolute inset-0
                h-full w-full
                object-cover
                transition duration-700
                group-hover:scale-[1.03]
              "
            />

            <div
              className="
                absolute inset-0
                bg-gradient-to-t
                from-[#050816]
                via-[#050816]/40
                to-transparent
              "
            />

            <div className="absolute inset-x-0 bottom-0 p-6">
              <div className="flex items-end justify-between gap-5">
                <div>
                  <p
                    className="
                      text-[10px]
                      font-bold uppercase
                      tracking-[0.2em]
                      text-indigo-300
                    "
                  >
                    {visibleGames[0].category}
                  </p>

                  <h3 className="mt-2 text-2xl font-bold text-white">
                    {visibleGames[0].name}
                  </h3>

                  <p
                    className="
                      mt-2 max-w-md
                      text-sm leading-6
                      text-zinc-400
                    "
                  >
                    {visibleGames[0].description}
                  </p>
                </div>

                <div
                  className="
                    flex h-11 w-11
                    shrink-0
                    items-center justify-center
                    rounded-full
                    border border-white/10
                    bg-white/[0.06]
                    text-zinc-300
                    transition
                    group-hover:bg-indigo-500
                    group-hover:text-white
                  "
                >
                  <ArrowUpRight size={18} />
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* OTHER GAMES */}
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {visibleGames.slice(1).map((game) => (
            <Link
              key={game.route}
              to={game.route}
              className="
                group
                overflow-hidden
                rounded-2xl
                border border-white/[0.07]
                bg-white/[0.025]
                transition
                hover:border-indigo-400/20
                hover:bg-white/[0.04]
              "
            >
              <div className="aspect-[16/10] overflow-hidden bg-black/20">
                <img
                  src={game.image}
                  alt={game.name}
                  className="
                    h-full w-full
                    object-cover
                    transition duration-500
                    group-hover:scale-105
                  "
                />
              </div>

              <div className="p-4">
                <p className="text-sm font-semibold text-white">{game.name}</p>

                <p className="mt-1 text-[11px] text-zinc-600">
                  {game.category}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* FOOTER */}
        <div
          className="
            mt-3
            flex items-center justify-between
            px-2 py-2
          "
        >
          <p className="text-xs text-zinc-600">
            Classic games, variants and more.
          </p>

          <Link
            to="/games"
            className="
              text-xs font-medium
              text-indigo-300
              transition
              hover:text-indigo-200
            "
          >
            All games →
          </Link>
        </div>
      </div>
    </div>
  );
}
