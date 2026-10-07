import { games } from "./games";
import { learningSubjects, subjectRoute } from "./learningCatalog";
import { toolApps, toolRoute } from "./toolCatalog";

export const learningResources = [
  {
    title: "Chess Analysis",
    subjectId: "game-analysis",
    description: "Review your saved games and improve move by move.",
    route: "/games/chess/analysis",
  },
  {
    title: "Go Analysis",
    subjectId: "game-analysis",
    description: "Replay saved Go games and review key moves.",
    route: "/games/go/analysis",
  },
  {
    title: "Go Rules",
    subjectId: "game-guides",
    description: "Learn liberties, captures, ko and area scoring.",
    route: "/games/go/rules",
  },
  {
    title: "Chess Puzzles",
    subjectId: "game-guides",
    description: "Sharpen your tactics and pattern recognition.",
    route: "/games/chess/puzzles",
  },
  {
    title: "Watten rules",
    subjectId: "game-guides",
    description: "Discover the cards, scoring and strategy.",
    route: "/games/watten/rules",
  },
  {
    title: "Schafkopfen Rules",
    subjectId: "game-guides",
    description: "Learn the cards, trump order and team play.",
    route: "/games/schafkopf?rules=open#rules",
  },
  {
    title: "Chess rules",
    subjectId: "game-guides",
    description: "Learn the board, pieces and legal moves.",
    route: "/games/chess/rules",
  },
  {
    title: "Chess variants",
    subjectId: "game-guides",
    description: "Explore new ways to play chess.",
    route: "/games/chess/variants",
  },
];

export const headerSections = [
  {
    title: "Games",
    items: games.map((game) => ({
      title: game.title,
      description: game.subtitle,
      route: game.route,
    })),
  },
  {
    title: "Learn",
    items: [
      {
        title: "All learning resources",
        description: "Choose what to learn next.",
        route: "/learn",
      },
      ...learningSubjects.map(subject => ({ title: subject.title, description: subject.description, route: subjectRoute(subject.id) })),
    ],
  },
  {
    title: "Tools",
    items: [
      { title: "All apps", description: "Explore your everyday app library.", route: "/tools" },
      ...toolApps.map(tool => ({ title: tool.title, description: tool.description, route: toolRoute(tool.id) })),
    ],
  },
  {
    title: "Chess Coach",
    items: [
      {
        title: "Practice against Stockfish",
        description: "Build your skills against the chess engine.",
        route: "/games/chess/classic/ai",
      },
      {
        title: "Chess fundamentals",
        description: "Review the rules before your next game.",
        route: "/games/chess/rules",
      },
    ],
  },
  {
    title: "Community",
    items: [
      {
        title: "Friends & chat",
        description: "Find friends and share a game room.",
        route: "/friends",
      },
      {
        title: "Your profile",
        description: "Your identity, avatar and saved stats.",
        route: "/profile",
      },
    ],
  },
];
