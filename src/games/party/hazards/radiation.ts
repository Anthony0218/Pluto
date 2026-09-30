import { FALLOUT_CONFIG, RADIATION_CONFIG } from "../config.ts";
import { findPlayer } from "../engine/combat.ts";
import { emit } from "../engine/events.ts";
import { applyStatus } from "../status/effects.ts";
import type { Match, RadiationZone } from "../types.ts";

// Radiation zones are authoritative match state (`match.radiationZones`), never map content.
//
// Round semantics: a zone created during round R is active for the rest of round R and the full rounds
// R+1, R+2 and R+3 (including their Animal Phases), and is removed at ROUND_END of round R+3, before
// round R+4 begins. `expiresAfterRound = R + FALLOUT_CONFIG.zoneRounds`.

export function createRadiationZone(
  state: Match,
  sourcePlayerId: string,
  nodeIds: readonly string[],
): RadiationZone {
  const zone: RadiationZone = {
    id: `zone-${state.nextZoneNumber++}`,
    sourcePlayerId,
    nodeIds: [...nodeIds],
    createdRound: state.round,
    expiresAfterRound: state.round + FALLOUT_CONFIG.zoneRounds,
  };
  state.radiationZones.push(zone);
  return zone;
}

export function irradiatedNodeIds(state: Pick<Match, "radiationZones">): Set<string> {
  return new Set(state.radiationZones.flatMap((zone) => zone.nodeIds));
}

// Rounds a node stays dangerous, counting the current round (0 when clean). Display and bot use.
export function radiationRoundsLeft(
  state: Pick<Match, "radiationZones" | "round">,
  nodeId: string,
): number {
  return state.radiationZones.reduce(
    (most, zone) =>
      zone.nodeIds.includes(nodeId)
        ? Math.max(most, zone.expiresAfterRound - state.round + 1)
        : most,
    0,
  );
}

// Called at ROUND_END before the round counter moves on.
export function expireRadiationZones(state: Match) {
  const expired = state.radiationZones.filter((z) => z.expiresAfterRound <= state.round);
  if (!expired.length) return;
  state.radiationZones = state.radiationZones.filter((z) => z.expiresAfterRound > state.round);
  emit(state, {
    kind: "RADIATION_FADED",
    text: `☢ RADIATION FADED FROM ${expired.reduce((n, z) => n + z.nodeIds.length, 0)} SPACES`,
  });
}

// Gives (or refreshes) the Radiation status. One status per player; it never stacks.
export function irradiatePlayer(state: Match, playerId: string, reason: string) {
  const player = findPlayer(state, playerId);
  const result = applyStatus(state, playerId, "radiation", RADIATION_CONFIG.durationTurns);
  emit(state, {
    kind: "RADIATION",
    playerId,
    text: `☢ ${player.name.toUpperCase()} ${result === "refreshed" ? "RADIATION REFRESHED" : "IS IRRADIATED"} · ${reason}`,
  });
}

// Radiation applies on landing only (not when passing through, respawning or arriving by ferry).
export function applyLandingRadiation(state: Match, playerId: string, nodeId: string): boolean {
  if (!irradiatedNodeIds(state).has(nodeId)) return false;
  irradiatePlayer(state, playerId, "LANDED ON A RADIATION ZONE");
  return true;
}
