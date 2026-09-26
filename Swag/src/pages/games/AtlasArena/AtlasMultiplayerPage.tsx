import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Check, Clock3, Copy, Crown, FlaskConical, Flag, MapPin, Radio, Swords, Trophy, Users, Zap } from "lucide-react";
import { AtlasWorldMap } from "../../../components/atlas/AtlasWorldMap";
import { useAuth } from "../../../context/AuthContext";
import type { AtlasMatchStatus, AtlasMultiplayerMode } from "../../../games/atlas/multiplayer";
import type { AtlasDifficulty, AtlasQuestion, Coordinates } from "../../../games/atlas/types";
import { useAtlasData } from "../../../games/atlas/useAtlasData";
import { supabase } from "../../../lib/supabase";
import "./atlas-arena.css";

type WithoutAnswer<T> = T extends unknown ? Omit<T, "answer"> : never;
type PublicQuestion = WithoutAnswer<AtlasQuestion>;
type Snapshot = {
  code: string; mode: AtlasMultiplayerMode; hostId: string; players: { id: string; name: string; ready: boolean }[]; seat: number;
  status: AtlasMatchStatus; datasetVersion: string; settings: { rounds: number; allowSteal?: boolean; difficulty: AtlasDifficulty };
  roundIndex: number; rounds: number; roundStartedAt: string | null; roundEndsAt: string | null; scores: Record<string, number>;
  ownership: Record<string, "player_a" | "player_b">; question: PublicQuestion | null; submitted: boolean; opponentSubmitted: boolean;
  roundResult: { winnerId?: string | null; entityId?: string; answer?: string | Coordinates; submissions?: { userId: string; correct: boolean; distanceKm?: number; responseMs: number }[] } | null; version: number;
};
const modeOptions: { id: AtlasMultiplayerMode; title: string; description: string; icon: typeof Swords }[] = [
  { id: "map_battle", title: "1v1 Map Battle", description: "The first accurate map click earns the best speed bonus.", icon: Swords },
  { id: "closest_wins", title: "Closest Wins", description: "Drop a pin anywhere; great-circle distance decides the round.", icon: MapPin },
  { id: "higher_lower", title: "Higher or Lower", description: "Compare sourced population and area observations.", icon: Zap },
  { id: "territory_battle", title: "Territory Battle", description: "Capture or steal countries across 20 rounds.", icon: Flag },
];
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : "Request failed.";

