import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { goLessons } from "../../games/go/lessons";
import { applyGoMove, isLegalGoMove, type GoMove } from "../../games/go/rules";
import { goCoordinate } from "../../games/go/analysis";
import GoBoard from "./GoBoard";

export default function GoRules() {
  const [topic, setTopic] = useState(0), [step, setStep] = useState(0), [playing, setPlaying] = useState(false);
  const [feedback, setFeedback] = useState("");
  const lesson = goLessons[topic];
  const frames = useMemo(() => {
    const result = [lesson.initial];
    for (const move of lesson.moves) result.push(applyGoMove(result.at(-1)!, move));
    return result;
  }, [lesson]);
  useEffect(() => {
    if (!playing) return;
    if (step >= frames.length - 1) return;
    const timer = window.setTimeout(() => { setStep(value => value + 1); if (step + 1 >= frames.length - 1) setPlaying(false); }, 1400);
    return () => window.clearTimeout(timer);
  }, [playing, step, frames.length]);
  const state = frames[step];
  function attempt(move: GoMove) {
    setPlaying(false);
    if (!isLegalGoMove(state, move)) { setFeedback("That move is illegal: it has no liberties or repeats an earlier position."); return; }
    if (lesson.moves[step] && goCoordinate(move, 9) === goCoordinate(lesson.moves[step], 9)) { setStep(step + 1); setFeedback("Correct."); }
    else setFeedback(lesson.moves[step] ? `Try ${goCoordinate(lesson.moves[step], 9)}.` : "This example is complete.");
  }
  const target = lesson.blocked?.type === "place" ? lesson.blocked.row * 9 + lesson.blocked.col : lesson.target;
  return <main className="go-page">
    <header className="go-page-header"><Link to="/games/go"><ArrowLeft size={16} /> Go</Link><h1>Go rules</h1><span>Chinese area rules</span></header>
    <div className="go-lessons">
      <section>
        <nav className="go-tabs" aria-label="Rule topics">{goLessons.map((item, index) => <button key={item.id} aria-current={topic === index ? "page" : undefined} onClick={() => { setTopic(index); setStep(0); setPlaying(false); setFeedback(""); }}>{item.label}</button>)}</nav>
        <h2>{lesson.title}</h2><p>{lesson.body}</p>
        <p className="go-caption" aria-live="polite">{lesson.captions[step]}</p>
        <div className="go-controls">
          <button title="Reset lesson" aria-label="Reset lesson" onClick={() => { setStep(0); setPlaying(false); setFeedback(""); }}><RotateCcw size={18} /></button>
          <button title="Previous step" aria-label="Previous step" disabled={step === 0} onClick={() => { setPlaying(false); setStep(step - 1); }}><ChevronLeft size={18} /></button>
          <button title={playing ? "Pause animation" : "Play animation"} aria-label={playing ? "Pause animation" : "Play animation"} disabled={!lesson.moves.length} onClick={() => { if (step === frames.length - 1) setStep(0); setPlaying(!playing); }}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
          <button title="Next step" aria-label="Next step" disabled={step === frames.length - 1} onClick={() => { setPlaying(false); setStep(step + 1); }}><ChevronRight size={18} /></button>
          <span>{step + 1} / {frames.length}</span>
          {lesson.moves[step]?.type === "pass" && <button onClick={() => attempt({ type: "pass" })}>Pass</button>}
        </div>
        <p role="status">{feedback}</p>
        <Link className="go-action" to="/games/go/ai">Play Go</Link>
      </section>
      <GoBoard key={lesson.id} state={state} onMove={attempt} onAttempt={attempt} help marked={step === 0 ? target : undefined} hint={lesson.moves[step]} />
    </div>
  </main>;
}
