import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight, Crown, MapPin, RotateCcw, Trophy, Users, X } from "lucide-react";
import { AtlasSoloGame, SoloResults, SoloSettingsForm } from "../../../components/atlas/AtlasSoloGame";
import { AtlasWorldMap } from "../../../components/atlas/AtlasWorldMap";
import { HandoffCard, StatBattleHotseat } from "../../../components/atlas/trials/StatBattleDuel";
import { TRIAL_GAMES, useTrialPools } from "../../../components/atlas/trials/trialRegistry";
import { TrialSessionContext, type TrialSession } from "../../../components/atlas/trials/trialSession";
import { useTrialTimers } from "../../../components/atlas/trials/useTrialTimers";
import { freshSeed } from "../../../games/atlas/arenaStorage";
import { ATLAS_SCORING } from "../../../games/atlas/config";
import { validateAnswer } from "../../../games/atlas/engine";
import { generateMatchQuestions } from "../../../games/atlas/matchQuestions";
import { hotseatPlayerLimit, modeById, type ArenaModeDef } from "../../../games/atlas/modeCatalog";
import { PLAYER_COLORS, settingsReady, type SoloSettings, type SoloSummary } from "../../../games/atlas/soloSettings";
import { countryShapesFromTopology, distanceToTerritory } from "../../../games/atlas/territoryDistance";
import type { AtlasDataset, Coordinates } from "../../../games/atlas/types";
import { useAtlasData } from "../../../games/atlas/useAtlasData";
import { AtlasLoading, AtlasUnavailable } from "./AtlasSoloPage";
import { useArenaStore } from "./useArenaStore";
import "./atlas-arena.css";
import "../../../components/atlas/trials/atlas-trials.css";

type Player = { name: string; color: string };
type GameProps = { mode: ArenaModeDef; data: AtlasDataset; players: Player[]; settings: SoloSettings; onExit: () => void; onSetup: () => void };

/** Hotseat: two to four people share one device. */
export default function AtlasHotseatPage() {
  const { modeId } = useParams();
  const mode = modeById(modeId);
  const navigate = useNavigate();
  const { data, loading, error } = useAtlasData();
  const { stored, update } = useArenaStore();
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [names, setNames] = useState(["Player 1", "Player 2", "Player 3", "Player 4"]);
  const [count, setCount] = useState(2);
  if (!mode) return <Navigate to="/games/atlas-arena" replace />;
  if (loading) return <AtlasLoading />;
  if (error || !data) return <AtlasUnavailable error={error} />;
  const limit = hotseatPlayerLimit(mode), seats = Math.min(count, limit);
  const settings = stored.settings;
  const exit = () => navigate("/games/atlas-arena");

  if (!players) return (
    <main className="atlas-page atlas-setup">
      <Link className="atlas-back" to="/games/atlas-arena"><ArrowLeft /> Atlas Arena</Link>
      <div className="atlas-setup-card">
        <span className="atlas-eyebrow">Hotseat · one device</span>
        <h1>{mode.title}</h1>
        <p>{mode.rules.hotseat}</p>
        <label className="atlas-label">Players</label>
        {limit > 2 && <div className="atlas-player-count" role="radiogroup" aria-label="Number of players">{[2, 3, 4].map((option) => <button type="button" role="radio" aria-checked={seats === option} key={option} className={seats === option ? "active" : ""} onClick={() => setCount(option)}>{option}</button>)}</div>}
        <div className="atlas-hotseat-names">
          {Array.from({ length: seats }, (_, index) => (
            <label key={index} style={{ "--player": PLAYER_COLORS[index] } as CSSProperties}><i aria-hidden /><span className="sr-only">Player {index + 1} name</span>
              <input value={names[index]} maxLength={20} onChange={(event) => setNames((current) => current.map((name, position) => position === index ? event.target.value : name))} /></label>
          ))}
        </div>
        <SoloSettingsForm mode={mode} settings={settings} onChange={(next) => update({ settings: next })} />
        <button type="button" className="atlas-start" disabled={!settingsReady(mode, settings)}
          onClick={() => setPlayers(Array.from({ length: seats }, (_, index) => ({ name: names[index].trim() || `Player ${index + 1}`, color: PLAYER_COLORS[index] })))}>
          <Users /> Start with {seats} players <ChevronRight />
        </button>
      </div>
    </main>
  );
  const props: GameProps = { mode, data, players, settings, onExit: exit, onSetup: () => setPlayers(null) };
  if (mode.hotseat === "pins") return <PinsHotseat {...props} />;
  if (mode.hotseat === "territory") return <TerritoryHotseat {...props} />;
  if (mode.hotseat === "duel") return <DuelHotseat {...props} />;
  return <TurnsHotseat {...props} />;
}

