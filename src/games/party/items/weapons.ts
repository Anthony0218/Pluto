import { LUCKY_SIX_CONFIG, SCATTERBLASTER_CONFIG, type ScatterBand } from "../config.ts";
import { damagePlayer, findPlayer } from "../engine/combat.ts";
import { emit } from "../engine/events.ts";
import { graphDistances } from "../engine/graph.ts";
import type { BoardMap, Match, RangeBand } from "../types.ts";
import type { AimGeometry, ItemDefinition, ItemUseContext } from "./types.ts";

// Opponent-targeted items share this check: the target must be another player in this match.
export function requireOpponent(
  state: Match,
  playerId: string,
  targetPlayerId: string | undefined,
) {
  if (!targetPlayerId) throw new Error("Choose an opponent.");
  if (targetPlayerId === playerId) throw new Error("You cannot target yourself.");
  if (!state.players.some((p) => p.id === targetPlayerId))
    throw new Error("That player is not in this match.");
  return findPlayer(state, targetPlayerId);
}

// Shortest graph distance between two pawns (never pixels).
export function boardDistance(
  map: BoardMap,
  fromNodeId: string,
  toNodeId: string,
): number | null {
  return graphDistances(map, fromNodeId).get(toNodeId) ?? null;
}

export function scatterBand(distance: number | null): ScatterBand | null {
  if (distance === null) return null;
  return SCATTERBLASTER_CONFIG.bands.find((b) => distance <= b.maxNodes) ?? null;
}

export function scatterblasterDamage(
  band: RangeBand,
  quality: "centered" | "partial" | "miss",
): number {
  const entry = SCATTERBLASTER_CONFIG.bands.find((b) => b.band === band);
  return !entry || quality === "miss" ? 0 : entry.damage[quality];
}

function scatterRange(state: Match, map: BoardMap, playerId: string, targetPlayerId: string) {
  const attacker = findPlayer(state, playerId),
    target = findPlayer(state, targetPlayerId),
    distance = boardDistance(map, attacker.currentNodeId, target.currentNodeId),
    band = scatterBand(distance);
  return band ? { band: band.band, distance } : null;
}

const shooterName = (state: Match, id: string) => findPlayer(state, id).name.toUpperCase();

// Shared resolution: announce, then either miss or damage through the generic combat system.
function resolveShot(
  state: Match,
  context: ItemUseContext,
  weapon: string,
  damage: number,
  detail: string,
) {
  const shooter = shooterName(state, context.playerId),
    target = findPlayer(state, context.targetPlayerId!);
  if (damage <= 0) {
    emit(state, {
      kind: "MISS",
      playerId: context.playerId,
      amount: 0,
      text: context.aim?.timedOut
        ? `${shooter}'S ${weapon} SHOT TIMED OUT · MISS`
        : `${weapon} MISSED!`,
    });
    return;
  }
  emit(state, {
    kind: "HIT",
    playerId: target.id,
    amount: damage,
    text: `${shooter} HIT ${target.name.toUpperCase()} FOR ${damage} · ${detail}`,
  });
  damagePlayer(state, context.map, target.id, damage);
}

export const scatterblaster: ItemDefinition = {
  id: "scatterblaster",
  name: "Scatterblaster",
  description:
    "Aim a spread shot at an opponent up to 5 spaces away: 20 close & centered, 15 close, 10 medium, 5 long.",
  rarity: "uncommon",
  icon: "💥",
  targeting: "player",
  aim: {
    windowMs: SCATTERBLASTER_CONFIG.aimWindowMs,
    motion: SCATTERBLASTER_CONFIG.motion,
    range: scatterRange,
    geometry: (band): AimGeometry => {
      const entry =
        SCATTERBLASTER_CONFIG.bands.find((b) => b.band === band) ??
        SCATTERBLASTER_CONFIG.bands[SCATTERBLASTER_CONFIG.bands.length - 1];
      return {
        targetRadius: entry.targetRadius,
        centerRadius: entry.centerRadius,
        hitRadius: entry.hitRadius,
      };
    },
  },
  // Needs at least one opponent in range.
  canUse: (state, playerId, map) =>
    state.players.some(
      (p) => p.id !== playerId && scatterRange(state, map, playerId, p.id) !== null,
    ),
  validate(state, { playerId, targetPlayerId, map }) {
    requireOpponent(state, playerId, targetPlayerId);
    if (!scatterRange(state, map, playerId, targetPlayerId!))
      throw new Error("That player is out of Scatterblaster range (more than 5 spaces).");
  },
  execute(state, context) {
    const range = scatterRange(state, context.map, context.playerId, context.targetPlayerId!);
    const quality = context.aim?.quality ?? "miss",
      damage = range ? scatterblasterDamage(range.band, quality) : 0;
    emit(state, {
      kind: "SHOT",
      playerId: context.playerId,
      text: `${shooterName(state, context.playerId)} USED SCATTERBLASTER ON ${shooterName(state, context.targetPlayerId!)}`,
    });
    resolveShot(
      state,
      context,
      "SCATTERBLASTER",
      damage,
      `${range?.band.toUpperCase() ?? "OUT OF RANGE"}${quality === "centered" ? " + CENTERED" : ""}`,
    );
    return state;
  },
};

export const luckySix: ItemDefinition = {
  id: "lucky-six",
  name: "Lucky Six",
  description:
    "Precision shot at any opponent on the board. Hit the moving target for 20 damage; a miss does nothing.",
  rarity: "uncommon",
  icon: "🎯",
  targeting: "player",
  aim: {
    windowMs: LUCKY_SIX_CONFIG.aimWindowMs,
    motion: LUCKY_SIX_CONFIG.motion,
    range: (state, _map, playerId, targetPlayerId) =>
      targetPlayerId !== playerId && state.players.some((p) => p.id === targetPlayerId)
        ? { band: "global", distance: null }
        : null,
    // No spread and no partial damage: centre and hit radius are the same.
    geometry: () => ({
      targetRadius: LUCKY_SIX_CONFIG.targetRadius,
      centerRadius: LUCKY_SIX_CONFIG.hitRadius,
      hitRadius: LUCKY_SIX_CONFIG.hitRadius,
    }),
  },
  canUse: (state, playerId) => state.players.some((p) => p.id !== playerId),
  validate(state, { playerId, targetPlayerId }) {
    requireOpponent(state, playerId, targetPlayerId);
  },
  execute(state, context) {
    const hit = context.aim !== undefined && context.aim.quality !== "miss";
    emit(state, {
      kind: "SHOT",
      playerId: context.playerId,
      text: `${shooterName(state, context.playerId)} USED LUCKY SIX ON ${shooterName(state, context.targetPlayerId!)}`,
    });
    resolveShot(state, context, "LUCKY SIX", hit ? LUCKY_SIX_CONFIG.damage : 0, "BULLSEYE");
    return state;
  },
};
