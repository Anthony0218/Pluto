import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Clock3, Copy, Crown, FlaskConical, Flag, Lightbulb, MapPin, Play, Radio, Shield, Swords, Timer, Trophy, Users } from "lucide-react";
import { CountryGuessInput, FlagChoices, FlagPrompt, GuessClueList, HigherLowerCards } from "../../../components/atlas/AtlasPartyPanels";
import { AtlasSoloGame, SoloSettingsForm } from "../../../components/atlas/AtlasSoloGame";
import { AtlasWorldMap } from "../../../components/atlas/AtlasWorldMap";
import { DuelBoard, DuelHistory } from "../../../components/atlas/trials/StatBattleDuel";
import { TRIAL_GAMES, useTrialPools } from "../../../components/atlas/trials/trialRegistry";
import { TrialSessionContext, type TrialSession } from "../../../components/atlas/trials/trialSession";
import { TrialShell } from "../../../components/atlas/trials/TrialsUI";
import { useAuth } from "../../../context/AuthContext";
import { COMPARISON_CATEGORIES, QUESTION_CATEGORIES, usesMapCategories } from "../../../games/atlas/categories";
import type { GuessAward } from "../../../games/atlas/guessCountry";
import { ARENA_MODES, modeForOnline } from "../../../games/atlas/modeCatalog";
import { getRankFromRating } from "../../../games/atlas/ranked";
import { isRaceMode, maxPlayersFor, type AtlasMatchStatus, type AtlasMultiplayerMode, type RaceEntry } from "../../../games/atlas/multiplayer";
import type { FillScope } from "../../../games/atlas/scopes";
import { DEFAULT_SOLO_SETTINGS, PLAYER_COLORS, settingsReady, type SoloSettings, type SoloSummary } from "../../../games/atlas/soloSettings";
import type { BattleView } from "../../../games/atlas/trials/battleMatch";
import { STAT_BATTLE } from "../../../games/atlas/trials/config";
import type { AtlasCategory, AtlasDataset, AtlasDifficulty, AtlasQuestion, AtlasStatKey, Coordinates } from "../../../games/atlas/types";
import { useAtlasData } from "../../../games/atlas/useAtlasData";
import { supabase } from "../../../lib/supabase";
import { MODE_ICONS, useArenaStore } from "./useArenaStore";
import "./atlas-arena.css";
import "../../../components/atlas/trials/atlas-trials.css";

type WithoutAnswer<T> = T extends unknown ? Omit<T, "answer"> : never;
type PublicQuestion = WithoutAnswer<AtlasQuestion>;
type Snapshot = {
  id: string; code: string; mode: AtlasMultiplayerMode; ranked: boolean; hostId: string; players: { id: string; name: string; ready: boolean }[]; seat: number; maxPlayers?: number;
  series?: { bans: Record<string, string[]>; order: AtlasMultiplayerMode[]; gameIndex: number; wins: Record<string, number>; results: { mode: AtlasMultiplayerMode; winnerId: string; scores: Record<string, number> }[] };
  status: AtlasMatchStatus; datasetVersion: string; settings: { rounds: number; allowSteal?: boolean; difficulty: AtlasDifficulty; categories?: AtlasCategory[]; stats?: AtlasStatKey[]; scope?: FillScope };
  roundIndex: number; rounds: number; tipIndex?: number; tipCount?: number; roundStartedAt: string | null; roundEndsAt: string | null; scores: Record<string, number>;
  ownership: Record<string, "player_a" | "player_b">; question: PublicQuestion | null; submitted: boolean; opponentSubmitted: boolean; submittedIds?: string[]; submittedAnswer?: string | Coordinates | null;
  guesses?: { userId: string; tip: number; answer: string; correct: boolean }[];
  roundResult: { winnerId?: string | null; entityId?: string; answer?: string | Coordinates; tip?: number; awards?: GuessAward[]; previousOwner?: string | null; submissions?: { userId: string; answer?: string | Coordinates; correct: boolean; distanceKm?: number; nearest?: Coordinates; responseMs: number }[] } | null; version: number;
  /** Races only: the shared seed every racer plays, and the live standings. */
  seed?: string; race?: Record<string, RaceEntry>;
  /** Stat Battle only: this seat's view of the card table. */
  battle?: BattleView;
};
const titleOf = (mode: AtlasMultiplayerMode) => modeForOnline(mode)?.title ?? mode;
type Invoke = (body: Record<string, unknown>) => Promise<Snapshot>;
/** Panel-only rounds: the world map has no role (or would give the answer away). */
const PANEL_ONLY: AtlasMultiplayerMode[] = ["higher_lower", "flag_battle"];
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : "Request failed.";

