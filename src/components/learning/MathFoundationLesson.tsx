import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Lightbulb, RotateCcw } from "lucide-react";
import { foundationActivities, fractionDisplay, gradeMathAnswer, type FoundationActivity, type FoundationId, type MathExercise } from "@/data/mathFoundations";
import { getPathLessons, type LearningLesson } from "@/data/learningCatalog";
import { useLearningToolsProgress } from "@/hooks/useLearningToolsProgress";
import { ui, useUiLanguage } from "@/i18n/ui";
import LessonLayout from "./LessonLayout";
import { AdditionSubtractionVisual, PaperArithmeticGuide, PaperWorksheet } from "./PaperArithmetic";
import { gradePaperWork, paperCalculation } from "@/data/paperArithmetic";
import "./mathFoundations.css";

const signed = (value: number) => value < 0 ? `(${value.toString().replace("-", "−")})` : value.toString();

function NumberLine({ start, end }: { start: number; end: number }) {
  const arrow = useId();
  const min = Math.min(0, start, end) - 2, max = Math.max(0, start, end) + 2;
  const position = (value: number) => 30 + (value - min) / (max - min) * 580;
  const step = Math.max(1, Math.ceil((max - min) / 10));
  const ticks = Array.from({ length: Math.floor(max / step) - Math.ceil(min / step) + 1 }, (_, index) => (Math.ceil(min / step) + index) * step);
  return <svg className="mf-number-line" viewBox="0 0 640 140" role="img" aria-label={`${ui("Start")}: ${start}. ${ui("Result")}: ${end}.`}>
    <defs><marker id={arrow} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6" fill="#c4b5fd" /></marker></defs>
    <line x1="25" x2="615" y1="88" y2="88" stroke="#72809b" strokeWidth="2" />
    {ticks.map(tick => <g key={tick}><line x1={position(tick)} x2={position(tick)} y1="83" y2="94" stroke="#72809b" /><text x={position(tick)} y="116" textAnchor="middle" fill={tick === 0 ? "#eef0ff" : "#a7b3ca"} fontSize="14">{tick}</text></g>)}
    {start !== end && <line x1={position(start)} x2={position(end)} y1="48" y2="48" stroke="#c4b5fd" strokeWidth="3" markerEnd={`url(#${arrow})`} />}
    <circle cx={position(start)} cy="88" r="5" fill="#93c5fd" /><circle cx={position(end)} cy="88" r="5" fill="#c4b5fd" />
    <text x={position(end)} y="28" textAnchor="middle" fill="#e5ddff" fontSize="18">{end}</text>
    <text x={position(start)} y="72" textAnchor="middle" fill="#93c5fd" fontSize="13">{ui("Start")}: {start}</text>
  </svg>;
}

function Slider({ label, value, onChange, min, max }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number }) {
  return <label className="mf-slider"><span>{ui(label)}<strong>{value}</strong></span><input type="range" min={min} max={max} value={value} onChange={event => onChange(Number(event.target.value))} /></label>;
}

