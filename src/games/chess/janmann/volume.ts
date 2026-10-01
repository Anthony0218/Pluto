import { VOLUME_PER_SURFACE_UNIT_M3 } from "./config.ts";

/** Fictional Janmann game law, not a physical area-to-volume conversion. */
export const surfaceToVolumeM3 = (surfaceUnits: number) => Math.max(0, surfaceUnits) * VOLUME_PER_SURFACE_UNIT_M3;
export const sphereVolume = (radius: number) => 4 / 3 * Math.PI * Math.max(0, radius) ** 3;
export function measureVolume(outerRadius: number, innerRadius: number, solidAngleSteradians: number) {
  const outer = sphereVolume(outerRadius);
  const inner = sphereVolume(Math.min(Math.max(0, outerRadius), Math.max(0, innerRadius)));
  const fraction = Math.min(1, Math.max(0, solidAngleSteradians / (4 * Math.PI)));
  const angleCut = (outer - inner) * (1 - fraction);
  return { outer, inner, angleCut, result: Math.max(0, outer - inner - angleCut) };
}
