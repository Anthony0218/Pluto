import { useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PanelLeft } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import DashboardDialog from "./DashboardDialog";

const subscribe = (listener: () => void) => {
  const query = window.matchMedia("(min-width: 1280px)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};
export default function DashboardSidebar({ children, sidebar, userId }: { children: ReactNode; sidebar: ReactNode; userId?: string }) {
  useUiLanguage();
  const key = `pluto-dashboard-sidebar-${userId ?? "guest"}`;
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(key) !== "closed"; } catch { return true; } });
  const [drawer, setDrawer] = useState(false);
  const desktop = useSyncExternalStore(subscribe, () => window.matchMedia("(min-width: 1280px)").matches, () => false);
  const headerSlot = typeof document === "undefined" ? null : document.getElementById("dashboard-sidebar-toggle-slot");
  function toggle() {
    setOpen(!open);
    try { localStorage.setItem(key, open ? "closed" : "open"); } catch { /* Still usable when storage is blocked. */ }
  }
  return <>
    {headerSlot && createPortal(<button type="button" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-zinc-200 hover:bg-white/10" aria-label={ui(desktop ? open ? "Collapse sidebar" : "Expand sidebar" : "Open sidebar")} aria-expanded={desktop ? open : drawer} aria-haspopup={desktop ? undefined : "dialog"} aria-controls={desktop ? "dashboard-sidebar-content" : undefined} onClick={() => desktop ? toggle() : setDrawer(true)}><PanelLeft size={19} /></button>, headerSlot)}
    {!desktop && !headerSlot && <button className="dash-button sidebar-mobile-trigger" aria-haspopup="dialog" aria-expanded={drawer} onClick={() => setDrawer(true)}><PanelLeft size={16} />{ui("Sidebar")}</button>}
    <div className={`dashboard-columns ${open ? "sidebar-open" : "sidebar-closed"}`}>
      {desktop && <div className="sidebar-track"><aside className="dashboard-floating-sidebar" aria-label={ui("Dashboard sidebar")}>
        <div className="sidebar-content" id="dashboard-sidebar-content" inert={!open} aria-hidden={!open}>{sidebar}</div>
      </aside></div>}
      <div className="dashboard-main">{children}</div>
    </div>
    {!desktop && drawer && <DashboardDialog title={ui("Dashboard sidebar")} drawer onClose={() => setDrawer(false)}><div className="space-y-3">{sidebar}</div></DashboardDialog>}
  </>;
}
