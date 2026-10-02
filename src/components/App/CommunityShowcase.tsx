import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, Swords, Users } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import { ProfileAvatar } from "@/components/social/ProfileAvatarPicker";

const sampleFriends = [
  { name: "Alex", avatar: "m1", online: true },
  { name: "Sam", avatar: "f1", online: true },
  { name: "Mia", avatar: "f2", online: false },
  { name: "Chris", avatar: "m2", online: false },
];

export default function CommunityShowcase() {
  useUiLanguage();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <section className="landing-preview rounded-[28px] border border-indigo-300/20 bg-[#0b1430] p-5 shadow-2xl shadow-black/30 sm:p-6" aria-label={ui("Play with friends preview")}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-5">
        <div className="flex items-start gap-3">
          <Users size={28} className="mt-1 shrink-0 text-violet-400" />
          <div><h3 className="text-xl font-bold text-white">{ui("Play with friends")}</h3><p className="mt-1 text-sm text-slate-400">{ui("Great games are better together.")}</p></div>
        </div>
        <Link to="/friends" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-300 hover:text-white">{ui("See all friends")}<ArrowRight size={14} /></Link>
      </div>
      <div className="flex flex-wrap gap-4 py-6 sm:gap-6">
        {sampleFriends.map(friend => <button key={friend.name} type="button" onClick={() => setSelected(friend.name)} className={`flex min-w-16 flex-col items-center gap-1 rounded-xl p-1 text-center transition hover:bg-white/5 ${selected === friend.name ? "bg-indigo-400/10" : ""}`} aria-pressed={selected === friend.name}>
          <span className="relative h-12 w-12 overflow-visible rounded-full"><ProfileAvatar avatarId={friend.avatar} className="h-full w-full rounded-full" /><i className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-[#0b1430] ${friend.online ? "bg-emerald-400" : "bg-slate-500"}`} /></span>
          <strong className="text-xs text-white">{friend.name}</strong><small className={`text-[10px] ${friend.online ? "text-emerald-300" : "text-slate-500"}`}>{ui(friend.online ? "Online" : "Offline")}</small>
        </button>)}
        <Link to="/friends" className="flex min-w-16 flex-col items-center gap-1 rounded-xl p-1 text-center hover:bg-white/5"><span className="grid h-12 w-12 place-items-center rounded-full border border-dashed border-indigo-300/50 text-indigo-300"><Plus size={22} /></span><strong className="text-xs text-white">{ui("Invite")}</strong><small className="text-[10px] text-slate-500">{ui("Friends")}</small></Link>
      </div>
      {selected && <p className="mb-4 rounded-lg border border-indigo-300/20 bg-indigo-400/10 px-3 py-2 text-xs text-indigo-100" aria-live="polite">{ui("Choose a friend to chat or send a challenge.")} {selected} {ui("is selected.")}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Link to="/games/chess/classic/multiplayer" className="flex items-center justify-between gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-xs font-semibold text-white hover:bg-indigo-400"><span className="flex items-center gap-2"><Users size={19} />{ui("Find a match")}</span><ArrowRight size={16} /></Link>
        <Link to="/friends" className="flex items-center justify-between gap-2 rounded-xl border border-indigo-300/25 px-4 py-3 text-xs font-semibold text-indigo-100 hover:bg-white/5"><span className="flex items-center gap-2"><Swords size={19} />{ui("Challenge a friend")}</span><ArrowRight size={16} /></Link>
      </div>
      <Link to="/clans" className="mt-3 flex items-center justify-between rounded-xl border border-violet-300/25 bg-violet-400/10 px-4 py-3 text-sm font-bold text-violet-100 hover:bg-violet-400/20"><span className="flex items-center gap-2"><Users size={18} />{ui("Play with your clan")}</span><ArrowRight size={16} /></Link>
      <p className="mt-4 text-[10px] text-slate-500">{ui("Preview friends shown for illustration.")}</p>
    </section>
  );
}
