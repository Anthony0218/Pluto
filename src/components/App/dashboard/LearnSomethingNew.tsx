import { useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Check, GripVertical, Pencil, Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button, GridList, GridListItem, I18nProvider, useDragAndDrop } from "react-aria-components";
import { ui, useUiLanguage } from "@/i18n/ui";
import { learningLessons, learningSubjects, subjectRoute } from "@/data/learningCatalog";
import { reorderFavorites } from "@/data/dashboard";
import { useAuth } from "@/context/AuthContext";
import { useLearningToolsProgress } from "@/hooks/useLearningToolsProgress";
import CatalogIcon from "@/components/learning/CatalogIcon";
import DashboardDialog from "./DashboardDialog";
import { useHeightLock } from "./useHeightLock";

const available = learningSubjects.filter(subject => !subject.later);
/** Shown until the person picks their own subjects: all of them. */
const defaultSubjects = available.map(subject => subject.id);
const learnLimit = available.length;
const byId = (id: string) => available.find(subject => subject.id === id);

/** The chosen subjects, stored per account in this browser. `null` means nothing was chosen yet. */
function useLearnSubjects() {
  const { user } = useAuth();
  const key = `pluto-learn-subjects-${user?.id ?? "guest"}`;
  const [saved, setSaved] = useState<string[] | null>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
      if (Array.isArray(stored)) return [...new Set(stored.filter((id): id is string => typeof id === "string" && !!byId(id)))].slice(0, learnLimit);
    } catch { /* Use the default subjects when storage is unavailable. */ }
    return null;
  });
  function save(ids: string[]) {
    setSaved(ids);
    try { localStorage.setItem(key, JSON.stringify(ids)); }
    catch { /* The choice still applies until the page is closed. */ }
  }
  return { saved: saved ?? defaultSubjects, save };
}

export default function LearnSomethingNew() {
  const { language } = useUiLanguage();
  return <I18nProvider locale={language === "bar" ? "de" : language}><LearnPanel /></I18nProvider>;
}

const subjectLabel = (id: string, continuing: boolean) => ui(continuing ? "Continue lesson" : byId(id)?.resourceLabel ?? (learningLessons.some(lesson => lesson.subjectId === id) ? "Open course" : "Explore upcoming learning paths"));

