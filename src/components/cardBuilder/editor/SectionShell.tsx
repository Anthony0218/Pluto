import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import type { ReactNode } from "react";
import { AlertTriangle, CircleX } from "lucide-react";
import type { EditorSection, ValidationIssue } from "@/games/cards/engine/validation";
import { useCardEditor } from "./editorContext";

export function IssueList({ issues }: { issues: ValidationIssue[] }) {
  useGameLanguage();
  if (!issues.length) return null;
  return (
    <ul className="space-y-1">
      {issues.map((issue) => (
        <li key={issue.id} className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${issue.severity === "error" ? "border-red-400/30 bg-red-500/10 text-red-200" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`}>
          {issue.severity === "error" ? <CircleX size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
          <span>
            {gameUi(issue.message)}
            {issue.path && <span className="ml-1 font-mono text-[10px] opacity-60">({gameUi(issue.path)})</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A section with its title, plain-language help and the validation issues that belong to it. */
export default function SectionShell({ section, title, eyebrow, description, actions, children }: { section?: EditorSection; title: string; eyebrow: string; description?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  useGameLanguage();
  const { issues } = useCardEditor();
  const own = section ? issues.filter((issue) => issue.section === section && issue.severity !== "success" && !issue.targetId) : [];
  return (
    <section aria-labelledby={`cb-${eyebrow}`} className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300/80">{gameUi(eyebrow)}</p>
          <h2 id={`cb-${eyebrow}`} className="mt-1 font-serif text-[28px] leading-tight text-white">
            {gameUi(title)}
          </h2>
          {description && <p className="mt-1.5 text-sm leading-6 text-zinc-400">{gameUi(description)}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{gameUi(actions)}</div>}
      </div>
      <IssueList issues={own} />
      {gameUi(children)}
    </section>
  );
}
