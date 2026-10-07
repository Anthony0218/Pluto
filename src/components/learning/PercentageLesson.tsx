import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { percentageActivities } from '@/data/everydayPercentages';
import { getPathLessons, type LearningLesson } from '@/data/learningCatalog';
import { useLearningToolsProgress } from '@/hooks/useLearningToolsProgress';
import { ui, useUiLanguage } from '@/i18n/ui';
import LessonLayout from './LessonLayout';
import { Exercises } from './MathFoundationLesson';
import PercentageWorkbench from '@/components/tools/PercentageWorkbench';
function PercentageLessonContent({ lesson }: { lesson: LearningLesson }) {
  useUiLanguage();
  const { progress } = useLearningToolsProgress();
  const activity = percentageActivities.find(item => item.id === lesson.id)!;
  const lessons = getPathLessons('math', 'percentages'), next = lessons[lessons.findIndex(item => item.id === lesson.id) + 1];
  const solved = progress.solvedExercises[lesson.id]?.length ?? 0;
  return <LessonLayout lesson={lesson} extraMeta={<span><CheckCircle2 size={16} aria-hidden />{solved} / {activity.practice.length} {ui('exercises solved')}</span>} leadActivities={{ learn: lesson.id === 'shopping-discounts' ? <section className="mf-activity"><h3>{ui('25% means 25 out of 100')}</h3><div className="pct-hundred" role="img" aria-label={ui('25 of the 100 squares are filled.')} >{Array.from({ length: 100 }, (_, index) => <i key={index} className={index < 25 ? 'filled' : ''} />)}</div><p>25% = 25/100 = 1/4</p></section> : undefined }} activities={{
    learn: <section className="mf-activity"><p className="lt-eyebrow">{ui('Worked example')}</p><h3>{ui(activity.example.problem)}</h3><ol className="mf-steps">{activity.example.steps.map(step => <li key={step}>{step}</li>)}</ol><p className="mf-verification"><strong>{ui('Independent check')}</strong><br />{activity.example.verification}</p></section>,
    explore: <PercentageWorkbench initialMode={activity.modes[0]} modes={activity.modes} />,
    practice: <><Exercises activity={activity} />{next ? <Link className="lt-button mf-next" to={next.route}>{ui('Next lesson')}: {ui(next.title)}<ArrowRight size={15} aria-hidden /></Link> : <Link className="lt-button mf-next" to="/learn/math/percentages">{ui('Review the course')}<ArrowRight size={15} aria-hidden /></Link>}<Link className="lt-button mf-next" to="/tools/percentage-calculator">{ui('Percentage Calculator')}<ArrowRight size={15} aria-hidden /></Link></>,
  }} />;
}
export default function PercentageLesson({ lesson }: { lesson: LearningLesson }) {
  const { account } = useLearningToolsProgress();
  return <PercentageLessonContent key={`${account}-${lesson.id}`} lesson={lesson} />;
}
