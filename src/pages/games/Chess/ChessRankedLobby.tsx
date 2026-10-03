import { GO_RANKED_DEFAULT_MODE, goTimeControls, type GoTimeControl, isGoTimeControl, goTimeControlLabel, isTop10 } from "@/games/go/ranked/config";
import { useGoRankedProfile } from "@/games/go/ranked/profile";
import GoRankedLeaderboard from "@/components/ranked/GoRankedLeaderboard";
import GoRankedHistory from "@/components/ranked/GoRankedHistory";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Trophy, Users } from "lucide-react";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import DashboardDialog from "@/components/App/dashboard/DashboardDialog";
import LeaderboardTable, { type LeaderboardRow } from "@/components/social/LeaderboardTable";
import { useAuth } from "@/context/AuthContext";
import { ui, useUiLanguage } from "@/i18n/ui";
import { supabase } from "@/lib/supabase";
import { invokeRankedGame, leaveRankedGameQueue, RankedAuthError } from "@/games/chess/ranked/client";
import { getChessRank, type RankFamily } from "@/games/chess/ranked/tiers";
import RankEmblem from "@/components/chess/RankEmblem";
import TopRankBadge from "@/components/chess/TopRankBadge";
import { isTimeControl, timeControlLabel, timeControls, type TimeControl } from "@/games/chess/ranked/timeControls";

type QueueStatus = "idle" | "waiting" | "found" | "matched";
type QueueResponse = { status?: QueueStatus; code?: string; error?: string; timeControl?: string };
type EloRow = { rank: number; user_id: string; username: string; avatar_id: string | null; rating: number };
type RatingRow = { time_control: string; rating: number; rated_games: number };

type RankedTimeControl = TimeControl | GoTimeControl;

const TIME_CONTROL_KEY = "chess-ranked-time-control";

function storedTimeControl(game: "chess" | "go"): RankedTimeControl {
  try {
    const stored = localStorage.getItem(game === "go" ? "go-ranked-time-control" : TIME_CONTROL_KEY);
    if (game === "go") return isGoTimeControl(stored) ? stored : GO_RANKED_DEFAULT_MODE;
    return isTimeControl(stored) ? stored : "rapid";
  } catch {
    return game === "go" ? GO_RANKED_DEFAULT_MODE : "rapid";
  }
}

