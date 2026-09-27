import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import type { Friend } from "@/types/social";
import FriendAvatar from "@/components/social/FriendAvatar";

export default function FriendsOnline({ friends, loading, unavailable, signedIn, onChat }: { friends: Friend[]; loading: boolean; unavailable: boolean; signedIn: boolean; onChat: (id: string) => void }) {
  useUiLanguage();
  return <section className="dash-panel"><div className="dash-section-heading"><h2>{ui("Friends Online")}{signedIn && !loading && !unavailable && <span className="ml-2 text-xs text-emerald-400">{friends.length}</span>}</h2><Link className="dash-text-link" to="/friends">{ui("View all")}<ArrowRight size={13} /></Link></div>
    {loading || unavailable || !signedIn || !friends.length ? <p className="dash-empty">{ui(loading ? "Loading friends…" : unavailable ? "Online status is temporarily unavailable." : !signedIn ? "Log in to connect with your friends." : "None of your friends are online right now. You can still message them from Friends.")}</p> : <div className="online-friends-list">{friends.map(friend => <button key={friend.id} onClick={() => onChat(friend.id)}><span className="relative"><FriendAvatar profile={friend} size="sm" /><i className="presence online" /></span><span className="min-w-0 flex-1"><strong className="block truncate">{friend.username || friend.display_name || ui("Player")}</strong><small className="text-slate-400">{ui("Online")}</small></span><span className="friend-chat-label">{ui("Chat")}</span></button>)}</div>}
  </section>;
}
