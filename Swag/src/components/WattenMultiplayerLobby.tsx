import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function WattenMultiplayerLobby() {
  const navigate = useNavigate();

  const { user, profile } = useAuth();

  const [roomCode, setRoomCode] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const displayName =
    profile?.username || user?.email?.split("@")[0] || "Player";

  async function createRoom() {
    if (!user) {
      setError("Du musst angemeldet sein.");

      return;
    }

    setLoading(true);
    setError(null);

    const { data, error } = await supabase.rpc("create_watten_room", {
      p_display_name: displayName,
    });

    setLoading(false);

    if (error) {
      console.error(error);

      setError("Der Raum konnte nicht erstellt werden.");

      return;
    }

    const room = data?.[0];

    if (!room) {
      setError("Der Raum konnte nicht erstellt werden.");

      return;
    }

    navigate(`/watten/multiplayer/${room.room_code}`);
  }

  async function joinRoom() {
    if (!user) {
      setError("Du musst angemeldet sein.");

      return;
    }

    const normalizedCode = roomCode.trim().toUpperCase();

    if (!normalizedCode) {
      setError("Bitte gib einen Raumcode ein.");

      return;
    }

    setLoading(true);
    setError(null);

    const { data, error } = await supabase.rpc("join_watten_room", {
      p_code: normalizedCode,
      p_display_name: displayName,
    });

    setLoading(false);

    if (error) {
      console.error(error);

      if (error.message.includes("Room is full")) {
        setError("Dieser Raum ist bereits voll.");
      } else if (error.message.includes("Room not found")) {
        setError("Dieser Raum wurde nicht gefunden.");
      } else {
        setError("Beitritt fehlgeschlagen.");
      }

      return;
    }

    const room = data?.[0];

    if (!room) {
      setError("Beitritt fehlgeschlagen.");

      return;
    }

    navigate(`/watten/multiplayer/${room.room_code}`);
  }

  return (
    <main className="min-h-screen bg-emerald-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        {/* HEADER */}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">
              Bayerisches Watten
            </p>

            <h1 className="mt-2 text-4xl font-black">Multiplayer</h1>

            <p className="mt-2 text-zinc-400">
              Spiele online mit vier Spielern.
            </p>
          </div>

          <Link
            to="/watten"
            className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold transition hover:bg-white/20"
          >
            Zurück
          </Link>
        </div>

        {/* USER */}

        <div className="mt-10 rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
          {user ? (
            <p className="text-sm text-zinc-300">
              Eingeloggt als{" "}
              <strong className="text-emerald-300">{displayName}</strong>
            </p>
          ) : (
            <p className="text-sm text-red-300">
              Für Multiplayer musst du eingeloggt sein.
            </p>
          )}
        </div>

        {/* CREATE + JOIN */}

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {/* CREATE */}

          <section className="rounded-3xl border border-amber-400/20 bg-zinc-950/90 p-8 shadow-2xl">
            <div className="text-4xl">🃏</div>

            <h2 className="mt-5 text-2xl font-black">Neues Spiel</h2>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Erstelle einen privaten Raum und teile den Raumcode mit deinen
              Mitspielern.
            </p>

            <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
              4 Spieler
              <br />
              2 gegen 2
              <br />
              Privater Raumcode
            </div>

            <button
              type="button"
              disabled={loading || !user}
              onClick={createRoom}
              className="
                mt-7
                w-full
                rounded-xl
                bg-amber-400
                px-6
                py-4
                font-black
                text-amber-950
                transition
                hover:bg-amber-300
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              {loading ? "Bitte warten..." : "Raum erstellen"}
            </button>
          </section>

          {/* JOIN */}

          <section className="rounded-3xl border border-emerald-400/20 bg-zinc-950/90 p-8 shadow-2xl">
            <div className="text-4xl">⚔️</div>

            <h2 className="mt-5 text-2xl font-black">Raum beitreten</h2>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Gib den Raumcode ein, den du von einem anderen Spieler erhalten
              hast.
            </p>

            <input
              value={roomCode}
              onChange={(event) =>
                setRoomCode(event.target.value.toUpperCase().slice(0, 6))
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void joinRoom();
                }
              }}
              placeholder="ABC123"
              maxLength={6}
              className="
                mt-7
                w-full
                rounded-xl
                border
                border-white/10
                bg-black/30
                px-5
                py-4
                text-center
                text-2xl
                font-black
                uppercase
                tracking-[0.3em]
                text-white
                outline-none
                transition
                placeholder:text-zinc-700
                focus:border-emerald-400
              "
            />

            <button
              type="button"
              disabled={loading || !user || !roomCode.trim()}
              onClick={joinRoom}
              className="
                mt-4
                w-full
                rounded-xl
                bg-emerald-500
                px-6
                py-4
                font-black
                text-emerald-950
                transition
                hover:bg-emerald-400
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              Raum beitreten
            </button>
          </section>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-200">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}
