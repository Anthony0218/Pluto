import AtlasAreaReference from "./AtlasAreaReference";
import { AtlasResultHero } from "./AtlasResultHero";
import { areaValuesFromText } from "@/games/atlas/areaReferences";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, Check, Clock3, Crosshair, MapPin, Trophy, X } from "lucide-react";
import { CountryGuessInput, FlagChoices, FlagPrompt, GuessClueList, HigherLowerCards } from "./AtlasPartyPanels";
import { AtlasCategoryPicker } from "./AtlasCategoryPicker";
import { AtlasWorldMap } from "./AtlasWorldMap";
import { COMPARISON_CATEGORIES, QUESTION_CATEGORIES } from "../../games/atlas/categories";
import { generateComparisonQuestions } from "../../games/atlas/comparisons";
import { DIFFICULTY_RULES } from "../../games/atlas/config";
import { generateQuestions, validateAnswer } from "../../games/atlas/engine";
import { generateFlagQuestions } from "../../games/atlas/flags";
import { generateGuessCountryQuestions, scoreGuessTip, type GuessAward } from "../../games/atlas/guessCountry";
import { generateMatchQuestions } from "../../games/atlas/matchQuestions";
import type { ArenaModeDef } from "../../games/atlas/modeCatalog";
import { seededRandom, shuffled } from "../../games/atlas/random";
import { applyMapFillSelection, closestScore, createMapFillState, normalScore, speedRunScore } from "../../games/atlas/rules";
import { entitiesInFillScope, FILL_SCOPES, focusForScope } from "../../games/atlas/scopes";
import { DIFFICULTY_LABELS, type SoloSettings, type SoloSummary } from "../../games/atlas/soloSettings";
import { countryShapesFromTopology, distanceToTerritory } from "../../games/atlas/territoryDistance";
import type { AtlasDataset, AtlasDifficulty, AtlasMode, AtlasQuestion, Coordinates, GeographicEntity } from "../../games/atlas/types";

export type PlayerTag = { name: string; color: string };

const QUESTION_COUNTS: Partial<Record<AtlasMode, number>> = { map_click: 10, closest_wins: 10, speed_run: 120, flags: 12, higher_lower: 100, guess_country: 8 };
/** Modes whose question panel takes the full width: the world map would give the answer away or has no role. */
const PANEL_ONLY: AtlasMode[] = ["flags", "higher_lower", "speed_run"];

type GuessState = { tip: number; selectedId: string | null; wrong: string[]; result: { correct: boolean; award: GuessAward | null } | null };
const freshGuess = (): GuessState => ({ tip: 0, selectedId: null, wrong: [], result: null });
type SessionStats = { score: number; correct: number; wrong: number; streak: number; bestStreak: number; missed: string[]; distanceTotal: number };
const emptyStats = (): SessionStats => ({ score: 0, correct: 0, wrong: 0, streak: 0, bestStreak: 0, missed: [], distanceTotal: 0 });
const record = (current: SessionStats, correct: boolean, points: number, entityId: string): SessionStats => {
  const streak = correct ? current.streak + 1 : 0;
  return { ...current, score: current.score + points, correct: current.correct + Number(correct), wrong: current.wrong + Number(!correct), streak, bestStreak: Math.max(current.bestStreak, streak), missed: correct ? current.missed : [...current.missed, entityId] };
};

/** Every question of a run comes from the seed, so hotseat players and online racers can share (or vary) it. */
function buildRun(data: AtlasDataset, mode: AtlasMode, settings: SoloSettings, seed: string): { questions: AtlasQuestion[]; fillTargets: string[] } {
  const common = { entities: data.countries, extras: data.extras, datasetVersion: data.version.atlasDataVersion, seed, difficulty: settings.difficulty, count: QUESTION_COUNTS[mode] ?? 10 };
  if (mode === "map_fill") {
    const pool = entitiesInFillScope(data.countries, settings.scope);
    return { questions: [], fillTargets: shuffled(pool, seededRandom(`${data.version.atlasDataVersion}:${seed}:${settings.scope}`)).map((entity) => entity.id) };
  }
  if (mode === "flags") return { questions: generateFlagQuestions(common), fillTargets: [] };
  if (mode === "higher_lower") return { questions: generateComparisonQuestions({ ...common, chain: true, stats: settings.stats }), fillTargets: [] };
  if (mode === "guess_country") return { questions: generateGuessCountryQuestions(common), fillTargets: [] };
  if (mode === "closest_wins") return { questions: generateMatchQuestions({ ...common, mode, categories: settings.categories }), fillTargets: [] };
  return { questions: generateQuestions({ ...common, categories: mode === "map_click" ? ["locations"] : settings.categories, interaction: mode === "map_click" ? "map_click" : mode === "speed_run" ? "choice" : "mixed" }), fillTargets: [] };
}

