import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ui, useUiLanguage } from "@/i18n/ui";
import { GroupAvatar } from "./GroupAvatar";

type Group = { id: string; name: string; avatar_id: string };

export default function MyGroupsCard({ userId }: { userId: string }) {
  useUiLanguage();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: memberships } = await supabase.from("community_group_members").select("group_id").eq("user_id", userId);
      const ids = (memberships ?? []).map(row => row.group_id);
      const result = ids.length ? await supabase.from("community_groups").select("id,name,avatar_id").in("id", ids).order("name") : null;
      if (active) { setGroups((result?.data ?? []) as Group[]); setLoading(false); }
    })();
    return () => { active = false; };
  }, [userId]);

  return <section className="rounded-[26px] border border-indigo-400/15 bg-[#0b1529]/90 p-5 shadow-xl shadow-black/20">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Users size={20} className="text-violet-300" /><h2 className="text-lg font-black text-white">{ui("Your clans")}</h2></div><Link to="/clans" className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 hover:text-amber-200">{ui("View all")}<ArrowRight size={14} /></Link></div>
    {loading ? <p className="mt-4 text-sm text-slate-400">{ui("Loading...")}</p> : groups.length ? <div className="mt-4 grid gap-2">{groups.slice(0, 3).map(group => <Link key={group.id} to={`/clans?clan=${encodeURIComponent(group.id)}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.035] p-2 text-sm font-semibold text-white hover:border-amber-300/40"><GroupAvatar id={group.avatar_id} className="h-10 w-10" /><span className="min-w-0 flex-1 truncate">{group.name}</span><ArrowRight size={15} className="text-amber-300" /></Link>)}</div> : <p className="mt-4 text-sm text-slate-400">{ui("No clans yet. Create one or join with an invite code.")}</p>}
    <Link to="/clans" className="mt-4 inline-flex rounded-xl border border-amber-300/30 px-4 py-2 text-sm font-bold text-amber-200 hover:bg-amber-300/10">{ui("Play with your clan")}</Link>
  </section>;
}
