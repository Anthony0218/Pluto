import { Shield, Swords } from "lucide-react";
import { CharacterPortrait } from "./CharacterPortrait.tsx";
import type {
  Campaign,
  District,
  House,
} from "../../../games/MedievalKingdoms/edravane/types.ts";
import {
  troopCount,
  woundedCount,
  armyHealth,
} from "../../../games/MedievalKingdoms/edravane/battle.ts";
import {
  armyLoyalty,
  armyRebellionRisk,
} from "../../../games/MedievalKingdoms/edravane/politics.ts";
import { heir } from "../../../games/MedievalKingdoms/edravane/simulation.ts";
import { NATIONS } from "../../../games/MedievalKingdoms/edravane/world.ts";
import { KingdomIdentity, Personality } from "./RealmPanels.tsx";
import { HouseSigil } from "./HouseSigil.tsx";

export function HouseProfile({
  state,
  house,
  onHouse,
  onHex,
}: {
  state: Campaign;
  house: House;
  onHouse: (h: House) => void;
  onHex: (d: District) => void;
}) {
  const armies = state.armies.filter((a) => a.house === house.id && !a.rebel);
  const total = armies.reduce((n, a) => n + troopCount(a), 0);
  const vassals = state.houses.filter((h) => h.liege === house.id);
  const holdings = state.districts.filter(
    (d) => d.occupation === house.id || (d.owner === house.id && !d.occupation),
  );
  const ruler = house.family.find((p) => p.id === house.ruler);
  return (
    <section
      aria-label={`House ${house.name} profile`}
      className="ed-house-profile"
    >
      <div className="ed-panel-title">
        <span className="ed-eyebrow">
          {NATIONS.find((n) => n.id === house.nation)?.name} ·{" "}
          {house.liege ? "VASSAL HOUSE" : "CROWN HOUSE"}
        </span>
        <h2 style={{ color: house.color }}>
          <HouseSigil house={house} size={32} /> House {house.name}
        </h2>
        <p>Ruled by {ruler?.name ?? "Vacant seat"}</p>
      </div>
      <KingdomIdentity nation={house.nation} />
      <Personality person={ruler} />
      <div className="ed-profile-stats">
        <span>
          <Swords size={15} />
          {total.toLocaleString()} healthy troops ·{" "}
          {armies.reduce((n, a) => n + woundedCount(a), 0).toLocaleString()}{" "}
          wounded
        </span>
        <span>
          <Shield size={15} />
          Loyalty {house.loyalty}%
        </span>
      </div>
      {house.liege && (
        <p>
          Sworn to{" "}
          <button
            className="ed-house-link"
            onClick={() =>
              onHouse(state.houses.find((h) => h.id === house.liege)!)
            }
          >
            {state.houses.find((h) => h.id === house.liege)?.name}
          </button>
        </p>
      )}
      <h3>Ruler & heirs</h3>
      {house.family
        .filter((p) => p.alive)
        .map((p) => {
          const commanded = armies
            .filter((a) => a.commander === p.id)
            .reduce((n, a) => n + troopCount(a), 0);
          return (
            <div className="ed-person" key={p.id}>
              <CharacterPortrait person={p} house={house} />
              <div>
                <strong>{p.name}</strong>
                <small>
                  {p.age} years ·{" "}
                  {p.id === house.ruler
                    ? "Current ruler"
                    : heir(state, house)?.id === p.id
                      ? "Next eligible heir"
                      : p.parents.length
                        ? "Dynastic heir"
                        : "Family"}
                </small>
                <small>
                  {commanded.toLocaleString()} troops under personal command
                </small>
                {p.spouse && (
                  <small>
                    Married to{" "}
                    {
                      state.houses
                        .flatMap((h) => h.family)
                        .find((v) => v.id === p.spouse)?.name
                    }
                  </small>
                )}
                {p.imprisonedBy && (
                  <small className="ed-danger">
                    Captured by{" "}
                    {state.houses.find((h) => h.id === p.imprisonedBy)?.name}
                  </small>
                )}
              </div>
            </div>
          );
        })}
      <h3>Armies & reserves</h3>
      {armies
        .filter((a) => troopCount(a) > 0 || woundedCount(a) > 0)
        .map((a) => (
          <div className="ed-profile-army" key={a.id}>
            <button
              className="ed-house-link"
              onClick={() =>
                onHex(state.districts.find((d) => d.id === a.hex)!)
              }
            >
              {a.name}
            </button>
              <small>
                {troopCount(a).toLocaleString()} observed troops ·{" "}
              {a.garrison ? "Garrison" : "Field army"} · Morale{" "}
              {Math.round(a.morale)} · Loyalty{" "}
              {Math.round(armyLoyalty(state, a))}% · {woundedCount(a)} wounded ·
              Readiness {armyHealth(a)}%
            </small>
            {armyRebellionRisk(state, a) > 0 && (
              <small className="ed-danger">
                Mutiny risk {Math.round(armyRebellionRisk(state, a) * 100)}% per
                own turn
              </small>
            )}
          </div>
        ))}
      <h3>Vassals · {vassals.length}</h3>
      {vassals.map((v) => (
        <button
          className="ed-holding-link"
          key={v.id}
          onClick={() => onHouse(v)}
        >
          <span>
            {v.crest} {v.name}
            <small>
              Loyalty {v.loyalty}% · {v.obligation} pledged by contract
            </small>
          </span>
          <b>
            {state.armies
              .filter((a) => a.house === v.id && !a.rebel)
              .reduce((n, a) => n + troopCount(a), 0)
              .toLocaleString()}{" "}
            troops
          </b>
        </button>
      ))}
      {!vassals.length && <p className="ed-reason">No sworn vassals.</p>}
      {!armies.length && house.id !== state.houses.find((h) => h.reasons.includes("Human commander"))?.id && <p className="ed-reason">No current army sightings. Scouts and trade reports can reveal their forces.</p>}
      <h3>Controlled castles & cities</h3>
      {holdings
        .filter((d) => d.city || d.castle)
        .map((d) => (
          <button
            key={d.id}
            className="ed-holding-link"
            onClick={() => onHex(d)}
          >
            <span>
              {d.settlement}
              <small>
                {d.id} ·{" "}
                {d.city === "major"
                  ? "Major city"
                  : d.city
                    ? "Market city"
                    : "Rural estate"}
                {d.castle ? ` · Castle level ${d.castle.level}` : ""}
                {d.occupation ? " · Occupied" : ""}
              </small>
            </span>
            <b>
              {state.armies
                .filter(
                  (a) => a.hex === d.id && a.house === house.id && !a.rebel,
                )
                .reduce((n, a) => n + troopCount(a), 0)
                .toLocaleString()}
            </b>
          </button>
        ))}
      {!holdings.length && (
        <p className="ed-reason">This house controls no estates.</p>
      )}
    </section>
  );
}
