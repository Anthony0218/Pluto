import { learningPaths, learningSubjects } from "@/data/learningCatalog";
import { planets, type PlanetConfig } from "../planetary/planetConfig";
import { landingTools, universeBooks, type UniverseBook, type UniverseCategory } from "../planetary/universeCatalog";
import type { CopyKey } from "./copy";

export type FlybyKind = "planet" | "tile" | "book";
export type FlybyItem = {
  /** Matches the hero object's `data-flyby-id`, so the flyby can start from where the hero object is. */
  id: string;
  kind: FlybyKind;
  title: string;
  route: string;
  /** Resting position in % of the stage, and how close to the camera the object is (more = flies past faster). */
  x: number;
  y: number;
  depth: number;
  planet?: PlanetConfig;
  tool?: (typeof landingTools)[number];
  book?: (typeof universeBooks)[number];
};
export type FlybyScene = {
  items: FlybyItem[];
  /** The object the camera arrives at. */
  center: FlybyItem;
  pick: CopyKey;
  /** Either a translated landing line or an English catalog sentence to run through `ui()`. */
  line: { key: CopyKey } | { text: string };
  cta: CopyKey;
};

const planetSpots: Record<string, [x: number, y: number, depth: number]> = {
  "/games/atlas-arena": [22, 27, 1],
  "/games/go": [76, 24, 0.7],
  "/games/schafkopf": [13, 66, 1.5],
  "/games/watten": [87, 63, 1.25],
  "/games/natura": [33, 82, 0.8],
  "/games/eat-it": [66, 83, 1.05],
};
const sideSpots: [number, number, number][] = [[18, 30, 1.1], [82, 28, 0.8], [72, 80, 1.2], [26, 80, 0.9], [90, 56, 1.4]];
/** Every tool flies past, so the tiles are spread around the stage clear of the title above and the arrival in the middle. */
const toolSpots: [number, number, number][] = [
  [10, 26, 1.2], [28, 18, 0.9], [72, 18, 0.9], [90, 26, 1.2],
  [14, 46, 1.4], [86, 46, 1.4],
  [34, 64, 0.75], [66, 62, 0.75],
  [10, 70, 1.2], [28, 84, 0.9], [72, 84, 0.9], [90, 70, 1.2],
];

const planetItem = (config: PlanetConfig, spot: [number, number, number] = [50, 46, 0]): FlybyItem => ({ id: config.id, kind: "planet", title: config.label, route: config.route, x: spot[0], y: spot[1], depth: spot[2], planet: config });
const toolItem = (tool: (typeof landingTools)[number], spot: [number, number, number] = [50, 46, 0]): FlybyItem => ({ id: tool.id, kind: "tile", title: tool.title, route: tool.route, x: spot[0], y: spot[1], depth: spot[2], tool });
const bookItem = (book: (typeof universeBooks)[number], spot: [number, number, number] = [50, 46, 0]): FlybyItem => ({ id: book.id, kind: "book", title: book.title, route: book.route, x: spot[0], y: spot[1], depth: spot[2], book });

export function bookDescription(id: string) {
  return learningPaths.find(path => path.id === id)?.description ?? learningSubjects.find(subject => subject.id === id)?.description ?? "";
}

/** What is inside a book: a shelf lists its books, a course its topics, and a plain subject its one resource. */
export function bookTopics(book: Pick<UniverseBook, "id" | "books">) {
  if (book.books) return book.books.map(item => item.title);
  return learningPaths.find(path => path.id === book.id)?.topics ?? [learningSubjects.find(subject => subject.id === book.id)?.resourceLabel ?? ""];
}

export function flybyScene(category: UniverseCategory): FlybyScene {
  if (category === "tools") {
    const [center, ...rest] = landingTools;
    return { items: rest.map((tool, index) => toolItem(tool, toolSpots[index % toolSpots.length])), center: toolItem(center), pick: "pickTool", line: { text: center.description }, cta: "openTool" };
  }
  if (category === "learn") {
    const [center, ...rest] = universeBooks;
    return { items: rest.map((book, index) => bookItem(book, sideSpots[index])), center: bookItem(center), pick: "pickBook", line: { text: bookDescription(center.id) }, cta: "openBook" };
  }
  const chess = planets.find(planet => planet.route === "/games/chess")!;
  return {
    items: planets.flatMap(planet => planetSpots[planet.route] ? [planetItem(planet, planetSpots[planet.route])] : []),
    center: planetItem(chess),
    pick: "pickWorld",
    line: { key: "chessLine" },
    cta: "playChess",
  };
}
