import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trophy, Users } from "lucide-react";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import LeaderboardTable, { type LeaderboardRow } from "@/components/social/LeaderboardTable";
import { useAuth } from "@/context/AuthContext";
import { ui, useUiLanguage } from "@/i18n/ui";
import { supabase } from "@/lib/supabase";
import { invokeRankedChess, leaveRankedQueue, RankedAuthError } from "@/games/chess/ranked/client";
import { getChessRank } from "@/games/chess/ranked/tiers";
import RankEmblem from "@/components/chess/RankEmblem";

type QueueStatus = "idle" | "waiting" | "found" | "matched";
type QueueResponse = { status?: QueueStatus; code?: string; error?: string };
type EloRow = { rank: number; user_id: string; username: string; avatar_id: string | null; rating: number };

export default function ChessRankedLobby({ embedded = false }: { embedded?: boolean } = {}) {
  useUiLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"play" | "leaderboard">("play");
  const [rating, setRating] = useState(1200);
  const [games, setGames] = useState(0);
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [status, setStatus] = useState<QueueStatus>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef(false);
  const lease = useRef({ id: crypto.randomUUID(), active: false });
  useEffect(() => {
    const current = { id: crypto.randomUUID(), active: true };
    lease.current = current;
    const leave = () => {
      current.active = false;
      const latest = lease.current;
      if (!latest.active && latest !== current) return;
      latest.active = false;
      leaveRankedQueue(latest.id);
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) { lease.current = { id: crypto.randomUUID(), active: true }; setStatus("idle"); }
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    return () => { leave(); window.removeEventListener("pagehide", leave); window.removeEventListener("pageshow", restore); };
  }, [user?.id]);
  const name = profile?.display_name || profile?.username || user?.email?.split("@")[0] || "Player";
  const rank = getChessRank(rating);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void Promise.all([
      supabase.from("chess_ratings").select("rating,rated_games").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("get_chess_elo_leaderboard"),
    ]).then(([myRating, leaderboard]) => {
      if (!active) return;
      if (myRating.data) { setRating(myRating.data.rating); setGames(myRating.data.rated_games); }
      if (leaderboard.error) setError(leaderboard.error.message);
      else setRows(((leaderboard.data ?? []) as EloRow[]).map(row => ({ rank: row.rank, user_id: row.user_id, username: row.username, avatar_id: row.avatar_id, value: row.rating })));
    });
    return () => { active = false; };
  }, [user]);

  const request = useCallback(async (op: "queue" | "queueStatus" | "leaveQueue") => {
    const current = lease.current;
    if (!current.active) return;
    const result = await invokeRankedChess<QueueResponse>({ op, name, sessionId: current.id });
    if (!current.active || current !== lease.current) { leaveRankedQueue(current.id); return; }
    if (result?.status) setStatus(result.status);
    setError(result?.error ?? null);
    if (result?.status === "matched" && result.code) {
      navigate(`/games/chess/ranked/${result.code}/game`);
    }
  }, [name, navigate]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void Promise.resolve().then(() => request("queueStatus")).catch(cause => { if (active) { setError(cause instanceof Error ? cause.message : "Could not check queue."); if (cause instanceof RankedAuthError) setStatus("idle"); } });
    return () => { active = false; };
  }, [request, user]);

  useEffect(() => {
    if (!user || (status !== "waiting" && status !== "found")) return;
    const timer = window.setInterval(() => {
      if (polling.current) return;
      polling.current = true;
      void request("queueStatus").catch(cause => { setError(cause instanceof Error ? cause.message : "Matchmaking failed."); if (cause instanceof RankedAuthError) setStatus("idle"); }).finally(() => { polling.current = false; });
    }, 2500);
    return () => window.clearInterval(timer);
  }, [request, status, user]);

  async function changeQueue(op: "queue" | "leaveQueue") {
    setBusy(true);
    setError(null);
    try {
      await request(op);
      if (op === "leaveQueue" && lease.current.active) { lease.current = { id: crypto.randomUUID(), active: true }; setStatus("idle"); }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Matchmaking failed."); }
    finally { setBusy(false); }
  }

  const Container = embedded ? "div" : "main";
  return <Container className={embedded ? "w-full text-white" : "chess-menu-page relative left-1/2 min-h-[var(--app-height)] w-screen -translate-x-1/2 bg-[#07090b] text-white"}>
    {!embedded && <ChessPageHeader title="Ranked Chess" className="chess-menu-header" />}
    <div className={embedded ? "mx-auto max-w-6xl px-5 pb-12 sm:px-8" : "mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16"}>
      {!embedded && <Link to="/games/chess/classic/multiplayer" className="text-sm text-zinc-500 hover:text-white">{ui("← Multiplayer")}</Link>}
      <div className="mt-8 flex flex-wrap items-end justify-between gap-5">
        <div><p className="text-xs font-black uppercase tracking-[.3em] text-amber-300">{ui("Competitive chess")}</p><h1 className="mt-3 font-serif text-5xl sm:text-7xl">{ui("Ranked Chess")}</h1><p className="mt-4 max-w-2xl text-zinc-400">{ui("Find an opponent near your rating and play a verified match.")}</p></div>
        <div role="tablist" aria-label="Ranked chess" className="flex rounded-xl border border-white/15 p-1"><button role="tab" aria-selected={tab === "play"} onClick={() => setTab("play")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "play" ? "bg-amber-300 text-black" : "text-zinc-400 hover:text-white"}`}>{ui("Play")}</button><button role="tab" aria-selected={tab === "leaderboard"} onClick={() => setTab("leaderboard")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "leaderboard" ? "bg-amber-300 text-black" : "text-zinc-400 hover:text-white"}`}>{ui("Leaderboard")}</button></div>
      </div>
      {!user ? <section className="mt-10 rounded-3xl border border-white/10 bg-white/[.035] p-8"><p>{ui("Sign in to play ranked chess and view your rating.")}</p><Link to="/login" className="mt-5 inline-block rounded-xl bg-amber-300 px-6 py-3 font-bold text-black">{ui("Sign in")}</Link></section> : tab === "play" ? <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_.8fr]">
        <section className="rounded-3xl border border-amber-300/25 bg-gradient-to-br from-amber-300/[.08] to-white/[.02] p-7 sm:p-10"><p className="text-xs font-black uppercase tracking-[.25em] text-amber-300">{ui("Your Rapid 5+0 Elo")}</p><div className="mt-5 flex items-center gap-5"><RankEmblem family={rank.family} size="lg" /><div><div className="font-serif text-6xl leading-none tabular-nums text-white">{rating}</div><p className="mt-1 text-lg font-semibold text-amber-200">{ui(rank.name)}</p></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-200" style={{ width: `${rank.progress * 100}%` }} /></div><p className="mt-2 text-xs text-zinc-400">{rank.nextAt ? `${rank.nextAt - rating} ${ui("Elo to")} ${ui(getChessRank(rank.nextAt).name)}` : ui("Highest tier reached")}</p><p className="mt-4 text-sm text-zinc-400">{games ? `${games} ${ui("rated games")}` : ui("Starting rating · Play your first ranked match")}</p><div className="mt-7"><p className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-400">{ui("Time control")}</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[{ name: "Bullet", clock: "1+0", ready: false }, { name: "Blitz", clock: "3+0", ready: false }, { name: "Rapid", clock: "5+0", ready: true }, { name: "Classical", clock: "10+0", ready: false }].map(mode => <button key={mode.name} type="button" disabled={!mode.ready} aria-pressed={mode.ready} title={mode.ready ? undefined : ui("Coming soon")} className={`rounded-xl border px-2 py-2 text-xs font-bold ${mode.ready ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/10 text-zinc-600"}`}>{ui(mode.name)}<span className="mt-0.5 block font-mono">{mode.clock}</span></button>)}</div><p className="mt-2 text-xs text-zinc-500">{ui("Rapid 5+0 is available now. Other time controls are coming soon.")}</p></div><button type="button" disabled={busy || status === "found"} onClick={() => void changeQueue(status === "waiting" ? "leaveQueue" : "queue")} className="mt-7 flex w-full items-center justify-center gap-3 rounded-xl bg-amber-300 px-6 py-4 text-lg font-black text-black transition hover:bg-amber-200 disabled:opacity-50"><Users size={22} />{busy ? ui("Please wait…") : status === "waiting" ? ui("Leave queue") : status === "found" ? ui("Starting match…") : ui("Find match")}</button><p className="mt-4 text-center text-sm text-zinc-400" aria-live="polite">{status === "waiting" ? ui("Searching for an opponent near your Elo…") : status === "found" ? ui("Opponent found. Opening your game…") : ui("Your game opens automatically when a match is ready.")}</p></section>
        <section className="rounded-3xl border border-white/10 bg-white/[.035] p-7 sm:p-9"><div className="flex items-center gap-3 text-amber-300"><Trophy size={24} /><h2 className="font-serif text-3xl text-white">{ui("How ranked works")}</h2></div><p className="mt-6 leading-7 text-zinc-300">{ui("Enter the queue to be paired with another player. Everyone starts at 1200 Elo. Your rating changes after a completed game based on the result and your opponent’s rating; wins raise it, losses lower it, and draws can move it either way.")}</p><p className="mt-4 text-sm leading-6 text-zinc-500">{ui("Only verified ranked games count. Your rating appears on the leaderboard after your first completed match.")}</p><button type="button" onClick={() => setTab("leaderboard")} className="mt-7 text-sm font-bold text-amber-300 hover:text-amber-200">{ui("View leaderboard →")}</button></section>
      </div> : <section className="mt-10 rounded-3xl border border-white/10 bg-white/[.035] p-6 sm:p-9"><div className="flex items-center gap-3"><Trophy className="text-amber-300" /><h2 className="font-serif text-3xl">{ui("Rapid 5+0 leaderboard")}</h2></div><div className="mt-6">{rows.length ? <LeaderboardTable rows={rows} valueLabel="Elo" currentUserId={user.id} /> : <p className="text-zinc-400">{ui("No verified ranked matches yet.")}</p>}</div><Link to="/leaderboards" className="mt-6 inline-block text-sm font-bold text-amber-300 hover:text-amber-200">{ui("All leaderboards →")}</Link></section>}
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-red-200">{error}</p>}
    </div>
  </Container>;
}
