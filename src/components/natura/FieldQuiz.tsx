import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, Check, RotateCcw, X } from 'lucide-react';
import { SCENARIOS, type ScenarioId } from '../../games/natura/naturaData';
import { STUDIES } from '../../games/natura/studies';
import FieldDialog from './FieldDialog';
import HabitatIcon from './HabitatIcon';

export default function FieldQuiz({ id, close }: { id: ScenarioId; close: () => void }) {
  const scenario = SCENARIOS.find(s => s.id === id)!;
  const study = STUDIES[id];
  const [responses, setResponses] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const done = index >= scenario.questions.length;
  const question = scenario.questions[index];
  const nextButton = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const answer = responses[index];
  const answered = answer !== undefined;
  useEffect(() => { if (answered) nextButton.current?.focus(); else heading.current?.focus(); }, [answered, index]);
  const score = responses.filter((value, i) => value === scenario.questions[i].correct).length;
  const missed = scenario.questions.filter((q, i) => responses[i] !== q.correct);
  return <FieldDialog title={`${scenario.title} field quiz`} close={close} className="nm-quiz">
    <div style={{ '--habitat-accent': study.accent } as CSSProperties}>
      <div className="nm-quiz-head"><span className="nm-eyebrow">NATURA / FIELD NOTES</span><button className="nf-icon-button" onClick={close} aria-label="Close quiz"><X size={20}/></button></div>
      <div className="nm-specimen"><HabitatIcon id={id}/><div><small>{study.category} / {study.habitat}</small><strong>{scenario.title}</strong><span>{study.subjects}</span></div></div>
      {done ? <>
        <p className="nm-eyebrow">FIELD ASSESSMENT</p><h2 ref={heading} tabIndex={-1}>{score}<span className="nm-score-total"> / {scenario.questions.length}</span> observations correct</h2>
        <div className="nm-assessment"><b>{Math.round(score / scenario.questions.length * 100)}%</b><span>Accuracy<br/>Quiz points stay separate from your match.</span></div>
        {missed.length > 0 ? <div className="nm-review"><h3>Observations to revisit</h3>{missed.map(q => <article key={q.text}><strong>{q.text}</strong><p>{q.answers[q.correct]}. {q.explanation}</p></article>)}</div> : <p>Every observation identified. Ready to try another habitat?</p>}
        <div className="nm-result-actions"><button className="nf-primary" onClick={close}>Back to habitats <ArrowRight size={17}/></button><button className="nf-button" onClick={() => { setResponses([]); setIndex(0); }}><RotateCcw size={16}/> Try again</button></div>
      </> : <>
        <div className="nm-observation"><span className="nm-eyebrow">OBSERVATION {String(index + 1).padStart(2, '0')}</span><span>{index + 1} / {scenario.questions.length}</span></div>
        <progress className="nf-progress" max={scenario.questions.length} value={index + Number(answered)} aria-label="Completed observations"/>
        <h2 ref={heading} tabIndex={-1}>{question.text}</h2>
        <div className="nm-answers">{question.answers.map((text, i) => {
          const correct = answered && i === question.correct, incorrect = answered && i === answer && i !== question.correct;
          return <button key={text} disabled={answered} className={correct ? 'correct' : incorrect ? 'incorrect' : ''} onClick={() => setResponses([...responses, i])}>
            <span className="nm-answer-id">{String.fromCharCode(65 + i)}</span><span>{text}</span>{correct ? <Check aria-label="Correct answer" size={20}/> : incorrect ? <X aria-label="Your answer, incorrect" size={20}/> : null}
          </button>;
        })}</div>
        {answered && <div className={`nm-feedback ${answer === question.correct ? 'is-correct' : ''}`} role="status"><small>{answer === question.correct ? 'CORRECT OBSERVATION' : 'ANOTHER LOOK'}</small><p>{question.explanation}</p><button ref={nextButton} className="nf-primary" onClick={() => setIndex(n => n + 1)}>{index === scenario.questions.length - 1 ? 'See assessment' : 'Next observation'} <ArrowRight size={17}/></button></div>}
      </>}
      <p className="nm-quiz-source">Explore the evidence · <a href={scenario.source.url} target="_blank" rel="noreferrer">{scenario.source.label} ↗</a></p>
    </div>
  </FieldDialog>;
}