/** Final ranking for every hotseat mode. */
function Standings({ title, rows, unit, onAgain, onSetup, onExit }: { title: string; rows: { player: Player; score: number; detail?: string }[]; unit: string; onAgain: () => void; onSetup: () => void; onExit: () => void }) {
  const ranked = [...rows].sort((left, right) => right.score - left.score);
  const top = ranked[0]?.score ?? 0, winners = ranked.filter((row) => row.score === top);
  return (
    <main className="atlas-page atlas-center">
      <div className="atlas-result-orbit"><Crown /></div>
      <span className="atlas-eyebrow">{title} · final standings</span>
      <h1>{winners.length > 1 ? "It's a tie" : `${winners[0]?.player.name} wins`}</h1>
      <ol className="atlas-standings">
        {ranked.map((row) => {
          const rank = ranked.findIndex((item) => item.score === row.score) + 1;
          return <li key={row.player.name + row.player.color} style={{ "--player": row.player.color } as CSSProperties} className={rank === 1 ? "is-winner" : ""}>
            <b>{rank}</b><span><i />{row.player.name}{row.detail && <small>{row.detail}</small>}</span><strong>{row.score.toLocaleString("en")} <small>{unit}</small></strong>
          </li>;
        })}
      </ol>
      <div className="atlas-result-actions">
        <button type="button" onClick={onAgain}><RotateCcw /> Play again</button>
        <button type="button" className="atlas-secondary" onClick={onSetup}><Users /> Players & settings</button>
        <button type="button" className="atlas-secondary" onClick={onExit}>All modes</button>
      </div>
    </main>
  );
}

/** Each player plays a full run of their own, one after another; the device is handed over in between. */
function TurnsHotseat({ mode, data, players, settings, onExit, onSetup }: GameProps) {
  const [seed, setSeed] = useState(freshSeed);
  const [turn, setTurn] = useState(0);
  const [phase, setPhase] = useState<"handoff" | "playing" | "between" | "standings">("handoff");
  const [scores, setScores] = useState<number[]>([]);
  const [summary, setSummary] = useState<SoloSummary | null>(null);
  const pending = useRef(0);
  const pools = useTrialPools(data, settings.difficulty);
  const player = players[turn], last = turn === players.length - 1, next = players[turn + 1];
  const commit = useCallback((score: number) => {
    setScores((current) => { const copy = [...current]; copy[turn] = score; return copy; });
    setSummary(null);
    if (last) setPhase("standings");
    else { setTurn(turn + 1); setPhase("handoff"); }
  }, [last, turn]);
  const session = useMemo<TrialSession>(() => ({ player, finish: { label: last ? "See standings" : `Pass to ${next?.name}`, onClick: () => commit(pending.current) } }), [commit, last, next?.name, player]);
  const again = () => { setSeed(freshSeed()); setTurn(0); setScores([]); setPhase("handoff"); };
  const finishRun = useCallback((result: SoloSummary) => { setSummary(result); setPhase("between"); }, []);
  const record = useCallback((score: number) => { pending.current = score; }, []);
  // Every player gets a run of their own, so watching the previous turn gives nothing away.
  const playerSeed = `${seed}:p${turn}`;

  if (phase === "standings") return <Standings title={mode.title} rows={players.map((item, index) => ({ player: item, score: scores[index] ?? 0 }))} unit={mode.id === "territory-battle" ? "countries" : "points"} onAgain={again} onSetup={onSetup} onExit={onExit} />;
  if (phase === "handoff") return (
    <main className="atlas-page atlas-center">
      <HandoffCard name={player.name} color={player.color} action={`Start ${player.name}'s run`} onReady={() => setPhase("playing")}
        detail={<>{mode.title} · turn {turn + 1} of {players.length}{turn > 0 && <><br />Score to beat: {Math.max(...scores).toLocaleString("en")}</>}</>} />
      <button type="button" className="atlas-room-leave" onClick={onExit}>Leave hotseat</button>
    </main>
  );
  if (phase === "between" && summary && mode.solo.kind === "arena") return <SoloResults mode={mode.solo.mode} summary={summary} entities={data.countries} eyebrow={`${player.name}'s run`}
    actions={<button type="button" onClick={() => commit(summary.score)}>{last ? "See standings" : `Pass to ${next?.name}`} <ChevronRight /></button>} />;
  if (mode.solo.kind === "arena") return <AtlasSoloGame key={playerSeed} data={data} mode={mode.solo.mode} settings={settings} seed={playerSeed} title={mode.title} player={player} onFinish={finishRun} onExit={onExit} />;
  if (!pools) return null;
  const { component: Game, fullPool } = TRIAL_GAMES[mode.solo.trial];
  return (
    <TrialSessionContext.Provider value={session}>
      <Game key={playerSeed} pool={fullPool ? pools.full : pools.difficulty} byId={pools.byId} topology={data.topology} seed={playerSeed} difficulty={settings.difficulty} best={0} onRecord={record} onRestart={() => commit(pending.current)} onExit={onExit} />
    </TrialSessionContext.Provider>
  );
}

