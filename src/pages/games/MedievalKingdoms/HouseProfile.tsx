import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
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
  useGameLanguage();
  const armies = state.armies.filter((a) => a.house === house.id && !a.rebel);
  const total = armies.reduce((n, a) => n + troopCount(a), 0);
  const vassals = state.houses.filter((h) => h.liege === house.id);
  const holdings = state.districts.filter(
    (d) => d.occupation === house.id || (d.owner === house.id && !d.occupation),
  );
  const ruler = house.family.find((p) => p.id === house.ruler);
  return (
    <section
      aria-label={gameUi(`House ${house.name} profile`)}
      className="ed-house-profile"
    >
      <div className="ed-panel-title">
        <span className="ed-eyebrow">
          {gameUi(NATIONS.find((n) => n.id === house.nation)?.name)} ·{gameUi(" ")}
          {gameUi(house.liege ? "VASSAL HOUSE" : "CROWN HOUSE")}
        </span>
        <h2 style={{ color: house.color }}>
          <HouseSigil house={house} size={32} />{gameUi(" House ")}{gameUi(house.name)}
        </h2>
        <p>{gameUi("Ruled by ")}{gameUi(ruler?.name ?? "Vacant seat")}</p>
      </div>
      <KingdomIdentity nation={house.nation} />
      <Personality person={ruler} />
      <div className="ed-profile-stats">
        <span>
          <Swords size={15} />
          {gameUi(total.toLocaleString())}{gameUi(" healthy troops ·")}{gameUi(" ")}
          {gameUi(armies.reduce((n, a) => n + woundedCount(a), 0).toLocaleString())}{gameUi(" ")}{gameUi(" wounded ")}</span>
        <span>
          <Shield size={15} />{gameUi(" Loyalty ")}{gameUi(house.loyalty)}%
        </span>
      </div>
      {gameUi(house.liege && (
        <p>{gameUi(" Sworn to")}{gameUi(" ")}
          <button
            className="ed-house-link"
            onClick={() =>
              onHouse(state.houses.find((h) => h.id === house.liege)!)
            }
          >
            {gameUi(state.houses.find((h) => h.id === house.liege)?.name)}
          </button>
        </p>
      ))}
      <h3>{gameUi("Ruler & heirs")}</h3>
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
                  {gameUi(p.age)}{gameUi(" years ·")}{gameUi(" ")}
                  {gameUi(p.id === house.ruler
                    ? "Current ruler"
                    : heir(state, house)?.id === p.id
                      ? "Next eligible heir"
                      : p.parents.length
                        ? "Dynastic heir"
                        : "Family")}
                </small>
                <small>
                  {gameUi(commanded.toLocaleString())}{gameUi(" troops under personal command ")}</small>
                {gameUi(p.spouse && (
                  <small>{gameUi(" Married to")}{gameUi(" ")}
                    {
                      state.houses
                        .flatMap((h) => h.family)
                        .find((v) => v.id === p.spouse)?.name
                    }
                  </small>
                ))}
                {gameUi(p.imprisonedBy && (
                  <small className="ed-danger">{gameUi(" Captured by")}{gameUi(" ")}
                    {state.houses.find((h) => h.id === p.imprisonedBy)?.name}
                  </small>
                ))}
              </div>
            </div>
          );
        })}
      <h3>{gameUi("Armies & reserves")}</h3>
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
              {gameUi(a.name)}
            </button>
              <small>
                {gameUi(troopCount(a).toLocaleString())}{gameUi(" observed troops ·")}{gameUi(" ")}
              {gameUi(a.garrison ? "Garrison" : "Field army")}{gameUi(" · Morale")}{gameUi(" ")}
              {gameUi(Math.round(a.morale))}{gameUi(" · Loyalty")}{gameUi(" ")}
              {gameUi(Math.round(armyLoyalty(state, a)))}% · {gameUi(woundedCount(a))}{gameUi(" wounded · Readiness ")}{gameUi(armyHealth(a))}%
            </small>
            {gameUi(armyRebellionRisk(state, a) > 0 && (
              <small className="ed-danger">{gameUi(" Mutiny risk ")}{gameUi(Math.round(armyRebellionRisk(state, a) * 100))}{gameUi("% per own turn ")}</small>
            ))}
          </div>
        ))}
      <h3>{gameUi("Vassals · ")}{gameUi(vassals.length)}</h3>
      {vassals.map((v) => (
        <button
          className="ed-holding-link"
          key={v.id}
          onClick={() => onHouse(v)}
        >
          <span>
            {gameUi(v.crest)} {gameUi(v.name)}
            <small>{gameUi(" Loyalty ")}{gameUi(v.loyalty)}% · {gameUi(v.obligation)}{gameUi(" pledged by contract ")}</small>
          </span>
          <b>
            {gameUi(state.armies
              .filter((a) => a.house === v.id && !a.rebel)
              .reduce((n, a) => n + troopCount(a), 0)
              .toLocaleString())}{gameUi(" ")}{gameUi(" troops ")}</b>
        </button>
      ))}
      {!vassals.length && <p className="ed-reason">{gameUi("No sworn vassals.")}</p>}
      {!armies.length && house.id !== state.houses.find((h) => h.reasons.includes("Human commander"))?.id && <p className="ed-reason">{gameUi("No current army sightings. Scouts and trade reports can reveal their forces.")}</p>}
      <h3>{gameUi("Controlled castles & cities")}</h3>
      {holdings
        .filter((d) => d.city || d.castle)
        .map((d) => (
          <button
            key={d.id}
            className="ed-holding-link"
            onClick={() => onHex(d)}
          >
            <span>
              {gameUi(d.settlement)}
              <small>
                {gameUi(d.id)} ·{gameUi(" ")}
                {gameUi(d.city === "major"
                  ? "Major city"
                  : d.city
                    ? "Market city"
                    : "Rural estate")}
                {gameUi(d.castle ? ` · Castle level ${d.castle.level}` : "")}
                {gameUi(d.occupation ? " · Occupied" : "")}
              </small>
            </span>
            <b>
              {gameUi(state.armies
                .filter(
                  (a) => a.hex === d.id && a.house === house.id && !a.rebel,
                )
                .reduce((n, a) => n + troopCount(a), 0)
                .toLocaleString())}
            </b>
          </button>
        ))}
      {gameUi(!holdings.length && (
        <p className="ed-reason">{gameUi("This house controls no estates.")}</p>
      ))}
    </section>
  );
}
