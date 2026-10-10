import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { issueCounts, type IssueSeverity } from "@/games/chess/custom/engine/validation";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { ui } from "@/i18n/ui";

const severityStyle: Record<IssueSeverity, { icon: typeof Info; className: string; label: string }> = {
  error: { icon: CircleAlert, className: "text-red-300", label: "Error" },
  warning: { icon: TriangleAlert, className: "text-amber-300", label: "Warning" },
  info: { icon: Info, className: "text-sky-300", label: "Info" },
};

/** Non-blocking validation: explains problems, links to where they can be fixed. */
export default function ValidationPanel({ compact = false }: { compact?: boolean }) {
  useGameLanguage();
  const { issues, focusIssue } = useEditor();
  const [filter, setFilter] = useState<IssueSeverity | "all">("all");
  const counts = issueCounts(issues);
  const visible = issues.filter((issue) => filter === "all" || issue.severity === filter);

  return (
    <section aria-label={ui("Validation")} className="rounded-2xl border border-white/[0.08] bg-black/30">
      <header className="flex items-center justify-between gap-2 px-3 pt-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{ui("Validation")}</p>
        <div className="flex gap-1">
          {(["error", "warning", "info"] as const).map((severity) => {
            const Icon = severityStyle[severity].icon;
            return (
              <button
                key={severity}
                type="button"
                title={gameUi(`${severityStyle[severity].label}s`)}
                aria-pressed={filter === severity}
                onClick={() => setFilter(filter === severity ? "all" : severity)}
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold transition ${filter === severity ? "bg-white/10" : "hover:bg-white/[0.06]"} ${severityStyle[severity].className}`}
              >
                <Icon size={12} />
                {gameUi(counts[severity])}
              </button>
            );
          })}
        </div>
      </header>
      <div className={`space-y-1 overflow-y-auto p-2 ${compact ? "max-h-56" : "max-h-[40vh]"}`}>
        {gameUi(visible.length === 0 ? (
          <p className="flex items-center gap-2 px-2 py-3 text-xs text-emerald-300/90">
            <CircleCheck size={14} />
            {gameUi(issues.length ? ui("Nothing in this category.") : ui("No problems found. Ready to test."))}
          </p>
        ) : (
          visible.map((issue) => {
            const Icon = severityStyle[issue.severity].icon;
            return (
              <button
                key={issue.id}
                type="button"
                onClick={() => focusIssue(issue)}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs leading-5 text-zinc-300 transition hover:bg-white/[0.05]"
              >
                <Icon size={13} className={`mt-1 shrink-0 ${severityStyle[issue.severity].className}`} aria-label={gameUi(severityStyle[issue.severity].label)} />
                <span>{gameUi(issue.message)}</span>
              </button>
            );
          })
        ))}
      </div>
    </section>
  );
}
