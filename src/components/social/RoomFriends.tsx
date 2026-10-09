import { ui, useUiLanguage } from "@/i18n/ui";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useCurrentRoom, type RoomInvite } from "./currentRoom";
import RoomInviteList from "./RoomInviteList";

/** Opens the friends list for a room when a slot's invite button is pressed. Rooms are invited from their slots, not from a floating button. */
export default function RoomFriends() {
  useUiLanguage();
  const current = useCurrentRoom();
  const currentRoom = useRef(current);
  const { pathname } = useLocation();
  const [shown, setShown] = useState<{ room: RoomInvite; pathname: string } | null>(null);
  const pathnameRef = useRef(pathname);
  useEffect(() => { currentRoom.current = current; pathnameRef.current = pathname; });
  useEffect(() => {
    const show = (event: Event) => {
      const requested = (event as CustomEvent<RoomInvite | undefined>).detail ?? currentRoom.current;
      if (requested) setShown({ room: requested, pathname: pathnameRef.current });
    };
    window.addEventListener("open-room-friends", show);
    return () => window.removeEventListener("open-room-friends", show);
  }, []);
  // Leaving the page closes the invite list.
  const room = shown && shown.pathname === pathname ? shown.room : null;
  return room ? <RoomFriendsDialog key={room.lobbyRoute + room.code} room={room} onClose={() => setShown(null)} /> : null;
}

function RoomFriendsDialog({ room, onClose }: { room: RoomInvite; onClose: () => void }) {
  useUiLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} aria-label={ui("Invite friends")} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-h-[calc(100dvh-4rem)] w-[min(28rem,94vw)] overflow-y-auto rounded-2xl border border-white/10 bg-[#091019] p-5 text-white backdrop:bg-black/70">
    <div className="mb-4 flex items-center justify-between gap-4">
      <div><h2 className="font-serif text-xl">{ui("Invite friends")}</h2><p className="mt-0.5 text-xs text-slate-400">{ui("Room")} <span className="font-mono font-bold tracking-widest text-amber-200">{room.code}</span></p></div>
      <button type="button" aria-label={ui("Close")} onClick={onClose} className="rounded-lg p-2 hover:bg-white/10"><X size={20} /></button>
    </div>
    <RoomInviteList room={room} />
  </dialog>;
}
