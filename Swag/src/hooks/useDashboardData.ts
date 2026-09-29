import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import type { Friend } from "../types/social";
import type { DailyChallenge } from "../data/dashboard";

export type DashboardActivity = {
  streak: number;
  recent_games: { game_route: string; last_visited_at: string }[];
  challenge: DailyChallenge | null;
  quests?: DailyChallenge[];
};
export type DashboardNotification = {
  id: string;
  kind: "message" | "friend_request";
  title: string;
  detail: string;
  createdAt: string;
  gameCode?: string | null;
  gameRoute?: string | null;
  senderName?: string;
  senderId?: string;
};

export function useDashboardDataSource() {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<{
    userId?: string;
    activity: DashboardActivity | null;
    friends: Friend[];
    onlineIds: string[];
    loading: boolean;
    activityError: boolean;
    friendsError: boolean;
    notifications: DashboardNotification[];
  }>({
    activity: null,
    friends: [],
    onlineIds: [],
    loading: true,
    activityError: false,
    friendsError: false,
    notifications: [],
  });

  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let running = false;
    async function refresh() {
      if (running) return;
      running = true;
      try {
        const [activityResult, questResult, friendships, messages, requests] = await Promise.all([
          supabase.rpc("get_dashboard_activity"),
          supabase.rpc("get_daily_quests"),
          supabase
            .from("friendships")
            .select("user_a,user_b")
            .or(`user_a.eq.${userId},user_b.eq.${userId}`),
          supabase.from("friend_messages").select("id,sender_id,message_type,game_code,game_route,created_at").eq("receiver_id", userId).order("created_at", { ascending: false }).limit(100),
          supabase.from("friend_requests").select("id,sender_id,created_at").eq("receiver_id", userId).eq("status", "pending").order("created_at", { ascending: false }).limit(12),
        ]);
        const activity = activityResult.error ? null : activityResult.data as DashboardActivity;
        if (activity && !questResult.error && Array.isArray(questResult.data)) activity.quests = questResult.data as DailyChallenge[];
        const ids = [
          ...new Set(
            (friendships.data ?? []).map((row) =>
              row.user_a === userId ? row.user_b : row.user_a,
            ),
          ),
        ];
        const notificationSenderIds = [...(messages.data ?? []).map((row) => row.sender_id), ...(requests.data ?? []).map((row) => row.sender_id)];
        const profileIds = [...new Set([...ids, ...notificationSenderIds])];
        const [profiles, presence] = profileIds.length
          ? await Promise.all([
              supabase
                .from("profiles")
                .select("id,username,display_name,avatar_url,avatar_id")
                .in("id", profileIds),
              supabase
                .from("user_presence")
                .select("user_id")
                .in("user_id", ids)
                .gt(
                  "last_seen_at",
                  new Date(Date.now() - 90_000).toISOString(),
                ),
            ])
          : [
              { data: [], error: null },
              { data: [], error: null },
            ];
        const profileById = new Map((profiles.data ?? []).map((profile) => [profile.id, profile]));
        const notifications: DashboardNotification[] = [
          ...(requests.data ?? []).map((request) => ({ id: `request-${request.id}`, kind: "friend_request" as const, title: "Friend request", detail: profileById.get(request.sender_id)?.display_name || profileById.get(request.sender_id)?.username || "A Pluto player", createdAt: request.created_at })),
          ...(messages.data ?? []).map((message) => ({ id: `message-${message.id}`, kind: "message" as const, title: message.message_type === "game_code" ? "Game invite" : "New message", detail: message.message_type === "game_code" ? `${profileById.get(message.sender_id)?.display_name || profileById.get(message.sender_id)?.username || "A friend"} sent code ${message.game_code || ""}` : `${profileById.get(message.sender_id)?.display_name || profileById.get(message.sender_id)?.username || "A friend"} messaged you`, createdAt: message.created_at, gameCode: message.game_code, gameRoute: message.game_route })),
        ].map(notification => {
          const source = notification.kind === "friend_request"
            ? (requests.data ?? []).find(row => `request-${row.id}` === notification.id)
            : (messages.data ?? []).find(row => `message-${row.id}` === notification.id);
          const sender = source ? profileById.get(source.sender_id) : undefined;
          return { ...notification, senderName: sender?.display_name || sender?.username || undefined, senderId: source?.sender_id };
        }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        if (!disposed)
          setState({
            userId: userId,
            activity,
            friends: (profiles.data ?? []).filter(profile => ids.includes(profile.id)) as Friend[],
            onlineIds: (presence.data ?? []).map((row) => row.user_id),
            loading: false,
            activityError: !!(activityResult.error || questResult.error),
            friendsError: !!(
              friendships.error ||
              profiles.error ||
              presence.error
            ),
            notifications,
          });
      } catch {
        if (!disposed)
          setState({
            userId: userId,
            activity: null,
            friends: [],
            onlineIds: [],
            loading: false,
            activityError: true,
            friendsError: true,
            notifications: [],
          });
      } finally {
        running = false;
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    const channel = supabase
      .channel(`dashboard-friends-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        onFocus,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_messages" },
        onFocus,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        onFocus,
      )
      .subscribe();
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return userId && state.userId === userId
    ? state
    : {
        activity: null,
        friends: [],
        onlineIds: [],
        loading: !!userId,
        activityError: false,
        friendsError: false,
        notifications: [],
      };
}

export const DashboardDataContext = createContext<ReturnType<typeof useDashboardDataSource> | null>(null);
export function useDashboardData() {
  const data = useContext(DashboardDataContext);
  if (!data) throw new Error("DashboardDataProvider is required");
  return data;
}
