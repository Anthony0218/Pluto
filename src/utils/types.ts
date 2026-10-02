export type WattenSuit =
  | "Herz"
  | "Schellen"
  | "Eichel"
  | "Gras";


export type WattenPlayer = {
  id: string;
  name: string;
};

export type WattenGameConfig = {
  mode: WattenGameMode;
  playerCount: 3 | 4;
  targetScore: number;
};
export type WattenVariant =
  | "three-player"
  | "four-player";

export type WattenGameMode =
  | "hotseat"
  | "multiplayer";

export type WattenPlayerInfo = {
  id: string;
  name: string;
};

export type WattenGameSetup = {
  variant: WattenVariant;
  mode: WattenGameMode;
  players: WattenPlayerInfo[];
};