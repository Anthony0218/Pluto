import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight, Clock3, Flag, Globe2, Info, Map, MapPin, RotateCcw, Sparkles, Swords, Trophy, X, Zap } from "lucide-react";
import { AtlasWorldMap } from "../../../components/atlas/AtlasWorldMap";
import { DIFFICULTY_RULES } from "../../../games/atlas/config";
import { entitiesForScope, generateQuestions, validateAnswer } from "../../../games/atlas/engine";
import { seededRandom, shuffled } from "../../../games/atlas/random";
import { applyMapFillSelection, createMapFillState, normalScore, speedRunScore } from "../../../games/atlas/rules";
import type { AtlasCategory, AtlasDifficulty, AtlasMode, AtlasQuestion, GeographicEntity } from "../../../games/atlas/types";
import { useAtlasData } from "../../../games/atlas/useAtlasData";
import "./atlas-arena.css";

const categories: { id: AtlasCategory; label: string }[] = [
  { id: "countries", label: "Countries" }, { id: "locations", label: "Locations" }, { id: "capitals", label: "Capitals" },
  { id: "flags", label: "Flags" }, { id: "population", label: "Population" }, { id: "area", label: "Area" },
  { id: "continents", label: "Continents" }, { id: "languages", label: "Languages" }, { id: "borders", label: "Borders" }, { id: "currency", label: "Currency" },
];
const modeDetails = [
  { id: "map_click" as const, title: "Map Click", description: "Find countries from names, capitals, flags and facts.", icon: MapPin, accent: "cyan" },
  { id: "speed_run" as const, title: "Speed Run", description: "Answer as many mixed questions as you can in 60 seconds.", icon: Zap, accent: "amber" },
  { id: "map_fill" as const, title: "Map Fill", description: "Fill every country in a region with no labels to guide you.", icon: Map, accent: "violet" },
];
const multiplayerModes = [
  ["Map Battle", "Race an opponent to the same target.", Swords], ["Closest Wins", "Place the nearest pin on Earth.", MapPin],
  ["Higher or Lower", "Compare live sourced statistics.", Sparkles], ["Territory Battle", "Capture a 20-round world board.", Flag],
] as const;
const scopes = ["World", "Europe", "Asia", "Africa", "North America", "South America", "Oceania"];

type Screen = "landing" | "setup" | "playing" | "result" | "about";
type SessionStats = { score: number; correct: number; wrong: number; streak: number; bestStreak: number; responseTotal: number; missed: string[]; mastered: string[] };
const emptyStats = (): SessionStats => ({ score: 0, correct: 0, wrong: 0, streak: 0, bestStreak: 0, responseTotal: 0, missed: [], mastered: [] });

