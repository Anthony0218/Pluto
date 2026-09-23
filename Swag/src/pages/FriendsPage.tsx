import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Search, UserPlus, Users, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import type { Friend, FriendRequest, PublicProfile } from "../types/social";
import FriendAvatar from "../components/social/FriendAvatar";
import FriendChat from "../components/social/FriendChat";

type IncomingRequest = FriendRequest & {
  sender: PublicProfile | null;
};

function profileLabel(profile: PublicProfile) {
  return (
    profile.display_name ||
    (profile.username ? `@${profile.username}` : "Pluto player")
  );
}

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.id === selectedFriendId) ?? null,
    [friends, selectedFriendId],
  );

  const loadSocialData = useCallback(async () => {
    if (!user) return;

    const [
      { data: friendshipRows, error: friendshipError },
      { data: requestRows, error: requestError },
    ] = await Promise.all([
      supabase
        .from("friendships")
        .select("id,user_a,user_b,created_at")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
      supabase
        .from("friend_requests")
        .select("id,sender_id,receiver_id,status,created_at")
        .eq("receiver_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    if (friendshipError)
      console.error("Could not load friendships:", friendshipError);
    if (requestError)
      console.error("Could not load friend requests:", requestError);

    const friendIds = (friendshipRows ?? []).map((row) =>
      row.user_a === user.id ? row.user_b : row.user_a,
    );
    const senderIds = (requestRows ?? []).map((request) => request.sender_id);
    const allProfileIds = Array.from(new Set([...friendIds, ...senderIds]));

    let profiles: PublicProfile[] = [];
    if (allProfileIds.length > 0) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", allProfileIds);

      if (error) console.error("Could not load profiles:", error);
      profiles = (data ?? []) as PublicProfile[];
    }

    const profileMap = new Map(
      profiles.map((profile) => [profile.id, profile]),
    );
    const loadedFriends = friendIds
      .map((id) => profileMap.get(id))
      .filter(Boolean) as Friend[];

    loadedFriends.sort((a, b) =>
      profileLabel(a).localeCompare(profileLabel(b)),
    );
    setFriends(loadedFriends);
    setRequests(
      ((requestRows ?? []) as FriendRequest[]).map((request) => ({
        ...request,
        sender: profileMap.get(request.sender_id) ?? null,
      })),
    );

    setSelectedFriendId((current) => {
      if (current && loadedFriends.some((friend) => friend.id === current))
        return current;
      return loadedFriends[0]?.id ?? null;
    });
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login");
      return;
    }

    void loadSocialData();

    const channel = supabase
      .channel(`friends-page-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        () => void loadSocialData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => void loadSocialData(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authLoading, loadSocialData, navigate, user]);

  useEffect(() => {
    if (!user) return;
    const query = search.trim().replace(/^@/, "");
    if (query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        const { data, error } = await supabase
          .from("profiles")
          .select("id,username,display_name,avatar_url")
          .neq("id", user.id)
          .ilike("username", `%${query}%`)
          .limit(8);

        if (error) {
          console.error("Could not search profiles:", error);
          setSearchResults([]);
        } else {
          const friendIds = new Set(friends.map((friend) => friend.id));
          setSearchResults(
            ((data ?? []) as PublicProfile[]).filter(
              (profile) => !friendIds.has(profile.id),
            ),
          );
        }
        setSearching(false);
      })();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [friends, search, user]);

  async function sendFriendRequest(profile: PublicProfile) {
    if (!user) return;
    setStatus(null);

    const { error } = await supabase.from("friend_requests").insert({
      sender_id: user.id,
      receiver_id: profile.id,
      status: "pending",
    });

    if (error) {
      setStatus(
        error.code === "23505"
          ? "A request has already been sent."
          : error.message,
      );
      return;
    }

    setStatus(`Friend request sent to ${profileLabel(profile)}.`);
    setSearchResults((current) =>
      current.filter((item) => item.id !== profile.id),
    );
  }

  async function acceptRequest(requestId: string) {
    const { error } = await supabase.rpc("accept_friend_request", {
      p_request_id: requestId,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Friend added.");
    await loadSocialData();
  }

  async function declineRequest(requestId: string) {
    const { error } = await supabase.rpc("decline_friend_request", {
      p_request_id: requestId,
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    await loadSocialData();
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-zinc-300">
        Loading...
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className="min-h-screen px-5 py-8 text-zinc-100 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 ml-10">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-400">
            Pluto Social
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">Friends</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Add friends, send preset messages and share multiplayer room codes.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <section className="rounded-3xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl shadow-black/10 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <UserPlus size={18} className="text-sky-400" />
                <h2 className="font-bold text-white">Add friend</h2>
              </div>

              <div className="relative mt-4">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setStatus(null);
                  }}
                  placeholder="Search @username"
                  className="w-full rounded-xl border border-white/10 bg-zinc-950/70 py-3 pl-10 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-400/40"
                />
              </div>

              {searching && (
                <p className="mt-3 text-xs text-zinc-500">Searching...</p>
              )}

              {searchResults.length > 0 && (
                <div className="mt-3 space-y-2">
                  {searchResults.map((profile) => (
                    <div
                      key={profile.id}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
                    >
                      <FriendAvatar profile={profile} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {profile.display_name || profile.username || "Player"}
                        </p>
                        {profile.username && (
                          <p className="truncate text-xs text-zinc-500">
                            @{profile.username}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void sendFriendRequest(profile)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500 text-white hover:bg-sky-400"
                        title="Add friend"
                      >
                        <UserPlus size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {status && <p className="mt-3 text-xs text-sky-300">{status}</p>}
            </section>

            {requests.length > 0 && (
              <section className="rounded-3xl border border-white/10 bg-zinc-900/80 p-4">
                <h2 className="font-bold text-white">Friend requests</h2>
                <div className="mt-3 space-y-2">
                  {requests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
                    >
                      <FriendAvatar
                        profile={
                          request.sender ?? {
                            id: request.sender_id,
                            username: null,
                            display_name: "Player",
                            avatar_url: null,
                          }
                        }
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">
                          {request.sender
                            ? profileLabel(request.sender)
                            : "Player"}
                        </p>
                      </div>
                      <button
                        onClick={() => void acceptRequest(request.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                        title="Accept"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => void declineRequest(request.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20"
                        title="Decline"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/80">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-4">
                <Users size={18} className="text-sky-400" />
                <h2 className="font-bold text-white">Friends</h2>
                <span className="ml-auto rounded-full bg-white/5 px-2 py-1 text-[10px] font-black text-zinc-500">
                  {friends.length}
                </span>
              </div>

              {friends.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm font-semibold text-zinc-300">
                    No friends yet
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Search for a username above.
                  </p>
                </div>
              ) : (
                <div className="p-2">
                  {friends.map((friend) => {
                    const active = friend.id === selectedFriendId;
                    return (
                      <button
                        type="button"
                        key={friend.id}
                        onClick={() => setSelectedFriendId(friend.id)}
                        className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                          active
                            ? "bg-sky-500/10 ring-1 ring-sky-400/20"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <FriendAvatar profile={friend} />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`truncate text-sm font-bold ${active ? "text-sky-200" : "text-white"}`}
                          >
                            {friend.display_name || friend.username || "Player"}
                          </p>
                          {friend.username && (
                            <p className="truncate text-xs text-zinc-500">
                              @{friend.username}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>

          {selectedFriend ? (
            <FriendChat key={selectedFriend.id} friend={selectedFriend} />
          ) : (
            <section className="flex min-h-[640px] items-center justify-center rounded-3xl border border-white/10 bg-zinc-900/60 p-8 text-center">
              <div>
                <Users size={38} className="mx-auto text-zinc-700" />
                <h2 className="mt-4 font-bold text-zinc-300">
                  Select a friend
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Choose someone from your friend list to open the preset chat.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
