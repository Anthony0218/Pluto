import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { AtlasFitContent } from "../../../components/atlas/AtlasFitContent";
import { AtlasSeriesIntermission } from "../../../components/atlas/AtlasSeriesIntermission";
import { AtlasResultHero } from "../../../components/atlas/AtlasResultHero";
import InviteFriendButton from "@/components/chess/InviteFriendButton";
import { ArenaQuestionInput } from "../../../components/atlas/ArenaQuestionInput";
import type { RaceView } from "../../../games/atlas/serverRace";
import type { PublicQuestion } from "../../../games/atlas/publicQuestion";
import { focusForScope } from "../../../games/atlas/scopes";
import { recordCreatedGameInvite } from "@/components/social/GameInviteDelivery";
import { useInviteAutoCreate } from "@/hooks/useInviteAutoCreate";
import AtlasAreaReference from "@/components/atlas/AtlasAreaReference";
import { areaValuesFromText } from "@/games/atlas/areaReferences";
import AtlasRankBadge from "@/components/atlas/AtlasRankBadge";
import { useAtlasRanks, type AtlasRankRow } from "@/games/atlas/useAtlasRanks";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Clock3, Copy, Crown, FlaskConical, Flag, Lightbulb, MapPin, Play, Radio, Shield, Swords, Timer, Trophy, Users } from "lucide-react";
import { CountryGuessInput, FlagChoices, FlagPrompt, GuessClueList, HigherLowerCards } from "../../../components/atlas/AtlasPartyPanels";
import { SoloSettingsForm } from "../../../components/atlas/AtlasSoloGame";
import { AtlasWorldMap, type AtlasMapSelectionControl } from "../../../components/atlas/AtlasWorldMap";
import AtlasMapConfirm from "../../../components/atlas/AtlasMapConfirm";
import { DuelBoard, DuelHistory } from "../../../components/atlas/trials/StatBattleDuel";
import { useTrialPools } from "../../../components/atlas/trials/trialRegistry";
import { TrialShell } from "../../../components/atlas/trials/TrialsUI";
import { useAuth } from "../../../context/AuthContext";
import { COMPARISON_CATEGORIES, QUESTION_CATEGORIES, usesMapCategories } from "../../../games/atlas/categories";
import type { GuessAward } from "../../../games/atlas/guessCountry";
import { ARENA_MODES, ONLINE_ARENA_MODES, isOnlineMode, modeForOnline } from "../../../games/atlas/modeCatalog";
import { seriesLabel, seriesLength } from "../../../games/atlas/randomSeries";
import { getRankFromProfile } from "../../../games/atlas/ranked";
import { ATLAS_MAX_PLAYERS, isRaceMode, type AtlasMatchStatus, type AtlasMultiplayerMode, type RaceEntry } from "../../../games/atlas/multiplayer";
import type { FillScope } from "../../../games/atlas/scopes";
import { DEFAULT_SOLO_SETTINGS, PLAYER_COLORS, settingsReady, type SoloSettings } from "../../../games/atlas/soloSettings";
import type { BattleView } from "../../../games/atlas/trials/battleMatch";
import type { TableView } from "../../../games/atlas/trials/battleTable";
import { TableBoard, TableHistory, TableScoreline } from "../../../components/atlas/trials/StatBattleTable";
import { STAT_BATTLE } from "../../../games/atlas/trials/config";
import type { AtlasCategory, AtlasDataset, AtlasDifficulty, AtlasStatKey, Coordinates } from "../../../games/atlas/types";
import { useAtlasData } from "../../../games/atlas/useAtlasData";
import { supabase } from "../../../lib/supabase";
import { MODE_ICONS, useArenaStore } from "./useArenaStore";
import "./atlas-arena.css";
import "../../../components/atlas/trials/atlas-trials.css";

type Snapshot = {
  id: string; code: string; mode: AtlasMultiplayerMode; ranked: boolean; hostId: string; players: { id: string; name: string; ready: boolean }[]; seat: number; maxPlayers?: number;
  series?: { bans: Record<string, string[]>; order: AtlasMultiplayerMode[]; gameIndex: number; wins: Record<string, number>; results: { mode: AtlasMultiplayerMode; winnerId: string | null; scores: Record<string, number> }[] };
  status: AtlasMatchStatus; intermissionEndsAt?: string | null; datasetVersion: string; settings: { rounds: number; difficulty: AtlasDifficulty; categories?: AtlasCategory[]; stats?: AtlasStatKey[]; scope?: FillScope };
  roundIndex: number; rounds: number; tipIndex?: number; tipCount?: number; roundStartedAt: string | null; roundEndsAt: string | null; resolveAt?: string | null; scores: Record<string, number>;
  question: PublicQuestion | null; submitted: boolean; opponentSubmitted: boolean; submittedIds?: string[]; submittedAnswer?: string | Coordinates | null;
  guesses?: { userId: string; tip: number; answer: string; correct: boolean }[];
  roundResult: { winnerId?: string | null; entityId?: string; answer?: string | Coordinates; tip?: number; awards?: GuessAward[]; submissions?: { userId: string; answer?: string | Coordinates; correct: boolean; distanceKm?: number; nearest?: Coordinates; responseMs: number }[] } | null; version: number;
  /** Races only: the shared seed every racer plays, and the live standings. */
  run?: RaceView; race?: Record<string, RaceEntry>; tiebreak?:{attempt:number;mode:AtlasMultiplayerMode};
  /** Stat Battle only: this seat's view of the duel (two players) or of the card table (three or four). */
  battle?: BattleView; table?: TableView;
};
const titleOf = (mode: AtlasMultiplayerMode) => modeForOnline(mode)?.title ?? mode;
/** Panel-only rounds: the world map has no role (or would give the answer away). */
const PANEL_ONLY: AtlasMultiplayerMode[] = ["higher_lower", "flag_battle"];
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : "Request failed.";

