import InviteFriendButton from "@/components/chess/InviteFriendButton";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bot, Check, Copy, Crown, DoorOpen, Play, UserPlus } from "lucide-react";
import { actInRoom, getRoom, joinRoom, leaveRoom, startRoom } from "@/games/cards/client/onlineRoom";
import type { ActionRequest, GameDefinition, SettingValue } from "@/games/cards/engine/types";
import type { RoomSnapshot } from "@/games/cards/rooms";
import { Button, Chip, Panel } from "@/components/chessCustom/ui";
import EventLog from "../game/EventLog";
import GameTable from "../game/GameTable";

const POLL_MS = 1500;
const STATUS_ORDER = { waiting: 0, playing: 1, finished: 2 } as const;

/** Polls can land out of order with our own requests: never step back to an older snapshot. */
const newer = (next: RoomSnapshot, current: RoomSnapshot | null) =>
  !current || STATUS_ORDER[next.status] > STATUS_ORDER[current.status] || (next.status === current.status && next.revision >= current.revision);

function settingText(def: GameDefinition, key: string, value: SettingValue) {
  const setting = def.settings?.find((entry) => entry.key === key);
  if (setting?.type === "select") return setting.options.find((option) => option.value === value)?.label ?? String(value);
  if (setting?.type === "boolean") return value ? "on" : "off";
  return String(value);
}

/**
 * One online room: lobby while it waits, then the server-run table. The
 * server is authoritative — every move goes through `act` and the room is
 * re-read every couple of seconds so other players' moves show up.
 */