/** Mode tabs shared by the play card and the leaderboard. */
function TimeControlTabs({ value, onChange, disabled = false, label, game = "chess" }: { game?: "chess" | "go"; value: RankedTimeControl; onChange: (next: RankedTimeControl) => void; disabled?: boolean; label: string }) {
  return <div role="tablist" aria-label={label} className={`grid gap-2 ${game === "go" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
    {(game === "go" ? goTimeControls : timeControls).map(mode => <button key={mode.id} type="button" role="tab" aria-selected={value === mode.id} disabled={disabled && value !== mode.id} onClick={() => onChange(mode.id)} className={`rounded-xl border px-2 py-2 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-amber-300 disabled:opacity-40 ${value === mode.id ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/10 text-zinc-400 hover:border-amber-300/40 hover:text-white"}`}>{ui(mode.name)}<span className="mt-0.5 block font-mono">{mode.clock}</span></button>)}
  </div>;
}

const rankLegend: { family: RankFamily; range: string; divisions: string; detail: string }[] = [
  { family: "Bronze", range: "Below 800 Elo", divisions: "Bronze V → I", detail: "The entry ranks. Bronze V covers the widest opening range; from Bronze IV onward, each division is 100 Elo." },
  { family: "Silver", range: "800–1299 Elo", divisions: "Silver V → I", detail: "Five divisions of 100 Elo. New ranked players begin at 1200 Elo in Silver I." },
  { family: "Gold", range: "1300–1799 Elo", divisions: "Gold V → I", detail: "Five divisions of 100 Elo." },
  { family: "Platinum", range: "1800–2299 Elo", divisions: "Platinum V → I", detail: "Five divisions of 100 Elo." },
  { family: "Diamond", range: "2300–2549 Elo", divisions: "Diamond V → I", detail: "Five tighter divisions of 50 Elo." },
  { family: "Master", range: "2550–2699 Elo", divisions: "One tier", detail: "The final tier before Grandmaster." },
  { family: "Grandmaster", range: "2700+ Elo", divisions: "Highest tier", detail: "The top rank has no upper Elo limit." },
];

function EloRankGuide({ currentFamily, onClose }: { currentFamily?: RankFamily; onClose: () => void }) {
  const [tab, setTab] = useState<"how" | "ranks">("how");
  const tabs = [{ id: "how", label: "How ranked works" }, { id: "ranks", label: "Ranks" }] as const;
  return <DashboardDialog title={ui("Elo rank guide")} onClose={onClose}>
    <div role="tablist" aria-label={ui("Elo rank guide")} className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-white/[.04] p-1.5">
      {tabs.map(item => <button key={item.id} type="button" role="tab" id={`elo-guide-tab-${item.id}`} aria-selected={tab === item.id} aria-controls={`elo-guide-panel-${item.id}`} onClick={() => setTab(item.id)} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === item.id ? "bg-amber-300 text-black" : "text-zinc-400 hover:bg-white/[.06] hover:text-white"}`}>{ui(item.label)}</button>)}
    </div>
    {tab === "how" ? <div role="tabpanel" id="elo-guide-panel-how" aria-labelledby="elo-guide-tab-how">
      <div className="flex items-center gap-3 text-amber-300"><Trophy size={22} /><h3 className="font-serif text-2xl text-white">{ui("How ranked works")}</h3></div>
      <p className="mt-4 leading-7 text-zinc-300">{ui("Enter the queue to be paired with another player. Everyone starts at 1200 Elo. Your rating changes after a completed game based on the result and your opponent’s rating; wins raise it, losses lower it, and draws can move it either way.")}</p>
      <p className="mt-3 text-sm leading-6 text-zinc-500">{ui("Only verified ranked games count. Your rating appears on the leaderboard after your first completed match.")}</p>
      <section className="mt-5 rounded-2xl border border-indigo-300/20 bg-indigo-300/[.06] p-4">
        <h3 className="font-bold text-white">{ui("How your rating changes")}</h3>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-300">
          <li><strong className="text-white">1.</strong> {ui("Only completed, verified ranked games affect Elo.")}</li>
          <li><strong className="text-white">2.</strong> {ui("Wins increase your rating and losses decrease it. Draws can move it slightly depending on the rating difference.")}</li>
          <li><strong className="text-white">3.</strong> {ui("Beating a stronger opponent earns more; losing to a lower-rated opponent costs more.")}</li>
          <li><strong className="text-white">4.</strong> {ui("Your first 20 rated games adjust faster (K-factor 32). After that, ratings become steadier (K-factor 20).")}</li>
        </ul>
      </section>
    </div> : <div role="tabpanel" id="elo-guide-panel-ranks" aria-labelledby="elo-guide-tab-ranks">
      <p className="text-sm leading-6 text-slate-300">{ui("Your Elo rating measures ranked performance. Crossing a rank boundary promotes or demotes you immediately, and divisions run from V up to I.")}</p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {rankLegend.map(item => <article key={item.family} className={`rounded-2xl border p-3 ${currentFamily === item.family ? "border-amber-300/60 bg-amber-300/[.09]" : "border-white/10 bg-white/[.035]"}`}>
          <div className="flex items-center gap-3">
            <RankEmblem family={item.family} size="sm" />
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-white">{ui(item.family)}</h3>{currentFamily === item.family && <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-black">{ui("Your rank")}</span>}</div><p className="text-xs font-semibold text-amber-200">{item.range}</p></div>
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-200">{ui(item.divisions)}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{ui(item.detail)}</p>
        </article>)}
      </div>
    </div>}
  </DashboardDialog>;
}

export default function ChessRankedLobby({ embedded = false, game = "chess" }: { embedded?: boolean; game?: "chess" | "go" } = {}) {
  useUiLanguage();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"play" | "leaderboard">("play");
  const [timeControl, setTimeControl] = useState<RankedTimeControl>(() => storedTimeControl(game));
  const [boardControl, setBoardControl] = useState<RankedTimeControl>(timeControl);
  const [ratings, setRatings] = useState<Partial<Record<RankedTimeControl, { rating: number; games: number }>>>({});
  const [boards, setBoards] = useState<Partial<Record<RankedTimeControl, LeaderboardRow[]>>>({});
  const timeControlRef = useRef(timeControl);
  useEffect(() => { timeControlRef.current = timeControl; }, [timeControl]);
  const goRatings = useGoRankedProfile(game === "go" ? user?.id : undefined);
  const goProfile = goRatings.rows?.find(row => row.time_control === timeControl);
  const rating = (game === "go" ? goProfile?.rating : ratings[timeControl]?.rating) ?? 1200;
  const games = (game === "go" ? goProfile?.rated_games : ratings[timeControl]?.games) ?? 0;
  const rows = boards[boardControl];
  const [status, setStatus] = useState<QueueStatus>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rankGuideOpen, setRankGuideOpen] = useState(false);
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
      leaveRankedGameQueue(latest.id, game);
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) { lease.current = { id: crypto.randomUUID(), active: true }; setStatus("idle"); }
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", restore);
    return () => { leave(); window.removeEventListener("pagehide", leave); window.removeEventListener("pageshow", restore); };
  }, [user?.id, game]);
  const name = profile?.display_name || profile?.username || user?.email?.split("@")[0] || "Player";
  const rank = getChessRank(rating);
  const exactRank = game === "go" ? goProfile?.leaderboard_rank : user ? boards[timeControl]?.find(row => row.user_id === user.id)?.rank : undefined;
  const topRank = isTop10(exactRank) ? exactRank : undefined;
  const label = (control: RankedTimeControl) => game === "go" && isGoTimeControl(control) ? goTimeControlLabel(control, ui) : timeControlLabel(isTimeControl(control) ? control : "rapid", ui);

  function chooseTimeControl(next: RankedTimeControl) {
    setTimeControl(next);
    setBoardControl(next);
    try { localStorage.setItem(game === "go" ? "go-ranked-time-control" : TIME_CONTROL_KEY, next); } catch { /* Storage blocked: the choice lasts for this visit. */ }
  }

  useEffect(() => {
    if (!user || game === "go") return;
    let active = true;
    void Promise.resolve(supabase.from("chess_ratings").select("time_control,rating,rated_games").eq("user_id", user.id)).then(result => {
      if (!active || !Array.isArray(result?.data)) return;
      setRatings(Object.fromEntries((result.data as RatingRow[]).filter(row => isTimeControl(row.time_control)).map(row => [row.time_control, { rating: row.rating, games: row.rated_games }])));
    });
    return () => { active = false; };
  }, [user, game]);

  // Each mode's leaderboard loads once, when the play card or the leaderboard first needs it.
  const neededBoards = [...new Set([timeControl, boardControl])].filter(control => !boards[control]).join(",");
  useEffect(() => {
    if (!user || !neededBoards || game === "go") return;
    let active = true;
    for (const control of neededBoards.split(",") as TimeControl[]) {
      void supabase.rpc("get_chess_elo_leaderboard", { p_time_control: control }).then(leaderboard => {
        if (!active) return;
        if (leaderboard.error) setError(leaderboard.error.message);
        setBoards(current => ({ ...current, [control]: ((leaderboard.data ?? []) as EloRow[]).map(row => ({ rank: row.rank, user_id: row.user_id, username: row.username, avatar_id: row.avatar_id, value: row.rating })) }));
      });
    }
    return () => { active = false; };
  }, [user, neededBoards, game]);

  const request = useCallback(async (op: "queue" | "queueStatus" | "leaveQueue") => {
    const current = lease.current;
    if (!current.active) return;
    const result = await invokeRankedGame<QueueResponse>({ op, name, sessionId: current.id, timeControl: timeControlRef.current }, game);
    if (!current.active || current !== lease.current) { leaveRankedGameQueue(current.id, game); return; }
    // A search restored after a reload shows the control it is running in.
    if (result?.status === "waiting" && (game === "go" ? isGoTimeControl(result.timeControl) : isTimeControl(result.timeControl))) setTimeControl(result.timeControl as RankedTimeControl);
    if (result?.status) setStatus(result.status);
    setError(result?.error ?? null);
    if (result?.status === "matched" && result.code) {
      navigate(`/games/${game}/ranked/${result.code}/game`);
    }
  }, [name, navigate, game]);

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
    {!embedded && (game === "chess" ? <ChessPageHeader title="Ranked Chess" className="chess-menu-header" /> : <header className="chess-menu-header p-5"><Link to="/games/go">← Go</Link></header>)}
    <div className={embedded ? "w-full pb-4" : "mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-16"}>
      {!embedded && <Link to={game === "go" ? "/games/go/multiplayer" : "/games/chess/classic/multiplayer"} className="text-sm text-zinc-500 hover:text-white">{ui("← Multiplayer")}</Link>}

      <div className={`${embedded ? "" : "mt-8"} flex flex-wrap items-end justify-between gap-5`}>
        {!embedded && <div><p className="text-xs font-black uppercase tracking-[.3em] text-amber-300">{ui(game === "go" ? "Competitive Go" : "Competitive chess")}</p><h1 className="mt-3 font-serif text-5xl sm:text-7xl">{ui(game === "go" ? "Ranked Go" : "Ranked Chess")}</h1><p className="mt-4 max-w-2xl text-zinc-400">{ui("Find an opponent near your rating and play a verified match.")}</p></div>}
        <div className={`flex flex-wrap items-center gap-2 ${embedded ? "w-full justify-between" : ""}`}><button type="button" onClick={() => setRankGuideOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-amber-300/30 px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-300/10"><BookOpen size={16} />{ui("Elo rank guide")}</button><div role="tablist" aria-label={`Ranked ${game}`} className="flex rounded-xl border border-white/15 p-1"><button role="tab" aria-selected={tab === "play"} onClick={() => setTab("play")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "play" ? "bg-amber-300 text-black" : "text-zinc-400 hover:text-white"}`}>{ui("Play")}</button><button role="tab" aria-selected={tab === "leaderboard"} onClick={() => setTab("leaderboard")} className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === "leaderboard" ? "bg-amber-300 text-black" : "text-zinc-400 hover:text-white"}`}>{ui("Leaderboard")}</button></div></div>
      </div>
      {!user ? <section className="mt-6 rounded-3xl border border-white/10 bg-white/[.035] p-8"><p>{ui(`Sign in to play ranked ${game} and view your rating.`)}</p><Link to="/login" className="mt-5 inline-block rounded-xl bg-amber-300 px-6 py-3 font-bold text-black">{ui("Sign in")}</Link></section> : tab === "play" ? <div className="mt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <section className={`relative rounded-[22px] border border-amber-300/25 bg-gradient-to-br from-amber-300/[.08] to-white/[.02] p-5 sm:p-6 ${topRank ? "top-rank-glow" : ""}`}>{topRank && <span className="absolute right-4 top-4"><TopRankBadge rank={topRank} /></span>}<p className="text-[9px] font-black uppercase tracking-[.26em] text-amber-300/80">{ui("Your Elo")} · {label(timeControl)}</p><div className="mt-5 flex items-center gap-5"><RankEmblem family={rank.family} size="lg" /><div><div className="font-serif text-6xl leading-none tabular-nums text-white">{rating}</div><p className="mt-1 text-lg font-semibold text-amber-200">{ui(rank.name)}</p></div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-200" style={{ width: `${rank.progress * 100}%` }} /></div><p className="mt-2 text-xs text-zinc-400">{rank.nextAt ? `${rank.nextAt - rating} ${ui("Elo to")} ${ui(getChessRank(rank.nextAt).name)}` : ui("Highest tier reached")}</p><p className="mt-4 text-sm text-zinc-400">{games ? `${games} ${ui("rated games")}` : ui("Starting rating · Play your first ranked match")}</p>{game === "go" && <p className="mt-3 text-sm text-amber-200">{exactRank ? `#${exactRank}${isTop10(exactRank) ? " · TOP 10" : ""}` : "Unranked · Complete a match"}</p>}<button type="button" onClick={() => setTab("leaderboard")} className="mt-5 text-sm font-bold text-amber-300 hover:text-amber-200">{ui("View leaderboard →")}</button></section>
          <section className="flex flex-col rounded-[22px] border border-white/[0.09] bg-black/20 p-5 sm:p-6"><p className="text-[9px] font-black uppercase tracking-[.26em] text-amber-300/70">{ui("Competitive game")}</p><h2 className="mt-1.5 font-serif text-[27px] leading-tight text-white sm:text-[31px]">{ui("Find match")}</h2><div className="mt-5"><p className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-400">{ui("Time control")}</p><TimeControlTabs game={game} value={timeControl} onChange={chooseTimeControl} disabled={status !== "idle"} label={ui("Time control")} /><p className="mt-2 text-xs leading-5 text-zinc-500">{ui(game === "go" ? "Each time control has its own Go queue and Elo. 9 × 9 · Komi 6.5 · Japanese byo-yomi." : "Each time control has its own queue and Elo. Premoves are allowed in every ranked game.")}</p>{game === "go" && <p className="mt-2 text-xs leading-5 text-zinc-400">{ui("After main time, each move resets the current period. Running out of a period uses it up; running out of all periods loses the game.")}</p>}</div><div className="mt-auto pt-6"><button type="button" disabled={busy || status === "found"} onClick={() => void changeQueue(status === "waiting" ? "leaveQueue" : "queue")} className="flex w-full items-center justify-center gap-3 rounded-xl border border-amber-300/45 bg-amber-300 px-6 py-3.5 text-base font-black text-black transition hover:bg-amber-200 disabled:opacity-50"><Users size={20} />{busy ? ui("Please wait…") : status === "waiting" ? ui("Leave queue") : status === "found" ? ui("Starting match…") : ui("Find match")}</button><p className="mt-3 text-center text-xs text-zinc-400" aria-live="polite">{status === "waiting" ? ui("Searching for an opponent near your Elo…") : status === "found" ? ui("Opponent found. Opening your game…") : ui("Your game opens automatically when a match is ready.")}</p></div></section>
        </div>
        <div className="mt-4 rounded-[22px] border border-white/[0.08] bg-black/20 p-5 shadow-[0_16px_40px_rgba(0,0,0,.18)] sm:p-6"><p className="text-[9px] font-black uppercase tracking-[.28em] text-amber-300/65">{ui("How it works")}</p><div className="mt-4 grid gap-4 sm:grid-cols-2">{["Enter the queue and wait for an opponent near your Elo.", "Your game opens automatically and your rating updates afterwards."].map((step, index) => <div key={step} className="flex gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-300/30 text-sm font-black text-amber-300">{index + 1}</span><p className="text-sm leading-6 text-zinc-500">{ui(step)}</p></div>)}</div></div>
      </div> : <section className="mt-6 rounded-3xl border border-white/10 bg-white/[.035] p-6 sm:p-9"><div className="flex items-center gap-3"><Trophy className="text-amber-300" /><h2 className="font-serif text-3xl">{ui("Leaderboard")} · {label(boardControl)}</h2></div><div className="mt-5"><TimeControlTabs game={game} value={boardControl} onChange={setBoardControl} label={ui("Leaderboard time control")} /></div><div className="mt-6" role="tabpanel">{game === "go" && isGoTimeControl(boardControl) ? <GoRankedLeaderboard mode={boardControl} /> : !rows ? <p className="text-zinc-400">{ui("Loading…")}</p> : rows.length ? <LeaderboardTable rows={rows} valueLabel="Elo" currentUserId={user.id} chessRanks /> : <p className="text-zinc-400">{ui("No verified ranked matches yet.")}</p>}</div><Link to="/leaderboards" className="mt-6 inline-block text-sm font-bold text-amber-300 hover:text-amber-200">{ui("All leaderboards →")}</Link></section>}
      {game === "go" && user && <GoRankedHistory userId={user.id} />}
      {(error || goRatings.error) && <p role="alert" className="mt-6 rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-red-200">{error || goRatings.error}</p>}
    </div>
    {rankGuideOpen && <EloRankGuide currentFamily={user ? rank.family : undefined} onClose={() => setRankGuideOpen(false)} />}
  </Container>;
}
