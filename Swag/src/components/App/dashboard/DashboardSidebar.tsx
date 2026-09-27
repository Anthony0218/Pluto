import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, PanelRight } from "lucide-react";
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
    {!desktop && <button className="dash-button sidebar-mobile-trigger" aria-haspopup="dialog" aria-expanded={drawer} onClick={() => setDrawer(true)}><PanelRight size={16} />{ui("Progress & challenges")}</button>}
    <div className={`dashboard-columns ${open ? "sidebar-open" : "sidebar-closed"}`}>
      {desktop && <div className="sidebar-track"><aside className="dashboard-floating-sidebar" aria-label={ui("Progress & challenges")}>
        <button className="sidebar-edge-toggle" aria-label={ui(open ? "Collapse sidebar" : "Expand sidebar")} aria-expanded={open} aria-controls="dashboard-sidebar-content" onClick={toggle}>{open ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}</button>
        <div className="sidebar-content" id="dashboard-sidebar-content" inert={!open} aria-hidden={!open}>{sidebar}</div>
      </aside></div>}
      <div className="dashboard-main">{children}</div>
    </div>
    {!desktop && drawer && <DashboardDialog title={ui("Progress & challenges")} drawer onClose={() => setDrawer(false)}><div className="space-y-3">{sidebar}</div></DashboardDialog>}
  </>;
}