export default function AtlasMultiplayerPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const atlas = useAtlasData();
  const [mode, setMode] = useState<AtlasMultiplayerMode>("map_battle");
  const [difficulty, setDifficulty] = useState<AtlasDifficulty>("intermediate");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
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
    try { const created = await invoke({ op: "create", mode, difficulty, name }); navigate(`/games/atlas-arena/multiplayer/${created.code}`); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  };
  const join = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { const joined = await invoke({ op: "join", code, name }); navigate(`/games/atlas-arena/multiplayer/${joined.code}`); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  };

  if (authLoading || atlas.loading) return <main className="atlas-page atlas-center"><Radio /><h1>Joining realtime…</h1></main>;
  if (!user) return <main className="atlas-page atlas-center"><Users /><h1>Sign in to duel</h1><p>Atlas rooms use your Pluto account to reserve your seat and restore matches after reconnecting.</p><Link className="atlas-start" to="/login">Sign in</Link></main>;
  if (!atlas.data || atlas.error) return <main className="atlas-page atlas-center"><h1>Atlas unavailable</h1><p>{atlas.error}</p></main>;
  if (!roomCode) return <MultiplayerLobby mode={mode} setMode={setMode} difficulty={difficulty} setDifficulty={setDifficulty} code={code} setCode={setCode} busy={busy} error={error} onCreate={create} onJoin={join} />;
  if (!room) return <main className="atlas-page atlas-center"><Radio /><h1>Restoring arena…</h1>{error && <p role="alert">{error}</p>}</main>;

  const player = room.players[room.seat], opponent = room.players[room.seat === 0 ? 1 : 0];
  const opponentOnline = Boolean(opponent && onlineIds.includes(opponent.id));
  const countdown = room.roundStartedAt ? Math.max(0, Math.ceil((Date.parse(room.roundStartedAt) - now) / 1000)) : 0;
  const remaining = room.roundEndsAt ? Math.max(0, (Date.parse(room.roundEndsAt) - now) / 1000) : 0;
  const active = room.status === "round_active" && !room.submitted && !busy;
  const winningPlayer = room.status === "finished" ? [...room.players].sort((left, right) => (room.scores[right.id] || 0) - (room.scores[left.id] || 0))[0] : null;
  const correctId = room.roundResult?.entityId || null;
  const ownership = room.ownership;

  if (room.status === "waiting" || room.status === "ready") {
    return <main className="atlas-page atlas-center atlas-room-page"><span className="atlas-eyebrow">Private arena · realtime link active</span><h1>Room {room.code}</h1><p className="atlas-room-intro">{opponent ? opponentOnline ? "Both explorers are here. Confirm readiness to initialize the match." : "Your opponent is reconnecting. Their seat remains reserved." : "Share this code to invite one explorer into the arena."}</p><section className="atlas-room-card" aria-label="Room matchup"><div className="atlas-room-card-header"><span>Match protocol</span><button type="button" onClick={() => void navigator.clipboard.writeText(room.code)}><Copy size={15} /> Copy code</button></div><div className="atlas-matchup"><RoomPlayer player={player} label="You" online readyAction={!player.ready && Boolean(opponent)} busy={busy} onReady={() => void act({ op: "ready", code: room.code })} /><div className="atlas-versus" aria-label="versus"><i />VS<i /></div><RoomPlayer player={opponent} label="Opponent" online={opponentOnline} waiting={!opponent} /></div><div className="atlas-science-note"><FlaskConical size={18} /><p><strong>Scientific note</strong> Closest Wins ranks pins by great-circle distance (Haversine); a pin inside the target country scores a precise 0 km.</p></div></section><button type="button" className="atlas-start atlas-ready-button" disabled={!opponent || player.ready || busy} onClick={() => void act({ op: "ready", code: room.code })}><Check /> {player.ready ? "Ready signal sent" : "Confirm ready"}</button>{error && <p role="alert">{error}</p>}<Link className="atlas-room-leave" to="/games/atlas-arena">Leave room</Link></main>;
  }

  if (room.status === "waiting" || room.status === "ready") return <main className="atlas-page atlas-center"><span className="atlas-eyebrow">Private arena</span><h1>Room {room.code}</h1><p>{opponent ? opponentOnline ? "Both explorers are here. Ready up when you are." : "Your opponent is reconnecting. Their seat is reserved." : "Share this code with one opponent."}</p><button type="button" className="atlas-start" onClick={() => void navigator.clipboard.writeText(room.code)}><Copy /> Copy room code</button><div className="atlas-result-grid"><div><strong>{player.name}</strong><span>{player.ready ? "Ready" : "Not ready"}</span></div><div><strong>{opponent?.name || "Waiting…"}</strong><span>{opponent ? opponentOnline ? opponent.ready ? "Ready · online" : "Online" : "Reconnecting" : "Opponent"}</span></div></div><button type="button" className="atlas-start" disabled={!opponent || player.ready || busy} onClick={() => void act({ op: "ready", code: room.code })}><Check /> {player.ready ? "Ready" : "I'm ready"}</button>{error && <p role="alert">{error}</p>}<Link to="/games/atlas-arena">Leave room</Link></main>;
  if (room.status === "countdown" || room.status === "next_round") return <main className="atlas-page atlas-center"><span className="atlas-eyebrow">{room.status === "countdown" ? "Match begins" : `Round ${room.roundIndex + 1}`}</span><h1>{countdown || "Go"}</h1><p>Both players receive the same server-generated round.</p></main>;
  if (room.status === "finished") return <main className="atlas-page atlas-center"><div className="atlas-result-orbit"><Crown /></div><span className="atlas-eyebrow">Final result</span><h1>{winningPlayer?.id === user.id ? "Victory" : `${winningPlayer?.name || "Opponent"} wins`}</h1><p className="atlas-result-score">{room.scores[user.id] || 0} <small>points</small></p><ScoreBoard room={room} /><div className="atlas-result-actions"><button type="button" onClick={() => void act({ op: "rematch", code: room.code })}>Rematch</button><Link to="/games/atlas-arena">Change mode</Link></div></main>;

  return <main className="atlas-game-page"><header className="atlas-game-header"><Link className="atlas-icon-button" to="/games/atlas-arena" aria-label="Exit room">×</Link><div><span className="atlas-eyebrow">{modeOptions.find((item) => item.id === room.mode)?.title}</span><strong>Round {room.roundIndex + 1} / {room.rounds}</strong></div><div className="atlas-game-stats"><span><Trophy size={16} />{room.scores[user.id] || 0}</span><span><Clock3 size={16} />{remaining.toFixed(1)}</span><span className="atlas-live"><i className={opponentOnline ? "" : "is-offline"} /> {opponentOnline ? opponent?.name : `${opponent?.name} reconnecting`}</span></div></header><section className="atlas-play-layout"><aside className="atlas-question-panel"><div className="atlas-progress"><i style={{ width: `${(room.roundIndex + 1) / room.rounds * 100}%` }} /></div><span className="atlas-eyebrow">{room.submitted ? "Answer locked" : room.question?.interaction.replace("_", " ")}</span><h1>{room.question?.prompt}</h1>{room.question?.interaction === "map_click" && room.question.flagAsset && <img className="atlas-question-flag" src={room.question.flagAsset} alt="Country flag to identify" />}{room.question?.interaction === "higher_lower" && <div className="atlas-higher-lower"><div><span>{room.question.stat.label}{room.question.stat.year ? ` · ${room.question.stat.year}` : ""}</span><strong>{new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(room.question.stat.firstValue)}</strong></div><div className="atlas-choice-grid"><button type="button" disabled={!active} onClick={() => void act({ op: "submit", code: room.code, answer: "higher" })}>Higher ↑</button><button type="button" disabled={!active} onClick={() => void act({ op: "submit", code: room.code, answer: "lower" })}>Lower ↓</button></div></div>}{room.submitted && room.status === "round_active" && <div className="atlas-feedback is-correct"><Check /><div><strong>Answer received</strong><span>{room.opponentSubmitted ? "Resolving…" : opponentOnline ? "Waiting for opponent…" : "Opponent can reconnect to answer."}</span></div></div>}{room.roundResult && <RoundResult room={room} userId={user.id} />}<ScoreBoard room={room} /></aside><AtlasWorldMap topology={atlas.data.topology} entities={atlas.data.countries} disabled={!active || room.question?.interaction === "higher_lower"} correctId={correctId} ownership={ownership} showHoverLabels={false} onSelect={(entityId) => room.question?.interaction !== "closest_click" && void act({ op: "submit", code: room.code, answer: entityId })} onPoint={(coordinates) => room.question?.interaction === "closest_click" && void act({ op: "submit", code: room.code, answer: coordinates })} ariaLabel={room.question?.prompt} /></section>{error && <p role="alert" className="atlas-multiplayer-error">{error}</p>}</main>;
}