/** The "Learn" panel: the chosen subjects (the one with an unfinished lesson offers to continue it), editable like "Games" and "Tools". */
function LearnPanel() {
  const { progress } = useLearningToolsProgress();
  const { saved, save } = useLearnSubjects();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [selector, setSelector] = useState(false);
  const [filter, setFilter] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const [panelRef, panelStyle, lockHeight, unlockHeight] = useHeightLock<HTMLElement>();
  const recent = learningLessons.filter(lesson => progress.lessons[lesson.id] && !progress.lessons[lesson.id].completed).sort((a, b) => progress.lessons[b.id].updatedAt - progress.lessons[a.id].updatedAt)[0];
  const editing = draft !== null;
  const ids = draft ?? saved;
  const subjects = ids.flatMap(id => byId(id) ?? []);
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: keys => [...keys].map(key => ({ "text/plain": String(key) })),
    getAllowedDropOperations: () => ["move"],
    onReorder: event => setDraft(current => current && reorderFavorites(current, new Set([...event.keys].map(String)), String(event.target.key), event.target.dropPosition === "after" ? "after" : "before")),
    renderDragPreview: items => {
      const subject = byId(String(items[0]?.["text/plain"]));
      const bounds = listRef.current?.querySelector<HTMLElement>(`[data-subject-id="${subject?.id}"]`)?.getBoundingClientRect();
      return <div className="dashboard-learning-link dashboard-learning-preview" style={{ width: bounds?.width, height: bounds?.height }} aria-hidden="true">
        <span className="dashboard-learning-icon"><CatalogIcon id={subject?.id ?? "math"} size={17} /></span><span><strong>{ui(subject?.title ?? "Move")}</strong></span>
      </div>;
    },
    isDisabled: !editing,
  });
  const move = (id: string, step: -1 | 1) => setDraft(current => {
    if (!current) return current;
    const from = current.indexOf(id), to = from + step;
    if (from < 0 || to < 0 || to >= current.length) return current;
    const next = [...current];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
  });
  const choices = available.filter(subject => !ids.includes(subject.id) && ui(subject.title).toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  return <section ref={panelRef} style={panelStyle} className={`dash-panel learn-panel${editing ? " editing" : ""}`} aria-labelledby="dashboard-learn-title">
    <div className="dash-section-heading">
      <div><h2 id="dashboard-learn-title">{ui("Learn")}</h2><p>{ui("Choose a subject and learn at your own pace.")}</p>{editing && <p className="sr-only">{ui("Drag to reorder, or use the arrow buttons. Save when you are ready.")}</p>}</div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {editing ? <>
          <button type="button" className="dash-button icon-only" aria-label={ui("Add subject")} title={ui("Add subject")} disabled={ids.length >= learnLimit} onClick={() => { setFilter(""); setSelector(true); }}><Plus size={14} /></button>
          <button type="button" className="dash-button" onClick={() => { setDraft(null); unlockHeight(); }}>{ui("Cancel")}</button>
          <button type="button" className="dash-button primary" onClick={() => { save(ids); setDraft(null); unlockHeight(); }}><Check size={14} />{ui("Save")}</button>
        </> : <>
          <Link to="/learn" className="dash-text-link">{ui("All subjects")}<ArrowRight size={14} aria-hidden /></Link>
          <button type="button" className="dash-button" onClick={() => { lockHeight(); setDraft(saved); }}><Pencil size={14} />{ui("Customize")}</button>
        </>}
      </div>
    </div>
    {editing ? <div className="dashboard-learning-links">
      <GridList ref={listRef} dependencies={[ids]} aria-label={ui("Reorder your subjects")} items={subjects} layout="stack" selectionMode="none" dragAndDropHooks={dragAndDropHooks} className="dashboard-learning-sortable" renderEmptyState={() => <p className="dashboard-apps-empty">{ui("No subjects yet. Add the ones you want to learn.")}</p>}>
        {subject => <GridListItem id={subject.id} data-subject-id={subject.id} textValue={ui(subject.title)} className="dashboard-learning-link editing">
          <span className="dashboard-learning-icon"><CatalogIcon id={subject.id} size={17} /></span>
          <span><strong>{ui(subject.title)}</strong><small>{subjectLabel(subject.id, recent?.subjectId === subject.id)}</small></span>
          <div className="dashboard-learning-tools">
            <Button slot="drag" aria-label={`${ui("Move")}: ${ui(subject.title)}`} className="dash-icon-button"><GripVertical size={14} /></Button>
            <Button className="dash-icon-button" isDisabled={ids.indexOf(subject.id) === 0} aria-label={`${ui("Move earlier")}: ${ui(subject.title)}`} onPress={() => move(subject.id, -1)}><ArrowUp size={14} /></Button>
            <Button className="dash-icon-button" isDisabled={ids.indexOf(subject.id) === ids.length - 1} aria-label={`${ui("Move later")}: ${ui(subject.title)}`} onPress={() => move(subject.id, 1)}><ArrowDown size={14} /></Button>
            <Button className="dash-icon-button" aria-label={`${ui("Remove")}: ${ui(subject.title)}`} onPress={() => setDraft(current => current && current.filter(id => id !== subject.id))}><X size={14} /></Button>
          </div>
        </GridListItem>}
      </GridList>
    </div> : <div className="dashboard-learning-links">
      {subjects.map(subject => <Link key={subject.id} to={recent?.subjectId === subject.id ? recent.route : subjectRoute(subject.id)} className="dashboard-learning-link"><span className="dashboard-learning-icon"><CatalogIcon id={subject.id} size={17} /></span><span><strong>{ui(subject.title)}</strong><small>{subjectLabel(subject.id, recent?.subjectId === subject.id)}</small></span><ArrowRight size={15} aria-hidden /></Link>)}
    </div>}
    {selector && <DashboardDialog title={ui("Choose a subject")} onClose={() => setSelector(false)}>
      <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-400"><span aria-live="polite">{ids.length} / {learnLimit} {ui("selected")}</span><button type="button" className="dash-button primary" onClick={() => setSelector(false)}><Check size={14} />{ui("Done")}</button></div>
      <input className="dash-input mb-4" aria-label={ui("Search subjects")} placeholder={ui("Search subjects")} value={filter} onChange={event => setFilter(event.target.value)} />
      <div className="grid gap-2 sm:grid-cols-2">{choices.map(subject => <button key={subject.id} type="button" disabled={ids.length >= learnLimit} className="game-choice" onClick={() => { setDraft([...ids, subject.id]); if (ids.length + 1 >= learnLimit) setSelector(false); }}>
        <span className="dashboard-learning-icon dashboard-app-icon-small"><CatalogIcon id={subject.id} size={18} /></span><span>{ui(subject.title)}</span><Plus size={15} aria-hidden />
      </button>)}</div>
      {!choices.length && <p className="text-sm text-slate-400">{ui(ids.length >= learnLimit ? "You have picked the most subjects you can show." : "No results found.")}</p>}
    </DashboardDialog>}
  </section>;
}
