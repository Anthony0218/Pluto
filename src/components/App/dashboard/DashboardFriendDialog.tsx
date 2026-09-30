import { useEffect, useState } from "react";
import { ArrowLeft, MessageCircle, UserRound } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import type { Friend } from "@/types/social";
import FriendAvatar from "@/components/social/FriendAvatar";
import FriendChat from "@/components/social/FriendChat";
import DashboardDialog from "./DashboardDialog";
import { supabase } from "@/lib/supabase";

type View = "actions" | "chat" | "profile";

export default function DashboardFriendDialog({ friend, online, view, onViewChange, onClose }: { friend: Friend; online: boolean; view: View; onViewChange: (view: View) => void; onClose: () => void }) {
  useUiLanguage();
  const name = friend.display_name || friend.username || ui("Player");
  return <DashboardDialog title={view === "chat" ? `${ui("Chat")}: ${name}` : view === "profile" ? `${ui("Profile")}: ${name}` : name} onClose={onClose}>
    {view === "chat" ? <FriendChat friend={friend} /> : <>
      {view === "profile" && <button type="button" className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-indigo-200 hover:text-white" onClick={() => onViewChange("actions")}><ArrowLeft size={14} />{ui("Back")}</button>}
      <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-4">
        <FriendAvatar profile={friend} size="lg" />
        <div className="min-w-0"><h3 className="truncate text-lg font-bold text-white">{name}</h3>{friend.username && <p className="truncate text-sm text-slate-400">@{friend.username}</p>}<p className={`mt-1 text-xs ${online ? "text-emerald-300" : "text-slate-400"}`}>{ui(online ? "Online" : "Offline")}</p></div>
      </div>
      {view === "actions" ? <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" className="dash-button primary min-h-12" onClick={() => onViewChange("chat")}><MessageCircle size={18} />{ui("Chat")}</button>
        <button type="button" className="dash-button min-h-12" onClick={() => onViewChange("profile")}><UserRound size={18} />{ui("See profile")}</button>
      </div> : <div className="mt-4"><FriendProfileDetails friendId={friend.id} /><button type="button" className="dash-button primary mt-4 w-full" onClick={() => onViewChange("chat")}><MessageCircle size={17} />{ui("Chat")}</button></div>}
    </>}
  </DashboardDialog>;
}

type PublicStats = { rating: number | null; games_played: number | null; wins: number | null; losses: number | null; draws: number | null };

function FriendProfileDetails({ friendId }: { friendId: string }) {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void supabase.from("profiles").select("rating,games_played,wins,losses,draws").eq("id", friendId).maybeSingle().then(({ data }) => {
      if (!active) return;
      setStats(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [friendId]);
  if (loading) return <p className="text-sm text-slate-400">{ui("Loading profile…")}</p>;
  if (!stats) return <p className="text-sm text-slate-400">{ui("Profile stats are unavailable.")}</p>;
  return <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[
    ["Rating", stats.rating], ["Games played", stats.games_played], ["Wins", stats.wins], ["Draws", stats.draws], ["Losses", stats.losses],
  ].map(([label, value]) => <div key={label} className="rounded-lg border border-white/10 bg-white/[0.035] p-3"><dt className="text-xs text-slate-400">{ui(String(label))}</dt><dd className="mt-1 text-lg font-semibold text-white">{value?.toLocaleString() ?? "—"}</dd></div>)}</dl>;
}
