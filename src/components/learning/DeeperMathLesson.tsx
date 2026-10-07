import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { deeperMathActivities } from '@/data/deeperMath';
import { getPathLessons, learningPaths, type LearningLesson } from '@/data/learningCatalog';
import { useLearningToolsProgress } from '@/hooks/useLearningToolsProgress';
import { ui, useUiLanguage } from '@/i18n/ui';
import LessonLayout from './LessonLayout';
import { Exercises } from './MathFoundationLesson';
import DeeperMathExploration from './DeeperMathExploration';
function DeeperMathContent({ lesson }: { lesson: LearningLesson }) {
  useUiLanguage();
  const { progress } = useLearningToolsProgress();
  const activity = deeperMathActivities.find(item => item.id === lesson.id)!;
  const lessons = getPathLessons('math', activity.pathId);
  const next = lessons[lessons.findIndex(item => item.id === lesson.id) + 1];
  const followingId = activity.pathId === 'linear-algebra' ? 'analysis' : activity.pathId === 'analysis' ? 'probability-statistics' : null;
  const following = learningPaths.find(item => item.id === followingId);
  return <LessonLayout lesson={lesson} extraMeta={<span><CheckCircle2 size={16} aria-hidden />{progress.solvedExercises[lesson.id]?.length ?? 0} / {activity.practice.length} {ui('exercises solved')}</span>} activities={{
    learn: <section className="mf-activity"><p className="lt-eyebrow">{ui('Worked example')}</p><h3>{ui(activity.example.problem)}</h3><p className="mf-notation">{activity.example.notation}</p><ol className="mf-steps">{activity.example.steps.map(step => <li key={step}>{step}</li>)}</ol><p className="mf-verification"><strong>{ui('Independent check')}</strong><br />{activity.example.verification}</p></section>,
    explore: <DeeperMathExploration activity={activity} />,
    practice: <>
      <Exercises activity={activity} />
      <Link className="lt-button mf-next" to={next?.route ?? `/learn/math/${activity.pathId}`}>
        {ui(next ? 'Next lesson' : 'Review the course')}{next && `: ${ui(next.title)}`}<ArrowRight size={15} aria-hidden />
      </Link>
      {!next && following && <Link className="lt-button mf-next" to={`/learn/math/${following.id}`}>
        {ui(following.title)}<ArrowRight size={15} aria-hidden />
      </Link>}
    </>,
  }} />;
}
export default function DeeperMathLesson({ lesson }: { lesson: LearningLesson }) {
  const { account } = useLearningToolsProgress();
  return <DeeperMathContent key={`${account}-${lesson.id}`} lesson={lesson} />;
}
