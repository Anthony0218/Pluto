import { useEffect, useRef, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { currentRoomInvite } from "./inviteRoute";
import { leaveRoom } from "./leaveRoom";

export type RoomInvite = { lobbyRoute: string; code: string };

let published: RoomInvite | null = null;
let leavePublished: (() => void) | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getPublished = () => published;
const getServerPublished = () => null;

function publish(next: RoomInvite | null) {
  if (published?.code === next?.code && published?.lobbyRoute === next?.lobbyRoute) return;
  published = next;
  listeners.forEach((listener) => listener());
}

/**
 * Pages whose room code is not in the URL (Natura, Pluto Party, Medieval Kingdoms) tell the invite UI which room is open.
 * `leave` gives the seat up over the page's own connection; pages that already leave when they close need none.
 */
export function usePublishRoom(room: RoomInvite | null, leave?: () => void) {
  const lobbyRoute = room?.lobbyRoute;
  const code = room?.code;
  const latestLeave = useRef(leave);
  useEffect(() => { latestLeave.current = leave; });
  useEffect(() => {
    if (!lobbyRoute || !code) return;
    publish({ lobbyRoute, code });
    leavePublished = () => latestLeave.current?.();
    return () => { publish(null); leavePublished = null; };
  }, [lobbyRoute, code]);
}

/** The room the player is in right now: published by the page, or read from the URL. */
export function useCurrentRoom(): RoomInvite | null {
  const { pathname, search } = useLocation();
  const open = useSyncExternalStore(subscribe, getPublished, getServerPublished);
  return open ?? currentRoomInvite(pathname, search);
}

/**
 * Accepting an invite to another room gives up the seat in the open one, so the player
 * disappears from its slots. Call it before navigating to the invited room.
 */
export function leaveCurrentRoom(invitedCode: string) {
  if (published) {
    if (published.code !== invitedCode.trim().toUpperCase()) leavePublished?.();
    return;
  }
  const room = currentRoomInvite(window.location.pathname, window.location.search);
  if (room && room.code !== invitedCode.trim().toUpperCase()) void leaveRoom(room);
}
