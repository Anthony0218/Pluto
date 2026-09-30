import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Users } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import type { DashboardNotification } from "@/hooks/useDashboardData";
import DashboardDialog from "./DashboardDialog";
import { getFriendMessageBaseline } from "./messageReadState";

const subscribe = (listener: () => void) => {
  const query = window.matchMedia("(min-width: 1280px)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};

export default function DashboardSidebar({ children, sidebar, userId, onlineFriendsCount, notifications, readMessageIds }: { children: ReactNode; sidebar: ReactNode; userId?: string; onlineFriendsCount: number; notifications: DashboardNotification[]; readMessageIds: string[] }) {
  useUiLanguage();
  // The friend list starts hidden on every visit and slides out from the Friends button.
  const [open, setOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const desktop = useSyncExternalStore(subscribe, () => window.matchMedia("(min-width: 1280px)").matches, () => false);
  const [messageBaseline] = useState(() => getFriendMessageBaseline(userId));
  const unreadMessagesCount = notifications.filter(notification => notification.kind === "message" && notification.senderId && Date.parse(notification.createdAt) > messageBaseline && !readMessageIds.includes(notification.id)).length;
  const notificationSummary = unreadMessagesCount > 0 ? `, ${unreadMessagesCount} ${ui("New message")}${unreadMessagesCount === 1 ? "" : "s"}` : "";
  const onlineSummary = onlineFriendsCount > 0 ? `, ${onlineFriendsCount} ${ui("Online")}` : "";

  function toggle() {
    setOpen(!open);
  }

  return <>
    <div className={`dashboard-columns ${open ? "sidebar-open" : "sidebar-closed"}`}>
      <div className="dashboard-main">{children}</div>
      {desktop && <div className="sidebar-track"><aside className="dashboard-floating-sidebar" aria-label={ui("Dashboard sidebar")}>
        <div className="sidebar-content" id="dashboard-sidebar-content" inert={!open} aria-hidden={!open}>{sidebar}</div>
      </aside><button type="button" className="sidebar-edge-toggle" aria-label={`${ui(open ? "Collapse sidebar" : "Expand sidebar")}${onlineSummary}${notificationSummary}`} aria-expanded={open} aria-controls="dashboard-sidebar-content" onClick={toggle}><Users size={18} aria-hidden="true" />{onlineFriendsCount > 0 && <span className="sidebar-online-count" aria-hidden="true">{onlineFriendsCount}</span>}{unreadMessagesCount > 0 && <span className="sidebar-message-count" aria-hidden="true">{unreadMessagesCount}</span>}</button></div>}
    </div>
    {!desktop && <button type="button" className="sidebar-edge-toggle sidebar-edge-toggle-mobile" aria-label={`${ui("Open sidebar")}${onlineSummary}${notificationSummary}`} aria-expanded={drawer} aria-haspopup="dialog" onClick={() => setDrawer(true)}><Users size={18} aria-hidden="true" />{onlineFriendsCount > 0 && <span className="sidebar-online-count" aria-hidden="true">{onlineFriendsCount}</span>}{unreadMessagesCount > 0 && <span className="sidebar-message-count" aria-hidden="true">{unreadMessagesCount}</span>}</button>}
    {!desktop && drawer && <DashboardDialog title={ui("Dashboard sidebar")} drawer onClose={() => setDrawer(false)}><div className="space-y-3">{sidebar}</div></DashboardDialog>}
  </>;
}