/** One player's run of a map/quiz mode: the questions, the map and the scoring. Results are handed to `onFinish`. */
export function AtlasSoloGame({ data, mode, settings, seed, title, player, onFinish, onExit, onScore }: {
  data: AtlasDataset; mode: AtlasMode; settings: SoloSettings; seed: string; title: string; player?: PlayerTag;
  onFinish: (summary: SoloSummary) => void; onExit: () => void; onScore?: (score: number) => void;
}) {
  const [run] = useState(() => buildRun(data, mode, settings, seed));
  const { questions } = run;
  const [questionIndex, setQuestionIndex] = useState(0);
  const [stats, setStats] = useState(emptyStats);
  const [feedback, setFeedback] = useState<{ selected: string; correct: boolean } | null>(null);
  const [multiAnswers, setMultiAnswers] = useState<string[]>([]);
  const [remainingMs, setRemainingMs] = useState(60_000);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [fillState, setFillState] = useState(() => createMapFillState(run.fillTargets));
  const [guess, setGuess] = useState<GuessState>(freshGuess);
  const [pin, setPin] = useState<Coordinates | null>(null);
  const [closest, setClosest] = useState<{ distanceKm: number; nearest: Coordinates; points: number } | null>(null);
  const [over, setOver] = useState(false);
  const startedAt = useRef(0), questionStartedAt = useRef(0), reported = useRef(false);
  const advanceTimer = useRef<number | null>(null);
  const shapes = useMemo(() => mode === "closest_wins" ? countryShapesFromTopology(data.topology) : undefined, [data.topology, mode]);
  const currentQuestion = questions[questionIndex];
  const score = mode === "map_fill" ? fillState.score : stats.score;

  const stopAdvanceTimer = () => { if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current); advanceTimer.current = null; };
  useEffect(() => { startedAt.current = Date.now(); questionStartedAt.current = Date.now(); return stopAdvanceTimer; }, []);
  useEffect(() => { onScore?.(score); }, [onScore, score]);
  useEffect(() => {
    if (!over || reported.current) return;
    reported.current = true;
    onFinish({ score, correct: mode === "map_fill" ? fillState.found.length : stats.correct, wrong: mode === "map_fill" ? fillState.mistakes : stats.wrong, bestStreak: mode === "map_fill" ? fillState.bestStreak : stats.bestStreak,
      elapsedMs: Date.now() - startedAt.current, missed: stats.missed, fill: mode === "map_fill" ? fillState : undefined,
      averageKm: mode === "closest_wins" ? stats.distanceTotal / Math.max(1, stats.correct + stats.wrong) : undefined });
  }, [fillState, mode, onFinish, over, score, stats]);
  useEffect(() => {
    if (over || mode !== "speed_run") return;
    const interval = window.setInterval(() => {
      const remaining=Math.max(0,60_000-(Date.now()-startedAt.current));
      setRemainingMs(remaining);
      if(remaining===0){window.clearInterval(interval);setOver(true);}
    }, 100);
    return () => window.clearInterval(interval);
  }, [mode, over]);
  useEffect(() => {
    if (over || mode !== "map_fill") return;
    const interval = window.setInterval(() => setElapsedMs(Date.now() - startedAt.current), 1000);
    return () => window.clearInterval(interval);
  }, [mode, over]);

  const advanceFrom = useCallback((index: number) => {
    setFeedback(null); setGuess(freshGuess()); setMultiAnswers([]); setPin(null); setClosest(null); questionStartedAt.current = Date.now();
    if (index + 1 >= questions.length) setOver(true);
    else setQuestionIndex(index + 1);
  }, [questions.length]);

  const answer = useCallback((value: string | string[]) => {
    if (!currentQuestion || feedback || over) return;
    const correct = validateAnswer(currentQuestion, value);
    const selected = Array.isArray(value) ? value.join("|") : value;
    const responseTime = Date.now() - questionStartedAt.current;
    const roundMs = DIFFICULTY_RULES[settings.difficulty].roundSeconds * 1000;
    setFeedback({ selected, correct });
    setStats((current) => {
      return record(current, correct, mode === "speed_run" ? speedRunScore(correct) : normalScore(correct, Math.max(0, roundMs - responseTime), roundMs), currentQuestion.entityId);
    });
    stopAdvanceTimer();
    // Higher or Lower is a streak: the first miss reveals the value, then ends the run.
    advanceTimer.current = window.setTimeout(mode === "higher_lower" && !correct ? () => setOver(true) : () => advanceFrom(questionIndex),
      mode === "speed_run" ? 320 : mode === "higher_lower" ? 1300 : 1000);
  }, [advanceFrom, currentQuestion, feedback, mode, over, questionIndex, settings.difficulty]);

  /** One guess per tip. A miss reveals the next tip; the last miss reveals the country. */
  const submitGuess = useCallback((entityId: string) => {
    if (currentQuestion?.interaction !== "guess_country" || guess.result) return;
    const correct = currentQuestion.answer === entityId, lastTip = guess.tip + 1 >= currentQuestion.clues.length;
    if (!correct && !lastTip) { setGuess((current) => ({ ...current, tip: current.tip + 1, selectedId: null, wrong: [...current.wrong, entityId] })); return; }
    const award = correct ? scoreGuessTip([{ userId: "you", submittedAt: 0 }], guess.tip)[0] : null;
    setGuess((current) => ({ ...current, selectedId: entityId, wrong: correct ? current.wrong : [...current.wrong, entityId], result: { correct, award } }));
    setStats((current) => record(current, correct, award?.total ?? 0, currentQuestion.entityId));
    stopAdvanceTimer();
    advanceTimer.current = window.setTimeout(() => advanceFrom(questionIndex), 2600);
  }, [advanceFrom, currentQuestion, guess, questionIndex]);

  const submitPin = () => {
    if (currentQuestion?.interaction !== "closest_click" || !pin || closest) return;
    const measured = distanceToTerritory(pin, { geometryId: currentQuestion.targetGeometryId, point: currentQuestion.targetCoordinates, radiusKm: currentQuestion.targetRadiusKm }, shapes);
    const points = closestScore(measured.distanceKm), inside = measured.distanceKm < .5;
    setClosest({ ...measured, points });
    setStats((current) => ({ ...record(current, inside, points, currentQuestion.entityId), distanceTotal: current.distanceTotal + measured.distanceKm }));
    stopAdvanceTimer();
    advanceTimer.current = window.setTimeout(() => advanceFrom(questionIndex), 2800);
  };

  const selectMap = (entityId: string) => {
    if (mode === "map_fill") {
      const expected = fillState.targets[fillState.found.length];
      const next = applyMapFillSelection(fillState, entityId, expected);
      setFillState(next);
      if (next.complete) window.setTimeout(() => setOver(true), 650);
      return;
    }
    if (currentQuestion?.interaction === "map_click") answer(entityId);
    if (currentQuestion?.interaction === "guess_country" && !guess.result) setGuess((current) => ({ ...current, selectedId: entityId }));
  };

  const guessing = currentQuestion?.interaction === "guess_country" ? currentQuestion : null;
  const pinning = currentQuestion?.interaction === "closest_click" ? currentQuestion : null;
  const correctId = (feedback || guess.result || closest) && currentQuestion ? currentQuestion.entityId : null;
  const wrongId = feedback && !feedback.correct ? feedback.selected : guessing ? guess.wrong.at(-1) ?? null : null;
  const expectedFillId = fillState.targets[fillState.found.length];
  const expectedFill = data.countries.find((entity) => entity.id === expectedFillId);
  const nameOf = (id?: string | null) => data.countries.find((entity) => entity.id === id)?.shortName;
  const progress = mode === "map_fill" ? (fillState.targets.length ? fillState.found.length / fillState.targets.length * 100 : 0)
    : mode === "speed_run" ? remainingMs / 600 : mode === "higher_lower" ? Math.min(100, stats.streak * 5) : questionIndex / Math.max(1, questions.length) * 100;
  const pins = pinning && pin ? [{ coordinates: pin, label: closest ? `${Math.round(closest.distanceKm).toLocaleString("en")} km` : "Your pin", color: player?.color ?? "#ffd372", target: closest && closest.distanceKm >= .5 ? closest.nearest : undefined }] : [];
  const counter = mode === "map_fill" ? settings.scope : mode === "higher_lower" ? `Streak ${stats.streak}` : `${mode === "guess_country" ? "Country" : mode === "closest_wins" ? "Round" : "Question"} ${questionIndex + 1}${mode !== "speed_run" ? ` / ${questions.length}` : ""}`;

  return (
    <main className="atlas-game-page">
      <header className="atlas-game-header">
        <button type="button" className="atlas-icon-button" onClick={onExit} aria-label="Exit game"><ArrowLeft /></button>
        <div><span className="atlas-eyebrow">{title}</span><strong>{counter}</strong></div>
        <div className="atlas-game-stats">
          {player && <span className="atlas-turn-chip" style={{ "--player": player.color } as CSSProperties}><i />{player.name}</span>}
          <span><Trophy size={16} />{score}</span>
          {mode === "speed_run" && <span><Clock3 size={16} />{(remainingMs / 1000).toFixed(1)}</span>}
          <span>{mode === "map_fill" ? `${fillState.found.length}/${fillState.targets.length}` : `${stats.correct} ✓`}</span>
        </div>
      </header>
      <section className={`atlas-play-layout ${PANEL_ONLY.includes(mode) ? "is-panel-only" : ""}`}>
        <div className="atlas-question-panel">
          <div className="atlas-progress"><i style={{ width: `${progress}%` }} /></div>
          <span className="atlas-eyebrow">{mode === "map_fill" ? `${fillState.targets.length - fillState.found.length} remaining` : guessing ? `Tip ${guess.tip + 1} of ${guessing.clues.length}` : currentQuestion?.category}</span>
          <h1>{mode === "map_fill" ? `Find ${expectedFill?.shortName || "the next country"}` : currentQuestion?.prompt}</h1>
          {(currentQuestion?.interaction === "map_click" || currentQuestion?.interaction === "closest_click") && currentQuestion.flagAsset && <img className="atlas-question-flag" src={currentQuestion.flagAsset} alt="Country flag to identify" />}
          {mode === "flags" && currentQuestion?.interaction === "single_choice" && <><FlagPrompt question={currentQuestion} topology={data.topology} /><FlagChoices question={currentQuestion} disabled={Boolean(feedback)} selected={feedback?.selected} correctId={feedback ? currentQuestion.answer : null} onAnswer={answer} /></>}
          {currentQuestion?.interaction === "higher_lower" && <HigherLowerCards key={currentQuestion.id} question={currentQuestion} revealed={Boolean(feedback)} disabled={Boolean(feedback)} chosen={feedback?.selected} correct={feedback?.correct} onAnswer={answer} />}
          {guessing && <>{!guess.result && <CountryGuessInput entities={data.countries} selectedId={guess.selectedId} disabled={false} excluded={guess.wrong} onSelect={(id) => setGuess((current) => ({ ...current, selectedId: id }))} onSubmit={submitGuess} />}
            {guess.wrong.length > 0 && <p className="atlas-guess-misses">Not {guess.wrong.map(nameOf).join(", not ")}.</p>}
            <GuessClueList entityId={guessing.entityId} clues={guessing.clues.slice(0, guess.result ? guessing.clues.length : guess.tip + 1)} total={guessing.clues.length} />
            {guess.result && <div className={`atlas-feedback ${guess.result.correct ? "is-correct" : "is-wrong"}`}>{guess.result.correct ? <Check /> : <X />}<div><strong>{guess.result.correct ? `${nameOf(guessing.entityId)} — +${guess.result.award!.total} points` : `It was ${nameOf(guessing.entityId)}`}</strong><span>{guess.result.award ? `${guess.result.award.base} for solving${guess.result.award.bonus ? ` + ${guess.result.award.bonus} tip-${guess.tip + 1} bonus` : ""}` : "No points this time"}</span></div></div>}</>}
          {pinning && <div className="atlas-pin-controls">
            <p>{pin ? `Your pin: ${Math.abs(pin[1]).toFixed(2)}° ${pin[1] >= 0 ? "N" : "S"}, ${Math.abs(pin[0]).toFixed(2)}° ${pin[0] >= 0 ? "E" : "W"}${closest ? "" : " — click again to move it."}` : `Click anywhere to place a pin. ${pinning.targetRadiusKm ? "Within 20 km of the city center" : "Inside the country"} counts as 0 km.`}</p>
            <button type="button" className="atlas-submit" disabled={!pin || Boolean(closest)} onClick={submitPin}><MapPin size={18} />{closest ? "Pin locked" : "Submit pin"}</button>
          </div>}
          {closest && <div className={`atlas-feedback ${closest.points >= 300 ? "is-correct" : "is-wrong"}`}><Crosshair /><div><strong>{closest.distanceKm < .5 ? `${pinning?.targetRadiusKm ? "Inside the city target" : `Inside ${nameOf(currentQuestion?.entityId)}`} — +1,000` : `${Math.round(closest.distanceKm).toLocaleString("en")} km from ${pinning?.targetRadiusKm ? "the city target" : nameOf(currentQuestion?.entityId)} — +${closest.points}`}</strong><span>{pinning?.targetRadiusKm ? "Measured from a 20 km radius around the city center" : "Measured to the nearest border"}</span></div></div>}
          {currentQuestion && !["map_click", "guess_country", "closest_click"].includes(currentQuestion.interaction) && (mode === "speed_run" || !PANEL_ONLY.includes(mode)) && <QuestionControls question={currentQuestion} feedback={feedback} answers={multiAnswers} setAnswers={setMultiAnswers} onAnswer={answer} />}
          {currentQuestion && <AtlasAreaReference values={areaValuesFromText(currentQuestion.prompt)} />}
          {feedback && <div className={`atlas-feedback ${feedback.correct ? "is-correct" : "is-wrong"}`}>{feedback.correct ? <Check /> : <X />}<div><strong>{feedback.correct ? "Correct" : mode === "higher_lower" ? "Streak over" : "Not quite"}</strong><span>{currentQuestion?.interaction === "higher_lower" && currentQuestion.second ? currentQuestion.second.label : nameOf(currentQuestion?.entityId)}{currentQuestion?.sourceMetadata[0] ? ` · ${currentQuestion.sourceMetadata[0].source}${currentQuestion.sourceMetadata[0].year ? ` ${currentQuestion.sourceMetadata[0].year}` : ""}` : ""}</span></div></div>}
          {mode === "map_fill" && <div className="atlas-fill-meta"><span>{fillState.mistakes} mistakes</span><span>{fillState.streak} streak</span><span>{Math.round(fillState.found.length / Math.max(1, fillState.targets.length) * 100)}% complete</span><span>{Math.floor(elapsedMs / 1000)}s elapsed</span></div>}
        </div>
        {!PANEL_ONLY.includes(mode) && <AtlasWorldMap topology={data.topology} entities={data.countries} onSelect={selectMap} onPoint={pinning && !closest ? setPin : undefined} pins={pins}
          selectedId={guessing ? guess.selectedId : feedback?.selected || (currentQuestion?.interaction === "single_choice" && currentQuestion.category === "countries" ? currentQuestion.entityId : null)}
          correctId={correctId} incorrectId={wrongId} filledIds={fillState.found} focus={mode === "map_fill" ? focusForScope(settings.scope) : null}
          disabled={(Boolean(feedback) && mode !== "map_fill") || Boolean(guess.result) || Boolean(closest) || over}
          showHoverLabels={!["map_fill", "closest_wins"].includes(mode) && currentQuestion?.interaction !== "map_click" && currentQuestion?.category !== "countries"}
          ariaLabel={mode === "map_fill" ? `World map. Find ${expectedFill?.shortName}.` : currentQuestion?.prompt} />}
      </section>
    </main>
  );
}

