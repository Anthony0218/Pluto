import type { DashboardNotification } from "@/hooks/useDashboardData";
import { supabase } from "@/lib/supabase";
import { getInviteDestination } from "./inviteRoute";

export const isClanNotification = (item: DashboardNotification) => item.kind === "clan_message" || item.kind === "clan_invite";

export const clanRoute = (clanId?: string) => `/clans${clanId ? `?clan=${encodeURIComponent(clanId)}` : ""}`;

/** Where opening a notification leads. */
export function notificationDestination(item: DashboardNotification) {
  switch (item.kind) {
    case "clan_message":
      return clanRoute(item.clanId);
    case "clan_invite":
      // Every lobby but Go joins on arrival (the game itself refuses a full lobby); Go is joined from the clan page.
      return item.game !== "go" && item.gameCode
        ? getInviteDestination({ game: item.game, gameCode: item.gameCode, gameRoute: item.gameRoute }, { autoJoin: true })
        : clanRoute(item.clanId);
    case "spectate_request":
      return `/friends${item.senderId ? `?friend=${encodeURIComponent(item.senderId)}` : ""}`;
    case "spectate_accepted":
      return `/spectate/${item.spectateRequestId}`;
    case "friend_request":
      return "/friends";
    default:
      return item.gameCode
        ? getInviteDestination({ game: item.game, gameCode: item.gameCode, gameRoute: item.gameRoute }, { autoJoin: true })
        : `/friends${item.senderId ? `?friend=${encodeURIComponent(item.senderId)}` : ""}`;
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
