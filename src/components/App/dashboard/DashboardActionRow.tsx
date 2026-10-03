import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, GridList, GridListItem, I18nProvider, useDragAndDrop } from "react-aria-components";
import { ArrowDown, ArrowRight, ArrowUp, Check, Gamepad2, GripVertical, Pencil, Swords, Trophy, Users } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import { reorderFavorites } from "@/data/dashboard";

const actions = [
  { id: "match", label: "Find a match", detail: "Jump into a game now", route: "/games", Icon: Gamepad2 },
  { id: "friend", label: "Challenge a friend", detail: "Play someone you know", route: "/invite", Icon: Swords },
  { id: "group", label: "Play with your clan", detail: "Create or join a clan", route: "/clans", Icon: Users },
  { id: "ranked", label: "Play competitive (Chess)", detail: "Climb the ranked ladder", route: "/games/chess/ranked", Icon: Trophy },
] as const;

/** Saved order plus an editable draft: changes only persist on Save and Cancel restores the saved order. */
function useStoredOrder(key: string, defaults: string[]) {
  const [saved, setSaved] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(stored)) {
        const valid = [...new Set(stored.filter((id): id is string => typeof id === "string" && defaults.includes(id)))];
        return [...valid, ...defaults.filter(id => !valid.includes(id))];
      }
    } catch { /* Use the default order when storage is unavailable. */ }
    return defaults;
  });
  const [draft, setDraft] = useState<string[] | null>(null);
  const editing = draft !== null;
  const order = draft ?? saved;
  function start() { setDraft(saved); }
  function cancel() { setDraft(null); }
  function save() {
    if (!draft) return;
    setSaved(draft);
    setDraft(null);
    try { localStorage.setItem(key, JSON.stringify(draft)); } catch { /* Reordering still works for this visit. */ }
  }
  function move(id: string, direction: -1 | 1) {
    setDraft(current => {
      if (!current) return current;
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }
  function reorder(keys: Set<string>, target: string, position: "before" | "after") {
    setDraft(current => current && reorderFavorites(current, keys, target, position));
  }
  return { order, editing, start, cancel, save, move, reorder };
}

function CustomizeControls({ editing, onStart, onCancel, onSave }: { editing: boolean; onStart: () => void; onCancel: () => void; onSave: () => void }) {
  return <div className="flex shrink-0 gap-2">
    {editing ? <><button type="button" className="dash-button" onClick={onCancel}>{ui("Cancel")}</button><button type="button" className="dash-button primary" onClick={onSave}><Check size={14} />{ui("Save")}</button></>
      : <button type="button" className="dash-button" onClick={onStart}><Pencil size={14} />{ui("Customize")}</button>}
  </div>;
}

function MoveControls({ label, first, last, onMove }: { label: string; first: boolean; last: boolean; onMove: (direction: -1 | 1) => void }) {
  return <span className="dashboard-move-controls" onClick={event => event.stopPropagation()}>
    <button type="button" disabled={first} aria-label={`${ui("Move earlier")}: ${ui(label)}`} onClick={() => onMove(-1)}><ArrowUp size={15} /></button>
    <button type="button" disabled={last} aria-label={`${ui("Move later")}: ${ui(label)}`} onClick={() => onMove(1)}><ArrowDown size={15} /></button>
  </span>;
}

export default function DashboardActionRow({ userId }: { userId?: string }) {
  const { language } = useUiLanguage();
  return <I18nProvider locale={language === "bar" ? "de" : language}><SortableActionRow userId={userId} /></I18nProvider>;
}

function SortableActionRow({ userId }: { userId?: string }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const { order, editing, start, cancel, save, move, reorder } = useStoredOrder(`pluto-dashboard-actions-${userId ?? "guest"}`, actions.map(action => action.id));
  const orderedActions = order.map(id => actions.find(item => item.id === id)).filter((item): item is (typeof actions)[number] => Boolean(item));
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: keys => [...keys].map(key => ({ "text/plain": String(key) })),
    getAllowedDropOperations: () => ["move"],
    onReorder: event => reorder(new Set([...event.keys].map(String)), String(event.target.key), event.target.dropPosition === "after" ? "after" : "before"),
    renderDragPreview: items => {
      const action = actions.find(item => item.id === items[0]?.["text/plain"]);
      const bounds = gridRef.current?.querySelector<HTMLElement>(`[data-action-id="${action?.id}"]`)?.getBoundingClientRect();
      return <div className="dashboard-action-card dashboard-drag-preview" style={{ width: bounds?.width, height: bounds?.height }}><span>{action ? ui(action.label) : ui("Move")}</span></div>;
    },
    isDisabled: !editing,
  });
  return <section className="dashboard-actions" aria-labelledby="dashboard-actions-title">
    <div className="dash-section-heading"><h2 id="dashboard-actions-title">{ui("Play together")}</h2><CustomizeControls editing={editing} onStart={start} onCancel={cancel} onSave={save} /></div>
    <GridList ref={gridRef} dependencies={[editing, order]} aria-label={ui("Reorder play together actions")} items={orderedActions} layout="grid" orientation="horizontal" selectionMode="none" dragAndDropHooks={dragAndDropHooks} className="dashboard-actions-grid dashboard-sortable-grid">
      {(action) => {
        const index = order.indexOf(action.id);
        const content = <><action.Icon size={27} aria-hidden="true" /><span><strong>{ui(action.label)}</strong><small>{ui(action.detail)}</small></span><ArrowRight size={18} aria-hidden="true" /></>;
        return <GridListItem id={action.id} data-action-id={action.id} textValue={ui(action.label)} className={`dashboard-action-card${action.id === "match" ? " dashboard-action-primary" : ""}${editing ? " editing" : ""}`}>
          {editing ? <div className="dashboard-action-link">{content}</div> : <Link to={action.route} className="dashboard-action-link">{content}</Link>}
          {editing && <div className="dashboard-edit-tools"><Button slot="drag" aria-label={`${ui("Move")}: ${ui(action.label)}`} className="dashboard-drag-handle"><GripVertical size={17} /></Button><MoveControls label={action.label} first={index === 0} last={index === order.length - 1} onMove={direction => move(action.id, direction)} /></div>}
        </GridListItem>;
      }}
    </GridList>
  </section>;
}

