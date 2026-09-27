import { games } from "./games.ts";

export const defaultFavoriteRoutes = ["/games/chess", "/games/watten", "/games/schafkopf"];
export const featuredGames = defaultFavoriteRoutes.flatMap(route => games.filter(game => game.route === route));
export const favoriteLimit = 6;
export type ChallengeCategory = "puzzle" | "learning" | "play" | "win" | "explore" | "social" | "variant";
export type DailyChallenge = {
  id?: string; category?: ChallengeCategory; title: string; description: string;
  progress: number | null; target: number; expires_at: string;
  route?: string; cta?: string; reward?: string;
};
type DiscoverySlide = { title: string; description: string; route: string; gameRoute: string };
export const discoverySlides: DiscoverySlide[] = [
  { title: "The knight can jump over other pieces.", description: "Its L-shaped move can create forks: attacks on two pieces at once.", route: "/games/chess/rules?tab=puzzles", gameRoute: "/games/chess" },
  { title: "In Watten, the strongest cards can change each round.", description: "The chosen rank and trump suit shape your hand. Learn their order before you play.", route: "/games/watten/rules", gameRoute: "/games/watten" },
  { title: "In a Rufspiel, your partner starts as a secret.", description: "The player holding the called ace is your partner. Following the cards reveals the team.", route: "/games/schafkopf?rules=open#rules", gameRoute: "/games/schafkopf" },
  { title: "A new chess variant changes the way you think.", description: "Explore unusual rules and discover a different kind of strategy.", route: "/games/chess/variants", gameRoute: "/games/chess" },
  { title: "In Go, connected stones share their liberties.", description: "Protect your groups and surround territory, one intersection at a time.", route: "/games/go/rules", gameRoute: "/games/go" },
];
export function normalizeFavorites(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(route => typeof route === "string")) return null;
  return [...new Set(value)].filter(route => games.some(game => game.route === route)).slice(0, favoriteLimit);
}
export function reorderFavorites(routes: string[], moved: Set<string>, target: string, position: "before" | "after"): string[] {
  if (moved.has(target) || !routes.includes(target)) return routes;
  const remaining = routes.filter(route => !moved.has(route));
  const index = remaining.indexOf(target) + (position === "after" ? 1 : 0);
  return [...remaining.slice(0, index), ...routes.filter(route => moved.has(route)), ...remaining.slice(index)];
}
