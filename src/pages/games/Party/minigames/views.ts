import type { ComponentType } from "react";
import type {
  Match,
  MinigameInput,
  MinigameRuntime,
} from "../../../../games/party/types.ts";
import PaddlePanicScreen from "./PaddlePanicScreen.tsx";
import StreetCrossScreen from "./StreetCrossScreen.tsx";
import TargetPanicScreen from "./TargetPanicScreen.tsx";
import ArrowMemoryScreen from "./ArrowMemoryScreen.tsx";
import PickupArenaScreen from "./PickupArenaScreen.tsx";
import PatternWallScreen from "./PatternWallScreen.tsx";
import TrailRunScreen from "./TrailRunScreen.tsx";
import RhythmScreen from "./RhythmScreen.tsx";
import CircleShotScreen from "./CircleShotScreen.tsx";
import LavaKnockbackScreen from "./LavaKnockbackScreen.tsx";

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
    "arrow-memory": ArrowMemoryScreen,
    "pickup-arena": PickupArenaScreen,
    "pattern-wall": PatternWallScreen,
    "trail-run": TrailRunScreen,
    "rhythm-rush": RhythmScreen,
    "circle-shot": CircleShotScreen,
    "lava-knockback": LavaKnockbackScreen,
  };
