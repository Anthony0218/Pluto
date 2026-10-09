import { INVITE_GAMES } from "./gameCreationCatalog";

/** Friend and clan invitations offer the same casual rooms. Card Builder games are shared from their own room, not from here. */
const games = INVITE_GAMES.filter(game => game.modes.length && game.id !== "card-builder");
export function useInviteGames() {
  return { games };
}
