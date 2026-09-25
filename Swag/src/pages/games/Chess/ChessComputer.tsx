import { useState } from "react";
import { Link } from "react-router-dom";

import ChessComputerBoard from "./ChessComputerBoard";

type PlayerColor = "white" | "black" | "random";
type Difficulty = "beginner" | "easy" | "medium" | "hard" | "expert";

type DifficultySettings = {
  skillLevel: number;
  thinkTime: number;
  randomMoveChance: number;
  label: string;
  description: string;
  emoji: string;
};

const difficultyLevels: Record<Difficulty, DifficultySettings> = {
  beginner: {
    skillLevel: 0,
    thinkTime: 80,
    randomMoveChance: 0.6,
    label: "Beginner",
    description: "Very forgiving. Frequent weak moves and clear chances.",
    emoji: "🌱",
  },
  easy: {
    skillLevel: 0,
    thinkTime: 80,
    randomMoveChance: 0.4,
    label: "Easy",
    description: "Relaxed play with enough mistakes to punish.",
    emoji: "🙂",
  },
  medium: {
    skillLevel: 1,
    thinkTime: 300,
    randomMoveChance: 0.15,
    label: "Normal",
    description: "Balanced play with occasional inaccuracies.",
    emoji: "⚔️",
  },
  hard: {
    skillLevel: 5,
    thinkTime: 500,
    randomMoveChance: 0.02,
    label: "Hard",
    description: "Strong tactical play with very few easy mistakes.",
    emoji: "🔥",
  },
  expert: {
    skillLevel: 18,
    thinkTime: 800,
    randomMoveChance: 0,
    label: "Expert",
    description: "Maximum strength. A serious Stockfish challenge.",
    emoji: "👑",
  },
};

function ChessPageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative left-1/2 min-h-[100dvh] w-screen -translate-x-1/2 overflow-hidden bg-[#07090b] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_13%_68%,rgba(245,158,11,.09),transparent_28%),radial-gradient(circle_at_76%_23%,rgba(255,255,255,.045),transparent_30%),linear-gradient(to_bottom,#0a0d10,#07090b_58%,#040506)]" />
      <div className="pointer-events-none absolute -bottom-28 -left-24 text-[390px] leading-none text-amber-100/[0.035]">
        ♚
      </div>
      <div className="pointer-events-none absolute bottom-[-72px] left-[25%] text-[250px] leading-none text-white/[0.018]">
        ♞
      </div>
      <div className="pointer-events-none absolute right-[-50px] top-[15%] text-[290px] leading-none text-white/[0.014]">
        ♝
      </div>

      <div className="relative flex min-h-[100dvh] w-full flex-col">
        <nav className="flex min-h-20 w-full items-center justify-between border-b border-white/[0.07] px-6 sm:px-10 lg:px-14 xl:px-20">
          <Link to="/games/chess" className="inline-flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-lg text-amber-300">
              ♛
            </span>
            <span className="font-serif text-sm tracking-[0.28em] text-zinc-200">
              CHESS
            </span>
          </Link>

          <Link
            to="/games/chess/rules"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
          >
            <span className="text-base">♔</span>
            <span className="hidden sm:inline">Rules & Tips</span>
          </Link>
        </nav>

        {children}
      </div>
    </main>
  );
}

