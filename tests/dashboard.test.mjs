import test from "node:test";
import assert from "node:assert/strict";
import { defaultFavoriteRoutes, favoriteLimit, normalizeFavorites, reorderFavorites, discoverySlides } from "../src/data/dashboard.ts";
import { games } from "../src/data/games.ts";

test("first-time favorites resolve to existing games in the requested order", () => {
  assert.deepEqual(defaultFavoriteRoutes.slice(0, 3), ["/games/chess", "/games/watten", "/games/schafkopf"]);
  assert.ok(defaultFavoriteRoutes.length <= favoriteLimit);
  for (const route of defaultFavoriteRoutes) assert.ok(games.some(game => game.route === route));
});
test("preferences distinguish a deliberately empty selection from invalid or missing data", () => {
  assert.deepEqual(normalizeFavorites([]), []);
  assert.equal(normalizeFavorites(null), null);
  assert.equal(normalizeFavorites({ routes: defaultFavoriteRoutes }), null);
  assert.equal(normalizeFavorites([42]), null);
});
test("stale preferences remove unavailable games and duplicates without changing order", () => {
  assert.deepEqual(normalizeFavorites(["/removed", defaultFavoriteRoutes[2], defaultFavoriteRoutes[0], defaultFavoriteRoutes[2]]), [defaultFavoriteRoutes[2], defaultFavoriteRoutes[0]]);
  assert.equal(normalizeFavorites(games.map(game => game.route)).length, favoriteLimit);
});
test("reordering supports moving in both directions and preserves all selected games", () => {
  const routes = defaultFavoriteRoutes.slice(0, 3);
  const [chess, watten, schafkopf] = routes;
  assert.deepEqual(reorderFavorites(routes, new Set([schafkopf]), chess, "before"), [schafkopf, chess, watten]);
  assert.deepEqual(reorderFavorites(routes, new Set([chess]), schafkopf, "after"), [watten, schafkopf, chess]);
  assert.deepEqual(reorderFavorites(routes, new Set([chess, watten]), schafkopf, "after"), [schafkopf, chess, watten]);
  assert.deepEqual(routes, [chess, watten, schafkopf]);
});
test("dropping on itself or on a missing target is a no-op", () => {
  assert.deepEqual(reorderFavorites(defaultFavoriteRoutes, new Set([defaultFavoriteRoutes[0]]), defaultFavoriteRoutes[0], "after"), defaultFavoriteRoutes);
  assert.deepEqual(reorderFavorites(defaultFavoriteRoutes, new Set([defaultFavoriteRoutes[0]]), "/removed", "before"), defaultFavoriteRoutes);
});
test("discovery slides reuse catalog artwork", () => {
  for (const slide of discoverySlides) assert.ok(games.some(game => game.route === slide.gameRoute && game.image));
});
