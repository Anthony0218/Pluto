import { useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Button, GridList, GridListItem, I18nProvider, useDragAndDrop } from "react-aria-components";
import { ArrowLeft, ArrowRight, Check, Grid2X2, GripVertical, Pencil, Plus, X } from "lucide-react";
import CatalogIcon from "@/components/learning/CatalogIcon";
import { reorderFavorites } from "@/data/dashboard";
import { toolApps, toolRoute, type ToolApp } from "@/data/toolCatalog";
import { useLearningToolsProgress } from "@/hooks/useLearningToolsProgress";
import { ui, useUiLanguage } from "@/i18n/ui";
import DashboardDialog from "./DashboardDialog";

const available = toolApps.filter(tool => tool.status === "available");
const toolLimit = 8;
/** Shown until the person picks their own apps. */
const defaultShown = 7;
const byId = (id: string) => available.find(tool => tool.id === id);
const accent = (tool: ToolApp) => ({ "--tile-accent": tool.accent }) as CSSProperties;

export default function ToolShortcuts() {
  const { language } = useUiLanguage();
  return <I18nProvider locale={language === "bar" ? "de" : language}><AppsRow /></I18nProvider>;
}

/** The "Your apps" row: the favourite apps (or the first few until there are any), editable like "My games". */
function AppsRow() {
  const { progress, setFavoriteTools } = useLearningToolsProgress();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [selector, setSelector] = useState(false);
  const [filter, setFilter] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const favorites = progress.favoriteTools.filter(id => byId(id)).slice(0, toolLimit);
  const saved = favorites.length ? favorites : available.slice(0, defaultShown).map(tool => tool.id);
  const editing = draft !== null;
  const ids = draft ?? saved;
  const tools = ids.flatMap(id => byId(id) ?? []);
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: keys => [...keys].map(key => ({ "text/plain": String(key) })),
    getAllowedDropOperations: () => ["move"],
    onReorder: event => setDraft(current => current && reorderFavorites(current, new Set([...event.keys].map(String)), String(event.target.key), event.target.dropPosition === "after" ? "after" : "before")),
    renderDragPreview: items => {
      const tool = byId(String(items[0]?.["text/plain"]));
      const bounds = gridRef.current?.querySelector<HTMLElement>(`[data-tool-id="${tool?.id}"]`)?.getBoundingClientRect();
      return <div className="dashboard-app-tile dashboard-app-preview" style={{ ...(tool ? accent(tool) : {}), width: bounds?.width, height: bounds?.height }} aria-hidden="true">
        <span className="dashboard-app-icon"><CatalogIcon id={tool?.id ?? "tools"} size={26} /></span><strong>{ui(tool?.title ?? "Move")}</strong>
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
  const choices = available.filter(tool => !ids.includes(tool.id) && ui(tool.title).toLocaleLowerCase().includes(filter.toLocaleLowerCase()));
  return <section className="dashboard-apps" aria-labelledby="dashboard-tools-title">
    <div className="dash-section-heading">
      <div><h2 id="dashboard-tools-title">{ui("Your apps")}</h2><p>{ui(editing ? "Drag to reorder, or use the arrow buttons. Save when you are ready." : favorites.length ? "Keep useful tools close." : "Pick the apps you use most.")}</p></div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        {editing ? <>
          <button type="button" className="dash-button" disabled={ids.length >= toolLimit} onClick={() => { setFilter(""); setSelector(true); }}><Plus size={14} />{ui("Add app")}</button>
          <button type="button" className="dash-button" onClick={() => setDraft(null)}>{ui("Cancel")}</button>
          <button type="button" className="dash-button primary" onClick={() => { setFavoriteTools(ids); setDraft(null); }}><Check size={14} />{ui("Save")}</button>
        </> : <>
          <Link to="/tools" className="dash-text-link">{ui("All apps")}<ArrowRight size={14} aria-hidden /></Link>
          <button type="button" className="dash-button" onClick={() => setDraft(saved)}><Pencil size={14} />{ui("Customize")}</button>
        </>}
      </div>
    </div>
    {editing ? <GridList ref={gridRef} dependencies={[ids]} aria-label={ui("Reorder your apps")} items={tools} layout="grid" orientation="horizontal" selectionMode="none" dragAndDropHooks={dragAndDropHooks} className="dashboard-apps-row" renderEmptyState={() => <p className="dashboard-apps-empty">{ui("No apps yet. Add the ones you use most.")}</p>}>
      {tool => <GridListItem id={tool.id} data-tool-id={tool.id} textValue={ui(tool.title)} className="dashboard-app-tile editing" style={accent(tool)}>
        <span className="dashboard-app-icon"><CatalogIcon id={tool.id} size={26} /></span>
        <strong>{ui(tool.title)}</strong>
        <div className="dashboard-app-tools">
          <Button slot="drag" aria-label={`${ui("Move")}: ${ui(tool.title)}`} className="dash-icon-button"><GripVertical size={15} /></Button>
          <Button className="dash-icon-button" isDisabled={ids.indexOf(tool.id) === 0} aria-label={`${ui("Move earlier")}: ${ui(tool.title)}`} onPress={() => move(tool.id, -1)}><ArrowLeft size={15} /></Button>
          <Button className="dash-icon-button" isDisabled={ids.indexOf(tool.id) === ids.length - 1} aria-label={`${ui("Move later")}: ${ui(tool.title)}`} onPress={() => move(tool.id, 1)}><ArrowRight size={15} /></Button>
          <Button className="dash-icon-button" aria-label={`${ui("Remove")}: ${ui(tool.title)}`} onPress={() => setDraft(current => current && current.filter(id => id !== tool.id))}><X size={15} /></Button>
        </div>
      </GridListItem>}
    </GridList> : <div className="dashboard-apps-row">
      {tools.map(tool => <Link key={tool.id} to={toolRoute(tool.id)} className="dashboard-app-tile" style={accent(tool)}>
        <span className="dashboard-app-icon"><CatalogIcon id={tool.id} size={26} /></span>
        <strong>{ui(tool.title)}</strong>
      </Link>)}
      <Link to="/tools" className="dashboard-app-tile dashboard-app-more">
        <span className="dashboard-app-icon"><Grid2X2 size={26} aria-hidden /></span>
        <strong>{ui("All apps")}</strong>
      </Link>
    </div>}
    {selector && <DashboardDialog title={ui("Choose an app")} onClose={() => setSelector(false)}>
      <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-400"><span aria-live="polite">{ids.length} / {toolLimit} {ui("selected")}</span><button type="button" className="dash-button primary" onClick={() => setSelector(false)}><Check size={14} />{ui("Done")}</button></div>
      <input className="dash-input mb-4" aria-label={ui("Search apps")} placeholder={ui("Search apps")} value={filter} onChange={event => setFilter(event.target.value)} />
      <div className="grid gap-2 sm:grid-cols-2">{choices.map(tool => <button key={tool.id} type="button" disabled={ids.length >= toolLimit} className="game-choice" style={accent(tool)} onClick={() => setDraft(current => current && current.length < toolLimit ? [...current, tool.id] : current)}>
        <span className="dashboard-app-icon dashboard-app-icon-small"><CatalogIcon id={tool.id} size={20} /></span><span>{ui(tool.title)}</span><Plus size={15} aria-hidden />
      </button>)}</div>
      {!choices.length && <p className="text-sm text-slate-400">{ui(ids.length >= toolLimit ? "You have picked the most apps you can show." : "No results found.")}</p>}
    </DashboardDialog>}
  </section>;
}
