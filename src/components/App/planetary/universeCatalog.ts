import { learningPaths, pathRoute } from "@/data/learningCatalog";
import { toolApps, toolRoute } from "@/data/toolCatalog";
import { planets } from "./planetConfig";

export type UniverseCategory = "games" | "tools" | "learn";
export type BookDesign = "math" | "percentages" | "guides" | "analysis" | "algebra" | "calculus" | "linear" | "depth" | "chance" | "pitch" | "rhythm" | "rules" | "tactics";
export type UniverseBook = { id: string; title: string; route: string; design: BookDesign };

// Editorial selections for the landing page only. Tool titles, routes and
// availability come from the app catalog; lesson bodies aren't needed here.
const featuredToolIds = ["percentage-calculator", "number-system-converter", "unit-converter", "recipe-scaler"];
export const universeTools = featuredToolIds.flatMap(id => {
  const tool = toolApps.find(app => app.id === id && app.status === "available");
  return tool ? [{ ...tool, route: toolRoute(tool.id) }] : [];
});

export const universeBooks: UniverseBook[] = [
  { id: "foundations", title: "Math foundations", route: "/learn/math/foundations", design: "math" },
  { id: "percentages", title: "Everyday percentages", route: "/learn/math/percentages", design: "percentages" },
  { id: "game-guides", title: "Game guides", route: "/learn/game-guides", design: "guides" },
  { id: "game-analysis", title: "Game Analysis", route: "/learn/game-analysis", design: "analysis" },
];

/**
 * The flyby shows the editorial picks above. The hero and landing sections give every available tool and every
 * learning path its own stop: the picks first (the flyby hands over to the first of them), then the rest in catalog order.
 */
export const landingTools = [...universeTools, ...toolApps.flatMap(tool => tool.status === "available" && !universeTools.some(featured => featured.id === tool.id) ? [{ ...tool, route: toolRoute(tool.id) }] : [])];

const pathDesigns: Record<string, BookDesign> = {
  "algebra-functions": "algebra", calculus: "calculus", "linear-algebra": "linear", analysis: "depth", "probability-statistics": "chance",
  "reading-pitches": "pitch", "reading-rhythm": "rhythm", rules: "rules", "positions-tactics": "tactics",
};
export const landingBooks: UniverseBook[] = [
  ...universeBooks,
  ...learningPaths.flatMap(path => pathDesigns[path.id] && !universeBooks.some(featured => featured.id === path.id) ? [{ id: path.id, title: path.title, route: pathRoute(path), design: pathDesigns[path.id] }] : []),
];

export const universeCategories = [
  { id: "games", label: "Games", action: "Explore games", browse: "All games", route: "/games", count: planets.length },
  { id: "tools", label: "Tools", action: "Explore tools", browse: "All apps", route: "/tools", count: landingTools.length },
  { id: "learn", label: "Learn", action: "Start learning", browse: "All subjects", route: "/learn", count: landingBooks.length },
] satisfies { id: UniverseCategory; label: string; action: string; browse: string; route: string; count: number }[];
