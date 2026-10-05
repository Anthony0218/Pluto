import { ArrowRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import { learningLessons, learningSubjects, subjectRoute } from "@/data/learningCatalog";
import { useLearningToolsProgress } from "@/hooks/useLearningToolsProgress";
import CatalogIcon from "@/components/learning/CatalogIcon";

export default function LearnSomethingNew() {
  useUiLanguage();
  const { progress } = useLearningToolsProgress();
  const recent = learningLessons.filter(lesson => progress.lessons[lesson.id] && !progress.lessons[lesson.id].completed).sort((a, b) => progress.lessons[b.id].updatedAt - progress.lessons[a.id].updatedAt)[0];
  const introduction = learningLessons.find(lesson => lesson.id === "getting-started")!;
  const lesson = recent ?? introduction;
  return <section className="dash-panel learn-panel" aria-labelledby="dashboard-learn-title">
    <div className="dash-section-heading"><div><h2 id="dashboard-learn-title">{ui("Learn")}</h2><p>{ui("Choose a subject and learn at your own pace.")}</p></div><Link to="/learn" className="dash-text-link">{ui("All subjects")}<ArrowRight size={14} aria-hidden /></Link></div>
    <div className="dashboard-learning-links">
      <Link to={lesson.route} className="dashboard-learning-link"><span className="dashboard-learning-icon"><BookOpen size={19} aria-hidden /></span><span><strong>{ui(lesson.title)}</strong><small>{ui(recent ? "Continue lesson" : "Open introduction")}</small></span><ArrowRight size={15} aria-hidden /></Link>
      {learningSubjects.filter(subject => !subject.later).map(subject => <Link key={subject.id} to={subjectRoute(subject.id)} className="dashboard-learning-link"><span className="dashboard-learning-icon"><CatalogIcon id={subject.id} size={19} /></span><span><strong>{ui(subject.title)}</strong><small>{ui(subject.resourceLabel ?? (learningLessons.some(lesson => lesson.subjectId === subject.id) ? "Open course" : "Explore upcoming learning paths"))}</small></span><ArrowRight size={15} aria-hidden /></Link>)}
    </div>
  </section>;
}
