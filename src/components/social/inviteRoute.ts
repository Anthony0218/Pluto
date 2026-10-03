import { variants } from "@/data/chessVariants";

type Invite = { game?: string | null; gameCode: string; gameRoute?: string | null };

const directRoomRoutes = new Set(["/games/atlas-arena/multiplayer", "/games/eat-it/multiplayer", "/games/card-builder/room"]);
const chessLobbyRoute = /^\/games\/chess\/(?:(?:classic|variants\/[a-z0-9-]+)\/multiplayer|ranked)$/;

/** Where a game invite leads. With `autoJoin`, lobbies join the room on arrival instead of only prefilling the code. */
export function getInviteDestination({ game, gameCode, gameRoute }: Invite, { autoJoin = false } = {}) {
  const code = encodeURIComponent(gameCode);
  const join = autoJoin ? "&join=1" : "";
  if (gameRoute && directRoomRoutes.has(gameRoute)) return `${gameRoute}/${code}${autoJoin ? "?join=1" : ""}`;
  if (gameRoute && chessLobbyRoute.test(gameRoute)) return `${gameRoute}?code=${code}${join}`;
  if (gameRoute === "/games/pluto-party") return `${gameRoute}?code=${code}${join}`;
  if (gameRoute === "/chess-custom/play/multiplayer") return `${gameRoute}?room=${code}${join}`;
  if (gameRoute && /^\/games\/(go|shogi|schafkopf)\/multiplayer$/.test(gameRoute)) return `${gameRoute}?code=${code}${join}`;
  if (gameRoute && /^\/games\/watten\/multiplayer\/[34]$/.test(gameRoute)) return `/games/watten/multiplayer?variant=${gameRoute.endsWith("/3") ? "three-player" : "four-player"}&code=${code}${join}`;
  if (game === "watten") return `/games/watten/multiplayer?code=${code}${join}`;
  return `/games/chess/classic/multiplayer?code=${code}${join}`;
}

/** English label for the invited game; pass the parts through `ui()` when rendering. */
export function getInviteGameLabel({ game, gameRoute }: Omit<Invite, "gameCode">) {
  if (gameRoute === "/games/pluto-party") return "Pluto Party";
  if (gameRoute === "/games/go/multiplayer") return "Go";
  if (gameRoute === "/games/shogi/multiplayer") return "Shogi";
  if (gameRoute === "/games/schafkopf/multiplayer") return "Schafkopf";
  if (gameRoute === "/games/card-builder/room") return "Card Builder";
  if (gameRoute === "/chess-custom/play/multiplayer") return "Custom Chess";
  if (gameRoute === "/games/eat-it/multiplayer") return "Eat It";
  if (gameRoute === "/games/atlas-arena/multiplayer") return "Atlas Arena";
  if (game === "watten" || gameRoute?.startsWith("/games/watten/multiplayer")) return "Watten";
  if (gameRoute === "/games/chess/ranked") return "Ranked Chess";
  if (gameRoute?.includes("/variants/")) return variants.find(variant => variant.multiplayerRoute === gameRoute)?.title ?? "Chess variant";
  return "Classic Chess";
}

/** Recognize only supported room paths when offering to share the current room. */
export function currentRoomInvite(pathname: string, search = "") {
  const match = pathname.match(/^(\/games\/chess\/(?:.+\/multiplayer|ranked)|\/games\/(?:atlas-arena|eat-it|go|shogi|schafkopf)\/multiplayer|\/games\/watten\/multiplayer\/[34]|\/games\/card-builder\/room)\/([A-Z0-9]{6})(?:\/game)?$/i);
  if (match) return { lobbyRoute: match[1], code: match[2].toUpperCase() };
  const room = new URLSearchParams(search).get("room");
  if (pathname === "/chess-custom/play/multiplayer" && room && /^[A-Z0-9]{6}$/i.test(room)) return { lobbyRoute: pathname, code: room.toUpperCase() };
  return null;
}
