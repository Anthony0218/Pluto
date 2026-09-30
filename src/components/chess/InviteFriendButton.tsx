import { ui, useUiLanguage } from "@/i18n/ui";

/** Opens the existing room friends dialog, which sends the current room code. */
export default function InviteFriendButton({ overlay = false }: { overlay?: boolean }) {
  useUiLanguage();
  return <button
    type="button"
    onClick={() => window.dispatchEvent(new Event("open-room-friends"))}
    className={`rounded-xl border border-amber-300/50 bg-[#282015] px-4 py-2 text-sm font-bold text-amber-100 shadow-lg transition hover:border-amber-200 hover:bg-[#3c2e1a] focus-visible:outline-2 focus-visible:outline-amber-200 ${overlay ? "absolute bottom-4 right-4 z-[60]" : "mt-4"}`}
  >{ui("Invite Friend")}</button>;
}
