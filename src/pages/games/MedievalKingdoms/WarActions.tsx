import { useState } from "react";
import { Swords } from "lucide-react";
import type {
  Army,
  Campaign,
  Command,
  District,
  House,
  WarReason,
} from "../../../games/MedievalKingdoms/edravane/types.ts";
import {
  justifiedWarReasons,
  hasMarriagePact,
  WAR_REASONS,
} from "../../../games/MedievalKingdoms/edravane/politics.ts";
import { canControl } from "../../../games/MedievalKingdoms/edravane/simulation.ts";
import { NATIONS } from "../../../games/MedievalKingdoms/edravane/world.ts";
import {
  previewArmies,
  terrainExplanation,
} from "../../../games/MedievalKingdoms/edravane/battleRounds.ts";
import { UnitGuide } from "./BattleRoundPanel.tsx";
import { troopCount } from "../../../games/MedievalKingdoms/edravane/battle.ts";

export function WarActions({
  state,
  house,
  nation,
  field,
  army,
  active,
  onCommand,
}: {
  state: Campaign;
  house: House;
  nation: string;
  field?: District;
  army?: Army;
  active: boolean;
  onCommand: (cmd: Command) => void;
}) {
  const [requested, setReason] = useState<WarReason>();
  const target = NATIONS.find((n) => n.id === nation)!;
  const atWar = state.wars.includes([house.nation, nation].sort().join("|"));
  const valid = justifiedWarReasons(state, house, nation, field?.id);
  const reason =
    requested && (requested === "unjustified" || valid.includes(requested))
      ? requested
      : (valid[0] ?? "unjustified");
  const defender =
    field &&
    state.armies
      .filter(
        (a) => a.hex === field.id && a.origin === nation && troopCount(a) > 0,
      )
      .sort((a, b) => troopCount(b) - troopCount(a))[0];
  const forecast =
    field && army && defender
      ? previewArmies(state, army, defender, field.id)
      : null;
  return (
    <div className="ed-war-actions">
      {forecast && field && (
        <div className="ed-attack-preview" aria-label="Battle preview">
          <strong>
            Battle preview · {forecast.chance}% estimated attacker advantage
          </strong>
          {forecast.sides.map((side) => (
            <p key={side.army}>
              {side.name}: {side.healthy.toLocaleString()} healthy ·{" "}
              {side.wounded} wounded · Morale {side.morale} · Supplies{" "}
              {side.supply}%.
            </p>
          ))}
          {terrainExplanation(state, field.id).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <small>
            Estimate against the largest stationed force. The defender can
            reinforce or withdraw; orders change the outcome.
          </small>
          <UnitGuide />
        </div>
      )}
      {!atWar && (
        <>
          <label>
            War reason for {target.name}
            <select
              aria-label={`War reason for ${target.name}`}
              value={reason}
              onChange={(e) => setReason(e.target.value as WarReason)}
            >
              {valid.map((r) => (
                <option value={r} key={r}>
                  {WAR_REASONS[r]}
                </option>
              ))}
              <option value="unjustified">{WAR_REASONS.unjustified}</option>
            </select>
          </label>
          <p
            className={
              reason === "unjustified" ? "ed-reason ed-danger" : "ed-reason"
            }
          >
            {reason === "unjustified"
              ? `+5 realm unrest, −6 army loyalty. ${(house.unjustifiedWars ?? 0) + 1 >= 2 ? "Vassals also lose 15 opinion." : "A second unjustified declaration will cost vassal loyalty."}`
              : "Justified: no declaration unrest or loyalty penalty."}
          </p>
          {reason === "territorial-conquest" && (
            <p className="ed-reason">
              {field
                ? "This hex borders land controlled by your realm."
                : "Their realm shares an unprotected land border with yours."}
            </p>
          )}
          {hasMarriagePact(state, house, nation) && (
            <p className="ed-reason">
              Marriage pact active: territorial conquest is unavailable.
            </p>
          )}
        </>
      )}
      <button
        disabled={
          !active ||
          (field
            ? !army ||
              army.garrison ||
              !canControl(state, { house: house.id }, army)
            : atWar)
        }
        onClick={() =>
          onCommand(
            field
              ? { type: "attack", army: army!.id, hex: field.id, reason }
              : { type: "war", nation, reason },
          )
        }
      >
        <Swords size={14} />
        {field
          ? atWar
            ? "Attack this hex"
            : "Declare war & attack"
          : atWar
            ? "At war"
            : "Declare war"}
      </button>
      {field && (
        <small>
          Choose a field army. Movement commits on End turn; the defender
          responds before entry.
        </small>
      )}
      {atWar && (
        <button
          disabled={!active}
          onClick={() => onCommand({ type: "peace", nation })}
        >
          Propose peace
        </button>
      )}
    </div>
  );
}
