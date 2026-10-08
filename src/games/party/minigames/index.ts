import { tideTreasure } from "./festivalGames/tideTreasure.ts";
import { cometCourier } from "./festivalGames/cometCourier.ts";
import { ropeRescue } from "./festivalGames/ropeRescue.ts";
import { paddleDoubles } from "./festivalGames/paddleDoubles.ts";
import { MinigameRegistry } from "./registry.ts";
import { paddlePanic } from "./paddlePanic/index.ts";
import { streetCross } from "./streetCross/index.ts";
import { targetPanic } from "./targetPanic/index.ts";
import { arrowMemory } from "./arrowMemory/index.ts";
import { pickupArena } from "./pickupArena/index.ts";
import { patternWall } from "./patternWall/index.ts";
import { trailRun } from "./trailRun/index.ts";
import { rhythmRush } from "./rhythm/index.ts";
import { circleShot } from "./circleShot/index.ts";
import { lavaKnockback } from "./lavaKnockback/index.ts";

// Central minigame pool. Adding a minigame means registering its definition here; the match flow
// picks from `minigameRegistry.pool("main")` after each round and from `pool("duel")` for Duel Saber
// duels, and never needs to change.
export const minigameRegistry = new MinigameRegistry();
// Retain the definition for saved/reconnecting games, but never pick it for a new match.
minigameRegistry.register({ ...targetPanic, selectable: false });
minigameRegistry.register(paddlePanic);
minigameRegistry.register(streetCross);
minigameRegistry.register(arrowMemory);
minigameRegistry.register(pickupArena);
minigameRegistry.register(patternWall);
minigameRegistry.register(trailRun);
minigameRegistry.register(rhythmRush);
minigameRegistry.register(circleShot);
minigameRegistry.register(lavaKnockback);

for (const game of [tideTreasure, cometCourier, ropeRescue, paddleDoubles]) minigameRegistry.register(game);
