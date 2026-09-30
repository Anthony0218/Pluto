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
    title: "Pluto Party",
    subtitle: "Good friends. Questionable decisions.",
    description: "Explore six tropical islands in a four-player board adventure with branching paths, friends and bots.",
    image: "/images/pluto-party.svg",
    route: "/games/pluto-party",
    tag: "Party",
    features: ["4 players", "Friends & bots", "60 spaces"],
    finished: false,
  },
  {
    title: "Eat It",
    subtitle: "Small circle. Big appetite.",
    description: "Eat, grow, and be the last circle standing in colorful City and Nature arenas.",
    image: "/images/eat-it.svg",
    route: "/games/eat-it",
    tag: "Arcade",
    features: ["2–8 players", "Friends & bots", "Two worlds"],
    finished: false,
  },
  {
    title: "Atlas Arena",
    subtitle: "The world is your board",
    description:
      "Master countries, capitals, flags and geographic facts on an interactive world map.",
    image: "/images/atlas-arena.svg",
    route: "/games/atlas-arena",
    tag: "Geography",
    features: ["Map Click", "Speed Run", "Map Fill"],
    finished: false,
  },
  {
    title: "Go",
    subtitle: "Ancient territory strategy",
    description:
      "Claim territory and capture groups on 9×9, 13×13, or 19×19 boards — locally, against AI, or online.",
    image: "/images/go-home.svg",
    route: "/games/go",
    tag: "Strategy",
    features: ["Vs Bot", "Hotseat", "Multiplayer"],
    finished: false,
  },
  {
    title: "Schafkopf",
    subtitle: "Bayerisches Partnerspiel",
    description:
      "Rufspiel, Wenz und Solo mit verbindlichem Zugeben – im Hotseat, gegen KI oder online zu viert.",
    image: "/images/watten-home.png",
    route: "/games/schafkopf",
    tag: "Kartenspiel",
    features: ["Hotseat", "Gegen KI", "Multiplayer"],
    finished: false,
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
    finished: false,
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
