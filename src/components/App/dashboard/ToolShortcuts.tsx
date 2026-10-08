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
import { useHeightLock } from "./useHeightLock";

const available = toolApps.filter(tool => tool.status === "available");
const toolLimit = 12;
/** Shown until the person picks their own apps: every app but the budget tracker. */
const defaultTools = available.filter(tool => tool.id !== "budget-tracker").slice(0, toolLimit).map(tool => tool.id);
const byId = (id: string) => available.find(tool => tool.id === id);
const accent = (tool: ToolApp) => ({ "--tile-accent": tool.accent }) as CSSProperties;

export default function ToolShortcuts() {
  const { language } = useUiLanguage();
  return <I18nProvider locale={language === "bar" ? "de" : language}><AppsRow /></I18nProvider>;
}

/** The "Tools" panel: the favourite tools (or the first few until there are any), editable like "Games". */
function AppsRow() {
  const { progress, setFavoriteTools } = useLearningToolsProgress();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [selector, setSelector] = useState(false);
  const [filter, setFilter] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const [panelRef, panelStyle, lockHeight, unlockHeight] = useHeightLock<HTMLElement>();
  const favorites = progress.favoriteTools.filter(id => byId(id)).slice(0, toolLimit);
  const saved = favorites.length ? favorites : defaultTools;
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
  return <section ref={panelRef} style={panelStyle} className={`dashboard-apps dash-panel${editing ? " editing" : ""}`} aria-labelledby="dashboard-tools-title">
    <div className="dash-section-heading">
      <div><h2 id="dashboard-tools-title">{ui("Tools")}</h2><p>{ui(favorites.length ? "Keep useful tools close." : "Pick the tools you use most.")}</p>{editing && <p className="sr-only">{ui("Drag to reorder, or use the arrow buttons. Save when you are ready.")}</p>}</div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {editing ? <>
          <button type="button" className="dash-button icon-only" aria-label={ui("Add tool")} title={ui("Add tool")} disabled={ids.length >= toolLimit} onClick={() => { setFilter(""); setSelector(true); }}><Plus size={14} /></button>
          <button type="button" className="dash-button" onClick={() => { setDraft(null); unlockHeight(); }}>{ui("Cancel")}</button>
          <button type="button" className="dash-button primary" onClick={() => { setFavoriteTools(ids); setDraft(null); unlockHeight(); }}><Check size={14} />{ui("Save")}</button>
        </> : <>
          <Link to="/tools" className="dash-text-link">{ui("All tools")}<ArrowRight size={14} aria-hidden /></Link>
          <button type="button" className="dash-button" onClick={() => { lockHeight(); setDraft(saved); }}><Pencil size={14} />{ui("Customize")}</button>
        </>}
      </div>
    </div>
    {editing ? <GridList ref={gridRef} dependencies={[ids]} aria-label={ui("Reorder your tools")} items={tools} layout="grid" orientation="horizontal" selectionMode="none" dragAndDropHooks={dragAndDropHooks} className="dashboard-apps-row" renderEmptyState={() => <p className="dashboard-apps-empty">{ui("No tools yet. Add the ones you use most.")}</p>}>
      {tool => <GridListItem id={tool.id} data-tool-id={tool.id} textValue={ui(tool.title)} className="dashboard-app-tile editing" style={accent(tool)}>
        <span className="dashboard-app-icon"><CatalogIcon id={tool.id} size={26} /></span>
        <strong>{ui(tool.title)}</strong>
        <div className="edit-controls">
          <Button slot="drag" aria-label={`${ui("Move")}: ${ui(tool.title)}`} className="dash-icon-button"><GripVertical size={13} /></Button>
          <Button className="dash-icon-button" isDisabled={ids.indexOf(tool.id) === 0} aria-label={`${ui("Move earlier")}: ${ui(tool.title)}`} onPress={() => move(tool.id, -1)}><ArrowLeft size={13} /></Button>
          <Button className="dash-icon-button" isDisabled={ids.indexOf(tool.id) === ids.length - 1} aria-label={`${ui("Move later")}: ${ui(tool.title)}`} onPress={() => move(tool.id, 1)}><ArrowRight size={13} /></Button>
          <Button className="dash-icon-button" aria-label={`${ui("Remove")}: ${ui(tool.title)}`} onPress={() => setDraft(current => current && current.filter(id => id !== tool.id))}><X size={13} /></Button>
        </div>
      </GridListItem>}
    </GridList> : <div className="dashboard-apps-row">
      {tools.map(tool => <Link key={tool.id} to={toolRoute(tool.id)} className="dashboard-app-tile" style={accent(tool)}>
        <span className="dashboard-app-icon"><CatalogIcon id={tool.id} size={26} /></span>
        <strong>{ui(tool.title)}</strong>
      </Link>)}
      {tools.length < toolLimit && <Link to="/tools" className="dashboard-app-tile dashboard-app-more">
        <span className="dashboard-app-icon"><Grid2X2 size={26} aria-hidden /></span>
        <strong>{ui("All tools")}</strong>
      </Link>}
    </div>}
    {selector && <DashboardDialog title={ui("Choose a tool")} onClose={() => setSelector(false)}>
      <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-400"><span aria-live="polite">{ids.length} / {toolLimit} {ui("selected")}</span><button type="button" className="dash-button primary" onClick={() => setSelector(false)}><Check size={14} />{ui("Done")}</button></div>
      <input className="dash-input mb-4" aria-label={ui("Search tools")} placeholder={ui("Search tools")} value={filter} onChange={event => setFilter(event.target.value)} />
      <div className="grid gap-2 sm:grid-cols-2">{choices.map(tool => <button key={tool.id} type="button" disabled={ids.length >= toolLimit} className="game-choice" style={accent(tool)} onClick={() => setDraft(current => current && current.length < toolLimit ? [...current, tool.id] : current)}>
        <span className="dashboard-app-icon dashboard-app-icon-small"><CatalogIcon id={tool.id} size={20} /></span><span>{ui(tool.title)}</span><Plus size={15} aria-hidden />
      </button>)}</div>
      {!choices.length && <p className="text-sm text-slate-400">{ui(ids.length >= toolLimit ? "You have picked the most tools you can show." : "No results found.")}</p>}
    </DashboardDialog>}
  </section>;
}