function QuestionControls({ question, feedback, answers, setAnswers, onAnswer }: { question: AtlasQuestion; feedback: { selected: string; correct: boolean } | null; answers: string[]; setAnswers: (answers: string[]) => void; onAnswer: (answer: string | string[]) => void }) {
  if (question.interaction === "single_choice") return <div className="atlas-choice-grid">{question.choices.map((choice) => <button type="button" aria-label={choice.label} disabled={Boolean(feedback)} className={feedback?.selected === choice.id ? "selected" : ""} key={choice.id} onClick={() => onAnswer(choice.id)}>{choice.flagAsset && <img src={choice.flagAsset} alt="" />}{question.category !== "flags" && choice.label}</button>)}</div>;
  if (question.interaction === "multi_select") return <><div className="atlas-choice-grid">{question.choices.map((choice) => <button type="button" disabled={Boolean(feedback)} aria-pressed={answers.includes(choice.id)} className={answers.includes(choice.id) ? "selected" : ""} key={choice.id} onClick={() => setAnswers(answers.includes(choice.id) ? answers.filter((id) => id !== choice.id) : [...answers, choice.id])}>{choice.label}</button>)}</div><button type="button" className="atlas-submit" disabled={!answers.length || Boolean(feedback)} onClick={() => onAnswer(answers)}>Submit selection</button></>;
  return null;
}