function DuelHotseat({ data, players, settings, onExit }: GameProps) {
  const [seed, setSeed] = useState(freshSeed);
  const pools = useTrialPools(data, settings.difficulty);
  if (!pools) return null;
  return <StatBattleHotseat key={seed} pool={pools.difficulty} byId={pools.byId} seed={seed} names={[players[0].name, players[1].name]} onExit={onExit} onRestart={() => setSeed(freshSeed())} />;
}

/** Closest Wins on one device: every player pins each country in turn behind a cover screen, then all pins are revealed. */
function PinsHotseat({ mode, data, players, settings, onExit, onSetup }: GameProps) {
  const [seed, setSeed] = useState(freshSeed);
  const questions = useMemo(() => generateMatchQuestions({ entities: data.countries, extras: data.extras, datasetVersion: data.version.atlasDataVersion, seed, difficulty: settings.difficulty, count: 10, mode: "closest_wins", categories: settings.categories }), [data, seed, settings.categories, settings.difficulty]);
  const shapes = useMemo(() => countryShapesFromTopology(data.topology), [data.topology]);
  const [round, setRound] = useState(0);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"handoff" | "placing" | "reveal" | "standings">("handoff");
  const [pins, setPins] = useState<(Coordinates | null)[]>(() => players.map(() => null));
  const [draft, setDraft] = useState<Coordinates | null>(null);
  const [scores, setScores] = useState(() => players.map(() => 0));
  const [wins, setWins] = useState(() => players.map(() => 0));
  const [results, setResults] = useState<{ player: number; distanceKm: number; nearest: Coordinates }[]>([]);
  const question = questions[round];
  // The first pin of each round rotates, so nobody always pins first.
  const order = players.map((_, index) => (index + round) % players.length);
  const current = order[step], player = players[current];
  const nameOf = (id?: string) => data.countries.find((entity) => entity.id === id)?.shortName ?? "";

  const lock = () => {
    if (!draft || question?.interaction !== "closest_click") return;
    const placed = pins.map((pin, index) => index === current ? draft : pin);
    setPins(placed); setDraft(null);
    if (step + 1 < players.length) { setStep(step + 1); setPhase("handoff"); return; }
    // Everyone has pinned: measure, and the closest pin (the earlier one on a tie) wins the round.
    const measured = order.map((index) => ({ player: index, ...distanceToTerritory(placed[index]!, { geometryId: question.targetGeometryId, point: question.targetCoordinates, radiusKm: question.targetRadiusKm }, shapes) }));
    const ranked = [...measured].sort((left, right) => left.distanceKm - right.distanceKm);
    setResults(ranked);
    setScores((currentScores) => currentScores.map((score, index) => index === ranked[0].player ? score + ATLAS_SCORING.normalCorrect : score));
    setWins((currentWins) => currentWins.map((value, index) => index === ranked[0].player ? value + 1 : value));
    setPhase("reveal");
  };
  const nextRound = () => {
    if (round + 1 >= questions.length) { setPhase("standings"); return; }
    setRound(round + 1); setStep(0); setPins(players.map(() => null)); setResults([]); setPhase("handoff");
  };
  const again = () => { setSeed(freshSeed()); setRound(0); setStep(0); setPins(players.map(() => null)); setScores(players.map(() => 0)); setWins(players.map(() => 0)); setResults([]); setPhase("handoff"); };

  if (phase === "standings") return <Standings title={mode.title} rows={players.map((item, index) => ({ player: item, score: scores[index], detail: `${wins[index]} round${wins[index] === 1 ? "" : "s"} won` }))} unit="points" onAgain={again} onSetup={onSetup} onExit={onExit} />;
  if (phase === "handoff") return (
    <main className="atlas-page atlas-center">
      <HandoffCard name={player.name} color={player.color} action={`Show ${player.name} the map`} onReady={() => setPhase("placing")}
        detail={<>Round {round + 1} of {questions.length}{step > 0 ? ` · ${step} pin${step === 1 ? "" : "s"} already placed and hidden` : ""}</>} />
      <button type="button" className="atlas-room-leave" onClick={onExit}>Leave hotseat</button>
    </main>
  );
  const revealed = phase === "reveal";
  const mapPins = revealed
    ? results.map((item) => ({ coordinates: pins[item.player]!, label: `${players[item.player].name} · ${Math.round(item.distanceKm).toLocaleString("en")} km`, color: players[item.player].color, target: item.distanceKm >= .5 ? item.nearest : undefined }))
    : draft ? [{ coordinates: draft, label: `${player.name}'s pin`, color: player.color }] : [];
  return (
    <main className="atlas-game-page">
      <header className="atlas-game-header">
        <button type="button" className="atlas-icon-button" onClick={onExit} aria-label="Leave hotseat"><ArrowLeft /></button>
        <div><span className="atlas-eyebrow">{mode.title} · Hotseat</span><strong>Round {round + 1} / {questions.length}</strong></div>
        <div className="atlas-game-stats">{!revealed && <span className="atlas-turn-chip" style={{ "--player": player.color } as CSSProperties}><i />{player.name}</span>}<span><Trophy size={16} />{revealed ? "Reveal" : `${step + 1}/${players.length} pinning`}</span></div>
      </header>
      <section className="atlas-play-layout">
        <aside className="atlas-question-panel">
          <div className="atlas-progress"><i style={{ width: `${(round + Number(revealed)) / questions.length * 100}%` }} /></div>
          <span className="atlas-eyebrow">{revealed ? "All pins revealed" : `${player.name}'s pin`}</span>
          <h1>{question?.prompt}</h1>
          {question?.interaction === "closest_click" && question.flagAsset && <img className="atlas-question-flag" src={question.flagAsset} alt="Country flag to identify" />}
          {!revealed && <div className="atlas-pin-controls"><p>{draft ? "Click again to move your pin, then lock it in." : `Click anywhere to place a pin. ${question?.interaction === "closest_click" && question.targetRadiusKm ? "Within 20 km of the city center" : "Inside the country"} counts as 0 km.`}</p>
            <button type="button" className="atlas-submit" disabled={!draft} onClick={lock}><MapPin size={18} />Lock pin{step + 1 < players.length ? ` · pass to ${players[order[step + 1]].name}` : " · reveal"}</button></div>}
          {revealed && <>
            <div className="atlas-guess-result is-correct"><strong>{players[results[0].player].name} wins the round — {nameOf(question?.entityId)}</strong>
              <ul>{results.map((item, index) => <li key={item.player}><span>{index === 0 && <Crown size={14} />}{players[item.player].name}</span><span>{item.distanceKm < .5 ? "Inside" : `${Math.round(item.distanceKm).toLocaleString("en")} km`}</span><b>{index === 0 ? `+${ATLAS_SCORING.normalCorrect}` : "—"}</b></li>)}</ul></div>
            <button type="button" className="atlas-submit" onClick={nextRound}>{round + 1 >= questions.length ? "See standings" : "Next round"} <ChevronRight size={18} /></button>
          </>}
          <HotseatScores players={players} scores={scores} unit="" />
        </aside>
        <AtlasWorldMap topology={data.topology} entities={data.countries} pins={mapPins} correctId={revealed ? question?.entityId : null} disabled={revealed} showHoverLabels={false}
          onPoint={revealed ? undefined : setDraft} ariaLabel={question?.prompt} />
      </section>
    </main>
  );
}

