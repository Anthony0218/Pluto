import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useState } from "react";
import { SHOP_PRICES, MYSTERY_PRICE, shopPrice } from "../../../games/party/items/shop.ts";
import { itemRegistry } from "../../../games/party/items/registry.ts";
import type { Match, Player } from "../../../games/party/types.ts";
import type { PartyConnection } from "../../../games/party/network/usePartyConnection.ts";
export default function ItemShop({ match, player, connection }: { match: Match; player: Player; connection: PartyConnection }) {
  useGameLanguage();
  const [open, setOpen] = useState(false);
  if (match.phase === "GAME_OVER" || match.mode === "festival") return null;
  const bought = player.lastPurchaseRound === match.round, full = player.inventory.length >= 3;
  const unavailable = bought || full || connection.status !== "online" || match.phase === "START_ROLL";
  const sale = match.boardEffects?.some((e) => e.kind === "sale" && e.nodeIds.includes(player.currentNodeId));
  const buy = (mystery: boolean, itemId?: string) => connection.send({ type: "ACTION", action: { type: "BUY_ITEM", mystery, ...(itemId && { itemId }) } });
  return <div className="pp-shop"><button className="pp-shop-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>{gameUi("🛍 Shop ")}<small>{gameUi(bought ? "Purchased this round" : "1 purchase / round")}</small></button>
    {open && <section className="pp-shop-panel" aria-label={gameUi("Item shop")}><header><div><span className="pp-eyebrow">{gameUi("PLUTO SUPPLY CO.")}</span><h3>{gameUi("Plan your next move.")}</h3></div><button onClick={() => setOpen(false)} aria-label={gameUi("Close shop")}>✕</button></header>
      <p>{gameUi(bought ? "Your round purchase is used. Come back next round." : full ? "Your three inventory slots are full." : `Shop while you wait. Purchases unlock in round ${match.round + 1}.`)}</p>
      {sale && <p className="pp-shop-sale">{gameUi("🛍 Coconut Market · normal items cost 2 coins less!")}</p>}
      <div className="pp-shop-stock">{Object.keys(SHOP_PRICES).map((id) => { const item = itemRegistry.get(id), price = shopPrice(match, player.id, id)!; return <button key={id} title={gameUi(item.description)} disabled={unavailable || player.coins < price} onClick={() => buy(false, id)}><span>{gameUi(item.icon)}</span><b>{gameUi(item.name)}</b><small>🪙 {gameUi(price)}</small></button>; })}</div>
      <button className="pp-mystery-box" disabled={unavailable || player.coins < MYSTERY_PRICE} onClick={() => buy(true)}><span>🎁</span><b>{gameUi("Mystery box ")}<small>{gameUi("Every item is possible · common to rare")}</small></b><strong>🪙 10</strong></button>
      <small>{gameUi("The shop and mystery box share one purchase per round. All 9 items have an equal chance in the box.")}</small>
    </section>}
  </div>;
}