function FoundationExplorer({ id }: { id: FoundationId }) {
  const { language } = useUiLanguage();
  const locale = language === "bar" ? "de-DE" : language;
  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(value);
  const decimal = (value: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 6, useGrouping: false }).format(Number(value));
  const [a, setA] = useState(id === "negative-numbers" ? -3 : id === "estimation-checks" ? 4 : 3);
  const [b, setB] = useState(id === "fractions-decimals" ? 4 : id === "estimation-checks" ? 1980 : 5);
  const [c, setC] = useState(2);
  const [mode, setMode] = useState("first");
  const isLine = id === "addition-subtraction" || id === "negative-numbers";
  const fraction = id === "fractions-decimals" ? fractionDisplay(a, b) : null;
  const lineResult = mode === "first" ? a + b : a - b;
  return <section className="mf-activity" aria-label={ui("Interactive example")}>
    <div className="mf-activity-heading"><Lightbulb size={18} aria-hidden /><h3>{ui("Change a number. Notice what changes.")}</h3></div>
    {isLine && <>
      <div className="mf-controls"><Slider label="Starting number" value={a} onChange={setA} min={id === "negative-numbers" ? -10 : 0} max={20} /><Slider label="Change" value={b} onChange={setB} min={id === "negative-numbers" ? -10 : 0} max={20} /></div>
      <div className="mf-mode" role="group" aria-label={ui("Operation")}><button type="button" aria-pressed={mode === "first"} onClick={() => setMode("first")}>{ui("Add")}</button><button type="button" aria-pressed={mode === "second"} onClick={() => setMode("second")}>{ui("Subtract")}</button></div>
      <div className="mf-equation">{signed(a)} {mode === "first" ? "+" : "−"} {signed(b)} = {lineResult}</div>
      <NumberLine start={a} end={lineResult} />
      <p className="mf-verification">{ui("Inverse check")}: {signed(lineResult)} {mode === "first" ? "−" : "+"} {signed(b)} = {a}</p>
    </>}
    {id === "multiplication-division" && <>
      <div className="mf-controls"><Slider label="Groups" value={a} onChange={setA} min={0} max={8} /><Slider label="Items per group" value={b} onChange={setB} min={0} max={8} /></div>
      <div className="mf-mode" role="group" aria-label={ui("Operation")}><button type="button" aria-pressed={mode === "first"} onClick={() => setMode("first")}>{ui("Multiply")}</button><button type="button" aria-pressed={mode === "second"} onClick={() => setMode("second")}>{ui("Divide")}</button></div>
      <div className="mf-equation">{mode === "first" ? `${a} × ${b} = ${a * b}` : a === 0 ? `0 ÷ 0: ${ui("undefined")}` : `${a * b} ÷ ${a} = ${b}`}</div>
      <div className="mf-groups" aria-hidden>{Array.from({ length: a }, (_, group) => <div className="mf-group" key={group}>{Array.from({ length: b }, (_, dot) => <span key={dot} />)}{b === 0 && <small>0</small>}</div>)}</div>
      <p>{a === 0 ? ui("No groups. Division by zero cannot recover a group size.") : `${a} ${ui("groups")} × ${b} ${ui("items per group")} = ${a * b} ${ui("items")}`}</p>
      <p className="mf-verification">{a === 0 ? ui("Multiplying zero by any number gives zero, so 0 ÷ 0 has no unique answer.") : `${ui("Inverse check")}: ${a * b} ÷ ${a} = ${b}; ${b} × ${a} = ${a * b}`}</p>
    </>}
    {id === "fractions-decimals" && fraction && <>
      <div className="mf-controls"><Slider label="Numerator (parts)" value={a} onChange={setA} min={0} max={12} /><Slider label="Denominator (parts per whole)" value={b} onChange={setB} min={1} max={12} /></div>
      <div className="mf-equation">{a}/{b} = {fraction.fraction} {fraction.approximate ? "≈" : "="} {decimal(fraction.decimal)}</div>
      <div className="mf-fraction-bars" aria-hidden>{Array.from({ length: Math.max(1, Math.ceil(a / b)) }, (_, whole) => <div className="mf-fraction-bar" key={whole} style={{ gridTemplateColumns: `repeat(${b}, minmax(0, 1fr))` }}>{Array.from({ length: b }, (_, part) => <span className={whole * b + part < a ? "filled" : ""} key={part} />)}</div>)}</div>
      <p>{ui("Each bar is one whole; each filled piece is one part.")}</p>
      <p className="mf-verification">{fraction.approximate ? ui("≈ marks an approximation. The fraction is exact; this repeating decimal is rounded to six decimal places.") : ui("This decimal ends, so the fraction and decimal are exactly equal.")}</p>
    </>}
    {id === "order-of-operations" && <>
      <div className="mf-controls three"><Slider label="First number" value={a} onChange={setA} min={0} max={10} /><Slider label="Second number" value={b} onChange={setB} min={0} max={10} /><Slider label="Third number" value={c} onChange={setC} min={0} max={10} /></div>
      <div className="mf-mode" role="group" aria-label={ui("Grouping")}><button type="button" aria-pressed={mode === "first"} onClick={() => setMode("first")}>{ui("Multiply first")}</button><button type="button" aria-pressed={mode === "second"} onClick={() => setMode("second")}>{ui("Parentheses first")}</button></div>
      <div className="mf-equation">{mode === "first" ? `${a} + ${b} × ${c} = ${a + b * c}` : `(${a} + ${b}) × ${c} = ${(a + b) * c}`}</div>
      <ol className="mf-steps"><li>{mode === "first" ? `${b} × ${c} = ${b * c}` : `${a} + ${b} = ${a + b}`}</li><li>{mode === "first" ? `${a} + ${b * c} = ${a + b * c}` : `${a + b} × ${c} = ${(a + b) * c}`}</li></ol>
      <p className="mf-verification">{ui("Compare the other grouping")}: {mode === "first" ? `(${a} + ${b}) × ${c} = ${(a + b) * c}` : `${a} + ${b} × ${c} = ${a + b * c}`}. {ui("These expressions can describe different quantities.")}</p>
    </>}
    {id === "estimation-checks" && <>
      <div className="mf-controls"><Slider label="Quantity" value={a} onChange={setA} min={1} max={20} /><label className="mf-slider"><span>{ui("Price per item")}<strong>{money(b / 100)}</strong></span><input aria-label={ui("Price per item in cents")} type="range" min={50} max={5000} step={10} value={b} onChange={event => setB(Number(event.target.value))} /></label></div>
      <div className="mf-comparison"><div><small>{ui("Exact total")}</small><strong>{money(a * b / 100)}</strong><span>{a} × {money(b / 100)}</span></div><div><small>{ui("Estimate")}</small><strong>≈ {money(a * Math.round(b / 100))}</strong><span>{a} × {money(Math.round(b / 100))} ({ui("rounded price")})</span></div></div>
      <p>{ui("Difference")}: {money(Math.abs(a * Math.round(b / 100) * 100 - a * b) / 100)}. {ui("Rounding each price can accumulate error when you buy more items.")}</p>
      <p className="mf-verification">{ui("Exact check in cents")}: {a * b} ÷ {a} = {b}. {ui("An estimate supports plausibility; it does not prove the exact total.")}</p>
    </>}
  </section>;
}

