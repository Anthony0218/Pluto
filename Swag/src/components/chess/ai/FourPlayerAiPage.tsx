import { ui, useUiLanguage } from "@/i18n/ui";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import FourPlayerChess from "../singleplayer/FourPlayerChess";

import {
  difficultyLevels,
  type Difficulty,
} from "../../../games/chess/ai/variantAi";

import type { FourPlayerColor } from "../../../games/chess/variants/fourPlayerChess";

const colors: Array<{
  value: FourPlayerColor;
  label: string;
}> = [
  { value: "red", label: "Red" },
  { value: "blue", label: "Blue" },
  { value: "yellow", label: "Yellow" },
  { value: "green", label: "Green" },
];

const difficulties: Difficulty[] = ["noob", "casual", "tryhard"];

export default function FourPlayerAiPage() {
  useUiLanguage();
  const navigate = useNavigate();

  const [started, setStarted] = useState(false);
  const [humanColor, setHumanColor] = useState<FourPlayerColor>("red");
  const [difficulty, setDifficulty] = useState<Difficulty>("casual");

  if (started) {
    return (
      <FourPlayerChess
        aiMode
        humanColor={humanColor}
        difficulty={difficulty}
        onChangeSettings={() => setStarted(false)}
      />
    );
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-zinc-100">
      <section className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-zinc-900/75 p-6">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">{ui("Vs AI")}</p>

        <h1 className="mt-2 text-3xl font-black">{ui("Four Player Chess")}</h1>

        <p className="mt-2 text-sm text-zinc-500">{ui("You control one army. The other three armies are controlled by AI.")}</p>

        <h2 className="mt-7 text-sm font-black">{ui("Your army")}</h2>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {colors.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setHumanColor(item.value)}
              className={`rounded-2xl border px-4 py-3 font-bold transition ${
                humanColor === item.value
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                  : "border-white/10 bg-black/20 text-zinc-400 hover:bg-white/5"
              }`}
            >
              {ui(item.label)}
            </button>
          ))}
        </div>

        <h2 className="mt-7 text-sm font-black">{ui("Difficulty")}</h2>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {difficulties.map((key) => {
            const item = difficultyLevels[key];

            return (
              <button
                key={key}
                type="button"
                onClick={() => setDifficulty(key)}
                className={`rounded-2xl border p-3 text-left transition ${
                  difficulty === key
                    ? "border-amber-400/30 bg-amber-400/10"
                    : "border-white/10 bg-black/20 hover:bg-white/5"
                }`}
              >
                <p className="font-black text-white">{ui(item.label)}</p>

                <p className="mt-1 text-[10px] leading-4 text-zinc-500">
                  {ui(item.description)}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-bold"
          >{ui("Back")}</button>

          <button
            type="button"
            onClick={() => setStarted(true)}
            className="flex-1 rounded-xl bg-amber-300 px-5 py-3 font-black text-zinc-950"
          >{ui("Start vs AI")}</button>
        </div>
      </section>
    </main>
  );
}
