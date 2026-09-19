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
};

const difficultyLevels: Record<Difficulty, DifficultySettings> = {
  beginner: {
    skillLevel: 0,
    thinkTime: 80,
    randomMoveChance: 0.6,
    label: "Beginner",
    description: "Very forgiving. Makes frequent mistakes and weak moves.",
  },
  easy: {
    skillLevel: 0,
    thinkTime: 80,
    randomMoveChance: 0.4,
    label: "Easy",
    description: "Forgiving. Makes mistakes and weak moves.",
  },

  medium: {
    skillLevel: 1,
    thinkTime: 300,
    randomMoveChance: 0.15,
    label: "Normal",
    description: "Solid play with occasional inaccuracies.",
  },

  hard: {
    skillLevel: 5,
    thinkTime: 500,
    randomMoveChance: 0.02,
    label: "Hard",
    description: "Strong tactical play with few mistakes.",
  },

  expert: {
    skillLevel: 18,
    thinkTime: 800,
    randomMoveChance: 0,
    label: "Expert",
    description: "Very strong Stockfish play.",
  },
};

export default function ChessComputer() {
  const [selectedColor, setSelectedColor] = useState<PlayerColor>("white");

  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  const [gameStarted, setGameStarted] = useState(false);

  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");

  const selectedDifficulty = difficultyLevels[difficulty];

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
    <main
      className="
        min-h-screen
        bg-[radial-gradient(circle_at_top,#21170f_0%,#111111_38%,#090909_100%)]
        px-4
        py-6
        text-zinc-100
        sm:px-6
        lg:px-8
      "
    >
      <div className="mx-auto w-full max-w-[1500px]">
        <Link
          to="/chess/classic"
          className="
            text-sm
            font-semibold
            text-zinc-400
            transition
            hover:text-white
          "
        >
          ← Classic Chess
        </Link>

        {!gameStarted ? (
          <div className="mx-auto mt-12 max-w-xl">
            {/* HEADER */}

            <div className="text-center">
              <div
                className="
                  mx-auto
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-amber-500/20
                  bg-amber-400/10
                  text-4xl
                  text-amber-200
                "
              >
                ♞
              </div>

              <p
                className="
                  mt-6
                  text-xs
                  font-bold
                  uppercase
                  tracking-[0.3em]
                  text-amber-400
                "
              >
                Classic Chess
              </p>

              <h1 className="mt-3 text-4xl font-black">Play vs Stockfish</h1>

              <p className="mt-3 text-zinc-400">
                Choose your side and difficulty.
              </p>
            </div>

            {/* COLOR */}

            <section className="mt-10">
              <h2
                className="
                  text-sm
                  font-bold
                  uppercase
                  tracking-widest
                  text-zinc-400
                "
              >
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
                        transition-all
                        duration-200

                        ${
                          selectedColor === value
                            ? `
                              border-amber-400
                              bg-amber-400/10
                              shadow-[0_0_25px_rgba(251,191,36,0.08)]
                            `
                            : `
                              border-white/10
                              bg-zinc-900/75
                              hover:border-white/20
                              hover:bg-zinc-800
                            `
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
              <h2
                className="
                  text-sm
                  font-bold
                  uppercase
                  tracking-widest
                  text-zinc-400
                "
              >
                Difficulty
              </h2>

              <div className="mt-4 grid gap-3">
                {(
                  ["beginner", "easy", "medium", "hard", "expert"] as const
                ).map((value) => {
                  const settings = difficultyLevels[value];

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setDifficulty(value)}
                      className={`
                          flex
                          items-center
                          justify-between
                          gap-4
                          rounded-2xl
                          border
                          px-5
                          py-4
                          text-left
                          transition-all
                          duration-200

                          ${
                            difficulty === value
                              ? `
                                border-amber-400
                                bg-amber-400/10
                                shadow-[0_0_25px_rgba(251,191,36,0.06)]
                              `
                              : `
                                border-white/10
                                bg-zinc-900/75
                                hover:border-white/20
                                hover:bg-zinc-800
                              `
                          }
                        `}
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-zinc-100">
                          {settings.label}
                        </div>

                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                          {settings.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* START GAME */}

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
            {/* GAME HEADER */}

            <div className="mt-6 text-center">
              <p
                className="
                  text-xs
                  font-bold
                  uppercase
                  tracking-[0.3em]
                  text-amber-400
                "
              >
                Classic Chess
              </p>

              <h1 className="mt-2 text-3xl font-black">Play vs Stockfish</h1>

              <p className="mt-2 text-sm text-zinc-400">
                You play{" "}
                <strong className="text-white">
                  {playerColor === "white" ? "White" : "Black"}
                </strong>
                {" · "}
                Difficulty:{" "}
                <strong className="text-white">
                  {selectedDifficulty.label}
                </strong>
              </p>
            </div>

            {/* CHESS GAME */}

            <div className="mt-8">
              <ChessComputerBoard
                playerColor={playerColor}
                skillLevel={selectedDifficulty.skillLevel}
                thinkTime={selectedDifficulty.thinkTime}
                randomMoveChance={selectedDifficulty.randomMoveChance}
                onChangeSettings={leaveGame}
              />
            </div>

            {/* CHANGE SETTINGS */}

            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={leaveGame}
                className="
                  rounded-xl
                  border
                  border-white/10
                  bg-white/5
                  px-5
                  py-3
                  text-sm
                  font-bold
                  text-zinc-300
                  transition
                  hover:bg-white/10
                  hover:text-white
                "
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
