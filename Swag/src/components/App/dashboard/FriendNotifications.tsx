import { useState } from "react";
import { Bell, Gamepad2, Mail, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import type { DashboardNotification } from "@/hooks/useDashboardData";
import DashboardDialog from "./DashboardDialog";

export default function FriendNotifications({ items, userId }: { items: DashboardNotification[]; userId?: string }) {
  useUiLanguage();
  const readKey = `pluto-notifications-read-${userId ?? "guest"}`;
  const [readAt, setReadAt] = useState(() => {
    try { return Number(localStorage.getItem(readKey) || 0); }
    catch { return 0; }
  });
  const [open, setOpen] = useState(false);
  const unreadCount = items.filter((item) => Date.parse(item.createdAt) > readAt).length;

  function show() {
    const time = Date.now();
    setReadAt(time);
    setOpen(true);
    try { localStorage.setItem(readKey, String(time)); }
    catch { /* The dialog still works when storage is unavailable. */ }
  }

  return <>
    <button type="button" className="dash-icon-button notification-trigger" aria-label={`${ui("Friend notifications")}${unreadCount ? `: ${unreadCount}` : ""}`} aria-haspopup="dialog" onClick={show}>
      <Bell size={18} />{unreadCount > 0 && <span>{unreadCount}</span>}
    </button>
    {open && <DashboardDialog title={ui("Friend notifications")} onClose={() => setOpen(false)}>
      {items.length ? <div className="space-y-1">{items.map((item) => {
        const Icon = item.kind === "friend_request" ? Users : item.gameCode ? Gamepad2 : Mail;
        const destination = item.kind === "friend_request" ? "/friends" : `/friends${item.senderId ? `?friend=${encodeURIComponent(item.senderId)}` : ""}`;
        return <Link key={item.id} to={destination} onClick={() => setOpen(false)} className="notification-item"><Icon size={20} /><span className="min-w-0"><strong>{ui(item.title)}</strong><small className="truncate">{item.senderName || ui("Player")}{item.gameCode ? ` · ${ui("Room code")}: ${item.gameCode}` : ""}</small></span></Link>;
      })}</div> : <p className="dash-empty">{ui("No friend notifications yet.")}</p>}
    </DashboardDialog>}
  </>;
}
