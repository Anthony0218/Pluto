import { ui, useUiLanguage } from "@/i18n/ui";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import { ProfileAvatar } from "../../../components/social/ProfileAvatarPicker.tsx";

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

type ProfileRow = {
  id: string;
  avatar_id: string | null;
};

function ChessPageShell({ children }: { children: React.ReactNode }) {
  useUiLanguage();
  return (
    <main className="chess-menu-page relative left-1/2 min-h-[var(--app-height)] w-screen -translate-x-1/2 overflow-hidden bg-[#07090b] text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_13%_68%,rgba(245,158,11,.09),transparent_28%),radial-gradient(circle_at_76%_23%,rgba(255,255,255,.045),transparent_30%),linear-gradient(to_bottom,#0a0d10,#07090b_58%,#040506)]" />
      <div className="pointer-events-none absolute -bottom-28 -left-24 text-[390px] leading-none text-amber-100/[0.035]">
        ♚
      </div>
      <div className="pointer-events-none absolute bottom-[-72px] left-[25%] text-[250px] leading-none text-white/[0.018]">
        ♞
      </div>
      <div className="pointer-events-none absolute right-[-50px] top-[15%] text-[290px] leading-none text-white/[0.014]">
        ♝
      </div>

      <div className="relative flex min-h-[var(--app-height)] w-full flex-col">
        <nav className="flex min-h-20 w-full items-center justify-between border-b border-white/[0.07] px-6 sm:px-10 lg:px-14 xl:px-20">
          <Link to="/games/chess" className="inline-flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-lg text-amber-300">
              ♛
            </span>
            <span className="font-serif text-sm tracking-[0.28em] text-zinc-200">{ui("CHESS")}</span>
          </Link>

          <Link
            to="/games/chess/rules"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
          >
            <span className="text-base">♔</span>
            <span className="hidden sm:inline">{ui("Rules & Tips")}</span>
          </Link>
        </nav>

        {children}
      </div>
    </main>
  );
}

