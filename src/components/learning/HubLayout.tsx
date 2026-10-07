import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import "./learningTools.css";

export default function HubLayout({ eyebrow, title, description, breadcrumbs = [], actions, children }: {
  eyebrow: string; title: string; description: string;
  breadcrumbs?: { title: string; route?: string }[]; actions?: ReactNode; children: ReactNode;
}) {
  useUiLanguage();
  return <main className="learning-tools-page">
    <div className="lt-workspace">
      {breadcrumbs.length > 0 && <nav className="lt-breadcrumbs" aria-label={ui("Breadcrumb")}><ol>{breadcrumbs.map((crumb, index) => <li key={`${crumb.title}-${index}`}>
        {index > 0 && <ArrowRight size={12} aria-hidden />}
        {crumb.route ? <Link to={crumb.route}>{ui(crumb.title)}</Link> : <span aria-current="page">{ui(crumb.title)}</span>}
      </li>)}</ol></nav>}
      <header className="lt-hero">
        <div><p className="lt-eyebrow">{ui(eyebrow)}</p><h1>{ui(title)}</h1><p className="lt-description">{ui(description)}</p></div>
        {actions && <div className="lt-actions">{actions}</div>}
      </header>
      {children}
    </div>
  </main>;
}
