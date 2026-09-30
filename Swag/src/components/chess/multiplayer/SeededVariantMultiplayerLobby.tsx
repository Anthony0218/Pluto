import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

import { createRandomStartPosition } from "@/games/chess/variants/randomStartChess";
import { createTotalChaosPosition } from "@/games/chess/variants/totalChaosChess";

import type {
  MultiplayerVariantId,
} from "@/games/chess/multiplayer/variantMultiplayerTypes";

type Props = {
  variant: Extract<MultiplayerVariantId, "randomstart" | "complete-chaos">;
};

const variantInfo = {
  randomstart: {
    title: "Random Start Chess",
    subtitle: "Independent random back ranks. No mirroring. No castling.",
    icon: "🎲",
    baseRoute: "/games/chess/variants/randomstart/multiplayer",
    eyebrow: "Random Start · Multiplayer",
    accentText: "text-violet-300",
    accentBorder: "border-violet-400/20",
    accentSoft: "bg-violet-400/10",
    accentButton: "bg-violet-400 text-violet-950 hover:bg-violet-300",
    selectedButton: "border-violet-400/30 bg-violet-400/10 text-violet-200",
    focusBorder: "focus:border-violet-400/40",
    description:
      "A single independent back-rank shuffle is stored in the room, so both players always start from exactly the same randomized position.",
  },
  "complete-chaos": {
    title: "Total Chaos Chess",
    subtitle: "Every piece. Any part of the board.",
    icon: "🌀",
    baseRoute: "/games/chess/variants/complete-chaos/multiplayer",
    eyebrow: "Total Chaos · Multiplayer",
    accentText: "text-pink-300",
    accentBorder: "border-pink-400/20",
    accentSoft: "bg-pink-400/10",
    accentButton: "bg-pink-300 text-zinc-950 hover:bg-pink-200",
    selectedButton: "border-pink-400/30 bg-pink-400/10 text-pink-200",
    focusBorder: "focus:border-pink-400/40",
    description:
      "One full-board Chaos position is generated and saved with the room. The random setup is identical on both browsers.",
  },
} as const;

function normalizeRoomCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export default function SeededVariantMultiplayerLobby({ variant }: Props) {
  useUiLanguage();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const info = variantInfo[variant];

  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(window.location.search).get("code")?.toUpperCase() ?? "");
  const [loading, setLoading] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayName = useMemo(() => {
    const username =
      typeof profile?.username === "string" ? profile.username.trim() : "";

    if (username) return username;

    const emailName = user?.email?.split("@")[0]?.trim();
    return emailName || "Player";
  }, [profile?.username, user?.email]);

  function buildInitialGame() {
    if (variant === "randomstart") {
      const position = createRandomStartPosition();
      return { seed: position.seed, initialFen: position.fen };
    }

    const position = createTotalChaosPosition();
    return { seed: position.seed, initialFen: position.fen };
  }

  async function createRoom() {
    if (!user) {
      setError("You must be logged in to create a room.");
      return;
    }

    setLoading("create");
    setError(null);

    try {
      const initial = buildInitialGame();

      const { data, error: rpcError } = await supabase.rpc(
        "create_variant_room",
        {
          p_variant: variant,
          p_initial_fen: initial.initialFen,
          p_seed: initial.seed,
          p_display_name: displayName,
          p_host_color: "black",
        },
      );

      if (rpcError) throw rpcError;

      const code = typeof data === "string" ? data : String(data ?? "");
      if (!code) throw new Error("Room code was not returned.");

      navigate(`${info.baseRoute}/${code}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not create room.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function joinRoom() {
    if (!user) {
      setError("You must be logged in to join a room.");
      return;
    }

    const code = normalizeRoomCode(joinCode);

    if (code.length !== 6) {
      setError("Enter the 6-character room code.");
      return;
    }

    setLoading("join");
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "join_variant_room",
        {
          p_code: code,
          p_expected_variant: variant,
          p_display_name: displayName,
        },
      );

      if (rpcError) throw rpcError;

      const joinedCode = typeof data === "string" ? data : code;
      navigate(`${info.baseRoute}/${joinedCode}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not join room.",
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <ChessPageHeader className={`mb-7 rounded-3xl border ${info.accentBorder} bg-zinc-900/70 p-6 shadow-2xl shadow-black/30`} description={<> {ui(info.subtitle)} </>}>

        </ChessPageHeader>

        {!user ? (
          <section className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-6">
            <p className="font-black text-amber-200">{ui("Sign in required")}</p>
            <p className="mt-2 text-sm text-zinc-400">{ui("Multiplayer rooms use your existing Supabase account.")}</p>
          </section>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6 shadow-xl shadow-black/20">
              <p
                className={`text-xs font-black uppercase tracking-[0.2em] ${info.accentText}`}
              >{ui("Create room")}</p>
              <h2 className="mt-2 text-xl font-black">{ui("Start a new match")}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {ui(info.description)}
              </p>

              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void createRoom()}
                className={`mt-6 w-full rounded-xl px-5 py-3 font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${info.accentButton}`}
              >
                {loading === "create" ? ui("Creating...") : ui("Create Multiplayer Room")}
              </button>
            </section>

            <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6 shadow-xl shadow-black/20">
              <p
                className={`text-xs font-black uppercase tracking-[0.2em] ${info.accentText}`}
              >{ui("Join room")}</p>
              <h2 className="mt-2 text-xl font-black">{ui("Enter room code")}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{ui("Both players pick their color in the room and press Ready.")}</p>

              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(normalizeRoomCode(event.target.value))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") void joinRoom();
                }}
                placeholder={ui("ABC123")}
                maxLength={6}
                className={`mt-6 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-center font-mono text-2xl font-black uppercase tracking-[0.3em] text-white outline-none transition placeholder:text-zinc-700 ${info.focusBorder}`}
              />

              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void joinRoom()}
                className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-black text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === "join" ? ui("Joining...") : ui("Join Room")}
              </button>
            </section>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm font-semibold text-red-200">
            {ui(error)}
          </div>
        )}
      </div>
    </main>
  );
}
