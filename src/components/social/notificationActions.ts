import type { DashboardNotification } from "@/hooks/useDashboardData";
import { supabase } from "@/lib/supabase";
import { getInviteDestination } from "./inviteRoute";

export const isClanNotification = (item: DashboardNotification) => item.kind === "clan_message" || item.kind === "clan_invite";

export const clanRoute = (clanId?: string) => `/clans${clanId ? `?clan=${encodeURIComponent(clanId)}` : ""}`;

/** The room a notification's action joins on arrival, if it joins one. Go clan invites are joined from the clan page. */
export function notificationRoomCode(item: DashboardNotification) {
  switch (item.kind) {
    case "clan_message":
    case "spectate_request":
    case "spectate_accepted":
    case "friend_request":
      return undefined;
    case "clan_invite":
      return item.game !== "go" ? item.gameCode || undefined : undefined;
    default:
      return item.gameCode || undefined;
  }
}

/** Where opening a notification leads. */
export function notificationDestination(item: DashboardNotification) {
  const roomCode = notificationRoomCode(item);
  // Every lobby joins on arrival (the game itself refuses a full lobby).
  if (roomCode) return getInviteDestination({ game: item.game, gameCode: roomCode, gameRoute: item.gameRoute }, { autoJoin: true });
  switch (item.kind) {
    case "clan_message":
    case "clan_invite":
      return clanRoute(item.clanId);
    case "spectate_accepted":
      return `/spectate/${item.spectateRequestId}`;
    case "friend_request":
      return "/friends";
    default:
      return `/friends${item.senderId ? `?friend=${encodeURIComponent(item.senderId)}` : ""}`;
  }
}

export function notificationActionLabel(item: DashboardNotification) {
  switch (item.kind) {
    case "clan_message": return "Open clan";
    case "clan_invite": return "Join";
    case "spectate_request": return "Review";
    case "spectate_accepted": return "Watch now";
    case "friend_request": return "Review";
    default: return item.gameCode ? "Join" : "Reply";
  }
}

export async function respondToSpectateRequest(requestId: string, accept: boolean) {
  const { error } = await supabase.rpc("respond_spectate_request", { p_request_id: requestId, p_accept: accept });
  return error?.message ?? null;
}

export async function requestSpectate(friendId: string) {
  const { error } = await supabase.rpc("request_spectate", { p_target_id: friendId });
  return error?.message ?? null;
}