export default function ChessComputer() {
  const [selectedColor, setSelectedColor] = useState<PlayerColor>("white");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [gameStarted, setGameStarted] = useState(false);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");

  const selectedDifficulty = difficultyLevels[difficulty];

  function startGame() {
    const resolvedColor =
      selectedColor === "random"
        ? Math.random() < 0.5
          ? "white"
          : "black"
        : selectedColor;

    setPlayerColor(resolvedColor);
    setGameStarted(true);
  }

  function leaveGame() {
    setGameStarted(false);
  }

  if (gameStarted) {
    return (
      <main className="w-full bg-transparent p-0 text-zinc-100">
        <ChessComputerBoard
          playerColor={playerColor}
          skillLevel={selectedDifficulty.skillLevel}
          thinkTime={selectedDifficulty.thinkTime}
          randomMoveChance={selectedDifficulty.randomMoveChance}
          onChangeSettings={leaveGame}
        />
      </main>
    );
  }

  return (
    <ChessPageShell>
      <section className="grid min-h-0 flex-1 lg:grid-cols-[minmax(360px,.82fr)_minmax(620px,1.18fr)]">
        <header className="relative flex min-h-[430px] flex-col justify-center px-7 py-14 sm:px-10 lg:min-h-0 lg:px-14 lg:py-16 xl:px-20 2xl:px-24">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-white/10 to-transparent lg:block" />

          <div className="max-w-[620px]">
            <Link
              to="/chess/classic"
              className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-600 transition hover:text-white"
            >
              <span>←</span>
              Classic Chess
            </Link>

            <p className="text-[11px] font-black uppercase tracking-[0.34em] text-amber-400">
              Singleplayer
            </p>

            <h1 className="mt-5 font-serif text-[52px] leading-[.94] tracking-[-0.035em] text-white sm:text-[66px] xl:text-[82px]">
              Play vs
              <br />
              Stockfish
            </h1>

            <p className="mt-6 max-w-[500px] font-serif text-[18px] leading-8 text-zinc-400 sm:text-[20px]">
              Pick your side, choose the challenge, then step onto the board.
            </p>
          </div>

          <div className="mt-12 flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.28em] text-zinc-700">
            <span className="h-px w-14 bg-amber-400/45" />
            Color · Difficulty · Play
          </div>
        </header>

        <div className="relative flex min-h-[620px] items-center border-t border-white/[0.06] px-5 py-8 sm:px-8 lg:min-h-0 lg:border-t-0 lg:px-10 lg:py-12 xl:px-14 2xl:px-20">
          <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4 xl:gap-5">
            <section className="rounded-[22px] border border-white/[0.09] bg-black/20 p-5 shadow-[0_16px_40px_rgba(0,0,0,.22)] backdrop-blur-md sm:p-6">
              <p className="text-[9px] font-black uppercase tracking-[0.26em] text-amber-300/70">
                Choose your side
              </p>
              <h2 className="mt-1.5 font-serif text-[27px] leading-tight text-white sm:text-[31px]">
                Color
              </h2>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {(
                  [
                    ["white", "♙", "White"],
                    ["random", "◐", "Random"],
                    ["black", "♟", "Black"],
                  ] as const
                ).map(([value, icon, label]) => {
                  const active = selectedColor === value;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setSelectedColor(value)}
                      className={`group relative overflow-hidden rounded-[18px] border p-4 text-left transition duration-300 hover:-translate-y-0.5 sm:p-5 ${
                        active
                          ? "border-amber-300/45 bg-amber-300/[0.045]"
                          : "border-white/[0.09] bg-black/15 hover:border-amber-300/30 hover:bg-white/[0.025]"
                      }`}
                    >
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-3xl ${
                          active
                            ? "border-amber-300/35 bg-amber-300/10 text-amber-200"
                            : "border-white/10 bg-white/[0.035] text-zinc-400"
                        }`}
                      >
                        {icon}
                      </div>

                      <p
                        className={`mt-4 text-[8px] font-black uppercase tracking-[0.24em] ${
                          active ? "text-amber-300/70" : "text-zinc-700"
                        }`}
                      >
                        {active ? "Selected" : "Side"}
                      </p>

                      <p className="mt-1 font-serif text-xl text-white sm:text-2xl">
                        {label}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[22px] border border-white/[0.09] bg-black/20 p-5 shadow-[0_16px_40px_rgba(0,0,0,.22)] backdrop-blur-md sm:p-6">
              <p className="text-[9px] font-black uppercase tracking-[0.26em] text-amber-300/70">
                Choose the challenge
              </p>
              <h2 className="mt-1.5 font-serif text-[27px] leading-tight text-white sm:text-[31px]">
                Difficulty
              </h2>

              <div className="mt-5 grid gap-2.5">
                {(
                  ["beginner", "easy", "medium", "hard", "expert"] as const
                ).map((value) => {
                  const settings = difficultyLevels[value];
                  const active = difficulty === value;

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDifficulty(value)}
                      className={`group flex items-center gap-4 rounded-[18px] border p-3.5 text-left transition duration-300 hover:-translate-y-0.5 sm:p-4 ${
                        active
                          ? "border-amber-300/45 bg-amber-300/[0.045]"
                          : "border-white/[0.08] bg-black/15 hover:border-amber-300/30 hover:bg-white/[0.025]"
                      }`}
                    >
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-2xl ${
                          active
                            ? "border-amber-300/35 bg-amber-300/10"
                            : "border-white/10 bg-white/[0.035]"
                        }`}
                      >
                        {settings.emoji}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-[8px] font-black uppercase tracking-[0.22em] ${
                            active ? "text-amber-300/70" : "text-zinc-700"
                          }`}
                        >
                          {active ? "Selected" : "Stockfish"}
                        </span>
                        <span className="mt-1 block font-serif text-xl text-white">
                          {settings.label}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-zinc-500">
                          {settings.description}
                        </span>
                      </span>

                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg transition duration-300 ${
                          active
                            ? "border-amber-300/45 text-amber-300"
                            : "border-white/10 text-zinc-600 group-hover:border-amber-300/35 group-hover:text-amber-300"
                        }`}
                      >
                        {active ? "✓" : "→"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <button
              type="button"
              onClick={startGame}
              className="group flex w-full items-center justify-between rounded-[22px] border border-amber-300/45 bg-amber-300/[0.045] p-5 text-left shadow-[0_16px_40px_rgba(0,0,0,.22)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:bg-amber-300/[0.07] sm:p-6"
            >
              <span>
                <span className="text-[9px] font-black uppercase tracking-[0.26em] text-amber-300/70">
                  Ready
                </span>
                <span className="mt-1.5 block font-serif text-[27px] leading-tight text-white sm:text-[31px]">
                  Start Game
                </span>
                <span className="mt-2 block text-sm text-zinc-500">
                  {selectedColor === "random"
                    ? "Random side"
                    : `Play as ${selectedColor === "white" ? "White" : "Black"}`}{" "}
                  · {selectedDifficulty.label}
                </span>
              </span>

              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-300/45 text-xl text-amber-300 transition duration-300 group-hover:translate-x-1">
                →
              </span>
            </button>
          </div>
        </div>
      </section>
    </ChessPageShell>
  );
}
