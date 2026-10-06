import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Gamepad2, Swords, Users } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import FriendMoons from "./landing/FriendMoons";

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
      <FriendMoons friends={sampleFriends} selected={selected} onSelect={name => setSelected(current => current === name ? null : name)} />
      {selected && <p className="mb-4 rounded-lg border border-indigo-300/20 bg-indigo-400/10 px-3 py-2 text-xs text-indigo-100" aria-live="polite">{ui("Choose a friend to chat or send a challenge.")} {selected} {ui("is selected.")}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <Link to="/games" className="flex items-center justify-between gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-xs font-semibold text-white hover:bg-indigo-400"><span className="flex items-center gap-2"><Gamepad2 size={19} />{ui("See all games")}</span><ArrowRight size={16} /></Link>
        <Link to="/friends" className="flex items-center justify-between gap-2 rounded-xl border border-indigo-300/25 px-4 py-3 text-xs font-semibold text-indigo-100 hover:bg-white/5"><span className="flex items-center gap-2"><Swords size={19} />{ui("Challenge a friend")}</span><ArrowRight size={16} /></Link>
      </div>
      <Link to="/clans" className="mt-3 flex items-center justify-between rounded-xl border border-violet-300/25 bg-violet-400/10 px-4 py-3 text-sm font-bold text-violet-100 hover:bg-violet-400/20"><span className="flex items-center gap-2"><Users size={18} />{ui("Play with your clan")}</span><ArrowRight size={16} /></Link>
      <p className="mt-4 text-[10px] text-slate-500">{ui("Preview friends shown for illustration.")}</p>
    </section>
  );
}
