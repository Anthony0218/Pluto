import type { ClanDefinition, FactionId } from "./types";

export const FACTION_TURN_ORDER: FactionId[] = [
  "falconstone",
  "blackthorn",
  "emberclaw",
  "mistveil",
];

export const CLANS: ClanDefinition[] = [
  {
    id: "falconstone",
    name: "Falconstone",
    motto: "Higher Ground. Nobler Purpose.",
    lore: "A mountain realm of marble keeps, falcon riders and disciplined ranged troops.",
    corner: "top-left",
  },

  {
    id: "blackthorn",
    name: "Blackthorn",
    motto: "Every Road Has a Price.",
    lore: "Raiders and shock troops who exploit broken terrain and close pressure.",
    corner: "top-right",
  },

  {
    id: "emberclaw",
    name: "Emberclaw",
    motto: "From Ash, Dominion.",
    lore: "A southern forge-clan known for heavy soldiers, smiths and siege tactics.",
    corner: "bottom-right",
  },

  {
    id: "mistveil",
    name: "Mistveil",
    motto: "Seen Last. Struck First.",
    lore: "A secretive western clan of scouts, thieves, witches and beasts.",
    corner: "bottom-left",
  },
];
