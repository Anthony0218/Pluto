import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { getPathLessons, pathRoute, type LearningLesson, type LearningPath } from '@/data/learningCatalog';
import { mathTopicExample } from '@/data/mathTopicPreview';
import { ui } from '@/i18n/ui';

export function MathTopicPreview({ lesson }: { lesson?: LearningLesson }) {
  const example = lesson && mathTopicExample(lesson.id);
  return <aside className="lt-panel lt-topic-preview" id="math-topic-preview" aria-label={ui('Topic preview')}>
    <p className="lt-eyebrow">{ui('Topic preview')}</p>
    {lesson ? <>
      <h2>{ui(lesson.title)}</h2><p>{ui(lesson.sections.learn.paragraphs[0] ?? lesson.description)}</p>
      {example && <section className="lt-preview-example"><h3>{ui('Worked example')}</h3><p>{ui(example.problem)}</p>{example.notation && <p className="lt-preview-notation">{example.notation}</p>}<ol>{example.steps.map((step, index) => <li key={index}>{ui(step)}</li>)}</ol><details><summary>{ui('Check your answer')}</summary><p>{ui(example.verification)}</p></details></section>}
      <Link className="lt-text-link" to={lesson.route}>{ui('Open lesson')}<ArrowRight size={16} aria-hidden /></Link>
    </> : <p>{ui('Lessons and exercises for this path are not available yet. The outline above is a preview of the planned content.')}</p>}
  </aside>;
}

export default function MathTopicOverview({ lessons, status, action }: { lessons: LearningLesson[]; status: (lesson: LearningLesson) => string; action?: ReactNode }) {
  const [selectedId, setSelectedId] = useState(lessons[0]?.id);
  const selected = lessons.find(lesson => lesson.id === selectedId) ?? lessons[0];
  return <div className="lt-detail-grid lt-math-overview">
    <section className="lt-panel" aria-labelledby="path-topics-title"><p className="lt-eyebrow">{ui('Explore the topics')}</p><h2 id="path-topics-title">{ui('What you will learn')}</h2>
      <ol className="lt-curriculum">{lessons.map((lesson, index) => <li key={lesson.id}>
        <button type="button" className="lt-topic-select" aria-pressed={selected?.id === lesson.id} aria-controls="math-topic-preview" onFocus={() => setSelectedId(lesson.id)} onClick={() => setSelectedId(lesson.id)}>
          <span className="lt-path-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{ui(lesson.title)}</strong><span>{ui(lesson.description)}</span><small>{lesson.minutes} {ui('minutes')} · {status(lesson)}</small></span>
        </button>
        {lesson.sections.learn.points?.length ? <details className="lt-curriculum-concepts"><summary>{ui('Concepts covered')}</summary><ul>{lesson.sections.learn.points.map(point => <li key={point}>{ui(point)}</li>)}</ul></details> : null}
        <Link className="lt-text-link" to={lesson.route}>{ui('Open lesson')}<ArrowRight size={15} aria-hidden /></Link>
      </li>)}</ol>
    </section>
    <div className="lt-topic-preview-column"><MathTopicPreview lesson={selected} />{action}</div>
  </div>;
}

export function MathSubjectOverview({ paths }: { paths: LearningPath[] }) {
  const [selectedId, setSelectedId] = useState(paths[0]?.id);
  const selected = paths.find(path => path.id === selectedId) ?? paths[0];
  return <div className="lt-detail-grid lt-math-overview">
    <section className="lt-panel" aria-labelledby="subject-paths-title"><p className="lt-eyebrow">{ui('Explore the topics')}</p><h2 id="subject-paths-title">{ui('What you will learn')}</h2>
      <ol className="lt-curriculum">{paths.map((path, index) => <li key={path.id}>
        <button type="button" className="lt-topic-select" aria-pressed={selected?.id === path.id} aria-controls="math-topic-preview" onFocus={() => setSelectedId(path.id)} onClick={() => setSelectedId(path.id)}><span className="lt-path-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{ui(path.title)}</strong><span>{ui(path.description)}</span><small>{getPathLessons('math', path.id).length} {ui('Lessons')}</small></span></button>
        <ul className="lt-path-concepts">{path.topics.map(topic => <li key={topic}>{ui(topic)}</li>)}</ul>
        <Link className="lt-text-link" to={pathRoute(path)}>{ui('Open course')}<ArrowRight size={15} aria-hidden /></Link>
      </li>)}</ol>
    </section><MathTopicPreview lesson={selected && getPathLessons('math', selected.id)[0]} />
  </div>;
}
