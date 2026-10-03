import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import type { GoMove, GoState } from "../../games/go/rules";
import { canReviewGoGame } from "../../games/go/reviewAvailability";
import { saveGoGame } from "../../games/go/storage";
import type { ShogiMove, ShogiState } from "../../games/shogi/rules";
import GoBoard from "./GoBoard";
import GoGameReview from "./GoGameReview";
import ShogiBoard from "./ShogiBoard";
type GameType = "go" | "shogi";
type Snapshot = { code: string; gameType: GameType; hostId: string; players: { id: string; name: string }[]; side: "black" | "white"; settings: Record<string, unknown>; state: GoState | ShogiState | null; version: number };
const messageFor = (error: unknown) => error instanceof Error ? error.message : "Request failed.";
export default function StrategyMultiplayer({ gameType }: { gameType: GameType }) {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [code, setCode] = useState("");
  const [boardSize, setBoardSize] = useState<9 | 13 | 19>(9);
  const [room, setRoom] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviewRoomCode, setReviewRoomCode] = useState<string | null>(null);
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
    try { const created = await invoke({ op: "create", gameType, name, boardSize }); navigate("/games/" + gameType + "/multiplayer/" + created.code); }
    catch (cause) { setError(messageFor(cause)); } finally { setBusy(false); }
  };
  const join = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { const joined = await invoke({ op: "join", code: code.toUpperCase(), name }); navigate("/games/" + gameType + "/multiplayer/" + joined.code); }
    catch (cause) { setError(messageFor(cause)); } finally { setBusy(false); }
  };
  const move = async (gameMove: GoMove | ShogiMove) => {
    if (!room || busy) return;
    setBusy(true); setError("");
    try { setRoom(await invoke({ op: "move", code: room.code, version: room.version, move: gameMove })); }
    catch (cause) { setError(messageFor(cause)); await refresh(); } finally { setBusy(false); }
  };
  if (loading) return <main className="h-[var(--app-height)] overflow-hidden bg-[#07090b] p-10 text-zinc-400">Loading account…</main>;
  if (!user) return <main className="flex h-[var(--app-height)] items-center overflow-hidden bg-[#07090b] p-6 text-white"><div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8"><h1 className="font-serif text-3xl">Sign in for multiplayer</h1><p className="mt-3 text-zinc-400">Pluto rooms use your account to reserve your side and restore the match after refresh.</p><Link to="/login" className="mt-6 inline-block rounded-xl bg-amber-400 px-5 py-3 font-bold text-black">Sign in</Link></div></main>;
  if (!roomCode) return <main className="h-[var(--app-height)] overflow-hidden bg-[#07090b] px-4 py-5 text-white sm:py-8"><div className="mx-auto flex h-full max-w-4xl flex-col justify-center"><Link to={"/games/" + gameType} className="text-sm text-zinc-500 hover:text-white">← {gameType === "go" ? "Go" : "Shogi"}</Link><h1 className="mt-5 font-serif text-4xl capitalize sm:mt-8 sm:text-5xl">{gameType} multiplayer</h1><p className="mt-2 text-zinc-500">Create a private room or enter a six-character invite code.</p>
    <div className="mt-5 grid gap-3 sm:mt-8 sm:gap-5 md:grid-cols-2"><section className="rounded-2xl border border-emerald-400/20 bg-white/[.035] p-4 sm:rounded-3xl sm:p-6"><h2 className="font-serif text-2xl sm:text-3xl">Create room</h2>{gameType === "go" && <label className="mt-3 block text-sm text-zinc-400 sm:mt-5">Board size <select value={boardSize} onChange={(event) => setBoardSize(Number(event.target.value) as 9 | 13 | 19)} className="ml-2 rounded-lg bg-zinc-800 p-2"><option>9</option><option>13</option><option>19</option></select></label>}<button type="button" disabled={busy} onClick={() => void create()} className="mt-4 min-h-11 w-full rounded-xl bg-emerald-400 font-bold text-black disabled:opacity-50 sm:mt-6">Create</button></section>
      <form onSubmit={(event) => void join(event)} className="rounded-2xl border border-amber-400/20 bg-white/[.035] p-4 sm:rounded-3xl sm:p-6"><h2 className="font-serif text-2xl sm:text-3xl">Join room</h2><label className="mt-3 block text-sm text-zinc-400 sm:mt-5">Invite code<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} required minLength={6} className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-xl font-black uppercase tracking-[.3em] text-white" /></label><button disabled={busy} className="mt-3 min-h-11 w-full rounded-xl bg-amber-400 font-bold text-black disabled:opacity-50 sm:mt-4">Join</button></form></div>{error && <p role="alert" className="mt-3 text-red-300">{error}</p>}</div></main>;
  const state = room?.state;
  const canMove = !!room && !!state && state.status === "playing" && state.currentPlayer === room.side && !busy;
  const reviewAvailable = gameType === "go" && room?.code === roomCode?.toUpperCase() && canReviewGoGame(state as GoState | null | undefined);
  return <main className="h-[var(--app-height)] overflow-hidden bg-[#07090b] px-3 py-3 text-white sm:px-4 sm:py-4"><div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden">
    <header className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2"><Link to={"/games/" + gameType + "/multiplayer"} className="text-sm text-zinc-500 hover:text-white">← Rooms</Link><div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2">Room <b className="tracking-[.2em] text-amber-300">{roomCode.toUpperCase()}</b></div></header>
    {!room ? <p className="text-zinc-400">Restoring match…</p> : !state ? <section className="m-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-8 text-center"><h1 className="font-serif text-4xl">Waiting for opponent</h1><p className="mt-4 text-zinc-400">Share code <b className="text-amber-300">{room.code}</b>. Your match starts as soon as a second player joins.</p></section> :
    reviewAvailable && reviewRoomCode === room.code ? <div className="min-h-0 flex-1 overflow-y-auto"><button type="button" className="go-action mb-3" onClick={() => setReviewRoomCode(null)}>← Return to result</button><GoGameReview game={state as GoState} /></div> :
    <div className="grid min-h-0 flex-1 content-center gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-5"><section className="flex min-h-0 items-center justify-center">{gameType === "go" ? <GoBoard state={state as GoState} onMove={(moveValue) => void move(moveValue)} disabled={!canMove} /> : <ShogiBoard state={state as ShogiState} onMove={(moveValue) => void move(moveValue)} disabled={!canMove} />}</section>
      <aside className="space-y-2 overflow-hidden rounded-2xl border border-white/10 bg-white/[.035] p-3 lg:self-center lg:space-y-4 lg:rounded-3xl lg:p-5"><div className="hidden lg:block"><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-400">Live multiplayer</p><h1 className="font-serif text-3xl capitalize">{gameType}</h1></div><div className="rounded-2xl bg-black/25 p-3 lg:p-4"><p>You are <b className="capitalize">{room.side}</b></p><p className="mt-1 font-bold capitalize lg:mt-2">{state.result ?? (state.currentPlayer === room.side ? "Your turn" : room.players[room.side === "black" ? 1 : 0]?.name + " to move")}</p><p className="mt-1 text-xs text-zinc-500">Version {room.version} · {state.moveHistory.length} moves</p></div><div className="hidden space-y-2 lg:block">{room.players.map((player, index) => <div key={player.id} className="flex justify-between rounded-xl bg-white/5 p-3"><span>{player.name}</span><b className="capitalize text-zinc-500">{index === 0 ? "black" : "white"}</b></div>)}</div>{reviewAvailable && <button type="button" onClick={() => setReviewRoomCode(room.code)} className="go-action w-full">Game Review</button>}<button type="button" disabled={!canMove} onClick={() => void move({ type: "resign" })} className="min-h-11 w-full rounded-xl border border-red-400/20 text-red-300 disabled:opacity-40">Resign</button>{error && <p role="alert" className="text-sm text-red-300">{error}</p>}</aside></div>}
  </div></main>;
}
