import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function ChessMultiplayerLobby() {
  const navigate = useNavigate();

  const { user, profile } = useAuth();

  const [roomCode, setRoomCode] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const displayName =
    profile?.username || user?.email?.split("@")[0] || "Player";

  async function createRoom() {
    if (!user || loading) {
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: createError } = await supabase.rpc(
      "create_chess_room",
      {
        p_display_name: displayName,
      },
    );

    setLoading(false);

    if (createError) {
      console.error(createError);

      setError(createError.message);

      return;
    }

    if (!data) {
      setError("Room could not be created.");

      return;
    }

    navigate(`/games/chess/classic/multiplayer/${data}`);
  }

  async function joinRoom() {
    if (!user || loading || !roomCode.trim()) {
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: joinError } = await supabase.rpc("join_chess_room", {
      p_code: roomCode.trim().toUpperCase(),

      p_display_name: displayName,
    });

    setLoading(false);

    if (joinError) {
      console.error(joinError);

      setError(joinError.message);

      return;
    }

    if (!data) {
      setError("Room could not be joined.");

      return;
    }

    navigate(`/games/chess/classic/multiplayer/${data}`);
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-6 text-white">
        <div className="text-center">
          <h1 className="text-3xl font-black">Chess Multiplayer</h1>

          <p className="mt-3 text-zinc-400">
            You must be logged in to play online.
          </p>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-6 rounded-xl bg-emerald-300 px-6 py-3 text-sm font-black text-zinc-950 transition hover:bg-emerald-200 active:scale-[0.98]"
          >
            Log in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      className="
        min-h-screen
       bg-transparent
        px-6
        py-10
        text-white
      "
    >
      <div className="mx-auto max-w-3xl">
        <Link
          to="/chess/classic"
          className="
            text-sm
            font-semibold
            text-zinc-500
            transition
            hover:text-white
          "
        >
          ← Classic Chess
        </Link>

        <div className="mt-10 text-center">
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
              font-black
              uppercase
              tracking-[0.3em]
              text-amber-400
            "
          >
            Classic Chess
          </p>

          <h1
            className="
              mt-2
              text-4xl
              font-black
            "
          >
            Multiplayer
          </h1>

          <p className="mt-3 text-zinc-500">
            Create a room or join a friend using a room code.
          </p>
        </div>

        <div
          className="
            mt-12
            grid
            gap-6
            md:grid-cols-2
          "
        >
          {/* CREATE */}

          <section
            className="
              rounded-3xl
              border
              border-white/10
              bg-zinc-900/75
              p-7
              shadow-2xl
              shadow-black/20
            "
          >
            <div className="text-4xl">♔</div>

            <h2
              className="
                mt-5
                text-2xl
                font-black
              "
            >
              Create Room
            </h2>

            <p
              className="
                mt-2
                text-sm
                leading-6
                text-zinc-500
              "
            >
              Create a private room and share the code with another player.
            </p>

            <button
              type="button"
              disabled={loading}
              onClick={createRoom}
              className="
                mt-8
                w-full
                rounded-xl
                bg-amber-400
                px-5
                py-3
                font-black
                text-zinc-950
                transition
                hover:bg-amber-300
                disabled:opacity-40
              "
            >
              Create Room
            </button>
          </section>

          {/* JOIN */}

          <section
            className="
              rounded-3xl
              border
              border-white/10
              bg-zinc-900/75
              p-7
              shadow-2xl
              shadow-black/20
            "
          >
            <div className="text-4xl">♚</div>

            <h2
              className="
                mt-5
                text-2xl
                font-black
              "
            >
              Join Room
            </h2>

            <p
              className="
                mt-2
                text-sm
                leading-6
                text-zinc-500
              "
            >
              Enter the six-character room code from the host.
            </p>

            <input
              value={roomCode}
              onChange={(event) =>
                setRoomCode(event.target.value.toUpperCase().slice(0, 6))
              }
              placeholder="ABC123"
              className="
                mt-6
                w-full
                rounded-xl
                border
                border-white/10
                bg-black/30
                px-4
                py-3
                text-center
                text-xl
                font-black
                uppercase
                tracking-[0.3em]
                text-white
                outline-none
                transition
                placeholder:text-zinc-700
                focus:border-amber-400/50
              "
            />

            <button
              type="button"
              disabled={loading || roomCode.length !== 6}
              onClick={joinRoom}
              className="
                mt-4
                w-full
                rounded-xl
                bg-white/10
                px-5
                py-3
                font-bold
                transition
                hover:bg-white/20
                disabled:opacity-40
              "
            >
              Join Room
            </button>
          </section>
        </div>

        {error && (
          <div
            className="
              mt-6
              rounded-2xl
              border
              border-red-500/20
              bg-red-500/10
              px-4
              py-3
              text-center
              text-sm
              text-red-300
            "
          >
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
