import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import type { Friend } from "../types/social";

export type DashboardActivity = {
  streak: number;
  recent_games: { game_route: string; last_visited_at: string }[];
  challenge: {
    title: string;
    description: string;
    target: number;
    progress: number;
    expires_at: string;
  } | null;
};

export function useDashboardData() {
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
  }>({
    activity: null,
    friends: [],
    onlineIds: [],
    loading: true,
    activityError: false,
    friendsError: false,
  });

  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let running = false;
    async function refresh() {
      if (running) return;
      running = true;
      try {
        const [activityResult, friendships] = await Promise.all([
          supabase.rpc("get_dashboard_activity"),
          supabase
            .from("friendships")
            .select("user_a,user_b")
            .or(`user_a.eq.${userId},user_b.eq.${userId}`),
        ]);
        const ids = [
          ...new Set(
            (friendships.data ?? []).map((row) =>
              row.user_a === userId ? row.user_b : row.user_a,
            ),
          ),
        ];
        const [profiles, presence] = ids.length
          ? await Promise.all([
              supabase
                .from("profiles")
                .select("id,username,display_name,avatar_url,avatar_id")
                .in("id", ids),
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
        if (!disposed)
          setState({
            userId: userId,
            activity: activityResult.error
              ? null
              : (activityResult.data as DashboardActivity),
            friends: (profiles.data ?? []) as Friend[],
            onlineIds: (presence.data ?? []).map((row) => row.user_id),
            loading: false,
            activityError: !!activityResult.error,
            friendsError: !!(
              friendships.error ||
              profiles.error ||
              presence.error
            ),
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
      };
}
