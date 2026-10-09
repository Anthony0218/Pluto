import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { itemRegistry } from "../../../games/party/items/registry.ts";
import type { Match, Player } from "../../../games/party/types.ts";

export default function ItemOverflow({
  player,
  match,
  mine,
  online,
  onReplace,
  onDiscard,
}: {
  player: Player;
  match: Match;
  mine: boolean;
  online: boolean;
  onReplace: (instanceId: string) => void;
  onDiscard: () => void;
}) {
  useGameLanguage();
  const incoming = itemRegistry.get(match.pendingItem!.itemId);
  return (
    <section className="pp-overflow" aria-label={gameUi("Inventory full")}>
      <span className="pp-eyebrow">{gameUi("INVENTORY FULL")}</span>
      <div className="pp-overflow-new">
        <span className="pp-item-icon" aria-hidden="true">
          {gameUi(incoming.icon)}
        </span>
        <div>
          <small>{gameUi("New Item")}</small>
          {incoming.rarity === "rare" && <span className="pp-rare-badge">{gameUi("★ RARE")}</span>}
          <strong>{gameUi(incoming.name)}</strong>
          <small>{gameUi(incoming.description)}</small>
        </div>
      </div>
      <p>
        {gameUi(mine
          ? "Replace one of your items, or discard the new one."
          : `${player.name} is choosing what to keep.`)}
      </p>
      {player.inventory.map((item, i) => {
        const definition = itemRegistry.get(item.itemId);
        return (
          <button
            key={item.instanceId}
            disabled={!mine || !online}
            onClick={() => onReplace(item.instanceId)}
          >
            <span aria-hidden="true">{gameUi(definition.icon)}</span>
            <span>{gameUi(" Replace Item ")}{gameUi(i + 1)}: {gameUi(definition.name)}
              {gameUi(definition.rarity === "rare" ? " ★ RARE" : "")}
            </span>
          </button>
        );
      })}
      <button
        className="pp-discard"
        disabled={!mine || !online}
        onClick={onDiscard}
      >{gameUi(" Discard new item ")}</button>
    </section>
  );
}
