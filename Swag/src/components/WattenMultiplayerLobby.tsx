import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { WattenVariant } from "../utils/types";
import { ProfileAvatar } from "./ProfileAvatarPicker";
import {
  getInitialWattenLanguage,
  setStoredWattenLanguage,
  translateWatten,
  WattenLanguageSelector,
  type WattenLanguage,
} from "@/games/watten/i18n/wattenLanguage";

type LoadingAction = "create" | "join" | null;

export default function WattenMultiplayerLobby() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [language, setLanguage] = useState<WattenLanguage>(
    getInitialWattenLanguage,
  );
  const [variant, setVariant] = useState<WattenVariant>("three-player");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState<LoadingAction>(null);
  const [error, setError] = useState<string | null>(null);

  const t = useCallback(
    (key: string) => translateWatten(language, key),
    [language],
  );

  function changeLanguage(next: WattenLanguage) {
    setLanguage(next);
    setStoredWattenLanguage(next);
    setError(null);
  }

  const playerCount = variant === "three-player" ? 3 : 4;

  const typedProfile = profile as {
    username?: string | null;
    avatar_id?: string | null;
  } | null;

  const displayName =
    typedProfile?.username?.trim() ||
    user?.email?.split("@")[0]?.trim() ||
    "Player";

  const avatarId = typedProfile?.avatar_id ?? "m1";

  function selectVariant(nextVariant: WattenVariant) {
    setVariant(nextVariant);
    setError(null);
  }

  function localizeServerError(message: string, fallbackKey: string) {
    const normalized = message.toLowerCase();

    if (
      normalized.includes("room is full") ||
      normalized.includes("room full")
    ) {
      return t("This room is already full.");
    }

    if (
      normalized.includes("room not found") ||
      normalized.includes("not found")
    ) {
      return t("This room could not be found.");
    }

    if (normalized.includes("already started")) {
      return t("This game has already started.");
    }

    if (
      normalized.includes("already joined") ||
      normalized.includes("already in room")
    ) {
      return t("You have already joined this room.");
    }

    if (
      normalized.includes("not authenticated") ||
      normalized.includes("authentication") ||
      normalized.includes("not signed in")
    ) {
      return t("You must be signed in.");
    }

    return message || t(fallbackKey);
  }

  async function createRoom() {
    if (!user) {
      setError(t("You must be signed in."));
      return;
    }

    setLoading("create");
    setError(null);

    try {
      if (variant === "three-player") {
        const { data, error: rpcError } = await supabase.rpc(
          "create_watten3_room",
          {
            p_display_name: displayName,
            p_avatar_id: avatarId,
            p_target_score: 15,
          },
        );

        if (rpcError) {
          throw rpcError;
        }

        const room = Array.isArray(data) ? data[0] : data;
        const code =
          room?.room_code ??
          room?.code ??
          (typeof data === "string" ? data : null);

        if (!code) {
          throw new Error("No room code returned.");
        }

        navigate(`/games/watten/multiplayer/3/${String(code)}`);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc(
        "create_watten_room",
        {
          p_display_name: displayName,
        },
      );

      if (rpcError) {
        throw rpcError;
      }

      const room = Array.isArray(data) ? data[0] : data;
      const code =
        room?.room_code ??
        room?.code ??
        (typeof data === "string" ? data : null);

      if (!code) {
        throw new Error("No room code returned.");
      }

      navigate(`/games/watten/multiplayer/4/${String(code)}`);
    } catch (cause) {
      console.error("Create Watten room failed:", cause);

      const rawMessage =
        typeof cause === "object" &&
        cause !== null &&
        "message" in cause &&
        typeof cause.message === "string"
          ? cause.message
          : "";

      if (rawMessage.includes("No room code returned")) {
        setError(t("The server did not return a room code."));
      } else {
        setError(
          localizeServerError(rawMessage, "The room could not be created."),
        );
      }
    } finally {
      setLoading(null);
    }
  }

  async function joinRoom() {
    if (!user) {
      setError(t("You must be signed in."));
      return;
    }

    const normalizedCode = roomCode.trim().toUpperCase();

    if (!normalizedCode) {
      setError(t("Please enter a room code."));
      return;
    }

    if (normalizedCode.length !== 6) {
      setError(t("The room code must contain 6 characters."));
      return;
    }

    setLoading("join");
    setError(null);

    try {
      if (variant === "three-player") {
        const { data, error: rpcError } = await supabase.rpc(
          "join_watten3_room",
          {
            p_code: normalizedCode,
            p_display_name: displayName,
            p_avatar_id: avatarId,
          },
        );

        if (rpcError) {
          throw rpcError;
        }

        const code = typeof data === "string" ? data : normalizedCode;
        navigate(`/games/watten/multiplayer/3/${code}`);
        return;
      }

      const { data, error: rpcError } = await supabase.rpc("join_watten_room", {
        p_code: normalizedCode,
        p_display_name: displayName,
      });

      if (rpcError) {
        console.error("join_watten_room RPC error:", rpcError);
        throw rpcError;
      }

      const code = typeof data === "string" ? data : normalizedCode;
      navigate(`/games/watten/multiplayer/4/${code}`);
    } catch (cause) {
      console.error("Join Watten room failed:", cause);

      const message =
        typeof cause === "object" && cause !== null && "message" in cause
          ? String(cause.message)
          : "";

      if (message.includes("Room is full")) {
        setError(t("This room is already full."));
      } else if (message.includes("Room not found")) {
        setError(t("This room could not be found."));
      } else if (message.includes("already started")) {
        setError(t("This game has already started."));
      } else {
        setError(localizeServerError(message, "Could not join room."));
      }
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[30px] border border-white/10 bg-zinc-950/90 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">
                {t("Bavarian Watten")}
              </p>

              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                {t("Multiplayer")}
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                {t(
                  "Choose a game variant first, then create a private room or join an existing one.",
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <WattenLanguageSelector
                language={language}
                onChange={changeLanguage}
                label={t("Language")}
              />

              <Link
                to="/games/watten"
                className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/10 hover:text-white"
              >
                {t("Back")}
              </Link>
            </div>
          </div>

          <section className="mt-8">
            <p className="mb-3 text-sm font-bold text-zinc-300">
              {t("Number of players")}
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => selectVariant("three-player")}
                className={`rounded-2xl border p-5 text-left transition ${
                  variant === "three-player"
                    ? "border-amber-400 bg-amber-400/10 shadow-lg shadow-amber-950/20"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xl font-black">{t("3 Players")}</div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {t("One solo player against a team of two.")}
                    </p>
                  </div>

                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                      variant === "three-player"
                        ? "bg-amber-400 text-amber-950"
                        : "bg-white/5 text-zinc-500"
                    }`}
                  >
                    3
                  </span>
                </div>

                <div className="mt-4 flex gap-2">
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/[0.07] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-300">
                    {t("Solo")}
                  </span>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    {t("Team of 2")}
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => selectVariant("four-player")}
                className={`rounded-2xl border p-5 text-left transition ${
                  variant === "four-player"
                    ? "border-amber-400 bg-amber-400/10 shadow-lg shadow-amber-950/20"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xl font-black">{t("4 Players")}</div>
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {t(
                        "Two fixed teams with partners sitting opposite each other.",
                      )}
                    </p>
                  </div>

                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                      variant === "four-player"
                        ? "bg-amber-400 text-amber-950"
                        : "bg-white/5 text-zinc-500"
                    }`}
                  >
                    4
                  </span>
                </div>

                <div className="mt-4 flex gap-2">
                  <span className="rounded-full border border-amber-400/20 bg-amber-400/[0.07] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-300">
                    Team A
                  </span>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    Team B
                  </span>
                </div>
              </button>
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-amber-400/20">
                  <ProfileAvatar
                    avatarId={avatarId}
                    className="h-full w-full"
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600">
                    {t("Signed in as")}
                  </p>
                  <p className="truncate font-black text-emerald-300">
                    {displayName}
                  </p>
                </div>

                <div className="ml-auto rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                  {playerCount} {t("Players")}
                </div>
              </div>
            ) : (
              <p className="text-sm font-semibold text-red-300">
                {t("You must be signed in to play multiplayer.")}
              </p>
            )}
          </section>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <section className="rounded-3xl border border-amber-400/20 bg-black/20 p-6 shadow-xl sm:p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-2xl">
                🃏
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                {variant === "three-player"
                  ? t("3-player Watten")
                  : t("4-player Watten")}
              </p>

              <h2 className="mt-1 text-2xl font-black">
                {t("Create a new room")}
              </h2>

              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {t(
                  "Create a private room and share the six-character room code with the other players.",
                )}
              </p>

              <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">{t("Players")}</span>
                  <strong>{playerCount}</strong>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">{t("Mode")}</span>
                  <strong>
                    {variant === "three-player" ? t("1 vs 2") : t("2 vs 2")}
                  </strong>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">{t("Room")}</span>
                  <strong>{t("Private")}</strong>
                </div>
              </div>

              <button
                type="button"
                disabled={loading !== null || !user}
                onClick={() => void createRoom()}
                className="mt-7 w-full rounded-xl bg-amber-400 px-6 py-4 font-black text-amber-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading === "create"
                  ? t("Creating room...")
                  : variant === "three-player"
                    ? t("Create 3-player room")
                    : t("Create 4-player room")}
              </button>
            </section>

            <section className="rounded-3xl border border-emerald-400/20 bg-black/20 p-6 shadow-xl sm:p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-2xl">
                ⚔️
              </div>

              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                {t("Join an existing game")}
              </p>

              <h2 className="mt-1 text-2xl font-black">{t("Join room")}</h2>

              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {t(
                  "Choose the same game mode as the host above, then enter the room code.",
                )}
              </p>

              <label
                htmlFor="watten-room-code"
                className="mt-6 block text-xs font-black uppercase tracking-wider text-zinc-500"
              >
                {t("Room code")}
              </label>

              <input
                id="watten-room-code"
                value={roomCode}
                onChange={(event) =>
                  setRoomCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 6),
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    roomCode.trim().length === 6 &&
                    loading === null &&
                    user
                  ) {
                    void joinRoom();
                  }
                }}
                placeholder="ABC123"
                maxLength={6}
                autoComplete="off"
                aria-label={t("Room code")}
                className="mt-2 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-5 py-4 text-center font-mono text-2xl font-black uppercase tracking-[0.3em] text-white outline-none transition placeholder:text-zinc-700 focus:border-emerald-400"
              />

              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-zinc-600">
                  {t("Selected")}: {playerCount} {t("Players")}
                </span>

                <span
                  className={
                    roomCode.length === 6
                      ? "font-bold text-emerald-400"
                      : "text-zinc-700"
                  }
                >
                  {roomCode.length}/6
                </span>
              </div>

              <button
                type="button"
                disabled={
                  loading !== null || !user || roomCode.trim().length !== 6
                }
                onClick={() => void joinRoom()}
                className="mt-7 w-full rounded-xl bg-emerald-500 px-6 py-4 font-black text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading === "join"
                  ? t("Opening room...")
                  : variant === "three-player"
                    ? t("Join 3-player room")
                    : t("Join 4-player room")}
              </button>
            </section>
          </div>

          {error && (
            <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-200">
              {error}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
