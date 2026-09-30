import type { Random } from "../engine/engine.ts";
import type {
  AimResult,
  BoardMap,
  DuelWager,
  ItemRarity,
  Match,
  RangeBand,
} from "../types.ts";

export interface ItemUseContext {
  playerId: string;
  itemInstanceId: string;
  map: BoardMap;
  random: Random;
  // Authoritative server time of the use (aim timing, duel scheduling).
  now: number;
  targetNodeId?: string;
  targetPlayerId?: string;
  wager?: DuelWager;
  // Present for aimed items: the server-computed outcome of the validated release.
  aim?: AimResult;
}
// Normalized aim geometry (field [-1, 1]²) for one range band.
export interface AimGeometry {
  // Visual radius of the target marker.
  targetRadius: number;
  // offset <= centerRadius → "centered"; offset <= hitRadius → "partial"; else "miss".
  centerRadius: number;
  hitRadius: number;
}
// Aimed items start a server-seeded aiming challenge (phase ITEM_AIM) before they resolve.
export interface AimSpec {
  windowMs: number;
  motion: {
    amplitude: readonly [number, number];
    frequencyHz: readonly [number, number];
  };
  // Board-range check. null = the target is out of range.
  range(
    state: Match,
    map: BoardMap,
    playerId: string,
    targetPlayerId: string,
  ): { band: RangeBand; distance: number | null } | null;
  geometry(band: RangeBand): AimGeometry;
}
export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  icon: string;
  // "node" items require a board-node target, "player" items an opponent; both validated by the server.
  targeting?: "node" | "player";
  aim?: AimSpec;
  // Rules that do not depend on a chosen target: current HP, turn state, anyone in range and so on.
  canUse(state: Match, playerId: string, map: BoardMap): boolean;
  // Optional player-facing reason shown (and used as the server's rejection) when canUse is false.
  blockedReason?(state: Match, playerId: string, map: BoardMap): string | null;
  // Target/choice validation. Throws to reject; runs before the item is consumed or anything changes.
  validate?(state: Match, context: ItemUseContext): void;
  // Mutates and returns the draft state the engine hands in; it is only committed if nothing throws.
  execute(state: Match, context: ItemUseContext): Match;
}
