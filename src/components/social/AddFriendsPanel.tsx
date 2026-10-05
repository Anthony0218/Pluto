import { useEffect, useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { supabase } from "@/lib/supabase";
import { sendFriendRequest } from "@/data/friendRequests";
import { ui, useUiLanguage } from "@/i18n/ui";
import type { PublicProfile } from "@/types/social";
import FriendAvatar from "./FriendAvatar";
export default function AddFriendsPanel() {
  useUiLanguage();
  const { user } = useAuth();
  const { friends } = useDashboardData();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      const search = query.trim().replace(/^@/, "").replace(/[%_]/g, "");
      if (!user || search.length < 2) { setResults([]); return; }
      void (async () => {
        const { data, error } = await supabase.from("profiles").select("id,username,display_name,avatar_url,avatar_id").neq("id", user.id).ilike("username", `%${search}%`).limit(8);
        if (!active) return;
        if (error) { setStatus("Friends could not be loaded. Try again."); setResults([]); }
        else { setResults(((data ?? []) as PublicProfile[]).filter(profile => !friends.some(friend => friend.id === profile.id))); setStatus(""); }
      })();
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, user, friends]);
  async function add(id: string) {
    if (!user || busyId) return;
    setBusyId(id);
    const { error } = await sendFriendRequest(supabase, user.id, id);
    if (!error || error.code === "23505") { setSent(current => [...current, id]); setStatus(error ? "A request has already been sent." : "Friend request sent."); }
    else setStatus(error.message);
    setBusyId(null);
  }
  return <section className="rounded-2xl border border-white/10 bg-white/[.035] p-5 sm:p-7"><h2 className="flex items-center gap-2 text-xl font-bold"><UserPlus className="text-teal-300" />{ui("Add friends")}</h2><label className="mt-5 block text-sm text-slate-300">{ui("Search @username")}<div className="relative mt-2"><Search size={18} className="absolute left-3 top-3 text-slate-400" /><input disabled={!user} value={query} onChange={event => setQuery(event.target.value)} placeholder="@username" className="w-full rounded-xl border border-white/15 bg-black/25 py-3 pl-10 pr-3 text-white" /></div></label>{!user && <Link to="/login" className="mt-3 block text-indigo-200">{ui("Sign in")}</Link>}<div className="mt-4 space-y-2">{results.map(profile => <div key={profile.id} className="flex items-center gap-3 rounded-xl bg-white/5 p-3"><FriendAvatar profile={profile} size="sm" /><span className="min-w-0 flex-1 truncate">{profile.display_name || profile.username}</span><button type="button" disabled={!!busyId || sent.includes(profile.id)} onClick={() => void add(profile.id)} className="rounded-lg bg-teal-300/15 px-3 py-2 text-sm font-bold text-teal-200 disabled:opacity-50">{ui(sent.includes(profile.id) ? "Request sent" : "Add friend")}</button></div>)}</div>{status && <p role="status" className="mt-3 text-sm text-slate-300">{ui(status)}</p>}<Link to="/friends" className="mt-6 inline-block text-sm text-indigo-200">{ui("Friends and requests")}</Link></section>;
}
