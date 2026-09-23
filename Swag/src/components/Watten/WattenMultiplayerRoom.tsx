import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";

import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { ProfileAvatar } from "../social/ProfileAvatarPicker";
import {
  getInitialWattenLanguage,
  setStoredWattenLanguage,
  translateWatten,
  translateWattenPair,
  WattenLanguageSelector,
  type WattenLanguage,
} from "@/games/watten/i18n/wattenLanguage";

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

type ProfileRow = {
  id: string;
  avatar_id: string | null;
};

const fallbackAvatars = ["m1", "f1", "m2", "f2"];

export default function WattenMultiplayerRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const { user, profile } = useAuth();

  const [language, setLanguage] = useState<WattenLanguage>(
    getInitialWattenLanguage,
  );
  const [targetScore, setTargetScore] = useState(15);

  const t = useCallback(
    (key: string) => translateWatten(language, key),
    [language],
  );

  const l = useCallback(
    (de: string, en: string) => translateWattenPair(language, de, en),
    [language],
  );

  function changeLanguage(next: WattenLanguage) {
    setLanguage(next);
    setStoredWattenLanguage(next);
  }

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [playerAvatarIds, setPlayerAvatarIds] = useState<
    Record<string, string>
  >({});

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const normalizedRoomCode = useMemo(
    () => roomCode?.trim().toUpperCase() ?? "",
    [roomCode],
  );

  const isHost = Boolean(room && user && room.host_id === user.id);

  const ownAvatarId =
    (profile as { avatar_id?: string | null } | null)?.avatar_id ?? "m1";

  function updateTargetScore(value: number) {
    const next = Math.max(2, Math.min(30, Math.trunc(value)));
    setTargetScore(next);
    if (room?.id) {
      window.localStorage.setItem(`watten-target-${room.id}`, String(next));
    }
  }

  useEffect(() => {
    if (!room?.id || room.status !== "waiting") return;
    const stored = window.localStorage.getItem(`watten-target-${room.id}`);
    const parsed = stored ? Number(stored) : NaN;
    if (Number.isFinite(parsed) && parsed >= 2 && parsed <= 30) {
      setTargetScore(Math.trunc(parsed));
    }
  }, [room?.id, room?.status]);

  const loadPlayers = useCallback(
    async (roomId: string) => {
      const { data, error: playerError } = await supabase
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

      if (playerError) {
        console.error("Could not load Watten players:", playerError);
        return;
      }

      const loadedPlayers = (data ?? []) as RoomPlayer[];

      setPlayers(loadedPlayers);

      const userIds = [
        ...new Set(
          loadedPlayers.map((player) => player.user_id).filter(Boolean),
        ),
      ];

      if (userIds.length === 0) {
        setPlayerAvatarIds({});
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, avatar_id")
        .in("id", userIds);

      if (profileError) {
        /*
         * Do not break the room if profile RLS does not expose
         * other users. At minimum, keep the local user's avatar.
         */
        console.warn("Could not load Watten player avatars:", profileError);

        if (user?.id) {
          setPlayerAvatarIds((current) => ({
            ...current,
            [user.id]: ownAvatarId,
          }));
        }

        return;
      }

      const nextAvatars: Record<string, string> = {};

      for (const row of (profileData ?? []) as ProfileRow[]) {
        if (row.id) {
          nextAvatars[row.id] =
            typeof row.avatar_id === "string" && row.avatar_id
              ? row.avatar_id
              : "m1";
        }
      }

      if (user?.id && !nextAvatars[user.id]) {
        nextAvatars[user.id] = ownAvatarId;
      }

      setPlayerAvatarIds(nextAvatars);
    },
    [user?.id, ownAvatarId],
  );

  const refreshRoom = useCallback(
    async (showLoader = false) => {
      if (!normalizedRoomCode || !user) {
        return;
      }

      if (showLoader) {
        setLoading(true);
      }

      const { data, error: roomError } = await supabase
        .from("watten_rooms")
        .select(
          `
          id,
          code,
          host_id,
          status
          `,
        )
        .eq("code", normalizedRoomCode)
        .maybeSingle();

      if (roomError) {
        console.error("Could not load Watten room:", roomError);

        setError(roomError.message);
        setLoading(false);
        return;
      }

      if (!data) {
        setError(
          l(
            "Raum nicht gefunden oder du bist kein Mitglied dieses Raumes.",
            "Room not found or you are not a member of this room.",
          ),
        );
        setLoading(false);
        return;
      }

      const loadedRoom = data as Room;

      setRoom(loadedRoom);
      setError(null);

      await loadPlayers(loadedRoom.id);

      if (loadedRoom.status === "playing") {
        setLoading(false);

        navigate(`/games/watten/multiplayer/4/${loadedRoom.code}`, {
          replace: true,
        });

        return;
      }

      setLoading(false);
    },
    [normalizedRoomCode, user, loadPlayers, navigate, l],
  );

  useEffect(() => {
    if (!normalizedRoomCode || !user) {
      return;
    }

    void refreshRoom(true);
  }, [normalizedRoomCode, user, refreshRoom]);

  /*
   * REALTIME
   *
   * Important: every .on(...) callback is registered BEFORE
   * subscribe() is called.
   *
   * The old component built the channel inside an async loader.
   * During repeated/StrictMode loads that could leave a channel in
   * the subscribed state while more callbacks were being attached.
   */
  useEffect(() => {
    if (!room?.id || !user?.id) {
      return;
    }

    const roomId = room.id;
    const currentUserId = user.id;

    const channelInstance =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const channel = supabase.channel(
      `watten-room-${roomId}-${currentUserId}-${channelInstance}`,
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "watten_room_players",
        filter: `room_id=eq.${roomId}`,
      },
      () => {
        void loadPlayers(roomId);
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "watten_rooms",
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        const nextRoom = payload.new as Room;

        setRoom(nextRoom);

        if (nextRoom.status === "playing") {
          navigate(`/games/watten/multiplayer/4/${nextRoom.code}`, {
            replace: true,
          });
        }
      },
    );

    channel.subscribe((status) => {
      if (status === "CHANNEL_ERROR") {
        console.warn(
          "Watten room realtime channel failed. Polling fallback remains active.",
        );
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room?.id, user?.id, loadPlayers, navigate]);

  /*
   * Polling fallback:
   * if Realtime misses an event, the room still leaves the waiting
   * state and the player list still refreshes.
   */
  useEffect(() => {
    if (!room?.id || !user) {
      return;
    }

    const roomId = room.id;

    const timer = window.setInterval(() => {
      void loadPlayers(roomId);
      void refreshRoom(false);
    }, 1800);

    return () => {
      window.clearInterval(timer);
    };
  }, [room?.id, user, loadPlayers, refreshRoom]);

  async function startGame() {
    if (!room || !isHost || starting) {
      return;
    }

    if (players.length !== 4) {
      setError(
        l(
          "Es müssen genau 4 Spieler im Raum sein.",
          "There must be exactly 4 players in the room.",
        ),
      );
      return;
    }

    const target = Math.max(2, Math.min(30, Math.trunc(targetScore)));
    updateTargetScore(target);
    setStarting(true);
    setError(null);

    try {
      const withTarget = await supabase.rpc("start_watten_game", {
        p_room_id: room.id,
        p_target_score: target,
      });

      if (!withTarget.error) {
        navigate(`/games/watten/multiplayer/4/${room.code}`, { replace: true });
        return;
      }

      const message = withTarget.error.message.toLowerCase();
      const missingTargetOverload =
        message.includes("p_target_score") ||
        message.includes("schema cache") ||
        message.includes("could not find the function") ||
        message.includes("function public.start_watten_game");

      if (!missingTargetOverload) {
        setError(
          l(
            `Das Spiel konnte nicht gestartet werden: ${withTarget.error.message}`,
            `The game could not be started: ${withTarget.error.message}`,
          ),
        );
        return;
      }

      const { error: startError } = await supabase.rpc("start_watten_game", {
        p_room_id: room.id,
      });

      if (startError) {
        console.error("Could not start Watten:", startError);
        setError(
          startError.message ??
            l(
              "Das Spiel konnte nicht gestartet werden.",
              "The game could not be started.",
            ),
        );
        return;
      }

      let targetError: { message: string } | null = null;

      const targetRpc = await supabase.rpc("set_watten_target_score", {
        p_room_id: room.id,
        p_target_score: target,
      });

      if (targetRpc.error) {
        const targetRpcMessage = targetRpc.error.message.toLowerCase();
        const helperMissing =
          targetRpcMessage.includes("set_watten_target_score") &&
          (targetRpcMessage.includes("schema cache") ||
            targetRpcMessage.includes("could not find the function") ||
            targetRpcMessage.includes(
              "function public.set_watten_target_score",
            ));

        if (helperMissing) {
          const directUpdate = await supabase
            .from("watten_games")
            .update({ target_score: target })
            .eq("room_id", room.id);
          targetError = directUpdate.error;
        } else {
          targetError = targetRpc.error;
        }
      }

      if (targetError) {
        setError(
          l(
            `Das Spiel wurde gestartet, aber das Ziel konnte nicht auf ${target} Punkte gesetzt werden: ${targetError.message}`,
            `The game started, but the target could not be set to ${target} points: ${targetError.message}`,
          ),
        );
        return;
      }

      navigate(`/games/watten/multiplayer/4/${room.code}`, { replace: true });
    } finally {
      setStarting(false);
    }
  }

  async function copyRoomCode() {
    if (!room?.code || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(room.code);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      setError(
        l(
          "Der Raumcode konnte nicht kopiert werden.",
          "Could not copy room code.",
        ),
      );
    }
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent text-white">
        <p>{l("Bitte zuerst einloggen.", "Please sign in first.")}</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent text-white">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-white/15 border-t-amber-300" />

          <p className="mt-4 font-bold text-zinc-300">
            {l("Raum wird geladen...", "Loading room...")}
          </p>
        </div>
      </main>
    );
  }

  if (error && !room) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-6 text-white">
        <div className="text-center">
          <p className="text-red-300">{error}</p>

          <button
            type="button"
            onClick={() => navigate("/games/watten/multiplayer")}
            className="mt-6 rounded-xl bg-white/10 px-5 py-3"
          >
            {t("Back")}
          </button>
        </div>
      </main>
    );
  }

  if (!room) {
    return null;
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        {/* HEADER */}

        <header className="flex flex-wrap items-start justify-between gap-4 rounded-[30px] border border-white/10 bg-zinc-950/70 p-6 shadow-2xl shadow-black/30">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">
              {t("Bavarian Watten")} · Multiplayer
            </p>

            <h1 className="mt-1 text-3xl font-black">
              {l("4 Spieler · 2 gegen 2", "4 Players · 2 vs 2")}
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              {l(
                "Team A: Sitz 1 + 3 · Team B: Sitz 2 + 4",
                "Team A: seats 1 + 3 · Team B: seats 2 + 4",
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <WattenLanguageSelector
              language={language}
              onChange={changeLanguage}
              label={t("Language")}
            />

            <Link
              to="/games/watten/multiplayer"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              {t("Leave")}
            </Link>
          </div>
        </header>

        {/* ROOM CODE */}

        <button
          type="button"
          onClick={() => void copyRoomCode()}
          className="mt-6 w-full rounded-[28px] border border-amber-300/20 bg-zinc-950/75 p-7 text-center shadow-xl transition hover:border-amber-300/40 hover:bg-zinc-950"
          title={l("Raumcode kopieren", "Copy room code")}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">
            {t("Room code")}
          </p>

          <p className="mt-2 break-all font-mono text-4xl font-black tracking-[0.16em] text-amber-200 sm:text-5xl">
            {room.code}
          </p>

          <p className="mt-3 text-xs font-bold text-zinc-500">
            {copied
              ? `✓ ${t("Copied to clipboard")}`
              : t("Click this box to copy the code")}
          </p>
        </button>

        {/* PLAYERS */}

        <section className="mt-6 rounded-[30px] border border-white/10 bg-zinc-950/65 p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
                {t("Players")}
              </p>

              <h2 className="mt-1 text-2xl font-black">
                {players.length}/4 {l("verbunden", "connected")}
              </h2>
            </div>

            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-zinc-400">
              {players.length === 4
                ? l("Bereit", "Ready")
                : l("Warteraum", "Waiting room")}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((seat) => {
              const player = players.find((current) => current.seat === seat);

              const isTeamA = seat % 2 === 0;

              const avatarId = player
                ? (playerAvatarIds[player.user_id] ??
                  fallbackAvatars[seat] ??
                  "m1")
                : (fallbackAvatars[seat] ?? "m1");

              return (
                <div
                  key={seat}
                  className={`
                    relative
                    overflow-hidden
                    rounded-2xl
                    border
                    p-4
                    transition

                    ${
                      player
                        ? isTeamA
                          ? "border-amber-300/30 bg-amber-400/[0.07]"
                          : "border-emerald-300/30 bg-emerald-400/[0.07]"
                        : "border-white/10 bg-white/[0.03]"
                    }
                  `}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`
                        h-16
                        w-16
                        shrink-0
                        overflow-hidden
                        rounded-2xl
                        border

                        ${
                          player
                            ? isTeamA
                              ? "border-amber-300/30"
                              : "border-emerald-300/30"
                            : "border-white/10 opacity-35"
                        }
                      `}
                    >
                      <ProfileAvatar
                        avatarId={avatarId}
                        className="h-full w-full"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                          {l("Sitz", "Seat")} {seat + 1}
                        </p>

                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            player
                              ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]"
                              : "bg-zinc-700"
                          }`}
                        />
                      </div>

                      <p
                        className={`mt-1 truncate text-lg font-black ${
                          player ? "text-white" : "text-zinc-600"
                        }`}
                      >
                        {player
                          ? player.display_name
                          : l("Wartet auf Spieler...", "Waiting for player...")}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                            isTeamA
                              ? "bg-amber-400/15 text-amber-300"
                              : "bg-emerald-400/15 text-emerald-300"
                          }`}
                        >
                          {isTeamA ? "Team A" : "Team B"}
                        </span>

                        {player?.user_id === user.id && (
                          <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-sky-300">
                            {l("Du", "You")}
                          </span>
                        )}

                        {player?.user_id === room.host_id && (
                          <span className="rounded-full bg-violet-400/15 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-violet-300">
                            {l("Gastgeber", "Host")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {isHost && (
          <section className="mt-4 rounded-[24px] border border-white/10 bg-zinc-950/65 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
                {l("Siegpunkte", "Target score")}
              </p>
              <span className="text-sm font-black text-amber-200">
                {targetScore}
              </span>
            </div>

            <div className="mt-2 flex items-center gap-2">
              {[11, 15, 18].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => updateTargetScore(score)}
                  className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-sm font-black transition ${
                    targetScore === score
                      ? "bg-amber-300 text-amber-950"
                      : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  {score}
                </button>
              ))}
              <input
                aria-label={l("Eigener Zielwert", "Custom target score")}
                type="number"
                min={2}
                max={30}
                value={targetScore}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) updateTargetScore(value);
                }}
                className="w-20 rounded-lg border border-white/10 bg-black/20 px-2 py-2 text-center text-sm font-black outline-none transition focus:border-amber-300/50"
              />
            </div>
            <p className="mt-1 text-[9px] font-bold text-zinc-600">
              {l("Eigener Wert: 2–30", "Custom: 2–30")}
            </p>
          </section>
        )}

        {/* START */}

        <section className="mt-4 rounded-[24px] border border-white/10 bg-zinc-950/65 p-4 text-center">
          {players.length < 4 ? (
            <>
              <p className="text-xl font-black">
                {l("Warte auf Mitspieler", "Waiting for players")}
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                {l("Noch", "Still")} {4 - players.length}{" "}
                {l(
                  4 - players.length === 1
                    ? "Spieler erforderlich"
                    : "Spieler erforderlich",
                  4 - players.length === 1 ? "player needed" : "players needed",
                )}
                .
              </p>
            </>
          ) : (
            <>
              <p className="text-xl font-black text-emerald-300">
                {l(
                  "Alle vier Spieler sind verbunden",
                  "All four players are connected",
                )}
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                {l(
                  "Der Gastgeber kann die Partie jetzt starten.",
                  "The host can start the game now.",
                )}
              </p>
            </>
          )}

          {isHost ? (
            <button
              type="button"
              onClick={() => void startGame()}
              disabled={players.length !== 4 || starting}
              className="
                mt-4
                w-full
                rounded-xl
                bg-amber-300
                px-6
                py-2.5
                text-sm
                font-black
                text-amber-950
                transition
                hover:bg-amber-200
                disabled:cursor-not-allowed
                disabled:opacity-35
              "
            >
              {starting
                ? l("Spiel wird gestartet...", "Game is starting...")
                : l("4-Spieler-Partie starten", "Start 4-player game")}
            </button>
          ) : (
            <p className="mt-5 text-xs font-bold text-zinc-600">
              {l(
                "Der Gastgeber startet das Spiel.",
                "The host starts the game.",
              )}
            </p>
          )}

          {error && (
            <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-200">
              {error}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
