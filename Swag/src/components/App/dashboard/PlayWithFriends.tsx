import { ArrowRight, Mail, Plus, Swords, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import type { Friend } from "@/types/social";
import FriendAvatar from "@/components/social/FriendAvatar";

export default function PlayWithFriends({ friends, onlineIds, unreadMessageSenderIds, loading, unavailable, signedIn, onFriendSelect }: { friends: Friend[]; onlineIds: string[]; unreadMessageSenderIds: string[]; loading: boolean; unavailable: boolean; signedIn: boolean; onFriendSelect: (id: string) => void }) {
  useUiLanguage();
  const sorted = [...friends].sort((a, b) => Number(onlineIds.includes(b.id)) - Number(onlineIds.includes(a.id)));
  const unreadMessageSenders = new Set(unreadMessageSenderIds);

  return <section className="dash-panel play-friends">
    <div className="dash-section-heading"><div className="flex min-w-0 items-start gap-3"><Users size={28} className="mt-1 shrink-0 text-violet-400" /><div><h2>{ui("Play with friends")}</h2><p>{ui("Great games are better together.")}</p></div></div><div className="flex shrink-0 items-center gap-2"><Link className="dash-text-link" to="/friends">{ui("See all friends")}<ArrowRight size={14} /></Link></div></div>
    <div className="friends-body"><div className="friend-avatar-row">
      {loading || unavailable || !signedIn ? <p className="max-w-xs text-sm text-slate-400">{ui(loading ? "Loading friends..." : unavailable ? "Online status is temporarily unavailable." : "Log in to connect with your friends.")}</p> : sorted.length ? sorted.slice(0, 5).map(friend => {
        const hasUnreadMessage = unreadMessageSenders.has(friend.id);
        const friendName = friend.username || friend.display_name || ui("Player");
        return <button key={friend.id} type="button" className={`friend-avatar-button${hasUnreadMessage ? " has-unread-message" : ""}`} onClick={() => onFriendSelect(friend.id)} aria-label={`${ui("Options")}: ${friendName}${hasUnreadMessage ? `, ${ui("New message")}` : ""}`}><span className="relative inline-block"><FriendAvatar profile={friend} size="sm" /><i className={onlineIds.includes(friend.id) ? "presence online" : "presence"} />{hasUnreadMessage && <i className="friend-message-indicator" aria-hidden="true"><Mail size={10} /></i>}</span><strong>{friendName}</strong><small>{hasUnreadMessage ? ui("New message") : ui(onlineIds.includes(friend.id) ? "Online" : "Offline")}</small></button>;
      }) : <p className="max-w-xs text-sm text-slate-400">{ui("No friends yet. Find someone by username on the Friends page.")}</p>}
      <Link to="/friends" className="friend-avatar-button invite-friend"><span><Plus size={24} /></span><strong>{ui("Invite")}</strong><small>{ui("Friends")}</small></Link>
    </div><div className="friend-actions"><Link to="/games/chess/classic/multiplayer" className="dash-button primary"><Users size={23} /><span><strong>{ui("Find a match")}</strong><small>{ui("Play with the community")}</small></span><ArrowRight size={16} /></Link><Link to="/friends" className="dash-button"><Swords size={23} /><span><strong>{ui("Challenge a friend")}</strong><small>{ui("Play a game together")}</small></span><ArrowRight size={16} /></Link><Link to="/groups" className="dash-button"><Users size={23} /><span><strong>{ui("Play with your Group")}</strong><small>{ui("Open your groups")}</small></span><ArrowRight size={16} /></Link></div></div>
  </section>;
}
