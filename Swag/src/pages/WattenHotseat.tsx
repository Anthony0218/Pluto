import { useState } from "react";
import { Link, useNavigate } from "react-router";

type Player = {
  id: string;
  name: string;
};

export default function WattenHotseat() {
  const navigate = useNavigate();

  const [players, setPlayers] = useState<Player[]>([
    { id: "1", name: "" },
    { id: "2", name: "" },
    { id: "3", name: "" },
  ]);

  function updatePlayer(id: string, name: string) {
    setPlayers((current) =>
      current.map((player) =>
        player.id === id ? { ...player, name } : player,
      ),
    );
  }

  function startGame() {
    const hasEmptyPlayer = players.some((player) => player.name.trim() === "");

    if (hasEmptyPlayer) {
      return;
    }

    navigate("/watten/hotseat/game", {
      state: {
        players,
      },
    });
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12">
      <div className="mx-auto max-w-xl">
        <Link
          to="/watten"
          className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
        >
          ← Back to Watten
        </Link>

        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
              Hotseat
            </h1>

            <p className="mt-2 text-zinc-500">
              Enter the names of the three players.
            </p>
          </div>

          <div className="space-y-5">
            {players.map((player, index) => (
              <div key={player.id}>
                <label
                  htmlFor={`player-${player.id}`}
                  className="mb-2 block text-sm font-medium text-zinc-700"
                >
                  Player {index + 1}
                </label>

                <input
                  id={`player-${player.id}`}
                  value={player.name}
                  onChange={(event) =>
                    updatePlayer(player.id, event.target.value)
                  }
                  placeholder={`Player ${index + 1}`}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={startGame}
            disabled={players.some((player) => !player.name.trim())}
            className="mt-8 w-full rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Start Game
          </button>
        </div>
      </div>
    </main>
  );
}
