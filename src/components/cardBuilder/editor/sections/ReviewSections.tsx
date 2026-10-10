import { gameUi, useGameLanguage } from "../../../../i18n/gameUi.ts";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, CircleX, AlertTriangle, Download, Upload } from "lucide-react";
import { parseGameDefinition, type EditorSection, type ValidationReport } from "@/games/cards/engine/validation";
import type { GameDefinition } from "@/games/cards/engine/types";
import type { GameRecord } from "@/games/cards/versioning";
import { Button, Chip, Panel, inputClass } from "@/components/chessCustom/ui";
import TestMatch from "../../game/TestMatch";
import { useCardEditor } from "../editorContext";
import SectionShell from "../SectionShell";

const SECTION_NAMES: Record<EditorSection, string> = {
  basics: "Basics",
  deck: "Deck",
  players: "Players",
  zones: "Zones",
  setup: "Setup",
  phases: "Phases",
  rules: "Rules",
  events: "Events",
  endConditions: "End conditions",
  rulebook: "Rulebook",
  settings: "Settings",
};

/* 12. Validation */
export function ValidationSection({ report }: { report: ValidationReport }) {
  useGameLanguage();
  const { goTo } = useCardEditor();
  const groups = [
    { title: "Errors", hint: "Must be fixed before publishing.", items: report.errors, icon: <CircleX size={16} className="text-red-300" />, tone: "border-red-400/25" },
    { title: "Warnings", hint: "The game may behave unexpectedly.", items: report.warnings, icon: <AlertTriangle size={16} className="text-amber-300" />, tone: "border-amber-300/25" },
    { title: "Passed checks", hint: "", items: report.successes, icon: <CheckCircle2 size={16} className="text-emerald-300" />, tone: "border-emerald-400/25" },
  ];
  return (
    <SectionShell eyebrow="12 · Validation" title={gameUi("Validation")} description={gameUi("The same checks run on the server before a game is saved or published. Click an issue to jump to it.")}>
      <div className="flex flex-wrap gap-2">
        <Chip tone={report.errors.length ? "red" : "emerald"}>{gameUi(report.errors.length)}{gameUi(" errors")}</Chip>
        <Chip tone={report.warnings.length ? "amber" : "zinc"}>{gameUi(report.warnings.length)}{gameUi(" warnings")}</Chip>
        <Chip tone="emerald">{gameUi(report.successes.length)}{gameUi(" passed")}</Chip>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        {groups.map((group) => (
          <Panel key={group.title} title={gameUi(group.title)} eyebrow={group.hint || undefined} className={group.tone}>
            {!group.items.length && <p className="text-sm text-zinc-500">{gameUi("None.")}</p>}
            <ul className="space-y-1.5">
              {group.items.map((issue) => (
                <li key={issue.id}>
                  <button type="button" onClick={() => goTo(issue.section, issue.targetId)} className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-zinc-200 hover:bg-white/[0.05]">
                    <span className="mt-0.5 shrink-0">{gameUi(group.icon)}</span>
                    <span>
                      {gameUi(issue.message)}
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide text-zinc-500">{gameUi(SECTION_NAMES[issue.section])}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </SectionShell>
  );
}

/* 13. Preview / test */
export function PreviewSection({ report }: { report: ValidationReport }) {
  useGameLanguage();
  const { def } = useCardEditor();
  const [snapshot, setSnapshot] = useState<GameDefinition | null>(null);
  const [run, setRun] = useState(0);
  return (
    <SectionShell
      eyebrow="13 · Preview"
      title={gameUi("Preview & test")}
      description={gameUi("Play your current draft right here with bots or hotseat players. The game uses the exact engine the server runs. Restart after editing to pick up changes.")}
      actions={
        <Button tone="primary" onClick={() => (setSnapshot(structuredClone(def)), setRun((value) => value + 1))}>
          {snapshot ? "Restart with latest edits" : "Load draft into the table"}
        </Button>
      }
    >
      {report.errors.length > 0 && <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">{gameUi("The draft has ")}{gameUi(report.errors.length)}{gameUi(" validation error(s). You can still try it, but it may not start or may stop early.")}</p>}
      {snapshot ? <TestMatch key={run} def={snapshot} /> : <p className="text-sm text-zinc-500">{gameUi("Load the draft to set up a test game.")}</p>}
    </SectionShell>
  );
}

/* 14. Save / publish */
export function PublishSection({
  record,
  dirty,
  busy,
  storage,
  message,
  onSave,
  onPublish,
  onImport,
  report,
}: {
  record: GameRecord | null;
  dirty: boolean;
  busy: boolean;
  storage: "local" | "cloud";
  message: string | null;
  onSave: () => void;
  onPublish: () => void;
  onImport: (definition: GameDefinition) => void;
  report: ValidationReport;
}) {
  useGameLanguage();
  const { def, mode } = useCardEditor();
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const latest = record?.versions[record.versions.length - 1];
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(def, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${def.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "card-game"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <SectionShell
      eyebrow="14 · Save & publish"
      title={gameUi("Save & publish")}
      description={gameUi("Saving keeps a draft. Publishing freezes that version forever: games in progress keep using it, and your next edit becomes a new draft version.")}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={gameUi("This game")} eyebrow={storage === "cloud" ? "Saved to your account" : "Saved in this browser"}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button tone="primary" onClick={onSave} disabled={busy}>
                {gameUi(dirty || !record ? "Save draft" : "Saved")}
              </Button>
              <Button tone="blue" onClick={onPublish} disabled={busy || !record || dirty || latest?.status !== "draft" || !report.canPublish} title={gameUi(!report.canPublish ? "Fix the validation errors first" : undefined)}>{gameUi(" Publish version ")}{gameUi(latest?.status === "draft" ? latest.version : (latest?.version ?? 0) + 1)}
              </Button>
            </div>
            {!report.canPublish && <p className="text-xs text-red-200">{gameUi("Publishing is blocked by ")}{gameUi(report.errors.length)}{gameUi(" validation error(s).")}</p>}
            {dirty && record && <p className="text-xs text-amber-200">{gameUi("You have unsaved edits.")}</p>}
            {gameUi(message && (
              <p role="status" className="text-sm text-zinc-300">
                {gameUi(message)}
              </p>
            ))}
            {storage === "local" && <p className="text-xs text-zinc-500">{gameUi("Sign in to keep your games in your account (they are validated again on the server).")}</p>}
          </div>
        </Panel>
        <Panel title={gameUi("Versions")} eyebrow="Game → Version 1 → Version 2 …">
          {!record && <p className="text-sm text-zinc-500">{gameUi("Not saved yet.")}</p>}
          <ol className="space-y-1.5">
            {[...(record?.versions ?? [])].reverse().map((version) => (
              <li key={version.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-zinc-400">v{gameUi(version.version)}</span>
                <Chip tone={version.status === "published" ? "emerald" : "amber"}>{gameUi(version.status)}</Chip>
                <span className="text-xs text-zinc-500">{gameUi(new Date(version.publishedAt ?? version.createdAt).toLocaleString())}</span>
                {gameUi(version.status === "published" && record && (
                  <Link className="ml-auto text-xs text-amber-300 underline" to={`/games/card-builder/play?game=${encodeURIComponent(record.id)}&version=${encodeURIComponent(version.id)}`}>{gameUi(" Play this version ")}</Link>
                ))}
              </li>
            ))}
          </ol>
        </Panel>
      </div>
      <Panel title={gameUi("Share as a file")} eyebrow="Export / import">
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportJson}>
            <Download size={14} />{gameUi(" Export JSON ")}</Button>
        </div>
        {gameUi(mode === "advanced" && (
          <div className="mt-3 space-y-2">
            <textarea aria-label={gameUi("Paste a game definition")} className={`${inputClass} min-h-24 font-mono text-xs`} placeholder={gameUi("Paste an exported game here…")} value={importText} onChange={(event) => setImportText(event.target.value)} />
            <Button
              onClick={() => {
                const parsed = parseGameDefinition(importText);
                if (!parsed.definition) return setImportError(parsed.issues.slice(0, 3).map((issue) => issue.message).join(" "));
                setImportError(null);
                setImportText("");
                onImport(parsed.definition);
              }}
            >
              <Upload size={14} />{gameUi(" Import (replaces the editor) ")}</Button>
            {gameUi(importError && (
              <p role="alert" className="text-sm text-red-300">
                {gameUi(importError)}
              </p>
            ))}
          </div>
        ))}
      </Panel>
    </SectionShell>
  );
}

/** Optional developer view of the definition. */
export function JsonPreview() {
  useGameLanguage();
  const { def } = useCardEditor();
  return (
    <Panel title={gameUi("Developer JSON")} eyebrow="Read-only">
      <pre className="max-h-[70vh] overflow-auto rounded-lg bg-black/50 p-3 text-[11px] leading-5 text-zinc-400">{gameUi(JSON.stringify(def, null, 2))}</pre>
    </Panel>
  );
}
