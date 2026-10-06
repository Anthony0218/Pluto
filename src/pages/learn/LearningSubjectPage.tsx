import FootballReferencePage from './FootballReferencePage';
import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { getSubjectPaths, getPathLessons, learningSubjects, pathRoute } from "@/data/learningCatalog";
import { learningResources } from "@/data/navigation";
import HubLayout from "@/components/learning/HubLayout";
import CatalogIcon from "@/components/learning/CatalogIcon";
import { ui, useUiLanguage } from "@/i18n/ui";
import NotFoundPage from "@/pages/general/NotFoundPage";
import { MathSubjectOverview } from "@/components/learning/MathTopicOverview";

export default function LearningSubjectPage() {
  useUiLanguage();
  const { subjectId } = useParams();
  if (subjectId === 'football') return <FootballReferencePage />;
  const subject = learningSubjects.find(item => item.id === subjectId);
  if (!subject) return <NotFoundPage />;
  const paths = getSubjectPaths(subject.id);
  const resources = learningResources.filter(resource => resource.subjectId === subject.id);
  return <HubLayout eyebrow="Explore a subject" title={subject.title} description={subject.description} breadcrumbs={[{ title: "Learn", route: "/learn" }, { title: subject.title }]}>
    {subject.id === "math" ? <MathSubjectOverview paths={paths} /> : resources.length > 0 ? <section className="lt-section" aria-labelledby="subject-resources-title"><div className="lt-section-heading"><h2 id="subject-resources-title">{ui(subject.resourceLabel ?? subject.title)}</h2><span>{ui("Available now")}</span></div><div className="lt-path-grid">{resources.map(resource => <Link className="lt-path-card" key={resource.route} to={resource.route}><CatalogIcon id={subject.id} size={23} /><h3>{ui(resource.title)}</h3><p>{ui(resource.description)}</p><span className="lt-text-link">{ui(subject.id === "game-analysis" ? "Open analysis" : "Open guide")}<ArrowRight size={15} aria-hidden /></span></Link>)}</div></section>
      : subject.later ? <section className="lt-panel lt-empty" style={{ "--lt-accent": subject.accent } as CSSProperties}><span className="lt-icon"><CatalogIcon id={subject.id} size={30} /></span><h2>{ui("A subject for later")}</h2><p>{ui("Signal processing follows the core learning paths. Sound, sampling, filters, Fourier analysis, and radar will build on the math you learn here.")}</p><Link className="lt-button" to="/learn/math">{ui("Explore Math")}<ArrowRight size={16} aria-hidden /></Link></section>
      : <section className="lt-section" aria-labelledby="subject-paths-title"><div className="lt-section-heading"><h2 id="subject-paths-title">{ui("Learning paths")}</h2></div><div className="lt-path-grid">{paths.map((path, index) => {
        const published = getPathLessons(subject.id, path.id).length;
        return <Link className="lt-path-card" key={path.id} to={pathRoute(path)} style={{ "--lt-accent": subject.accent } as CSSProperties}><div className="lt-card-top"><span className="lt-path-number">{String(index + 1).padStart(2, "0")}</span><span className={`lt-badge ${published ? "available" : ""}`}>{ui(published ? "Available now" : "Coming soon")}</span></div><h3>{ui(path.title)}</h3><p>{ui(path.description)}</p><span className="lt-text-link">{ui(published ? "Open course" : "View learning path")}<ArrowRight size={15} aria-hidden /></span></Link>;
      })}</div><p className="lt-notice">{ui(paths.some(path => getPathLessons(subject.id, path.id).length) ? "Available courses include lessons and exercises. Paths marked Coming soon show an outline of future content." : "These paths are planned. Explore their topics now; lessons and exercises will be added next.")}</p></section>}
  </HubLayout>;
}
