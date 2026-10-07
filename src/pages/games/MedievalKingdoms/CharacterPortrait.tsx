import { Crown } from "lucide-react";
import type {
  House,
  Person,
} from "../../../games/MedievalKingdoms/edravane/types.ts";
import { portraitFor } from "../../../games/MedievalKingdoms/edravane/portraits.ts";

export function CharacterPortrait({
  person,
  house,
}: {
  person: Person;
  house: House;
}) {
  const portrait = portraitFor(person, house);
  return (
    <div
      className={`ed-character-portrait${person.alive ? "" : " ed-character-deceased"}`}
      role="img"
      aria-label={`Portrait of ${person.name}`}
      style={{
        backgroundImage: `url("${import.meta.env.BASE_URL}${portrait.src.slice(1)}")`,
        backgroundPosition: `${portrait.column * 50}% ${portrait.row * 25}%`,
        borderColor: house.color,
      }}
    >
      {person.alive && person.id === house.ruler && (
        <span className="ed-character-crown" aria-hidden="true">
          <Crown size={13} />
        </span>
      )}
    </div>
  );
}