/** Headline, score and the four stat tiles after a run; `actions` decides what comes next (again, next player…). */
export function SoloResults({ mode, summary, entities, eyebrow = "Expedition complete", actions }: { mode: AtlasMode; summary: SoloSummary; entities: GeographicEntity[]; eyebrow?: string; actions: ReactNode }) {
  const answered = summary.correct + summary.wrong;
  const headline = mode === "map_fill" && summary.fill?.complete ? "Region mastered" : mode === "higher_lower" ? `Streak of ${summary.bestStreak}`
    : "Great run";
  const tiles = mode === "closest_wins"
      ? [{ value: summary.correct, label: "Bullseyes" }, { value: `${Math.round(summary.averageKm ?? 0).toLocaleString("en")} km`, label: "Average distance" }, { value: answered, label: "Pins" }, { value: `${Math.round(summary.elapsedMs / 1000)}s`, label: "Elapsed" }]
      : [{ value: summary.correct, label: "Correct" }, { value: mode === "map_fill" ? summary.wrong : `${answered ? Math.round(summary.correct / answered * 100) : 0}%`, label: mode === "map_fill" ? "Mistakes" : "Accuracy" }, { value: summary.bestStreak, label: "Best streak" }, { value: `${Math.round(summary.elapsedMs / 1000)}s`, label: "Elapsed" }];
  return <main className="atlas-page atlas-center atlas-random-results"><AtlasResultHero eyebrow={eyebrow} title={headline} />
    <p className="atlas-result-score">{new Intl.NumberFormat("en").format(summary.score)} <small>points</small></p>
    <div className="atlas-result-grid">{tiles.map((tile) => <div key={tile.label}><strong>{tile.value}</strong><span>{tile.label}</span></div>)}</div>
    {summary.missed.length > 0 && <p className="atlas-missed">Review: {[...new Set(summary.missed)].slice(0, 5).map((id) => entities.find((entity) => entity.id === id)?.shortName).filter(Boolean).join(", ")}</p>}
    <div className="atlas-result-actions">{actions}</div></main>;
}

