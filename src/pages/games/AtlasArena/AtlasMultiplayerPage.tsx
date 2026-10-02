import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowUpDown, Check, Clock3, Copy, Crown, FlaskConical, Flag, Lightbulb, MapPin, Play, Radio, Swords, Trophy, Users } from "lucide-react";
import { CountryGuessInput, FlagChoices, FlagPrompt, GuessClueList, HigherLowerCards } from "../../../components/atlas/AtlasPartyPanels";
import { AtlasWorldMap } from "../../../components/atlas/AtlasWorldMap";
import { useAuth } from "../../../context/AuthContext";
import type { GuessAward } from "../../../games/atlas/guessCountry";
import { maxPlayersFor, type AtlasMatchStatus, type AtlasMultiplayerMode } from "../../../games/atlas/multiplayer";
import type { AtlasDifficulty, AtlasQuestion, Coordinates } from "../../../games/atlas/types";
import { useAtlasData } from "../../../games/atlas/useAtlasData";
import { supabase } from "../../../lib/supabase";
import "./atlas-arena.css";

type WithoutAnswer<T> = T extends unknown ? Omit<T, "answer"> : never;
type PublicQuestion = WithoutAnswer<AtlasQuestion>;
type Snapshot = {
  code: string; mode: AtlasMultiplayerMode; hostId: string; players: { id: string; name: string; ready: boolean }[]; seat: number; maxPlayers?: number;
  status: AtlasMatchStatus; datasetVersion: string; settings: { rounds: number; allowSteal?: boolean; difficulty: AtlasDifficulty };
  roundIndex: number; rounds: number; tipIndex?: number; tipCount?: number; roundStartedAt: string | null; roundEndsAt: string | null; scores: Record<string, number>;
  ownership: Record<string, "player_a" | "player_b">; question: PublicQuestion | null; submitted: boolean; opponentSubmitted: boolean; submittedIds?: string[];
  guesses?: { userId: string; tip: number; answer: string; correct: boolean }[];
  roundResult: { winnerId?: string | null; entityId?: string; answer?: string | Coordinates; tip?: number; awards?: GuessAward[]; submissions?: { userId: string; answer?: string | Coordinates; correct: boolean; distanceKm?: number; responseMs: number }[] } | null; version: number;
};
const modeOptions: { id: AtlasMultiplayerMode; title: string; description: string; icon: typeof Swords }[] = [
  { id: "map_battle", title: "Map Battle", description: "The first accurate map click earns the best speed bonus.", icon: Swords },
  { id: "closest_wins", title: "Closest Wins", description: "Drop a pin anywhere; great-circle distance decides the round.", icon: MapPin },
  { id: "higher_lower", title: "Higher or Lower", description: "Countries, cities, continents and subregions — population, area, peaks and more.", icon: ArrowUpDown },
  { id: "flag_battle", title: "Flag Battle", description: "Name the flag, or pick the flag for a country outline. Fastest correct answer wins.", icon: Flag },
  { id: "guess_country", title: "Guess the Country", description: "A new tip each round. First to solve gets 3, others 2, plus early-tip bonuses.", icon: Lightbulb },
  { id: "territory_battle", title: "Territory Battle", description: "Capture or steal countries across 20 rounds. Two players.", icon: Flag },
];
/** Panel-only rounds: the world map has no role (or would give the answer away). */
const PANEL_ONLY: AtlasMultiplayerMode[] = ["higher_lower", "flag_battle"];
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : "Request failed.";