export default function AtlasMultiplayerPage() {
  useGameLanguage();
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const atlas = useAtlasData();
  const [searchParams] = useSearchParams();
  const autoJoined = useRef(false);
  const wantsJoin = searchParams.get("join") === "1";
  const requestedMode = modeForOnline(searchParams.get("mode"));
  const requested = requestedMode && isOnlineMode(requestedMode) ? requestedMode : undefined;
  const randomBestOf = searchParams.get("random") === "1" ? seriesLength(searchParams.get("bestOf")) : undefined;
  const [mode, setMode] = useState<AtlasMultiplayerMode>(requested?.online ?? "map_battle");
  const { stored, update } = useArenaStore();
  const settings = randomBestOf ? { ...stored.settings, categories: stored.settings.categories.length ? stored.settings.categories : DEFAULT_SOLO_SETTINGS.categories, stats: stored.settings.stats.length ? stored.settings.stats : DEFAULT_SOLO_SETTINGS.stats } : stored.settings;
  const [pinSelection, setPinSelection] = useState<{ key: string; coordinates: Coordinates } | null>(null);
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<Snapshot | null>(null);
  const [pendingMap, setPendingMap] = useState<{ id: string; label: string } | null>(null);
  const mapSelection = useRef<AtlasMapSelectionControl>(null);
  const { rows: ranks } = useAtlasRanks(room?.players.map(player => player.id) ?? (user ? [user.id] : []));
  const [busy, setBusy] = useState(false);
  const busyRef=useRef(false);
  const roomCodeRef=useRef(roomCode);
  useEffect(() => { roomCodeRef.current = roomCode; }, [roomCode]);
  const acceptRoom=useCallback((next:Snapshot)=>{ if(next.code!==roomCodeRef.current)return;setRoom(old=>old?.id===next.id&&old.version>next.version?old:next); },[]);
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
    try { acceptRoom(await invoke({ op: wantsJoin && !autoJoined.current ? "join" : "get", code: roomCode, name })); autoJoined.current = true; setError(""); } catch (cause) { setError(errorMessage(cause)); }
  }, [datasetVersion, invoke, roomCode, user, wantsJoin, name, acceptRoom]);

  useEffect(() => {
    if (!roomCode || !user || !datasetVersion) return;
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const poll = window.setInterval(() => void refresh(), 1000);
    return () => { window.clearTimeout(initialRefresh); window.clearInterval(poll); };
  }, [datasetVersion, refresh, roomCode, user]);
  // Who is connected. The channel is private: the database only lets players seated in this arena join it,
  // so it is opened once the room confirms the seat.
  const seated = !!user && !!room && room.code === roomCode && room.players.some((player) => player.id === user.id);
  useEffect(() => {
    if (!roomCode || !user || !seated) return;
    const channel = supabase.channel(`atlas-${roomCode}`, { config: { private: true, presence: { key: user.id } } })
      .on("presence", { event: "sync" }, () => setOnlineIds(Object.keys(channel.presenceState())))
      .subscribe((status) => { if (status === "SUBSCRIBED") void channel.track({ userId: user.id, connectedAt: new Date().toISOString() }); });
    return () => { void supabase.removeChannel(channel); };
  }, [roomCode, seated, user]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 100); return () => window.clearInterval(timer); }, []);

  const act = async (body: Record<string, unknown>) => {
    if (busyRef.current) return;
    busyRef.current=true;setBusy(true); setError("");
    const requestId=crypto.randomUUID();
    try { acceptRoom(await invoke({...body,requestId})); } catch (cause) { setError(errorMessage(cause)); await refresh(); } finally { busyRef.current=false;setBusy(false); }
  };
  const create = async () => {
    setBusy(true); setError("");
    try { const created = await invoke({ op: "create", mode, ...(randomBestOf ? { randomBestOf } : {}), difficulty: settings.difficulty, name, ...(usesMapCategories(mode) || randomBestOf ? { categories: settings.categories } : {}), ...(mode === "higher_lower" || randomBestOf ? { stats: settings.stats } : {}), ...(mode === "map_fill" || randomBestOf ? { scope: settings.scope } : {}) }); navigate(recordCreatedGameInvite(`/games/atlas-arena/multiplayer/${created.code}`)); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  };
  useInviteAutoCreate(() => create(), !!datasetVersion);
  const join = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { const joined = await invoke({ op: "join", code, name }); navigate(`/games/atlas-arena/multiplayer/${joined.code}`); }
    catch (cause) { setError(errorMessage(cause)); } finally { setBusy(false); }
  };

  if (authLoading || atlas.loading) return <main className="atlas-page atlas-center"><AtlasFitContent><Radio /><h1>{gameUi("Joining realtime…")}</h1></AtlasFitContent></main>;
  if (!user) return <main className="atlas-page atlas-center"><AtlasFitContent><Users /><h1>{gameUi("Sign in to play")}</h1><p>{gameUi("Atlas rooms use your Pluto account to reserve your seat and restore matches after reconnecting.")}</p><Link className="atlas-start" to="/login">{gameUi("Sign in")}</Link></AtlasFitContent></main>;
  if (!atlas.data || atlas.error) return <main className="atlas-page atlas-center"><AtlasFitContent><h1>{gameUi("Atlas unavailable")}</h1><p>{gameUi(atlas.error)}</p></AtlasFitContent></main>;
  if (!roomCode) return <MultiplayerLobby randomBestOf={randomBestOf} mode={mode} setMode={setMode} fixed={Boolean(requested)} settings={settings} setSettings={(next) => update({ settings: next })} code={code} setCode={setCode} busy={busy} error={gameUi(error)} rank={ranks.find(row => row.user_id === user.id)} onCreate={create} onJoin={join} />;
  if (!room || room.code!==roomCode) return <main className="atlas-page atlas-center"><AtlasFitContent><Radio /><h1>{gameUi("Restoring arena…")}</h1>{error && <p role="alert">{gameUi(error)}</p>}</AtlasFitContent></main>;
  if (room.status === "cancelled") return <main className="atlas-page atlas-center"><AtlasFitContent><Shield /><h1>{gameUi("Match cancelled")}</h1><p>{gameUi("The match ended before play began. No rating changed.")}</p><Link className="atlas-start" to="/games/atlas-arena?tab=ranked">{gameUi("Back to Ranked")}</Link></AtlasFitContent></main>;

  const seats = room.maxPlayers ?? 2;
  const others = room.players.filter((player) => player.id !== user.id);
  const onlineOthers = others.filter((player) => onlineIds.includes(player.id));
  const countdown = room.roundStartedAt ? Math.max(0, Math.ceil((Date.parse(room.roundStartedAt) - now) / 1000)) : 0;
  const remaining = room.roundEndsAt ? Math.max(0, (Date.parse(room.roundEndsAt) - now) / 1000) : 0;
  // How long the solved country's tips and answer stay up before the next one.
  const revealLeft = room.resolveAt ? Math.max(0, (Date.parse(room.resolveAt) - now) / 1000) : null;
  const active = room.status === "round_active" && remaining > 0 && !room.submitted && !busy;
  const leaders = room.players.filter((player) => (room.scores[player.id] || 0) === Math.max(...room.players.map((item) => room.scores[item.id] || 0)));
  const winningPlayer = leaders.length === 1 ? leaders[0] : null;
  const correctId = room.roundResult?.entityId || null;
  const roundKey = `${room.question?.id}:${room.roundIndex}:${room.tipIndex ?? 0}`;
  const submit = (answer: string | Coordinates) => { if (typeof answer === "string") setPick({ key: roundKey, answer }); void act({ op: "submit", code: room.code, questionId: room.question?.id, answer }); };

  if (room.status === "draft") return <main className="atlas-page atlas-center"><AtlasFitContent><Shield /><h1>{gameUi("Mode bans in progress")}</h1><p>{gameUi("Return to Ranked to lock your bans before entering the room.")}</p><Link className="atlas-start" to="/games/atlas-arena?tab=ranked">{gameUi("Choose bans")}</Link></AtlasFitContent></main>;
  if (room.status === "intermission" && room.series) {
    const last = room.series.results.at(-1);
    const winner = room.players.find(player => player.id === last?.winnerId);
    return <main className="atlas-page atlas-center atlas-random-results"><AtlasFitContent>
      <AtlasResultHero key={room.series.results.length} eyebrow={`Game ${room.series.results.length} complete · ${last ? titleOf(last.mode) : ""}`} title={gameUi(winner ? `${winner.name} wins the game` : "Game drawn")} />
      <p className="atlas-result-score">{gameUi(room.players.map(player => last?.scores[player.id] ?? 0).join(" – "))} <small>{gameUi(last ? unitFor(last.mode) : "points")}</small></p>
      <AtlasSeriesIntermission players={room.players} userId={user.id} ranked={room.ranked} endsAt={room.intermissionEndsAt} now={now} gameNumber={room.series.gameIndex + 1} modeTitle={gameUi(titleOf(room.mode))} busy={busy} onReady={() => void act({ op: "ready", code: room.code })} />
      {error && <p role="alert">{gameUi(error)}</p>}
      {!room.ranked && <Link className="atlas-room-leave" to="/games/atlas-arena">{gameUi("Back to menu")}</Link>}
      <RankedSeries room={room} />
    </AtlasFitContent></main>;
  }
  if (room.status === "waiting" || room.status === "ready") {
    const everyoneReady = room.players.length >= 2 && room.players.every((player) => player.ready);
    const isHost = room.hostId === user.id, me = room.players[room.seat];
    // One seat per player who is going to play; the host sets how many with the 2 / 3 / 4 buttons.
    const openSeats = seats - room.players.length, open = openSeats > 0;
    const capacity = `${seats} players`;
    const hostName = room.players.find((player) => player.id === room.hostId)?.name ?? "The host";
    const invite = !open ? "Everyone is here. Confirm readiness to start the match."
      : `${openSeats} seat${openSeats === 1 ? "" : "s"} open — invite friends or share the code.${room.players.length >= 2 ? ` ${isHost ? "You" : hostName} can also start with ${room.players.length} once everyone here is ready.` : isHost && !room.ranked ? " Use 2 / 3 / 4 to set how many play." : ""}`;
    const seatPicker = room.ranked ? null : <SeatPicker seats={gameUi(seats)} taken={gameUi(room.players.length)} editable={isHost && !busy} onChange={(count) => void act({ op: "seats", code: room.code, seats: count })} />;
    return <main className="atlas-page atlas-center atlas-room-page"><AtlasFitContent><span className="atlas-eyebrow">{room.series ? `${room.ranked ? "Ranked" : "Random modes"} · Game ${room.series.gameIndex + 1} of ${room.series.order.length}${room.ranked ? "" : ` · ${capacity}`}` : `Private arena · ${titleOf(room.mode)} · ${capacity}`}</span><h1>{gameUi("Room ")}{room.code}</h1>
      <p className="atlas-room-intro">{room.series ? `The mode order is set. Confirm ready to play ${titleOf(room.mode)}; ${seriesLabel(room.series.order.length).toLowerCase()}, first to ${Math.floor(room.series.order.length / 2) + 1} game wins.${room.ranked || !open ? "" : ` ${invite}`}` : invite}</p>
      {room.series && <RankedSeries room={room} aside={seatPicker} />}
      <section className="atlas-room-card" aria-label={gameUi("Room seats")}><div className="atlas-room-card-header"><span>{gameUi("Seats ")}{gameUi(room.players.length)} / {gameUi(seats)}</span>{!room.series && seatPicker}<button type="button" onClick={() => void navigator.clipboard.writeText(room.code)}><Copy size={15} />{gameUi(" Copy code")}</button></div>
        <div className={`atlas-seats seats-${seats}`}>{Array.from({ length: seats }, (_, index) => { const player = room.players[index]; const mine = player?.id === user.id; return <RoomPlayer key={player?.id ?? `open-${index}`} player={player} rank={ranks.find(row => row.user_id === player?.id)} label={mine ? "You" : player?.id === room.hostId ? "Host" : `Player ${index + 1}`} online={mine || Boolean(player && onlineIds.includes(player.id))} waiting={!player} canInvite={!player && !room.ranked} readyAction={mine && !player?.ready && room.players.length >= 2} busy={busy} onReady={() => void act({ op: "ready", code: room.code })} />; })}</div>
        {room.mode === "closest_wins" && <div className="atlas-science-note"><FlaskConical size={18} /><p><strong>{gameUi("Distance rule")}</strong>{gameUi(" Place a pin anywhere and submit it. Country rounds count a pin inside the borders as 0 km; capital rounds count a pin within 20 km of the city center as 0 km. Outside the target, great-circle distance is measured. The closest pin wins; on an exact tie equally close pins share the point.")}</p></div>}
        {room.mode === "guess_country" && <div className="atlas-science-note"><Lightbulb size={18} /><p><strong>{gameUi("Scoring")}</strong>{gameUi(" One guess per tip. Each correct guess on the same tip: 3 points. Solving on tip 1 adds +2, on tip 2 +1. A solved tip ends the country.")}</p></div>}
        {isRaceMode(room.mode) && <div className="atlas-science-note"><Timer size={18} /><p><strong>{gameUi("Race")}</strong>{gameUi(" Everyone plays the same bounded deck, with answers scored and progress saved by the server. Review each answer before continuing. Highest final score wins.")}{gameUi(room.settings.scope ? ` Region: ${room.settings.scope}.` : "")}</p></div>}
        {room.mode === "stat_battle" && <div className="atlas-science-note"><Swords size={18} /><p><strong>{seats > 2 ? "Card table" : "Duel"}</strong> Everyone lays one card face down each round; the best value for the category wins, and a shared best scores nobody. First to {gameUi(STAT_BATTLE.winTarget)}{gameUi(". You have 30 seconds per card and three full-hand rerolls for the game.")}</p></div>}
        {(room.settings.categories || room.settings.stats) && <p className="atlas-setup-note">{gameUi("Categories: ")}{gameUi((room.settings.stats ?? room.settings.categories ?? []).map((id) => [...COMPARISON_CATEGORIES, ...QUESTION_CATEGORIES].find((option) => option.id === id)?.label ?? id).join(", "))}</p>}
      </section>
      <p className="atlas-ready-count" role="status">{gameUi(room.players.filter(player => player.ready).length)}/{gameUi(room.players.length)}{gameUi(" are ready")}</p>
      <button type="button" className="atlas-start atlas-ready-button" disabled={room.players.length < 2 || me.ready || busy} onClick={() => void act({ op: "ready", code: room.code })}><Check /> {gameUi(me.ready ? "Ready signal sent" : "Confirm ready")}</button>
      {isHost && open && !room.ranked && <button type="button" className="atlas-start atlas-ready-button atlas-secondary" disabled={!everyoneReady || busy} onClick={() => void act({ op: "start", code: room.code })}><Play /> {room.players.length < 2 ? "Start once a second player joins" : `Start with ${room.players.length} players`}</button>}
      {error && <p role="alert">{gameUi(error)}</p>}{room.ranked ? !room.series?.results.length && <button type="button" className="atlas-room-leave" onClick={() => void act({ op: "cancel", code: room.code })}>{gameUi("Cancel before start")}</button> : <Link className="atlas-room-leave" to="/games/atlas-arena">{gameUi("Leave room")}</Link>}</AtlasFitContent></main>;
  }

  if (room.status === "countdown" || room.status === "next_round") return <main className="atlas-page atlas-center"><AtlasFitContent><span className="atlas-eyebrow">{gameUi(room.status === "countdown" ? "Match begins" : `Round ${room.roundIndex + 1}`)}</span><h1>{gameUi(countdown || "Go")}</h1><p>{gameUi("Every player receives the same server-generated round.")}</p>{room.ranked && room.status === "countdown" && !room.series?.results.length && <button type="button" className="atlas-room-leave" onClick={() => void act({ op: "cancel", code: room.code })}>{gameUi("Cancel before start")}</button>}</AtlasFitContent></main>;
  if (room.status === "finished") return <main className="atlas-page atlas-center atlas-random-results"><AtlasFitContent>
    <AtlasResultHero xp={room.players.length === 2 ? 100 : 0} eyebrow={`Final result · ${room.ranked ? "Ranked match" : room.series ? `Random modes · ${seriesLabel(room.series.order.length)}` : titleOf(room.mode)}`} title={gameUi(!winningPlayer ? "Draw" : `${winningPlayer.name} wins${room.series && room.series.order.length > 1 ? " the series" : ""}`)} />
    <p className="atlas-result-score">{gameUi(room.scores[user.id] || 0)} <small>{gameUi(room.series ? "game wins" : unitFor(room.mode))}</small></p>
    <div className="atlas-result-actions">
      {!room.ranked && <button type="button" disabled={busy} onClick={() => void act({ op: "rematch", code: room.code })}>{gameUi("Replay")}</button>}
      <Link to={room.ranked ? "/games/atlas-arena?tab=ranked" : "/games/atlas-arena"}>{gameUi(room.ranked ? "Back to Ranked" : "Back to menu")}</Link>
    </div>
    {error && <p role="alert">{gameUi(error)}</p>}
    {room.series && <RankedSeries room={room} />}
    <ScoreBoard room={room} ranks={ranks} />
    {room.ranked && <RankedResult matchId={room.id} userId={user.id} />}
    {room.mode === "stat_battle" && room.battle && <DuelHistoryBlock room={room} data={atlas.data} />}
    {room.mode === "stat_battle" && room.table && <TableHistoryBlock room={room} data={atlas.data} />}
  </AtlasFitContent></main>;
  if (isRaceMode(room.mode)) return <RaceRoom remaining={remaining} room={room} userId={user.id} data={atlas.data} busy={busy} error={gameUi(error)} onAction={(action,answer)=>void act({op:"race",code:room.code,action,questionId:room.run?.question?.id,answer})} onEnd={()=>void act({op:"finish",code:room.code})}/>;
  if (room.mode === "stat_battle" && room.table) return <TableRoom room={room} data={atlas.data} busy={busy} remaining={remaining} error={gameUi(error)} onPlay={(card) => void act({ op: "play", code: room.code, roundIndex:room.roundIndex, card })} onReroll={() => void act({ op: "reroll", code: room.code, roundIndex:room.roundIndex })} />;
  if (room.mode === "stat_battle") return <DuelRoom room={room} data={atlas.data} busy={busy} remaining={remaining} error={gameUi(error)} onPlay={(card) => void act({ op: "play", code: room.code, roundIndex:room.roundIndex, card })} onReroll={() => void act({ op: "reroll", code: room.code, roundIndex:room.roundIndex })} />;

  const question = room.question, resolved = Boolean(room.roundResult);
  const panelOnly = PANEL_ONLY.includes(room.mode);
  const myResult = room.roundResult?.submissions?.find((item) => item.userId === user.id);
  const myPick = typeof room.submittedAnswer === "string" ? room.submittedAnswer : pick?.key === roundKey ? pick.answer : typeof myResult?.answer === "string" ? myResult.answer : null;
  const myPin = Array.isArray(room.submittedAnswer) ? room.submittedAnswer : pinSelection?.key === roundKey ? pinSelection.coordinates : Array.isArray(myResult?.answer) ? myResult.answer : null;
  const nameOf = (id?: string | null) => atlas.data!.countries.find((entity) => entity.id === id)?.shortName ?? id ?? "";
  const playerName = (id: string) => id === user.id ? "You" : room.players.find((player) => player.id === id)?.name ?? "Player";
  const pinColor = (id: string) => id === user.id ? "#ffd372" : ["#3196d3", "#be5ad4", "#f5c66c", "#4ade80"][room.players.findIndex((player) => player.id === id)] ?? "#a78bfa";
  // After the round every pin shows a measured line to the nearest point of the target country (none when inside it).
  const pins = question?.interaction === "closest_click" ? resolved
    ? (room.roundResult?.submissions ?? []).filter((item) => Array.isArray(item.answer)).map((item) => ({ coordinates: item.answer as Coordinates, label: `${playerName(item.userId)} · ${Math.round(item.distanceKm ?? 0).toLocaleString()} km`, color: pinColor(item.userId), target: item.distanceKm ? item.nearest : undefined }))
    : myPin ? [{ coordinates: myPin, label: "Your pin", color: "#ffd372" }] : [] : [];
  const guessId = guessSelection.key === roundKey ? guessSelection.id : null;
  // Map Battle: keep the clicked country visible, and mark it red once a wrong click is revealed.
  const clickedId = room.mode === "map_battle" ? myPick : null;
  const wrongClickId = resolved && clickedId && myResult && !myResult.correct ? clickedId : null;
  const waitingOn = room.players.filter((player) => !(room.submittedIds ?? []).includes(player.id)).length;
  return <main className="atlas-game-page"><header className="atlas-game-header"><Link className="atlas-icon-button" to="/games/atlas-arena" aria-label={gameUi("Exit room")}>×</Link><div><span className="atlas-eyebrow">{gameUi(titleOf(room.mode))}</span><strong>{gameUi(room.mode === "guess_country" ? `Country ${room.roundIndex + 1} / ${room.rounds} · Tip ${(room.tipIndex ?? 0) + 1}` : `Round ${room.roundIndex + 1} / ${room.rounds}`)}</strong></div><div className="atlas-game-stats"><span><Trophy size={16} />{gameUi(room.scores[user.id] || 0)}</span><span><Clock3 size={16} />{(room.mode === "guess_country" && revealLeft !== null ? revealLeft : remaining).toFixed(1)}</span><span className="atlas-live"><i className={onlineOthers.length === others.length ? "" : "is-offline"} /> {gameUi(others.length === 1 ? (onlineOthers.length ? others[0].name : `${others[0].name} reconnecting`) : `${onlineOthers.length + 1}/${room.players.length} online`)}</span></div></header>
    <section className={`atlas-play-layout ${panelOnly ? "is-panel-only" : room.mode === "guess_country" ? "is-guess-country" : ""}`}><aside className="atlas-question-panel"><AtlasFitContent><div className="atlas-progress"><i style={{ width: `${(room.roundIndex + 1) / room.rounds * 100}%` }} /></div><span className="atlas-eyebrow">{gameUi(room.submitted ? "Answer locked" : room.mode === "guess_country" ? `Tip ${(room.tipIndex ?? 0) + 1} of ${room.tipCount ?? 6}` : question?.interaction.replace("_", " "))}</span><h1>{gameUi(question?.prompt)}</h1>{room.tiebreak&&<p className="atlas-setup-note">{gameUi("Tie challenge ")}{gameUi(room.tiebreak.attempt)}{gameUi(" / 2 · three questions · equal knowledge awards.")}</p>}
      {(question?.interaction === "map_click" || question?.interaction === "closest_click") && question.flagAsset && <img className="atlas-question-flag" src={question.flagAsset} alt={gameUi("Country flag to identify")} />}
      {question?.interaction === "closest_click" && <div className="atlas-pin-controls"><p>{gameUi(myPin ? `Your pin: ${Math.abs(myPin[1]).toFixed(2)}° ${myPin[1] >= 0 ? "N" : "S"}, ${Math.abs(myPin[0]).toFixed(2)}° ${myPin[0] >= 0 ? "E" : "W"}${room.submitted ? "" : " — click again to move it."}` : `Click anywhere to place a pin. ${question.targetRadiusKm ? "Within 20 km of the city center" : "Inside the country"} counts as 0 km.`)}</p><button type="button" className="atlas-submit" disabled={!active || !myPin} onClick={() => myPin && submit(myPin)}><MapPin size={18} />{gameUi(room.submitted ? "Pin locked" : "Submit pin")}</button></div>}
      {question?.interaction === "higher_lower" && <HigherLowerCards key={question.id} question={question} revealed={resolved} disabled={!active} chosen={myPick} correct={resolved ? Boolean(myResult?.correct) : null} onAnswer={submit} />}
      {question?.interaction === "single_choice" && <><FlagPrompt question={question} topology={atlas.data.topology} /><FlagChoices question={question} disabled={!active} selected={myPick} correctId={typeof room.roundResult?.answer === "string" ? room.roundResult.answer : null} onAnswer={submit} /></>}
      {question?.interaction === "guess_country" && <>{!resolved && <div className="atlas-suspects" role="group" aria-label="Country suspects">{question.choices?.map(choice => <button key={choice.id} type="button" disabled={!active || (room.guesses ?? []).some(guess => guess.answer === choice.id)} aria-pressed={guessId === choice.id} onClick={() => setGuessSelection({ key: roundKey, id: choice.id })}>{choice.label}</button>)}</div>}{!resolved && <CountryGuessInput entities={atlas.data.countries} selectedId={guessId} disabled={!active} excluded={(room.guesses ?? []).map((guess) => guess.answer)} onSelect={(id) => setGuessSelection({ key: roundKey, id })} onSubmit={(id) => submit(id)} />}
        {(room.guesses ?? []).filter((guess) => !guess.correct && guess.answer).length > 0 && <p className="atlas-guess-misses">{(room.guesses ?? []).filter((guess) => !guess.correct && guess.answer).map((guess) => `${playerName(guess.userId)}: not ${nameOf(guess.answer)}`).join(" · ")}</p>}
        {!resolved && (room.tipIndex ?? 0) + 1 < (room.tipCount ?? 5) && <button type="button" className="atlas-submit atlas-secondary" disabled={!active} onClick={() => submit("")}>Pass this tip · reveal once everyone answers</button>}
        <GuessClueList excludeIds={question.choices?.map(choice => choice.id)} entityId={room.roundResult?.entityId} clues={question.clues} total={room.tipCount ?? question.clues.length} /></>}
      {room.submitted && room.status === "round_active" && <div className="atlas-feedback is-correct"><Check /><div><strong>{gameUi("Answer received")}</strong><span>{gameUi(waitingOn ? `Waiting for ${waitingOn} more player${waitingOn === 1 ? "" : "s"}…` : "Resolving…")}</span></div></div>}
      {question && <AtlasAreaReference values={areaValuesFromText(question.prompt)} />}
      {!panelOnly && <AtlasMapConfirm reserve={question?.interaction !== "closest_click"} pending={pendingMap} onConfirm={() => mapSelection.current?.confirm()} onCancel={() => mapSelection.current?.cancel()} />}
      {room.roundResult && (room.mode === "guess_country" ? <GuessResult room={room} userId={user.id} countryName={nameOf(room.roundResult.entityId)} playerName={playerName} nextIn={revealLeft} /> : <RoundResult room={room} userId={user.id} countryName={nameOf(room.roundResult.entityId)} playerName={playerName} />)}<ScoreBoard room={room} ranks={ranks} /></AtlasFitContent></aside>
      {!panelOnly && <AtlasWorldMap ref={mapSelection} onPendingChange={setPendingMap} confirmationKey={roundKey} topology={atlas.data.topology} entities={atlas.data.countries} disabled={!active} selectedId={room.mode === "guess_country" ? guessId : clickedId} correctId={correctId} incorrectId={wrongClickId} pins={pins} showHoverLabels={room.mode === "guess_country"} onSelect={(entityId) => { if (room.mode === "guess_country") setGuessSelection({ key: roundKey, id: entityId }); else if (question?.interaction !== "closest_click") submit(entityId); }} onPoint={question?.interaction === "closest_click" ? (coordinates) => setPinSelection({ key: roundKey, coordinates }) : undefined} ariaLabel={gameUi(question?.prompt)} />}
    </section>{error && <p role="alert" className="atlas-multiplayer-error">{gameUi(error)}</p>}</main>;
}

