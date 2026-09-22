import { Link } from "react-router-dom";

type CreditItem = {
  name: string;
  category: string;
  description: string;
  license: string;
  homepage: string;
  source?: string;
  note?: string;
};

const credits: CreditItem[] = [
  {
    name: "chess.js",
    category: "Chess rules / move validation",
    description:
      "Used for legal move generation, game-state handling, FEN/PGN support and standard chess rule validation.",
    license: "BSD-2-Clause",
    homepage: "https://github.com/jhlywa/chess.js",
    source: "https://github.com/jhlywa/chess.js/blob/master/LICENSE",
  },
  {
    name: "Stockfish / stockfish.js",
    category: "Chess engine",
    description:
      "Used for computer-opponent move calculation in chess AI modes.",
    license: "GNU General Public License v3 (GPLv3)",
    homepage: "https://stockfishchess.org/",
    source: "https://github.com/nmrugg/stockfish.js/",
    note: "When distributing Stockfish, keep the GPLv3 license available and provide the corresponding source code or an exact source pointer for the binary you distribute.",
  },
  {
    name: "Free Stuff 1 - Chess Set",
    category: "3D chess models",
    description:
      "Chess-piece models used in the 3D chess mode. Original model set created by Tinymen and distributed through CGTrader.",
    license: "CGTrader Royalty Free License (no AI)",
    homepage:
      "https://www.cgtrader.com/free-3d-models/sports/game/free-stuff-1-chess-set",
    source:
      "https://help.cgtrader.com/hc/en-us/articles/360015124437-Royalty-Free-License",
    note: "The model should remain incorporated into the game and should not be redistributed as a standalone downloadable model asset.",
  },
];

export default function CreditsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-[28px] border border-white/10 bg-zinc-900/75 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
                About this project
              </p>

              <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">
                Credits & References
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
                This site combines original game code and interface work with
                open-source software and licensed third-party assets. The
                resources below are credited to their respective authors and
                projects.
              </p>
            </div>

            <Link
              to="/"
              className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              ← Back to home
            </Link>
          </div>
        </header>

        <section className="mt-6 grid gap-4">
          {credits.map((item) => (
            <article
              key={item.name}
              className="rounded-3xl border border-white/10 bg-zinc-900/65 p-6 shadow-lg shadow-black/10"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    {item.category}
                  </p>

                  <h2 className="mt-1 text-xl font-black text-white">
                    {item.name}
                  </h2>

                  <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
                    {item.description}
                  </p>
                </div>

                <span className="w-fit shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                  {item.license}
                </span>
              </div>

              {item.note && (
                <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] px-4 py-3 text-xs leading-6 text-amber-100/80">
                  {item.note}
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href={item.homepage}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
                >
                  Project page ↗
                </a>

                {item.source && (
                  <a
                    href={item.source}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
                  >
                    License / source ↗
                  </a>
                )}
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-zinc-900/60 p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
            Project attribution
          </p>

          <h2 className="mt-2 text-xl font-black text-white">
            Original site work
          </h2>

          <p className="mt-3 text-sm leading-7 text-zinc-400">
            Game interfaces, chess variants, Watten gameplay, visual effects,
            application structure and original site-specific logic are part of
            this project except where third-party resources are explicitly
            credited above.
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-amber-400/10 bg-amber-400/[0.03] p-6">
          <h2 className="font-black text-white">Before publishing</h2>

          <p className="mt-2 text-sm leading-7 text-zinc-400">
            Keep a copy of each third-party license in your repository. For
            Stockfish, also make sure the exact source corresponding to the
            distributed engine build can be reached from your public project or
            from a clearly identified upstream source.
          </p>
        </section>

        <footer className="py-8 text-center text-[11px] text-zinc-600">
          Credits and license information may be updated when dependencies or
          assets change.
        </footer>
      </div>
    </main>
  );
}