export function DashboardContentGrid({ userId, sections }: { userId?: string; sections: { id: string; label: string; content: ReactNode }[] }) {
  const { language } = useUiLanguage();
  return <I18nProvider locale={language === "bar" ? "de" : language}><SortableContentGrid userId={userId} sections={sections} /></I18nProvider>;
}

function SortableContentGrid({ userId, sections }: { userId?: string; sections: { id: string; label: string; content: ReactNode }[] }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const { order, editing, start, cancel, save, move, reorder } = useStoredOrder(`pluto-dashboard-panels-${userId ?? "guest"}`, sections.map(section => section.id));
  const orderedSections = order.map(id => sections.find(item => item.id === id)).filter((item): item is (typeof sections)[number] => Boolean(item));
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: keys => [...keys].map(key => ({ "text/plain": String(key) })),
    getAllowedDropOperations: () => ["move"],
    onReorder: event => reorder(new Set([...event.keys].map(String)), String(event.target.key), event.target.dropPosition === "after" ? "after" : "before"),
    renderDragPreview: items => {
      const section = sections.find(item => item.id === items[0]?.["text/plain"]);
      const bounds = gridRef.current?.querySelector<HTMLElement>(`[data-section-id="${section?.id}"]`)?.getBoundingClientRect();
      return <div className="dashboard-content-preview" style={{ width: bounds?.width, height: Math.min(bounds?.height ?? 150, 220) }}>{section ? ui(section.label) : ui("Move")}</div>;
    },
    isDisabled: !editing,
  });
  return <section className="dashboard-content" aria-labelledby="dashboard-content-title">
    <div className="dash-section-heading"><h2 id="dashboard-content-title">{ui("Your dashboard")}</h2><CustomizeControls editing={editing} onStart={start} onCancel={cancel} onSave={save} /></div>
    <GridList ref={gridRef} dependencies={[editing, order, sections]} aria-label={ui("Reorder dashboard panels")} items={orderedSections} layout="grid" orientation="horizontal" selectionMode="none" dragAndDropHooks={dragAndDropHooks} className="dashboard-content-grid dashboard-sortable-grid">
      {(section) => {
        const index = order.indexOf(section.id);
        return <GridListItem id={section.id} data-section-id={section.id} textValue={ui(section.label)} className={`dashboard-content-item${editing ? " editing" : ""}`}>
          {editing && <div className="dashboard-content-move"><span>{ui(section.label)}</span><div className="dashboard-content-tools"><Button slot="drag" aria-label={`${ui("Move")}: ${ui(section.label)}`} className="dashboard-drag-handle"><GripVertical size={17} /></Button><MoveControls label={section.label} first={index === 0} last={index === order.length - 1} onMove={direction => move(section.id, direction)} /></div></div>}
          {section.content}
        </GridListItem>;
      }}
    </GridList>
  </section>;
}
