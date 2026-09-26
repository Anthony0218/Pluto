import { ui, useUiLanguage } from "@/i18n/ui";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Users, X } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import FriendChat from "./FriendChat";

export default function RoomFriends() {
  useUiLanguage();
  const { pathname } = useLocation();
  const match = pathname.match(/^(\/games\/chess\/.+\/multiplayer|\/games\/atlas-arena\/multiplayer)\/([A-Z0-9]{6})(?:\/game)?$/i);
  if (!match) return null;
  return <RoomFriendsPanel key={pathname} lobbyRoute={match[1]} code={match[2].toUpperCase()} />;
}
function RoomFriendsPanel({ lobbyRoute, code }: { lobbyRoute: string; code: string }) {
  useUiLanguage();
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-xl border border-amber-300/30 bg-[#091019] px-4 py-3 text-sm font-semibold text-amber-100 shadow-xl">
      <Users size={17} />{ui("Invite friends")}</button>
    {open && <RoomFriendsDialog lobbyRoute={lobbyRoute} code={code} onClose={() => setOpen(false)} />}
  </>;
}
function RoomFriendsDialog({ lobbyRoute, code, onClose }: { lobbyRoute: string; code: string; onClose: () => void }) {
  useUiLanguage();
  const { friends, loading, friendsError } = useDashboardData();
  const [selectedId, setSelectedId] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const friend = friends.find((item) => item.id === selectedId);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-h-[calc(100dvh-6rem)] w-[min(900px,94vw)] overflow-y-auto rounded-2xl border border-white/10 bg-[#091019] p-5 text-white backdrop:bg-black/70">
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="font-serif text-xl">{ui("Invite friends ·")}{code}</h2>
      <button type="button" aria-label={ui("Close")} onClick={onClose} className="rounded-lg p-2 hover:bg-white/10"><X size={20} /></button>
    </div>
    {loading && <p>{ui("Loading friends...")}</p>}
    {friendsError && <p role="alert">{ui("Friends could not be loaded. Reopen to retry.")}</p>}
    {!loading && !friendsError && !friends.length && <p>{ui("Add friends on the Friends page to invite them.")}</p>}
    <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
      <div className="space-y-2">{friends.map((item) => <button type="button" key={item.id} onClick={() => setSelectedId(item.id)} aria-pressed={selectedId === item.id} className={`block w-full rounded-xl px-3 py-3 text-left ${selectedId === item.id ? "bg-amber-400/20 text-amber-100" : "bg-white/5"}`}>{item.display_name || item.username || "Player"}</button>)}</div>
      {friend ? <FriendChat key={friend.id} friend={friend} roomInvite={{ code, lobbyRoute }} /> : <p>{ui("Select a friend to chat and send this room code.")}</p>}
    </div>
  </dialog>;
}
