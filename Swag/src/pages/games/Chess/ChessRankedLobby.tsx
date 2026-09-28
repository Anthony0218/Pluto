import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trophy, Users } from "lucide-react";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import LeaderboardTable, { type LeaderboardRow } from "@/components/social/LeaderboardTable";
import { useAuth } from "@/context/AuthContext";
import { ui, useUiLanguage } from "@/i18n/ui";
import { supabase } from "@/lib/supabase";
import { invokeRankedChess, RankedAuthError } from "@/games/chess/ranked/client";

type QueueStatus = "idle" | "waiting" | "found" | "matched";
type QueueResponse = { status?: QueueStatus; code?: string; error?: string };
type EloRow = { rank: number; user_id: string; username: string; avatar_id: string | null; rating: number };

export default function ChessRankedLobby() {
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
  const name = profile?.display_name || profile?.username || user?.email?.split("@")[0] || "Player";

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
    const result = await invokeRankedChess<QueueResponse>({ op, name });
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
    try { await request(op); if (op === "leaveQueue") setStatus("idle"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Matchmaking failed."); }
    finally { setBusy(false); }
  }

  return <main className="chess-menu-page relative left-1/2 min-h-[var(--app-height)] w-screen -translate-x-1/2 bg-[#07090b] text-white">
    <ChessPageHeader title="Ranked Chess" className="chess-menu-header" />
    <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
      <Link to="/games/chess/classic/multiplayer" className="text-sm text-zinc-500 hover:text-white">{ui("← Multiplayer")}</Link>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-5">
        <div><p className="text-xs font-black uppercase tracking-[.3em] text-amber-300">{ui("Competitive chess")}</p><h1 className="mt-3 font-serif text-5xl sm:text-7xl">{ui("Ranked Chess")}</h1><p className="mt-4 max-w-2xl text-zinc-400">{ui("Find an opponent near your rating and play a verified match.")}</p></div>
        <div role="tablist" aria-label="Ranked chess" className="flex rounded-xl border border-white/15 p-1"><button role="tab" aria-selected={tab === "play"} onClick={() => setTab("play")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "play" ? "bg-amber-300 text-black" : "text-zinc-400 hover:text-white"}`}>{ui("Play")}</button><button role="tab" aria-selected={tab === "leaderboard"} onClick={() => setTab("leaderboard")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "leaderboard" ? "bg-amber-300 text-black" : "text-zinc-400 hover:text-white"}`}>{ui("Leaderboard")}</button></div>
      </div>
      {!user ? <section className="mt-10 rounded-3xl border border-white/10 bg-white/[.035] p-8"><p>{ui("Sign in to play ranked chess and view your rating.")}</p><Link to="/login" className="mt-5 inline-block rounded-xl bg-amber-300 px-6 py-3 font-bold text-black">{ui("Sign in")}</Link></section> : tab === "play" ? <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_.8fr]">
        <section className="rounded-3xl border border-amber-300/25 bg-gradient-to-br from-amber-300/[.08] to-white/[.02] p-7 sm:p-10"><p className="text-xs font-black uppercase tracking-[.25em] text-amber-300">{ui("Your chess Elo")}</p><div className="mt-3 font-serif text-[clamp(5rem,15vw,10rem)] leading-none tabular-nums text-white">{rating}</div><p className="mt-3 text-sm text-zinc-400">{games ? `${games} ${ui("rated games")}` : ui("Starting rating · Play your first ranked match")}</p><button type="button" disabled={busy || status === "found"} onClick={() => void changeQueue(status === "waiting" ? "leaveQueue" : "queue")} className="mt-9 flex w-full items-center justify-center gap-3 rounded-xl bg-amber-300 px-6 py-4 text-lg font-black text-black transition hover:bg-amber-200 disabled:opacity-50"><Users size={22} />{busy ? ui("Please wait…") : status === "waiting" ? ui("Leave queue") : status === "found" ? ui("Starting match…") : ui("Join ranked queue")}</button><p className="mt-4 text-center text-sm text-zinc-400" aria-live="polite">{status === "waiting" ? ui("Searching for an opponent near your Elo…") : status === "found" ? ui("Opponent found. Opening your game…") : ui("Your game opens automatically when a match is ready.")}</p></section>
        <section className="rounded-3xl border border-white/10 bg-white/[.035] p-7 sm:p-9"><div className="flex items-center gap-3 text-amber-300"><Trophy size={24} /><h2 className="font-serif text-3xl text-white">{ui("How ranked works")}</h2></div><p className="mt-6 leading-7 text-zinc-300">{ui("Enter the queue to be paired with another player. Everyone starts at 1200 Elo. Your rating changes after a completed game based on the result and your opponent’s rating; wins raise it, losses lower it, and draws can move it either way.")}</p><p className="mt-4 text-sm leading-6 text-zinc-500">{ui("Only verified ranked games count. Your rating appears on the leaderboard after your first completed match.")}</p><button type="button" onClick={() => setTab("leaderboard")} className="mt-7 text-sm font-bold text-amber-300 hover:text-amber-200">{ui("View leaderboard →")}</button></section>
      </div> : <section className="mt-10 rounded-3xl border border-white/10 bg-white/[.035] p-6 sm:p-9"><div className="flex items-center gap-3"><Trophy className="text-amber-300" /><h2 className="font-serif text-3xl">{ui("Chess Elo leaderboard")}</h2></div><div className="mt-6">{rows.length ? <LeaderboardTable rows={rows} valueLabel="Elo" currentUserId={user.id} /> : <p className="text-zinc-400">{ui("No verified ranked matches yet.")}</p>}</div><Link to="/leaderboards" className="mt-6 inline-block text-sm font-bold text-amber-300 hover:text-amber-200">{ui("All leaderboards →")}</Link></section>}
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-red-200">{error}</p>}
    </div>
  </main>;
}
