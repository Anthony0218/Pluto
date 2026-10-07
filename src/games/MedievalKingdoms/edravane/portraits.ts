import type { House, Person } from "./types.ts";
import { NATIONS } from "./world.ts";

/**
 * Original identities select atlas cells, so promotion, marriage, captivity,
 * and changing a house's ruler never replace a character's face.
 */
export function portraitFor(person: Person, house: House) {
  const identity = /^(.*)-([0-4])-(r|h1|h2)$/.exec(person.id);
  const origin = NATIONS.find((n) => n.id === identity?.[1]);
  if (identity && origin) {
    return {
      src: `/MedievalKingdoms/edravane/portraits/${origin.id}.jpg`,
      row: Number(identity[2]),
      column: identity[3] === "r" ? 0 : identity[3] === "h1" ? 1 : 2,
    };
  }

  // Older/custom campaigns can contain additional people. Keep their fallback
  // deterministic and match the recorded gender rather than guessing from names.
  const nation = NATIONS.find((n) => n.id === house.nation) ?? NATIONS[0];
  const hash = Array.from(person.id).reduce(
    (n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0,
    0,
  );
  return {
    src: `/MedievalKingdoms/edravane/portraits/${nation.id}.jpg`,
    row: hash % 5,
    column: person.gender === "female" ? 1 : 2,
  };
}