function MultiplayerLobby({ mode, setMode, difficulty, setDifficulty, code, setCode, busy, error, onCreate, onJoin }: { mode: AtlasMultiplayerMode; setMode: (mode: AtlasMultiplayerMode) => void; difficulty: AtlasDifficulty; setDifficulty: (difficulty: AtlasDifficulty) => void; code: string; setCode: (code: string) => void; busy: boolean; error: string; onCreate: () => void; onJoin: (event: FormEvent) => void }) {
  return <main className="atlas-page"><Link className="atlas-back" to="/games/atlas-arena">← Atlas Arena</Link><section className="atlas-mode-section"><span className="atlas-eyebrow">Realtime 1v1</span><h1 className="atlas-lobby-title">Choose an arena</h1><div className="atlas-multiplayer-grid">{modeOptions.map(({ id, title, description, icon: Icon }) => <button type="button" className={`atlas-duel-card ${mode === id ? "active" : ""}`} key={id} onClick={() => setMode(id)}><Icon /><strong>{title}</strong><small>{description}</small></button>)}</div><div className="atlas-lobby-actions"><section><h2>Create room</h2><label>Difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as AtlasDifficulty)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="expert">Expert</option></select></label><button type="button" className="atlas-start" disabled={busy} onClick={onCreate}>Create {modeOptions.find((item) => item.id === mode)?.title}</button></section><form onSubmit={onJoin}><h2>Join by code</h2><label>Six-character invite code<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} minLength={6} required /></label><button className="atlas-start" disabled={busy}>Join room</button></form></div>{error && <p role="alert" className="atlas-multiplayer-error">{error}</p>}</section></main>;
}
function RoomPlayer({ player, label, online = false, waiting = false, readyAction = false, busy = false, onReady }: { player?: Snapshot["players"][number]; label: string; online?: boolean; waiting?: boolean; readyAction?: boolean; busy?: boolean; onReady?: () => void }) {
  const ready = Boolean(player?.ready);
  const state = waiting ? "Waiting for player" : ready ? "Ready" : online ? "Not ready" : "Reconnecting";
  return <article className={`atlas-room-player ${ready ? "is-ready" : "is-not-ready"} ${waiting ? "is-waiting" : ""}`}><span className="atlas-room-player-label">{label}</span><strong>{player?.name || "Open seat"}</strong><span className={`atlas-ready-check ${ready ? "is-ready" : "is-not-ready"}`} role="checkbox" aria-checked={ready}><i>{ready ? <Check size={13} /> : null}</i>{state}</span>{readyAction && <button type="button" disabled={busy} onClick={onReady}>Mark ready</button>}</article>;
}
function ScoreBoard({ room }: { room: Snapshot }) { return <div className="atlas-scoreboard">{room.players.map((player, index) => <div key={player.id}><span><i className={`player-${index}`} />{player.name}</span><strong>{room.scores[player.id] || 0}</strong></div>)}</div>; }
function RoundResult({ room, userId }: { room: Snapshot; userId: string }) { const mine = room.roundResult?.submissions?.find((item) => item.userId === userId); const won = room.roundResult?.winnerId === userId; const correct = Boolean(mine?.correct); return <div className={`atlas-feedback ${correct ? "is-correct" : "is-wrong"}`}>{won ? <Crown /> : <MapPin />}<div><strong>{won ? "Round won" : correct ? "Correct — opponent was faster" : room.roundResult?.winnerId ? "Opponent wins round" : "No winner"}</strong><span>{mine?.distanceKm !== undefined ? `${Math.round(mine.distanceKm).toLocaleString()} km away` : correct ? `${mine?.responseMs} ms` : "Incorrect answer"}</span></div></div>; }