export default function ChessMultiplayerRoom() {
  useUiLanguage();
  const navigate = useNavigate();
  const { roomCode } = useParams();
  const { user, profile } = useAuth();

  const [room, setRoom] = useState<ChessRoom | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [avatarIdsByUserId, setAvatarIdsByUserId] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserAvatarId =
    (profile as { avatar_id?: string | null } | null)?.avatar_id ?? "m1";

  const loadRoom = useCallback(async () => {
    if (!roomCode) return;

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
      .select("room_id, user_id, seat, display_name")
      .eq("room_id", loadedRoom.id)
      .order("seat", { ascending: true });

    if (playerError) {
      console.error(playerError);
      setError("Players could not be loaded.");
      setLoading(false);
      return;
    }

    const nextPlayers = (playerData ?? []) as RoomPlayer[];
    setPlayers(nextPlayers);

    const userIds = Array.from(
      new Set(nextPlayers.map((entry) => entry.user_id).filter(Boolean)),
    );

    if (userIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select("id, avatar_id")
        .in("id", userIds);

      if (profileError) {
        console.error("Could not load player avatars:", profileError);
      }

      const nextAvatarMap: Record<string, string> = {};

      for (const row of (profileRows ?? []) as ProfileRow[]) {
        if (typeof row.avatar_id === "string" && row.avatar_id.length > 0) {
          nextAvatarMap[row.id] = row.avatar_id;
        }
      }

      if (user?.id) {
        nextAvatarMap[user.id] = nextAvatarMap[user.id] ?? currentUserAvatarId;
      }

      setAvatarIdsByUserId(nextAvatarMap);
    } else {
      setAvatarIdsByUserId({});
    }

    setLoading(false);
  }, [roomCode, user?.id, currentUserAvatarId]);

  useEffect(() => {
    if (room?.status === "playing") {
      navigate(`/games/chess/classic/multiplayer/${room.code}/game`);
    }
  }, [room?.status, room?.code, navigate]);

  useEffect(() => {
    if (!roomCode || !user) return;
    void loadRoom();
  }, [roomCode, user, loadRoom]);

  useEffect(() => {
    if (!room) return;

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
    if (!room || starting) return;

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

  async function copyCode() {
    if (!room) return;

    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (copyError) {
      console.error(copyError);
      setError("Code could not be copied.");
    }
  }

  if (loading) {
    return (
      <ChessPageShell>
        <section className="flex min-h-0 flex-1 items-center justify-center">
          <p className="font-serif text-xl text-zinc-400">{ui("Loading room...")}</p>
        </section>
      </ChessPageShell>
    );
  }

  if (error && !room) {
    return (
      <ChessPageShell>
        <section className="flex min-h-0 flex-1 items-center justify-center px-6 py-14">
          <div className="w-full max-w-[700px] rounded-[22px] border border-red-400/20 bg-black/25 p-8 text-center backdrop-blur-md">
            <p className="font-serif text-2xl text-red-200">{ui(error)}</p>
            <Link
              to="/chess/classic/multiplayer"
              className="mt-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
            >{ui("← Back to Multiplayer")}</Link>
          </div>
        </section>
      </ChessPageShell>
    );
  }

  if (!room) return null;

  const white = players.find((player) => player.seat === 0);
  const black = players.find((player) => player.seat === 1);
  const isHost = room.host_id === user?.id;
  const roomReady = players.length === 2 || room.status === "ready";

  return (
    <ChessPageShell>
      <section className="grid min-h-0 flex-1 lg:grid-cols-[minmax(360px,.82fr)_minmax(620px,1.18fr)]">
        <header className="relative flex min-h-[430px] flex-col justify-center px-7 py-14 sm:px-10 lg:min-h-0 lg:px-14 lg:py-16 xl:px-20 2xl:px-24">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-white/10 to-transparent lg:block" />

          <div className="max-w-[620px]">
            <Link
              to="/chess/classic/multiplayer"
              className="mb-8 inline-flex items-center gap-2 text-sm text-zinc-600 transition hover:text-white"
            >
              <span>←</span>{ui("Multiplayer")}</Link>

            <p className="text-[11px] font-black uppercase tracking-[0.34em] text-amber-400">{ui("Chess Room")}</p>

            <h1 className="mt-5 font-serif text-[52px] leading-[.94] tracking-[-0.035em] text-white sm:text-[66px] xl:text-[82px]">
              {room.code}
            </h1>

            <p className="mt-6 max-w-[500px] font-serif text-[18px] leading-8 text-zinc-400 sm:text-[20px]">{ui("Share this code with your opponent. The game can begin as soon as both seats are occupied.")}</p>
          </div>

          <button
            type="button"
            onClick={copyCode}
            className="group mt-8 flex max-w-[390px] items-center justify-between rounded-xl border border-white/[0.09] bg-black/20 px-4 py-3.5 text-left transition hover:border-amber-300/30 hover:bg-amber-300/[0.035]"
          >
            <span>
              <span className="block text-[8px] font-black uppercase tracking-[0.25em] text-zinc-600">{ui("Room code")}</span>
              <span className="mt-1 block font-mono text-xl font-black tracking-[0.16em] text-white">
                {room.code}
              </span>
            </span>

            <span className="text-sm font-black text-amber-300">
              {copied ? ui("Copied ✓") : ui("Copy")}
            </span>
          </button>

          <div className="mt-10 flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.28em] text-zinc-700">
            <span className="h-px w-14 bg-amber-400/45" />{ui("Private · Two players")}</div>
        </header>

        <div className="relative flex min-h-[620px] items-center border-t border-white/[0.06] px-5 py-8 sm:px-8 lg:min-h-0 lg:border-t-0 lg:px-10 lg:py-12 xl:px-14 2xl:px-20">
          <div className="mx-auto flex w-full max-w-[980px] flex-col gap-4 xl:gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <PlayerCard
                player={white}
                avatarId={white ? avatarIdsByUserId[white.user_id] : undefined}
                currentUserId={user?.id}
                label={white?.user_id === user?.id ? "White · You" : "White"}
                pieceSymbol="♙"
                highlighted={Boolean(white)}
              />

              <PlayerCard
                player={black}
                avatarId={black ? avatarIdsByUserId[black.user_id] : undefined}
                currentUserId={user?.id}
                label={black?.user_id === user?.id ? "Black · You" : "Black"}
                pieceSymbol="♟"
                highlighted={Boolean(black)}
              />
            </div>

            <section className="rounded-[22px] border border-white/[0.09] bg-black/20 p-5 shadow-[0_16px_40px_rgba(0,0,0,.22)] backdrop-blur-md sm:p-6 xl:p-7">
              <p className="text-[9px] font-black uppercase tracking-[0.28em] text-amber-300/65">{ui("Room status")}</p>

              <h2 className="mt-2 font-serif text-[27px] leading-tight text-white sm:text-[31px]">
                {room.status === "ready" ? ui("Both players are ready") : room.status === "playing" ? ui("Game is starting") : ui("Waiting for another player")}
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {room.status === "ready" ? isHost ? ui("Your opponent is here. Start whenever you are ready.") : ui("Both seats are occupied. Waiting for the host to start.") : room.status === "playing" ? ui("Opening the synchronized board...") : ui("The second player card will fill automatically when your opponent joins.")}
              </p>

              {room.status === "waiting" && (
                <button
                  type="button"
                  disabled
                  className="mt-6 flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3.5 text-sm font-black text-zinc-700"
                >
                  <span>{ui("Start Game")}</span>
                  <span>→</span>
                </button>
              )}

              {room.status === "ready" &&
                (isHost ? (
                  <button
                    type="button"
                    disabled={starting || !roomReady}
                    onClick={startGame}
                    className="group mt-6 flex w-full items-center justify-between rounded-xl border border-amber-300/45 bg-amber-300/[0.06] px-4 py-3.5 text-sm font-black text-amber-200 transition hover:bg-amber-300/[0.10] disabled:opacity-40"
                  >
                    <span>{starting ? ui("Starting...") : ui("Start Game")}</span>
                    <span className="text-xl transition group-hover:translate-x-1">
                      →
                    </span>
                  </button>
                ) : (
                  <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-sm text-zinc-500">{ui("Waiting for host...")}</div>
                ))}

              {room.status === "playing" && (
                <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.04] px-4 py-3 text-sm text-emerald-200">{ui("Redirecting to the game...")}</div>
              )}

              {error && (
                <div className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.05] px-4 py-3 text-sm text-red-200">
                  {ui(error)}
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </ChessPageShell>
  );
}

function PlayerCard({
  player,
  avatarId,
  currentUserId,
  label,
  pieceSymbol,
  highlighted,
}: {
  player: RoomPlayer | undefined;
  avatarId?: string;
  currentUserId: string | undefined;
  label: string;
  pieceSymbol: string;
  highlighted: boolean;
}) {
  useUiLanguage();
  const isCurrentUser = player?.user_id === currentUserId;

  return (
    <section
      className={`group relative overflow-hidden rounded-[22px] border bg-black/20 p-5 shadow-[0_16px_40px_rgba(0,0,0,.22)] backdrop-blur-md sm:p-6 ${
        highlighted
          ? "border-amber-300/35 bg-amber-300/[0.025]"
          : "border-white/[0.09]"
      }`}
    >
      <div className="relative flex items-center gap-4 sm:gap-5">
        <div
          className={`flex h-[74px] w-[74px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border text-[32px] shadow-inner ${
            highlighted
              ? "border-amber-300/35 bg-amber-300/10 text-amber-200"
              : "border-white/10 bg-white/[0.035] text-zinc-500"
          }`}
        >
          {player && avatarId ? (
            <ProfileAvatar
              avatarId={avatarId}
              className="block h-full w-full"
            />
          ) : (
            <span>{pieceSymbol}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p
            className={`text-[9px] font-black uppercase tracking-[0.26em] ${
              highlighted ? "text-amber-300/70" : "text-zinc-600"
            }`}
          >
            {ui(label)}
          </p>

          <h2 className="mt-1.5 truncate font-serif text-[25px] leading-tight text-white sm:text-[29px]">
            {player?.display_name ?? "Waiting..."}
          </h2>

          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
            <span
              className={`h-2 w-2 rounded-full ${
                player
                  ? "bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,.45)]"
                  : "bg-zinc-700"
              }`}
            />
            <span>
              {player ? isCurrentUser ? ui("You are ready") : ui("Player joined") : ui("Waiting for player")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
