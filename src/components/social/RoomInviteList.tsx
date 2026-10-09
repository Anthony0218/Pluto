import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useDashboardData } from "@/hooks/useDashboardData";
import { supabase } from "@/lib/supabase";
import { ui, useUiLanguage } from "@/i18n/ui";
import FriendAvatar from "./FriendAvatar";
import type { RoomInvite } from "./currentRoom";
import { inviteGameKey } from "./inviteRoute";
import "./roomInvite.css";

/** Friends with a one-tap invite to the given room. Online friends come first. */
export default function RoomInviteList({ room }: { room: RoomInvite }) {
  useUiLanguage();
  const { user } = useAuth();
  const { friends, onlineIds, loading, friendsError } = useDashboardData();
  const [status, setStatus] = useState<Record<string, "sending" | "sent">>({});
  const [error, setError] = useState("");
  const sorted = [...friends].sort((a, b) => Number(onlineIds.includes(b.id)) - Number(onlineIds.includes(a.id)));

  async function invite(friendId: string) {
    if (!user || status[friendId]) return;
    setError("");
    setStatus(current => ({ ...current, [friendId]: "sending" }));
    const { error: failure } = await supabase.from("friend_messages").insert({
      sender_id: user.id, receiver_id: friendId, message_type: "game_code",
      game: inviteGameKey(room.lobbyRoute), game_code: room.code, game_route: room.lobbyRoute,
    });
    if (failure) {
      setStatus(current => { const next = { ...current }; delete next[friendId]; return next; });
      setError(ui("Game invite could not be sent. Please try again."));
    } else setStatus(current => ({ ...current, [friendId]: "sent" }));
  }

  if (!user) return <p className="text-sm text-slate-400">{ui("Sign in")}</p>;
  if (loading) return <p className="text-sm text-slate-400">{ui("Loading friends...")}</p>;
  if (friendsError) return <p role="alert" className="text-sm text-red-300">{ui("Friends could not be loaded. Reopen to retry.")}</p>;
  if (!sorted.length) return <p className="text-sm text-slate-400">{ui("Add friends on the Friends page to invite them.")}</p>;
  return <>
    {error && <p role="alert" className="mb-2 text-sm text-red-300">{error}</p>}
    <ul className="room-invite-list">{sorted.map(friend => {
      const name = friend.display_name || friend.username || ui("Player");
      const online = onlineIds.includes(friend.id);
      return <li key={friend.id}>
        <span><FriendAvatar profile={friend} size="sm" /><span className="grid min-w-0"><strong>{name}</strong>{online && <small className="is-online">● {ui("Online")}</small>}</span></span>
        {status[friend.id] === "sent"
          ? <span className="is-sent"><Check size={14} aria-hidden="true" />{ui("Invited")}</span>
          : <button type="button" className="room-invite-button" disabled={status[friend.id] === "sending"} onClick={() => void invite(friend.id)} aria-label={`${ui("Invite")} ${name}`}>
            {status[friend.id] === "sending" ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}{ui("Invite")}
          </button>}
      </li>;
    })}</ul>
  </>;
}
