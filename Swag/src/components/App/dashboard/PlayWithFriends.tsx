import { ArrowRight, Plus, Swords, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import type { DashboardNotification } from "@/hooks/useDashboardData";
import type { Friend } from "@/types/social";
import FriendAvatar from "@/components/social/FriendAvatar";
import FriendNotifications from "./FriendNotifications";

export default function PlayWithFriends({ friends, onlineIds, notifications, userId, loading, unavailable, signedIn, onChat }: { friends: Friend[]; onlineIds: string[]; notifications: DashboardNotification[]; userId?: string; loading: boolean; unavailable: boolean; signedIn: boolean; onChat: (id: string) => void }) {
  useUiLanguage();
  const sorted = [...friends].sort((a, b) => Number(onlineIds.includes(b.id)) - Number(onlineIds.includes(a.id)));
  return <section className="dash-panel play-friends">
    <div className="dash-section-heading"><div className="flex min-w-0 items-start gap-3"><Users size={28} className="mt-1 shrink-0 text-violet-400" /><div><h2>{ui("Play with friends")}</h2><p>{ui("Great games are better together.")}</p></div></div><div className="flex shrink-0 items-center gap-2"><FriendNotifications items={notifications} userId={userId} /><Link className="dash-text-link" to="/friends">{ui("See all friends")}<ArrowRight size={14} /></Link></div></div>
    <div className="friends-body"><div className="friend-avatar-row">
      {loading || unavailable || !signedIn ? <p className="max-w-xs text-sm text-slate-400">{ui(loading ? "Loading friends…" : unavailable ? "Online status is temporarily unavailable." : "Log in to connect with your friends.")}</p> : sorted.length ? sorted.slice(0, 5).map(friend => <button key={friend.id} className="friend-avatar-button" onClick={() => onChat(friend.id)} aria-label={ui("Chat") + ": " + (friend.username || friend.display_name || ui("Player"))}><span className="relative inline-block"><FriendAvatar profile={friend} size="sm" /><i className={onlineIds.includes(friend.id) ? "presence online" : "presence"} /></span><strong>{friend.username || friend.display_name || ui("Player")}</strong><small>{ui(onlineIds.includes(friend.id) ? "Online" : "Offline")}</small></button>) : <p className="max-w-xs text-sm text-slate-400">{ui("No friends yet. Find someone by username on the Friends page.")}</p>}
      <Link to="/friends" className="friend-avatar-button invite-friend"><span><Plus size={24} /></span><strong>{ui("Invite")}</strong><small>{ui("Friends")}</small></Link>
    </div><div className="friend-actions"><Link to="/friends" className="dash-button primary"><Swords size={23} /><span><strong>{ui("Challenge a friend")}</strong><small>{ui("Play a game together")}</small></span><ArrowRight size={16} /></Link><Link to="/games/chess/classic/multiplayer" className="dash-button"><Users size={23} /><span><strong>{ui("Find a match")}</strong><small>{ui("Play with the community")}</small></span><ArrowRight size={16} /></Link></div></div>
  </section>;
}