export default function AtlasArenaPage() {
  const { data, loading, error } = useAtlasData();
  const [screen, setScreen] = useState<Screen>("landing");
  const [mode, setMode] = useState<AtlasMode>("map_click");
  const [difficulty, setDifficulty] = useState<AtlasDifficulty>("intermediate");
  const [selectedCategories, setSelectedCategories] = useState<AtlasCategory[]>(["countries", "locations", "capitals", "flags"]);
  const [fillScope, setFillScope] = useState("Europe");
  const [questions, setQuestions] = useState<AtlasQuestion[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [stats, setStats] = useState(emptyStats);
  const [feedback, setFeedback] = useState<{ selected: string; correct: boolean } | null>(null);
  const [multiAnswers, setMultiAnswers] = useState<string[]>([]);
  const [remainingMs, setRemainingMs] = useState(60_000);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [fillState, setFillState] = useState(() => createMapFillState([]));
  const [startedAt, setStartedAt] = useState(0);
  const [finishedAt, setFinishedAt] = useState(0);
  const questionStartedAt = useRef(0);
  const advanceTimer = useRef<number | null>(null);
  const currentQuestion = questions[questionIndex];

  const stopAdvanceTimer = () => { if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current); advanceTimer.current = null; };
  useEffect(() => stopAdvanceTimer, []);
  useEffect(() => {
    if (screen !== "playing" || mode !== "speed_run") return;
    const interval = window.setInterval(() => {
      setRemainingMs((current) => {
        if (current <= 100) { window.clearInterval(interval); setFinishedAt(Date.now()); setScreen("result"); return 0; }
        return current - 100;
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [mode, screen]);
  useEffect(() => {
    if (screen !== "playing" || mode !== "map_fill") return;
    const interval = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 1000);
    return () => window.clearInterval(interval);
  }, [mode, screen, startedAt]);

  const startGame = useCallback(() => {
    if (!data) return;
    const seed = `${Date.now().toString(36)}-${mode}-${difficulty}`;
    setStats(emptyStats()); setFeedback(null); setQuestionIndex(0); setMultiAnswers([]); setRemainingMs(60_000); setElapsedMs(0); setFinishedAt(0); setStartedAt(Date.now()); questionStartedAt.current = Date.now();
    if (mode === "map_fill") {
      const pool = entitiesForScope(data.countries, "un195").filter((entity) => fillScope === "World" || entity.continent === fillScope);
      const targets = shuffled(pool, seededRandom(`${data.version.atlasDataVersion}:${seed}:${fillScope}`)).map((entity) => entity.id);
      setQuestions([]); setFillState(createMapFillState(targets));
    } else {
      setQuestions(generateQuestions({ entities: data.countries, datasetVersion: data.version.atlasDataVersion, seed, difficulty, categories: selectedCategories, interaction: mode === "map_click" ? "map_click" : "mixed", count: mode === "speed_run" ? 120 : 10 }));
    }
    setScreen("playing");
  }, [data, difficulty, fillScope, mode, selectedCategories]);

  const advance = useCallback(() => {
    setFeedback(null); setMultiAnswers([]); questionStartedAt.current = Date.now();
    setQuestionIndex((current) => {
      if (mode !== "speed_run" && current + 1 >= questions.length) { setFinishedAt(Date.now()); setScreen("result"); return current; }
      return current + 1;
    });
  }, [mode, questions.length]);

  const answer = useCallback((value: string | string[]) => {
    if (!currentQuestion || feedback) return;
    const correct = validateAnswer(currentQuestion, value);
    const selected = Array.isArray(value) ? value.join("|") : value;
    const responseTime = Date.now() - questionStartedAt.current;
    setFeedback({ selected, correct });
    setStats((current) => {
      const streak = correct ? current.streak + 1 : 0;
      const points = mode === "speed_run" ? speedRunScore(correct, streak) : normalScore(correct, Math.max(0, DIFFICULTY_RULES[difficulty].roundSeconds * 1000 - responseTime), DIFFICULTY_RULES[difficulty].roundSeconds * 1000);
      return { ...current, score: current.score + points, correct: current.correct + Number(correct), wrong: current.wrong + Number(!correct), streak, bestStreak: Math.max(current.bestStreak, streak), responseTotal: current.responseTotal + responseTime, mastered: correct ? [...current.mastered, currentQuestion.entityId] : current.mastered, missed: correct ? current.missed : [...current.missed, currentQuestion.entityId] };
    });
    stopAdvanceTimer();
    advanceTimer.current = window.setTimeout(advance, mode === "speed_run" ? 320 : 1000);
  }, [advance, currentQuestion, difficulty, feedback, mode]);

  const selectMap = (entityId: string) => {
    if (mode === "map_fill") {
      const expected = fillState.targets[fillState.found.length];
      const next = applyMapFillSelection(fillState, entityId, expected);
      setFillState(next);
      if (next.complete) window.setTimeout(() => { setFinishedAt(Date.now()); setScreen("result"); }, 650);
      return;
    }
    if (currentQuestion?.interaction === "map_click") answer(entityId);
  };

  if (loading) return <AtlasLoading />;
  if (error || !data) return <main className="atlas-page atlas-center"><Globe2 size={44} /><h1>Atlas data unavailable</h1><p>{error}</p><Link to="/games">Back to Pluto</Link></main>;
  if (screen === "about") return <AboutPanel version={data.version.atlasDataVersion} onBack={() => setScreen("landing")} />;
  if (screen === "landing") return <AtlasHome onSolo={(selected) => { setMode(selected); setScreen("setup"); }} onAbout={() => setScreen("about")} />;
  if (screen === "setup") return <Setup mode={mode} difficulty={difficulty} setDifficulty={setDifficulty} selectedCategories={selectedCategories} setSelectedCategories={setSelectedCategories} fillScope={fillScope} setFillScope={setFillScope} onBack={() => setScreen("landing")} onStart={startGame} />;
  if (screen === "result") return <Results mode={mode} stats={stats} fillState={fillState} elapsed={finishedAt - startedAt} entities={data.countries} onAgain={startGame} onModes={() => setScreen("landing")} />;

  const correctId = feedback && currentQuestion && currentQuestion.interaction !== "closest_click" ? currentQuestion.entityId : null;
  const wrongId = feedback && !feedback.correct ? feedback.selected : null;
  const expectedFillId = fillState.targets[fillState.found.length];
  const expectedFill = data.countries.find((entity) => entity.id === expectedFillId);
  return (
    <main className="atlas-game-page">
      <header className="atlas-game-header">
        <button type="button" className="atlas-icon-button" onClick={() => setScreen("setup")} aria-label="Exit game"><ArrowLeft /></button>
        <div><span className="atlas-eyebrow">{mode.replace("_", " ")}</span><strong>{mode === "map_fill" ? fillScope : `Question ${questionIndex + 1}${mode === "map_click" ? ` / ${questions.length}` : ""}`}</strong></div>
        <div className="atlas-game-stats"><span><Trophy size={16} />{mode === "map_fill" ? fillState.score : stats.score}</span>{mode === "speed_run" && <span><Clock3 size={16} />{(remainingMs / 1000).toFixed(1)}</span>}<span>{mode === "map_fill" ? `${fillState.found.length}/${fillState.targets.length}` : `${stats.correct} ✓`}</span></div>
      </header>
      <section className="atlas-play-layout">
        <div className="atlas-question-panel">
          <div className="atlas-progress"><i style={{ width: mode === "map_fill" ? `${fillState.targets.length ? fillState.found.length / fillState.targets.length * 100 : 0}%` : `${mode === "speed_run" ? remainingMs / 600 : questionIndex / questions.length * 100}%` }} /></div>
          <span className="atlas-eyebrow">{mode === "map_fill" ? `${fillState.targets.length - fillState.found.length} remaining` : currentQuestion?.category}</span>
          <h1>{mode === "map_fill" ? `Find ${expectedFill?.shortName || "the next country"}` : currentQuestion?.prompt}</h1>
          {currentQuestion?.interaction === "map_click" && currentQuestion.flagAsset && <img className="atlas-question-flag" src={currentQuestion.flagAsset} alt="Country flag to identify" />}
          {currentQuestion && currentQuestion.interaction !== "map_click" && <QuestionControls question={currentQuestion} feedback={feedback} answers={multiAnswers} setAnswers={setMultiAnswers} onAnswer={answer} entities={data.countries} />}
          {feedback && <div className={`atlas-feedback ${feedback.correct ? "is-correct" : "is-wrong"}`}>{feedback.correct ? <Check /> : <X />}<div><strong>{feedback.correct ? "Correct" : "Not quite"}</strong><span>{data.countries.find((entity) => entity.id === currentQuestion?.entityId)?.shortName}{currentQuestion?.sourceMetadata[0] ? ` · ${currentQuestion.sourceMetadata[0].source}${currentQuestion.sourceMetadata[0].year ? ` ${currentQuestion.sourceMetadata[0].year}` : ""}` : ""}</span></div></div>}
          {mode === "map_fill" && <div className="atlas-fill-meta"><span>{fillState.mistakes} mistakes</span><span>{fillState.streak} streak</span><span>{Math.round(fillState.found.length / Math.max(1, fillState.targets.length) * 100)}% complete</span><span>{Math.floor(elapsedMs / 1000)}s elapsed</span></div>}
        </div>
        <AtlasWorldMap topology={data.topology} entities={data.countries} onSelect={selectMap} selectedId={feedback?.selected || (currentQuestion?.interaction === "single_choice" && currentQuestion.category === "countries" ? currentQuestion.entityId : null)} correctId={correctId} incorrectId={wrongId} filledIds={fillState.found} disabled={Boolean(feedback) && mode !== "map_fill"} showHoverLabels={mode !== "map_fill" && currentQuestion?.interaction !== "map_click" && currentQuestion?.category !== "countries"} ariaLabel={mode === "map_fill" ? `World map. Find ${expectedFill?.shortName}.` : currentQuestion?.prompt} />
      </section>
    </main>
  );
}

function AtlasHome({ onSolo, onAbout }: { onSolo: (mode: AtlasMode) => void; onAbout: () => void }) {
  return <main className="atlas-page atlas-home-page"><section className="atlas-home-intro"><div className="atlas-orbit"><Globe2 /></div><span className="atlas-eyebrow">Pluto geography laboratory</span><h1>Atlas <em>Arena</em></h1><p>A controlled, data-backed way to learn the world. Pick a protocol to begin.</p></section><section className="atlas-home-protocols" aria-label="Choose Atlas play mode"><button type="button" className="atlas-protocol-card is-solo" onClick={() => onSolo("map_click")}><MapPin /><span className="atlas-eyebrow">Protocol 01 · individual</span><strong>Singleplayer</strong><small>Run map, flag and fact expeditions at your own pace.</small><i>Begin solo analysis <ChevronRight /></i></button><Link className="atlas-protocol-card is-multi" to="/games/atlas-arena/multiplayer"><Swords /><span className="atlas-eyebrow">Protocol 02 · live sync</span><strong>Multiplayer</strong><small>Challenge a friend in synchronized, server-verified rounds.</small><i>Enter live arena <ChevronRight /></i></Link></section><div className="atlas-home-footer"><button type="button" onClick={onAbout}><Info size={15} /> Dataset & method</button><Link to="/games"><ArrowLeft size={15} /> Back to Pluto</Link><span>Natural Earth · UN · GeoNames · World Bank</span></div></main>;
}

function Landing({ onSolo, onAbout }: { onSolo: (mode: AtlasMode) => void; onAbout: () => void }) {
  return <main className="atlas-page"><section className="atlas-hero"><div className="atlas-orbit"><Globe2 /></div><span className="atlas-eyebrow">Pluto presents</span><h1>Atlas <em>Arena</em></h1><p>Learn the world by playing it. Race across borders, capitals, flags and facts on a living global board.</p><div className="atlas-hero-actions"><button type="button" onClick={() => onSolo("map_click")}>Start exploring <ChevronRight /></button><button type="button" className="atlas-secondary" onClick={onAbout}><Info /> Data sources</button></div></section><section className="atlas-mode-section"><div className="atlas-section-title"><div><span className="atlas-eyebrow">Solo expeditions</span><h2>Choose your challenge</h2></div><span>10 knowledge categories</span></div><div className="atlas-card-grid">{modeDetails.map(({ id, title, description, icon: Icon, accent }) => <button type="button" key={id} className={`atlas-mode-card atlas-accent-${accent}`} onClick={() => onSolo(id)}><span className="atlas-mode-icon"><Icon /></span><span><strong>{title}</strong><small>{description}</small></span><ChevronRight /></button>)}</div></section><section className="atlas-mode-section"><div className="atlas-section-title"><div><span className="atlas-eyebrow">Live duels</span><h2>Multiplayer arenas</h2></div><span className="atlas-live"><i /> Supabase realtime</span></div><div className="atlas-multiplayer-grid">{multiplayerModes.map(([title, description, Icon]) => <Link to="/games/atlas-arena/multiplayer" key={title} className="atlas-duel-card"><Icon /><strong>{title}</strong><small>{description}</small></Link>)}</div></section><footer className="atlas-footer"><Link to="/games"><ArrowLeft /> Back to Pluto</Link><span>Dataset 2026-09 · Natural Earth / UN / GeoNames / World Bank</span></footer></main>;
}

function Setup({ mode, difficulty, setDifficulty, selectedCategories, setSelectedCategories, fillScope, setFillScope, onBack, onStart }: { mode: AtlasMode; difficulty: AtlasDifficulty; setDifficulty: (value: AtlasDifficulty) => void; selectedCategories: AtlasCategory[]; setSelectedCategories: (value: AtlasCategory[]) => void; fillScope: string; setFillScope: (value: string) => void; onBack: () => void; onStart: () => void }) {
  return <main className="atlas-page atlas-setup"><button type="button" className="atlas-back" onClick={onBack}><ArrowLeft /> Modes</button><div className="atlas-setup-card"><span className="atlas-eyebrow">Configure expedition</span><h1>{modeDetails.find((item) => item.id === mode)?.title}</h1><p>{modeDetails.find((item) => item.id === mode)?.description}</p><label className="atlas-label">Difficulty</label><div className="atlas-segmented">{(["beginner", "intermediate", "expert"] as const).map((item) => <button type="button" className={difficulty === item ? "active" : ""} key={item} onClick={() => setDifficulty(item)}>{item}<small>{DIFFICULTY_RULES[item].roundSeconds}s rounds</small></button>)}</div>{mode === "map_fill" ? <><label className="atlas-label">Geographic scope</label><div className="atlas-chip-grid">{scopes.map((scope) => <button type="button" className={fillScope === scope ? "active" : ""} key={scope} onClick={() => setFillScope(scope)}>{scope}</button>)}</div></> : <><label className="atlas-label">Question categories</label><div className="atlas-chip-grid">{categories.map((category) => { const selected = selectedCategories.includes(category.id); return <button type="button" aria-pressed={selected} className={selected ? "active" : ""} key={category.id} onClick={() => setSelectedCategories(selected ? selectedCategories.filter((id) => id !== category.id) : [...selectedCategories, category.id])}>{selected && <Check size={14} />}{category.label}</button>; })}</div></>}<button type="button" className="atlas-start" disabled={mode !== "map_fill" && !selectedCategories.length} onClick={onStart}>Enter the arena <ChevronRight /></button></div></main>;
}

function QuestionControls({ question, feedback, answers, setAnswers, onAnswer, entities }: { question: AtlasQuestion; feedback: { selected: string; correct: boolean } | null; answers: string[]; setAnswers: (answers: string[]) => void; onAnswer: (answer: string | string[]) => void; entities: GeographicEntity[] }) {
  if (question.interaction === "higher_lower") { const reference = entities.find((entity) => entity.id === question.comparisonEntityId); return <div className="atlas-higher-lower"><div><small>{reference?.shortName}</small><strong>{new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(question.stat.firstValue)}</strong><span>{question.stat.label}{question.stat.year ? ` · ${question.stat.year}` : ""}</span></div><div className="atlas-choice-grid"><button type="button" disabled={Boolean(feedback)} onClick={() => onAnswer("higher")}>Higher ↑</button><button type="button" disabled={Boolean(feedback)} onClick={() => onAnswer("lower")}>Lower ↓</button></div></div>; }
  if (question.interaction === "single_choice") return <div className="atlas-choice-grid">{question.choices.map((choice) => <button type="button" aria-label={choice.label} disabled={Boolean(feedback)} className={feedback?.selected === choice.id ? "selected" : ""} key={choice.id} onClick={() => onAnswer(choice.id)}>{choice.flagAsset && <img src={choice.flagAsset} alt="" />}{question.category !== "flags" && choice.label}</button>)}</div>;
  if (question.interaction === "multi_select") return <><div className="atlas-choice-grid">{question.choices.map((choice) => <button type="button" disabled={Boolean(feedback)} aria-pressed={answers.includes(choice.id)} className={answers.includes(choice.id) ? "selected" : ""} key={choice.id} onClick={() => setAnswers(answers.includes(choice.id) ? answers.filter((id) => id !== choice.id) : [...answers, choice.id])}>{choice.label}</button>)}</div><button type="button" className="atlas-submit" disabled={!answers.length || Boolean(feedback)} onClick={() => onAnswer(answers)}>Submit selection</button></>;
  return null;
}

function Results({ mode, stats, fillState, elapsed, entities, onAgain, onModes }: { mode: AtlasMode; stats: SessionStats; fillState: ReturnType<typeof createMapFillState>; elapsed: number; entities: GeographicEntity[]; onAgain: () => void; onModes: () => void }) {
  const answered = stats.correct + stats.wrong, score = mode === "map_fill" ? fillState.score : stats.score;
  return <main className="atlas-page atlas-center"><div className="atlas-result-orbit"><Trophy /></div><span className="atlas-eyebrow">Expedition complete</span><h1>{mode === "map_fill" && fillState.complete ? "Region mastered" : "Great run"}</h1><p className="atlas-result-score">{new Intl.NumberFormat("en").format(score)} <small>points</small></p><div className="atlas-result-grid"><div><strong>{mode === "map_fill" ? fillState.found.length : stats.correct}</strong><span>Correct</span></div><div><strong>{mode === "map_fill" ? fillState.mistakes : `${answered ? Math.round(stats.correct / answered * 100) : 0}%`}</strong><span>{mode === "map_fill" ? "Mistakes" : "Accuracy"}</span></div><div><strong>{mode === "map_fill" ? fillState.bestStreak : stats.bestStreak}</strong><span>Best streak</span></div><div><strong>{Math.round(elapsed / 1000)}s</strong><span>Elapsed</span></div></div>{stats.missed.length > 0 && <p className="atlas-missed">Review: {[...new Set(stats.missed)].slice(0, 5).map((id) => entities.find((entity) => entity.id === id)?.shortName).filter(Boolean).join(", ")}</p>}<div className="atlas-result-actions"><button type="button" onClick={onAgain}><RotateCcw /> Play again</button><button type="button" className="atlas-secondary" onClick={onModes}>Change mode</button><Link to="/games">Back to Pluto</Link></div></main>;
}

function AboutPanel({ version, onBack }: { version: string; onBack: () => void }) { return <main className="atlas-page atlas-about"><button type="button" className="atlas-back" onClick={onBack}><ArrowLeft /> Atlas Arena</button><span className="atlas-eyebrow">Data & boundaries</span><h1>Built on traceable geography</h1><p>Atlas Arena uses a bundled snapshot—never a live API during a match. Every multiplayer room pins its dataset version so both players generate the same rounds.</p><div className="atlas-source-list"><article><strong>Natural Earth 1:110m</strong><span>Admin-0 boundary geometry · public domain</span></article><article><strong>United Nations M49</strong><span>Identifiers and statistical regions</span></article><article><strong>GeoNames</strong><span>Names, capitals, coordinates, languages and neighbors · CC BY 4.0</span></article><article><strong>World Bank</strong><span>Population (SP.POP.TOTL) and surface area (AG.SRF.TOTL.K2), including observation year</span></article><article><strong>flag-icons</strong><span>Bundled SVG flags · MIT</span></article></div><div className="atlas-boundary-note"><Info /><p>Natural Earth renders de facto boundaries. Rendering is separate from quiz eligibility: the default game uses an explicit UN 195 scope, while territories remain available in the data. Dataset: <strong>{version}</strong>.</p></div></main>; }
function AtlasLoading() { return <main className="atlas-page atlas-center"><div className="atlas-orbit is-loading"><Globe2 /></div><h1>Preparing the world…</h1><p>Loading the versioned Atlas snapshot.</p></main>; }
