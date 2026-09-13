import type { WattenCard } from "./watten";
import type { CardTheme } from "../context/CardThemeContext";

const suitToFile = {
  Herz: "herz",
  Schellen: "schellen",
  Gras: "gras",
  Eichel: "eichel",
} as const;

const rankToFile = {
  Ass: "ace",
  König: "king",
  Ober: "ober",
  Unter: "unter",
  "10": "10",
  "9": "9",
  "8": "8",
  "7": "7",
} as const;

type CardImageData = Pick<WattenCard, "suit" | "rank">;

export function getWattenCardImage(
  card: CardImageData,
  theme: CardTheme,
) {
  const suit = suitToFile[card.suit];
  const rank = rankToFile[card.rank];

  return `/images/${theme}/${suit}-${rank}.png`;
}