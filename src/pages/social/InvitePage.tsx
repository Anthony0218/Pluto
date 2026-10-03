import { useSearchParams } from "react-router-dom";
import GameInvitePanel from "@/components/social/GameInvitePanel";
import AddFriendsPanel from "@/components/social/AddFriendsPanel";
import { ui, useUiLanguage } from "@/i18n/ui";
export default function InvitePage() {
  useUiLanguage();
  const [params] = useSearchParams();
  return <main className="min-h-[var(--app-height)] px-5 py-8 text-white sm:px-8"><div className="mx-auto max-w-6xl"><h1 className="font-serif text-4xl">{ui("Challenge a friend")}</h1><p className="mt-2 text-slate-400">{ui("Choose a game and mode, create a room, and invite a friend.")}</p><div className="mt-7 grid items-start gap-5 lg:grid-cols-2"><GameInvitePanel initialFriendId={params.get("friend") ?? ""} /><AddFriendsPanel /></div></div></main>;
}
