import { useState } from "react";
import { Shield, Swords, X } from "lucide-react";
import AddFriendsPanel from "@/components/social/AddFriendsPanel";
import ClanInvitePanel from "@/components/social/ClanInvitePanel";
import GameInvitePanel from "@/components/social/GameInvitePanel";
import { ui, useUiLanguage } from "@/i18n/ui";

const audiences = [{ id: "friend", label: "Friend", Icon: Swords }, { id: "clan", label: "Clan", Icon: Shield }] as const;

/** The invite page's contents, opened beside the navigation so a friend or a clan can be invited without leaving the current page. */
export default function InviteSidePanel({ onBack, onNavigate }: { onBack: () => void; onNavigate: () => void }) {
  useUiLanguage();
  const [audience, setAudience] = useState<"friend" | "clan">("friend");
  const clan = audience === "clan";
  return <section id="invite-panel" aria-labelledby="invite-panel-title" className="invite-side-panel absolute inset-y-0 left-full z-20 flex w-[min(36rem,calc(100vw-20rem))] flex-col border-l border-white/10 bg-[#0a1124]/95 text-white shadow-2xl backdrop-blur-xl max-md:left-0 max-md:w-full">
    <header className="flex items-start gap-3 px-5 pb-3 pt-5 max-md:pl-4 max-md:pr-3">
      <div className="min-w-0 flex-1">
        <h2 id="invite-panel-title" className="font-serif text-2xl">{ui(clan ? "Invite your clan" : "Challenge a friend")}</h2>
        <p className="mt-1 text-sm text-slate-400">{ui(clan ? "Choose a game and mode, create a room, and invite your clan." : "Choose a game and mode, create a room, and invite a friend.")}</p>
      </div>
      <button type="button" autoFocus onClick={onBack} aria-label={ui("Close")} className="shrink-0 rounded-lg p-2 text-zinc-300 hover:bg-white/10"><X size={20} /></button>
    </header>
    <div role="group" aria-label={ui("Who do you want to invite?")} className="mx-5 mb-3 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1 max-md:mx-4">
      {audiences.map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={audience === id} onClick={() => setAudience(id)} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${audience === id ? "bg-indigo-500/30 text-indigo-100 shadow-[inset_0_0_0_1px_rgb(165_180_252/.35)]" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}><Icon size={16} aria-hidden />{ui(label)}</button>)}
    </div>
    <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-8 pt-2 max-md:px-4">
      {clan ? <ClanInvitePanel onNavigate={onNavigate} /> : <><GameInvitePanel onNavigate={onNavigate} /><AddFriendsPanel /></>}
    </div>
  </section>;
}
