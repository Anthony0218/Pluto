import { learningPaths, learningSubjects } from "@/data/learningCatalog";
import { toolApps } from "@/data/toolCatalog";

/** What the shared header shows after the Pluto mark: "Pluto : Name  Mode · detail". */
export type PageBrand = { name: string; accent: string; surface?: string; mode?: string };

const games: Array<[prefix: string, brand: Omit<PageBrand, "mode">]> = [
  ["/games/atlas-arena", { name: "Atlas Arena", accent: "#38bdf8", surface: "#101b2c" }],
  ["/games/eat-it", { name: "Eat It", accent: "#fb923c" }],
  ["/games/go", { name: "Go", accent: "#d4d4d8", surface: "#0b0e11" }],
  ["/games/schafkopf", { name: "Schafkopf", accent: "#fbbf24", surface: "#141518" }],
  ["/games/watten", { name: "Watten", accent: "#34d399", surface: "#173d2e" }],
  ["/games/medieval-kingdoms", { name: "Medieval Kingdoms", accent: "#fbbf24", surface: "#211a10" }],
  ["/games/natura", { name: "Natura", accent: "#2dd4bf", surface: "#193b3b" }],
  ["/games/pluto-party", { name: "Pluto Party", accent: "#e879f9" }],
];

const pages: Array<[path: string, name: string]> = [
  ["/games", "Games"], ["/profile", "Profile"], ["/friends", "Friends"], ["/clans", "Clans"],
  ["/leaderboards", "Leaderboards"], ["/learn", "Learn"], ["/tools", "Tools"], ["/credits", "Credits"], ["/imprint", "Imprint"],
];

const onPath = (pathname: string, prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);

/** The play mode a game URL belongs to. */
function gameMode(pathname: string) {
  const segments = pathname.split("/");
  if (segments.includes("rules")) return "Rules";
  if (segments.includes("hotseat")) return "Hotseat";
  if (segments.includes("ai") || segments.includes("singleplayer")) return "Singleplayer";
  if (segments.includes("multiplayer")) return "Multiplayer";
  if (segments.includes("campaign")) return "Campaign";
  if (segments.includes("battle")) return "Battle";
  return undefined;
}

export function pageBrand(pathname: string): PageBrand | undefined {
  const [, area, subjectId, pathId] = pathname.split("/");
  if (area === "tools") {
    const tool = toolApps.find(item => item.id === subjectId);
    if (tool) return { name: tool.title, accent: tool.accent };
  }
  if (area === "learn") {
    const subject = learningSubjects.find(item => item.id === subjectId);
    const path = learningPaths.find(item => item.subjectId === subjectId && item.id === pathId);
    if (subject) return { name: subject.title, accent: subject.accent, mode: path?.title };
  }
  const game = games.find(([prefix]) => onPath(pathname, prefix));
  if (game) return { ...game[1], mode: gameMode(pathname) };
  const page = pages.find(([path]) => onPath(pathname, path));
  return page ? { name: page[1], accent: "#a5b4fc" } : undefined;
}
