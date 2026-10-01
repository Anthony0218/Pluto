import { variants } from "@/data/chessVariants";

type Invite = { game?: string | null; gameCode: string; gameRoute?: string | null };

const directRoomRoutes = new Set(["/games/atlas-arena/multiplayer", "/games/eat-it/multiplayer"]);
const chessLobbyRoute = /^\/games\/chess\/(?:(?:classic|variants\/[a-z0-9-]+)\/multiplayer|ranked)$/;

/** Where a game invite leads. With `autoJoin`, lobbies join the room on arrival instead of only prefilling the code. */
export function getInviteDestination({ game, gameCode, gameRoute }: Invite, { autoJoin = false } = {}) {
  const code = encodeURIComponent(gameCode);
  const join = autoJoin ? "&join=1" : "";
  if (gameRoute && directRoomRoutes.has(gameRoute)) return `${gameRoute}/${code}`;
  if (gameRoute && chessLobbyRoute.test(gameRoute)) return `${gameRoute}?code=${code}${join}`;
  if (game === "watten") return `/games/watten/multiplayer?code=${code}${join}`;
  return `/games/chess/classic/multiplayer?code=${code}${join}`;
}

/** English label for the invited game; pass the parts through `ui()` when rendering. */
export function getInviteGameLabel({ game, gameRoute }: Omit<Invite, "gameCode">) {
  if (gameRoute === "/games/eat-it/multiplayer") return "Eat It";
  if (gameRoute === "/games/atlas-arena/multiplayer") return "Atlas Arena";
  if (game === "watten") return "Watten";
  if (gameRoute === "/games/chess/ranked") return "Ranked Chess";
  if (gameRoute?.includes("/variants/")) return variants.find(variant => variant.multiplayerRoute === gameRoute)?.title ?? "Chess variant";
  return "Classic Chess";
}
