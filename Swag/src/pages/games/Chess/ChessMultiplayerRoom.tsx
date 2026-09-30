import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import { ProfileAvatar } from "../../../components/social/ProfileAvatarPicker.tsx";
import { ColorChoice, ReadyButton, type PlayerColor } from "../../../components/chess/RoomColorControls";

type ChessRoom = {
  id: string;
  code: string;
  host_id: string;
  status: "waiting" | "ready" | "playing" | "finished";
  match_kind: "casual" | "ranked";
};

type RoomPlayer = {
  room_id: string;
  user_id: string;
  seat: number;
  display_name: string;
  preferred_color?: "white" | "black" | null;
  ready?: boolean;
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
        <ChessPageHeader className="chess-menu-header">


          <Link
            to="/games/chess/rules"
            className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
          >
            <span className="text-base">♔</span>
            <span className="hidden sm:inline">{ui("Rules & Tips")}</span>
          </Link>
        </ChessPageHeader>

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
  const [colorSaving, setColorSaving] = useState(false);
  const [readySaving, setReadySaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUserAvatarId =
    (profile as { avatar_id?: string | null } | null)?.avatar_id ?? "m1";

  const loadRoom = useCallback(async () => {
    if (!roomCode) return;

    const { data: roomData, error: roomError } = await supabase
      .from("chess_rooms")
      .select("id, code, host_id, status, match_kind")
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
      .select("*")
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
      navigate(`${room.match_kind === "ranked" ? "/games/chess/ranked" : "/games/chess/classic/multiplayer"}/${room.code}/game`);
    }
  }, [room?.status, room?.code, room?.match_kind, navigate]);

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

  async function chooseColor(color: PlayerColor | null) {
    if (!room || colorSaving) return;

    setColorSaving(true);
    setError(null);

    const { error: colorError } = await supabase.rpc("set_chess_room_color", {
      p_room_id: room.id,
      p_color: color,
    });

    if (colorError) {
      console.error(colorError);
      setError(colorError.message);
    }

    await loadRoom();
    setColorSaving(false);
  }

  async function setReady(ready: boolean) {
    if (!room || readySaving) return;

    setReadySaving(true);
    setError(null);

    const { error: readyError } = await supabase.rpc("set_chess_room_ready", {
      p_room_id: room.id,
      p_ready: ready,
    });

    if (readyError) {
      console.error(readyError);
      setError(readyError.message);
    }

    await loadRoom();
    setReadySaving(false);
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
              to="/games/chess/classic/multiplayer"
              className="mt-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white"
            >{ui("← Back to Multiplayer")}</Link>
          </div>
        </section>
      </ChessPageShell>
    );
  }

  if (!room) return null;

  const isCasual = room.match_kind === "casual";
  const isHost = room.host_id === user?.id;
  const myPlayer = players.find((player) => player.user_id === user?.id);
  const opponent = players.find((player) => player.user_id !== user?.id);
  const inSetup = room.status === "waiting" || room.status === "ready";
  const canChooseColor = isCasual && inSetup && Boolean(myPlayer);
  const myColor = myPlayer?.preferred_color ?? null;
  const myReady = Boolean(myPlayer?.ready);
  const bothReady = players.length === 2 && players.every((player) => player.ready);
  // Ranked rooms keep their seat order; ranked colors are revealed in the game.
  const white = players.find((player) => player.seat === 0);
  const black = players.find((player) => player.seat === 1);
  const host = players.find((player) => player.user_id === room.host_id);
  const guest = players.find((player) => player.user_id !== room.host_id);

  return (
    <ChessPageShell>
      <section className="grid min-h-0 flex-1 lg:grid-cols-[minmax(360px,.82fr)_minmax(620px,1.18fr)]">
        <header className="relative flex min-h-[430px] flex-col justify-center px-7 py-14 sm:px-10 lg:min-h-0 lg:px-14 lg:py-16 xl:px-20 2xl:px-24">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-px bg-gradient-to-b from-transparent via-white/10 to-transparent lg:block" />

          <div className="max-w-[620px]">
            <Link
              to={room?.match_kind === "ranked" ? "/games/chess/ranked" : "/games/chess/classic/multiplayer"}
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
              {isCasual ? (
                <>
                  <PlayerCard
                    player={host}
                    avatarId={host ? avatarIdsByUserId[host.user_id] : undefined}
                    label={host?.user_id === user?.id ? "Host · You" : "Host"}
                    color={host?.preferred_color ?? null}
                    ready={Boolean(host?.ready)}
                  />
                  <PlayerCard
                    player={guest}
                    avatarId={guest ? avatarIdsByUserId[guest.user_id] : undefined}
                    label={guest?.user_id === user?.id ? "Guest · You" : "Guest"}
                    color={guest?.preferred_color ?? null}
                    ready={Boolean(guest?.ready)}
                    canInvite={room.status === "waiting" && !guest}
                  />
                </>
              ) : (
                <>
                  <PlayerCard
                    player={white}
                    avatarId={white ? avatarIdsByUserId[white.user_id] : undefined}
                    label={white?.user_id === user?.id ? "Seat 1 · You" : "Seat 1"}
                  />
                  <PlayerCard
                    player={black}
                    avatarId={black ? avatarIdsByUserId[black.user_id] : undefined}
                    label={black?.user_id === user?.id ? "Seat 2 · You" : "Seat 2"}
                    canInvite={room.status === "waiting" && !black}
                  />
                </>
              )}
            </div>

            {canChooseColor && (
              <section className="rounded-[22px] border border-white/[0.09] bg-black/20 p-5 shadow-[0_16px_40px_rgba(0,0,0,.22)] backdrop-blur-md sm:p-6">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.28em] text-amber-300/65">{ui("Your color")}</p>
                  <p className="text-[11px] text-zinc-600">{ui("Tick a color · untick it to free it")}</p>
                </div>
                <ColorChoice
                  myColor={myColor}
                  opponentColor={opponent?.preferred_color ?? null}
                  opponentName={opponent?.display_name ?? null}
                  disabled={colorSaving}
                  onChange={(color) => void chooseColor(color)}
                />
              </section>
            )}

            <section className="rounded-[22px] border border-white/[0.09] bg-black/20 p-5 shadow-[0_16px_40px_rgba(0,0,0,.22)] backdrop-blur-md sm:p-6 xl:p-7">
              <p className="text-[9px] font-black uppercase tracking-[0.28em] text-amber-300/65">{ui("Room status")}</p>

              <h2 className="mt-2 font-serif text-[27px] leading-tight text-white sm:text-[31px]">
                {room.status === "playing"
                  ? ui("Game is starting")
                  : players.length < 2
                    ? ui("Waiting for another player")
                    : !isCasual || bothReady
                      ? ui("Both players are ready")
                      : ui("Waiting for both players to be ready")}
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                {room.status === "playing"
                  ? ui("Opening the synchronized board...")
                  : players.length < 2
                    ? ui("The second player card will fill automatically when your opponent joins.")
                    : !isCasual || bothReady
                      ? isHost ? ui("Your opponent is here. Start whenever you are ready.") : ui("Both seats are occupied. Waiting for the host to start.")
                      : ui("Each player picks a different color and presses Ready. Then the host can start.")}
              </p>

              {isCasual && inSetup && myPlayer && (
                <ReadyButton
                  ready={myReady}
                  hasColor={Boolean(myColor)}
                  saving={readySaving}
                  onToggle={() => void setReady(!myReady)}
                />
              )}

              {inSetup &&
                (isHost ? (
                  <button
                    type="button"
                    disabled={starting || players.length < 2 || (isCasual && !bothReady)}
                    onClick={startGame}
                    className="group mt-3 flex w-full items-center justify-between rounded-xl border border-amber-300/45 bg-amber-300/[0.06] px-4 py-3.5 text-sm font-black text-amber-200 transition hover:bg-amber-300/[0.10] disabled:cursor-not-allowed disabled:border-white/[0.08] disabled:bg-white/[0.02] disabled:text-zinc-600"
                  >
                    <span>{starting ? ui("Starting...") : ui("Start Game")}</span>
                    <span className="text-xl transition group-enabled:group-hover:translate-x-1">→</span>
                  </button>
                ) : (
                  players.length === 2 && (
                    <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 text-sm text-zinc-500">
                      {!isCasual || bothReady ? ui("Waiting for host...") : ui("The host can start once both players are ready.")}
                    </div>
                  )
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
  label,
  color,
  ready,
  canInvite = false,
}: {
  player: RoomPlayer | undefined;
  avatarId?: string;
  label: string;
  color?: PlayerColor | null;
  ready?: boolean;
  canInvite?: boolean;
}) {
  useUiLanguage();
  const highlighted = Boolean(player);
  const symbol = color === "black" ? "♚" : color === "white" ? "♔" : "♙";

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
            <span>{symbol}</span>
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
            {player?.display_name ?? ui("Waiting...")}
          </h2>

          {player && color !== undefined && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                  color === "white"
                    ? "border-zinc-200/30 bg-zinc-100/10 text-zinc-100"
                    : color === "black"
                      ? "border-zinc-500/40 bg-black/40 text-zinc-300"
                      : "border-dashed border-white/15 text-zinc-500"
                }`}
              >
                {color && <span aria-hidden="true">{symbol}</span>}
                {color === "white" ? ui("White") : color === "black" ? ui("Black") : ui("No color")}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                  ready
                    ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200"
                    : "border-white/10 text-zinc-500"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${ready ? "bg-emerald-400" : "bg-zinc-600"}`} />
                {ready ? ui("Ready") : ui("Not ready")}
              </span>
            </div>
          )}

          {(!player || color === undefined) && (
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
              <span
                className={`h-2 w-2 rounded-full ${
                  player
                    ? "bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,.45)]"
                    : "bg-zinc-700"
                }`}
              />
              <span>{player ? ui("Player joined") : ui("Waiting for player")}</span>
            </div>
          )}
          {canInvite && <button type="button" onClick={() => window.dispatchEvent(new Event("open-room-friends"))} className="mt-3 rounded-lg border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-300/20 focus-visible:outline-2 focus-visible:outline-amber-300">{ui("Invite Friend")}</button>}
        </div>
      </div>
    </section>
  );
}
