import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import AtlasRankBadge from "@/components/atlas/AtlasRankBadge";
import { AtlasRankGuide, AtlasLeaderboard } from "@/components/atlas/AtlasRankDialogs";
import { useAtlasRanks } from "@/games/atlas/useAtlasRanks";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Check, Shield, Swords, Trophy } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { getRankFromProfile, maxModeBans, rankedModes, RANKED_CONFIG } from "../../../games/atlas/ranked";
import { useAtlasData } from "../../../games/atlas/useAtlasData";
import { supabase } from "../../../lib/supabase";
import { MODE_ICONS } from "./useArenaStore";

type RankedProfile = { rating: number; deviation:number; matches_played: number };
type QueueStatus = { status: "idle" | "waiting" | "matched"; code?: string };
type Draft = { status: string; players: { id: string; name: string }[]; series?: { bans: Record<string, string[]>; submittedCount: number } };
const modes = rankedModes();
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : "Ranked is unavailable.";

export function AtlasRankedTab() {
  useGameLanguage();
  const { user, profile: account } = useAuth();
  const { data: atlas } = useAtlasData();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<"info" | "leaderboard" | null>(null);
  const { rows: badges } = useAtlasRanks(user ? [user.id] : []);
  const [profile, setProfile] = useState<RankedProfile | null>(null);
  const [status, setStatus] = useState<QueueStatus["status"]>("idle");
  const [draftCode, setDraftCode] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [bans, setBans] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const session = useRef(crypto.randomUUID());
  const datasetVersion = atlas?.version.atlasDataVersion;
  const name = account?.display_name || account?.username || "Explorer";
  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error: callError } = await supabase.functions.invoke("atlas-match", { body });
    if (callError) {
      const context = (callError as { context?: Response }).context;
      const detail = context && typeof context.json === "function" ? await context.clone().json().catch(() => null) as { error?: string } | null : null;
      throw new Error(detail?.error ?? callError.message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);
  useEffect(() => {
    if (!user) return;
    let live = true;
    void invoke({ op: "rankedProfile" }).then((data) => { if (live) setProfile(data as RankedProfile); }).catch((cause) => { if (live) setError(errorText(cause)); });
    return () => { live = false; };
  }, [invoke, user]);
  const queueAction = useCallback(async (action: "queue" | "status" | "leave") => {
    const next = await invoke({ op: "rankedQueue", action, session: session.current, name, datasetVersion }) as QueueStatus;
    if (next.status === "matched" && next.code) { setDraftCode(next.code); setStatus("idle"); }
    else setStatus(next.status);
  }, [datasetVersion, invoke, name]);
  useEffect(() => {
    if (!user || !datasetVersion) return;
    void queueAction("status").catch(() => {});
  }, [datasetVersion, queueAction, user]);
  useEffect(() => {
    if (status !== "waiting") return;
    const timer = window.setInterval(() => void queueAction("status").catch((cause) => setError(errorText(cause))), RANKED_CONFIG.queueHeartbeatMs);
    return () => window.clearInterval(timer);
  }, [queueAction, status]);
  useEffect(() => {
    const currentSession = session.current;
    return () => { if (status === "waiting") void invoke({ op: "rankedQueue", action: "leave", session: currentSession, name, datasetVersion }).catch(() => {}); };
  }, [datasetVersion, invoke, name, status]);
  useEffect(() => {
    if (!draftCode || !datasetVersion) return;
    let live = true;
    const refresh = () => void invoke({ op: "get", code: draftCode, datasetVersion }).then((next: Draft) => {
      if (!live) return;
      if (next.status === "ready" || next.status === "intermission" || next.status === "countdown") navigate(`/games/atlas-arena/multiplayer/${draftCode}`);
      else if (next.status === "cancelled") { setDraftCode(""); setError("The match was cancelled before play began."); }
      else setDraft(next);
    }).catch((cause) => { if (live) setError(errorText(cause)); });
    refresh();
    const timer = window.setInterval(refresh, 1500);
    return () => { live = false; window.clearInterval(timer); };
  }, [datasetVersion, draftCode, invoke, navigate]);
  const act = async (action: "queue" | "leave") => {
    setBusy(true); setError("");
    try { await queueAction(action); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  };
  const locked = Boolean(user && draft?.series?.bans[user.id]);
  const submitBans = async () => {
    if (!draftCode || locked) return;
    setBusy(true); setError("");
    try { setDraft(await invoke({ op: "ban", code: draftCode, bans, datasetVersion }) as Draft); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusy(false); }
  };
  if (!user) return <section className="atlas-ranked-home"><div className="atlas-ranked-tools"><button type="button" onClick={() => setDialog("info")}><BookOpen size={16} />{gameUi(" Rank info")}</button><button type="button" onClick={() => setDialog("leaderboard")}><Trophy size={16} />{gameUi(" Leaderboard")}</button></div>{dialog === "info" && <AtlasRankGuide onClose={() => setDialog(null)} />}{dialog === "leaderboard" && <AtlasLeaderboard onClose={() => setDialog(null)} />}<div className="atlas-ranked-hero"><div className="atlas-ranked-hero-copy"><span className="atlas-eyebrow">{gameUi("Competitive Atlas")}</span><h2>{gameUi("Ranked Arena")}</h2><p>{gameUi("Sign in to track your rating and find an opponent.")}</p></div><div className="atlas-ranked-hero-action"><Link className="atlas-start" to="/login"><Shield size={18} />{gameUi(" Sign in")}</Link></div></div></section>;
  const rating = profile?.rating ?? 1500, rank = getRankFromProfile(profile??{rating,deviation:350,matches_played:0});
  if (draftCode) return <section className="atlas-ranked-draft" aria-label={gameUi("Ranked mode bans")}>
    <span className="atlas-eyebrow">{gameUi("Opponent found · ")}{gameUi(draft?.players.find((player) => player.id !== user.id)?.name ?? "Explorer")}</span>
    <h2>{gameUi("Ban modes before the room")}</h2>
    <p>{gameUi("Choose up to ")}{gameUi(maxModeBans())}{gameUi(" modes. Both players lock their bans, then three different unbanned modes are drawn in random order. First to win two games wins the match.")}</p>
    <div className="atlas-ranked-draft-count">{gameUi(locked ? "Your bans are locked. Waiting for the other player…" : `${bans.length} / ${maxModeBans()} bans selected`)} · {gameUi(draft?.series?.submittedCount ?? 0)}{gameUi(" / 2 players ready")}</div>
    <div className="atlas-ranked-mode-grid">{modes.map((mode) => { const Icon = MODE_ICONS[mode.id], banned = (locked ? draft?.series?.bans[user.id] ?? [] : bans).includes(mode.online); return <button type="button" key={mode.id} className={`atlas-duel-card trial-accent-${mode.accent} ${banned ? "is-banned" : ""}`} aria-pressed={banned} disabled={locked || busy || (!banned && bans.length >= maxModeBans())} onClick={() => setBans((selected) => banned ? selected.filter((id) => id !== mode.online) : [...selected, mode.online])}><Icon aria-hidden /><strong>{gameUi(mode.title)}</strong><small>{gameUi(banned ? <><Check size={13} />{gameUi(" Banned")}</> : mode.tagline)}</small></button>; })}</div>
    {!locked && <button type="button" className="atlas-start atlas-ranked-lock" disabled={busy || !draft} onClick={() => void submitBans()}>{gameUi("Lock bans & reveal the series")}</button>}
    {error && <p className="atlas-multiplayer-error" role="alert">{gameUi(error)}</p>}
  </section>;
  return <section className="atlas-ranked-home" aria-label={gameUi("Ranked Atlas Arena")}>
    <div className="atlas-ranked-tools"><button type="button" onClick={() => setDialog("info")}><BookOpen size={16} />{gameUi(" Rank info")}</button><button type="button" onClick={() => setDialog("leaderboard")}><Trophy size={16} />{gameUi(" Leaderboard")}</button></div>
    {dialog === "info" && <AtlasRankGuide onClose={() => setDialog(null)} />}{dialog === "leaderboard" && <AtlasLeaderboard onClose={() => setDialog(null)} />}
    <div className="atlas-ranked-hero"><div className="atlas-ranked-hero-copy"><AtlasRankBadge rating={rating} deviation={profile?.deviation??350} matchesPlayed={profile?.matches_played??0} position={badges[0]?.leaderboard_rank} /><span className="atlas-eyebrow">{gameUi("Competitive Atlas · best of three")}</span><h2>{gameUi(profile && profile.matches_played < RANKED_CONFIG.provisionalMatches ? `Placement ${profile.matches_played} / ${RANKED_CONFIG.provisionalMatches}` : rank.displayName)}</h2><p>{gameUi(rank.provisional?(rank.tentative?`Tentative ${rank.displayName}`:"Finding your level"):rank.displayName)} · {gameUi(Math.round(rating))}{gameUi(" Rating")}</p><p className="atlas-setup-note">{gameUi("Knowledge, reasoning and strategic judgment · BO3 · target 8–12 minutes. Early ranks move quickly; higher ranks require stronger evidence across multiple series.")}</p><span className="atlas-ranked-summary">{gameUi("All ")}{gameUi(modes.length)}{gameUi(" modes in the draw · ban after matchmaking · most game wins takes the series")}</span></div>
      <div className="atlas-ranked-hero-action">{status === "waiting" ? <><span className="atlas-ranked-search">{gameUi("Searching for an opponent…")}</span><button type="button" className="atlas-start atlas-secondary" disabled={busy} onClick={() => void act("leave")}>{gameUi("Cancel queue")}</button></> : <button type="button" className="atlas-start" disabled={busy || !profile || !datasetVersion} onClick={() => void act("queue")}><Swords size={19} /><span>{gameUi("Queue Ranked")}</span></button>}</div>
    </div>
    <div className="atlas-ranked-mode-preview" aria-label={gameUi("Modes in Ranked")}>{modes.map((mode) => { const Icon = MODE_ICONS[mode.id]; return <span key={mode.id} className={`trial-accent-${mode.accent}`} title={gameUi(mode.title)} aria-label={gameUi(mode.title)}><Icon aria-hidden /><span>{gameUi(mode.title)}</span></span>; })}</div>
    {error && <p className="atlas-multiplayer-error" role="alert">{gameUi(error)}</p>}
  </section>;
}
