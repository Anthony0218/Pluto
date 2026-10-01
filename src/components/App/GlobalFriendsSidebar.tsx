import { useState } from "react";
import { Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { ui, useUiLanguage } from "@/i18n/ui";
import DashboardDialog from "./dashboard/DashboardDialog";
import DashboardFriendDialog from "./dashboard/DashboardFriendDialog";
import PlayWithFriends from "./dashboard/PlayWithFriends";
import { getFriendMessageBaseline } from "./dashboard/messageReadState";

type FriendView = "actions" | "chat" | "profile";

export default function GlobalFriendsSidebar() {
  useUiLanguage();
  const { user } = useAuth();
  const { friends, onlineIds, loading, friendsError, notifications } = useDashboardData();
  const [open, setOpen] = useState(false);
  const [friendDialog, setFriendDialog] = useState<{ id: string; view: FriendView } | null>(null);
  const [messageBaseline] = useState(() => getFriendMessageBaseline(user?.id));
  const readMessageKey = `pluto-read-message-ids-${user?.id ?? "guest"}`;
  const [readMessageIds, setReadMessageIds] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(readMessageKey) || "[]");
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
    } catch { return []; }
  });
  const friendIds = new Set(friends.map((friend) => friend.id));
  const unreadMessagesByFriend = notifications.reduce<Record<string, number>>((counts, notification) => {
    if (notification.kind === "message" && notification.senderId && friendIds.has(notification.senderId) && Date.parse(notification.createdAt) > messageBaseline && !readMessageIds.includes(notification.id)) {
      counts[notification.senderId] = (counts[notification.senderId] ?? 0) + 1;
    }
    return counts;
  }, {});
  const unreadCount = Object.values(unreadMessagesByFriend).reduce((sum, count) => sum + count, 0);
  const selectedFriend = friends.find((friend) => friend.id === friendDialog?.id);

  function showFriend(id: string, view: FriendView) {
    if (view === "chat") {
      const messageIds = notifications
        .filter((notification) => notification.kind === "message" && notification.senderId === id)
        .map((notification) => notification.id);
      if (messageIds.length) {
        setReadMessageIds((current) => {
          const next = [...new Set([...current, ...messageIds])];
          try { localStorage.setItem(readMessageKey, JSON.stringify(next)); }
          catch { /* Keep the read state for this visit. */ }
          return next;
        });
      }
    }
    setOpen(false);
    setFriendDialog({ id, view });
  }

  return <>
    <button
      type="button"
      className="sidebar-edge-toggle sidebar-edge-toggle-global"
      aria-label={`${ui("Open sidebar")}${onlineIds.length ? `, ${onlineIds.length} ${ui("Online")}` : ""}${unreadCount ? `, ${unreadCount} ${ui("New message")}` : ""}`}
      aria-expanded={open}
      aria-haspopup="dialog"
      onClick={() => setOpen(true)}
    >
      <Users size={18} aria-hidden="true" />
      {onlineIds.length > 0 && <span className="sidebar-online-count" aria-hidden="true">{onlineIds.length}</span>}
      {unreadCount > 0 && <span className="sidebar-message-count" aria-hidden="true">{unreadCount}</span>}
    </button>
    {open && <DashboardDialog title={ui("Friends")} drawer onClose={() => setOpen(false)}>
      <PlayWithFriends
        friends={friends}
        onlineIds={onlineIds}
        unreadMessagesByFriend={unreadMessagesByFriend}
        loading={loading}
        unavailable={friendsError}
        signedIn={!!user}
        onFriendSelect={(id) => showFriend(id, "actions")}
      />
    </DashboardDialog>}
    {selectedFriend && friendDialog && <DashboardFriendDialog
      friend={selectedFriend}
      online={onlineIds.includes(selectedFriend.id)}
      view={friendDialog.view}
      onViewChange={(view) => showFriend(selectedFriend.id, view)}
      onClose={() => setFriendDialog(null)}
    />}
  </>;
}
