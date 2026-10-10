import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useCallback, useMemo, useState, type ComponentType } from "react";
import { Code2, Save } from "lucide-react";
import { validateDefinition, type EditorSection, type ValidationReport } from "@/games/cards/engine/validation";
import type { GameDefinition } from "@/games/cards/engine/types";
import type { CardGameRepository } from "@/games/cards/storage/repository";
import type { GameRecord } from "@/games/cards/versioning";
import { Button, Chip, Segmented } from "@/components/chessCustom/ui";
import { CardEditorContext, type EditorMode } from "./editorContext";
import { BasicsSection, DeckSection, PlayersSection, RulebookSection, SettingsSection } from "./sections/BasicsSections";
import { JsonPreview, PreviewSection, PublishSection, ValidationSection } from "./sections/ReviewSections";
import { EndConditionsSection, EventsSection, RulesSection } from "./sections/RulesSections";
import { PhasesSection, SetupSection, ZonesSection } from "./sections/StructureSections";

type SectionId = EditorSection | "validation" | "preview" | "publish";

const SECTIONS: { id: SectionId; label: string; advancedOnly?: boolean; component?: ComponentType }[] = [
  { id: "basics", label: "Basic information", component: BasicsSection },
  { id: "deck", label: "Deck", component: DeckSection },
  { id: "players", label: "Players", component: PlayersSection },
  { id: "zones", label: "Zones", component: ZonesSection },
  { id: "setup", label: "Setup", component: SetupSection },
  { id: "phases", label: "Turn phases", component: PhasesSection },
  { id: "rules", label: "Rules", component: RulesSection },
  { id: "events", label: "Events", advancedOnly: true, component: EventsSection },
  { id: "endConditions", label: "End conditions", component: EndConditionsSection },
  { id: "rulebook", label: "Rulebook", component: RulebookSection },
  { id: "settings", label: "Game settings", component: SettingsSection },
  { id: "validation", label: "Validation" },
  { id: "preview", label: "Preview / Test" },
  { id: "publish", label: "Save / Publish" },
];

function safeReport(def: GameDefinition): ValidationReport {
  try {
    return validateDefinition(def);
  } catch (error) {
    const issue = { id: "crash", severity: "error" as const, section: "basics" as const, message: `The definition could not be checked: ${error instanceof Error ? error.message : String(error)}` };
    return { issues: [issue], errors: [issue], warnings: [], successes: [], canPublish: false };
  }
}

