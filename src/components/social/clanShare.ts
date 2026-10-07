import { supabase } from "@/lib/supabase";

/**
 * The game id a clan invite is stored under for a lobby route, or null when that lobby cannot be shared with a clan.
 * Chess lobbies are classic, variant or custom; the others have one id per game.
 */
export function clanStoredGame(route: string) {
  if (route === "/games/chess/classic/multiplayer") return "chess";
  if (route === "/games/go/multiplayer") return "go";
  if (/^\/games\/chess\/variants\/[a-z0-9-]+\/multiplayer$/.test(route)) return "chess-variant";
  if (route === "/chess-custom/play/multiplayer") return "chess-custom";
  if (/^\/games\/watten\/multiplayer\/[34]$/.test(route)) return "watten";
  if (route === "/games/schafkopf/multiplayer") return "schafkopf";
  if (route === "/games/atlas-arena/multiplayer") return "atlas-arena";
  if (route === "/games/eat-it/multiplayer") return "eat-it";
  if (route === "/games/pluto-party") return "pluto-party";
  return null;
}

/** Shares a lobby with a clan, through whichever function stores invites for that game. */
export function shareRoomWithClan(groupId: string, code: string, route: string): PromiseLike<{ error: { message: string } | null }> {
  const game = clanStoredGame(route);
  if (!game) return Promise.resolve({ error: { message: "This game cannot be shared with a clan yet." } });
  if (game === "chess") return supabase.rpc("share_community_chess_room", { p_group_id: groupId, p_room_code: code });
  if (game === "go") return supabase.rpc("share_community_strategy_room", { p_group_id: groupId, p_game: "go", p_room_code: code });
  return supabase.rpc("share_community_game_room", { p_group_id: groupId, p_game: game, p_game_route: route, p_room_code: code });
}