function ExerciseCard({ exercise, number, solved, disabled, onSolved }: { exercise: MathExercise; number: number; solved: boolean; disabled: boolean; onSolved: () => void }) {
  const inputId = useId();
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<ReturnType<typeof gradeMathAnswer> | null>(null);
  const [hint, setHint] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [solutionOpen, setSolutionOpen] = useState(false);
  const paper = exercise.paper ? paperCalculation(exercise.paper) : null;
  const [marks, setMarks] = useState<string[]>(() => Array(paper?.width ?? 0).fill(""));
  const [digits, setDigits] = useState<string[]>(() => Array(paper?.width ?? 0).fill(""));
  return <section className="mf-exercise" aria-labelledby={`${inputId}-question`}>
    <div className="mf-exercise-top"><span>{ui("Question")} {number}</span>{solved && <span className="mf-solved"><CheckCircle2 size={14} aria-hidden />{ui("Solved")}</span>}</div>
    <h3 id={`${inputId}-question`}>{ui(exercise.prompt)}</h3>
    <form onSubmit={event => {
      event.preventDefault();
      const result = exercise.paper ? gradePaperWork(exercise.paper, marks, digits) : gradeMathAnswer(answer, exercise.answer);
      setFeedback(result);
      if (result === "correct") setSolutionOpen(true);
      if (result === "correct" && !revealed) onSolved();
    }}>
      {exercise.paper ? <fieldset aria-describedby={`${inputId}-feedback`}><legend>{ui("Calculate on paper")}</legend><p className="mf-input-note">{ui(exercise.paper.operation === "add" ? "Fill the answer digits and any carry marks. Leave a carry blank when it is zero." : "Fill the answer digits. Above each changed digit, write its regrouped value; leave unchanged digits blank.")}</p><PaperWorksheet problem={exercise.paper} marks={marks} digits={digits} onMarks={values => { setMarks(values); setFeedback(null); }} onDigits={values => { setDigits(values); setFeedback(null); }} disabled={disabled} /><button className="lt-button primary" type="submit" disabled={disabled || digits.some(value => !value)}>{ui("Check answer")}</button></fieldset> : <><label htmlFor={inputId}>{ui("Your answer")}</label><div className="mf-answer-row"><input id={inputId} type="text" autoComplete="off" maxLength={40} spellCheck={false} placeholder={ui("Number or fraction")} value={answer} disabled={disabled} aria-invalid={feedback === "invalid" || feedback === "incorrect"} aria-describedby={`${inputId}-feedback`} onChange={event => { setAnswer(event.target.value); setFeedback(null); }} /><button className="lt-button primary" type="submit" disabled={disabled || !answer.trim()}>{ui("Check answer")}</button></div></>}
    </form>
    <div id={`${inputId}-feedback`} className={`mf-feedback ${feedback ?? ""}`} aria-live="polite" aria-atomic="true">{feedback === "invalid" ? ui(exercise.paper ? "Fill every answer digit. Use digits only for the marks above; leave unchanged marks blank." : "Enter a number or a fraction with a nonzero denominator. Use a decimal point or comma; omit units and expressions.") : feedback === "incorrect" ? ui(exercise.paper ? "Check the result digits and the carry or regrouping marks. Both must be correct." : "Not quite. Check the operation, signs, and units, or open a hint and try again.") : feedback === "correct" ? ui(revealed && !solved ? "Correct. You opened the solution, so this attempt is for review and is not counted as solved." : "Correct! Compare your method with the independent check below.") : null}</div>
    <div className="mf-exercise-actions"><button type="button" className="lt-text-link" aria-expanded={hint} aria-controls={`${inputId}-hint`} onClick={() => setHint(!hint)}><Lightbulb size={14} aria-hidden />{ui(hint ? "Hide hint" : "Show hint")}</button><button type="button" className="lt-text-link" aria-expanded={solutionOpen} aria-controls={`${inputId}-solution`} onClick={() => { if (!solutionOpen) setRevealed(true); setSolutionOpen(!solutionOpen); }}>{ui(solutionOpen ? "Hide solution" : "Show solution")}</button></div>
    <p id={`${inputId}-hint`} hidden={!hint} className="mf-hint">{ui(exercise.hint)}</p>
    <div id={`${inputId}-solution`} hidden={!solutionOpen} className="mf-solution"><strong>{ui("Solution")}</strong>{exercise.paper && solutionOpen && <PaperWorksheet problem={exercise.paper} />}<p>{ui(exercise.solution)}</p><strong>{ui("Independent check")}</strong><p>{ui(exercise.verification)}</p></div>
  </section>;
}

