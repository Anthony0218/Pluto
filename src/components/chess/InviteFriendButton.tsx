import { UserPlus } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import "@/components/social/roomInvite.css";
import type { RoomInvite } from "@/components/social/currentRoom";

/**
 * The invite button every open room slot carries, in every game. It opens the
 * friends list for the room the player is in; pass `room` only when the room
 * code is not part of the page URL and not published by the page.
 */
export default function InviteFriendButton({ room, className = "" }: { room?: RoomInvite; className?: string }) {
  useUiLanguage();
  return <button
    type="button"
    onClick={() => window.dispatchEvent(new CustomEvent("open-room-friends", { detail: room }))}
    className={`room-invite-button ${className}`}
  ><UserPlus size={14} aria-hidden="true" /><span>{ui("Invite friend")}</span></button>;
}
