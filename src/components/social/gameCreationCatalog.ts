import { MAPS } from "@/games/eat-it/mapCatalog";
import { games } from "@/data/games";
import { variants } from "@/data/chessVariants";
import { ARENA_MODES } from "@/games/atlas/modeCatalog";
import { PRESETS } from "@/games/chess/custom/engine/presets";
import { mapRegistry } from "@/games/party/content/maps";
export type InviteMode = { id: string; label: string; route: string; inviteRoute?: string };
export type InviteGame = { id: string; title: string; image: string; modes: InviteMode[] };
const option = (id: string, label: string, route: string, inviteRoute?: string): InviteMode => ({ id, label, route, inviteRoute });
// The available flag describes menu completion; unfinished variants with working rooms remain inviteable.
// King of the Hill has no registered multiplayer page yet.
export const INVITE_GAMES: InviteGame[] = games.map(game => {
  const id = game.route.split("/").at(-1)!;
  let modes: InviteMode[] = [];
  if (id === "chess") modes = [option("classic", "Classic Chess", "/games/chess/classic/multiplayer"), ...variants.filter(v => v.multiplayerRoute && v.id !== "king-of-the-hill").map(v => option(v.id, v.title, v.multiplayerRoute!)),
    ...PRESETS.filter(p => p.id !== "sandbox" && p.id !== "3d-sandbox").map(p => option(`custom-${p.id}`, `Custom · ${p.name}`, `/chess-custom/play/multiplayer?preset=${p.id}`, "/chess-custom/play/multiplayer")),
    option("custom", "Custom · your current variant", "/chess-custom/play/multiplayer")];
  if (id === "atlas-arena") modes = [...[1, 3, 5].map(count => option(`random-${count}`, `Random modes · Best of ${count}`, `/games/atlas-arena/multiplayer?random=1&bestOf=${count}`, "/games/atlas-arena/multiplayer")),
    ...ARENA_MODES.map(m => option(m.id, m.title, `/games/atlas-arena/multiplayer?mode=${m.online}`, "/games/atlas-arena/multiplayer"))];
  if (id === "go") modes = [9, 13, 19].map(size => option(String(size), `${size} × ${size}`, `/games/go/multiplayer?boardSize=${size}`, "/games/go/multiplayer"));
  if (id === "watten") modes = [3, 4].map(size => option(String(size), `${size} players`, `/games/watten/multiplayer?variant=${size === 3 ? "three-player" : "four-player"}`, `/games/watten/multiplayer/${size}`));
  if (id === "schafkopf") modes = [option("standard", "Private table", "/games/schafkopf/multiplayer")];
  if (id === "eat-it") modes = Object.entries(MAPS).map(([id, map]) => option(id, map.name, `/games/eat-it?map=${id}`, "/games/eat-it/multiplayer"));
  if (id === "pluto-party") modes = mapRegistry.all().flatMap(map => (["plutos", "coins"] as const).map(victory => option(`${map.id}-${victory}`, `${map.name} · ${victory === "plutos" ? "Golden Plutos" : "Coins"}`, `/games/pluto-party?map=${map.id}&victory=${victory}`, "/games/pluto-party")));
  return { id, title: id === "chess" ? "Chess" : game.title, image: game.image, modes };
});
export function createInviteRoute(mode: InviteMode) {
  const [pathname, query] = mode.route.split("?");
  const params = new URLSearchParams(query);
  params.set("create", "1");
  return `${pathname}?${params}`;
}
