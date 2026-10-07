import { footballCategories } from '@/data/footballReference';
import { Link } from "react-router-dom";
import { ArrowRight, Bookmark, CheckCircle2, Compass } from "lucide-react";
import type { CSSProperties } from "react";
import { learningLessons, learningSubjects, getSubjectPaths, subjectRoute } from "@/data/learningCatalog";
import { useLearningToolsProgress } from "@/hooks/useLearningToolsProgress";
import { ui, useUiLanguage } from "@/i18n/ui";
import CatalogIcon from "@/components/learning/CatalogIcon";
import HubLayout from "@/components/learning/HubLayout";

export default function LearnPage() {
  useUiLanguage();
  const { progress, loading } = useLearningToolsProgress();
  const introduction = learningLessons.find(lesson => lesson.id === "getting-started")!;
  const recentLesson = learningLessons.filter(lesson => progress.lessons[lesson.id] && !progress.lessons[lesson.id].completed).sort((a, b) => progress.lessons[b.id].updatedAt - progress.lessons[a.id].updatedAt)[0];
  const completed = learningLessons.filter(lesson => progress.lessons[lesson.id]?.completed).length;
  const bookmarks = learningLessons.filter(lesson => progress.bookmarks.includes(lesson.id));
  const featured = recentLesson ?? introduction;
  return <HubLayout eyebrow="A little curiosity goes a long way" title="What would you like to learn?" description="Choose a subject. Build understanding through explanations, exploration, practice, and ways to check your answers.">
    <div className="lt-intro-grid">
      <section className="lt-panel lt-introduction" aria-labelledby="learn-intro-title"><span className="lt-icon"><Compass size={25} aria-hidden /></span><div><p className="lt-eyebrow">{ui(recentLesson ? "Continue learning" : progress.lessons[introduction.id]?.completed ? "Read" : "Start here")}</p><h2 id="learn-intro-title">{ui(featured.title)}</h2><p>{ui(featured.description)}</p><Link className="lt-text-link" to={featured.route}>{ui(recentLesson ? "Continue lesson" : progress.lessons[introduction.id]?.completed ? "Revisit introduction" : "Open introduction")}<ArrowRight size={16} aria-hidden /></Link></div></section>
      <section className="lt-panel" aria-labelledby="learning-progress-title"><h2 id="learning-progress-title">{ui("Your learning")}</h2><div className="lt-stats"><span><CheckCircle2 size={19} aria-hidden /><strong>{loading ? "—" : completed}</strong>{ui("Lessons read")}</span><span><Bookmark size={19} aria-hidden /><strong>{loading ? "—" : bookmarks.length}</strong>{ui("Bookmarks")}</span></div><p className="lt-storage-note">{ui("Saved on this browser, separately for each account. Device sync comes later.")}</p></section>
    </div>
    <section className="lt-section" aria-labelledby="learning-subjects-title"><div className="lt-section-heading"><h2 id="learning-subjects-title">{ui("Subjects")}</h2><span>{ui("Follow a path or explore freely")}</span></div>
      <div className="lt-subject-grid">{learningSubjects.map(subject => <Link key={subject.id} to={subjectRoute(subject.id)} className="lt-subject-card" style={{ "--lt-accent": subject.accent } as CSSProperties}>
        <div className="lt-card-top"><span className="lt-icon"><CatalogIcon id={subject.id} size={27} /></span><span className="lt-badge">{ui(subject.id === 'football' || subject.resourceLabel || learningLessons.some(lesson => lesson.subjectId === subject.id) ? "Available now" : subject.later ? "Later" : "Coming soon")}</span></div>
        <h3>{ui(subject.title)}</h3><p>{ui(subject.description)}</p><div className="lt-card-footer"><span>{subject.id === 'football' ? `${footballCategories.length} ${ui('categories')}` : subject.resourceLabel ? ui(subject.resourceLabel) : subject.later ? ui("Sound, waves & radar") : `${getSubjectPaths(subject.id).length} ${ui("learning paths")}`}</span><ArrowRight size={18} aria-hidden /></div>
      </Link>)}</div>
    </section>
    <p className="lt-notice">{ui("Math foundations, Everyday percentages, the introduction, game guides, and Game Analysis are available now. More courses are planned; their pages show what you will be able to learn.")}</p>
    {bookmarks.length > 0 && <section className="lt-section" aria-labelledby="bookmarked-lessons-title"><div className="lt-section-heading"><h2 id="bookmarked-lessons-title">{ui("Bookmarked lessons")}</h2></div><div className="lt-link-list">{bookmarks.map(lesson => <Link key={lesson.id} to={lesson.route}><Bookmark size={18} aria-hidden /><span><strong>{ui(lesson.title)}</strong><small>{ui(lesson.description)}</small></span><ArrowRight size={16} aria-hidden /></Link>)}</div></section>}
  </HubLayout>;
}