function MultiplayerLobby({ randomBestOf, rank, mode, setMode, fixed, settings, setSettings, code, setCode, busy, error, onCreate, onJoin }: { randomBestOf?: 1 | 3 | 5; rank?: AtlasRankRow; mode: AtlasMultiplayerMode; setMode: (mode: AtlasMultiplayerMode) => void; fixed: boolean; settings: SoloSettings; setSettings: (settings: SoloSettings) => void; code: string; setCode: (code: string) => void; busy: boolean; error: string; onCreate: () => void; onJoin: (event: FormEvent) => void }) {
  useGameLanguage();
  const def = modeForOnline(mode) ?? ARENA_MODES[0], Icon = MODE_ICONS[def.id];
  return <main className="atlas-page atlas-lobby"><Link className="atlas-back" to="/games/atlas-arena"><ArrowLeft size={18} />{gameUi(" Atlas Arena")}</Link><section className="atlas-mode-section">
    {fixed
      ? <header className={`atlas-lobby-mode trial-accent-${def.accent}`}><span className="trials-mode-icon"><Icon aria-hidden /></span><div><span className="atlas-eyebrow">Multiplayer · 2–{ATLAS_MAX_PLAYERS}{gameUi(" players")}</span><h1 className="atlas-lobby-title">{gameUi(randomBestOf ? `Random modes · ${seriesLabel(randomBestOf)}` : def.title)}</h1><p>{randomBestOf ? `${randomBestOf === 1 ? "One mode" : `${randomBestOf} different modes`} in a random order${randomBestOf === 1 ? `: ${def.title}` : `, starting with ${def.title}`}. First to ${Math.floor(randomBestOf / 2) + 1} game wins; draws use a game without awarding a win.` : def.rules.multiplayer}</p></div></header>
      : <><span className="atlas-eyebrow">{gameUi("Realtime · 2–4 players")}</span><h1 className="atlas-lobby-title">{gameUi("Choose an arena")}</h1>
        <div className="atlas-multiplayer-grid">{ONLINE_ARENA_MODES.map((item) => { const ItemIcon = MODE_ICONS[item.id]; return <button type="button" className={`atlas-duel-card ${mode === item.online ? "active" : ""}`} key={item.id} onClick={() => setMode(item.online)}><ItemIcon /><strong>{gameUi(item.title)}</strong><small>{gameUi(item.tagline)}</small></button>; })}</div></>}
    <AtlasRankBadge rating={rank?.rating ?? 1500} deviation={rank?.deviation??350} matchesPlayed={rank?.matches_played??0} position={rank?.leaderboard_rank} /><div className="atlas-lobby-actions"><section><h2>{gameUi("Create room")}</h2>
      <SoloSettingsForm mode={def} settings={settings} onChange={setSettings} />
      <label className="atlas-label">{gameUi("Players")}</label>
      <p className="atlas-setup-note">2–{ATLAS_MAX_PLAYERS} players. Create the room, then choose 2, 3 or 4 players inside it and invite a friend to every open seat.</p>
      <button type="button" className="atlas-start" disabled={busy || !settingsReady(def, settings)} onClick={onCreate}>{gameUi("Create ")}{gameUi(randomBestOf ? "random series" : def.title)}{gameUi(" room")}</button></section>
      <form onSubmit={onJoin}><h2>{gameUi("Join by code")}</h2><label>{gameUi("Six-character invite code")}<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} minLength={6} required /></label><button className="atlas-start" disabled={busy}>{gameUi("Join room")}</button></form></div>
    {error && <p role="alert" className="atlas-multiplayer-error">{gameUi(error)}</p>}</section></main>;
}
function RoomPlayer({ rank, player, label, online = false, waiting = false, readyAction = false, busy = false, canInvite = false, onReady }: { rank?: AtlasRankRow; player?: Snapshot["players"][number]; label: string; online?: boolean; waiting?: boolean; readyAction?: boolean; busy?: boolean; canInvite?: boolean; onReady?: () => void }) {
  useGameLanguage();
  const ready = Boolean(player?.ready);
  const state = waiting ? "Waiting for player" : ready ? "Ready" : online ? "Not ready" : "Reconnecting";
  return <article className={`atlas-room-player ${ready ? "is-ready" : "is-not-ready"} ${waiting ? "is-waiting" : ""}`}><span className="atlas-room-player-label">{gameUi(label)}</span><strong>{gameUi(player?.name || "Open seat")}</strong>{player && <AtlasRankBadge rating={rank?.rating ?? 1500} deviation={rank?.deviation??350} matchesPlayed={rank?.matches_played??0} position={rank?.leaderboard_rank} />}<span className={`atlas-ready-check ${ready ? "is-ready" : "is-not-ready"}`} role="checkbox" aria-checked={ready}><i>{ready ? <Check size={13} /> : null}</i>{gameUi(state)}</span>{canInvite && <InviteFriendButton />}{readyAction && <button type="button" disabled={busy} onClick={onReady}>{gameUi("Mark ready")}</button>}</article>;
}
/** The host's 2 / 3 / 4 switch: how many seats the room has. Seats already taken cannot be removed. */
function SeatPicker({ seats, taken, editable, onChange }: { seats: number; taken: number; editable: boolean; onChange: (count: number) => void }) {
  return <div className="atlas-seat-picker"><span>{gameUi("Players")}</span><div className="atlas-player-count" role="radiogroup" aria-label={gameUi("Number of players")}>
    {[2, 3, 4].map((count) => <button type="button" role="radio" aria-checked={seats === count} key={gameUi(count)} className={seats === count ? "active" : ""} disabled={!editable || count < taken} title={!editable ? "The host sets the number of players" : count < taken ? `${taken} players are already here` : `${count} players`} onClick={() => { if (count !== seats) onChange(count); }}>{gameUi(count)}</button>)}
  </div></div>;
}
function RankedSeries({ room, aside }: { room: Snapshot; aside?: ReactNode }) {
  useGameLanguage();
  const series = room.series;
  if (!series) return null;
  return <section className="atlas-series" aria-label={gameUi(room.ranked ? "Ranked match series" : "Random mode series")}>
    <p className="atlas-series-score" aria-label={gameUi("Series score")}>{gameUi(room.players.map(player => series.wins[player.id] ?? 0).join(" – "))} · {gameUi(seriesLabel(series.order.length))}</p>
    <div className="atlas-series-head"><div className="atlas-series-players">{room.players.map((player) => <div key={player.id}><strong>{player.name}</strong><span>{gameUi(series.wins[player.id] ?? 0)}{gameUi(" game wins")}</span>{room.ranked && <small>{gameUi("Banned: ")}{gameUi((series.bans[player.id] ?? []).map((mode) => titleOf(mode as AtlasMultiplayerMode)).join(", ") || "None")}</small>}</div>)}</div>{aside}</div>
    <ol className="atlas-series-order">{series.order.map((mode, index) => { const def = modeForOnline(mode), Icon = def ? MODE_ICONS[def.id] : Shield, result = series.results[index]; return <li key={mode} className={index === series.gameIndex && !result && room.status !== "finished" ? "is-current" : ""}><Icon aria-hidden /><span><small>{gameUi("Game ")}{gameUi(index + 1)}</small><strong>{gameUi(titleOf(mode))}</strong>{result && <small>{gameUi(room.players.map(player => `${player.name}: ${(result.scores[player.id] ?? 0).toLocaleString()}`).join(" · "))}</small>}</span><em>{gameUi(result ? result.winnerId ? `${room.players.find((player) => player.id === result.winnerId)?.name ?? "Player"} won` : "Draw" : room.status === "finished" ? "Not needed" : index === series.gameIndex ? "Up next" : "Pending")}</em></li>; })}</ol>
    <p>{gameUi(seriesLabel(series.order.length))}{gameUi(": first to ")}{gameUi(Math.floor(series.order.length / 2) + 1)}{gameUi(" game wins, or most wins when all games are played. ")}{gameUi(room.ranked ? "Ties use up to two sets of three knowledge challenges. If still level, the game is drawn." : "Tied games are drawn.")}</p>
  </section>;
}
const unitFor = (mode: AtlasMultiplayerMode) => mode === "stat_battle" ? "rounds" : "points";
function ScoreBoard({ room, ranks }: { room: Snapshot; ranks: AtlasRankRow[] }) {
  useGameLanguage(); return <div className="atlas-scoreboard">{[...room.players].sort((left, right) => (room.scores[right.id] || 0) - (room.scores[left.id] || 0)).map((player) => <div key={player.id}><span><i className={`player-${room.players.indexOf(player)}`} />{player.name}<AtlasRankBadge rating={ranks.find(rank => rank.user_id === player.id)?.rating ?? 1500} position={ranks.find(rank => rank.user_id === player.id)?.leaderboard_rank} deviation={ranks.find(rank=>rank.user_id===player.id)?.deviation??350} matchesPlayed={ranks.find(rank=>rank.user_id===player.id)?.matches_played??0} />{room.race?.[player.id]?.done && <Check size={13} aria-label={gameUi("finished")} />}</span><strong>{gameUi((room.scores[player.id] || 0).toLocaleString("en"))}{gameUi(room.status === "finished" && room.series ? " game wins" : room.mode === "stat_battle" ? " rounds" : "")}</strong></div>)}</div>; }
