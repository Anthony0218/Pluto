import { useEffect, useState } from "react";
import { ArrowRight, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ui, useUiLanguage } from "@/i18n/ui";
import type { Friend, PublicProfile } from "@/types/social";
import FriendAvatar from "./FriendAvatar";

export default function ProfileFriends({ userId }: { userId: string }) {
  useUiLanguage();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadFriends() {
      const { data: relationships, error } = await supabase.from("friendships").select("user_a,user_b").or(`user_a.eq.${userId},user_b.eq.${userId}`);
      if (error || !active) { if (active) setLoading(false); return; }
      const friendIds = (relationships ?? []).map((row) => row.user_a === userId ? row.user_b : row.user_a);
      if (!friendIds.length) { setFriends([]); setLoading(false); return; }
      const { data: profiles } = await supabase.from("profiles").select("id,username,display_name,avatar_url,avatar_id").in("id", friendIds);
      if (!active) return;
      setFriends(((profiles ?? []) as PublicProfile[]).sort((a, b) => (a.display_name || a.username || "").localeCompare(b.display_name || b.username || "")));
      setLoading(false);
    }
    void loadFriends();
    return () => { active = false; };
  }, [userId]);

  return <section className="rounded-[26px] border border-indigo-400/15 bg-[#0b1529]/90 p-5 shadow-xl shadow-black/20">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-400/10 text-indigo-200"><Users size={18} /></span><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">{ui("Community")}</p><h2 className="mt-0.5 font-bold text-white">{ui("Friends")}</h2></div></div><Link to="/friends" className="inline-flex items-center gap-1 text-xs font-bold text-indigo-200 hover:text-white">{ui("View all")}<ArrowRight size={14} /></Link></div>
    {loading ? <p className="mt-4 text-sm text-zinc-400">{ui("Loading friends…")}</p> : friends.length ? <div className="mt-4 flex flex-wrap gap-3">{friends.slice(0, 6).map((friend) => <Link key={friend.id} to={`/friends?friend=${encodeURIComponent(friend.id)}`} className="group flex w-16 flex-col items-center gap-1 text-center"><FriendAvatar profile={friend} size="sm" /><span className="w-full truncate text-xs font-semibold text-zinc-300 group-hover:text-white">{friend.display_name || friend.username || ui("Player")}</span></Link>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-4 text-sm text-zinc-400"><p>{ui("No friends yet. Find someone by username on the Friends page.")}</p><Link to="/friends" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-indigo-200 hover:text-white">{ui("Find friends")}<ArrowRight size={14} /></Link></div>}
  </section>;
}
