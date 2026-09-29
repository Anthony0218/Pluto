import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowRight, ArrowUp, Gamepad2, Pencil, Swords, Trophy, Users } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";

const actions = [
  { id: "match", label: "Find a match", detail: "Jump into a game now", route: "/games", Icon: Gamepad2 },
  { id: "friend", label: "Challenge a friend", detail: "Play someone you know", route: "/friends", Icon: Swords },
  { id: "group", label: "Play with group", detail: "Create or join a group", route: "/groups", Icon: Users },
  { id: "ranked", label: "Play competitive (Chess)", detail: "Climb the ranked ladder", route: "/games/chess/ranked", Icon: Trophy },
] as const;

function useStoredOrder(key: string, defaults: string[]) {
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key) || "null");
      if (Array.isArray(saved)) {
        const valid = [...new Set(saved.filter((id): id is string => typeof id === "string" && defaults.includes(id)))];
        return [...valid, ...defaults.filter(id => !valid.includes(id))];
      }
    } catch { /* Use the default order when storage is unavailable. */ }
    return defaults;
  });
  function move(id: string, direction: -1 | 1) {
    setOrder(current => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Reordering still works for this visit. */ }
      return next;
    });
  }
  return { order, move };
}

function MoveControls({ label, first, last, onMove }: { label: string; first: boolean; last: boolean; onMove: (direction: -1 | 1) => void }) {
  return <span className="dashboard-move-controls" onClick={event => event.stopPropagation()}>
    <button type="button" disabled={first} aria-label={`${ui("Move earlier")}: ${ui(label)}`} onClick={() => onMove(-1)}><ArrowUp size={15} /></button>
    <button type="button" disabled={last} aria-label={`${ui("Move later")}: ${ui(label)}`} onClick={() => onMove(1)}><ArrowDown size={15} /></button>
  </span>;
}

export default function DashboardActionRow({ userId }: { userId?: string }) {
  useUiLanguage();
  const [editing, setEditing] = useState(false);
  const { order, move } = useStoredOrder(`pluto-dashboard-actions-${userId ?? "guest"}`, actions.map(action => action.id));
  return <section className="dashboard-actions" aria-labelledby="dashboard-actions-title">
    <div className="dash-section-heading"><h2 id="dashboard-actions-title">{ui("Play together")}</h2><button type="button" className="dash-button" aria-pressed={editing} onClick={() => setEditing(value => !value)}><Pencil size={14} />{ui(editing ? "Done" : "Customize")}</button></div>
    <div className="dashboard-actions-grid">{order.map((id, index) => {
      const action = actions.find(item => item.id === id)!;
      return <div key={id} className={`dashboard-action-card${id === "match" ? " dashboard-action-primary" : ""}`}>
        <Link to={action.route} className="dashboard-action-link"><action.Icon size={27} aria-hidden="true" /><span><strong>{ui(action.label)}</strong><small>{ui(action.detail)}</small></span><ArrowRight size={18} aria-hidden="true" /></Link>
        {editing && <MoveControls label={action.label} first={index === 0} last={index === order.length - 1} onMove={direction => move(id, direction)} />}
      </div>;
    })}</div>
  </section>;
}

export function DashboardContentGrid({ userId, sections }: { userId?: string; sections: { id: string; label: string; content: ReactNode }[] }) {
  useUiLanguage();
  const [editing, setEditing] = useState(false);
  const { order, move } = useStoredOrder(`pluto-dashboard-panels-${userId ?? "guest"}`, sections.map(section => section.id));
  return <section className="dashboard-content" aria-labelledby="dashboard-content-title">
    <div className="dash-section-heading"><h2 id="dashboard-content-title">{ui("Your dashboard")}</h2><button type="button" className="dash-button" aria-pressed={editing} onClick={() => setEditing(value => !value)}><Pencil size={14} />{ui(editing ? "Done" : "Customize")}</button></div>
    <div className="dashboard-content-grid">{order.map((id, index) => {
      const section = sections.find(item => item.id === id);
      if (!section) return null;
      return <div key={id} className="dashboard-content-item">{editing && <div className="dashboard-content-move"><span>{ui(section.label)}</span><MoveControls label={section.label} first={index === 0} last={index === order.length - 1} onMove={direction => move(id, direction)} /></div>}{section.content}</div>;
    })}</div>
  </section>;
}