export default function AtlasMultiplayerPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const atlas = useAtlasData();
  const [searchParams] = useSearchParams();
  const requested = modeForOnline(searchParams.get("mode"));
  const [mode, setMode] = useState<AtlasMultiplayerMode>(requested?.online ?? "map_battle");
  const { stored, update } = useArenaStore();
  const settings = stored.settings;
  const [pinSelection, setPinSelection] = useState<{ key: string; coordinates: Coordinates } | null>(null);
  const [playerCount, setPlayerCount] = useState(2);
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  // The option this client picked, kept per round/tip so flag and higher/lower answers stay highlighted.
  const [pick, setPick] = useState<{ key: string; answer: string } | null>(null);
  const [guessSelection, setGuessSelection] = useState<{ key: string; id: string | null }>({ key: "", id: null });
  const name = profile?.display_name || profile?.username || user?.email?.split("@")[0] || "Explorer";
  const datasetVersion = atlas.data?.version.atlasDataVersion;

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error: invokeError } = await supabase.functions.invoke("atlas-match", { body: { ...body, datasetVersion } });
    if (invokeError) {
      // The function answers errors as JSON ({ error }); surface that message rather than the generic HTTP one.
      const context = (invokeError as { context?: Response }).context;
      const detail = context && typeof context.json === "function" ? await context.clone().json().catch(() => null) as { error?: string } | null : null;
      throw new Error(detail?.error ?? invokeError.message);
    }
    if (data?.error) throw new Error(String(data.error));
    return data as Snapshot;
  }, [datasetVersion]);
  const refresh = useCallback(async () => {
    if (!roomCode || !user || !datasetVersion) return;
    try { setRoom(await invoke({ op: "get", code: roomCode })); setError(""); } catch (cause) { setError(errorMessage(cause)); }
  }, [datasetVersion, invoke, roomCode, user]);

  useEffect(() => {
    if (!roomCode || !user || !datasetVersion) return;
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const channel = supabase.channel(`atlas-${roomCode}`, { config: { presence: { key: user.id } } })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "atlas_matches", filter: `room_code=eq.${roomCode.toUpperCase()}` }, () => void refresh())
      .on("presence", { event: "sync" }, () => setOnlineIds(Object.keys(channel.presenceState())))
      .subscribe((status) => { if (status === "SUBSCRIBED") void channel.track({ userId: user.id, connectedAt: new Date().toISOString() }); });
    const poll = window.setInterval(() => void refresh(), 1000);
    return () => { window.clearTimeout(initialRefresh); window.clearInterval(poll); void supabase.removeChannel(channel); };
  }, [datasetVersion, refresh, roomCode, user]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 100); return () => window.clearInterval(timer); }, []);

  const act = async (body: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true); setError("");
    try { setRoom(await invoke(body)); } catch (cause) { setError(errorMessage(cause)); await refresh(); } finally { setBusy(false); }
  };
  const create = async () => {
    setBusy(true); setError("");
    try { const created = await invoke({ op: "create", mode, difficulty: settings.difficulty, name, maxPlayers: Math.min(playerCount, maxPlayersFor(mode)), ...(usesMapCategories(mode) ? { categories: settings.categories } : {}), ...(mode === "higher_lower" ? { stats: settings.stats } : {}), ...(mode === "map_fill" ? { scope: settings.scope } : {}) }); navigate(`/games/atlas-arena/multiplayer/${created.code}`); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  };
  const join = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { const joined = await invoke({ op: "join", code, name }); navigate(`/games/atlas-arena/multiplayer/${joined.code}`); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  };

  if (authLoading || atlas.loading) return <main className="atlas-page atlas-center"><Radio /><h1>Joining realtime…</h1></main>;
  if (!user) return <main className="atlas-page atlas-center"><Users /><h1>Sign in to play</h1><p>Atlas rooms use your Pluto account to reserve your seat and restore matches after reconnecting.</p><Link className="atlas-start" to="/login">Sign in</Link></main>;
  if (!atlas.data || atlas.error) return <main className="atlas-page atlas-center"><h1>Atlas unavailable</h1><p>{atlas.error}</p></main>;
  if (!roomCode) return <MultiplayerLobby mode={mode} setMode={setMode} fixed={Boolean(requested)} settings={settings} setSettings={(next) => update({ settings: next })} playerCount={playerCount} setPlayerCount={setPlayerCount} code={code} setCode={setCode} busy={busy} error={error} onCreate={create} onJoin={join} />;
  if (!room) return <main className="atlas-page atlas-center"><Radio /><h1>Restoring arena…</h1>{error && <p role="alert">{error}</p>}</main>;
  if (room.status === "cancelled") return <main className="atlas-page atlas-center"><Shield /><h1>Match cancelled</h1><p>The match ended before play began. No rating changed.</p><Link className="atlas-start" to="/games/atlas-arena?tab=ranked">Back to Ranked</Link></main>;

  const seats = room.maxPlayers ?? 2;
  const others = room.players.filter((player) => player.id !== user.id);
  const onlineOthers = others.filter((player) => onlineIds.includes(player.id));
  const countdown = room.roundStartedAt ? Math.max(0, Math.ceil((Date.parse(room.roundStartedAt) - now) / 1000)) : 0;
  const remaining = room.roundEndsAt ? Math.max(0, (Date.parse(room.roundEndsAt) - now) / 1000) : 0;
  const active = room.status === "round_active" && !room.submitted && !busy;
  const leaders = room.players.filter((player) => (room.scores[player.id] || 0) === Math.max(...room.players.map((item) => room.scores[item.id] || 0)));
  const winningPlayer = leaders.length === 1 ? leaders[0] : null;
  const correctId = room.roundResult?.entityId || null;
  const roundKey = `${room.question?.id}:${room.roundIndex}:${room.tipIndex ?? 0}`;
  const submit = (answer: string | Coordinates) => { if (typeof answer === "string") setPick({ key: roundKey, answer }); void act({ op: "submit", code: room.code, answer }); };

  if (room.status === "draft") return <main className="atlas-page atlas-center"><Shield /><h1>Mode bans in progress</h1><p>Return to Ranked to lock your bans before entering the room.</p><Link className="atlas-start" to="/games/atlas-arena?tab=ranked">Choose bans</Link></main>;
  if (room.status === "waiting" || room.status === "ready" || room.status === "intermission") {
    const everyoneReady = room.players.length >= 2 && room.players.every((player) => player.ready);
    const isHost = room.hostId === user.id, me = room.players[room.seat];
    return <main className="atlas-page atlas-center atlas-room-page"><span className="atlas-eyebrow">{room.ranked ? `Ranked · Game ${(room.series?.gameIndex ?? 0) + 1} of 3` : `Private arena · ${titleOf(room.mode)} · ${seats} players`}</span><h1>Room {room.code}</h1>
      <p className="atlas-room-intro">{room.ranked ? "The mode order is set. Confirm ready to play the next game; the first player with two game wins takes the match." : room.players.length < seats ? `Share this code — ${seats - room.players.length} seat${seats - room.players.length === 1 ? "" : "s"} open.${room.players.length >= 2 ? " The host can also start early once everyone present is ready." : ""}` : "Everyone is here. Confirm readiness to start the match."}</p>
      {room.series && <RankedSeries room={room} />}
      <section className="atlas-room-card" aria-label="Room seats"><div className="atlas-room-card-header"><span>Seats {room.players.length} / {seats}</span><button type="button" onClick={() => void navigator.clipboard.writeText(room.code)}><Copy size={15} /> Copy code</button></div>
        <div className={`atlas-seats seats-${seats}`}>{Array.from({ length: seats }, (_, index) => { const player = room.players[index]; const mine = player?.id === user.id; return <RoomPlayer key={player?.id ?? `open-${index}`} player={player} label={mine ? "You" : player?.id === room.hostId ? "Host" : `Player ${index + 1}`} online={mine || Boolean(player && onlineIds.includes(player.id))} waiting={!player} readyAction={mine && !player?.ready && room.players.length >= 2} busy={busy} onReady={() => void act({ op: "ready", code: room.code })} />; })}</div>
        {room.mode === "closest_wins" && <div className="atlas-science-note"><FlaskConical size={18} /><p><strong>Distance rule</strong> Place a pin anywhere and submit it. Country rounds count a pin inside the borders as 0 km; capital rounds count a pin within 20 km of the city center as 0 km. Outside the target, great-circle distance is measured. The closest pin wins; on an exact tie the earlier pin wins.</p></div>}
        {room.mode === "guess_country" && <div className="atlas-science-note"><Lightbulb size={18} /><p><strong>Scoring</strong> One guess per tip. First correct guess: 3 points; everyone else who solves the same tip: 2. Solving on tip 1 adds +2, on tip 2 +1. A solved tip ends the country.</p></div>}
        {room.mode === "territory_battle" && <div className="atlas-science-note"><Flag size={18} /><p><strong>Territory rules</strong> The fastest correct click captures a country. Countries return in the second half, when you can steal them. Most owned countries after {room.rounds} rounds wins.</p></div>}
        {isRaceMode(room.mode) && <div className="atlas-science-note"><Timer size={18} /><p><strong>Race</strong> Everyone plays exactly the same run at the same moment, each on their own screen. Live scores show who is ahead; the highest final score wins.{room.settings.scope ? ` Region: ${room.settings.scope}.` : ""}</p></div>}
        {room.mode === "stat_battle" && <div className="atlas-science-note"><Swords size={18} /><p><strong>Duel</strong> Both players lay one card face down each round; the better value for the category wins. First to {STAT_BATTLE.winTarget}. You have 30 seconds per card and three full-hand rerolls for the game.</p></div>}
        {(room.settings.categories || room.settings.stats) && <p className="atlas-setup-note">Categories: {(room.settings.stats ?? room.settings.categories ?? []).map((id) => [...COMPARISON_CATEGORIES, ...QUESTION_CATEGORIES].find((option) => option.id === id)?.label ?? id).join(", ")}</p>}
      </section>
      <button type="button" className="atlas-start atlas-ready-button" disabled={room.players.length < 2 || me.ready || busy} onClick={() => void act({ op: "ready", code: room.code })}><Check /> {me.ready ? "Ready signal sent" : "Confirm ready"}</button>
      {isHost && room.players.length < seats && <button type="button" className="atlas-start atlas-ready-button atlas-secondary" disabled={!everyoneReady || busy} onClick={() => void act({ op: "start", code: room.code })}><Play /> Start with {room.players.length} players</button>}
      {error && <p role="alert">{error}</p>}{room.ranked ? !room.series?.results.length && <button type="button" className="atlas-room-leave" onClick={() => void act({ op: "cancel", code: room.code })}>Cancel before start</button> : <Link className="atlas-room-leave" to="/games/atlas-arena">Leave room</Link>}</main>;
  }

  if (room.status === "countdown" || room.status === "next_round") return <main className="atlas-page atlas-center"><span className="atlas-eyebrow">{room.status === "countdown" ? "Match begins" : `Round ${room.roundIndex + 1}`}</span><h1>{countdown || "Go"}</h1><p>Every player receives the same server-generated round.</p>{room.ranked && room.status === "countdown" && <button type="button" className="atlas-room-leave" onClick={() => void act({ op: "cancel", code: room.code })}>Cancel before start</button>}</main>;
  if (room.status === "finished") return <main className="atlas-page atlas-center"><div className="atlas-result-orbit"><Crown /></div><span className="atlas-eyebrow">Final result · {room.ranked ? "Ranked match" : titleOf(room.mode)}</span><h1>{!winningPlayer ? "Draw" : winningPlayer.id === user.id ? "Victory" : `${winningPlayer.name} wins`}</h1><p className="atlas-result-score">{room.scores[user.id] || 0} <small>{room.ranked ? "game wins" : unitFor(room.mode)}</small></p>{room.series && <RankedSeries room={room} />}<ScoreBoard room={room} />
    {room.ranked && <RankedResult matchId={room.id} userId={user.id} />}
    {room.mode === "stat_battle" && room.battle && <DuelHistoryBlock room={room} data={atlas.data} />}
    <div className="atlas-result-actions">{!room.ranked && <button type="button" onClick={() => void act({ op: "rematch", code: room.code })}>Rematch</button>}<Link to={room.ranked ? "/games/atlas-arena?tab=ranked" : "/games/atlas-arena"}>{room.ranked ? "Back to Ranked" : "Change mode"}</Link></div></main>;
  if (isRaceMode(room.mode) && room.seed) return <RaceRoom key={room.seed} room={room} userId={user.id} data={atlas.data} invoke={invoke} onRoom={setRoom} busy={busy} onEnd={() => void act({ op: "finish", code: room.code })} />;
  if (room.mode === "stat_battle") return <DuelRoom room={room} data={atlas.data} busy={busy} remaining={remaining} error={error} onPlay={(card) => void act({ op: "play", code: room.code, card })} onReroll={() => void act({ op: "reroll", code: room.code })} />;

  const question = room.question, resolved = Boolean(room.roundResult);
  const panelOnly = PANEL_ONLY.includes(room.mode);
  const myResult = room.roundResult?.submissions?.find((item) => item.userId === user.id);
  const myPick = typeof room.submittedAnswer === "string" ? room.submittedAnswer : pick?.key === roundKey ? pick.answer : typeof myResult?.answer === "string" ? myResult.answer : null;
  const myPin = Array.isArray(room.submittedAnswer) ? room.submittedAnswer : pinSelection?.key === roundKey ? pinSelection.coordinates : Array.isArray(myResult?.answer) ? myResult.answer : null;
  const nameOf = (id?: string | null) => atlas.data!.countries.find((entity) => entity.id === id)?.shortName ?? id ?? "";
  const playerName = (id: string) => id === user.id ? "You" : room.players.find((player) => player.id === id)?.name ?? "Player";
  const pinColor = (id: string) => id === user.id ? "#ffd372" : ["#3196d3", "#be5ad4", "#f5c66c", "#4ade80"][room.players.findIndex((player) => player.id === id)] ?? "#a78bfa";
  // After the round every pin shows a measured line to the nearest point of the target country (none when inside it).
  const pins = room.mode === "closest_wins" ? resolved
    ? (room.roundResult?.submissions ?? []).filter((item) => Array.isArray(item.answer)).map((item) => ({ coordinates: item.answer as Coordinates, label: `${playerName(item.userId)} · ${Math.round(item.distanceKm ?? 0).toLocaleString()} km`, color: pinColor(item.userId), target: item.distanceKm ? item.nearest : undefined }))
    : myPin ? [{ coordinates: myPin, label: "Your pin", color: "#ffd372" }] : [] : [];
  const guessId = guessSelection.key === roundKey ? guessSelection.id : null;
  // Map Battle / Territory: keep the clicked country visible, and mark it red once a wrong click is revealed.
  const clickModes: AtlasMultiplayerMode[] = ["map_battle", "territory_battle"];
  const clickedId = clickModes.includes(room.mode) ? myPick : null;
  const wrongClickId = resolved && clickedId && myResult && !myResult.correct ? clickedId : null;
  const waitingOn = room.players.filter((player) => !(room.submittedIds ?? []).includes(player.id)).length;
  return <main className="atlas-game-page"><header className="atlas-game-header"><Link className="atlas-icon-button" to="/games/atlas-arena" aria-label="Exit room">×</Link><div><span className="atlas-eyebrow">{titleOf(room.mode)}</span><strong>{room.mode === "guess_country" ? `Country ${room.roundIndex + 1} / ${room.rounds} · Tip ${(room.tipIndex ?? 0) + 1}` : `Round ${room.roundIndex + 1} / ${room.rounds}`}</strong></div><div className="atlas-game-stats"><span><Trophy size={16} />{room.scores[user.id] || 0}</span><span><Clock3 size={16} />{remaining.toFixed(1)}</span><span className="atlas-live"><i className={onlineOthers.length === others.length ? "" : "is-offline"} /> {others.length === 1 ? (onlineOthers.length ? others[0].name : `${others[0].name} reconnecting`) : `${onlineOthers.length + 1}/${room.players.length} online`}</span></div></header>
    <section className={`atlas-play-layout ${panelOnly ? "is-panel-only" : ""}`}><aside className="atlas-question-panel"><div className="atlas-progress"><i style={{ width: `${(room.roundIndex + 1) / room.rounds * 100}%` }} /></div><span className="atlas-eyebrow">{room.submitted ? "Answer locked" : room.mode === "guess_country" ? `Tip ${(room.tipIndex ?? 0) + 1} of ${room.tipCount ?? 6}` : question?.interaction.replace("_", " ")}</span><h1>{question?.prompt}</h1>
      {(question?.interaction === "map_click" || question?.interaction === "closest_click") && question.flagAsset && <img className="atlas-question-flag" src={question.flagAsset} alt="Country flag to identify" />}
      {question?.interaction === "closest_click" && <div className="atlas-pin-controls"><p>{myPin ? `Your pin: ${Math.abs(myPin[1]).toFixed(2)}° ${myPin[1] >= 0 ? "N" : "S"}, ${Math.abs(myPin[0]).toFixed(2)}° ${myPin[0] >= 0 ? "E" : "W"}${room.submitted ? "" : " — click again to move it."}` : `Click anywhere to place a pin. ${question.targetRadiusKm ? "Within 20 km of the city center" : "Inside the country"} counts as 0 km.`}</p><button type="button" className="atlas-submit" disabled={!active || !myPin} onClick={() => myPin && submit(myPin)}><MapPin size={18} />{room.submitted ? "Pin locked" : "Submit pin"}</button></div>}
      {room.mode === "territory_battle" && <p className="atlas-setup-note">Fastest correct click captures the country. Blue: {room.players[0]?.name} · Purple: {room.players[1]?.name}. Most owned countries wins.</p>}
      {question?.interaction === "higher_lower" && <HigherLowerCards key={question.id} question={question} revealed={resolved} disabled={!active} chosen={myPick} correct={resolved ? Boolean(myResult?.correct) : null} onAnswer={submit} />}
      {question?.interaction === "single_choice" && <><FlagPrompt question={question} topology={atlas.data.topology} /><FlagChoices question={question} disabled={!active} selected={myPick} correctId={typeof room.roundResult?.answer === "string" ? room.roundResult.answer : null} onAnswer={submit} /></>}
      {question?.interaction === "guess_country" && <>{!resolved && <CountryGuessInput entities={atlas.data.countries} selectedId={guessId} disabled={!active} excluded={(room.guesses ?? []).map((guess) => guess.answer)} onSelect={(id) => setGuessSelection({ key: roundKey, id })} onSubmit={(id) => submit(id)} />}
        {(room.guesses ?? []).filter((guess) => !guess.correct).length > 0 && <p className="atlas-guess-misses">{(room.guesses ?? []).filter((guess) => !guess.correct).map((guess) => `${playerName(guess.userId)}: not ${nameOf(guess.answer)}`).join(" · ")}</p>}
        <GuessClueList clues={question.clues} total={room.tipCount ?? question.clues.length} /></>}
      {room.submitted && room.status === "round_active" && <div className="atlas-feedback is-correct"><Check /><div><strong>Answer received</strong><span>{waitingOn ? `Waiting for ${waitingOn} more player${waitingOn === 1 ? "" : "s"}…` : "Resolving…"}</span></div></div>}
      {room.roundResult && (room.mode === "guess_country" ? <GuessResult room={room} userId={user.id} countryName={nameOf(room.roundResult.entityId)} playerName={playerName} /> : <RoundResult room={room} userId={user.id} countryName={nameOf(room.roundResult.entityId)} playerName={playerName} />)}<ScoreBoard room={room} /></aside>
      {!panelOnly && <AtlasWorldMap topology={atlas.data.topology} entities={atlas.data.countries} disabled={!active} selectedId={room.mode === "guess_country" ? guessId : clickedId} correctId={correctId} incorrectId={wrongClickId} ownership={room.ownership} pins={pins} showHoverLabels={room.mode === "guess_country"} onSelect={(entityId) => { if (room.mode === "guess_country") setGuessSelection({ key: roundKey, id: entityId }); else if (question?.interaction !== "closest_click") submit(entityId); }} onPoint={question?.interaction === "closest_click" ? (coordinates) => setPinSelection({ key: roundKey, coordinates }) : undefined} ariaLabel={question?.prompt} />}
    </section>{error && <p role="alert" className="atlas-multiplayer-error">{error}</p>}</main>;
}

