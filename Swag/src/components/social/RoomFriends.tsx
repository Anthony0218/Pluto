import { ui, useUiLanguage } from "@/i18n/ui";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Users, X } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import FriendChat from "./FriendChat";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export default function RoomFriends() {
  useUiLanguage();
  const { pathname } = useLocation();
  const match = pathname.match(/^(\/games\/chess\/(?:.+\/multiplayer|ranked)|\/games\/atlas-arena\/multiplayer)\/([A-Z0-9]{6})(?:\/game)?$/i);
  if (!match) return null;
  return <RoomFriendsPanel key={pathname} lobbyRoute={match[1]} code={match[2].toUpperCase()} />;
}
function RoomFriendsPanel({ lobbyRoute, code }: { lobbyRoute: string; code: string }) {
  useUiLanguage();
  const [open, setOpen] = useState(false);
  useEffect(() => { const show = () => setOpen(true); window.addEventListener("open-room-friends", show); return () => window.removeEventListener("open-room-friends", show); }, []);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-xl border border-amber-300/30 bg-[#091019] px-4 py-3 text-sm font-semibold text-amber-100 shadow-xl">
      <Users size={17} />{ui("Invite friends")}</button>
    {open && <RoomFriendsDialog lobbyRoute={lobbyRoute} code={code} onClose={() => setOpen(false)} />}
  </>;
}
function RoomFriendsDialog({ lobbyRoute, code, onClose }: { lobbyRoute: string; code: string; onClose: () => void }) {
  useUiLanguage();
  const { user } = useAuth();
  const { friends, loading, friendsError } = useDashboardData();
  const [selectedId, setSelectedId] = useState("");
  const [sending, setSending] = useState(false);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const friend = friends.find((item) => item.id === selectedId);
  async function selectFriend(friendId: string) {
    setSelectedId(friendId);
    if (!user || sending || sentIds.includes(friendId)) return;
    setSending(true); setInviteError(null);
    const { error } = await supabase.from("friend_messages").insert({
      sender_id: user.id, receiver_id: friendId, message_type: "game_code",
      game: "chess", game_code: code,
      game_route: lobbyRoute,
    });
    if (error) setInviteError(ui("Game invite could not be sent. Please try again."));
    else setSentIds(current => [...current, friendId]);
    setSending(false);
  }
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} className="m-auto max-h-[calc(100dvh-6rem)] w-[min(900px,94vw)] overflow-y-auto rounded-2xl border border-white/10 bg-[#091019] p-5 text-white backdrop:bg-black/70">
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="font-serif text-xl">{ui("Invite friends ·")}{code}</h2>
      <button type="button" aria-label={ui("Close")} onClick={onClose} className="rounded-lg p-2 hover:bg-white/10"><X size={20} /></button>
    </div>
    {loading && <p>{ui("Loading friends...")}</p>}
    {friendsError && <p role="alert">{ui("Friends could not be loaded. Reopen to retry.")}</p>}
    {!loading && !friendsError && !friends.length && <p>{ui("Add friends on the Friends page to invite them.")}</p>}
    {inviteError && <p role="alert" className="mb-3 text-red-300">{inviteError}</p>}
    <div className="grid gap-4 md:grid-cols-[200px_minmax(0,1fr)]">
      <div className="space-y-2">{friends.map((item) => <button type="button" key={item.id} disabled={sending} onClick={() => void selectFriend(item.id)} aria-pressed={selectedId === item.id} className={`block w-full rounded-xl px-3 py-3 text-left disabled:opacity-50 ${selectedId === item.id ? "bg-amber-400/20 text-amber-100" : "bg-white/5"}`}>{item.display_name || item.username || ui("Player")}{sentIds.includes(item.id) && <span className="ml-2 text-emerald-300">✓ {ui("Invited")}</span>}</button>)}</div>
      {friend ? <FriendChat key={friend.id} friend={friend} roomInvite={{ code, lobbyRoute }} /> : <p>{ui("Select a friend to chat and send this room code.")}</p>}
    </div>
  </dialog>;
}
