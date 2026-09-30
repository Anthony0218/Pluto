import { useState } from "react";
import { BookOpen, Gamepad2, Pencil, Puzzle } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";

const shortcuts = {
  games: { label: "Games", route: "/games", Icon: Gamepad2 },
  puzzle: { label: "Chess Puzzle", route: "/games/chess/rules?tab=puzzles", Icon: Puzzle },
  rules: { label: "Rules", route: "/games/chess/rules", Icon: BookOpen },
} as const;
type Shortcut = keyof typeof shortcuts;
const defaults: [Shortcut, Shortcut] = ["games", "puzzle"];

function readSlots(key: string): [Shortcut, Shortcut] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (Array.isArray(value) && value.length === 2 && value.every(item => typeof item === "string" && Object.hasOwn(shortcuts, item))) return value as [Shortcut, Shortcut];
  } catch { /* Storage can be unavailable. */ }
  return defaults;
}

export default function QuickNavigation({ userId }: { userId: string }) {
  useUiLanguage();
  const key = `pluto-quick-navigation-${userId}`;
  const [slots, setSlots] = useState(() => readSlots(key));
  const [editing, setEditing] = useState(false);
  function update(index: number, value: Shortcut) {
    const next: [Shortcut, Shortcut] = [...slots];
    next[index] = value;
    setSlots(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* The selection still works for this visit. */ }
  }
  return <section className="mt-6" aria-labelledby="quick-navigation-title">
    <div className="mb-3 flex items-center justify-between gap-3"><h3 id="quick-navigation-title" className="text-lg font-semibold text-white">{ui("Quick Navigation")}</h3><button type="button" aria-pressed={editing} onClick={() => setEditing(!editing)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs text-indigo-200 hover:bg-white/10"><Pencil size={14} />{ui(editing ? "Done" : "Edit")}</button></div>
    <div className="grid grid-cols-2 gap-3">{slots.map((id, index) => {
      const { label, route, Icon } = shortcuts[id];
      return <div key={index} className="min-w-0"><Link to={route} className="flex min-h-24 flex-col items-start justify-center gap-2 rounded-xl border border-indigo-300/25 bg-indigo-400/[0.08] p-3 text-sm font-semibold text-white transition hover:border-indigo-300/60 hover:bg-indigo-400/15"><Icon size={20} className="text-indigo-300" /><span>{ui(label)}</span></Link>{editing && <select aria-label={`${ui("Shortcut")} ${index + 1}`} className="mt-2 w-full rounded-lg border border-white/20 bg-[#10172a] p-2 text-xs text-white" value={id} onChange={event => update(index, event.target.value as Shortcut)}>{(Object.keys(shortcuts) as Shortcut[]).map(option => <option key={option} value={option}>{ui(shortcuts[option].label)}</option>)}</select>}</div>;
    })}</div>
  </section>;
}
