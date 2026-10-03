import { games } from "@/data/games";

export type PlanetConfig = {
  id: string;
  label: string;
  route: string;
  symbol: string;
  tone: string;
  position: string;
  primary?: boolean;
  ring?: boolean;
};

const sceneGames = [
  { route: "/games/atlas-arena", symbol: "◈", tone: "atlas", position: "atlas", ring: true },
  { route: "/games/go", symbol: "●", tone: "go", position: "go", ring: true },
  { route: "/games/schafkopf", symbol: "♣", tone: "schafkopf", position: "schafkopf", ring: true, primary: true },
  { route: "/games/chess", symbol: "♘", tone: "chess", position: "chess", ring: true, primary: true },
  { route: "/games/watten", symbol: "♦", tone: "watten", position: "watten", ring: true, primary: true },
  { route: "/games/natura", symbol: "✿", tone: "natura", position: "natura", ring: true },
  { route: "/games/eat-it", symbol: "◕", tone: "eat-it", position: "eat-it", ring: true },
] as const;

export const planets: PlanetConfig[] = sceneGames.map(scene => ({
  ...scene,
  id: scene.route,
  label: games.find(game => game.route === scene.route)?.title ?? scene.route,
}));
