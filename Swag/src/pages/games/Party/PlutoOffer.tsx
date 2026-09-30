import { RULES } from "../../../games/party/config.ts";
import type { Player } from "../../../games/party/types.ts";
export default function PlutoOffer({
  player,
  mine,
  online,
  onBuy,
  onLeave,
  others = 1,
}: {
  player: Player;
  mine: boolean;
  online: boolean;
  onBuy: () => void;
  onLeave: () => void;
  // Other Golden Plutos currently on the board (Tropical 1, Mountain 0).
  others?: number;
}) {
  const affordable = player.coins >= RULES.plutoPrice;
  return (
    <section className="pp-pluto-offer" aria-label="Golden Pluto purchase">
      <span className="pp-eyebrow">A GOLDEN OPPORTUNITY</span>
      <div className="pp-pluto-emblem" aria-hidden="true">
        ✦
      </div>
      <h2>Golden Pluto</h2>
      <p>
        {mine ? "Make it yours." : `${player.name} is deciding.`} The landing
        field has already resolved.
      </p>
      <div className="pp-pluto-price">
        <strong>◉ {RULES.plutoPrice}</strong>
        <span>You have {player.coins} coins</span>
      </div>
      {!affordable && (
        <p role="status">
          {RULES.plutoPrice - player.coins} more coins needed. Leave it here for
          another visit.
        </p>
      )}
      <button
        className="pp-primary"
        disabled={!mine || !online || !affordable}
        onClick={onBuy}
      >
        Buy Golden Pluto <span>✦ +1</span>
      </button>
      <button disabled={!mine || !online} onClick={onLeave}>
        Leave it here
      </button>
      <small>
        Buying moves this Pluto to a new space.
        {others > 0 ? " The other Pluto stays put." : ""}
      </small>
    </section>
  );
}
