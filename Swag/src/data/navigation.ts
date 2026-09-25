import { games } from "./games";

export const learningResources = [
  {
    title: "Chess rules",
    description: "Learn the board, pieces and legal moves.",
    route: "/games/chess/rules",
  },
  {
    title: "Watten rules",
    description: "Discover the cards, scoring and strategy.",
    route: "/games/watten/rules",
  },
  {
    title: "Chess variants",
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
      ...learningResources,
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
