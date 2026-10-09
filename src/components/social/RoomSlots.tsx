import InviteFriendButton from "@/components/chess/InviteFriendButton";
import { ui, useUiLanguage } from "@/i18n/ui";
import type { RoomInvite } from "./currentRoom";
import "./roomInvite.css";

/** The seats of a waiting room: taken seats show the player, open seats offer the invite button. */
export default function RoomSlots({ names, total, labels, room, overlay = false }: {
  /** Names of the players seated so far, in seat order. */
  names: (string | null | undefined)[];
  total: number;
  /** Optional seat captions, e.g. the colours or teams. */
  labels?: string[];
  room?: RoomInvite;
  /** Sits under the room-code card of a waiting overlay. */
  overlay?: boolean;
}) {
  useUiLanguage();
  return <div className={`room-slots${overlay ? " room-slots--overlay" : ""}`} aria-label={ui("Room seats")}>
    {Array.from({ length: total }, (_, seat) => {
      const name = names[seat];
      return <div key={seat} className={`room-slot ${name ? "is-filled" : "is-open"}`}>
        <span><small>{labels?.[seat] ?? `${ui("Seat")} ${seat + 1}`}</small><strong>{name || ui("Open seat")}</strong></span>
        {!name && <InviteFriendButton room={room} />}
      </div>;
    })}
  </div>;
}
