import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { transportDestination } from "../../../games/party/engine/transport.ts";
import type { MapTransport, Player } from "../../../games/party/types.ts";

// Cable Car / Mine Cart offer: shown in the turn panel after the landing field has resolved.
export default function TransportOffer({
  transport,
  player,
  mine,
  online,
  onRide,
  onStay,
}: {
  transport: MapTransport;
  player: Player;
  mine: boolean;
  online: boolean;
  onRide: () => void;
  onStay: () => void;
}) {
  useGameLanguage();
  const destination = transportDestination(transport, player.currentNodeId),
    from = transport.endpoints.indexOf(player.currentNodeId),
    affordable = player.coins >= transport.cost;
  return (
    <section className="pp-transport-offer" aria-label={gameUi(`${transport.name} offer`)}>
      <span className="pp-eyebrow">{gameUi(transport.name.toUpperCase())}</span>
      <div className="pp-transport-emblem" aria-hidden="true">
        {gameUi(transport.icon)}
      </div>
      <h2>{gameUi(transport.prompt)}</h2>
      <p>
        {gameUi(mine ? "" : `${player.name} is deciding. `)}
        {gameUi(transport.endpointNames[from])} → {gameUi(transport.endpointNames[1 - from])}
        {gameUi(destination ? "" : "")}. {gameUi(transport.cost ? `${transport.cost} coins.` : "Free.")}{gameUi(" ")}{gameUi(" The ride is not a dice move and the space you arrive at does not trigger. ")}</p>
      {!affordable && <p role="status">{gameUi("You need ")}{gameUi(transport.cost)}{gameUi(" coins for this ride.")}</p>}
      <button
        className="pp-primary"
        disabled={!mine || !online || !affordable}
        onClick={onRide}
      >
        {gameUi(transport.rideLabel)} <span>{gameUi(transport.icon)}</span>
      </button>
      <button disabled={!mine || !online} onClick={onStay}>
        {gameUi(transport.stayLabel)}
      </button>
    </section>
  );
}
