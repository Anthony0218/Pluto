import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useUiLanguage } from "@/i18n/ui";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import MyGames from "@/components/App/MyGames";
import DashboardHero from "@/components/App/dashboard/DashboardHero";
import DashboardSearch from "@/components/App/dashboard/DashboardSearch";
import DashboardSidebar from "@/components/App/dashboard/DashboardSidebar";
import PlayWithFriends from "@/components/App/dashboard/PlayWithFriends";
import DidYouKnowCarousel from "@/components/App/dashboard/DidYouKnowCarousel";
import ProgressCard from "@/components/App/dashboard/ProgressCard";
import DailyChallengeCard from "@/components/App/dashboard/DailyChallengeCard";
import DashboardQuickLinks from "@/components/App/dashboard/DashboardQuickLinks";
import LearnSomethingNew from "@/components/App/dashboard/LearnSomethingNew";
import DashboardFriendDialog from "@/components/App/dashboard/DashboardFriendDialog";
import "@/components/App/dashboard/dashboard.css";

export default function DashboardPage() {
  const { user } = useAuth();
  return <Dashboard key={user?.id ?? "guest"} />;
}

function Dashboard() {
  useUiLanguage();
  const { user, profile, loading: authLoading } = useAuth();
  const { activity, friends, onlineIds, loading, activityError, friendsError, notifications } = useDashboardData();
  const [friendDialog, setFriendDialog] = useState<{ id: string; view: "actions" | "chat" | "profile" } | null>(null);
  const [now, setNow] = useState(Date.now);
  const notificationReadKey = `pluto-notifications-read-${user?.id ?? "guest"}`;
  const messageReadKey = `pluto-read-message-ids-${user?.id ?? "guest"}`;
  const [notificationsReadAt, setNotificationsReadAt] = useState(() => {
    try { return Number(localStorage.getItem(notificationReadKey) || 0); }
    catch { return 0; }
  });
  const [readMessageIds, setReadMessageIds] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(messageReadKey) || "[]");
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
    } catch { return []; }
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const syncReadAt = () => {
      try { setNotificationsReadAt(Number(localStorage.getItem(notificationReadKey) || 0)); }
      catch { setNotificationsReadAt(0); }
    };
    syncReadAt();
    window.addEventListener("pluto-notifications-read", syncReadAt);
    return () => window.removeEventListener("pluto-notifications-read", syncReadAt);
  }, [notificationReadKey]);

  const friend = friends.find((item) => item.id === friendDialog?.id);
  const unreadMessageSenderIds = notifications.filter(notification => notification.kind === "message" && notification.senderId && Date.parse(notification.createdAt) > notificationsReadAt && !readMessageIds.includes(notification.id)).map(notification => notification.senderId!);
  const markFriendMessagesRead = (friendId: string) => {
    const messageIds = notifications.filter(notification => notification.kind === "message" && notification.senderId === friendId).map(notification => notification.id);
    if (!messageIds.length) return;
    setReadMessageIds(current => {
      const next = [...new Set([...current, ...messageIds])];
      try { localStorage.setItem(messageReadKey, JSON.stringify(next)); }
      catch { /* The in-memory read state still updates. */ }
      return next;
    });
  };
  const searchTarget = typeof document === "undefined" ? null : document.getElementById("dashboard-search-slot");
  const sidebar = <>
    <PlayWithFriends friends={friends} onlineIds={onlineIds} unreadMessageSenderIds={unreadMessageSenderIds} loading={loading} unavailable={friendsError} signedIn={!!user} onFriendSelect={id => setFriendDialog({ id, view: "actions" })} />
    <div className="sidebar-progress"><ProgressCard profile={profile} streak={activity?.streak} loading={authLoading} signedIn={!!user} /></div>
    <DashboardQuickLinks />
  </>;

  return <main className="dashboard-page">
    {searchTarget && createPortal(<DashboardSearch friends={friends} onChat={id => { markFriendMessagesRead(id); setFriendDialog({ id, view: "chat" }); }} />, searchTarget)}
    <div className="dashboard-workspace">
      <DashboardSidebar userId={user?.id} sidebar={sidebar} onlineFriendsCount={onlineIds.length} notifications={notifications} readMessageIds={readMessageIds}>
        <div className="dashboard-top-layout"><DashboardHero profile={profile} signedIn={!!user} loading={authLoading} now={now} challenge={<DailyChallengeCard challenge={activity?.challenge ?? null} now={now} loading={loading} unavailable={activityError} signedIn={!!user} />} /><DidYouKnowCarousel /></div>
        <div className="dashboard-play-layout">
          <MyGames />
          <LearnSomethingNew />
        </div>
      </DashboardSidebar>
    </div>
    {friend && friendDialog && <DashboardFriendDialog friend={friend} online={onlineIds.includes(friend.id)} view={friendDialog.view} onViewChange={view => { if (view === "chat") markFriendMessagesRead(friend.id); setFriendDialog({ id: friend.id, view }); }} onClose={() => setFriendDialog(null)} />}
  </main>;
}
