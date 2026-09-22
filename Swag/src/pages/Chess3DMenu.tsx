import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  CHESS_3D_DIFFICULTIES,
  type Chess3DDifficulty,
} from "@/games/chess/3d/chess3dDifficulty.ts";

export default function Chess3DMenu() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState<Chess3DDifficulty>("medium");

  const selected = CHESS_3D_DIFFICULTIES.find(
    (entry) => entry.id === difficulty,
  )!;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <img
              src="/images/chess3d-icon.png"
              alt=""
              className="h-16 w-16 rounded-2xl border border-white/10 object-cover shadow-lg shadow-black/30"
            />

            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-sky-400">
                3D Chess
              </p>

              <h1 className="mt-1 text-4xl font-black">Choose your game</h1>
            </div>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500">
            Play cinematic 3D chess locally or challenge Stockfish with the same
            five difficulty levels used across the rest of the chess modes.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* HOTSEAT */}
          <button
            type="button"
            onClick={() => navigate("/games/chess/3dchess/hotseat")}
            className="group relative overflow-hidden rounded-3xl border border-sky-400/20 bg-zinc-900 text-left shadow-2xl shadow-black/25 transition duration-300 hover:-translate-y-1 hover:border-sky-300/45 hover:shadow-sky-950/40"
          >
            <div className="relative aspect-[16/10] overflow-hidden">
              <img
                src="/images/chess3d.png"
                alt="3D Chess Hotseat"
                className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/25 to-transparent" />

              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-sky-300/20 bg-black/45 px-3 py-1.5 backdrop-blur-md">
                <span className="text-sm">♙</span>
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-100">
                  Local 2 Players
                </span>
                <span className="text-sm">♟</span>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-5">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-sky-300">
                  Face to face
                </p>

                <h2 className="mt-1 text-3xl font-black text-white">Hotseat</h2>

                <p className="mt-2 max-w-md text-sm leading-6 text-zinc-300">
                  Share one device and play on the full animated 3D board.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-white/10 bg-gradient-to-r from-sky-400/[0.08] to-transparent p-5">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-300">
                  3D Pieces
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-300">
                  Capture FX
                </span>

                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-300">
                  Undo
                </span>
              </div>

              <span className="shrink-0 rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-black text-sky-950 shadow-lg shadow-sky-950/20 transition group-hover:bg-sky-300">
                Play →
              </span>
            </div>
          </button>

          {/* VS STOCKFISH */}
          <section className="overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-b from-violet-400/[0.06] to-zinc-900 shadow-2xl shadow-black/25">
            <div className="relative h-40 overflow-hidden border-b border-white/10">
              <img
                src="/images/chess3d-icon.png"
                alt=""
                className="h-full w-full object-cover opacity-70"
              />

              <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/65 to-zinc-950/20" />

              <div className="absolute inset-0 flex flex-col justify-end p-5">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-violet-300">
                  Challenge the engine
                </p>

                <h2 className="mt-1 text-3xl font-black">Vs Stockfish</h2>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm leading-6 text-zinc-500">
                You play White. Choose how strong and consistent Stockfish
                should be.
              </p>

              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {CHESS_3D_DIFFICULTIES.map((entry) => {
                  const active = entry.id === difficulty;

                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => setDifficulty(entry.id)}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-violet-400/45 bg-violet-400/15 shadow-lg shadow-violet-950/20"
                          : "border-white/10 bg-black/20 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-black text-white">
                          {entry.label}
                        </span>

                        {active && (
                          <span className="h-2.5 w-2.5 rounded-full bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,0.8)]" />
                        )}
                      </div>

                      <p className="mt-1 text-xs leading-5 text-zinc-500">
                        {entry.description}
                      </p>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate(`/games/chess/3dchess/ai?difficulty=${difficulty}`)
                }
                className="mt-5 flex w-full items-center justify-between rounded-2xl bg-violet-400 px-5 py-4 text-sm font-black text-violet-950 shadow-lg shadow-violet-950/30 transition hover:bg-violet-300"
              >
                <span>Play vs {selected.label} Stockfish</span>
                <span className="text-lg">→</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
