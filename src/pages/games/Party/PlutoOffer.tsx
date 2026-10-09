import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
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
  useGameLanguage();
  const affordable = player.coins >= RULES.plutoPrice;
  return (
    <section className="pp-pluto-offer" aria-label={gameUi("Golden Pluto purchase")}>
      <span className="pp-eyebrow">{gameUi("A GOLDEN OPPORTUNITY")}</span>
      <div className="pp-pluto-emblem" aria-hidden="true">
        ✦
      </div>
      <h2>{gameUi("Golden Pluto")}</h2>
      <p>
        {gameUi(mine ? "Make it yours." : `${player.name} is deciding.`)}{gameUi(" The landing field has already resolved. ")}</p>
      <div className="pp-pluto-price">
        <strong>◉ {gameUi(RULES.plutoPrice)}</strong>
        <span>{gameUi("You have ")}{gameUi(player.coins)}{gameUi(" coins")}</span>
      </div>
      {gameUi(!affordable && (
        <p role="status">
          {gameUi(RULES.plutoPrice - player.coins)}{gameUi(" more coins needed. Leave it here for another visit. ")}</p>
      ))}
      <button
        className="pp-primary"
        disabled={!mine || !online || !affordable}
        onClick={onBuy}
      >{gameUi(" Buy Golden Pluto ")}<span>✦ +1</span>
      </button>
      <button disabled={!mine || !online} onClick={onLeave}>{gameUi(" Leave it here ")}</button>
      <small>{gameUi(" Buying moves this Pluto to a new space. ")}{gameUi(others > 0 ? " The other Pluto stays put." : "")}
      </small>
    </section>
  );
}
