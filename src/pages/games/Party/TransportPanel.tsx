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
  const destination = transportDestination(transport, player.currentNodeId),
    from = transport.endpoints.indexOf(player.currentNodeId),
    affordable = player.coins >= transport.cost;
  return (
    <section className="pp-transport-offer" aria-label={`${transport.name} offer`}>
      <span className="pp-eyebrow">{transport.name.toUpperCase()}</span>
      <div className="pp-transport-emblem" aria-hidden="true">
        {transport.icon}
      </div>
      <h2>{transport.prompt}</h2>
      <p>
        {mine ? "" : `${player.name} is deciding. `}
        {transport.endpointNames[from]} → {transport.endpointNames[1 - from]}
        {destination ? "" : ""}. {transport.cost ? `${transport.cost} coins.` : "Free."}{" "}
        The ride is not a dice move and the space you arrive at does not trigger.
      </p>
      {!affordable && <p role="status">You need {transport.cost} coins for this ride.</p>}
      <button
        className="pp-primary"
        disabled={!mine || !online || !affordable}
        onClick={onRide}
      >
        {transport.rideLabel} <span>{transport.icon}</span>
      </button>
      <button disabled={!mine || !online} onClick={onStay}>
        {transport.stayLabel}
      </button>
    </section>
  );
}