export default function OnlineRoom({ code }: { code: string }) {
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [def, setDef] = useState<GameDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const hasDef = useRef(false);

  const accept = useCallback((next: RoomSnapshot) => {
    if (next.definition) {
      hasDef.current = true;
      setDef(next.definition);
    }
    setRoom((current) => (newer(next, current) ? next : current));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (document.hidden && hasDef.current) return;
      try {
        const next = await getRoom(code, !hasDef.current);
        if (!cancelled) accept(next);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : "Could not load the room.";
        if (cancelled) return;
        if (message.includes("not found")) setClosed("This room does not exist or was closed by the host.");
        else setError(message);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [code, accept]);

  const perform = async (action: () => Promise<RoomSnapshot>) => {
    setBusy(true);
    setError(null);
    try {
      accept(await action());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Room request failed.");
      // A rejected move usually means the table moved on: show the latest state.
      void getRoom(code).then(accept, () => undefined);
    } finally {
      setBusy(false);
    }
  };

  // An accepted invite (`?join=1`) takes a free seat as soon as the lobby has loaded.
  const joinOnArrival = useRef(new URLSearchParams(window.location.search).get("join") === "1");
  useEffect(() => {
    if (!joinOnArrival.current || busy || !room || room.member || room.status !== "waiting" || room.capacity - room.seats.length <= 0) return;
    joinOnArrival.current = false;
    const params = new URLSearchParams(window.location.search);
    params.delete("join");
    const query = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    void perform(() => joinRoom(code));
    // `perform` only closes over stable state setters and `code`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, busy, code]);

  const leave = async () => {
    setBusy(true);
    try {
      await leaveRoom(code);
      navigate("/games/card-builder");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not leave the room.");
      setBusy(false);
    }
  };

  const copyInvite = () => {
    void navigator.clipboard.writeText(`${window.location.origin}/games/card-builder/room/${code}`).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  if (closed) {
    return (
      <Panel title="Room unavailable" eyebrow={`Room ${code}`}>
        <p className="mb-4 text-sm text-zinc-400">{closed}</p>
        <Link to="/games/card-builder" className="text-sm font-semibold text-amber-200 hover:text-amber-100">
          Back to the card builder
        </Link>
      </Panel>
    );
  }
  if (!room || !def) return <p className="text-sm text-zinc-500">{error ?? "Opening the room…"}</p>;

  const openSeats = room.capacity - room.seats.length;
  const header = (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/20 bg-black/40 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300/80">Online room</p>
        <h1 className="truncate text-2xl font-black text-white">{def.name}</h1>
        <p className="mt-1 text-xs text-zinc-400">
          {room.capacity} seats · {room.status === "waiting" ? `${room.seats.length} joined` : room.status === "playing" ? "in progress" : "finished"}
          {!room.member && room.status !== "waiting" && " · you are watching"}
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Code</span>
        <span className="font-mono text-lg font-bold tracking-[0.3em] text-amber-100">{room.code}</span>
      </div>
      <Button size="sm" onClick={copyInvite}>
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy invite link"}
      </Button>
    </div>
  );
  const errorBox = error && (
    <p role="alert" className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
      {error}
    </p>
  );

  if (room.status === "waiting") {
    const settings = Object.entries(room.settings);
    return (
      <>
        {header}
        {errorBox}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Panel title="Seats" eyebrow="Lobby">
            <ul className="space-y-2">
              {Array.from({ length: room.capacity }, (_, seat) => {
                const taken = room.seats.find((entry) => entry.seat === seat);
                return (
                  <li key={seat} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${taken?.isYou ? "border-amber-300/30 bg-amber-300/[0.05]" : "border-white/[0.08] bg-black/20"}`}>
                    <span className="w-14 font-mono text-[11px] text-zinc-500">Seat {seat + 1}</span>
                    {taken ? (
                      <>
                        <span className="min-w-0 flex-1 truncate font-semibold text-zinc-100">{taken.name}</span>
                        {taken.isHost && (
                          <Chip tone="amber">
                            <Crown size={11} /> host
                          </Chip>
                        )}
                        {taken.isYou && <Chip tone="sky">you</Chip>}
                      </>
                    ) : (
                      <span className="flex flex-1 items-center gap-1.5 text-sm text-zinc-500">
                        <Bot size={14} /> Open — a bot plays if nobody joins
                      </span>
                    )}
                    {!taken && <InviteFriendButton />}
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-3" aria-live="polite">
              {room.youAreHost && (
                <Button tone="primary" disabled={busy} onClick={() => void perform(() => startRoom(code))}>
                  <Play size={16} /> Start game{openSeats > 0 ? ` with ${openSeats} bot${openSeats === 1 ? "" : "s"}` : ""}
                </Button>
              )}
              {!room.member && (
                <Button tone="blue" disabled={busy || openSeats <= 0} onClick={() => void perform(() => joinRoom(code))}>
                  <UserPlus size={16} /> {openSeats > 0 ? "Take a seat" : "Room is full"}
                </Button>
              )}
              {room.member && !room.youAreHost && <p className="text-sm text-zinc-400">Waiting for the host to start the game…</p>}
              {room.member && (
                <Button size="sm" tone={room.youAreHost ? "danger" : "ghost"} disabled={busy} onClick={() => void leave()}>
                  <DoorOpen size={14} /> {room.youAreHost ? "Close room" : "Leave"}
                </Button>
              )}
            </div>
          </Panel>
          <Panel title="Table rules" eyebrow={`${def.players.min === def.players.max ? def.players.min : `${def.players.min}–${def.players.max}`} players`}>
            {def.description && <p className="mb-3 text-sm leading-6 text-zinc-400">{def.description}</p>}
            {settings.length ? (
              <dl className="space-y-1.5 text-sm">
                {settings.map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt className="text-zinc-500">{def.settings?.find((entry) => entry.key === key)?.label ?? key}</dt>
                    <dd className="font-semibold text-zinc-200">{settingText(def, key, value)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-zinc-500">No lobby settings.</p>
            )}
          </Panel>
        </div>
      </>
    );
  }

  const state = room.state!;
  const onAction = (request: ActionRequest) => {
    if (!busy) void perform(() => actInRoom(room, request));
  };
  return (
    <>
      {header}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <GameTable def={def} state={state} viewerId={room.playerId} error={error} onAction={onAction} />
        </div>
        <aside className="space-y-3">
          <Panel title="Players" eyebrow="Room">
            <ul className="space-y-1.5 text-sm">
              {room.seats.map((seat) => (
                <li key={seat.seat} className="flex items-center gap-2">
                  {seat.isBot ? <Bot size={14} className="text-zinc-500" /> : <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate text-zinc-200">{seat.name}</span>
                  {seat.isHost && <Chip tone="amber">host</Chip>}
                  {seat.isYou && <Chip tone="sky">you</Chip>}
                </li>
              ))}
            </ul>
            {room.status === "finished" && (
              <Link to="/games/card-builder" className="mt-4 inline-block text-sm font-semibold text-amber-200 hover:text-amber-100">
                Back to the card builder
              </Link>
            )}
          </Panel>
          <Panel title="Events" eyebrow="Log">
            <EventLog state={state} />
          </Panel>
        </aside>
      </div>
    </>
  );
}
