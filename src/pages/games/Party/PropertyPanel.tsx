import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { COLORS, PROPERTY_CONFIG } from "../../../games/party/config.ts";
import {
  plutoStealRoundsLeft,
  tollDescription,
} from "../../../games/party/properties/properties.ts";
import type { Match, PropertyState } from "../../../games/party/types.ts";

// Read-only details for any property; the same block is used in offers and the space inspector.
export function PropertyDetails({
  match,
  property,
  name,
}: {
  match: Match;
  property: PropertyState;
  name: string;
}) {
  useGameLanguage();
  const owner = match.players.find((p) => p.id === property.ownerPlayerId);
  const steal = plutoStealRoundsLeft(property, match.round);
  return (
    <dl className="pp-property-details" aria-label={gameUi(`${name} details`)}>
      <div>
        <dt>{gameUi("Owner")}</dt>
        <dd>
          {gameUi(owner ? (
            <>
              <i style={{ background: COLORS[owner.avatarId] }} /> {owner.name}
            </>
          ) : (
            "Unowned"
          ))}
        </dd>
      </div>
      <div>
        <dt>{gameUi("Level")}</dt>
        <dd>{gameUi(property.level || "—")}</dd>
      </div>
      <div>
        <dt>{gameUi("Visitor toll")}</dt>
        <dd>{gameUi(tollDescription(property, match.round))}</dd>
      </div>
      {gameUi(property.level >= 1 && property.level < 4 && (
        <div>
          <dt>{gameUi("Next upgrade")}</dt>
          <dd>{gameUi(" Level ")}{gameUi(property.level + 1)} · {gameUi(PROPERTY_CONFIG.upgradeCost)}{gameUi(" coins ")}</dd>
        </div>
      ))}
      {gameUi(property.level === 4 && (
        <div>
          <dt>{gameUi("Pluto theft")}</dt>
          <dd>
            {gameUi(steal === 0
              ? "Ready"
              : `Available in ${steal} round${steal === 1 ? "" : "s"}`)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export default function PropertyOffer({
  match,
  property,
  name,
  mine,
  online,
  onBuy,
  onUpgrade,
  onLeave,
}: {
  match: Match;
  property: PropertyState;
  name: string;
  mine: boolean;
  online: boolean;
  onBuy: () => void;
  onUpgrade: () => void;
  onLeave: () => void;
}) {
  useGameLanguage();
  const buying = property.level === 0,
    cost = buying ? PROPERTY_CONFIG.purchaseCost : PROPERTY_CONFIG.upgradeCost,
    active = match.players.find((p) => p.id === match.order[match.turnIndex]);
  return (
    <section className="pp-property-offer" aria-label={gameUi(`${name} decision`)}>
      <span className="pp-eyebrow">
        {gameUi(buying ? "UNCLAIMED" : `${name.toUpperCase()} · LEVEL ${property.level}`)}
      </span>
      <h2>{gameUi(buying ? `Claim this ${name}?` : `Upgrade to Level ${property.level + 1}?`)}</h2>
      <p>
        {gameUi(mine ? "" : `${active?.name ?? "A player"} is deciding. `)}
        {gameUi(buying ? "Claim" : "Upgrade")}{gameUi(" for ")}{gameUi(cost)}{gameUi(" coins ")}{gameUi(mine && active ? ` (you have ${active.coins})` : "")}.
      </p>
      <PropertyDetails match={match} property={property} name={name} />
      <button
        className="pp-primary"
        disabled={!mine || !online}
        onClick={buying ? onBuy : onUpgrade}
      >
        {gameUi(buying ? "Buy" : "Upgrade")} · ◉ {gameUi(cost)}
      </button>
      <button disabled={!mine || !online} onClick={onLeave}>{gameUi(" Leave ")}</button>
    </section>
  );
}