function RankedResult({ matchId, userId }: { matchId: string; userId: string }) {
  useGameLanguage();
  const {rows}=useAtlasRanks([userId]);
  const [result, setResult] = useState<{ player_a: string; before_a: number; after_a: number; before_b: number; after_b: number } | null>(null);
  useEffect(() => {
    if (result) return;
    let live = true;
    const refresh = () => void supabase.from("atlas_ranked_results").select("player_a,before_a,after_a,before_b,after_b").eq("match_id", matchId).maybeSingle().then(({ data }) => { if (live && data) setResult(data); });
    refresh();
    const timer = window.setInterval(refresh, 2_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [matchId, result]);
  if (!result) return <p className="atlas-setup-note">{gameUi("Saving Ranked result…")}</p>;
  const mine = result.player_a === userId, before = mine ? result.before_a : result.before_b, after = mine ? result.after_a : result.after_b;
  const row=rows[0];
  const newRank=getRankFromProfile({rating:after,deviation:row?.deviation??350,matches_played:row?.matches_played??0});
  return <div className="atlas-ranked-result"><strong>{gameUi(newRank.provisional?`Tentative ${newRank.displayName}`:newRank.displayName)}</strong><span>{gameUi(Math.round(before))} → {gameUi(Math.round(after))} · {gameUi(after >= before ? "+" : "")}{gameUi(Math.round(after - before))}{gameUi(" Rating")}</span>{newRank.provisional&&<span>{gameUi("Placement evidence is still being collected.")}</span>}</div>;
}
function RoundResult({ room, userId, countryName, playerName }: { room: Snapshot; userId: string; countryName: string; playerName: (id: string) => string }) {
  useGameLanguage();
  const result = room.roundResult, mine = result?.submissions?.find((item) => item.userId === userId);
  const won = result?.winnerId === userId, correct = Boolean(mine?.correct), winner = result?.winnerId ? playerName(result.winnerId) : null;
  const headline = won ? "Round won" : correct ? mine?.distanceKm !== undefined ? "Another pin was closer" : "Correct · knowledge points earned" : winner ? `${winner} wins round` : "No winner";
  const detail = mine?.distanceKm !== undefined ? mine.distanceKm < 0.5 ? `Inside the target for ${countryName} — 0 km` : `${Math.round(mine.distanceKm).toLocaleString()} km from ${countryName}` : correct ? `${mine?.responseMs} ms` : mine ? `Incorrect — it was ${countryName}` : `No answer — it was ${countryName}`;
  return <div className={`atlas-feedback ${won || (correct && mine?.distanceKm === undefined) ? "is-correct" : "is-wrong"}`}>{won ? <Crown /> : <MapPin />}<div><strong>{gameUi(headline)}</strong><span>{gameUi(detail)}</span></div></div>;
}
/** The point addition after a solved (or abandoned) country: who solved it on which tip, and what they earned. */
function GuessResult({ room, userId, countryName, playerName, nextIn }: { room: Snapshot; userId: string; countryName: string; playerName: (id: string) => string; nextIn: number | null }) {
  useGameLanguage();
  const awards = room.roundResult?.awards ?? [], mine = awards.find((award) => award.userId === userId), tip = (room.roundResult?.tip ?? 0) + 1;
  return <div className={`atlas-guess-result ${mine ? "is-correct" : "is-wrong"}`}><strong>{gameUi(awards.length ? `${countryName} — solved on tip ${tip}` : `Nobody got it: ${countryName}`)}</strong>
    {awards.length > 0 && <ul>{awards.map((award) => <li key={award.userId}><span>{award.first && <Crown size={14} />}{gameUi(playerName(award.userId))}</span><span>{gameUi(award.base)}{gameUi(award.bonus ? ` + ${award.bonus} bonus` : "")}</span><b>+{gameUi(award.total)}</b></li>)}</ul>}
    {!mine && awards.length > 0 && <small>{gameUi("You didn’t solve this tip — no points this time.")}</small>}
    {nextIn !== null && <small className="atlas-guess-next" role="timer">{room.roundIndex + 1 >= room.rounds ? "Final standings" : "Next country"} in {Math.ceil(nextIn)}s — all tips are shown above.</small>}</div>;
}

/**
 * A race: every player runs the same seeded game locally. The score is reported as it changes (throttled) and once
 * more, with `done`, when the run ends; the room finishes when everybody is done.
 */
function RaceRoom({remaining,room,userId,data,busy,error,onAction,onEnd}:{remaining:number;room:Snapshot;userId:string;data:AtlasDataset;busy:boolean;error:string;onAction:(action:string,answer?:string|string[])=>void;onEnd:()=>void}) {
  useGameLanguage();
  const run=room.run,q=run?.question;
  if(run?.done)return <RaceStandings room={room} userId={userId} title={gameUi(titleOf(room.mode))} busy={busy} onEnd={onEnd}/>;
  if(!run||!q)return <main className="atlas-page atlas-center"><AtlasFitContent><h1>{gameUi("Restoring saved run…")}</h1>{error&&<p role="alert">{gameUi(error)}</p>}</AtlasFitContent></main>;
  const map=q.interaction==="map_click";
  return <main className="atlas-game-page"><header className="atlas-game-header"><Link className="atlas-icon-button" to="/games/atlas-arena" aria-label={gameUi("Exit run")}>×</Link><div><span className="atlas-eyebrow">{gameUi(titleOf(room.mode))}{gameUi(" · saved run")}</span><strong>{gameUi("Question ")}{gameUi(run.index+1)} / {gameUi(run.count)}</strong></div><div className="atlas-game-stats"><span>{gameUi(run.score)}{gameUi(" points")}</span><span>{gameUi(Math.ceil(remaining))}s</span></div></header>
    <section className={`atlas-play-layout ${map?"":"is-panel-only"}`}><aside className="atlas-question-panel"><AtlasFitContent><div className="atlas-progress"><i style={{width:`${run.index/run.count*100}%`}}/></div><h1>{gameUi(q.prompt)}</h1>
    {run.wrong.length>0&&!run.feedback&&<p role="status">{gameUi("Try again. ")}{gameUi(run.wrong.length)}{gameUi(" incorrect ")}{gameUi(run.wrong.length===1?"guess":"guesses")}{gameUi(" saved.")}</p>}
    {!run.feedback&&<ArenaQuestionInput key={q.id} question={q} topology={data.topology} disabled={busy || remaining <= 0} onAnswer={answer=>onAction("answer",answer)}/>}
    {q.interaction==="clues"&&!run.feedback&&<button className="atlas-submit atlas-secondary" disabled={busy||run.revealed>=5} onClick={()=>onAction("clue")}>{gameUi("Reveal another clue · lower award")}</button>}
    {run.feedback&&<div className={`atlas-feedback ${run.feedback.correct?"is-correct":"is-wrong"}`} role="status"><div><strong>{gameUi(run.feedback.correct?"Correct":"Review")} · {gameUi(run.feedback.points>0?"+":"")}{gameUi(run.feedback.points)}</strong><p>{gameUi(run.feedback.answer)}</p><p>{gameUi(run.feedback.explanation)}</p><button className="atlas-submit" disabled={busy} onClick={()=>onAction("next")}>{gameUi(run.index+1>=run.count?"Finish run":"Next question")}</button></div></div>}
    <ScoreBoard room={room} ranks={[]}/><p className="atlas-setup-note">{gameUi("Answers and progress are saved after each action. Reconnect to resume this question.")}</p>{error&&<p role="alert">{gameUi(error)}</p>}</AtlasFitContent></aside>
    {map&&<AtlasWorldMap topology={data.topology} entities={data.countries} disabled={busy||Boolean(run.feedback)} showHoverLabels={false} focus={focusForScope(room.settings.scope??"Europe")} onSelect={id=>onAction("answer",id)}/>}</section><RaceTicker room={room} userId={userId}/></main>;
}

/** Live scores of the other racers, pinned to a corner while you play. */
function RaceTicker({ room, userId }: { room: Snapshot; userId: string }) {
  useGameLanguage();
  const others = room.players.filter((player) => player.id !== userId);
  return <aside className="atlas-race-ticker" aria-label={gameUi("Live race scores")}><span className="atlas-eyebrow">{gameUi("Live")}</span>
    {others.map((player) => { const entry = room.race?.[player.id]; return <span key={player.id} style={{ "--player": PLAYER_COLORS[room.players.indexOf(player)] } as CSSProperties}><i />{player.name}<b>{gameUi((entry?.score ?? 0).toLocaleString("en"))}</b>{entry?.done && <Flag size={12} aria-label={gameUi("finished")} />}</span>; })}
  </aside>;
}

function RaceStandings({ room, userId, title, busy, onEnd }: { room: Snapshot; userId: string; title: string; busy: boolean; onEnd: () => void }) {
  useGameLanguage();
  const ranked = [...room.players].sort((left, right) => (room.race?.[right.id]?.score ?? 0) - (room.race?.[left.id]?.score ?? 0));
  const racing = room.players.filter((player) => !room.race?.[player.id]?.done).length;
  return <main className="atlas-page atlas-center"><AtlasFitContent><div className="atlas-result-orbit"><Timer /></div><span className="atlas-eyebrow">{gameUi(title)}{gameUi(" · race")}</span>
    <h1>{gameUi(racing ? "Waiting for the others" : "Everyone has finished")}</h1>
    <p>{gameUi(racing ? `${racing} player${racing === 1 ? " is" : "s are"} still racing. Scores update live.` : "Tallying the final standings…")}</p>
    <ol className="atlas-standings">{ranked.map((player, index) => { const entry = room.race?.[player.id]; return <li key={player.id} className={index === 0 ? "is-winner" : ""} style={{ "--player": PLAYER_COLORS[room.players.indexOf(player)] } as CSSProperties}>
      <b>{gameUi(index + 1)}</b><span><i />{gameUi(player.id === userId ? "You" : player.name)}<small>{gameUi(entry?.done ? "Finished" : "Racing…")}</small></span><strong>{gameUi((entry?.score ?? 0).toLocaleString("en"))} <small>{gameUi("points")}</small></strong></li>; })}</ol>
    {!room.ranked && room.hostId === userId && racing > 0 && <button type="button" className="atlas-start atlas-secondary atlas-race-end" disabled={busy} onClick={onEnd}>{gameUi("End race now")}</button>}
    <Link className="atlas-room-leave" to="/games/atlas-arena">{gameUi("Leave room")}</Link></AtlasFitContent></main>;
}

/** Stat Battle online: you see your own hand; the opponent's card stays face down until both are played. */
function DuelRoom({ room, data, busy, remaining, error, onPlay, onReroll }: { room: Snapshot; data: AtlasDataset; busy: boolean; remaining: number; error: string; onPlay: (card: string) => void; onReroll: () => void }) {
  useGameLanguage();
  const navigate = useNavigate();
  const pools = useTrialPools(data, "expert");
  const view = room.battle;
  if (!pools || !view) return <main className="atlas-page atlas-center"><AtlasFitContent><Radio /><h1>{gameUi("Dealing cards…")}</h1></AtlasFitContent></main>;
  const them = room.players[room.seat === 0 ? 1 : 0];
  const revealed = room.status === "round_resolving";
  return <TrialShell title={gameUi("Stat Battle · Online")} accent="amber" roundLabel={room.ranked?`Round ${view.round} / 8 · highest score wins`:`Round ${view.round} · first to ${STAT_BATTLE.winTarget}`} progress={Math.max(view.myScore, view.theirScore) / STAT_BATTLE.winTarget * 100} onExit={() => navigate("/games/atlas-arena")} wide>
    <div className="duel-scoreline" aria-label={gameUi("Score")}><span className="is-player">{gameUi("You ")}<b>{gameUi(view.myScore)}</b></span><span>–</span><span className="is-opponent"><b>{gameUi(view.theirScore)}</b> {them?.name}</span></div>
    <DuelBoard byId={pools.byId} categoryId={view.categoryId} me={{ name: "You", score: view.myScore }} them={{ name: them?.name ?? "Opponent", score: view.theirScore }}
      hand={view.hand} opponentCards={view.opponentCards} deck={view.deck} picked={revealed ? null : view.picked} opponentPicked={!revealed && view.opponentPicked} played={revealed ? view.played : null}
      canPlay={room.status === "round_active" && !view.picked && !busy} onPlay={onPlay} rerollsLeft={view.rerollsLeft} onReroll={onReroll}
      hint={view.picked ? `Card down — waiting for ${them?.name ?? "your opponent"}…` : `${Math.ceil(remaining)}s to play a card, or your first card is played for you`} />
    {error && <p role="alert" className="atlas-multiplayer-error">{gameUi(error)}</p>}
  </TrialShell>;
}

/** Stat Battle online for three or four: your hand at the bottom, everyone's card face down until all are played. */
function TableRoom({ room, data, busy, remaining, error, onPlay, onReroll }: { room: Snapshot; data: AtlasDataset; busy: boolean; remaining: number; error: string; onPlay: (card: string) => void; onReroll: () => void }) {
  const navigate = useNavigate();
  const pools = useTrialPools(data, "expert");
  const view = room.table;
  if (!pools || !view) return <main className="atlas-page atlas-center"><AtlasFitContent><Radio /><h1>{gameUi("Dealing cards…")}</h1></AtlasFitContent></main>;
  const names = room.players.map((player, seat) => seat === room.seat ? "You" : player.name);
  const waiting = view.pickedSeats.filter((picked) => !picked).length;
  return <TrialShell title={gameUi("Stat Battle · Online")} accent="amber" roundLabel={`Round ${view.round} · first to ${STAT_BATTLE.winTarget}`} progress={Math.max(...view.scores) / STAT_BATTLE.winTarget * 100} onExit={() => navigate("/games/atlas-arena")} wide>
    <TableScoreline names={names} scores={view.scores} />
    <TableBoard byId={pools.byId} view={view} names={names} canPlay={room.status === "round_active" && !view.picked && !busy} onPlay={onPlay} onReroll={onReroll}
      hint={view.picked ? `Card down — waiting for ${waiting} more player${waiting === 1 ? "" : "s"}…` : `${Math.ceil(remaining)}s to play a card, or your first card is played for you`} />
    {error && <p role="alert" className="atlas-multiplayer-error">{gameUi(error)}</p>}
  </TrialShell>;
}
function TableHistoryBlock({ room, data }: { room: Snapshot; data: AtlasDataset }) {
  const pools = useTrialPools(data, "expert");
  if (!pools || !room.table?.history.length) return null;
  return <TableHistory history={room.table.history} byId={pools.byId} names={room.players.map((player, seat) => seat === room.seat ? "You" : player.name)} />;
}

function DuelHistoryBlock({ room, data }: { room: Snapshot; data: AtlasDataset }) {
  const pools = useTrialPools(data, "expert");
  if (!pools || !room.battle?.history.length) return null;
  return <DuelHistory history={room.battle.history} byId={pools.byId} names={["You", room.players[room.seat === 0 ? 1 : 0]?.name ?? "Opponent"]} />;
}
