import type { GeographicEntity } from "./types.ts";

/** Read only an explicitly displayed area, never a hidden answer's statistics. */
export function areaValuesFromText(text: string): number[] {
  const number = "([\\d,]+(?:\\.\\d+)?\\s*[MK]?)";
  const match = text.match(new RegExp(`(?:between ${number} and ${number}|(?:under |over )?${number})\\s*km²`, "i"));
  if (!match) return [];
  return match.slice(1).filter(Boolean).map(value => Number(value.replace(/[,MK\s]/gi, "")) * (/M/i.test(value) ? 1e6 : /K/i.test(value) ? 1e3 : 1)).filter(value => value > 0);
}

/** Choose a visible scale reference outside every answer option, including already rejected choices. */
export function areaReferenceCountry(value: number, countries: readonly GeographicEntity[], excludeIds: readonly string[] = []): GeographicEntity | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const excluded = new Set(excludeIds);
  let best: GeographicEntity | null = null;
  let distance = Infinity;
  for (const country of countries) {
    const area = country.areaKm2?.value;
    if (excluded.has(country.id) || country.status !== "un195" || !country.geometryId || !area || !Number.isFinite(area) || area <= 0) continue;
    const candidateDistance = Math.abs(Math.log(area / value));
    if (candidateDistance < distance) { best = country; distance = candidateDistance; }
  }
  return best;
}