export function Exercises({ activity }: { activity: { id: string; practice: MathExercise[]; checks: MathExercise[] } }) {
  const { progress, loading, recordSolvedExercise, resetLessonExercises, account } = useLearningToolsProgress();
  const [round, setRound] = useState(0);
  const [confirmReset, setConfirmReset] = useState(false);
  const questions = [...activity.practice, ...activity.checks];
  const solved = progress.solvedExercises[activity.id] ?? [];
  return <div className="mf-practice">
    <div className="mf-practice-heading"><p>{questions.filter(question => solved.includes(question.id)).length} / {questions.length} {ui("solved")}</p><button type="button" className="lt-text-link" disabled={loading} onClick={() => setConfirmReset(!confirmReset)}><RotateCcw size={14} aria-hidden />{ui("Practice again")}</button></div>
    {confirmReset && <div className="mf-reset"><p>{ui("Reset all exercises in this lesson? Your reading progress and bookmarks stay saved.")}</p><button type="button" className="lt-button" disabled={loading} onClick={() => { resetLessonExercises(activity.id); setRound(round + 1); setConfirmReset(false); }}>{ui("Reset exercises")}</button><button type="button" className="lt-button" onClick={() => setConfirmReset(false)}>{ui("Cancel")}</button></div>}
    <p className="mf-input-note">{ui("Exact answers: 0.5, 0,5, and 1/2 are equivalent. Write repeating decimals as fractions. Hints are allowed; revealing a solution does not mark a question solved.")}</p>
    {questions.map((exercise, index) => <ExerciseCard key={`${account}-${round}-${exercise.id}`} exercise={exercise} number={index + 1} solved={solved.includes(exercise.id)} disabled={loading} onSolved={() => recordSolvedExercise(activity.id, exercise.id)} />)}
    <p className="lt-storage-note">{ui("Solved exercises are saved on this browser for this account. They record practice, not a mastery score.")}</p>
  </div>;
}

function FoundationLessonContent({ lesson, activity }: { lesson: LearningLesson; activity: FoundationActivity }) {
  useUiLanguage();
  const { progress } = useLearningToolsProgress();
  const lessons = getPathLessons("math", "foundations");
  const next = lessons[lessons.findIndex(item => item.id === lesson.id) + 1];
  const solved = progress.solvedExercises[lesson.id]?.length ?? 0;
  return <LessonLayout lesson={lesson} extraMeta={<span><CheckCircle2 size={16} aria-hidden />{solved} / {activity.practice.length + activity.checks.length} {ui("exercises solved")}</span>} leadActivities={{ learn: activity.id === "addition-subtraction" ? <AdditionSubtractionVisual /> : undefined }} activities={{
      learn: <>{activity.id === "addition-subtraction" && <PaperArithmeticGuide />}<section className="mf-activity"><p className="lt-eyebrow">{ui("Worked example")}</p><h3>{ui(activity.example.problem)}</h3><ol className="mf-steps">{activity.example.steps.map(step => <li key={step}>{ui(step)}</li>)}</ol><p className="mf-verification"><strong>{ui("Independent check")}</strong><br />{ui(activity.example.verification)}</p></section></>,
      explore: <FoundationExplorer id={activity.id} />,
      practice: <><Exercises activity={activity} />{next ? <Link className="lt-button mf-next" to={next.route}>{ui("Next lesson")}: {ui(next.title)}<ArrowRight size={15} aria-hidden /></Link> : <Link className="lt-button mf-next" to="/learn/math/foundations">{ui("Review the course")}<ArrowRight size={15} aria-hidden /></Link>}</>,
    }} />;
}

export default function MathFoundationLesson({ lesson }: { lesson: LearningLesson }) {
  const { account } = useLearningToolsProgress();
  const activity = foundationActivities.find(item => item.id === lesson.id)!;
  return <FoundationLessonContent key={`${account}-${lesson.id}`} lesson={lesson} activity={activity} />;
}