/** Territory Battle on one device: players alternate; a correct click captures (or steals) the country, a miss leaves it. */
function TerritoryHotseat({ mode, data, players, settings, onExit, onSetup }: GameProps) {
  const [seed, setSeed] = useState(freshSeed);
  const questions = useMemo(() => generateMatchQuestions({ entities: data.countries, extras: data.extras, datasetVersion: data.version.atlasDataVersion, seed, difficulty: settings.difficulty, count: ATLAS_SCORING.territoryRounds, mode: "territory_battle", categories: settings.categories }), [data, seed, settings.categories, settings.difficulty]);
  const [round, setRound] = useState(0);
  const [ownership, setOwnership] = useState<Record<string, "player_a" | "player_b">>({});
  const [feedback, setFeedback] = useState<{ selected: string; correct: boolean; previous?: "player_a" | "player_b" } | null>(null);
  const [done, setDone] = useState(false);
  const { schedule, clear } = useTrialTimers();
  const question = questions[round], turn = round % 2, player = players[turn], side = turn === 0 ? "player_a" : "player_b";
  const counts = [Object.values(ownership).filter((owner) => owner === "player_a").length, Object.values(ownership).filter((owner) => owner === "player_b").length];
  const nameOf = (id?: string) => data.countries.find((entity) => entity.id === id)?.shortName ?? "";

  const select = (entityId: string) => {
    if (!question || feedback) return;
    const correct = validateAnswer(question, entityId);
    setFeedback({ selected: entityId, correct, previous: ownership[question.entityId] });
    if (correct) setOwnership((current) => ({ ...current, [question.entityId]: side }));
    schedule(() => {
      setFeedback(null);
      if (round + 1 >= questions.length) setDone(true); else setRound(round + 1);
    }, 1500);
  };
  const again = () => { clear(); setSeed(freshSeed()); setRound(0); setOwnership({}); setFeedback(null); setDone(false); };

  if (done) return <Standings title={mode.title} rows={players.map((item, index) => ({ player: item, score: counts[index] }))} unit="countries" onAgain={again} onSetup={onSetup} onExit={onExit} />;
  const captured = feedback?.correct ? feedback.previous && feedback.previous !== side ? `${player.name} steals ${nameOf(question?.entityId)}` : feedback.previous ? `${player.name} holds ${nameOf(question?.entityId)}` : `${player.name} captures ${nameOf(question?.entityId)}` : null;
  return (
    <main className="atlas-game-page">
      <header className="atlas-game-header">
        <button type="button" className="atlas-icon-button" onClick={onExit} aria-label="Leave hotseat"><ArrowLeft /></button>
        <div><span className="atlas-eyebrow">{mode.title} · Hotseat</span><strong>Round {round + 1} / {questions.length}</strong></div>
        <div className="atlas-game-stats"><span className="atlas-turn-chip" style={{ "--player": player.color } as CSSProperties}><i />{player.name}'s turn</span><span><Trophy size={16} />{counts[0]} – {counts[1]}</span></div>
      </header>
      <section className="atlas-play-layout">
        <aside className="atlas-question-panel">
          <div className="atlas-progress"><i style={{ width: `${round / questions.length * 100}%` }} /></div>
          <span className="atlas-eyebrow">{round >= questions.length / 2 ? "Second half · countries can be stolen" : "First half · capture countries"}</span>
          <div className="atlas-turn-banner" style={{ "--player": player.color } as CSSProperties}><i />{player.name}, your turn</div>
          <h1>{question?.prompt}</h1>
          {question?.interaction === "map_click" && question.flagAsset && <img className="atlas-question-flag" src={question.flagAsset} alt="Country flag to identify" />}
          {feedback && <div className={`atlas-feedback ${feedback.correct ? "is-correct" : "is-wrong"}`}>{feedback.correct ? <Check /> : <X />}<div><strong>{captured ?? `Missed — ${nameOf(question?.entityId)} stays ${feedback.previous ? `with ${players[feedback.previous === "player_a" ? 0 : 1].name}` : "neutral"}`}</strong><span>{feedback.correct ? "Captured countries count at the end." : "A miss captures nothing."}</span></div></div>}
          <HotseatScores players={players} scores={counts} unit=" countries" />
        </aside>
        <AtlasWorldMap topology={data.topology} entities={data.countries} ownership={ownership} onSelect={select} selectedId={feedback?.selected} correctId={feedback ? question?.entityId : null} incorrectId={feedback && !feedback.correct ? feedback.selected : null}
          disabled={Boolean(feedback)} showHoverLabels={false} ariaLabel={question?.prompt} />
      </section>
    </main>
  );
}

function HotseatScores({ players, scores, unit }: { players: Player[]; scores: number[]; unit: string }) {
  return <div className="atlas-scoreboard">{players.map((player, index) => <div key={index}><span><i style={{ background: player.color }} />{player.name}</span><strong>{scores[index].toLocaleString("en")}{scores[index] === 1 ? unit.replace(/ies$/, "y") : unit}</strong></div>)}</div>;
}
