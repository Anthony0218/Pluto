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
  const incoming = itemRegistry.get(match.pendingItem!.itemId);
  return (
    <section className="pp-overflow" aria-label="Inventory full">
      <span className="pp-eyebrow">INVENTORY FULL</span>
      <div className="pp-overflow-new">
        <span className="pp-item-icon" aria-hidden="true">
          {incoming.icon}
        </span>
        <div>
          <small>New Item</small>
          {incoming.rarity === "rare" && <span className="pp-rare-badge">★ RARE</span>}
          <strong>{incoming.name}</strong>
          <small>{incoming.description}</small>
        </div>
      </div>
      <p>
        {mine
          ? "Replace one of your items, or discard the new one."
          : `${player.name} is choosing what to keep.`}
      </p>
      {player.inventory.map((item, i) => {
        const definition = itemRegistry.get(item.itemId);
        return (
          <button
            key={item.instanceId}
            disabled={!mine || !online}
            onClick={() => onReplace(item.instanceId)}
          >
            <span aria-hidden="true">{definition.icon}</span>
            <span>
              Replace Item {i + 1}: {definition.name}
              {definition.rarity === "rare" ? " ★ RARE" : ""}
            </span>
          </button>
        );
      })}
      <button
        className="pp-discard"
        disabled={!mine || !online}
        onClick={onDiscard}
      >
        Discard new item
      </button>
    </section>
  );
}
