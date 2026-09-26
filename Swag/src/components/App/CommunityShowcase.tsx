import { ui, useUiLanguage } from "@/i18n/ui";
import { Link } from "react-router-dom";
import { Target, Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useDashboardData } from "../../hooks/useDashboardData";
import FriendAvatar from "../social/FriendAvatar";

export default function CommunityShowcase() {
  useUiLanguage();
  const { user } = useAuth();
  const { activity, friends, onlineIds, loading, friendsError } =
    useDashboardData();
  const challenge = activity?.challenge;
  const onlineFriends = friends.filter((friend) =>
    onlineIds.includes(friend.id),
  );
  const card =
    "rounded-3xl border border-white/10 bg-[#080d1c]/85 p-5 backdrop-blur-xl";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className={card}>
        <Target size={24} className="text-indigo-300" />
        <h3 className="mt-5 font-semibold">{ui("Daily Challenge")}</h3>
        <p className="mt-2 text-sm text-zinc-400">
          {loading ? ui("Loading challenge…") : challenge?.title ||
              (user
                ? "Check your dashboard for daily challenges."
                : "Log in to track your daily goal.")}
        </p>
        {challenge && (
          <div className="mt-4">
            <progress
              aria-label={ui("Daily challenge progress")}
              value={Math.min(challenge.progress, challenge.target)}
              max={challenge.target}
              className="h-2 w-full accent-indigo-500"
            />
            <p className="mt-2 text-xs text-zinc-400">
              {Math.min(challenge.progress, challenge.target)} /{" "}
              {challenge.target}
            </p>
          </div>
        )}
        <Link
          to="/dashboard"
          className="mt-5 inline-block text-sm text-indigo-300"
        >{ui("View your challenge →")}</Link>
      </div>
      <div className={card}>
        <Users size={24} className="text-indigo-300" />
        <h3 className="mt-5 font-semibold">{ui("Play with friends")}</h3>
        <p className="mt-2 text-sm text-zinc-400">{ui("Create a multiplayer room and share its code in your friend chat.")}</p>
        <Link
          to="/friends"
          className="mt-5 inline-block text-sm text-indigo-300"
        >{ui("Open friends →")}</Link>
      </div>
      <div className={`${card} sm:col-span-2`}>
        <h3 className="font-semibold">{ui("Friends online")}{user && !loading && !friendsError ? ` (${onlineFriends.length})` : ""}
        </h3>
        {loading || friendsError || !onlineFriends.length ? (
          <p className="mt-3 text-sm text-zinc-400">
            {loading ? ui("Loading friends…") : friendsError ? ui("Online status is temporarily unavailable.") : !user ? ui("Log in to connect with friends.") : ui("No friends online right now.")}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {onlineFriends.slice(0, 3).map((friend) => (
              <Link
                key={friend.id}
                to={`/friends?friend=${encodeURIComponent(friend.id)}`}
                className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5"
              >
                <FriendAvatar profile={friend} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {friend.username || friend.display_name || "Player"}
                  </p>
                  <p className="text-xs text-emerald-400">{ui("Online")}</p>
                </div>
                <span className="text-sm text-indigo-300">{ui("Chat →")}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
