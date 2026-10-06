import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Bookmark, Check, CheckCircle2, Clock3, Lightbulb } from "lucide-react";
import { learningSubjects, learningPaths, getLessonStages, lessonStages, lessonStageLabels, pathRoute, subjectRoute, type LearningLesson } from "@/data/learningCatalog";
import { useLearningToolsProgress } from "@/hooks/useLearningToolsProgress";
import { ui, useUiLanguage } from "@/i18n/ui";
import HubLayout from "./HubLayout";
import { useEffect, useRef, type ReactNode } from "react";
import { everydayMathCases } from "@/data/everydayMathCases";

/** Shared reading shell; subject lessons supply their own interactive content. */
export default function LessonLayout({ lesson, activities, leadActivities, extraMeta }: { lesson: LearningLesson; activities?: Partial<Record<typeof lessonStages[number], ReactNode>>; leadActivities?: Partial<Record<typeof lessonStages[number], ReactNode>>; extraMeta?: ReactNode }) {
  useUiLanguage();
  const { progress, loading, toggleBookmark, setLessonStage, setLessonCompleted } = useLearningToolsProgress();
  const saved = progress.lessons[lesson.id];
  const stages = getLessonStages(lesson);
  const stage = saved?.stage && stages.includes(saved.stage) ? saved.stage : saved?.stage === "check" && lesson.subjectId === "math" ? "practice" : "learn";
  const index = stages.indexOf(stage);
  const section = lesson.sections[stage];
  const everydayCase = everydayMathCases[lesson.id];
  const bookmarked = progress.bookmarks.includes(lesson.id);
  const subject = learningSubjects.find(item => item.id === lesson.subjectId);
  const path = learningPaths.find(item => item.id === lesson.pathId && item.subjectId === lesson.subjectId);
  const stageNavigation = useRef<HTMLElement>(null);
  const chooseStage = (nextStage: typeof lessonStages[number]) => {
    setLessonStage(lesson.id, nextStage);
    stageNavigation.current?.scrollIntoView({ block: "start" });
  };
  useEffect(() => { if (!saved && !loading) setLessonStage(lesson.id, "learn"); }, [lesson.id, saved, loading, setLessonStage]);
  return <HubLayout eyebrow="Learn at your own pace" title={lesson.title} description={lesson.description}
    breadcrumbs={[{ title: "Learn", route: "/learn" }, ...(subject ? [{ title: subject.title, route: subjectRoute(subject.id) }] : []), ...(path ? [{ title: path.title, route: pathRoute(path) }] : []), { title: lesson.title }]}
    actions={<button type="button" className="lt-button" disabled={loading} aria-pressed={bookmarked} onClick={() => toggleBookmark(lesson.id)}><Bookmark size={16} aria-hidden fill={bookmarked ? "currentColor" : "none"} />{ui(bookmarked ? "Bookmarked" : "Bookmark lesson")}</button>}>
    <div className="lt-lesson-meta"><span><Clock3 size={15} aria-hidden />{lesson.minutes} {ui(activities ? "min with practice" : "min read")}</span>{saved?.completed && <span><CheckCircle2 size={15} aria-hidden />{ui("Read")}</span>}{extraMeta}</div>
    <nav ref={stageNavigation} className={`lt-stages ${stages.length === 3 ? "lt-stages-three" : ""}`} aria-label={ui("Lesson stages")}>{stages.map((item, position) => <button key={item} type="button" disabled={loading} aria-current={stage === item ? "step" : undefined} onClick={() => chooseStage(item)}><span>{position + 1}</span>{ui(lessonStageLabels[item])}</button>)}</nav>
    <article className="lt-lesson-body" aria-labelledby="lesson-section-title">
      <p className="lt-eyebrow">{ui(lessonStageLabels[stage])}</p><h2 id="lesson-section-title">{ui(section.title)}</h2>
      {leadActivities?.[stage]}
      {section.paragraphs.map(paragraph => <p key={paragraph}>{ui(paragraph)}</p>)}
      {section.points && <ul>{section.points.map(point => <li key={point}><Check size={16} aria-hidden /><span>{ui(point)}</span></li>)}</ul>}
      {stage === "learn" && everydayCase && <aside className="mf-activity lt-everyday-case" aria-label={ui("In everyday life")}><h3>{ui("In everyday life")}</h3><p>{ui(everydayCase.situation)}</p><p className="mf-notation">{everydayCase.calculation}</p></aside>}
      {lesson.subjectId === "math" && <aside className="mf-did-you-know" aria-label={ui("Did you know?")}><h3><Lightbulb size={18} aria-hidden />{ui("Did you know?")}</h3>{lesson.sections.check.paragraphs.map(paragraph => <p key={paragraph}>{ui(paragraph)}</p>)}</aside>}
      {activities?.[stage]}
    </article>
    <div className="lt-lesson-controls"><button type="button" className="lt-button" disabled={loading || index === 0} onClick={() => chooseStage(stages[index - 1])}><ArrowLeft size={16} aria-hidden />{ui("Previous")}</button>
      {index < stages.length - 1 ? <button type="button" className="lt-button primary" disabled={loading} onClick={() => chooseStage(stages[index + 1])}>{ui("Next")}: {ui(lessonStageLabels[stages[index + 1]])}<ArrowRight size={16} aria-hidden /></button>
        : <button type="button" className="lt-button primary" disabled={loading || saved?.completed} onClick={() => setLessonCompleted(lesson.id, true)}><CheckCircle2 size={16} aria-hidden />{ui(saved?.completed ? "Marked as read" : "Mark as read")}</button>}
    </div>
    <p className="lt-storage-note">{ui("Reading progress and bookmarks are saved on this browser. Reading completion is not a mastery score.")}</p>
    <Link className="lt-text-link" to={path ? pathRoute(path) : "/learn"}>{ui("Back to learning")}<ArrowRight size={14} aria-hidden /></Link>
  </HubLayout>;
}
