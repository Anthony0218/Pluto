import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ui } from "@/i18n/ui";
import GoBoard from "@/components/strategy/GoBoard";
import GoGameReview from "@/components/strategy/GoGameReview";
import RankedPlayerBar from "@/components/ranked/RankedPlayerBar";
import { invokeRankedGame } from "@/games/chess/ranked/client";
import { formatClock } from "@/games/chess/ranked/clock";
import { goTimeControlLabel, isTop10 } from "@/games/go/ranked/config";
import { goClock } from "@/games/go/ranked/clock";
import { useGoRankedProfile } from "@/games/go/ranked/profile";
import type { RankedGoSnapshot } from "@/games/go/ranked/types";
import { canReviewGoGame } from "@/games/go/reviewAvailability";
import { saveGoGame, saveGoRecord } from "@/games/go/storage";
import { uploadGoRecord } from "@/games/go/cloudStorage";
import { goCoordinate } from "@/games/go/analysis";
import { scoreGo, type GoMove } from "@/games/go/rules";

export default function GoRankedGamePage() {
  const { code } = useParams();
  const { user } = useAuth();
  return <RankedGoGame key={`${code}:${user?.id}`} code={code} />;
}

function RankedGoGame({ code }: { code?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [review, setReview] = useState(params.get("review") === "1");
  const [sample, setSample] = useState<{ snapshot: RankedGoSnapshot; receivedAt: number } | null>(null);
  const latest = useRef<typeof sample>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const settled = useRef<string | null>(null);
  const savedRecord = useRef<{ version: number; id: string } | null>(null);
  const [now, setNow] = useState(() => performance.now());
  const [confirmResign, setConfirmResign] = useState(false);
  const request = useCallback(async (op: string, move?: GoMove) => {
    const result = await invokeRankedGame<RankedGoSnapshot>({ op, code, version: latest.current?.snapshot.game.version, move }, "go");
    if (result.game.code !== code) return;
    const old = latest.current;
    if (old && (result.game.version < old.snapshot.game.version || (result.game.version === old.snapshot.game.version && Date.parse(result.serverNow) < Date.parse(old.snapshot.serverNow)))) return;
    const next = { snapshot: result, receivedAt: performance.now() };
    latest.current = next; setSample(next); setError(null);
    if (result.game.status === "finished" && result.result && settled.current !== result.game.id) {
      settled.current = result.game.id;
      saveGoGame(result.game.state);
      window.dispatchEvent(new Event("go-ranked-settled"));
    }
  }, [code]);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const poll = async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try { await request("ready"); }
      catch (cause) { if (alive) setError(cause instanceof Error ? cause.message : "Could not load Go game."); }
      finally { inFlight.current = false; }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    const tick = window.setInterval(() => setNow(performance.now()), 100);
    window.addEventListener("focus", poll);
    return () => { alive = false; clearInterval(timer); clearInterval(tick); window.removeEventListener("focus", poll); };
  }, [request, user]);
  const g = sample && sample.snapshot.game.code === code ? sample.snapshot.game : null;
  const black = useGoRankedProfile(g?.black_id), white = useGoRankedProfile(g?.white_id);
  async function action(op: string, move?: GoMove) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setConfirmResign(false);
    try { await request(op, move); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Move failed. Refreshing the board."); try { await request("snapshot"); } catch { /* Keep last verified position; polling retries. */ } }
    finally { inFlight.current = false; setBusy(false); }
  }
  if (!user) return <main className="go-page"><Link to="/login">Sign in to play ranked Go</Link></main>;
  if (!g || !sample) return <main className="go-page"><Link to="/games/go/ranked">← Go Ranked</Link><p role={error ? "alert" : "status"}>{error ?? "Loading ranked game…"}</p></main>;
  const userId = user.id;
  const state = g.state, color = user.id === g.black_id ? "black" : "white";
  const disabled = busy || g.status !== "playing" || state.currentPlayer !== color;
  const reviewAvailable = canReviewGoGame(state);
  const score = g.status === "finished" && g.end_reason === "area score" ? scoreGo(state) : null;
  const gameVersion = g.version;
  function saveResult(analyze = false) {
    try {
      if (savedRecord.current?.version !== gameVersion) {
        const record = saveGoRecord(state, { mode: "ranked", players: { black: sample!.snapshot.players.find(player => player.color === "black")?.username ?? "Black", white: sample!.snapshot.players.find(player => player.color === "white")?.username ?? "White" } }, undefined, userId);
        savedRecord.current = { version: gameVersion, id: record.id };
        void uploadGoRecord(record, userId).then(() => setSaveNotice("Game saved and synced to your account.")).catch(() => setSaveNotice("Game saved on this device; account sync will retry later."));
      }
      if (analyze) navigate(`/games/go/analysis?game=${encodeURIComponent(savedRecord.current.id)}`);
      else setSaveNotice("Game saved to your Go library on this device.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this game."); }
  }
  return <main className="go-page">
    <header className="go-page-header"><Link to="/games/go/ranked">← Go Ranked</Link><h1>Go · Ranked {goTimeControlLabel(g.time_control)}</h1><span className="text-xs text-amber-200">9 × 9 · Komi {state.komi}</span></header>
    {error && <p role="alert" className="my-3 rounded-xl border border-red-400/25 bg-red-400/10 p-4 text-red-200">{error}</p>}
    <div className="go-game-toolbar"><div className="go-tabs" role="tablist" aria-label="Go game views"><button onClick={() => setReview(false)} aria-selected={!review} role="tab">Play</button>{reviewAvailable && <button onClick={() => setReview(true)} aria-selected={review} role="tab">Game Review</button>}</div>{g.status === "finished" || g.status === "abandoned" ? <Link className="go-action" to="/games/go/ranked">Find next match</Link> : <span className="go-muted">Reconnecting preserves your clock. Clocks continue while disconnected.</span>}</div>
    {review && reviewAvailable ? <GoGameReview game={state} /> : <div className="go-play-layout"><section><GoBoard state={state} disabled={disabled} onMove={move => void action(move.type === "resign" ? "resign" : "move", move)} /></section><aside>
      <h2 role="status">{g.status === "ready" ? "Waiting for both players · starts when both connect" : g.status === "abandoned" ? "Abandoned before start · No Elo change" : state.result ?? `${state.currentPlayer} to move`}</h2>
      {score && <p className="go-muted">Final area score: Black {score.black} · White {score.white}</p>}
      {g.status === "ready" && <><p className="go-muted">{Math.max(0, Math.ceil((Date.parse(g.created_at) + 30_000 - Date.parse(sample.snapshot.serverNow) - (now - sample.receivedAt)) / 1000))} seconds to connect</p><button className="go-action" disabled={busy} onClick={() => void action("abandon")}>Cancel before start</button></>}
      <div className="space-y-3">{sample.snapshot.players.map(player => {
        const profile = (player.color === "black" ? black : white).rows?.find(row => row.time_control === g.time_control);
        const position = profile?.leaderboard_rank, r = sample.snapshot.result;
        const change = r ? { before: player.color === "black" ? r.black_before : r.white_before, after: player.color === "black" ? r.black_after : r.white_after } : undefined;
        const clock = goClock(sample.snapshot, player.color, sample.receivedAt, now);
        const ms = clock.inByoYomi ? clock.periodMs : clock.mainMs;
        return <div key={player.user_id}><RankedPlayerBar name={player.username} avatarId={player.avatar_id} color={player.color} active={g.status === "playing" && state.currentPlayer === player.color} me={player.user_id === user.id} rating={change?.after ?? profile?.rating ?? player.rating} ratingChange={change} leaderboardRank={position} topRank={isTop10(position) ? position! : undefined} showTier t={ui} /><div role="timer" aria-label={`${player.color} clock`} className={`mt-2 rounded-xl border px-4 py-2 text-right font-mono text-3xl font-bold tabular-nums ${ms < 10000 ? "border-red-400 bg-red-950 text-red-200" : "border-white/10 text-zinc-300"}`}>{formatClock(ms)}<span className="mt-1 block font-sans text-xs font-medium">{clock.inByoYomi ? "Byo-yomi" : "Main time"} · {clock.periodsRemaining} × {g.byo_yomi_ms / 1000}s{clock.inByoYomi ? " remaining" : " byo-yomi"}</span></div></div>;
      })}</div>
      <div className="go-controls"><button disabled={disabled} onClick={() => void action("move", { type: "pass" })}>Pass</button><button disabled={busy || g.status !== "playing"} onClick={() => setConfirmResign(true)}>Resign</button></div>
      {confirmResign && <div className="mt-3 rounded-xl border border-red-400/25 bg-red-400/10 p-4"><p>Resigning counts as a ranked loss.</p><div className="go-controls"><button disabled={busy} onClick={() => void action("resign")}>Confirm resignation</button><button onClick={() => setConfirmResign(false)}>Keep playing</button></div></div>}
      {state.moveHistory.length > 0 && <div className="go-result-actions"><button className="go-action" onClick={() => saveResult(false)}>Save Game</button>{reviewAvailable && <button className="go-action" onClick={() => saveResult(true)}>Analyze Game</button>}</div>}
      {saveNotice && <p role="status" className="go-muted">{saveNotice}</p>}
      <h3>Moves</h3><ol className="go-game-history">{state.moveHistory.map((move, i) => <li key={i}>{i + 1}. {move.player === "black" ? "B" : "W"} {goCoordinate(move, state.boardSize)}</li>)}</ol>
    </aside></div>}
  </main>;
}
