import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { subjectActivities, type ChoiceExercise } from '@/data/musicFootball';
import { getPathLessons, type LearningLesson } from '@/data/learningCatalog';
import { useLearningToolsProgress } from '@/hooks/useLearningToolsProgress';
import { ui, useUiLanguage } from '@/i18n/ui';
import LessonLayout from './LessonLayout';
import MusicLab from './MusicLab';
import FootballLab from './FootballLab';
import './subjectLessons.css';

function ChoiceQuestion({ question, lessonId, example }: { question: ChoiceExercise; lessonId: string; example: string }) {
  const { progress, loading, recordSolvedExercise } = useLearningToolsProgress();
  const [choice, setChoice] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [revealed, setRevealed] = useState(false);
  const solved = progress.solvedExercises[lessonId]?.includes(question.id);
  return <fieldset className="sl-question"><legend>{ui(question.prompt)}</legend><div className="sl-options">{question.options.map((option, index) => <label key={option}><input type="radio" name={question.id} checked={choice === index} onChange={() => { setChoice(index); setFeedback(''); }} />{ui(option)}</label>)}</div>
    <div className="sl-actions"><button type="button" className="lt-button primary" disabled={loading || choice === null || revealed || solved} onClick={() => { if (choice === question.answer) { recordSolvedExercise(lessonId, question.id); setFeedback('Correct. Explain why before moving on.'); } else setFeedback('Try again. Revisit the example and check the conditions.'); }}>{ui('Check answer')}</button><button type="button" className="lt-button" onClick={() => setRevealed(true)}>{ui('Show solution')}</button>{solved && <span><CheckCircle2 size={16} aria-hidden /> {ui('Solved')}</span>}</div>
    <p role="status">{ui(feedback)}</p>{(revealed || solved) && <div className="sl-solution"><strong>{ui(question.options[question.answer])}</strong><p>{ui(question.explanation)}</p><p>{ui(example)}</p>{revealed && !solved && <p>{ui('Solution revealed. Use Practice again for a fresh attempt.')}</p>}</div>}
  </fieldset>;
}
function SubjectContent({ lesson }: { lesson: LearningLesson }) {
  useUiLanguage();
  const { progress, resetLessonExercises, account } = useLearningToolsProgress();
  const [confirmReset, setConfirmReset] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const activity = subjectActivities.find(item => item.id === lesson.id)!;
  const lessons = getPathLessons(lesson.subjectId!, lesson.pathId!);
  const next = lessons[lessons.findIndex(item => item.id === lesson.id) + 1];
  const nextPath = lesson.pathId === 'reading-pitches' ? 'reading-rhythm' : lesson.pathId === 'rules' ? 'positions-tactics' : lesson.pathId;
  return <LessonLayout lesson={lesson} extraMeta={<span><CheckCircle2 size={16} aria-hidden />{progress.solvedExercises[lesson.id]?.length ?? 0} / {activity.practice.length} {ui('exercises solved')}</span>} activities={{
    explore: lesson.subjectId === 'music' ? <MusicLab topic={activity.topic} rhythm={lesson.pathId === 'reading-rhythm'} /> : <FootballLab topic={activity.topic} tactics={lesson.pathId === 'positions-tactics'} />,
    practice: <><div key={`${account}-${attempt}`}>{activity.practice.map(question => <ChoiceQuestion key={question.id} question={question} lessonId={lesson.id} example={activity.example} />)}</div><div className="sl-actions"><button className="lt-button" type="button" onClick={() => setConfirmReset(true)}>{ui('Practice again')}</button>{confirmReset && <><span>{ui('Reset solved exercises for this lesson?')}</span><button type="button" className="lt-button" onClick={() => { resetLessonExercises(lesson.id); setAttempt(attempt + 1); setConfirmReset(false); }}>{ui('Confirm reset')}</button><button type="button" className="lt-button" onClick={() => setConfirmReset(false)}>{ui('Cancel')}</button></>}</div><Link className="lt-button sl-next" to={next?.route ?? `/learn/${lesson.subjectId}/${nextPath}`}>{ui(next ? 'Next lesson' : nextPath !== lesson.pathId ? 'Continue course' : 'Review the course')}<ArrowRight size={16} aria-hidden /></Link></>,
    check: lesson.subjectId === 'football' ? <p className="sl-source">IFAB 2026/27 · <a href="https://www.theifab.com/documents/?documentCategory=lawsofthegame" target="_blank" rel="noreferrer">{ui('Official laws and editions')}</a></p> : <p className="sl-source"><a href="https://www.yamaha.com/en/musical_instrument_guide/" target="_blank" rel="noreferrer">{ui('Instrument reference')}</a></p>,
  }} />;
}
export default function SubjectLesson({ lesson }: { lesson: LearningLesson }) {
  const { account } = useLearningToolsProgress();
  return <SubjectContent key={`${account}-${lesson.id}`} lesson={lesson} />;
}
