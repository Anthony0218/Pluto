import type { ComponentType } from "react";
import type {
  Match,
  MinigameInput,
  MinigameRuntime,
} from "../../../../games/party/types.ts";
import PaddlePanicScreen from "./PaddlePanicScreen.tsx";
import StreetCrossScreen from "./StreetCrossScreen.tsx";
import TargetPanicScreen from "./TargetPanicScreen.tsx";

export interface MinigameViewProps {
  match: Match;
  minigame: MinigameRuntime;
  playerId: string;
  now: number;
  online: boolean;
  sendInput: (input: MinigameInput) => void;
}
// Client presentation registry, parallel to the shared rule registry (which must stay React-free because
// the server imports it). A later arena minigame can register a Pixi/Phaser-backed component here.
export const minigameViews: Record<string, ComponentType<MinigameViewProps>> =
  {
    "target-panic": TargetPanicScreen,
    "paddle-panic": PaddlePanicScreen,
    "street-cross": StreetCrossScreen,
  };
