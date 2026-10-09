import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
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
  useGameLanguage();
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
      <Panel title={gameUi("Room unavailable")} eyebrow={`Room ${code}`}>
        <p className="mb-4 text-sm text-zinc-400">{gameUi(closed)}</p>
        <Link to="/games/card-builder" className="text-sm font-semibold text-amber-200 hover:text-amber-100">{gameUi(" Back to the card builder ")}</Link>
      </Panel>
    );
  }
  if (!room || !def) return <p className="text-sm text-zinc-500">{gameUi(error ?? "Opening the room…")}</p>;

  const openSeats = room.capacity - room.seats.length;
  const header = (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/20 bg-black/40 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300/80">{gameUi("Online room")}</p>
        <h1 className="truncate text-2xl font-black text-white">{gameUi(def.name)}</h1>
        <p className="mt-1 text-xs text-zinc-400">
          {gameUi(room.capacity)}{gameUi(" seats · ")}{gameUi(room.status === "waiting" ? `${room.seats.length} joined` : room.status === "playing" ? "in progress" : "finished")}
          {gameUi(!room.member && room.status !== "waiting" && " · you are watching")}
        </p>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{gameUi("Code")}</span>
        <span className="font-mono text-lg font-bold tracking-[0.3em] text-amber-100">{room.code}</span>
      </div>
      <Button size="sm" onClick={copyInvite}>
        {copied ? <Check size={14} /> : <Copy size={14} />} {gameUi(copied ? "Copied" : "Copy invite link")}
      </Button>
    </div>
  );
  const errorBox = error && (
    <p role="alert" className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">
      {gameUi(error)}
    </p>
  );

  if (room.status === "waiting") {
    const settings = Object.entries(room.settings);
    return (
      <>
        {gameUi(header)}
        {gameUi(errorBox)}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Panel title={gameUi("Seats")} eyebrow="Lobby">
            <ul className="space-y-2">
              {Array.from({ length: room.capacity }, (_, seat) => {
                const taken = room.seats.find((entry) => entry.seat === seat);
                return (
                  <li key={seat} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${taken?.isYou ? "border-amber-300/30 bg-amber-300/[0.05]" : "border-white/[0.08] bg-black/20"}`}>
                    <span className="w-14 font-mono text-[11px] text-zinc-500">{gameUi("Seat ")}{gameUi(seat + 1)}</span>
                    {gameUi(taken ? (
                      <>
                        <span className="min-w-0 flex-1 truncate font-semibold text-zinc-100">{gameUi(taken.name)}</span>
                        {gameUi(taken.isHost && (
                          <Chip tone="amber">
                            <Crown size={11} />{gameUi(" host ")}</Chip>
                        ))}
                        {taken.isYou && <Chip tone="sky">{gameUi("you")}</Chip>}
                      </>
                    ) : (
                      <span className="flex flex-1 items-center gap-1.5 text-sm text-zinc-500">
                        <Bot size={14} />{gameUi(" Open — a bot plays if nobody joins ")}</span>
                    ))}
                    {!taken && <InviteFriendButton />}
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-3" aria-live="polite">
              {gameUi(room.youAreHost && (
                <Button tone="primary" disabled={busy} onClick={() => void perform(() => startRoom(code))}>
                  <Play size={16} />{gameUi(" Start game")}{gameUi(openSeats > 0 ? ` with ${openSeats} bot${openSeats === 1 ? "" : "s"}` : "")}
                </Button>
              ))}
              {gameUi(!room.member && (
                <Button tone="blue" disabled={busy || openSeats <= 0} onClick={() => void perform(() => joinRoom(code))}>
                  <UserPlus size={16} /> {gameUi(openSeats > 0 ? "Take a seat" : "Room is full")}
                </Button>
              ))}
              {room.member && !room.youAreHost && <p className="text-sm text-zinc-400">{gameUi("Waiting for the host to start the game…")}</p>}
              {gameUi(room.member && (
                <Button size="sm" tone={room.youAreHost ? "danger" : "ghost"} disabled={busy} onClick={() => void leave()}>
                  <DoorOpen size={14} /> {gameUi(room.youAreHost ? "Close room" : "Leave")}
                </Button>
              ))}
            </div>
          </Panel>
          <Panel title={gameUi("Table rules")} eyebrow={`${def.players.min === def.players.max ? def.players.min : `${def.players.min}–${def.players.max}`} players`}>
            {def.description && <p className="mb-3 text-sm leading-6 text-zinc-400">{gameUi(def.description)}</p>}
            {gameUi(settings.length ? (
              <dl className="space-y-1.5 text-sm">
                {settings.map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3">
                    <dt className="text-zinc-500">{gameUi(def.settings?.find((entry) => entry.key === key)?.label ?? key)}</dt>
                    <dd className="font-semibold text-zinc-200">{gameUi(settingText(def, key, value))}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-zinc-500">{gameUi("No lobby settings.")}</p>
            ))}
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
      {gameUi(header)}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <GameTable def={def} state={state} viewerId={room.playerId} error={error} onAction={onAction} />
        </div>
        <aside className="space-y-3">
          <Panel title={gameUi("Players")} eyebrow="Room">
            <ul className="space-y-1.5 text-sm">
              {room.seats.map((seat) => (
                <li key={seat.seat} className="flex items-center gap-2">
                  {seat.isBot ? <Bot size={14} className="text-zinc-500" /> : <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />}
                  <span className="min-w-0 flex-1 truncate text-zinc-200">{seat.name}</span>
                  {seat.isHost && <Chip tone="amber">{gameUi("host")}</Chip>}
                  {seat.isYou && <Chip tone="sky">{gameUi("you")}</Chip>}
                </li>
              ))}
            </ul>
            {gameUi(room.status === "finished" && (
              <Link to="/games/card-builder" className="mt-4 inline-block text-sm font-semibold text-amber-200 hover:text-amber-100">{gameUi(" Back to the card builder ")}</Link>
            ))}
          </Panel>
          <Panel title={gameUi("Events")} eyebrow="Log">
            <EventLog state={state} />
          </Panel>
        </aside>
      </div>
    </>
  );
}
