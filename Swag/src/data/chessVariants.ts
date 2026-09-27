export type VariantCard = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  tags: string[];
  route?: string;
  rulesRoute?: string;
  available: boolean;
  accent:
    | "red"
    | "violet"
    | "amber"
    | "rose"
    | "sky"
    | "emerald"
    | "zinc"
    | "orange"
    | "cyan"
    | "fuchsia"
    | "indigo"
    | "lime"
    | "pink"
    | "teal"
    | "blue";
  aiRoute?: string;
  multiplayerRoute?: string;
};

export const variants: VariantCard[] = [
  {
    id: "complete-chaos",
    icon: "🌀",
    title: "Total Chaos Chess",
    subtitle: "Nothing starts where it should",
    description:
      "All 32 standard pieces are scattered across the board into a playable random position. Understand the chaos before your opponent does.",
    tags: ["Full-board setup", "Random geometry", "No opening theory"],
    available: true,
    route: "/games/chess/variants/complete-chaos/hotseat",
    aiRoute: "/games/chess/variants/complete-chaos/ai",
    rulesRoute: "/games/chess/variants/complete-chaos/rules",
    accent: "pink",
    multiplayerRoute: "/games/chess/variants/complete-chaos/multiplayer",
  },
  {
    id: "draft",
    icon: "⚔",
    title: "Draft Chess",
    subtitle: "Build your own army",
    description:
      "Spend a point budget on your starting army. The king must remain on the back rank.",
    tags: ["Budget", "Custom army", "Back-rank king"],
    available: true,
    route: "/games/chess/variants/draft/hotseat",
    aiRoute: "/games/chess/variants/draft/ai",
    rulesRoute: "/games/chess/variants/draft/rules",
    accent: "emerald",
    multiplayerRoute: "/games/chess/variants/draft/multiplayer",
  },
  {
    id: "mirror",
    icon: "◈",
    title: "Mirror Chess",
    subtitle: "Custom but symmetrical",
    description:
      "Create a custom legal formation and mirror it for the opponent so both sides begin symmetrically.",
    tags: ["Custom setup", "Symmetry", "Fair start"],
    available: true,
    route: "/games/chess/variants/mirror/hotseat",
    aiRoute: "/games/chess/variants/mirror/ai",
    rulesRoute: "/games/chess/variants/mirror/rules",
    accent: "zinc",
    multiplayerRoute: "/games/chess/variants/mirror/multiplayer",
  },

  {
    id: "fog-of-war",
    icon: "🌫",
    title: "Fog of War Chess",
    subtitle: "You cannot see everything",
    description:
      "Limited vision combines with randomized legal starting positions to create hidden-information chess.",
    tags: ["Fog of war", "Random start", "Hidden information"],
    available: true,
    route: "/games/chess/variants/fogofwar/hotseat",
    aiRoute: "/games/chess/variants/fogofwar/ai",
    rulesRoute: "/games/chess/variants/fogofwar/rules",
    multiplayerRoute: "/games/chess/variants/fog-of-war/multiplayer",
    accent: "sky",
  },
  {
    id: "tectonic",
    icon: "↻",
    title: "Tectonic Chess",
    subtitle: "Move pieces. Then move the board.",
    description:
      "Every four normal plies, a player can rotate one 4×4 quadrant and reshape the geometry of the entire position.",
    tags: ["4×4 Rotation", "Board Shift", "Strategy"],
    available: true,
    route: "/games/chess/variants/tectonic/hotseat",
    aiRoute: "/games/chess/variants/tectonic/ai",
    rulesRoute: "/games/chess/variants/tectonic/rules",
    accent: "teal",
    multiplayerRoute: "/games/chess/variants/tectonic/multiplayer",
  },
  {
    id: "roulette",
    icon: "🎰",
    title: "Chess Roulette",
    subtitle: "Every Lucky Square is a gamble",
    description:
      "Visible Lucky Squares can destroy, teleport, swap or transform the piece that lands on them.",
    tags: ["Lucky Squares", "Random effects", "Transformations"],
    available: true,
    route: "/games/chess/variants/roulette/hotseat",
    aiRoute: "/games/chess/variants/roulette/ai",
    rulesRoute: "/games/chess/variants/roulette/rules",
    accent: "fuchsia",
    multiplayerRoute: "/games/chess/variants/roulette/multiplayer",
  },

  {
    id: "four-player",
    icon: "✣",
    title: "Four Player Chess",
    subtitle: "Four armies. One battlefield.",
    description:
      "Four players fight around a cross-shaped board. Checkmate eliminates a player; the last army standing wins.",
    tags: ["4 Players", "Free-for-all", "Elimination"],
    available: true,
    route: "/games/chess/variants/4-players/hotseat",
    aiRoute: "/games/chess/variants/4-players/ai",
    accent: "cyan",
    multiplayerRoute: "/games/chess/variants/4-players/multiplayer",
  },

  {
    id: "hotpotato",
    icon: "💣",
    title: "Hot Potato Chess",
    subtitle: "The bomb always belongs to someone",
    description:
      "A random non-king piece carries a ticking bomb. Move it, pass it by capture, or escape before the 3×3 blast.",
    tags: ["Bomb carrier", "4–12 fuse", "Explosions"],
    available: true,
    route: "/games/chess/variants/hotpotato/hotseat",
    aiRoute: "/games/chess/variants/hotpotato/ai",
    rulesRoute: "/games/chess/variants/hotpotato/rules",
    multiplayerRoute: "/games/chess/variants/hot-potato/multiplayer",
    accent: "orange",
  },
  {
    id: "collapse",
    icon: "⚠",
    title: "Chess Collapse",
    subtitle: "The board is disappearing",
    description:
      "Warned outer edges collapse permanently while both Kings race toward the surviving central battlefield.",
    tags: ["Shrinking board", "3 King lives", "Survival"],
    available: true,
    route: "/games/chess/variants/collapse/hotseat",
    aiRoute: "/games/chess/variants/collapse/ai",
    rulesRoute: "/games/chess/variants/collapse/rules",
    multiplayerRoute: "/games/chess/variants/collapse/multiplayer",
    accent: "red",
  },
  {
    id: "mutation",
    icon: "🧬",
    title: "Mutation Chess",
    subtitle: "The board changes itself",
    description:
      "Every ten plies, a random non-king piece mutates into another piece.",
    tags: ["Random events", "Mutations", "Hotseat"],
    route: "/games/chess/variants/mutation/hotseat",
    aiRoute: "/games/chess/variants/mutation/ai",
    available: true,
    accent: "violet",
    multiplayerRoute: "/games/chess/variants/mutation/multiplayer",
  },
  {
    id: "boss",
    icon: "♚",
    title: "Boss Battle Chess",
    subtitle: "White plays chess. Black plays the boss.",
    description:
      "A full White army faces a reduced Black force led by a 5-HP Boss King with powers, armor and Rage.",
    tags: ["Asymmetric", "Boss Powers", "Rage"],
    available: true,
    route: "/games/chess/variants/boss/hotseat",
    aiRoute: "/games/chess/variants/boss/ai",
    rulesRoute: "/games/chess/variants/boss/rules",
    accent: "indigo",
    multiplayerRoute: "/games/chess/variants/boss/multiplayer",
  },

  {
    id: "capitalism",
    icon: "🪙",
    title: "Chess Market",
    subtitle: "Every move has a price",
    description:
      "Earn coins through captures, checks, missions and bounties, then spend them on limited Royal Powers.",
    tags: ["Economy", "Bounties", "Missions", "Royal Powers", "Hotseat"],
    route: "/games/chess/variants/capitalism/hotseat",
    aiRoute: "/games/chess/variants/capitalism/ai",
    rulesRoute: "/games/chess/variants/capitalism/rules",
    available: true,
    accent: "amber",
    multiplayerRoute: "/games/chess/variants/capitalism/multiplayer",
  },
  {
    id: "3d-chess",
    icon: "🧊",
    title: "3D Chess",
    subtitle: "Think beyond one board",
    description:
      "A future chess variant played across multiple vertical layers, where pieces can attack, defend and move through three-dimensional space.",
    tags: ["3D Board", "Multiple Layers", "Future"],
    route: "/games/chess/3dchess",

    available: true,
    accent: "blue",
  },
  {
    id: "king-of-the-hill",
    icon: "⛰️",
    title: "King of the Hill",
    subtitle: "be dominant!",
    description:
      "spannende Schachvariante, bei der man neben dem klassischen Schachmatt auch gewinnt, indem man seinen König in die Mitte des Brettes zieht.",
    tags: ["fight", "till", "end"],
    available: false,
    route: "/games/chess/variants/kingofthehill/hotseat",
    aiRoute: "/games/chess/variants/kingofthehill/ai",
    multiplayerRoute: "/games/chess/variants/kingofthehill/multiplayer",
    accent: "amber",
  },
  {
    id: "randomstart",
    icon: "🎲",
    title: "Random Start Chess",
    subtitle: "Forget your opening book",
    description:
      "White and Black receive independently shuffled back ranks, creating a different non-mirrored opening every game.",
    tags: ["Random setup", "Asymmetric start", "No castling"],
    available: false,
    route: "/games/chess/variants/randomstart/hotseat",
    aiRoute: "/games/chess/variants/randomstart/ai",
    multiplayerRoute: "/games/chess/variants/randomstart/multiplayer",
    accent: "lime",
  },
  {
    id: "three-lives",
    icon: "♥",
    title: "Three Lives Chess",
    subtitle: "Every check hurts",
    description:
      "Both players start with three lives. Every check removes one life; checkmate still wins instantly.",
    tags: ["3 HP", "Check damage", "Hotseat"],
    route: "/games/chess/variants/three-lives/hotseat",
    aiRoute: "/games/chess/variants/three-lives/ai",
    available: false,
    accent: "red",
    multiplayerRoute: "/games/chess/variants/three-lives/multiplayer",
  },
  {
    id: "horror",
    icon: "☠",
    title: "Horror Chess",
    subtitle: "The board is dangerous",
    description:
      "Infection, cursed pieces, burning squares and knight-triggered freezing turn the board into a survival game.",
    tags: ["Infection", "Curses", "Hot squares", "Knight freeze"],
    route: "/games/chess/variants/horror/hotseat",
    aiRoute: "/games/chess/variants/horror/ai",
    rulesRoute: "/games/chess/variants/horror/rules",
    available: false,
    accent: "rose",
    multiplayerRoute: "/games/chess/variants/horror/multiplayer",
  },
];
