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
import { PeaceNegotiator, TreatyStatus } from "./RealmPanels.tsx";
import { truce } from "../../../games/MedievalKingdoms/edravane/campaignStrategy.ts";
import { EffectBadge } from "./RealmIcon.tsx";

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
  const treaty = truce(state, house.nation, nation);
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
      <TreatyStatus state={state} from={house.nation} to={nation} />
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
          {reason === "unjustified" ? <><div className="ed-effects" aria-label="War declaration effects"><EffectBadge metric="unrest" amount={5} label="realm unrest" /><EffectBadge metric="loyalty" amount={-6} label="army loyalty" />{(house.unjustifiedWars ?? 0) + 1 >= 2 && <EffectBadge metric="opinion" amount={-15} label="vassal opinion" />}</div>{!(house.unjustifiedWars ?? 0) && <p className="ed-reason">Another unjustified war will also cost vassal opinion.</p>}</> : <div className="ed-effects"><EffectBadge metric="unrest" amount={0} /><EffectBadge metric="loyalty" amount={0} label="loyalty penalty" /></div>}
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
          !active || !atWar && !!treaty ||
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
      {!active && <p className="ed-reason">Military orders require your own turn or an active defense response.</p>}
      {field && (!army || army.garrison || !canControl(state, { house: house.id }, army)) && <p className="ed-reason">Raise and select a field host under your command to attack.</p>}
      {!forecast && field && <p className="ed-reason">No current defender sighting. Scout this area before committing; unseen forces may defend it.</p>}
      {field && (
        <small>
          Choose a field army. Movement commits on End turn; the defender
          responds before entry.
        </small>
      )}
      {atWar && (
        <PeaceNegotiator state={state} house={house} nation={nation} active={active} onCommand={onCommand} />
      )}
    </div>
  );
}
