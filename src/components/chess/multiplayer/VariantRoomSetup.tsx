import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import ChessPageHeader from "@/components/chess/ChessPageHeader";
import InviteFriendButton from "@/components/chess/InviteFriendButton";
import { ColorChoice, ReadyButton, type PlayerColor } from "@/components/chess/RoomColorControls";
import { useAuth } from "@/context/AuthContext";
import { ui, useUiLanguage } from "@/i18n/ui";
import { supabase } from "@/lib/supabase";

type SetupRoom = {
  id: string;
  code: string;
  host_id: string;
  status: "waiting" | "playing" | "finished";
};

type SetupPlayer = {
  user_id: string;
  seat: number;
  display_name: string;
  chosen_color: string | null;
  ready: boolean | null;
};

type Props = {
  roomId: string;
  variantName: string;
  lobbyPath: string;
  /** Called once the host has started the game, so the page can load the board. */
  onStarted: () => void;
};

const asColor = (value: string | null): PlayerColor | null =>
  value === "white" || value === "black" ? value : null;

/**
 * Waiting room for two-player variant rooms: both players pick different
 * colors and press Ready, then the host starts. Colors are final afterwards.
 */
export default function VariantRoomSetup({ roomId, variantName, lobbyPath, onStarted }: Props) {
  useUiLanguage();
  const { user } = useAuth();
  const [room, setRoom] = useState<SetupRoom | null>(null);
  const [players, setPlayers] = useState<SetupPlayer[]>([]);
  const [saving, setSaving] = useState<"color" | "ready" | "start" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const onStartedRef = useRef(onStarted);

  useEffect(() => {
    onStartedRef.current = onStarted;
  }, [onStarted]);

  const load = useCallback(async () => {
    const [{ data: roomData }, { data: playerData, error: playerError }] = await Promise.all([
      supabase.from("variant_rooms").select("id, code, host_id, status").eq("id", roomId).maybeSingle(),
      supabase
        .from("variant_room_players")
        .select("user_id, seat, display_name, chosen_color, ready")
        .eq("room_id", roomId)
        .order("seat", { ascending: true }),
    ]);

    if (playerError) console.error("Could not load room players:", playerError);
    if (playerData) setPlayers(playerData as SetupPlayer[]);
    if (!roomData) return;

    const nextRoom = roomData as SetupRoom;
    setRoom(nextRoom);
    if (nextRoom.status !== "waiting" && !startedRef.current) {
      startedRef.current = true;
      onStartedRef.current();
    }
  }, [roomId]);

  useEffect(() => {
    // Load once the channel is live (or failed), so no change between load and subscribe is missed.
    const channel = supabase
      .channel(`variant-room-setup-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "variant_room_players", filter: `room_id=eq.${roomId}` }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "variant_rooms", filter: `id=eq.${roomId}` }, () => void load())
      .subscribe((status) => {
        if (status !== "CLOSED") void load();
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, load]);

  async function run(kind: "color" | "ready" | "start", rpc: string, args: Record<string, unknown>) {
    if (saving) return;
    setSaving(kind);
    setError(null);
    const { error: rpcError } = await supabase.rpc(rpc, { p_room_id: roomId, ...args });
    if (rpcError) {
      console.error(`${rpc} failed:`, rpcError);
      setError(rpcError.message);
    }
    await load();
    setSaving(null);
  }

  async function copyCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Code could not be copied.");
    }
  }

  const me = players.find((player) => player.user_id === user?.id);
  const opponent = players.find((player) => player.user_id !== user?.id);
  const isHost = room?.host_id === user?.id;
  const myColor = asColor(me?.chosen_color ?? null);
  const myReady = Boolean(me?.ready);
  const bothReady = players.length === 2 && players.every((player) => player.ready);

  return (
    <main className="chess-variant-page min-h-[var(--app-height)] bg-[radial-gradient(circle_at_top,#21170f_0%,#111111_38%,#090909_100%)] px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1100px]">
        <ChessPageHeader className="mb-7 flex flex-col gap-4 rounded-3xl border border-white/5 bg-zinc-900/50 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between" description={<>{ui(variantName)} · {ui("Room setup")}</>}>
          <div className="flex flex-wrap items-center gap-2">
            <Link to={lobbyPath} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:bg-white/10">
              {ui("Lobby")}
            </Link>
          </div>
        </ChessPageHeader>

        <button
          type="button"
          onClick={() => void copyCode()}
          disabled={!room}
          aria-label={copied ? ui("Copied") : ui("Copy room code")}
          className="mb-5 block w-full rounded-3xl border border-amber-300/25 bg-amber-300/[0.07] px-5 py-5 text-center shadow-xl shadow-black/15 transition hover:border-amber-200/50 hover:bg-amber-300/[0.1] focus-visible:outline-2 focus-visible:outline-amber-200 disabled:cursor-wait disabled:opacity-60 sm:px-8 sm:py-6"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">{ui("Room Code")}</p>
          <p className="mt-2 break-all font-mono text-4xl font-black tracking-[0.16em] text-amber-200 sm:text-5xl">
            {room?.code ?? "······"}
          </p>
          <p className="mt-4 text-xs font-bold text-zinc-400" aria-live="polite">
            {copied ? `✓ ${ui("Copied")}` : ui("Click this box to copy the code")}
          </p>
        </button>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section className="space-y-3">
            {[0, 1].map((index) => {
              const player = players[index];
              const color = asColor(player?.chosen_color ?? null);
              const isMe = Boolean(player && player.user_id === user?.id);
              const role = player?.user_id === room?.host_id ? "Host" : "Guest";
              return (
                <div
                  key={player?.user_id ?? `empty-${index}`}
                  className={`rounded-3xl border p-4 shadow-xl shadow-black/20 backdrop-blur-md ${player ? "border-amber-400/20 bg-zinc-900/75" : "border-dashed border-white/10 bg-zinc-900/40"}`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl border text-3xl ${player ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : "border-white/10 bg-black/20 text-zinc-600"}`} aria-hidden="true">
                      {color === "black" ? "♚" : color === "white" ? "♔" : "♙"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300/70">
                        {player ? `${ui(role)}${isMe ? ` · ${ui("You")}` : ""}` : ui("Open seat")}
                      </p>
                      <p className="mt-1 truncate text-lg font-black text-zinc-100">{player?.display_name ?? ui("Waiting for player")}</p>
                      {player && (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
                          <span className={`rounded-full border px-2 py-0.5 ${color ? "border-white/15 bg-white/5 text-zinc-200" : "border-dashed border-white/15 text-zinc-500"}`}>
                            {color === "white" ? ui("White") : color === "black" ? ui("Black") : ui("No color")}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${player.ready ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200" : "border-white/10 text-zinc-500"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${player.ready ? "bg-emerald-400" : "bg-zinc-600"}`} />
                            {player.ready ? ui("Ready") : ui("Not ready")}
                          </span>
                        </div>
                      )}
                    </div>
                    {!player && <InviteFriendButton />}
                  </div>
                </div>
              );
            })}
          </section>

          <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-5 shadow-xl shadow-black/20 backdrop-blur-md">
            {me && (
              <>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-sm font-black text-zinc-100">{ui("Your color")}</h2>
                  <p className="text-[11px] text-zinc-500">{ui("Tick a color · untick it to free it")}</p>
                </div>
                <ColorChoice
                  myColor={myColor}
                  opponentColor={asColor(opponent?.chosen_color ?? null)}
                  opponentName={opponent?.display_name ?? null}
                  disabled={saving !== null}
                  onChange={(color) => void run("color", "set_variant_room_color", { p_color: color })}
                />
                <ReadyButton
                  ready={myReady}
                  hasColor={Boolean(myColor)}
                  saving={saving !== null}
                  onToggle={() => void run("ready", "set_variant_room_ready", { p_ready: !myReady })}
                />
              </>
            )}

            <div className="mt-5 border-t border-white/5 pt-5">
              <p className="text-sm font-black text-zinc-100">
                {players.length < 2 ? ui("Waiting for another player") : bothReady ? ui("Both players are ready") : ui("Waiting for both players to be ready")}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                {players.length < 2
                  ? ui("Share the room code. The second player card fills automatically.")
                  : ui("Each player picks a different color and presses Ready. Then the host can start.")}
              </p>

              {isHost ? (
                <button
                  type="button"
                  disabled={saving !== null || !bothReady}
                  onClick={() => void run("start", "start_variant_room", {})}
                  className="mt-4 w-full rounded-xl bg-amber-300 px-5 py-3 font-black text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-zinc-600"
                >
                  {saving === "start" ? ui("Starting...") : ui("Start Game")}
                </button>
              ) : (
                players.length === 2 && (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500">
                    {bothReady ? ui("Waiting for host...") : ui("The host can start once both players are ready.")}
                  </div>
                )
              )}
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm font-semibold text-red-200">{ui(error)}</div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
