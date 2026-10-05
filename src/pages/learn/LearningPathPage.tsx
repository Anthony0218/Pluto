import { Link, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Layers3 } from "lucide-react";
import { learningPaths, learningSubjects, getPathLessons, subjectRoute } from "@/data/learningCatalog";
import { toolApps, toolRoute } from "@/data/toolCatalog";
import HubLayout from "@/components/learning/HubLayout";
import { ui, useUiLanguage } from "@/i18n/ui";
import NotFoundPage from "@/pages/general/NotFoundPage";
import { useLearningToolsProgress } from "@/hooks/useLearningToolsProgress";
import { mathExerciseIds } from "@/data/mathExerciseIds";

export default function LearningPathPage() {
  useUiLanguage();
  const { progress, loading } = useLearningToolsProgress();
  const { subjectId, pathId } = useParams();
  const subject = learningSubjects.find(item => item.id === subjectId);
  const path = learningPaths.find(item => item.subjectId === subjectId && item.id === pathId);
  if (!subject || !path) return <NotFoundPage />;
  const lessons = getPathLessons(subject.id, path.id);
  const related = toolApps.filter(tool => path.relatedTools?.includes(tool.id));
  const read = lessons.filter(lesson => progress.lessons[lesson.id]?.completed).length;
  const solved = lessons.reduce((total, lesson) => total + (progress.solvedExercises[lesson.id]?.length ?? 0), 0);
  const exerciseCount = lessons.reduce((total, lesson) => total + (mathExerciseIds.get(lesson.id)?.size ?? 0), 0);
  const started = lessons.some(lesson => progress.lessons[lesson.id]);
  const next = lessons.find(lesson => !progress.lessons[lesson.id]?.completed || (progress.solvedExercises[lesson.id]?.length ?? 0) < (mathExerciseIds.get(lesson.id)?.size ?? 0)) ?? lessons[0];
  return <HubLayout eyebrow="Learning path" title={path.title} description={path.description} breadcrumbs={[{ title: "Learn", route: "/learn" }, { title: subject.title, route: subjectRoute(subject.id) }, { title: path.title }]}>
    {lessons.length > 0 && <section className="lt-panel lt-course-progress" aria-label={ui("Course progress")}><div><strong>{loading ? "—" : read} / {lessons.length} {ui("lessons read")}</strong><span>{loading ? "—" : solved} / {exerciseCount} {ui("exercises solved")}</span></div><progress max={exerciseCount} value={loading ? 0 : solved} aria-label={ui("Exercises solved")} /><p>{ui("Follow these lessons in order, or revisit any topic. Reading and practice are tracked separately.")}</p><Link className="lt-button primary" to={next.route}>{ui(started ? read === lessons.length && solved === exerciseCount ? "Review the course" : "Continue course" : "Start course")}<ArrowRight size={16} aria-hidden /></Link></section>}
    <div className="lt-detail-grid"><section className="lt-panel" aria-labelledby="path-topics-title"><p className="lt-eyebrow">{ui(lessons.length ? "Explore the topics" : "Coming soon")}</p><h2 id="path-topics-title">{ui("What you will learn")}</h2><ul className="lt-topic-list">{path.topics.map(topic => <li key={topic}><Layers3 size={17} aria-hidden /><span>{ui(topic)}</span></li>)}</ul></section>
      <aside className="lt-panel lt-check-panel"><CheckCircle2 size={28} aria-hidden /><h2>{ui("Understand it. Then check it.")}</h2><p>{ui(lessons.length ? "Every lesson includes a worked example, an interactive exploration, practice, and independent checks. An exact inverse check confirms a calculation; an estimate only supports plausibility." : "Lessons will include ways to verify your answer, explore another method, or test whether the result makes sense. Each check will explain what it can and cannot establish.")}</p><Link className="lt-text-link" to="/learn/start">{ui("How learning works")}<ArrowRight size={15} aria-hidden /></Link></aside></div>
    {lessons.length ? <section className="lt-section"><div className="lt-section-heading"><h2>{ui("Lessons")}</h2><span>{ui("Available now")}</span></div><div className="lt-link-list">{lessons.map((lesson, index) => <Link key={lesson.id} to={lesson.route}><span className="lt-path-number">{index + 1}</span><span><strong>{ui(lesson.title)}</strong><small>{ui(lesson.description)}</small><small>{progress.lessons[lesson.id]?.completed ? ui("Read") : ui("Not read")} · {progress.solvedExercises[lesson.id]?.length ?? 0} / {mathExerciseIds.get(lesson.id)?.size ?? 0} {ui("exercises solved")}</small></span><ArrowRight size={16} aria-hidden /></Link>)}</div></section> : <p className="lt-notice">{ui("Lessons and exercises for this path are not available yet. The outline above is a preview of the planned content.")}</p>}
    {related.length > 0 && <section className="lt-section" aria-labelledby="path-tools-title"><div className="lt-section-heading"><h2 id="path-tools-title">{ui("Related apps")}</h2></div><div className="lt-link-list">{related.map(tool => <Link key={tool.id} to={toolRoute(tool.id)}><span><strong>{ui(tool.title)}</strong><small>{ui(tool.description)}</small></span><span className="lt-badge">{ui(tool.status === "planned" ? "Coming soon" : "Available now")}</span><ArrowRight size={16} aria-hidden /></Link>)}</div></section>}
  </HubLayout>;
}
