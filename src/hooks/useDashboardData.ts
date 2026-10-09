import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import type { Friend } from "../types/social";
import type { DailyChallenge } from "../data/dashboard";
import { ONLINE_WINDOW_MS, type FriendPresence } from "../components/social/activity";
import { clanInviteRoute, getInviteGameLabel } from "../components/social/inviteRoute";

export type DashboardActivity = {
  streak: number;
  recent_games: { game_route: string; last_visited_at: string }[];
  challenge: DailyChallenge | null;
  quests?: DailyChallenge[];
};
export type DashboardNotification = {
  id: string;
  kind: "message" | "friend_request" | "clan_message" | "clan_invite" | "clan_join_invite" | "spectate_request" | "spectate_accepted";
  title: string;
  detail: string;
  createdAt: string;
  gameCode?: string | null;
  gameRoute?: string | null;
  game?: string | null;
  senderName?: string;
  senderId?: string;
  /** Clan (community group) the message or invite was posted in. */
  clanId?: string;
  clanName?: string;
  /** Free-text clan chat body. */
  body?: string;
  /** Open invitation to join `clanId`. */
  clanInviteId?: string;
  spectateRequestId?: string;
  spectateGame?: string | null;
  spectateMode?: string | null;
};

export type Clan = { id: string; name: string; avatar_id: string };

type ClanRows = {
  clans: Clan[];
  messages: { id: string; group_id: string; sender_id: string; body: string; created_at: string }[];
  invites: { id: string; group_id: string; sender_id: string; game: string; game_route?: string | null; room_code: string; created_at: string }[];
};
type SpectateRow = { id: string; requester_id: string; target_id: string; game: string; mode: string | null; status: string; created_at: string; responded_at: string | null };
type PresenceRow = { user_id: string; last_seen_at: string; activity_game?: string | null; activity_mode?: string | null; spectatable?: boolean | null };

const empty = { data: [], error: null };

/** Clan chat and lobby invites from other members. Missing tables (before the social migration) read as empty. */
async function loadClanRows(userId: string): Promise<ClanRows> {
  const memberships = await supabase.from("community_group_members").select("group_id").eq("user_id", userId);
  const ids = (memberships.data ?? []).map((row) => row.group_id as string);
  if (!ids.length) return { clans: [], messages: [], invites: [] };
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const [clans, messages, invites] = await Promise.all([
    supabase.from("community_groups").select("id,name,avatar_id").in("id", ids).order("name"),
    supabase.from("community_group_messages").select("id,group_id,sender_id,body,created_at").in("group_id", ids).neq("sender_id", userId).gt("created_at", since).order("created_at", { ascending: false }).limit(50),
    // All columns: `game_route` only exists once the "share any game" migration is applied, and naming it earlier would fail the request.
    supabase.from("community_game_invites").select("*").in("group_id", ids).neq("sender_id", userId).gt("created_at", since).order("created_at", { ascending: false }).limit(20),
  ]);
  return {
    clans: (clans.data ?? []) as Clan[],
    messages: (messages.error ? [] : messages.data ?? []) as ClanRows["messages"],
    invites: (invites.error ? [] : invites.data ?? []) as ClanRows["invites"],
  };
}

export type ClanJoinInvite = { id: string; group_id: string; group_name: string; group_avatar_id: string; member_count: number; sender_id: string; sender_name: string; sender_avatar_id: string | null; created_at: string };
/** Open invitations to join a clan. Reads as empty before the clan invitation migration. */
export async function loadClanJoinInvites(): Promise<ClanJoinInvite[]> {
  const { data, error } = await supabase.rpc("get_clan_invites");
  return error ? [] : (data ?? []) as ClanJoinInvite[];
}

async function loadSpectateRows(userId: string): Promise<SpectateRow[]> {
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data, error } = await supabase
    .from("spectate_requests")
    .select("id,requester_id,target_id,game,mode,status,created_at,responded_at")
    .or(`and(target_id.eq.${userId},status.eq.pending),and(requester_id.eq.${userId},status.eq.accepted)`)
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  return error ? [] : (data ?? []) as SpectateRow[];
}

