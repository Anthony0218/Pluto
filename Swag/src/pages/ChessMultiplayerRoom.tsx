import { useCallback, useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type ChessRoom = {
  id: string;
  code: string;
  host_id: string;
  status: "waiting" | "ready" | "playing" | "finished";
};

type RoomPlayer = {
  room_id: string;
  user_id: string;
  seat: number;
  display_name: string;
};

export default function ChessMultiplayerRoom() {
  const navigate = useNavigate();
  const { roomCode } = useParams();

  const { user } = useAuth();

  const [room, setRoom] = useState<ChessRoom | null>(null);

  const [players, setPlayers] = useState<RoomPlayer[]>([]);

  const [loading, setLoading] = useState(true);

  const [starting, setStarting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const loadRoom = useCallback(async () => {
    if (!roomCode) {
      return;
    }

    const { data: roomData, error: roomError } = await supabase
      .from("chess_rooms")
      .select("id, code, host_id, status")
      .eq("code", roomCode.toUpperCase())
      .single();

    if (roomError || !roomData) {
      console.error(roomError);

      setError("Room not found.");

      setLoading(false);

      return;
    }

    const loadedRoom = roomData as ChessRoom;

    setRoom(loadedRoom);

    const { data: playerData, error: playerError } = await supabase
      .from("chess_room_players")
      .select(
        `
            room_id,
            user_id,
            seat,
            display_name
          `,
      )
      .eq("room_id", loadedRoom.id)
      .order("seat", {
        ascending: true,
      });

    if (playerError) {
      console.error(playerError);

      setError("Players could not be loaded.");

      setLoading(false);

      return;
    }

    setPlayers((playerData ?? []) as RoomPlayer[]);

    setLoading(false);
  }, [roomCode]);
  useEffect(() => {
    if (room?.status === "playing") {
      navigate(`/games/chess/classic/multiplayer/${room.code}/game`);
    }
  }, [room?.status, room?.code, navigate]);
  useEffect(() => {
    if (!roomCode || !user) {
      return;
    }

    void loadRoom();
  }, [roomCode, user, loadRoom]);

  /*
   * Realtime room updates.
   */

  useEffect(() => {
    if (!room) {
      return;
    }

    const channel = supabase
      .channel(`chess-room-${room.id}`)

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chess_room_players",
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          void loadRoom();
        },
      )

      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chess_rooms",
          filter: `id=eq.${room.id}`,
        },
        () => {
          void loadRoom();
        },
      )

      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room, loadRoom]);

  async function startGame() {
    if (!room || starting) {
      return;
    }

    setStarting(true);
    setError(null);

    const { error: startError } = await supabase.rpc("start_chess_game", {
      p_room_id: room.id,
    });

    setStarting(false);

    if (startError) {
      console.error(startError);

      setError(startError.message);
    }
  }

  if (loading) {
    return (
      <main
        className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-zinc-950
          text-zinc-400
        "
      >
        Loading room...
      </main>
    );
  }

  if (error && !room) {
    return (
      <main
        className="
          flex
          min-h-screen
          items-center
          justify-center
          bg-zinc-950
          px-6
          text-white
        "
      >
        <div className="text-center">
          <p className="text-red-300">{error}</p>

          <Link
            to="/chess/classic/multiplayer"
            className="
              mt-6
              inline-block
              rounded-xl
              bg-white/10
              px-5
              py-3
            "
          >
            Back
          </Link>
        </div>
      </main>
    );
  }

  if (!room) {
    return null;
  }

  const white = players.find((player) => player.seat === 0);

  const black = players.find((player) => player.seat === 1);

  const isHost = room.host_id === user?.id;

  return (
    <main
      className="
        min-h-screen
        bg-[radial-gradient(circle_at_top,#21170f_0%,#111111_38%,#090909_100%)]
        px-6
        py-10
        text-white
      "
    >
      <div className="mx-auto max-w-3xl">
        <Link
          to="/chess/classic/multiplayer"
          className="
            text-sm
            font-semibold
            text-zinc-500
            hover:text-white
          "
        >
          ← Multiplayer
        </Link>

        <div className="mt-10 text-center">
          <p
            className="
              text-xs
              font-black
              uppercase
              tracking-[0.3em]
              text-amber-400
            "
          >
            Chess Room
          </p>

          <h1
            className="
              mt-3
              text-4xl
              font-black
            "
          >
            {room.code}
          </h1>

          <p className="mt-3 text-sm text-zinc-500">
            Share this code with your opponent.
          </p>
        </div>

        <div
          className="
            mt-10
            grid
            gap-4
            sm:grid-cols-2
          "
        >
          <PlayerCard
            title="White"
            symbol="♔"
            player={white}
            currentUserId={user?.id}
          />

          <PlayerCard
            title="Black"
            symbol="♚"
            player={black}
            currentUserId={user?.id}
          />
        </div>

        <div
          className="
            mt-6
            rounded-3xl
            border
            border-white/10
            bg-zinc-900/75
            p-6
          "
        >
          {room.status === "waiting" && (
            <p
              className="
                text-center
                text-zinc-400
              "
            >
              Waiting for another player...
            </p>
          )}

          {room.status === "ready" && (
            <>
              <p
                className="
                  text-center
                  font-semibold
                  text-emerald-300
                "
              >
                Both players are ready.
              </p>

              {isHost ? (
                <button
                  type="button"
                  disabled={starting || players.length !== 2}
                  onClick={startGame}
                  className="
                    mt-5
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
                  Start Game
                </button>
              ) : (
                <p
                  className="
                    mt-4
                    text-center
                    text-sm
                    text-zinc-500
                  "
                >
                  Waiting for the host to start.
                </p>
              )}
            </>
          )}

          {room.status === "playing" && (
            <div className="text-center">
              <p
                className="
                  font-bold
                  text-emerald-300
                "
              >
                Game started.
              </p>

              <p
                className="
                  mt-2
                  text-sm
                  text-zinc-500
                "
              >
                The synchronized chess board is the next step.
              </p>
            </div>
          )}

          {error && (
            <p
              className="
                mt-4
                text-center
                text-sm
                text-red-300
              "
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function PlayerCard({
  title,
  symbol,
  player,
  currentUserId,
}: {
  title: string;
  symbol: string;
  player: RoomPlayer | undefined;
  currentUserId: string | undefined;
}) {
  return (
    <div
      className="
        rounded-3xl
        border
        border-white/10
        bg-zinc-900/75
        p-6
        text-center
      "
    >
      <div className="text-5xl">{symbol}</div>

      <p
        className="
          mt-4
          text-xs
          font-black
          uppercase
          tracking-widest
          text-zinc-600
        "
      >
        {title}
      </p>

      {player ? (
        <>
          <h2
            className="
              mt-2
              text-xl
              font-black
            "
          >
            {player.display_name}
          </h2>

          {player.user_id === currentUserId && (
            <p
              className="
                mt-2
                text-xs
                font-bold
                uppercase
                tracking-widest
                text-amber-400
              "
            >
              You
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-zinc-600">Waiting...</p>
      )}
    </div>
  );
}
