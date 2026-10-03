import { entitiesForScope } from "./engine.ts";
import type { Coordinates, GeographicEntity } from "./types.ts";

export const FILL_SCOPES = ["World", "Europe", "Asia", "Africa", "North America", "South America", "Oceania"] as const;
export type FillScope = typeof FILL_SCOPES[number];
export const isFillScope = (value: unknown): value is FillScope => FILL_SCOPES.includes(value as FillScope);

/** GeoNames files South America under "North America"; the UN subregion restores the everyday continent. */
export function continentOf(entity: GeographicEntity): string {
  return entity.subregion === "South America" ? "South America" : entity.continent;
}

export function entitiesInFillScope(entities: GeographicEntity[], scope: FillScope): GeographicEntity[] {
  const members = entitiesForScope(entities, "un195");
  return scope === "World" ? members : members.filter((entity) => continentOf(entity) === scope);
}

/**
 * The part of the globe each scope zooms to, as [south-west, north-east] corners in longitude/latitude.
 * Oceania stops at the antimeridian: Samoa and Tonga sit on the far edge of the world map and need a pan.
 */
export const SCOPE_FOCUS: Record<Exclude<FillScope, "World">, [Coordinates, Coordinates]> = {
  Europe: [[-25, 34], [45, 71]],
  Asia: [[25, -11], [148, 55]],
  Africa: [[-26, -36], [58, 38]],
  "North America": [[-170, 6], [-52, 72]],
  "South America": [[-82, -56], [-34, 13]],
  Oceania: [[110, -48], [180, 10]],
};
export const focusForScope = (scope: string): [Coordinates, Coordinates] | null => scope in SCOPE_FOCUS ? SCOPE_FOCUS[scope as keyof typeof SCOPE_FOCUS] : null;
