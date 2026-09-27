import { useEffect, useState } from "react";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import MyGames from "@/components/App/MyGames";
import FriendChat from "@/components/social/FriendChat";
import DashboardHero from "@/components/App/dashboard/DashboardHero";
import DashboardSearch from "@/components/App/dashboard/DashboardSearch";
import DashboardSidebar from "@/components/App/dashboard/DashboardSidebar";
import DashboardDialog from "@/components/App/dashboard/DashboardDialog";
import PlayWithFriends from "@/components/App/dashboard/PlayWithFriends";
import DidYouKnowCarousel from "@/components/App/dashboard/DidYouKnowCarousel";
import LearnSomethingNew from "@/components/App/dashboard/LearnSomethingNew";
import ProgressCard from "@/components/App/dashboard/ProgressCard";
import DailyChallengeCard from "@/components/App/dashboard/DailyChallengeCard";
import FriendsOnline from "@/components/App/dashboard/FriendsOnline";
import "@/components/App/dashboard/dashboard.css";

export default function DashboardPage() {
  const { user } = useAuth();
  return <Dashboard key={user?.id ?? "guest"} />;
}

function Dashboard() {
  useUiLanguage();
  const { user, profile, loading: authLoading } = useAuth();
  const { activity, friends, onlineIds, notifications, loading, activityError, friendsError } = useDashboardData();
  const [friendId, setFriendId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const friend = friends.find((item) => item.id === friendId);
  const online = friends.filter((item) => onlineIds.includes(item.id));
  const sidebar = <>
    <ProgressCard profile={profile} streak={activity?.streak} loading={authLoading} signedIn={!!user} />
    <DailyChallengeCard challenge={activity?.challenge ?? null} now={now} loading={loading} unavailable={activityError} signedIn={!!user} />
    <FriendsOnline friends={online} loading={loading} unavailable={friendsError} signedIn={!!user} onChat={setFriendId} />
  </>;

  return <main className="dashboard-page">
    <div className="dashboard-workspace">
      <DashboardSidebar userId={user?.id} sidebar={sidebar}>
        <DashboardHero profile={profile} streak={activity?.streak} online={!user || loading || friendsError ? undefined : online.length} signedIn={!!user} loading={authLoading} now={now} search={<DashboardSearch friends={friends} onChat={setFriendId} />} />
        <div className="dashboard-play-layout">
          <MyGames />
          <div className="dashboard-social-stack">
            <PlayWithFriends friends={friends} onlineIds={onlineIds} notifications={notifications} userId={user?.id} loading={loading} unavailable={friendsError} signedIn={!!user} onChat={setFriendId} />
            <LearnSomethingNew />
          </div>
        </div>
        <DidYouKnowCarousel />
      </DashboardSidebar>
    </div>
    {friend && <DashboardDialog key={friend.id} title={ui("Chat") + ": " + (friend.username || friend.display_name || ui("Player"))} onClose={() => setFriendId(null)}><FriendChat friend={friend} /></DashboardDialog>}
  </main>;
}
