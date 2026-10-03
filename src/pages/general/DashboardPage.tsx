import ProgressCard from "@/components/App/dashboard/ProgressCard";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useUiLanguage } from "@/i18n/ui";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import MyGames from "@/components/App/MyGames";
import DashboardHero from "@/components/App/dashboard/DashboardHero";
import DashboardSearch from "@/components/App/dashboard/DashboardSearch";
import DidYouKnowCarousel from "@/components/App/dashboard/DidYouKnowCarousel";
import DashboardActionRow, { DashboardContentGrid } from "@/components/App/dashboard/DashboardActionRow";
import DailyQuestsCard from "@/components/App/dashboard/DailyQuestsCard";
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
  const { activity, friends, onlineIds, loading, activityError, notifications } = useDashboardData();
  const [friendDialog, setFriendDialog] = useState<{ id: string; view: "actions" | "chat" | "profile" } | null>(null);
  const [now, setNow] = useState(Date.now);
  const messageReadKey = `pluto-read-message-ids-${user?.id ?? "guest"}`;
  const [, setReadMessageIds] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(messageReadKey) || "[]");
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
    } catch { return []; }
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const friend = friends.find((item) => item.id === friendDialog?.id);
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


  return <main className="dashboard-page">
    {searchTarget && createPortal(<DashboardSearch friends={friends} onChat={id => { markFriendMessagesRead(id); setFriendDialog({ id, view: "chat" }); }} />, searchTarget)}
    <div className="dashboard-workspace">
      <div className="dashboard-main">
        <DashboardHero profile={profile} signedIn={!!user} loading={authLoading} now={now} challenge={null} />
        <MyGames />
        <DashboardActionRow userId={user?.id} />
        <DashboardContentGrid userId={user?.id} sections={[
          { id: "progress", label: "Progress", content: <ProgressCard profile={profile} streak={activity?.streak} loading={authLoading} signedIn={!!user} /> },
          { id: "quests", label: "Daily quests", content: <DailyQuestsCard quests={activity?.quests} loading={loading} unavailable={activityError} signedIn={!!user} /> },
          { id: "discover", label: "Did you know?", content: <DidYouKnowCarousel /> },
          { id: "learning", label: "Continue learning", content: <LearnSomethingNew /> },
        ]} />
      </div>
    </div>
    {friend && friendDialog && <DashboardFriendDialog friend={friend} online={onlineIds.includes(friend.id)} view={friendDialog.view} onViewChange={view => { if (view === "chat") markFriendMessagesRead(friend.id); setFriendDialog({ id: friend.id, view }); }} onClose={() => setFriendDialog(null)} />}
  </main>;
}
