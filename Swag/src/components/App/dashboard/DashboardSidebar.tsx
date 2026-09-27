import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Users } from "lucide-react";
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
  function toggle() {
    setOpen(!open);
    try { localStorage.setItem(key, open ? "closed" : "open"); } catch { /* Still usable when storage is blocked. */ }
  }
  return <>
    <div className={`dashboard-columns ${open ? "sidebar-open" : "sidebar-closed"}`}>
      {desktop && <div className="sidebar-track"><aside className="dashboard-floating-sidebar" aria-label={ui("Dashboard sidebar")}>
        <div className="sidebar-content" id="dashboard-sidebar-content" inert={!open} aria-hidden={!open}>{sidebar}</div>
      </aside><button type="button" className="sidebar-edge-toggle" aria-label={ui(open ? "Collapse sidebar" : "Expand sidebar")} aria-expanded={open} aria-controls="dashboard-sidebar-content" onClick={toggle}><Users size={18} aria-hidden="true" /></button></div>}
      <div className="dashboard-main">{children}</div>
    </div>
    {!desktop && <button type="button" className="sidebar-edge-toggle sidebar-edge-toggle-mobile" aria-label={ui("Open sidebar")} aria-expanded={drawer} aria-haspopup="dialog" onClick={() => setDrawer(true)}><Users size={18} aria-hidden="true" /></button>}
    {!desktop && drawer && <DashboardDialog title={ui("Dashboard sidebar")} drawer onClose={() => setDrawer(false)}><div className="space-y-3">{sidebar}</div></DashboardDialog>}
  </>;
}
