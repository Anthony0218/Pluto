import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import InviteFriendButton from "@/components/chess/InviteFriendButton";
import { recordCreatedGameInvite } from "@/components/social/GameInviteDelivery";
import { useInviteAutoCreate } from "@/hooks/useInviteAutoCreate";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import type { GoMove, GoState } from "../../games/go/rules";
import { canReviewGoGame } from "../../games/go/reviewAvailability";
import { saveGoGame, saveGoRecord } from "../../games/go/storage";
import { uploadGoRecord } from "../../games/go/cloudStorage";
import type { ShogiMove, ShogiState } from "../../games/shogi/rules";
import GoBoard from "./GoBoard";
import GoGameReview from "./GoGameReview";
import ShogiBoard from "./ShogiBoard";
import ChessRankedLobby from "@/pages/games/Chess/ChessRankedLobby";
import { useInviteAutoJoin } from "@/hooks/useInviteAutoJoin";
type GameType = "go" | "shogi";
type Snapshot = { code: string; gameType: GameType; hostId: string; players: { id: string; name: string }[]; side: "black" | "white"; settings: Record<string, unknown>; state: GoState | ShogiState | null; version: number };
const messageFor = (error: unknown) => error instanceof Error ? error.message : "Request failed.";
export default function StrategyMultiplayer({ gameType }: { gameType: GameType }) {
  useGameLanguage();
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<"friends" | "ranked">(() => searchParams.get("tab") === "ranked" ? "ranked" : "friends");
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [boardSize, setBoardSize] = useState<9 | 13 | 19>(() => { const size = Number(searchParams.get("boardSize")); return size === 13 || size === 19 ? size : 9; });
  const [room, setRoom] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [reviewRoomCode, setReviewRoomCode] = useState<string | null>(null);
  const savedRecord = useRef<{ key: string; id: string } | null>(null);
  const name = profile?.display_name || profile?.username || user?.email?.split("@")[0] || "Player";
  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error: invokeError } = await supabase.functions.invoke("strategy-match", { body });
    if (invokeError) throw invokeError;
    if (data?.error) throw new Error(String(data.error));
    return data as Snapshot;
  }, []);
  const refresh = useCallback(async () => {
    if (!roomCode || !user) return;
    try { setRoom(await invoke({ op: "get", code: roomCode })); setError(""); }
    catch (cause) { setError(messageFor(cause)); }
  }, [roomCode, user, invoke]);
  useEffect(() => {
    if (!roomCode || !user) return;
    const initial = window.setTimeout(() => void refresh(), 0);
    const channel = supabase.channel("strategy-" + roomCode).on("postgres_changes", { event: "UPDATE", schema: "public", table: "strategy_matches", filter: "room_code=eq." + roomCode.toUpperCase() }, () => void refresh()).subscribe();
    const poll = window.setInterval(() => void refresh(), 5000);
    return () => { window.clearTimeout(initial); window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [roomCode, user, refresh]);
  useEffect(() => {
    if (gameType === "go" && room?.state && canReviewGoGame(room.state as GoState)) saveGoGame(room.state as GoState);
  }, [gameType, room?.state]);
  const create = async () => {
    setBusy(true); setError("");
    try { const created = await invoke({ op: "create", gameType, name, boardSize }); navigate(recordCreatedGameInvite("/games/" + gameType + "/multiplayer/" + created.code)); }
    catch (cause) { setError(messageFor(cause)); } finally { setBusy(false); }
  };
  useInviteAutoCreate(() => create());
  const join = async (event?: FormEvent) => {
    event?.preventDefault(); setBusy(true); setError("");
    try { const joined = await invoke({ op: "join", code: code.toUpperCase(), name }); navigate("/games/" + gameType + "/multiplayer/" + joined.code); }
    catch (cause) { setError(messageFor(cause)); } finally { setBusy(false); }
  };
  useInviteAutoJoin(() => join());
  const move = async (gameMove: GoMove | ShogiMove) => {
    if (!room || busy) return;
    setBusy(true); setError("");
    try { setRoom(await invoke({ op: "move", code: room.code, version: room.version, move: gameMove })); }
    catch (cause) { setError(messageFor(cause)); await refresh(); } finally { setBusy(false); }
  };
  if (loading) return <main className="h-[var(--app-height)] overflow-hidden bg-[#07090b] p-10 text-zinc-400">{gameUi("Loading account…")}</main>;
  if (!user && roomCode) return <main className="flex h-[var(--app-height)] items-center overflow-hidden bg-[#07090b] p-6 text-white"><div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8"><h1 className="font-serif text-3xl">{gameUi("Sign in for multiplayer")}</h1><p className="mt-3 text-zinc-400">{gameUi("Pluto rooms use your account to reserve your side and restore the match after refresh.")}</p><Link to="/login" className="mt-6 inline-block rounded-xl bg-amber-400 px-5 py-3 font-bold text-black">{gameUi("Sign in")}</Link></div></main>;
  if (!roomCode) return <main className="min-h-[var(--app-height)] overflow-y-auto bg-[#07090b] px-4 py-5 text-white sm:py-8"><div className="mx-auto flex max-w-4xl flex-col"><Link to={"/games/" + gameType} className="text-sm text-zinc-500 hover:text-white">← {gameUi(gameType === "go" ? "Go" : "Shogi")}</Link><h1 className="mt-5 font-serif text-4xl capitalize sm:mt-8 sm:text-5xl">{gameUi(gameType)}{gameUi(" multiplayer")}</h1><p className="mt-2 text-zinc-500">{gameUi("Create a private room or enter a six-character invite code.")}</p>
    {gameType === "go" && <div role="tablist" aria-label={gameUi("Go multiplayer")} className="mt-5 flex gap-2">{(["friends", "ranked"] as const).map(item => <button type="button" role="tab" key={item} aria-selected={tab === item} onClick={() => setTab(item)} className={`rounded-xl border px-5 py-3 text-sm font-bold ${tab === item ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/10 text-zinc-400"}`}>{gameUi(item === "friends" ? "Invite a friend" : "Ranked")}</button>)}</div>}
    {!user && <p className="mt-4 text-sm text-zinc-400">{gameUi("Sign in to create or join a room. ")}<Link to="/login" className="text-amber-200">{gameUi("Sign in →")}</Link></p>}
    {gameType === "go" && tab === "ranked" ? <div className="mt-6"><ChessRankedLobby embedded game="go" /></div> : <div className="mt-5 grid gap-3 sm:mt-8 sm:gap-5 md:grid-cols-2"><section className="rounded-2xl border border-emerald-400/20 bg-white/[.035] p-4 sm:rounded-3xl sm:p-6"><h2 className="font-serif text-2xl sm:text-3xl">{gameUi("Create room")}</h2>{gameType === "go" && <label className="mt-3 block text-sm text-zinc-400 sm:mt-5">{gameUi("Board size ")}<select value={boardSize} onChange={(event) => setBoardSize(Number(event.target.value) as 9 | 13 | 19)} className="ml-2 rounded-lg bg-zinc-800 p-2"><option>9</option><option>13</option><option>19</option></select></label>}<button type="button" disabled={busy || !user} onClick={() => void create()} className="mt-4 min-h-11 w-full rounded-xl bg-emerald-400 font-bold text-black disabled:opacity-50 sm:mt-6">{gameUi("Create")}</button></section>
      <form onSubmit={(event) => void join(event)} className="rounded-2xl border border-amber-400/20 bg-white/[.035] p-4 sm:rounded-3xl sm:p-6"><h2 className="font-serif text-2xl sm:text-3xl">{gameUi("Join room")}</h2><label className="mt-3 block text-sm text-zinc-400 sm:mt-5">{gameUi("Invite code")}<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} required minLength={6} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-xl font-black uppercase tracking-[.3em] text-white" /></label><button disabled={busy || !user} className="mt-3 min-h-11 w-full rounded-xl bg-amber-400 font-bold text-black disabled:opacity-50 sm:mt-4">{gameUi("Join")}</button></form></div>}{error && <p role="alert" className="mt-3 text-red-300">{gameUi(error)}</p>}</div></main>;
  const state = room?.state;
  const canMove = !!room && !!state && state.status === "playing" && state.currentPlayer === room.side && !busy;
  const reviewAvailable = gameType === "go" && room?.code === roomCode?.toUpperCase() && canReviewGoGame(state as GoState | null | undefined);
  function saveResult(analyze = false) {
    if (!room || !state || gameType !== "go") return;
    try {
      const key = `${room.code}:${room.version}`;
      if (savedRecord.current?.key !== key) {
        const record = saveGoRecord(state as GoState, { mode: "multiplayer", players: { black: room.players[0]?.name ?? "Black", white: room.players[1]?.name ?? "White" } }, undefined, user?.id);
        savedRecord.current = { key, id: record.id };
        if (user) void uploadGoRecord(record, user.id).then(() => setSaveNotice("Game saved and synced to your account.")).catch(() => setSaveNotice("Game saved on this device; account sync will retry later."));
      }
      if (analyze) navigate(`/games/go/analysis?game=${encodeURIComponent(savedRecord.current.id)}`);
      else setSaveNotice("Game saved to your Go library on this device.");
    } catch (cause) { setError(messageFor(cause)); }
  }
  return <main className="h-[var(--app-height)] overflow-hidden bg-[#07090b] px-3 py-3 text-white sm:px-4 sm:py-4"><div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden">
    <header className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2"><Link to={"/games/" + gameType + "/multiplayer"} className="text-sm text-zinc-500 hover:text-white">{gameUi("← Rooms")}</Link><div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">{gameUi("Room ")}<b className="tracking-[.2em] text-amber-300">{gameUi(roomCode.toUpperCase())}</b></div></header>
    {!room ? <p className="text-zinc-400">{gameUi("Restoring match…")}</p> : !state ? <section className="m-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center"><h1 className="font-serif text-4xl">{gameUi("Waiting for opponent")}</h1><p className="mt-4 text-zinc-400">{gameUi("Share code ")}<b className="text-amber-300">{room.code}</b>{gameUi(". Your match starts as soon as a second player joins.")}</p><div className="mt-5 grid gap-3 sm:grid-cols-2" aria-label={gameUi("Room seats")}>{Array.from({ length: 2 }, (_, seat) => <div key={seat} className="rounded-xl border border-white/10 p-3"><strong>{room.players[seat]?.name ?? gameUi("Open seat")}</strong><p className="text-xs capitalize text-zinc-500">{gameUi(seat === 0 ? "Black" : "White")}</p>{!room.players[seat] && <InviteFriendButton />}</div>)}</div></section> :
    reviewAvailable && reviewRoomCode === room.code ? <div className="min-h-0 flex-1 overflow-y-auto"><button type="button" className="go-action mb-3" onClick={() => setReviewRoomCode(null)}>{gameUi("← Return to result")}</button><GoGameReview game={state as GoState} /></div> :
    <div className="grid min-h-0 flex-1 content-center gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-5"><section className="flex min-h-0 items-center justify-center">{gameType === "go" ? <GoBoard state={state as GoState} onMove={(moveValue) => void move(moveValue)} disabled={!canMove} /> : <ShogiBoard state={state as ShogiState} onMove={(moveValue) => void move(moveValue)} disabled={!canMove} />}</section>
      <aside className="space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-white/[.035] p-3 lg:self-center lg:space-y-4 lg:rounded-3xl lg:p-5"><div className="hidden lg:block"><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-400">{gameUi("Live multiplayer")}</p><h1 className="font-serif text-3xl capitalize">{gameUi(gameType)}</h1></div><div className="rounded-2xl bg-black/25 p-3 lg:p-4"><p>{gameUi("You are ")}<b className="capitalize">{gameUi(room.side)}</b></p><p className="mt-1 font-bold capitalize lg:mt-2">{state.result ?? gameUi((state.currentPlayer === room.side ? "Your turn" : room.players[room.side === "black" ? 1 : 0]?.name + " to move"))}</p><p className="mt-1 text-xs text-zinc-500">{gameUi("Version ")}{gameUi(room.version)} · {gameUi(state.moveHistory.length)}{gameUi(" moves")}</p></div><div className="hidden space-y-2 lg:block">{room.players.map((player, index) => <div key={player.id} className="flex justify-between rounded-xl bg-white/5 p-3"><span>{player.name}</span><b className="capitalize text-zinc-500">{gameUi(index === 0 ? "black" : "white")}</b></div>)}</div>{gameType === "go" && state.moveHistory.length > 0 && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => saveResult(false)} className="go-action">{gameUi("Save Game")}</button>{reviewAvailable && <button type="button" onClick={() => saveResult(true)} className="go-action">{gameUi("Analyze Game")}</button>}</div>}{saveNotice && <p role="status" className="text-xs text-emerald-200">{gameUi(saveNotice)}</p>}<button type="button" disabled={!canMove} onClick={() => void move({ type: "resign" })} className="min-h-11 w-full rounded-xl border border-red-400/20 text-red-300 disabled:opacity-40">{gameUi("Resign")}</button>{error && <p role="alert" className="text-sm text-red-300">{gameUi(error)}</p>}</aside></div>}
  </div></main>;
}