export default function AtlasMultiplayerPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const atlas = useAtlasData();
  const [mode, setMode] = useState<AtlasMultiplayerMode>("map_battle");
  const [difficulty, setDifficulty] = useState<AtlasDifficulty>("intermediate");
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
    if (invokeError) throw invokeError;
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
    try { const created = await invoke({ op: "create", mode, difficulty, name, maxPlayers: Math.min(playerCount, maxPlayersFor(mode)) }); navigate(`/games/atlas-arena/multiplayer/${created.code}`); }
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
  if (!roomCode) return <MultiplayerLobby mode={mode} setMode={setMode} difficulty={difficulty} setDifficulty={setDifficulty} playerCount={playerCount} setPlayerCount={setPlayerCount} code={code} setCode={setCode} busy={busy} error={error} onCreate={create} onJoin={join} />;
  if (!room) return <main className="atlas-page atlas-center"><Radio /><h1>Restoring arena…</h1>{error && <p role="alert">{error}</p>}</main>;

  const seats = room.maxPlayers ?? 2;
  const others = room.players.filter((player) => player.id !== user.id);
  const onlineOthers = others.filter((player) => onlineIds.includes(player.id));
  const countdown = room.roundStartedAt ? Math.max(0, Math.ceil((Date.parse(room.roundStartedAt) - now) / 1000)) : 0;
  const remaining = room.roundEndsAt ? Math.max(0, (Date.parse(room.roundEndsAt) - now) / 1000) : 0;
  const active = room.status === "round_active" && !room.submitted && !busy;
  const winningPlayer = room.status === "finished" ? [...room.players].sort((left, right) => (room.scores[right.id] || 0) - (room.scores[left.id] || 0))[0] : null;
  const correctId = room.roundResult?.entityId || null;
  const roundKey = `${room.roundIndex}:${room.tipIndex ?? 0}`;
  const submit = (answer: string | Coordinates) => { if (typeof answer === "string") setPick({ key: roundKey, answer }); void act({ op: "submit", code: room.code, answer }); };

  if (room.status === "waiting" || room.status === "ready") {
    const everyoneReady = room.players.length >= 2 && room.players.every((player) => player.ready);
    const isHost = room.hostId === user.id, me = room.players[room.seat];
    return <main className="atlas-page atlas-center atlas-room-page"><span className="atlas-eyebrow">Private arena · {modeOptions.find((item) => item.id === room.mode)?.title} · {seats} players</span><h1>Room {room.code}</h1>
      <p className="atlas-room-intro">{room.players.length < seats ? `Share this code — ${seats - room.players.length} seat${seats - room.players.length === 1 ? "" : "s"} open.${room.players.length >= 2 ? " The host can also start early once everyone present is ready." : ""}` : "Everyone is here. Confirm readiness to start the match."}</p>
      <section className="atlas-room-card" aria-label="Room seats"><div className="atlas-room-card-header"><span>Seats {room.players.length} / {seats}</span><button type="button" onClick={() => void navigator.clipboard.writeText(room.code)}><Copy size={15} /> Copy code</button></div>
        <div className={`atlas-seats seats-${seats}`}>{Array.from({ length: seats }, (_, index) => { const player = room.players[index]; const mine = player?.id === user.id; return <RoomPlayer key={player?.id ?? `open-${index}`} player={player} label={mine ? "You" : player?.id === room.hostId ? "Host" : `Player ${index + 1}`} online={mine || Boolean(player && onlineIds.includes(player.id))} waiting={!player} readyAction={mine && !player?.ready && room.players.length >= 2} busy={busy} onReady={() => void act({ op: "ready", code: room.code })} />; })}</div>
        {room.mode === "closest_wins" && <div className="atlas-science-note"><FlaskConical size={18} /><p><strong>Scientific note</strong> Closest Wins ranks pins by great-circle distance (Haversine); a pin inside the target country scores a precise 0 km.</p></div>}
        {room.mode === "guess_country" && <div className="atlas-science-note"><Lightbulb size={18} /><p><strong>Scoring</strong> One guess per tip. First correct guess: 3 points; everyone else who solves the same tip: 2. Solving on tip 1 adds +2, on tip 2 +1. A solved tip ends the country.</p></div>}
      </section>
      <button type="button" className="atlas-start atlas-ready-button" disabled={room.players.length < 2 || me.ready || busy} onClick={() => void act({ op: "ready", code: room.code })}><Check /> {me.ready ? "Ready signal sent" : "Confirm ready"}</button>
      {isHost && room.players.length < seats && <button type="button" className="atlas-start atlas-ready-button atlas-secondary" disabled={!everyoneReady || busy} onClick={() => void act({ op: "start", code: room.code })}><Play /> Start with {room.players.length} players</button>}
      {error && <p role="alert">{error}</p>}<Link className="atlas-room-leave" to="/games/atlas-arena">Leave room</Link></main>;
  }

  if (room.status === "countdown" || room.status === "next_round") return <main className="atlas-page atlas-center"><span className="atlas-eyebrow">{room.status === "countdown" ? "Match begins" : `Round ${room.roundIndex + 1}`}</span><h1>{countdown || "Go"}</h1><p>Every player receives the same server-generated round.</p></main>;
  if (room.status === "finished") return <main className="atlas-page atlas-center"><div className="atlas-result-orbit"><Crown /></div><span className="atlas-eyebrow">Final result</span><h1>{winningPlayer?.id === user.id ? "Victory" : `${winningPlayer?.name || "Opponent"} wins`}</h1><p className="atlas-result-score">{room.scores[user.id] || 0} <small>points</small></p><ScoreBoard room={room} /><div className="atlas-result-actions"><button type="button" onClick={() => void act({ op: "rematch", code: room.code })}>Rematch</button><Link to="/games/atlas-arena">Change mode</Link></div></main>;

  const question = room.question, resolved = Boolean(room.roundResult);
  const panelOnly = PANEL_ONLY.includes(room.mode);
  const myResult = room.roundResult?.submissions?.find((item) => item.userId === user.id);
  const myPick = pick?.key === roundKey ? pick.answer : typeof myResult?.answer === "string" ? myResult.answer : null;
  const guessId = guessSelection.key === roundKey ? guessSelection.id : null;
  const nameOf = (id?: string | null) => atlas.data!.countries.find((entity) => entity.id === id)?.shortName ?? id ?? "";
  const playerName = (id: string) => id === user.id ? "You" : room.players.find((player) => player.id === id)?.name ?? "Player";
  const waitingOn = room.players.filter((player) => !(room.submittedIds ?? []).includes(player.id)).length;
  return <main className="atlas-game-page"><header className="atlas-game-header"><Link className="atlas-icon-button" to="/games/atlas-arena" aria-label="Exit room">×</Link><div><span className="atlas-eyebrow">{modeOptions.find((item) => item.id === room.mode)?.title}</span><strong>{room.mode === "guess_country" ? `Country ${room.roundIndex + 1} / ${room.rounds} · Tip ${(room.tipIndex ?? 0) + 1}` : `Round ${room.roundIndex + 1} / ${room.rounds}`}</strong></div><div className="atlas-game-stats"><span><Trophy size={16} />{room.scores[user.id] || 0}</span><span><Clock3 size={16} />{remaining.toFixed(1)}</span><span className="atlas-live"><i className={onlineOthers.length === others.length ? "" : "is-offline"} /> {others.length === 1 ? (onlineOthers.length ? others[0].name : `${others[0].name} reconnecting`) : `${onlineOthers.length + 1}/${room.players.length} online`}</span></div></header>
    <section className={`atlas-play-layout ${panelOnly ? "is-panel-only" : ""}`}><aside className="atlas-question-panel"><div className="atlas-progress"><i style={{ width: `${(room.roundIndex + 1) / room.rounds * 100}%` }} /></div><span className="atlas-eyebrow">{room.submitted ? "Answer locked" : room.mode === "guess_country" ? `Tip ${(room.tipIndex ?? 0) + 1} of ${room.tipCount ?? 6}` : question?.interaction.replace("_", " ")}</span><h1>{question?.prompt}</h1>
      {question?.interaction === "map_click" && question.flagAsset && <img className="atlas-question-flag" src={question.flagAsset} alt="Country flag to identify" />}
      {question?.interaction === "higher_lower" && <HigherLowerCards key={question.id} question={question} revealed={resolved} disabled={!active} chosen={myPick} correct={resolved ? Boolean(myResult?.correct) : null} onAnswer={submit} />}
      {question?.interaction === "single_choice" && <><FlagPrompt question={question} topology={atlas.data.topology} /><FlagChoices question={question} disabled={!active} selected={myPick} correctId={typeof room.roundResult?.answer === "string" ? room.roundResult.answer : null} onAnswer={submit} /></>}
      {question?.interaction === "guess_country" && <>{!resolved && <CountryGuessInput entities={atlas.data.countries} selectedId={guessId} disabled={!active} excluded={(room.guesses ?? []).map((guess) => guess.answer)} onSelect={(id) => setGuessSelection({ key: roundKey, id })} onSubmit={(id) => submit(id)} />}
        {(room.guesses ?? []).filter((guess) => !guess.correct).length > 0 && <p className="atlas-guess-misses">{(room.guesses ?? []).filter((guess) => !guess.correct).map((guess) => `${playerName(guess.userId)}: not ${nameOf(guess.answer)}`).join(" · ")}</p>}
        <GuessClueList clues={question.clues} total={room.tipCount ?? question.clues.length} /></>}
      {room.submitted && room.status === "round_active" && <div className="atlas-feedback is-correct"><Check /><div><strong>Answer received</strong><span>{waitingOn ? `Waiting for ${waitingOn} more player${waitingOn === 1 ? "" : "s"}…` : "Resolving…"}</span></div></div>}
      {room.roundResult && (room.mode === "guess_country" ? <GuessResult room={room} userId={user.id} countryName={nameOf(room.roundResult.entityId)} playerName={playerName} /> : <RoundResult room={room} userId={user.id} />)}<ScoreBoard room={room} /></aside>
      {!panelOnly && <AtlasWorldMap topology={atlas.data.topology} entities={atlas.data.countries} disabled={!active} selectedId={room.mode === "guess_country" ? guessId : null} correctId={correctId} ownership={room.ownership} showHoverLabels={room.mode === "guess_country"} onSelect={(entityId) => { if (room.mode === "guess_country") setGuessSelection({ key: roundKey, id: entityId }); else if (question?.interaction !== "closest_click") submit(entityId); }} onPoint={(coordinates) => question?.interaction === "closest_click" && submit(coordinates)} ariaLabel={question?.prompt} />}
    </section>{error && <p role="alert" className="atlas-multiplayer-error">{error}</p>}</main>;
}

