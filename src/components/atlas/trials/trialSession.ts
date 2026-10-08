import { createContext, useContext } from "react";

/**
 * Lets a Trials game run inside a hotseat turn or an online race without changing the game itself:
 * the shell shows whose turn it is and reports the live score, and the game-over panel offers `finish`
 * (next player, standings…) instead of "Play again".
 */
export type TrialSession = {
  player?: { name: string; color: string };
  onScore?: (score: number) => void;
  onComplete?: (score: number) => void;
  finish?: { label: string; onClick: () => void };
};
export const TrialSessionContext = createContext<TrialSession | null>(null);
export const useTrialSession = () => useContext(TrialSessionContext);