function MultiplayerLobby({ mode, setMode, fixed, settings, setSettings, playerCount, setPlayerCount, code, setCode, busy, error, onCreate, onJoin }: { mode: AtlasMultiplayerMode; setMode: (mode: AtlasMultiplayerMode) => void; fixed: boolean; settings: SoloSettings; setSettings: (settings: SoloSettings) => void; playerCount: number; setPlayerCount: (count: number) => void; code: string; setCode: (code: string) => void; busy: boolean; error: string; onCreate: () => void; onJoin: (event: FormEvent) => void }) {
  const limit = maxPlayersFor(mode), def = modeForOnline(mode) ?? ARENA_MODES[0], Icon = MODE_ICONS[def.id];
  return <main className="atlas-page atlas-lobby"><Link className="atlas-back" to="/games/atlas-arena"><ArrowLeft size={18} /> Atlas Arena</Link><section className="atlas-mode-section">
    {fixed
      ? <header className={`atlas-lobby-mode trial-accent-${def.accent}`}><span className="trials-mode-icon"><Icon aria-hidden /></span><div><span className="atlas-eyebrow">Multiplayer · {limit === 2 ? "2 players" : `2–${limit} players`}</span><h1 className="atlas-lobby-title">{def.title}</h1><p>{def.rules.multiplayer}</p></div></header>
      : <><span className="atlas-eyebrow">Realtime · 2–4 players</span><h1 className="atlas-lobby-title">Choose an arena</h1>
        <div className="atlas-multiplayer-grid">{ARENA_MODES.map((item) => { const ItemIcon = MODE_ICONS[item.id]; return <button type="button" className={`atlas-duel-card ${mode === item.online ? "active" : ""}`} key={item.id} onClick={() => setMode(item.online)}><ItemIcon /><strong>{item.title}</strong><small>{item.tagline}</small></button>; })}</div></>}
    <div className="atlas-lobby-actions"><section><h2>Create room</h2>
      <SoloSettingsForm mode={def} settings={settings} onChange={setSettings} />
      <label className="atlas-label">Players</label>
      {limit > 2 ? <div className="atlas-player-count" role="radiogroup" aria-label="Number of players">{[2, 3, 4].map((count) => <button type="button" role="radio" aria-checked={Math.min(playerCount, limit) === count} key={count} className={Math.min(playerCount, limit) === count ? "active" : ""} onClick={() => setPlayerCount(count)}>{count}</button>)}</div>
        : <p className="atlas-setup-note">A two-player {mode === "stat_battle" ? "duel" : "battle"}.</p>}
      <button type="button" className="atlas-start" disabled={busy || !settingsReady(def, settings)} onClick={onCreate}>Create {def.title} room</button></section>
      <form onSubmit={onJoin}><h2>Join by code</h2><label>Six-character invite code<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} minLength={6} required /></label><button className="atlas-start" disabled={busy}>Join room</button></form></div>
    {error && <p role="alert" className="atlas-multiplayer-error">{error}</p>}</section></main>;
}
function RoomPlayer({ player, label, online = false, waiting = false, readyAction = false, busy = false, onReady }: { player?: Snapshot["players"][number]; label: string; online?: boolean; waiting?: boolean; readyAction?: boolean; busy?: boolean; onReady?: () => void }) {
  const ready = Boolean(player?.ready);
  const state = waiting ? "Waiting for player" : ready ? "Ready" : online ? "Not ready" : "Reconnecting";
  return <article className={`atlas-room-player ${ready ? "is-ready" : "is-not-ready"} ${waiting ? "is-waiting" : ""}`}><span className="atlas-room-player-label">{label}</span><strong>{player?.name || "Open seat"}</strong><span className={`atlas-ready-check ${ready ? "is-ready" : "is-not-ready"}`} role="checkbox" aria-checked={ready}><i>{ready ? <Check size={13} /> : null}</i>{state}</span>{readyAction && <button type="button" disabled={busy} onClick={onReady}>Mark ready</button>}</article>;
}
function RankedSeries({ room }: { room: Snapshot }) {
  const series = room.series;
  if (!series) return null;
  return <section className="atlas-series" aria-label="Ranked match series">
    <div className="atlas-series-players">{room.players.map((player) => <div key={player.id}><strong>{player.name}</strong><span>{series.wins[player.id] ?? 0} game wins</span><small>Banned: {(series.bans[player.id] ?? []).map((mode) => titleOf(mode as AtlasMultiplayerMode)).join(", ") || "None"}</small></div>)}</div>
    <ol className="atlas-series-order">{series.order.map((mode, index) => { const def = modeForOnline(mode), Icon = def ? MODE_ICONS[def.id] : Shield, result = series.results[index]; return <li key={mode} className={index === series.gameIndex && !result && room.status !== "finished" ? "is-current" : ""}><Icon aria-hidden /><span><small>Game {index + 1}</small><strong>{titleOf(mode)}</strong></span><em>{result ? `${room.players.find((player) => player.id === result.winnerId)?.name ?? "Player"} won` : room.status === "finished" ? "Not needed" : index === series.gameIndex ? "Up next" : "Pending"}</em></li>; })}</ol>
    <p>First to two game wins takes the competitive match. A tied game uses a seeded deciding draw.</p>
  </section>;
}
const unitFor = (mode: AtlasMultiplayerMode) => mode === "territory_battle" ? "countries" : mode === "stat_battle" ? "rounds" : "points";
function ScoreBoard({ room }: { room: Snapshot }) { return <div className="atlas-scoreboard">{[...room.players].sort((left, right) => (room.scores[right.id] || 0) - (room.scores[left.id] || 0)).map((player) => <div key={player.id}><span><i className={`player-${room.players.indexOf(player)}`} />{player.name}{room.race?.[player.id]?.done && <Check size={13} aria-label="finished" />}</span><strong>{(room.scores[player.id] || 0).toLocaleString("en")}{room.mode === "territory_battle" ? " countries" : room.mode === "stat_battle" ? " rounds" : ""}</strong></div>)}</div>; }
function RankedResult({ matchId, userId }: { matchId: string; userId: string }) {
  const [result, setResult] = useState<{ player_a: string; before_a: number; after_a: number; before_b: number; after_b: number } | null>(null);
  useEffect(() => {
    if (result) return;
    let live = true;
    const refresh = () => void supabase.from("atlas_ranked_results").select("player_a,before_a,after_a,before_b,after_b").eq("match_id", matchId).maybeSingle().then(({ data }) => { if (live && data) setResult(data); });
    refresh();
    const timer = window.setInterval(refresh, 2_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [matchId, result]);
  if (!result) return <p className="atlas-setup-note">Saving Ranked result…</p>;
  const mine = result.player_a === userId, before = mine ? result.before_a : result.before_b, after = mine ? result.after_a : result.after_b;
  const oldRank = getRankFromRating(before), newRank = getRankFromRating(after);
  return <div className="atlas-ranked-result"><strong>{newRank.displayName}</strong><span>{Math.round(before)} → {Math.round(after)} · {after >= before ? "+" : ""}{Math.round(after - before)} Rating</span>{oldRank.displayName !== newRank.displayName && <span>{oldRank.displayName} → {newRank.displayName}</span>}</div>;
}
function RoundResult({ room, userId, countryName, playerName }: { room: Snapshot; userId: string; countryName: string; playerName: (id: string) => string }) {
  const result = room.roundResult, mine = result?.submissions?.find((item) => item.userId === userId);
  const won = result?.winnerId === userId, correct = Boolean(mine?.correct), winner = result?.winnerId ? playerName(result.winnerId) : null;
  // Territory rounds read as captures: a winner either takes a free country, steals it, or defends their own.
  const territory = room.mode === "territory_battle" && winner
    ? result?.previousOwner && result.previousOwner !== result.winnerId ? `${winner === "You" ? "You stole" : `${winner} stole`} ${countryName}` : result?.previousOwner ? `${winner === "You" ? "You held" : `${winner} held`} ${countryName}` : `${winner === "You" ? "You captured" : `${winner} captured`} ${countryName}`
    : null;
  const headline = territory ?? (won ? "Round won" : correct ? room.mode === "closest_wins" ? "Another pin was closer" : "Correct — someone was faster" : winner ? `${winner} wins round` : room.mode === "territory_battle" ? `${countryName} stays ${result?.previousOwner ? "with its owner" : "neutral"}` : "No winner");
  const detail = mine?.distanceKm !== undefined ? mine.distanceKm < 0.5 ? `Inside ${countryName} — 0 km` : `${Math.round(mine.distanceKm).toLocaleString()} km from ${countryName}` : correct ? `${mine?.responseMs} ms` : mine ? `Incorrect — it was ${countryName}` : `No answer — it was ${countryName}`;
  return <div className={`atlas-feedback ${won || (correct && room.mode !== "closest_wins") ? "is-correct" : "is-wrong"}`}>{won ? <Crown /> : <MapPin />}<div><strong>{headline}</strong><span>{detail}</span></div></div>;
}
/** The point addition after a solved (or abandoned) country: who solved it on which tip, and what they earned. */
function GuessResult({ room, userId, countryName, playerName }: { room: Snapshot; userId: string; countryName: string; playerName: (id: string) => string }) {
  const awards = room.roundResult?.awards ?? [], mine = awards.find((award) => award.userId === userId), tip = (room.roundResult?.tip ?? 0) + 1;
  return <div className={`atlas-guess-result ${mine ? "is-correct" : "is-wrong"}`}><strong>{awards.length ? `${countryName} — solved on tip ${tip}` : `Nobody got it: ${countryName}`}</strong>
    {awards.length > 0 && <ul>{awards.map((award) => <li key={award.userId}><span>{award.first && <Crown size={14} />}{playerName(award.userId)}</span><span>{award.base}{award.bonus ? ` + ${award.bonus} bonus` : ""}</span><b>+{award.total}</b></li>)}</ul>}
    {!mine && awards.length > 0 && <small>You didn’t solve this tip — no points this time.</small>}</div>;
}

/**
 * A race: every player runs the same seeded game locally. The score is reported as it changes (throttled) and once
 * more, with `done`, when the run ends; the room finishes when everybody is done.
 */
function RaceRoom({ room, userId, data, invoke, onRoom, busy, onEnd }: { room: Snapshot; userId: string; data: AtlasDataset; invoke: Invoke; onRoom: (room: Snapshot) => void; busy: boolean; onEnd: () => void }) {
  const navigate = useNavigate();
  const def = modeForOnline(room.mode) ?? ARENA_MODES[0];
  const pools = useTrialPools(data, room.settings.difficulty);
  const [doneAtStart] = useState(() => Boolean(room.race?.[userId]?.done));
  const [showStandings, setShowStandings] = useState(false);
  const report = useRef({ score: 0, sent: -1, timer: null as number | null, final: false });
  const code = room.code;
  const send = useCallback(async (score: number, done: boolean) => onRoom(await invoke({ op: "progress", code, score, done })), [code, invoke, onRoom]);
  const flush = useCallback(() => {
    const state = report.current;
    state.timer = null;
    if (state.final || state.score === state.sent) return;
    const score = state.score;
    state.sent = score;
    send(score, false).catch(() => { if (state.sent === score) state.sent = -1; });
  }, [send]);
  const onScore = useCallback((score: number) => {
    const state = report.current;
    state.score = score;
    if (state.timer === null && !state.final) state.timer = window.setTimeout(flush, 1200);
  }, [flush]);
  // The final score must arrive, so it is retried; a run the room already counts as finished is left alone.
  const finish = useCallback(async (score: number) => {
    const state = report.current;
    if (state.final) return;
    state.final = true;
    if (state.timer !== null) window.clearTimeout(state.timer);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try { await send(score, true); return; }
      catch (cause) {
        if (cause instanceof Error && /already finished|not running/i.test(cause.message)) return;
        await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
      }
    }
  }, [send]);
  useEffect(() => { const state = report.current; return () => { if (state.timer !== null) window.clearTimeout(state.timer); }; }, []);
  const player = useMemo(() => ({ name: "You", color: PLAYER_COLORS[room.seat] ?? PLAYER_COLORS[0] }), [room.seat]);
  const session = useMemo<TrialSession>(() => ({ player, onScore, finish: { label: "See standings", onClick: () => setShowStandings(true) } }), [onScore, player]);
  const finishArena = useCallback((summary: SoloSummary) => { void finish(summary.score); setShowStandings(true); }, [finish]);
  const recordTrial = useCallback((score: number) => { void finish(score); }, [finish]);
  const leave = () => navigate("/games/atlas-arena");
  if (showStandings || doneAtStart) return <RaceStandings room={room} userId={userId} title={def.title} busy={busy} onEnd={onEnd} />;
  const settings: SoloSettings = { difficulty: room.settings.difficulty, categories: room.settings.categories ?? DEFAULT_SOLO_SETTINGS.categories, stats: room.settings.stats ?? DEFAULT_SOLO_SETTINGS.stats, scope: room.settings.scope ?? DEFAULT_SOLO_SETTINGS.scope };
  const seed = room.seed!;
  if (def.solo.kind === "arena") return <><AtlasSoloGame key={seed} data={data} mode={def.solo.mode} settings={settings} seed={seed} title={`${def.title} · Race`} player={player} onScore={onScore} onFinish={finishArena} onExit={leave} /><RaceTicker room={room} userId={userId} /></>;
  if (!pools) return null;
  const { component: Game, fullPool } = TRIAL_GAMES[def.solo.trial];
  return <TrialSessionContext.Provider value={session}>
    <Game key={seed} pool={fullPool ? pools.full : pools.difficulty} byId={pools.byId} seed={seed} difficulty={room.settings.difficulty} best={0} onRecord={recordTrial} onRestart={() => setShowStandings(true)} onExit={leave} />
    <RaceTicker room={room} userId={userId} />
  </TrialSessionContext.Provider>;
}

/** Live scores of the other racers, pinned to a corner while you play. */
function RaceTicker({ room, userId }: { room: Snapshot; userId: string }) {
  const others = room.players.filter((player) => player.id !== userId);
  return <aside className="atlas-race-ticker" aria-label="Live race scores"><span className="atlas-eyebrow">Live</span>
    {others.map((player) => { const entry = room.race?.[player.id]; return <span key={player.id} style={{ "--player": PLAYER_COLORS[room.players.indexOf(player)] } as CSSProperties}><i />{player.name}<b>{(entry?.score ?? 0).toLocaleString("en")}</b>{entry?.done && <Flag size={12} aria-label="finished" />}</span>; })}
  </aside>;
}

function RaceStandings({ room, userId, title, busy, onEnd }: { room: Snapshot; userId: string; title: string; busy: boolean; onEnd: () => void }) {
  const ranked = [...room.players].sort((left, right) => (room.race?.[right.id]?.score ?? 0) - (room.race?.[left.id]?.score ?? 0));
  const racing = room.players.filter((player) => !room.race?.[player.id]?.done).length;
  return <main className="atlas-page atlas-center"><div className="atlas-result-orbit"><Timer /></div><span className="atlas-eyebrow">{title} · race</span>
    <h1>{racing ? "Waiting for the others" : "Everyone has finished"}</h1>
    <p>{racing ? `${racing} player${racing === 1 ? " is" : "s are"} still racing. Scores update live.` : "Tallying the final standings…"}</p>
    <ol className="atlas-standings">{ranked.map((player, index) => { const entry = room.race?.[player.id]; return <li key={player.id} className={index === 0 ? "is-winner" : ""} style={{ "--player": PLAYER_COLORS[room.players.indexOf(player)] } as CSSProperties}>
      <b>{index + 1}</b><span><i />{player.id === userId ? "You" : player.name}<small>{entry?.done ? "Finished" : "Racing…"}</small></span><strong>{(entry?.score ?? 0).toLocaleString("en")} <small>points</small></strong></li>; })}</ol>
    {!room.ranked && room.hostId === userId && racing > 0 && <button type="button" className="atlas-start atlas-secondary atlas-race-end" disabled={busy} onClick={onEnd}>End race now</button>}
    <Link className="atlas-room-leave" to="/games/atlas-arena">Leave room</Link></main>;
}

/** Stat Battle online: you see your own hand; the opponent's card stays face down until both are played. */
function DuelRoom({ room, data, busy, remaining, error, onPlay, onReroll }: { room: Snapshot; data: AtlasDataset; busy: boolean; remaining: number; error: string; onPlay: (card: string) => void; onReroll: () => void }) {
  const navigate = useNavigate();
  const pools = useTrialPools(data, "expert");
  const view = room.battle;
  if (!pools || !view) return <main className="atlas-page atlas-center"><Radio /><h1>Dealing cards…</h1></main>;
  const them = room.players[room.seat === 0 ? 1 : 0];
  const revealed = room.status === "round_resolving";
  return <TrialShell title="Stat Battle · Online" accent="amber" roundLabel={`Round ${view.round} · first to ${STAT_BATTLE.winTarget}`} progress={Math.max(view.myScore, view.theirScore) / STAT_BATTLE.winTarget * 100} onExit={() => navigate("/games/atlas-arena")} wide>
    <div className="duel-scoreline" aria-label="Score"><span className="is-player">You <b>{view.myScore}</b></span><span>–</span><span className="is-opponent"><b>{view.theirScore}</b> {them?.name}</span></div>
    <DuelBoard byId={pools.byId} categoryId={view.categoryId} me={{ name: "You", score: view.myScore }} them={{ name: them?.name ?? "Opponent", score: view.theirScore }}
      hand={view.hand} opponentCards={view.opponentCards} deck={view.deck} picked={revealed ? null : view.picked} opponentPicked={!revealed && view.opponentPicked} played={revealed ? view.played : null}
      canPlay={room.status === "round_active" && !view.picked && !busy} onPlay={onPlay} rerollsLeft={view.rerollsLeft} onReroll={onReroll}
      hint={view.picked ? `Card down — waiting for ${them?.name ?? "your opponent"}…` : `${Math.ceil(remaining)}s to play a card, or your first card is played for you`} />
    {error && <p role="alert" className="atlas-multiplayer-error">{error}</p>}
  </TrialShell>;
}

function DuelHistoryBlock({ room, data }: { room: Snapshot; data: AtlasDataset }) {
  const pools = useTrialPools(data, "expert");
  if (!pools || !room.battle?.history.length) return null;
  return <DuelHistory history={room.battle.history} byId={pools.byId} names={["You", room.players[room.seat === 0 ? 1 : 0]?.name ?? "Opponent"]} />;
}
