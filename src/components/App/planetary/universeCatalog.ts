import { learningPaths, learningSubjects, pathRoute, subjectRoute } from "@/data/learningCatalog";
import { toolApps, toolRoute } from "@/data/toolCatalog";
import { planets } from "./planetConfig";

export type UniverseCategory = "games" | "tools" | "learn";
export type BookDesign = "math" | "foundations" | "music" | "percentages" | "guides" | "analysis" | "algebra" | "calculus" | "linear" | "depth" | "chance" | "pitch" | "rhythm" | "rules" | "tactics";
/** A book with `books` is a subject shelf: opening it shows the books inside rather than leaving the page. */
export type UniverseBook = { id: string; title: string; route: string; design: BookDesign; books?: UniverseBook[] };

// Editorial selections for the landing page only. Tool titles, routes and
// availability come from the app catalog; lesson bodies aren't needed here.
const featuredToolIds = ["calculator", "percentage-calculator", "birthday-reminders", "qr-code-creator"];
export const universeTools = featuredToolIds.flatMap(id => {
  const tool = toolApps.find(app => app.id === id && app.status === "available");
  return tool ? [{ ...tool, route: toolRoute(tool.id) }] : [];
});

const pathBooks = (subjectId: string, designs: Record<string, BookDesign>): UniverseBook[] =>
  learningPaths.flatMap(path => path.subjectId === subjectId && designs[path.id] ? [{ id: path.id, title: path.title, route: pathRoute(path), design: designs[path.id] }] : []);
const subjectBook = (id: string, design: BookDesign, books?: UniverseBook[]): UniverseBook => ({ id, title: learningSubjects.find(subject => subject.id === id)!.title, route: subjectRoute(id), design, books });

/** Math and Music each gather their courses in one book; the other subjects keep a book apiece. */
const mathBook = subjectBook("math", "math", pathBooks("math", {
  foundations: "foundations", percentages: "percentages", "algebra-functions": "algebra", calculus: "calculus", "linear-algebra": "linear", analysis: "depth", "probability-statistics": "chance",
}));
const musicBook = subjectBook("music", "music", pathBooks("music", { "reading-pitches": "pitch", "reading-rhythm": "rhythm" }));

export const universeBooks: UniverseBook[] = [
  mathBook,
  musicBook,
  { id: "game-guides", title: "Game guides", route: "/learn/game-guides", design: "guides" },
  { id: "game-analysis", title: "Game Analysis", route: "/learn/game-analysis", design: "analysis" },
];

/**
 * The flyby shows the editorial picks above. The hero and landing sections give every available tool its own stop:
 * the picks first (the flyby hands over to the first of them), then the rest in catalog order.
 */
export const landingTools = [...universeTools, ...toolApps.flatMap(tool => tool.status === "available" && !universeTools.some(featured => featured.id === tool.id) ? [{ ...tool, route: toolRoute(tool.id) }] : [])];

/** The books on the shelf, in the same way: the picks first, then the football books. */
export const landingBooks: UniverseBook[] = [...universeBooks, ...pathBooks("football", { rules: "rules", "positions-tactics": "tactics" })];

export const universeCategories = [
  { id: "games", label: "Games", action: "Explore games", browse: "All games", route: "/games", count: planets.length },
  { id: "tools", label: "Tools", action: "Explore tools", browse: "All apps", route: "/tools", count: landingTools.length },
  { id: "learn", label: "Learn", action: "Start learning", browse: "All subjects", route: "/learn", count: landingBooks.length },
] satisfies { id: UniverseCategory; label: string; action: string; browse: string; route: string; count: number }[];
