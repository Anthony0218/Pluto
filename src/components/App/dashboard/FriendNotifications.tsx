import { useState } from "react";
import { Bell, BellOff, Eye, Gamepad2, Mail, Shield, Users, X } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import type { DashboardNotification } from "@/hooks/useDashboardData";
import DashboardDialog from "./DashboardDialog";
import { acceptInviteState } from "@/components/social/inviteRoute";
import { notificationActionLabel, notificationDestination, notificationRoomCode, respondToSpectateRequest } from "@/components/social/notificationActions";
import { leaveCurrentRoom } from "@/components/social/currentRoom";
import DoNotDisturbSwitch, { ClanPopupsSwitch } from "../notifications/DoNotDisturbSwitch";
import { markNotificationsSeen, useDoNotDisturb, useSeenNotificationIds } from "../notifications/notificationState";

type Filter = "all" | "games" | "social";

export default function FriendNotifications({ items, userId }: { items: DashboardNotification[]; userId?: string }) {
  useUiLanguage();
  const readKey = `pluto-notifications-read-${userId ?? "guest"}`;
  const dismissedKey = `pluto-notifications-dismissed-${userId ?? "guest"}`;
  const [readAt, setReadAt] = useState(() => {
    try { return Number(localStorage.getItem(readKey) || 0); }
    catch { return 0; }
  });
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(dismissedKey) || "[]");
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
    } catch { return []; }
  });
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);
  const [openedReadAt, setOpenedReadAt] = useState(readAt);
  const seen = useSeenNotificationIds(userId);
  const [doNotDisturb] = useDoNotDisturb(userId);
  const visibleItems = items.filter(item => !dismissed.includes(item.id));
  const filteredItems = visibleItems.filter(item => filter === "all" || (filter === "games" ? !!item.gameCode || item.kind === "spectate_request" || item.kind === "spectate_accepted" : !item.gameCode && item.kind !== "spectate_request" && item.kind !== "spectate_accepted"));
  const unreadCount = visibleItems.filter(item => Date.parse(item.createdAt) > readAt && !seen.has(item.id)).length;

  function show() {
    const time = Date.now();
    setOpenedReadAt(readAt);
    setReadAt(time);
    setOpen(true);
    try { localStorage.setItem(readKey, String(time)); }
    catch { /* The dialog still works when storage is unavailable. */ }
    window.dispatchEvent(new Event("pluto-notifications-read"));
  }

  function dismiss(id: string) {
    setDismissed(current => {
      const next = [...current, id];
      try { localStorage.setItem(dismissedKey, JSON.stringify(next)); }
      catch { /* Dismissal still works for this visit. */ }
      return next;
    });
  }

  return <>
    <button type="button" className="dash-icon-button notification-trigger" aria-label={`${ui("Friend notifications")}${unreadCount ? `: ${unreadCount}` : ""}${doNotDisturb ? `, ${ui("Do not disturb")}` : ""}`} aria-haspopup="dialog" onClick={show}>
      {doNotDisturb ? <BellOff size={18} /> : <Bell size={18} />}{unreadCount > 0 && <span>{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <DashboardDialog title={`${ui("Notifications")}${visibleItems.length ? ` · ${visibleItems.length}` : ""}`} onClose={() => setOpen(false)}>
      <DoNotDisturbSwitch userId={userId} className="mb-2" />
      <ClanPopupsSwitch userId={userId} className="mb-4" />
      <div className="notification-filters" role="tablist" aria-label={ui("Filter notifications")}>
        {(["all", "games", "social"] as const).map(value => <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)}>{value === "games" ? <Gamepad2 size={14} /> : value === "social" ? <Users size={14} /> : <Bell size={14} />}{ui(value === "all" ? "All" : value === "games" ? "Games" : "Social")}</button>)}
      </div>
      {filteredItems.length ? <div className="notification-list">{filteredItems.map(item => {
        const Icon = item.kind === "friend_request" ? Users : item.kind === "clan_message" || item.kind === "clan_join_invite" ? Shield : item.kind === "spectate_request" || item.kind === "spectate_accepted" ? Eye : item.gameCode ? Gamepad2 : Mail;
        const destination = notificationDestination(item);
        const action = notificationActionLabel(item);
        return <article key={item.id} className={`notification-card${Date.parse(item.createdAt) > openedReadAt && !seen.has(item.id) ? " is-new" : ""}`}>
          <span className="notification-icon"><Icon size={20} /></span>
          <div className="notification-copy"><div className="notification-title"><strong>{ui(item.title)}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString()}</time></div><p>{item.kind === "clan_message" ? <><strong className="text-white">{item.senderName || ui("Player")}</strong>{item.clanName ? ` · ${item.clanName}` : ""}: {item.body}</> : ui(item.detail) || item.senderName || ui("Player")}</p>{item.gameCode && <small>{ui("Room code")}: {item.gameCode}</small>}
            <div className="notification-actions">{item.kind === "spectate_request" && item.spectateRequestId
              ? <><button type="button" onClick={() => void respondToSpectateRequest(item.spectateRequestId!, true).then(error => { if (!error) { markNotificationsSeen(userId, [item.id]); dismiss(item.id); } else window.alert(ui(error)); })}>{ui("Allow")}</button><button type="button" onClick={() => void respondToSpectateRequest(item.spectateRequestId!, false).then(() => dismiss(item.id))}>{ui("Decline")}</button></>
              : <><Link to={destination} state={acceptInviteState()} onClick={() => { markNotificationsSeen(userId, [item.id]); const roomCode = notificationRoomCode(item); if (roomCode) leaveCurrentRoom(roomCode); setOpen(false); }}>{ui(action)}</Link><button type="button" onClick={() => dismiss(item.id)}>{ui("Dismiss")}</button></>}</div>
          </div>
          <button type="button" className="notification-dismiss" aria-label={`${ui("Dismiss")}: ${ui(item.title)}`} onClick={() => dismiss(item.id)}><X size={14} /></button>
        </article>;
      })}</div> : <p className="dash-empty">{ui("No notifications in this category.")}</p>}
    </DashboardDialog>}
  </>;
}
