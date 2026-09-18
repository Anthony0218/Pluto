import { useEffect, useState } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type Room = {
  id: string;
  code: string;
  host_id: string;
  status: "waiting" | "playing" | "finished";
};

type RoomPlayer = {
  room_id: string;
  user_id: string;
  seat: number;
  display_name: string;
};

export default function WattenMultiplayerRoom() {
  const { roomCode } = useParams();

  const navigate = useNavigate();

  const { user } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);

  const [players, setPlayers] = useState<RoomPlayer[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  async function startGame() {
    if (!room || !isHost) {
      return;
    }

    if (players.length !== 4) {
      return;
    }

    setStarting(true);
    setError(null);

    const { data, error } = await supabase.rpc("start_watten_game", {
      p_room_id: room.id,
    });

    if (error) {
      console.error("Could not start Watten:", error);

      setError(error.message ?? "Das Spiel konnte nicht gestartet werden.");

      setStarting(false);

      return;
    }

    console.log("Watten started:", data);

    /*
    We could navigate here immediately,
    but normally the Realtime room update
    below will move ALL four players.
  */
  }

  async function loadPlayers(roomId: string) {
    const { data, error } = await supabase
      .from("watten_room_players")
      .select(
        `
        room_id,
        user_id,
        seat,
        display_name
        `,
      )
      .eq("room_id", roomId)
      .order("seat", {
        ascending: true,
      });

    if (error) {
      console.error(error);
      return;
    }

    setPlayers((data ?? []) as RoomPlayer[]);
  }

  useEffect(() => {
    if (!roomCode || !user) {
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | undefined;

    async function loadRoom() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("watten_rooms")
        .select(
          `
          id,
          code,
          host_id,
          status
          `,
        )
        .eq("code", roomCode?.toUpperCase())
        .single();

      if (error || !data) {
        console.error(error);

        setError(
          "Raum nicht gefunden oder du bist kein Mitglied dieses Raumes.",
        );

        setLoading(false);

        return;
      }

      const loadedRoom = data as Room;

      setRoom(loadedRoom);
      if (loadedRoom.status === "playing") {
        navigate(`/watten/multiplayer/${loadedRoom.code}/game`);

        return;
      }

      await loadPlayers(loadedRoom.id);

      channel = supabase
        .channel(`watten-room-${loadedRoom.id}`)

        // PLAYER JOINS
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "watten_room_players",
            filter: `room_id=eq.${loadedRoom.id}`,
          },
          () => {
            void loadPlayers(loadedRoom.id);
          },
        )

        // ROOM STATUS
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "watten_rooms",
            filter: `id=eq.${loadedRoom.id}`,
          },
          (payload) => {
            const newRoom = payload.new as Room;

            setRoom(newRoom);

            if (newRoom.status === "playing") {
              navigate(`/watten/multiplayer/${newRoom.code}/game`);
            }
          },
        )

        .subscribe();

      setLoading(false);
    }

    void loadRoom();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [roomCode, user]);

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-emerald-950 text-white">
        <p>Bitte zuerst einloggen.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-emerald-950 text-white">
        <p>Raum wird geladen...</p>
      </main>
    );
  }

  if (error || !room) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-emerald-950 px-6 text-white">
        <div className="text-center">
          <p className="text-red-300">{error}</p>

          <button
            type="button"
            onClick={() => navigate("/watten/multiplayer")}
            className="mt-6 rounded-xl bg-white/10 px-5 py-3"
          >
            Zurück
          </button>
        </div>
      </main>
    );
  }

  const isHost = room.host_id === user.id;

  return (
    <main className="min-h-screen bg-emerald-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
              Multiplayer Watten
            </p>

            <h1 className="mt-2 text-3xl font-black">Warteraum</h1>
          </div>

          <Link
            to="/watten/multiplayer"
            className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold hover:bg-white/20"
          >
            Verlassen
          </Link>
        </div>

        {/* ROOM CODE */}

        <section className="mt-8 rounded-3xl border border-amber-400/20 bg-zinc-950/90 p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Raumcode
          </p>

          <p className="mt-3 text-5xl font-black tracking-[0.25em] text-amber-300">
            {room.code}
          </p>

          <p className="mt-4 text-sm text-zinc-500">
            Teile diesen Code mit deinen Mitspielern.
          </p>
        </section>

        {/* PLAYERS */}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((seat) => {
            const player = players.find((current) => current.seat === seat);

            const team = seat % 2 === 0 ? "Team A" : "Team B";

            return (
              <div
                key={seat}
                className={`
                    rounded-2xl
                    border
                    p-5
                    ${
                      player
                        ? seat % 2 === 0
                          ? "border-amber-400/30 bg-amber-400/10"
                          : "border-emerald-400/30 bg-emerald-400/10"
                        : "border-white/10 bg-white/5"
                    }
                  `}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      Sitz {seat + 1}
                    </p>

                    <p className="mt-1 text-xs font-bold text-zinc-400">
                      {team}
                    </p>
                  </div>

                  <div
                    className={`
                        h-3
                        w-3
                        rounded-full
                        ${player ? "bg-emerald-400" : "bg-zinc-700"}
                      `}
                  />
                </div>

                <p className="mt-5 text-lg font-black">
                  {player ? player.display_name : "Wartet auf Spieler..."}
                </p>

                {player?.user_id === user.id && (
                  <p className="mt-1 text-xs font-semibold text-sky-300">Du</p>
                )}

                {player?.user_id === room.host_id && (
                  <p className="mt-1 text-xs font-semibold text-amber-300">
                    Gastgeber
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* STATUS */}

        <section className="mt-8 rounded-2xl border border-white/10 bg-zinc-950/80 p-6 text-center">
          <p className="text-lg font-black">{players.length}/4 Spieler</p>

          {players.length < 4 ? (
            <p className="mt-2 text-sm text-zinc-400">
              Warte auf {4 - players.length} weitere{" "}
              {4 - players.length === 1 ? "Person" : "Personen"}.
            </p>
          ) : (
            <p className="mt-2 font-bold text-emerald-300">
              Alle Spieler sind bereit.
            </p>
          )}

          {isHost && (
            <button
              type="button"
              onClick={() => {
                void startGame();
              }}
              disabled={players.length !== 4 || starting}
              className="
                mt-6
                w-full
                rounded-xl
                bg-amber-400
                px-6
                py-4
                text-lg
                font-black
                text-amber-950
                transition
                hover:bg-amber-300
                disabled:cursor-not-allowed
                disabled:opacity-30
              "
            >
              {starting ? "Spiel wird gestartet..." : "Spiel starten"}
            </button>
          )}

          {!isHost && (
            <p className="mt-5 text-xs text-zinc-500">
              Der Gastgeber startet das Spiel.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