async function loadPresence(ids: string[]) {
  if (!ids.length) return { data: [] as PresenceRow[], error: null };
  const full = await supabase.from("user_presence").select("user_id,last_seen_at,activity_game,activity_mode,spectatable").in("user_id", ids);
  if (!full.error) return { data: (full.data ?? []) as PresenceRow[], error: null };
  // Before the social migration only online status exists.
  const basic = await supabase.from("user_presence").select("user_id,last_seen_at").in("user_id", ids);
  return { data: (basic.data ?? []) as PresenceRow[], error: basic.error };
}

export function useDashboardDataSource() {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<{
    userId?: string;
    activity: DashboardActivity | null;
    friends: Friend[];
    onlineIds: string[];
    presence: Record<string, FriendPresence>;
    clans: Clan[];
    loading: boolean;
    activityError: boolean;
    friendsError: boolean;
    notifications: DashboardNotification[];
  }>({
    activity: null,
    friends: [],
    onlineIds: [],
    presence: {},
    clans: [],
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
        const [activityResult, questResult, friendships, messages, requests, clanRows, spectateRows, clanJoinInvites] = await Promise.all([
          supabase.rpc("get_dashboard_activity"),
          supabase.rpc("get_daily_quests"),
          supabase
            .from("friendships")
            .select("user_a,user_b")
            .or(`user_a.eq.${userId},user_b.eq.${userId}`),
          supabase.from("friend_messages").select("id,sender_id,message_type,game,game_code,game_route,created_at").eq("receiver_id", userId).order("created_at", { ascending: false }).limit(100),
          supabase.from("friend_requests").select("id,sender_id,created_at").eq("receiver_id", userId).eq("status", "pending").order("created_at", { ascending: false }).limit(12),
          loadClanRows(userId!).catch((): ClanRows => ({ clans: [], messages: [], invites: [] })),
          loadSpectateRows(userId!).catch((): SpectateRow[] => []),
          loadClanJoinInvites().catch((): ClanJoinInvite[] => []),
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
        const notificationSenderIds = [
          ...(messages.data ?? []).map((row) => row.sender_id),
          ...(requests.data ?? []).map((row) => row.sender_id),
          ...clanRows.messages.map((row) => row.sender_id),
          ...clanRows.invites.map((row) => row.sender_id),
          ...spectateRows.map((row) => (row.target_id === userId ? row.requester_id : row.target_id)),
        ];
        const profileIds = [...new Set([...ids, ...notificationSenderIds])];
        const [profiles, presenceResult] = profileIds.length
          ? await Promise.all([
              supabase
                .from("profiles")
                .select("id,username,display_name,avatar_url,avatar_id")
                .in("id", profileIds),
              loadPresence(ids),
            ])
          : [empty, empty];
        const profileById = new Map((profiles.data ?? []).map((profile) => [profile.id, profile]));
        const nameOf = (id: string) => profileById.get(id)?.display_name || profileById.get(id)?.username || undefined;
        const clanById = new Map(clanRows.clans.map((clan) => [clan.id, clan]));
        const presence: Record<string, FriendPresence> = {};
        for (const row of presenceResult.data as PresenceRow[]) {
          presence[row.user_id] = {
            lastSeenAt: row.last_seen_at,
            online: Date.now() - Date.parse(row.last_seen_at) < ONLINE_WINDOW_MS,
            game: row.activity_game ?? null,
            mode: row.activity_mode ?? null,
            spectatable: !!row.spectatable,
          };
        }
        const socialNotifications: DashboardNotification[] = [
          ...clanRows.messages.map((row) => ({
            id: `clan-message-${row.id}`, kind: "clan_message" as const, title: "Clan message",
            detail: row.body, body: row.body, createdAt: row.created_at,
            senderId: row.sender_id, senderName: nameOf(row.sender_id),
            clanId: row.group_id, clanName: clanById.get(row.group_id)?.name,
          })),
          ...clanRows.invites.map((row) => ({
            id: `clan-invite-${row.id}`, kind: "clan_invite" as const, title: "Clan game invite",
            detail: `${nameOf(row.sender_id) ?? "A clan member"} shared a ${getInviteGameLabel({ game: row.game, gameRoute: clanInviteRoute(row.game, row.game_route) })} lobby`,
            createdAt: row.created_at, gameCode: row.room_code, game: row.game,
            gameRoute: clanInviteRoute(row.game, row.game_route),
            senderId: row.sender_id, senderName: nameOf(row.sender_id),
            clanId: row.group_id, clanName: clanById.get(row.group_id)?.name,
          })),
          ...clanJoinInvites.map((row) => ({
            id: `clan-join-${row.id}`, kind: "clan_join_invite" as const, title: "Clan invitation",
            detail: `${row.sender_name} invited you to join ${row.group_name}`, createdAt: row.created_at,
            senderId: row.sender_id, senderName: row.sender_name,
            clanId: row.group_id, clanName: row.group_name, clanInviteId: row.id,
          })),
          ...spectateRows.map((row) => {
            const incoming = row.target_id === userId;
            const otherId = incoming ? row.requester_id : row.target_id;
            return {
              id: `${incoming ? "spectate" : "spectate-accepted"}-${row.id}`,
              kind: incoming ? "spectate_request" as const : "spectate_accepted" as const,
              title: incoming ? "Spectate request" : "Spectate request accepted",
              detail: incoming ? `${nameOf(otherId) ?? "A friend"} wants to watch your game` : `${nameOf(otherId) ?? "Your friend"} lets you watch`,
              createdAt: incoming ? row.created_at : row.responded_at ?? row.created_at,
              senderId: otherId, senderName: nameOf(otherId),
              spectateRequestId: row.id, spectateGame: row.game, spectateMode: row.mode,
            };
          }),
        ];
        const notifications: DashboardNotification[] = [
          ...(requests.data ?? []).map((request) => ({ id: `request-${request.id}`, kind: "friend_request" as const, title: "Friend request", detail: profileById.get(request.sender_id)?.display_name || profileById.get(request.sender_id)?.username || "A Pluto player", createdAt: request.created_at })),
          ...(messages.data ?? []).map((message) => ({ id: `message-${message.id}`, kind: "message" as const, title: message.message_type === "game_code" ? "Game invite" : "New message", detail: message.message_type === "game_code" ? `${profileById.get(message.sender_id)?.display_name || profileById.get(message.sender_id)?.username || "A friend"} sent code ${message.game_code || ""}` : `${profileById.get(message.sender_id)?.display_name || profileById.get(message.sender_id)?.username || "A friend"} messaged you`, createdAt: message.created_at, gameCode: message.game_code, gameRoute: message.game_route, game: message.game })),
        ].map(notification => {
          const source = notification.kind === "friend_request"
            ? (requests.data ?? []).find(row => `request-${row.id}` === notification.id)
            : (messages.data ?? []).find(row => `message-${row.id}` === notification.id);
          const sender = source ? profileById.get(source.sender_id) : undefined;
          return { ...notification, senderName: sender?.display_name || sender?.username || undefined, senderId: source?.sender_id };
        });
        const allNotifications = [...notifications, ...socialNotifications].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        if (!disposed)
          setState({
            userId: userId,
            activity,
            friends: (profiles.data ?? []).filter(profile => ids.includes(profile.id)) as Friend[],
            onlineIds: Object.keys(presence).filter((id) => presence[id].online),
            presence,
            clans: clanRows.clans,
            loading: false,
            activityError: !!(activityResult.error || questResult.error),
            friendsError: !!(
              friendships.error ||
              profiles.error ||
              presenceResult.error
            ),
            notifications: allNotifications,
          });
      } catch {
        if (!disposed)
          setState({
            userId: userId,
            activity: null,
            friends: [],
            onlineIds: [],
            presence: {},
            clans: [],
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
    // Separate channel: tables added by the social migration must not break
    // friend updates on databases that do not have them yet.
    const socialChannel = supabase
      .channel(`dashboard-social-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_group_messages" }, onFocus)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_game_invites" }, onFocus)
      .on("postgres_changes", { event: "*", schema: "public", table: "spectate_requests" }, onFocus)
      .subscribe();
    // Its own channel for the same reason: the table arrives with the clan invitation migration.
    const clanInviteChannel = supabase
      .channel(`dashboard-clan-invites-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_group_invites" }, onFocus)
      .subscribe();
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      void supabase.removeChannel(channel);
      void supabase.removeChannel(socialChannel);
      void supabase.removeChannel(clanInviteChannel);
    };
  }, [userId]);

  return userId && state.userId === userId
    ? state
    : {
        activity: null,
        friends: [],
        onlineIds: [],
        presence: {} as Record<string, FriendPresence>,
        clans: [] as Clan[],
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
