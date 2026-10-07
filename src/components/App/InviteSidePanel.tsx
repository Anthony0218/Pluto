import { X } from "lucide-react";
import AddFriendsPanel from "@/components/social/AddFriendsPanel";
import ClanInvitePanel from "@/components/social/ClanInvitePanel";
import GameInvitePanel from "@/components/social/GameInvitePanel";
import { ui, useUiLanguage } from "@/i18n/ui";

/** The invite page's contents, opened beside the navigation so a friend can be invited without leaving the current page. */
export default function InviteSidePanel({ kind = "friend", onBack, onNavigate }: { kind?: "friend" | "clan"; onBack: () => void; onNavigate: () => void }) {
  useUiLanguage();
  const clan = kind === "clan";
  return <section id={clan ? "clan-invite-panel" : "invite-panel"} aria-labelledby="invite-panel-title" className="invite-side-panel absolute inset-y-0 left-full z-20 flex w-[min(36rem,calc(100vw-20rem))] flex-col border-l border-white/10 bg-[#0a1124]/95 text-white shadow-2xl backdrop-blur-xl max-md:left-0 max-md:w-full">
    <header className="flex items-start gap-3 px-5 pb-3 pt-5">
      <div className="min-w-0 flex-1">
        <h2 id="invite-panel-title" className="font-serif text-2xl">{ui(clan ? "Invite your clan" : "Challenge a friend")}</h2>
        <p className="mt-1 text-sm text-slate-400">{ui(clan ? "Choose a game and mode, create a room, and invite your clan." : "Choose a game and mode, create a room, and invite a friend.")}</p>
      </div>
      <button type="button" autoFocus onClick={onBack} aria-label={ui("Close")} className="shrink-0 rounded-lg p-2 text-zinc-300 hover:bg-white/10"><X size={20} /></button>
    </header>
    <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-8 pt-2">
      {clan ? <ClanInvitePanel onNavigate={onNavigate} /> : <><GameInvitePanel onNavigate={onNavigate} /><AddFriendsPanel /></>}
    </div>
  </section>;
}
