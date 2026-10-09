import { ATLAS_SCORING } from "./config.ts";
import type { Coordinates } from "./types.ts";

export function normalScore(correct: boolean, remainingMs: number, roundMs: number, ranked = false): number {
  if (!correct) return 0;
  if (!ranked) return ATLAS_SCORING.normalCorrect;
  const ratio = Math.max(0, Math.min(1, remainingMs / Math.max(1, roundMs)));
  return ATLAS_SCORING.normalCorrect + Math.round(ATLAS_SCORING.maxSpeedBonus * ratio);
}

export function speedRunScore(correct: boolean): number {
  return correct ? ATLAS_SCORING.speedRunCorrect : ATLAS_SCORING.speedRunWrong;
}

/** Solo Closest Wins: a pin inside the country earns 1,000; the reward halves roughly every 1,000 km beyond its border. */
export function closestScore(distanceKm: number): number {
  if (!Number.isFinite(distanceKm)) return 0;
  return distanceKm < 0.5 ? 1000 : Math.max(0, Math.round(1000 * Math.exp(-distanceKm / 1500)));
}

export function haversineKm(first: Coordinates, second: Coordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const [longitude1, latitude1] = first.map(radians), [longitude2, latitude2] = second.map(radians);
  const latitudeDelta = latitude2 - latitude1, longitudeDelta = longitude2 - longitude1;
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  const bounded = Math.max(0, Math.min(1, a));
  return 6371.0088 * 2 * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}

export type MapFillState = { targets: string[]; found: string[]; mistakes: number; streak: number; bestStreak: number; score: number; complete: boolean };
export function createMapFillState(targets: string[]): MapFillState {
  return { targets: [...new Set(targets)], found: [], mistakes: 0, streak: 0, bestStreak: 0, score: 0, complete: targets.length === 0 };
}
export function applyMapFillSelection(state: MapFillState, selectedId: string, expectedId: string): MapFillState {
  if (state.complete || state.found.includes(selectedId)) return state;
  if (selectedId !== expectedId) return { ...state, mistakes: state.mistakes + 1, streak: 0 };
  const found = [...state.found, selectedId], streak = state.streak + 1, complete = found.length === state.targets.length;
  return { ...state, found, streak, bestStreak: Math.max(state.bestStreak, streak), complete, score: state.score + ATLAS_SCORING.mapFillCountry + streak * ATLAS_SCORING.mapFillStreak + (complete ? ATLAS_SCORING.mapFillCompletion : 0) };
}

export function assertDatasetVersion(expected: string, received: string): void {
  if (expected !== received) throw new Error(`Atlas dataset mismatch: match uses ${expected}, client has ${received}.`);
}