export default function CardGameEditor({
  initial,
  initialRecord,
  repository,
  fallback,
  onSaved,
}: {
  initial: GameDefinition;
  initialRecord: GameRecord | null;
  repository: CardGameRepository;
  fallback: CardGameRepository;
  onSaved: (record: GameRecord) => void;
}) {
  useGameLanguage();
  const [def, setDef] = useState(initial);
  const [record, setRecord] = useState(initialRecord);
  const [dirty, setDirty] = useState(!initialRecord);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>("basics");
  const [mode, setMode] = useState<EditorMode>("basic");
  const [showJson, setShowJson] = useState(false);
  const [store, setStore] = useState(repository);
  const report = useMemo(() => safeReport(def), [def]);

  const edit = useCallback((mutate: (draft: GameDefinition) => void) => {
    setDef((previous) => {
      const next = structuredClone(previous);
      mutate(next);
      return next;
    });
    setDirty(true);
  }, []);

  const goTo = useCallback((target: SectionId) => {
    setSection(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      let saved: GameRecord;
      try {
        saved = await store.saveDraft(record?.id ?? null, def);
      } catch (error) {
        if (store.kind !== "cloud") throw error;
        // The account store is unavailable (offline, or not deployed): keep the work locally.
        saved = await fallback.saveDraft(record?.id ?? null, def);
        setStore(fallback);
        setMessage(`Could not save to your account (${error instanceof Error ? error.message : "unknown error"}) — saved in this browser instead.`);
      }
      setRecord(saved);
      setDirty(false);
      setMessage((current) => current ?? `Saved draft version ${saved.versions[saved.versions.length - 1].version}.`);
      onSaved(saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!record) return;
    setBusy(true);
    try {
      const published = await store.publish(record.id);
      setRecord(published);
      setMessage(`Published version ${published.versions[published.versions.length - 1].version}. It can no longer change — your next save starts version ${published.versions.length + 1}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const visible = SECTIONS.filter((entry) => mode === "advanced" || !entry.advancedOnly);
  const active = visible.find((entry) => entry.id === section) ?? visible[0];
  const counts = (id: SectionId) => report.issues.filter((issue) => issue.section === id && issue.severity !== "success");
  const Active = active.component;

  return (
    <CardEditorContext.Provider value={{ def, edit, mode, issues: report.issues, goTo }}>
      <div className="sticky top-0 z-20 -mx-4 mb-5 flex flex-wrap items-center gap-3 border-b border-white/[0.06] bg-zinc-950/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500">{gameUi("Card game builder")}</p>
          <h1 className="truncate text-lg font-bold text-white">{gameUi(def.name || "Untitled game")}</h1>
        </div>
        <Segmented
          label={gameUi("Editor mode")}
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { id: "basic", label: "Basic", title: "Friendly choices for the most common settings" },
            { id: "advanced", label: "Advanced", title: "Every option, ids, events and developer JSON" },
          ]}
        />
        <button type="button" onClick={() => goTo("validation")} className="rounded-full focus-visible:outline-2 focus-visible:outline-amber-300">
          <Chip tone={report.errors.length ? "red" : report.warnings.length ? "amber" : "emerald"}>
            {gameUi(report.errors.length ? `${report.errors.length} errors` : report.warnings.length ? `${report.warnings.length} warnings` : "Ready to publish")}
          </Chip>
        </button>
        <div className="ml-auto flex items-center gap-2">
          {gameUi(mode === "advanced" && (
            <Button size="sm" onClick={() => setShowJson(!showJson)} aria-pressed={showJson}>
              <Code2 size={14} />{gameUi(" JSON ")}</Button>
          ))}
          <Button size="sm" tone="primary" onClick={save} disabled={busy}>
            <Save size={14} /> {gameUi(dirty ? "Save draft" : "Saved")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label={gameUi("Editor sections")} className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <ol className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {visible.map((entry) => {
              const issues = counts(entry.id);
              const errors = issues.filter((issue) => issue.severity === "error").length;
              const number = SECTIONS.findIndex((item) => item.id === entry.id) + 1;
              return (
                <li key={entry.id} className="shrink-0">
                  <button
                    type="button"
                    aria-current={entry.id === active.id ? "step" : undefined}
                    onClick={() => goTo(entry.id)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${entry.id === active.id ? "bg-amber-300/15 text-amber-100" : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"}`}
                  >
                    <span className="w-5 font-mono text-[11px] text-zinc-500">{gameUi(number)}</span>
                    <span className="flex-1 whitespace-nowrap">{gameUi(entry.label)}</span>
                    {gameUi(errors > 0 ? (
                      <span className="rounded-full bg-red-500/80 px-1.5 text-[10px] font-bold text-white" aria-label={gameUi(`${errors} errors`)}>
                        {gameUi(errors)}
                      </span>
                    ) : issues.length > 0 ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-label={gameUi("has warnings")} />
                    ) : null)}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="min-w-0 space-y-6 pb-16">
          {Active && <Active />}
          {active.id === "validation" && <ValidationSection report={report} />}
          {active.id === "preview" && <PreviewSection report={report} />}
          {gameUi(active.id === "publish" && (
            <PublishSection
              record={record}
              dirty={dirty}
              busy={busy}
              storage={store.kind}
              message={message}
              onSave={save}
              onPublish={publish}
              onImport={(imported) => (setDef({ ...imported, id: def.id }), setDirty(true), setMessage("Imported — save to keep it."))}
              report={report}
            />
          ))}
          {gameUi(message && active.id !== "publish" && (
            <p role="status" className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-300">
              {gameUi(message)}
            </p>
          ))}
          {mode === "advanced" && showJson && <JsonPreview />}
          <div className="flex justify-between border-t border-white/[0.06] pt-4">
            {gameUi(visible.indexOf(active) > 0 ? (
              <Button onClick={() => goTo(visible[visible.indexOf(active) - 1].id)}>← {gameUi(visible[visible.indexOf(active) - 1].label)}</Button>
            ) : (
              <span />
            ))}
            {gameUi(visible.indexOf(active) < visible.length - 1 && (
              <Button tone="primary" onClick={() => goTo(visible[visible.indexOf(active) + 1].id)}>
                {gameUi(visible[visible.indexOf(active) + 1].label)} →
              </Button>
            ))}
          </div>
        </div>
      </div>
    </CardEditorContext.Provider>
  );
}
