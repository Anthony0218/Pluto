import type {
  Campaign,
  Command,
  House,
} from "../../../games/MedievalKingdoms/edravane/types.ts";
import { insultGrievances } from "../../../games/MedievalKingdoms/edravane/politics.ts";

export function InsultAction({
  state,
  house,
  target,
  active,
  onCommand,
}: {
  state: Campaign;
  house: House;
  target: House;
  active: boolean;
  onCommand: (cmd: Command) => void;
}) {
  const sent = (state.insults ?? []).some(
    (i) =>
      i.from === house.id &&
      i.to === target.id &&
      i.round === (state.turns?.round ?? state.tick),
  );
  const received = insultGrievances(state, house, target.nation);
  return (
    <div className="ed-insult-action">
      <button
        disabled={!active || sent || house.id === target.id}
        onClick={() => onCommand({ type: "insult", house: target.id })}
      >
        {sent
          ? `House ${target.name} insulted this round`
          : `Insult House ${target.name}`}
      </button>
      <p className="ed-reason">
        −20 relations.
        {target.nation !== house.nation
          ? " Their crown gains a justified war reason against your realm."
          : target.liege === house.id
            ? " Your vassal also loses 15 opinion."
            : ""}
      </p>
      {!!received.length && target.nation !== house.nation && (
        <p className="ed-reason">
          {Array.from(
            new Set(
              received.map(
                (i) => state.houses.find((v) => v.id === i.from)?.name,
              ),
            ),
          ).join(", ")}{" "}
          insulted your realm. You may answer with a justified war.
        </p>
      )}
    </div>
  );
}
