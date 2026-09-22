import { useState, type ReactNode } from "react";

import {
  difficultyLevels,
  type ChessPlayerColor,
  type Difficulty,
} from "../../ai/variantAi";

export type VariantAiStartSettings = {
  playerColor: ChessPlayerColor;
  difficulty: Difficulty;
};

type VariantAiSettingsScreenProps = {
  title: string;
  icon?: ReactNode;
  onStart: (settings: VariantAiStartSettings) => void;
  onBack?: () => void;

  sideLabels?: {
    white: string;
    black: string;
  };
};

const difficultyOrder: Difficulty[] = ["noob", "casual", "tryhard"];

export default function VariantAiSettingsScreen({
  title,
  icon = "♟",
  onStart,
  onBack,
  sideLabels = {
    white: "White",
    black: "Black",
  },
}: VariantAiSettingsScreenProps) {
  const [playerColor, setPlayerColor] = useState<ChessPlayerColor>("white");

  const [difficulty, setDifficulty] = useState<Difficulty>("noob");

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <section className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-zinc-900/75 p-6 shadow-2xl shadow-black/30">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-3xl">
            {icon}
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
              Vs AI
            </p>

            <h1 className="mt-1 text-3xl font-black">{title}</h1>
          </div>
        </div>

        <div className="mt-7 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <section>
            <h2 className="text-sm font-black text-white">Your side</h2>

            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
              {(["white", "black"] as ChessPlayerColor[]).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setPlayerColor(color)}
                  className={`rounded-2xl border px-4 py-3 text-left transition ${
                    playerColor === color
                      ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                      : "border-white/10 bg-black/20 text-zinc-400 hover:bg-white/5"
                  }`}
                >
                  <span className="mr-2 text-xl">
                    {color === "white" ? "♔" : "♚"}
                  </span>

                  <span className="font-bold">{sideLabels[color]}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black text-white">Difficulty</h2>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {difficultyOrder.map((key) => {
                const item = difficultyLevels[key];
                const selected = difficulty === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDifficulty(key)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-amber-400/30 bg-amber-400/10"
                        : "border-white/10 bg-black/20 hover:bg-white/5"
                    }`}
                  >
                    <p
                      className={
                        selected
                          ? "font-black text-amber-200"
                          : "font-black text-white"
                      }
                    >
                      {item.label}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className="mt-7 flex gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-zinc-300 transition hover:bg-white/10"
            >
              Back
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              onStart({
                playerColor,
                difficulty,
              })
            }
            className="flex-1 rounded-xl bg-amber-300 px-5 py-3 font-black text-zinc-950 transition hover:bg-amber-200"
          >
            Start vs AI
          </button>
        </div>
      </section>
    </main>
  );
}
