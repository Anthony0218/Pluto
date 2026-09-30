import { MinigameRegistry } from "./registry.ts";
import { paddlePanic } from "./paddlePanic/index.ts";
import { streetCross } from "./streetCross/index.ts";
import { targetPanic } from "./targetPanic/index.ts";

// Central minigame pool. Adding a minigame means registering its definition here; the match flow
// picks from `minigameRegistry.pool("main")` after each round and from `pool("duel")` for Duel Saber
// duels, and never needs to change.
export const minigameRegistry = new MinigameRegistry();
minigameRegistry.register(targetPanic);
minigameRegistry.register(paddlePanic);
minigameRegistry.register(streetCross);
