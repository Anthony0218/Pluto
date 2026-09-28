import { games } from "@/data/games";

export type PlanetConfig = {
  id: string; label: string; route: string; description: string; symbol: string;
  radius: number; orbitRadius: number; orbitSpeed: number; rotationSpeed: number;
  color: string; emissive: string; startAngle: number;
};
const symbols: Record<string, string> = {
  "/games/eat-it": "◔",
  "/games/chess": "♞", "/games/chess/3dchess": "♜", "/games/shogi": "王",
  "/games/watten": "♦", "/games/schafkopf": "♣", "/games/go": "●",
  "/games/atlas-arena": "◈", "/games/medieval-kingdoms": "⚔", "/games/natura": "✿",
};
const colors = ["#8faaff", "#f5d99f", "#bdabf9", "#e9a9ae", "#9fd9bd", "#a4d9e7", "#d3b48e", "#c5b0e2", "#b4d5a2"];
export const planets: PlanetConfig[] = games.map((game, index) => ({
  id: game.route, label: game.title, route: game.route, description: game.subtitle,
  symbol: symbols[game.route] ?? "✦", radius: 0.34 + index % 3 * 0.045,
  orbitRadius: 2.0 + index % 3 * 0.62, orbitSpeed: (index % 2 ? -1 : 1) * (0.06 + index % 3 * 0.013),
  rotationSpeed: 0.16 + index % 4 * 0.04, color: colors[index % colors.length],
  emissive: colors[index % colors.length], startAngle: index * Math.PI * 2 / games.length,
}));
