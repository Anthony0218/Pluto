import type { Game } from "@/pages/general/DashboardPage";

export const games: Game[] = [
  {
    title: "Schafkopf",
    subtitle: "Bayerisches Partnerspiel",
    description:
      "Rufspiel, Wenz und Solo mit verbindlichem Zugeben – im Hotseat, gegen KI oder online zu viert.",
    image: "/images/watten-home.png",
    route: "/games/schafkopf",
    tag: "Kartenspiel",
    features: ["Hotseat", "Gegen KI", "Multiplayer"],
    finished: true,
  },
  {
    title: "Schach",
    subtitle: "Klassische Strategie",
    description:
      "Spiele Schach, tritt gegen Stockfish an, analysiere Stellungen und werte deine Partien aus.",
    image: "/images/chess-home.png",
    route: "/games/chess",
    tag: "Strategie",
    features: ["Einzelspieler", "Stockfish", "Analyse"],
    finished: true,
  },
  {
    title: "Watten",
    subtitle: "Traditionelles Kartenspiel",
    description:
      "Spiele Watten mit taktischen Hinweisen, Punktewertung und einer einsteigerfreundlichen Hilfe.",
    image: "/images/watten-home.png",
    route: "/games/watten",
    tag: "Kartenspiel",
    features: ["3 Spieler", "Hilfemodus", "Punktewertung"],
    finished: true,
  },

  {
    title: "Schach 3D",
    subtitle: "Schach in einer neuen Dimension",
    description:
      "Erlebe klassisches Schach auf einem animierten 3D-Brett – lokal im Hotseat oder gegen Stockfish mit mehreren Schwierigkeitsstufen.",
    image: "/images/chess3d.png",
    route: "/games/chess/3dchess",
    tag: "Strategie · 3D",
    features: ["3D-Brett", "Hotseat", "Stockfish AI"],
    finished: true,
  },
  {
    title: "Medieval Kingdoms",
    subtitle: "Rundenbasierte Strategie",
    description:
      "Führe dein mittelalterliches Königreich, plane deine Züge und kämpfe in rundenbasierten Schlachten um die Vorherrschaft.",
    image: "/images/medieval-kingdoms.png",
    route: "/games/medieval-kingdoms",
    tag: "Strategie",
    features: ["Rundenbasiert", "Taktik", "Mittelalter"],
    finished: false,
  },
];
export const gameList = [
  {
    name: "Schafkopf",
    description:
      "Rufspiel, Wenz und Solo – lokal, gegen KI oder online. Mit verpflichtendem Zugeben.",
    route: "/games/schafkopf",
    category: "Kartenspiel",
    image: "/images/watten-game-icon.png",
    finished: true,
  },
  {
    name: "Schach",
    description:
      "Klassisches Schach gegen Freunde, lokal oder gegen Stockfish.",
    route: "/games/chess",
    category: "Strategie",
    image: "/images/chess-game-icon.png",
    finished: true,
  },

  {
    name: "Watten",
    description: "Das traditionelle bayerische Kartenspiel.",
    route: "/games/watten",
    category: "Kartenspiel",
    image: "/images/watten-game-icon.png",
    finished: true,
  },

  {
    name: "Schach 3D",
    description:
      "Klassisches Schach als interaktives 3D-Erlebnis – lokal im Hotseat oder gegen Stockfish.",
    route: "/games/chess/3dchess",
    category: "Strategie · 3D",
    image: "/images/chess3d-icon.png",
    finished: true,
  },
  {
    name: "Medieval Kingdoms",
    description: "A turn based strategy game in medieval style.",
    route: "/games/medieval-kingdoms",
    category: "Strategie",
    image: "/images/medieval-kingdoms-icon.png",
    finished: false,
  },
];
