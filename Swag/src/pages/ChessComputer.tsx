import { useState } from "react";
import { Link } from "react-router-dom";

import ChessComputerBoard from "./ChessComputerBoard";

type PlayerColor = "white" | "black" | "random";

type Difficulty = "beginner" | "easy" | "medium" | "hard" | "expert";

const difficultyLevels: Record<Difficulty, number> = {
  beginner: 0,
  easy: 3,
  medium: 7,
  hard: 12,
  expert: 18,
};

export default function ChessComputer() {
  const [selectedColor, setSelectedColor] = useState<PlayerColor>("white");

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const [gameStarted, setGameStarted] = useState(false);

  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");

  function startGame() {
    let resolvedColor: "white" | "black";

    if (selectedColor === "random") {
      resolvedColor = Math.random() < 0.5 ? "white" : "black";
    } else {
      resolvedColor = selectedColor;
    }

    setPlayerColor(resolvedColor);
    setGameStarted(true);
  }

  function leaveGame() {
    setGameStarted(false);
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <Link
          to="/chess/classic"
          className="text-sm font-semibold text-zinc-400 transition hover:text-white"
        >
          ← Classic Chess
        </Link>

        {!gameStarted ? (
          <div className="mx-auto mt-12 max-w-xl">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-400">
                Classic Chess
              </p>

              <h1 className="mt-3 text-4xl font-black">Play vs Stockfish</h1>

              <p className="mt-3 text-zinc-400">
                Choose your side and difficulty.
              </p>
            </div>

            {/* COLOR */}

            <section className="mt-10">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                Choose Color
              </h2>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {(
                  [
                    ["white", "♙", "White"],
                    ["random", "◐", "Random"],
                    ["black", "♟", "Black"],
                  ] as const
                ).map(([value, icon, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedColor(value)}
                    className={`
                      rounded-2xl
                      border
                      p-5
                      transition

                      ${
                        selectedColor === value
                          ? "border-amber-400 bg-amber-400/10"
                          : "border-white/10 bg-zinc-900 hover:bg-zinc-800"
                      }
                    `}
                  >
                    <div className="text-4xl">{icon}</div>

                    <div className="mt-2 font-bold">{label}</div>
                  </button>
                ))}
              </div>
            </section>

            {/* DIFFICULTY */}

            <section className="mt-8">
              <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
                Difficulty
              </h2>

              <div className="mt-4 grid gap-3">
                {(
                  [
                    ["beginner", "Beginner"],
                    ["easy", "Easy"],
                    ["medium", "Medium"],
                    ["hard", "Hard"],
                    ["expert", "Expert"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDifficulty(value)}
                    className={`
                      flex
                      items-center
                      justify-between
                      rounded-xl
                      border
                      px-5
                      py-4
                      text-left
                      transition

                      ${
                        difficulty === value
                          ? "border-amber-400 bg-amber-400/10"
                          : "border-white/10 bg-zinc-900 hover:bg-zinc-800"
                      }
                    `}
                  >
                    <span className="font-bold">{label}</span>

                    <span className="text-xs text-zinc-500">
                      Skill {difficultyLevels[value]}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <button
              type="button"
              onClick={startGame}
              className="
                mt-10
                w-full
                rounded-xl
                bg-amber-400
                px-6
                py-4
                text-lg
                font-black
                text-zinc-950
                transition
                hover:bg-amber-300
              "
            >
              Start Game
            </button>
          </div>
        ) : (
          <>
            <div className="mt-6 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-400">
                Classic Chess
              </p>

              <h1 className="mt-2 text-3xl font-black">Play vs Stockfish</h1>

              <p className="mt-2 text-sm text-zinc-400">
                You play{" "}
                <strong className="text-white">
                  {playerColor === "white" ? "White" : "Black"}
                </strong>
                {" · "}
                Difficulty: <strong className="text-white">{difficulty}</strong>
              </p>
            </div>

            <div className="mt-8">
              <ChessComputerBoard
                playerColor={playerColor}
                skillLevel={difficultyLevels[difficulty]}
                onChangeSettings={leaveGame}
              />
            </div>

            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={leaveGame}
                className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20"
              >
                Change Settings
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