function MultiplayerLobby({ mode, setMode, difficulty, setDifficulty, playerCount, setPlayerCount, code, setCode, busy, error, onCreate, onJoin }: { mode: AtlasMultiplayerMode; setMode: (mode: AtlasMultiplayerMode) => void; difficulty: AtlasDifficulty; setDifficulty: (difficulty: AtlasDifficulty) => void; playerCount: number; setPlayerCount: (count: number) => void; code: string; setCode: (code: string) => void; busy: boolean; error: string; onCreate: () => void; onJoin: (event: FormEvent) => void }) {
  const limit = maxPlayersFor(mode);
  return <main className="atlas-page"><Link className="atlas-back" to="/games/atlas-arena">← Atlas Arena</Link><section className="atlas-mode-section"><span className="atlas-eyebrow">Realtime · 2–4 players</span><h1 className="atlas-lobby-title">Choose an arena</h1><div className="atlas-multiplayer-grid">{modeOptions.map(({ id, title, description, icon: Icon }) => <button type="button" className={`atlas-duel-card ${mode === id ? "active" : ""}`} key={id} onClick={() => setMode(id)}><Icon /><strong>{title}</strong><small>{description}</small></button>)}</div><div className="atlas-lobby-actions"><section><h2>Create room</h2><label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as AtlasDifficulty)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="expert">Expert</option></select></label><label>Players<div className="atlas-player-count" role="radiogroup" aria-label="Number of players">{[2, 3, 4].map((count) => <button type="button" role="radio" aria-checked={Math.min(playerCount, limit) === count} key={count} className={Math.min(playerCount, limit) === count ? "active" : ""} disabled={count > limit} onClick={() => setPlayerCount(count)}>{count}</button>)}</div></label><button type="button" className="atlas-start" disabled={busy} onClick={onCreate}>Create {modeOptions.find((item) => item.id === mode)?.title}</button></section><form onSubmit={onJoin}><h2>Join by code</h2><label>Six-character invite code<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} minLength={6} required /></label><button className="atlas-start" disabled={busy}>Join room</button></form></div>{error && <p role="alert" className="atlas-multiplayer-error">{error}</p>}</section></main>;
}
function RoomPlayer({ player, label, online = false, waiting = false, readyAction = false, busy = false, onReady }: { player?: Snapshot["players"][number]; label: string; online?: boolean; waiting?: boolean; readyAction?: boolean; busy?: boolean; onReady?: () => void }) {
  const ready = Boolean(player?.ready);
  const state = waiting ? "Waiting for player" : ready ? "Ready" : online ? "Not ready" : "Reconnecting";
  return <article className={`atlas-room-player ${ready ? "is-ready" : "is-not-ready"} ${waiting ? "is-waiting" : ""}`}><span className="atlas-room-player-label">{label}</span><strong>{player?.name || "Open seat"}</strong><span className={`atlas-ready-check ${ready ? "is-ready" : "is-not-ready"}`} role="checkbox" aria-checked={ready}><i>{ready ? <Check size={13} /> : null}</i>{state}</span>{readyAction && <button type="button" disabled={busy} onClick={onReady}>Mark ready</button>}</article>;
}
function ScoreBoard({ room }: { room: Snapshot }) { return <div className="atlas-scoreboard">{[...room.players].sort((left, right) => (room.scores[right.id] || 0) - (room.scores[left.id] || 0)).map((player) => <div key={player.id}><span><i className={`player-${room.players.indexOf(player)}`} />{player.name}</span><strong>{room.scores[player.id] || 0}</strong></div>)}</div>; }
function RoundResult({ room, userId }: { room: Snapshot; userId: string }) { const mine = room.roundResult?.submissions?.find((item) => item.userId === userId); const won = room.roundResult?.winnerId === userId; const correct = Boolean(mine?.correct); return <div className={`atlas-feedback ${correct ? "is-correct" : "is-wrong"}`}>{won ? <Crown /> : <MapPin />}<div><strong>{won ? "Round won" : correct ? "Correct — someone was faster" : room.roundResult?.winnerId ? `${room.players.find((player) => player.id === room.roundResult?.winnerId)?.name ?? "Opponent"} wins round` : "No winner"}</strong><span>{mine?.distanceKm !== undefined ? `${Math.round(mine.distanceKm).toLocaleString()} km away` : correct ? `${mine?.responseMs} ms` : mine ? "Incorrect answer" : "No answer"}</span></div></div>; }
/** The point addition after a solved (or abandoned) country: who solved it on which tip, and what they earned. */
function GuessResult({ room, userId, countryName, playerName }: { room: Snapshot; userId: string; countryName: string; playerName: (id: string) => string }) {
  const awards = room.roundResult?.awards ?? [], mine = awards.find((award) => award.userId === userId), tip = (room.roundResult?.tip ?? 0) + 1;
  return <div className={`atlas-guess-result ${mine ? "is-correct" : "is-wrong"}`}><strong>{awards.length ? `${countryName} — solved on tip ${tip}` : `Nobody got it: ${countryName}`}</strong>
    {awards.length > 0 && <ul>{awards.map((award) => <li key={award.userId}><span>{award.first && <Crown size={14} />}{playerName(award.userId)}</span><span>{award.base}{award.bonus ? ` + ${award.bonus} bonus` : ""}</span><b>+{award.total}</b></li>)}</ul>}
    {!mine && awards.length > 0 && <small>You didn’t solve this tip — no points this time.</small>}</div>;
}
