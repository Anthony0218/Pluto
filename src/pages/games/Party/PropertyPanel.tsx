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
  const owner = match.players.find((p) => p.id === property.ownerPlayerId);
  const steal = plutoStealRoundsLeft(property, match.round);
  return (
    <dl className="pp-property-details" aria-label={`${name} details`}>
      <div>
        <dt>Owner</dt>
        <dd>
          {owner ? (
            <>
              <i style={{ background: COLORS[owner.avatarId] }} /> {owner.name}
            </>
          ) : (
            "Unowned"
          )}
        </dd>
      </div>
      <div>
        <dt>Level</dt>
        <dd>{property.level || "—"}</dd>
      </div>
      <div>
        <dt>Visitor toll</dt>
        <dd>{tollDescription(property, match.round)}</dd>
      </div>
      {property.level >= 1 && property.level < 4 && (
        <div>
          <dt>Next upgrade</dt>
          <dd>
            Level {property.level + 1} · {PROPERTY_CONFIG.upgradeCost} coins
          </dd>
        </div>
      )}
      {property.level === 4 && (
        <div>
          <dt>Pluto theft</dt>
          <dd>
            {steal === 0
              ? "Ready"
              : `Available in ${steal} round${steal === 1 ? "" : "s"}`}
          </dd>
        </div>
      )}
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
  const buying = property.level === 0,
    cost = buying ? PROPERTY_CONFIG.purchaseCost : PROPERTY_CONFIG.upgradeCost,
    active = match.players.find((p) => p.id === match.order[match.turnIndex]);
  return (
    <section className="pp-property-offer" aria-label={`${name} decision`}>
      <span className="pp-eyebrow">
        {buying ? "UNCLAIMED" : `${name.toUpperCase()} · LEVEL ${property.level}`}
      </span>
      <h2>{buying ? `Claim this ${name}?` : `Upgrade to Level ${property.level + 1}?`}</h2>
      <p>
        {mine ? "" : `${active?.name ?? "A player"} is deciding. `}
        {buying ? "Claim" : "Upgrade"} for {cost} coins
        {mine && active ? ` (you have ${active.coins})` : ""}.
      </p>
      <PropertyDetails match={match} property={property} name={name} />
      <button
        className="pp-primary"
        disabled={!mine || !online}
        onClick={buying ? onBuy : onUpgrade}
      >
        {buying ? "Buy" : "Upgrade"} · ◉ {cost}
      </button>
      <button disabled={!mine || !online} onClick={onLeave}>
        Leave
      </button>
    </section>
  );
}
