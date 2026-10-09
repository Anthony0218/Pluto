import { supabase } from "@/lib/supabase";
import type { RoomInvite } from "./currentRoom";

const call = (name: string, body: Record<string, unknown>) => supabase.functions.invoke(name, { body });

/**
 * Gives up the player's seat in a room whose code is part of the page URL. Rooms that have not
 * started free the seat (the next player hosts, an empty room closes); each game decides what
 * leaving a running match means, and most keep the seat for reconnecting.
 */
export async function leaveRoom({ lobbyRoute, code }: RoomInvite) {
  try {
    if (lobbyRoute === "/games/chess/classic/multiplayer") await supabase.rpc("leave_chess_room", { p_code: code });
    else if (lobbyRoute.startsWith("/games/chess/variants/")) await supabase.rpc("leave_variant_room", { p_code: code });
    else if (lobbyRoute === "/games/watten/multiplayer/4") await supabase.rpc("leave_watten_room", { p_code: code });
    else if (lobbyRoute === "/games/watten/multiplayer/3") await supabase.rpc("leave_watten3_room", { p_code: code });
    else if (lobbyRoute === "/games/schafkopf/multiplayer") await call("schafkopf-multiplayer", { op: "leave", code });
    else if (lobbyRoute === "/games/atlas-arena/multiplayer") await call("atlas-match", { op: "leave", code });
    else if (lobbyRoute === "/games/eat-it/multiplayer") await call("eat-it-match", { op: "leave", code });
    else if (lobbyRoute === "/games/go/multiplayer" || lobbyRoute === "/games/shogi/multiplayer") await call("strategy-match", { op: "leave", code });
    else if (lobbyRoute === "/games/card-builder/room") await call("card-games", { op: "leaveRoom", code });
    else if (lobbyRoute === "/chess-custom/play/multiplayer") await call("chess-custom-match", { op: "leave", code });
    // Ranked chess rooms are matchmade: walking out of one is decided by the ranked rules, not here.
  } catch {
    // The invited room opens either way; a seat that could not be released only stays reserved.
  }
}
