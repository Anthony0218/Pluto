import type { Random } from "../engine/engine.ts";
import type { BoardMap, Match } from "../types.ts";

// A Random Event field outcome. Adding an event is one registered definition; the event engine
// (`runRandomEvent`) never changes. `allowedMaps` restricts an event to specific map ids; without it the
// event is generic and may run on any map whose `eventPoolIds` lists it.
export interface EventDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  weight: number;
  allowedMaps?: readonly string[];
  // False when the event has nothing valid to do right now (e.g. no safe route to close).
  canRun(state: Match, map: BoardMap): boolean;
  execute(state: Match, context: EventContext): void;
}
export interface EventContext {
  map: BoardMap;
  random: Random;
  playerId: string;
}
