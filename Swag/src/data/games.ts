export type Game = {
  title: string;
  subtitle: string;
  description: string;
  image: string;
  route: string;
  tag: string;
  features: string[];
  finished: boolean;
};

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
  {
    title: "Natura",
    subtitle: "Discover the natural world",
    description:
      "Explore animals and their remarkable abilities through interactive games.",
    image: "/pluto-icon.png",
    route: "/games/natura",
    tag: "Nature",
    features: ["Animals", "Discovery"],
    finished: true,
  },
];
export const gameList = games.map((game) => ({
  name: game.title,
  description: game.description,
  route: game.route,
  category: game.tag,
  image: game.image,
  finished: game.finished,
}));
