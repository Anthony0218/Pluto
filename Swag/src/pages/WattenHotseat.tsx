import { useState } from "react";
import { useNavigate } from "react-router";
import type { WattenVariant, WattenPlayerInfo } from "../utils/types";

export default function WattenHotseat() {
  const navigate = useNavigate();

  const [variant, setVariant] = useState<WattenVariant>("three-player");

  const playerCount = variant === "three-player" ? 3 : 4;

  const [playerNames, setPlayerNames] = useState([
    "Player 1",
    "Player 2",
    "Player 3",
    "Player 4",
  ]);

  function updatePlayerName(index: number, value: string) {
    setPlayerNames((current) =>
      current.map((name, i) => (i === index ? value : name)),
    );
  }

  function startGame() {
    const players: WattenPlayerInfo[] = playerNames
      .slice(0, playerCount)
      .map((name, index) => ({
        id: String(index + 1),
        name: name.trim() || `Player ${index + 1}`,
      }));

    navigate("/watten/hotseat/game", {
      state: {
        variant,
        mode: "hotseat",
        players,
      },
    });
  }

  return (
    <main className="min-h-screen bg-emerald-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-white/10 bg-zinc-950/90 p-8 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
            Bayerisches Watten
          </p>

          <h1 className="mt-2 text-3xl font-black">Hotseat</h1>

          <p className="mt-2 text-sm text-zinc-400">
            Wählt zuerst die Spielvariante.
          </p>

          {/* VARIANT */}
          <div className="mt-8">
            <p className="mb-3 text-sm font-bold text-zinc-300">
              Spieleranzahl
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setVariant("three-player")}
                className={`rounded-2xl border p-5 text-left transition ${
                  variant === "three-player"
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="text-xl font-black">3 Spieler</div>

                <p className="mt-2 text-sm text-zinc-400">
                  Ein Alleinspieler gegen zwei Gegenspieler.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setVariant("four-player")}
                className={`rounded-2xl border p-5 text-left transition ${
                  variant === "four-player"
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="text-xl font-black">4 Spieler</div>

                <p className="mt-2 text-sm text-zinc-400">
                  Zwei feste Teams mit gegenüberliegenden Partnern.
                </p>
              </button>
            </div>
          </div>

          {/* PLAYER NAMES */}
          <div className="mt-8">
            <p className="mb-3 text-sm font-bold text-zinc-300">Spielernamen</p>

            <div className="space-y-3">
              {Array.from({
                length: playerCount,
              }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-black text-emerald-300">
                    {index + 1}
                  </div>

                  <input
                    type="text"
                    value={playerNames[index]}
                    onChange={(event) =>
                      updatePlayerName(index, event.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-amber-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {variant === "four-player" && (
            <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
              <p className="text-sm font-bold text-emerald-200">
                Teamaufteilung
              </p>

              <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-zinc-400">Team A</span>
                  <p className="font-semibold">
                    {playerNames[0]} + {playerNames[2]}
                  </p>
                </div>

                <div>
                  <span className="text-zinc-400">Team B</span>
                  <p className="font-semibold">
                    {playerNames[1]} + {playerNames[3]}
                  </p>
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={startGame}
            className="mt-8 w-full rounded-xl bg-amber-400 px-6 py-4 text-lg font-black text-amber-950 transition hover:bg-amber-300"
          >
            Spiel starten
          </button>
        </div>
      </div>
    </main>
  );
}