/** Difficulty plus whatever the mode needs (categories, comparison stats, Map Fill region). */
export function SoloSettingsForm({ mode, settings, onChange }: { mode: ArenaModeDef; settings: SoloSettings; onChange: (settings: SoloSettings) => void }) {
  const arenaMode = mode.solo.kind === "arena" ? mode.solo.mode : null;
  const note = (item: AtlasDifficulty) => arenaMode === "guess_country" ? `${item === "beginner" ? "Big" : item === "intermediate" ? "Most" : "All"} countries`
    : arenaMode === "higher_lower" ? `${item === "beginner" ? "Clear" : item === "intermediate" ? "Closer" : "Tight"} gaps`
      : arenaMode && ["map_click", "flags", "speed_run"].includes(arenaMode) ? `${DIFFICULTY_RULES[item].roundSeconds}s bonus window`
        : `${item === "beginner" ? "Well-known" : item === "intermediate" ? "Most" : "Every"} countr${item === "expert" ? "y" : "ies"}`;
  return <>
    {arenaMode !== "map_fill" && <><label className="atlas-label">Difficulty</label>
      <div className="atlas-segmented">{(["beginner", "intermediate", "expert"] as const).map((item) => <button type="button" className={settings.difficulty === item ? "active" : ""} key={item} onClick={() => onChange({ ...settings, difficulty: item })}>{DIFFICULTY_LABELS[item]}<small>{note(item)}</small></button>)}</div></>}
    {mode.options.includes("scope") && <><label className="atlas-label">Region</label>
      <div className="atlas-chip-grid">{FILL_SCOPES.map((scope) => <button type="button" className={settings.scope === scope ? "active" : ""} key={scope} onClick={() => onChange({ ...settings, scope })}>{scope}</button>)}</div>
      <p className="atlas-setup-note">{settings.scope === "World" ? "All 195 countries on the full world map." : `The map zooms to ${settings.scope} automatically.`}</p></>}
    {mode.options.includes("categories") && <AtlasCategoryPicker options={QUESTION_CATEGORIES} selected={settings.categories} onChange={(categories) => onChange({ ...settings, categories })} />}
    {mode.options.includes("stats") && <AtlasCategoryPicker options={COMPARISON_CATEGORIES} selected={settings.stats} onChange={(stats) => onChange({ ...settings, stats })} label="Comparison categories" />}
  </>;
}
