import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { MAX_INVENTORY_SIZE } from "../../../games/party/config.ts";
import { itemRegistry } from "../../../games/party/items/registry.ts";
import { mapRegistry } from "../../../games/party/content/maps.ts";
import { itemLockReason } from "../../../games/party/status/effects.ts";
import type {
  ItemInstance,
  Match,
  Player,
} from "../../../games/party/types.ts";

// Presentation only: the server re-validates every use request (timing, radiation lock, canUse).
export default function ItemPanel({
  player,
  match,
  interactive,
  onUse,
}: {
  player: Player;
  match: Match;
  interactive: boolean;
  onUse: (item: ItemInstance) => void;
}) {
  useGameLanguage();
  const timingOpen = match.phase === "ITEM_PHASE" && !match.turn.hasRolled;
  const yourTurn = match.order[match.turnIndex] === player.id;
  const lock = itemLockReason(player);
  return (
    <section className="pp-items" aria-label={gameUi("Your items")}>
      <span className="pp-eyebrow">{gameUi(" ITEMS · ")}{gameUi(player.inventory.length)} / {gameUi(MAX_INVENTORY_SIZE)}
      </span>
      {gameUi(lock ? (
        <p role="status" className="pp-items-lock pp-items-radiation">
          ☢ {gameUi(lock)}
        </p>
      ) : (
        <p
          role="status"
          className={timingOpen && yourTurn ? "" : "pp-items-lock"}
        >
          {gameUi(!yourTurn
            ? "You can use items on your own turn, before rolling."
            : timingOpen
              ? "Items can only be used before you roll."
              : "Items are locked: you can only use them before rolling.")}
        </p>
      ))}
      <ul>
        {Array.from({ length: MAX_INVENTORY_SIZE }, (_, slot) => {
          const item = player.inventory[slot];
          if (!item)
            return (
              <li key={slot} className="pp-item-slot empty">
                <span aria-hidden="true">·</span>
                <small>{gameUi("Empty slot ")}{gameUi(slot + 1)}</small>
              </li>
            );
          const definition = itemRegistry.get(item.itemId),
            legal = definition.canUse(match, player.id, mapRegistry.get(match.mapId)),
            reason = legal ? null : definition.blockedReason?.(match, player.id, mapRegistry.get(match.mapId)),
            unlocks = (item.usableFromRound ?? 0) > match.round,
            enabled = interactive && timingOpen && yourTurn && legal && !lock && !unlocks,
            rare = definition.rarity === "rare";
          return (
            <li
              key={item.instanceId}
              className={`pp-item-slot ${rare ? "rare" : ""}`}
            >
              <span className="pp-item-icon" aria-hidden="true">
                {gameUi(definition.icon)}
              </span>
              <div>
                {rare && <span className="pp-rare-badge">{gameUi("★ RARE")}</span>}
                <strong>{gameUi(definition.name)}</strong>
                {!rare && <em>{gameUi(definition.rarity)}</em>}
                <small>{gameUi(definition.description)}</small>
                {unlocks && <small className="pp-item-reason">{gameUi("Ready in round ")}{gameUi(item.usableFromRound)}</small>}
                {gameUi(reason && yourTurn && timingOpen && !lock && (
                  <small className="pp-item-reason">{gameUi(reason)}</small>
                ))}
              </div>
              <button
                className="pp-primary"
                disabled={!enabled}
                onClick={() => onUse(item)}
                aria-label={gameUi(`Use ${definition.name}`)}
              >
                {gameUi(lock ? "☢ Locked" : yourTurn && timingOpen && !legal ? "Not now" : "Use")}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
