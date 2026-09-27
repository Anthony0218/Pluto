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
import FriendsOnline from "@/components/App/dashboard/FriendsOnline";
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
  const { activity, friends, onlineIds, notifications, loading, activityError, friendsError } = useDashboardData();
  const [friendDialog, setFriendDialog] = useState<{ id: string; view: "actions" | "chat" | "profile" } | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const friend = friends.find((item) => item.id === friendDialog?.id);
  const online = friends.filter((item) => onlineIds.includes(item.id));
  const searchTarget = typeof document === "undefined" ? null : document.getElementById("dashboard-search-slot");
  const sidebar = <>
    <PlayWithFriends friends={friends} onlineIds={onlineIds} notifications={notifications} userId={user?.id} loading={loading} unavailable={friendsError} signedIn={!!user} onFriendSelect={id => setFriendDialog({ id, view: "actions" })} />
    <DidYouKnowCarousel />
    <FriendsOnline friends={online} loading={loading} unavailable={friendsError} signedIn={!!user} onFriendSelect={id => setFriendDialog({ id, view: "actions" })} />
    <DashboardQuickLinks />
  </>;

  return <main className="dashboard-page">
    {searchTarget && createPortal(<DashboardSearch friends={friends} onChat={id => setFriendDialog({ id, view: "chat" })} />, searchTarget)}
    <div className="dashboard-workspace">
      <DashboardSidebar userId={user?.id} sidebar={sidebar}>
        <DashboardHero profile={profile} signedIn={!!user} loading={authLoading} now={now} progress={<ProgressCard profile={profile} streak={activity?.streak} loading={authLoading} signedIn={!!user} />} challenge={<DailyChallengeCard challenge={activity?.challenge ?? null} now={now} loading={loading} unavailable={activityError} signedIn={!!user} />} />
        <div className="dashboard-play-layout">
          <MyGames />
          <LearnSomethingNew />
        </div>
      </DashboardSidebar>
    </div>
    {friend && friendDialog && <DashboardFriendDialog friend={friend} online={onlineIds.includes(friend.id)} view={friendDialog.view} onViewChange={view => setFriendDialog({ id: friend.id, view })} onClose={() => setFriendDialog(null)} />}
  </main>;
}
