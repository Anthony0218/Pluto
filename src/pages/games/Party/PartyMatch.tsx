import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import ItemShop from "./ItemShop.tsx";
import { routePreview } from "../../../games/party/engine/routePreview.ts";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { PartyConnection } from "../../../games/party/network/usePartyConnection.ts";
import {
  activePlayer,
  legalPaths,
} from "../../../games/party/engine/engine.ts";
import PlutoOffer from "./PlutoOffer.tsx";
import PropertyOffer, { PropertyDetails } from "./PropertyPanel.tsx";
import ItemPanel from "./ItemPanel.tsx";
import ItemOverflow from "./ItemOverflow.tsx";
import FeedbackToasts from "./FeedbackToasts.tsx";
import TargetPicker from "./TargetPicker.tsx";
import AimOverlay from "./AimOverlay.tsx";
import { useNewEvents } from "./useNewEvents.ts";
import { AnimalPhasePanel, StatusChips } from "./HazardPanels.tsx";
import { graphDistances } from "../../../games/party/engine/graph.ts";
import { reachableLandings } from "../../../games/party/engine/economy.ts";
import { cometMelonDamage } from "../../../games/party/items/definitions.ts";
import { falloutBlastNodes } from "../../../games/party/items/rare.ts";
import { itemRegistry } from "../../../games/party/items/registry.ts";
import {
  irradiatedNodeIds,
  radiationRoundsLeft,
} from "../../../games/party/hazards/radiation.ts";
import { animalRegistry } from "../../../games/party/animals/registry.ts";
import type { BoardOverlay } from "../../../games/party/board/renderer.ts";
import {
  COLORS,
  MAX_INVENTORY_SIZE,
  RULES,
} from "../../../games/party/config.ts";
import {
  mapRegistry,
  tilePresentationFor,
} from "../../../games/party/content/maps.ts";
import { spaceNumber } from "../../../games/party/engine/graph.ts";
import { blockedRoundsLeft } from "../../../games/party/engine/routes.ts";
import {
  availableTransport,
  slideAt,
  slideDestination,
  transportRoundsOut,
} from "../../../games/party/engine/transport.ts";
import TransportOffer from "./TransportPanel.tsx";
import type {
  DuelWager,
  ItemInstance,
  Lobby,
  Match,
} from "../../../games/party/types.ts";
import PartyBoard from "./PartyBoard.tsx";
import Portrait from "./PartyPortrait.tsx";
import PlayerStatus from "./PlayerStatus.tsx";
import FinalResults from "./FinalResults.tsx";
import DiceRoll from "./DiceRoll.tsx";
import type { Phase, Player } from "../../../games/party/types.ts";
// What everyone else sees while the active player decides: never a frozen-looking screen.
function waitingText(phase: Phase, active: Player, propertyName: string): string {
  const name = active.name;
  switch (phase) {
    case "ZERO_BONUS":
      return `Waiting for ${name} to choose +5 HP or +2 coins…`;
    case "ITEM_PHASE":
      return `Waiting for ${name} to use items or roll…`;
    case "ITEM_AIM":
      return `${name} is aiming…`;
    case "ITEM_REPLACE":
      return `Waiting for ${name} to choose which item to keep…`;
    case "PATH_SELECTION":
      return `Waiting for ${name} to choose a path…`;
    case "PLUTO_OFFER":
      return `Waiting for ${name} to decide on the Golden Pluto…`;
    case "PROPERTY_OFFER":
      return `Waiting for ${name} to decide on the ${propertyName}…`;
    case "TRANSPORT_OFFER":
      return `Waiting for ${name} to decide whether to ride…`;
    case "DICE_ROLL":
      return `${name} is rolling…`;
    default:
      return `${name} is on the move…`;
  }
}
export default function PartyMatch({
  connection,
  lobby,
  match,
}: {
  connection: PartyConnection;
  lobby: Lobby;
  match: Match;
}) {
  useGameLanguage();
  const { status, playerId, send, sessionEpoch, serverOffset } = connection;
  const online = status === "online",
    active = activePlayer(match),
    mine = active.id === playerId;
  // The map is part of the authoritative match; every client renders the one the server started.
  const map = useMemo(() => mapRegistry.get(match.mapId), [match.mapId]),
    presentation = tilePresentationFor(map),
    alpine = map.theme === "mountain";
  const [inspected, setInspected] = useState<string | null>(null);
  const [itemsOpen, setItemsOpen] = useState(false);
  const [boardOnly, setBoardOnly] = useState(true);
  const [boardView, setBoardView] = useState<"actions" | "board" | "whole">("actions");
  const [cameraReset, setCameraReset] = useState(0);
  const backToPawn = () => {
    setBoardView("actions");
    setCameraReset((value) => value + 1);
    setBoardOnly(true);
    setItemsOpen(false);
    setInspected(null);
  };
  // Unconfirmed board targeting is client-only; it belongs to the connection it started on, so a
  // reconnect cancels it safely (nothing was sent or consumed).
  const [aiming, setAiming] = useState<{
    item: ItemInstance;
    target: string | null;
    epoch: number;
  } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // Opponent-targeted items (Scatterblaster, Lucky Six, Duel Saber) open a picker first.
  const [picking, setPicking] = useState<ItemInstance | null>(null);
  const [explosion, setExplosion] = useState<{
    id: number;
    nodeId: string;
    kind: "melon" | "fallout";
  } | null>(null);
  const me = match.players.find((p) => p.id === playerId);
  const offeredProperty = match.properties.find(
    (p) => p.nodeId === active.currentNodeId,
  );
  const inspectedProperty = inspected
    ? match.properties.find((p) => p.nodeId === inspected)
    : undefined;
  const canUseItems =
    mine && online && match.phase === "ITEM_PHASE" && !match.turn.hasRolled;
  useNewEvents(match, (events) => {
    const blast = events.findLast(
      (e) => (e.kind === "EXPLOSION" || e.kind === "FALLOUT") && e.nodeId,
    );
    if (blast)
      setExplosion({
        id: blast.id,
        nodeId: blast.nodeId!,
        kind: blast.kind === "FALLOUT" ? "fallout" : "melon",
      });
  });
  const irradiated = irradiatedNodeIds(match);
  // Targeting is abandoned as soon as the server state no longer allows item use.
  const targetingItem = canUseItems && aiming?.epoch === sessionEpoch ? aiming : null;
  const pickingItem =
    canUseItems && picking && me?.inventory.some((i) => i.instanceId === picking.instanceId)
      ? picking
      : null;
  const aim = match.phase === "ITEM_AIM" ? match.turn.aim : null;
  const aimTarget = aim ? match.players.find((p) => p.id === aim.targetPlayerId) : undefined;
  const aimTargetNode = aimTarget?.currentNodeId ?? null;
  const fallout = targetingItem?.item.itemId === "fallout-core";
  const blastNodes =
    fallout && targetingItem?.target
      ? falloutBlastNodes(map, targetingItem.target)
      : null;
  const overlay = useMemo<BoardOverlay | null>(() => {
    // While someone aims, everyone sees the target's space highlighted.
    if (aimTargetNode) return { selected: aimTargetNode, damage: new Map() };
    if (!targetingItem) return null;
    if (targetingItem.item.itemId === "fallout-core")
      return {
        selected: targetingItem.target,
        damage: new Map(),
        blast: new Set(
          targetingItem.target ? falloutBlastNodes(map, targetingItem.target) : [],
        ),
      };
    const damage = new Map<string, number>();
    if (targetingItem.target)
      for (const [id, d] of graphDistances(map, targetingItem.target, 2))
        damage.set(id, cometMelonDamage(d));
    return { selected: targetingItem.target, damage };
  }, [targetingItem, aimTargetNode, map]);
  const falloutVictims = blastNodes
    ? match.players.filter(
        (p) => p.id !== playerId && blastNodes.includes(p.currentNodeId),
      )
    : [];
  const preview = targetingItem?.target && !fallout
    ? match.players
        .filter((p) => p.id !== playerId)
        .map((p) => ({
          player: p,
          damage: cometMelonDamage(
            graphDistances(map, targetingItem.target!, 2).get(
              p.currentNodeId,
            ),
          ),
        }))
    : [];
  const startItemUse = (item: ItemInstance) => {
    const targeting = itemRegistry.get(item.itemId).targeting;
    if (targeting === "node") {
      setAiming({ item, target: null, epoch: sessionEpoch });
      setItemsOpen(false);
    } else if (targeting === "player") {
      setPicking(item);
      setItemsOpen(false);
    } else
      send({
        type: "ACTION",
        action: { type: "USE_ITEM", itemInstanceId: item.instanceId },
      });
  };
  const viewBoard = (view: "board" | "whole") => {
    setBoardView(view);
    setBoardOnly(true);
    setItemsOpen(false);
    setInspected(null);
    setAiming(null);
    setPicking(null);
  };
  const targetPlayerWith = (item: ItemInstance, targetPlayerId: string, wager?: DuelWager) => {
    send({
      type: "ACTION",
      action: {
        type: "USE_ITEM",
        itemInstanceId: item.instanceId,
        targetPlayerId,
        ...(wager && { wager }),
      },
    });
    setPicking(null);
  };
  const selectNode = (id: string) => {
    if (targetingItem) {
      setAiming({ ...targetingItem, target: id });
      return;
    }
    if (mine && match.phase === "PATH_SELECTION" && legalPaths(match, map).includes(id)) {
      send({ type: "ACTION", action: { type: "SELECT_PATH", nodeId: id } }); return;
    }
    setInspected(id); setBoardOnly(false);
  };
  return (
    <section className="pp-match pp-board-match" data-board-only={boardOnly} data-board-view={boardView}>
      <FeedbackToasts match={match} />
      {me && <ItemShop match={match} player={me} connection={connection}/>}
      <div className="pp-match-heading">
        <div>
          <span className="pp-eyebrow">{gameUi(map.name.toUpperCase())}</span>
          <h1>{gameUi(" Round ")}{gameUi(match.round)}{gameUi(match.roundLimit ? ` / ${match.roundLimit}` : "")}
            <span>
              {gameUi(" ")}
              /{gameUi(" ")}
              {gameUi(match.phase === "START_ROLL"
                ? "Starting rolls"
                : match.phase === "GAME_OVER"
                  ? "Results"
                  : alpine
                    ? "Mountain climb"
                    : "Board adventure")}
            </span>
          </h1>
        </div>
        <div className="pp-match-goal">
          <span>{gameUi(" Central bank ")}<strong>◉ {gameUi(match.bank)}</strong>
          </span>
          <span>
            {gameUi(lobby.settings.victory === "coins"
              ? `First to ${lobby.settings.coinTarget} coins`
              : match.roundLimit ? `Most Golden Plutos after ${match.roundLimit} rounds` : `First to ${lobby.settings.plutoTarget} Golden Plutos`)}
          </span>
          {gameUi(match.phase !== "GAME_OVER" &&
            (confirmLeave ? (
              <span className="pp-leave-confirm" role="group" aria-label={gameUi("Leave the match?")}>
                <button className="pp-danger" onClick={() => send({ type: "LEAVE" })}>{gameUi(" Leave · a bot takes your seat ")}</button>
                <button onClick={() => setConfirmLeave(false)}>{gameUi("Stay")}</button>
              </span>
            ) : (
              <button onClick={() => setConfirmLeave(true)}>{gameUi("Leave")}</button>
            )))}
        </div>
      </div>
      <div className="pp-scoreboard">
        {match.players.map((p) => (
          <article
            key={p.id}
            className={`${p.id === active?.id ? "active" : ""} ${p.id === playerId ? "mine" : ""} ${!p.connected && !p.isBot ? "away" : ""}`}
            style={
              { "--pawn-color": COLORS[p.avatarId] } as React.CSSProperties
            }
          >
            <Portrait player={p} />
            <div>
              <strong>
                {p.name}
                {gameUi(p.id === playerId ? " · you" : "")}
              </strong>
              <small>
                <PlayerStatus player={p} serverOffset={serverOffset} />
                {gameUi(p.id === active?.id ? " · ▶ playing" : "")}
              </small>
              <div
                className={`pp-hp ${p.hp <= 10 ? "low" : ""}`}
                role="progressbar"
                aria-label={`${p.name} HP`}
                aria-valuemin={0}
                aria-valuemax={p.maxHp}
                aria-valuenow={p.hp}
              >
                <span style={{ width: `${(p.hp / p.maxHp) * 100}%` }} />
              </div>
            </div>
            <ul className="pp-hud-stats">
              <li aria-label={gameUi(`HP ${p.hp} of ${p.maxHp}`)}>
                ❤️ <b>{gameUi(p.hp)}</b> / {gameUi(p.maxHp)}
              </li>
              <li data-coin-counter={p.id} aria-label={gameUi(`${p.coins} coins`)}>
                🪙 <b>{gameUi(p.coins)}</b>
              </li>
              <li aria-label={gameUi(`${p.goldenPlutos} Golden Plutos`)}>
                ✦ <span className="pp-long-label">{gameUi("Golden Plutos: ")}</span>
                <b>{gameUi(p.goldenPlutos)}</b>
              </li>
              <li aria-label={gameUi(`${p.inventory.length} of ${MAX_INVENTORY_SIZE} items`)}>
                🎒{gameUi(" ")}
                <b>
                  {gameUi(p.inventory.length)} / {gameUi(MAX_INVENTORY_SIZE)}
                </b>
              </li>
            </ul>
            <StatusChips match={match} player={p} />
            {p.id === active.id && match.lastRoll !== null && (
              <DiceRoll key={`${match.round}-${match.turnIndex}`} rolling={match.phase === "DICE_ROLL"} value={match.lastRoll} name={p.name} />
            )}
          </article>
        ))}
      </div>
      <div className="pp-play-layout">
        <div>
          <PartyBoard
            map={map}
            match={match}
            onSelect={selectNode}
            overlay={overlay}
            explosion={explosion}
            cameraMode={boardView === "whole" ? "whole" : "pawn"}
            cameraReset={cameraReset}
          >
            {match.phase !== "GAME_OVER" && <div className="pp-board-commands" aria-label={gameUi("Board and turn controls")}>
              <span className="pp-board-command-title" role="status">
                {gameUi(boardView === "whole" ? "Whole board" : boardView === "board" ? "Explore the board" : mine ? "▶ YOUR TURN" : `${active.name.toUpperCase()}’S TURN`)}
              </span>
              {boardView === "actions" ? <>
                {mine && match.phase === "ITEM_PHASE" ? <div className="pp-board-actions">
                  <button disabled={!canUseItems || !me?.inventory.length} aria-expanded={itemsOpen} onClick={() => { setItemsOpen(!itemsOpen); setBoardOnly(itemsOpen); }}>{gameUi("🎒 Use item")}</button>
                  <button className="pp-primary" disabled={!canUseItems || !!targetingItem || !!pickingItem} onClick={() => { setItemsOpen(false); setBoardOnly(true); send({ type: "ACTION", action: { type: "ROLL_DICE" } }); }}>{gameUi("Roll dice ")}<ArrowRight size={16}/></button>
                </div> : <small className="pp-board-command-hint">{gameUi(mine && match.phase === "PATH_SELECTION" ? "Choose an arrow on the map" : waitingText(match.phase, active, map.propertyName))}</small>}
                <div className="pp-board-view-actions">
                  <button onClick={() => viewBoard("board")}>{gameUi("See board")}</button>
                  <button onClick={() => viewBoard("whole")}>{gameUi("See whole board")}</button>
                </div>
              </> : <div className="pp-board-view-actions">
                <button className="pp-primary" onClick={backToPawn}>{gameUi("← Back")}</button>
                <button onClick={() => viewBoard(boardView === "whole" ? "board" : "whole")}>{gameUi(boardView === "whole" ? "See board" : "See whole board")}</button>
              </div>}
            </div>}
          </PartyBoard>
          <div className="pp-legend">
            {(
              [
                "coin",
                "item",
                "rare",
                "heal",
                "deposit",
                "event",
                "warp",
                "hazard",
              ] as const
            ).map((t) => (
              <span key={t}>
                <b
                  style={{
                    background: `#${presentation[t].color.toString(16)}`,
                  }}
                >
                  {gameUi(presentation[t].icon)}
                </b>
                {gameUi(t === "deposit" ? "Bank deposit" : t === "rare" ? "rare item" : t)}
              </span>
            ))}
            {gameUi(alpine && (
              <>
                <span>
                  <b className="pp-legend-mech">❄</b>{gameUi("frozen slide (forced 2 spaces) ")}</span>
                <span>
                  <b className="pp-legend-mech">🚡</b>{gameUi("cable car / ⛏️ mine cart ")}</span>
              </>
            ))}
            <span>
              <b className="pp-legend-radiation">☢</b>{gameUi("radiation (land = irradiated) ")}</span>
            <span>
              <b className="pp-legend-animal">◆</b>{gameUi("summoned animal ")}</span>
            <span className="pp-hint">{gameUi("Tap any space to inspect")}</span>
          </div>
        </div>
        {((boardView === "actions" && mine) || (inspected && !boardOnly) || match.phase === "GAME_OVER") && <aside className={"pp-turn-panel pp-card" + (["ITEM_PHASE", "MOVEMENT", "DICE_ROLL", "TURN_END", "ANIMAL_PHASE", "ROUND_END"].includes(match.phase) ? " is-optional" : "")} id="pp-turn-panel">
          {match.phase !== "GAME_OVER" && <button className="pp-panel-close" onClick={() => { if (boardView === "actions") viewBoard("board"); else { setInspected(null); setBoardOnly(true); } }} aria-label={gameUi(boardView === "actions" ? "See the board" : "Close space details")}>✕</button>}
          {(boardView === "actions" || match.phase === "GAME_OVER") && <>
          {gameUi(match.phase === "ZERO_BONUS" && mine ? (
            <div className="pp-zero-choice"><span className="pp-eyebrow">{gameUi("A LUCKY LITTLE PAUSE")}</span><h2>{gameUi("Zero roll? Your choice.")}</h2><p>{gameUi("Recover or save for your next move.")}</p><button disabled={!online} onClick={() => send({ type: "ACTION", action: { type: "ZERO_REWARD", reward: "heal" } })}>{gameUi("✚ Heal 5 HP")}</button><button disabled={!online} onClick={() => send({ type: "ACTION", action: { type: "ZERO_REWARD", reward: "coins" } })}>{gameUi("🪙 Gain 2 coins")}</button></div>
          ) : match.phase === "GAME_OVER" ? (
            <FinalResults connection={connection} lobby={lobby} match={match} alpine={alpine} />
          ) : !mine ? null : match.phase === "ITEM_REPLACE" && match.pendingItem ? (
            <ItemOverflow
              player={active}
              match={match}
              mine={mine}
              online={online}
              onReplace={(replaceInstanceId) =>
                send({
                  type: "ACTION",
                  action: { type: "REPLACE_ITEM", replaceInstanceId },
                })
              }
              onDiscard={() =>
                send({ type: "ACTION", action: { type: "DISCARD_NEW_ITEM" } })
              }
            />
          ) : match.phase === "PROPERTY_OFFER" && offeredProperty ? (
            <PropertyOffer
              match={match}
              property={offeredProperty}
              name={map.propertyName}
              mine={mine}
              online={online}
              onBuy={() =>
                send({
                  type: "ACTION",
                  action: {
                    type: "BUY_PROPERTY",
                    nodeId: offeredProperty.nodeId,
                  },
                })
              }
              onUpgrade={() =>
                send({
                  type: "ACTION",
                  action: {
                    type: "UPGRADE_PROPERTY",
                    nodeId: offeredProperty.nodeId,
                  },
                })
              }
              onLeave={() =>
                send({ type: "ACTION", action: { type: "LEAVE_PROPERTY" } })
              }
            />
          ) : match.phase === "TRANSPORT_OFFER" &&
            availableTransport(match, map, active.currentNodeId) ? (
            <TransportOffer
              transport={availableTransport(match, map, active.currentNodeId)!}
              player={active}
              mine={mine}
              online={online}
              onRide={() =>
                send({
                  type: "ACTION",
                  action: {
                    type: "RIDE_TRANSPORT",
                    transportId: availableTransport(match, map, active.currentNodeId)!.id,
                  },
                })
              }
              onStay={() =>
                send({ type: "ACTION", action: { type: "DECLINE_TRANSPORT" } })
              }
            />
          ) : match.phase === "PLUTO_OFFER" ? (
            <PlutoOffer
              others={match.plutoNodeIds.length - 1}
              player={active}
              mine={mine}
              online={online}
              onBuy={() =>
                send({ type: "ACTION", action: { type: "BUY_PLUTO" } })
              }
              onLeave={() =>
                send({ type: "ACTION", action: { type: "LEAVE_PLUTO" } })
              }
            />
          ) : match.phase === "ANIMAL_PHASE" && match.animalPhase ? (
            <AnimalPhasePanel match={match} phase={match.animalPhase} />
          ) : match.phase === "ANIMAL_PHASE" || match.phase === "ROUND_END" ? (
            <>
              <span className="pp-eyebrow pp-turn-owner">
                {gameUi(match.phase === "ANIMAL_PHASE" ? "ANIMAL PHASE" : "NEXT ROUND")}
              </span>
              <h2>
                {gameUi(match.phase === "ANIMAL_PHASE"
                  ? "Minigame incoming!"
                  : alpine
                    ? "Back up the mountain."
                    : "Back to the islands.")}
              </h2>
              <p>
                {gameUi(match.phase === "ANIMAL_PHASE"
                  ? "Every explorer has moved. Get ready to play."
                  : "The minigame winner goes first.")}
              </p>
            </>
          ) : match.phase === "START_ROLL" ? (
            <>
              <span className="pp-eyebrow">{gameUi("WHO GOES FIRST?")}</span>
              <h2>{gameUi("Let fate decide.")}</h2>
              <div className="pp-die rolling">?</div>
              <p>{gameUi("Everyone rolls 0–10. Only tied players reroll.")}</p>
            </>
          ) : (
            <>
              <span className={`pp-eyebrow pp-turn-owner ${mine ? "is-mine" : ""}`}>
                {gameUi(mine ? "▶ YOUR TURN" : `${active?.name.toUpperCase()}’S TURN`)}
              </span>
              <h2>
                {gameUi(!mine
                  ? waitingText(match.phase, active, map.propertyName)
                  : match.phase === "PATH_SELECTION"
                    ? "Tap an arrow on the map."
                    : match.phase === "ITEM_AIM"
                      ? "Taking aim…"
                      : match.phase === "ITEM_PHASE"
                        ? "Adventure awaits."
                        : match.phase === "DICE_ROLL"
                          ? "A little suspense…"
                          : match.phase === "RESOLVE_TILE"
                            ? "You’ve arrived."
                            : "On the move.")}
              </h2>
              <p>
                {gameUi(aim && aimTarget
                  ? `🎯 ${active.name} is aiming the ${itemRegistry.get(aim.itemId).name} at ${aimTarget.name}${aim.band === "global" ? "" : ` (${aim.band}, ${aim.distance} space${aim.distance === 1 ? "" : "s"})`}…`
                  : match.phase === "ITEM_PHASE"
                  ? match.turn.bonusRolled
                    ? `Turbo Boots bonus: +${match.turn.bonusMovement}. Now roll 0–10.`
                    : alpine ? "Roll 0–10 and see where the mountain takes you." : "Roll 0–10 and see where the islands take you."
                  : match.turn.bonusMovement > 0
                    ? `Rolled ${match.lastRoll} + ${match.turn.bonusMovement} Turbo bonus = ${(match.lastRoll ?? 0) + match.turn.bonusMovement} · ${match.movesRemaining} moves remaining`
                    : `${match.movesRemaining} moves remaining`)}
              </p>
              {gameUi(me && itemsOpen && (
                <ItemPanel
                  player={me}
                  match={match}
                  interactive={online}
                  onUse={startItemUse}
                />
              ))}
              {gameUi(match.phase === "PATH_SELECTION" && (
                <details className="pp-path-alternatives"><summary>{gameUi("Other way to choose · ")}{gameUi(match.movesRemaining)}{gameUi(" steps left")}</summary><div className="pp-paths">
                  {legalPaths(match, map).map((id) => {
                    const node = map.nodes.find((n) => n.id === id)!;
                    // Hazard info is never hidden: radiation on the next space or on a possible landing.
                    const landings = reachableLandings(
                      map,
                      id,
                      active.currentNodeId,
                      Math.max(0, match.movesRemaining - 1),
                    );
                    const hotLandings = [...landings].filter((l) => irradiated.has(l)).length;
                    const hazard = irradiated.has(id)
                      ? match.movesRemaining === 1
                        ? "☢ lands on radiation"
                        : "☢ passes radiation"
                      : hotLandings
                        ? `☢ ${hotLandings} irradiated landing${hotLandings === 1 ? "" : "s"}`
                        : "";
                    return (
                      <button
                        key={id}
                        disabled={!mine || !online}
                        onClick={() => selectNode(id)}
                      >
                        <span>{gameUi(" ↗ Space ")}{gameUi(spaceNumber(id))}
                          <small>{gameUi(map.regions[node.region].name)}</small>
                          {routePreview(match, map, id).summaries.slice(0, 3).map((summary) => <small key={summary}>{gameUi(summary)}</small>)}
                          {hazard && <small className="pp-path-hazard">{gameUi(hazard)}</small>}
                          {gameUi(slideDestination(map, id) && (
                            <small className="pp-path-feature">{gameUi(" 🧊 Frozen slide → Space ")}{gameUi(spaceNumber(slideDestination(map, id)!))}
                            </small>
                          ))}
                          {gameUi(map.transports?.some((t) => t.endpoints.includes(id)) && (
                            <small className="pp-path-feature">
                              {gameUi(map.transports.find((t) => t.endpoints.includes(id))!.icon)}{gameUi(" ")}
                              {gameUi(map.transports.find((t) => t.endpoints.includes(id))!.name)}{gameUi(" station ")}</small>
                          ))}
                        </span>
                        <b>
                          {gameUi(match.plutoNodeIds.includes(id)
                            ? "✦"
                            : presentation[node.type].icon)}
                        </b>
                      </button>
                    );
                  })}
                </div></details>
              ))}
            </>
          ))}
          <details className="pp-board-details">
            <summary>{gameUi("Board details")}</summary>
          {match.startingRolls.length > 0 && (
            <details>
              <summary>{gameUi("Starting rolls & turn order")}</summary>
              {match.rollGroups.map((group, i) => (
                <p key={i}>
                  {gameUi(i + 1)}.{gameUi(" ")}
                  {gameUi(group
                    .map((id) => {
                      const p = match.players.find((p) => p.id === id)!;
                      return `${p.name} (${match.startingRolls
                        .filter((r) => r.playerId === id)
                        .map((r) => r.value)
                        .join(" → ")})`;
                    })
                    .join(" / "))}
                </p>
              ))}
            </details>
          )}
          <div className="pp-pluto-locations" aria-label={gameUi("Active Golden Plutos")}>
            <span className="pp-eyebrow">{gameUi(" GOLDEN PLUTOS · ◉ ")}{gameUi(RULES.plutoPrice)}{gameUi(" EACH ")}</span>
            <p>{gameUi("Land exactly on a glowing space to buy.")}</p>
            {match.plutoNodeIds.map((id) => {
              const node = map.nodes.find((n) => n.id === id)!;
              return (
                <div key={id}>
                  <b>{gameUi("✦ Space ")}{gameUi(spaceNumber(id))}</b>
                  <small>{gameUi(map.regions[node.region].name)}</small>
                </div>
              );
            })}
          </div>
          {gameUi((match.blockedConnections.length > 0 || match.transportOutages.length > 0) && (
            <div className="pp-closures" aria-label={gameUi("Route closures")}>
              <span className="pp-eyebrow">{gameUi("CLOSURES")}</span>
              {match.blockedConnections.map((b) => (
                <p key={b.id}>{gameUi(" ⛔ Path ")}{gameUi(spaceNumber(b.fromNodeId))} ↔ {gameUi(spaceNumber(b.toNodeId))}{gameUi(" · BLOCKED —")}{gameUi(" ")}
                  {gameUi(blockedRoundsLeft(match, b))}{gameUi(" ROUND")}{gameUi(blockedRoundsLeft(match, b) === 1 ? "" : "S")}
                </p>
              ))}
              {match.transportOutages.map((o) => (
                <p key={o.transportId}>
                  🔧 {gameUi(map.transports?.find((t) => t.id === o.transportId)?.name)}{gameUi(" closed ·")}{gameUi(" ")}
                  {gameUi(transportRoundsOut(match, o.transportId))}{gameUi(" round ")}{gameUi(transportRoundsOut(match, o.transportId) === 1 ? "" : "s")}{gameUi(" left ")}</p>
              ))}
            </div>
          ))}
          <div className="pp-feed" aria-live="polite">
            <span className="pp-eyebrow">{gameUi(alpine ? "TRAIL DISPATCH" : "ISLAND DISPATCH")}</span>
            {match.log.slice(0, 5).map((line, i) => (
              <p key={`${line}-${i}`}>{gameUi(line)}</p>
            ))}
          </div>
          </details>
          </>}
          {inspected && (
            <div className="pp-inspector">
              <strong>{gameUi("Space ")}{gameUi(spaceNumber(inspected))}</strong>
              <small>{gameUi(map.regions[map.nodes.find((n) => n.id === inspected)!.region].name)}</small>
              {map.cleansingNodeIds?.includes(inspected) && <p>{gameUi("✚ Cleansing spring · removes all negative effects and heals 10 HP.")}</p>}
              {gameUi(match.plutoNodeIds.includes(inspected) && (
                <p>{gameUi(" ✦ Golden Pluto · ")}{gameUi(RULES.plutoPrice)}{gameUi(" coins · land here to buy ")}</p>
              ))}
              {!map.cleansingNodeIds?.includes(inspected) && !match.boardEffects?.some((e) => e.kind === "relic" && e.nodeIds.includes(inspected)) && <p>
                {
                  gameUi(presentation[
                    map.nodes.find((n) => n.id === inspected)!.type
                  ].label)
                }
              </p>}
              {match.boardEffects?.filter((e) => e.nodeIds.includes(inspected)).map((e) => <p key={e.id}>{gameUi(({ treasure: "💎 Collect +5 treasure coins once", eruption: "⚠ Take 10 HP damage if still here", breeze: "🍃 Land here for +2 bonus coins", sanctuary: "💚 Land here for +5 extra HP", sale: "🛍 Save 2 coins on normal shop items while here", relic: "◆ Collect an item once, instead of the normal field" })[e.kind])} · {gameUi(e.kind === "eruption" ? "at the end of" : "through")}{gameUi(" round ")}{gameUi(e.expiresAfterRound)}.</p>)}
              {gameUi(map.slides?.some((sl) => sl.nodeId === inspected) && (
                <p>{gameUi(" 🧊 Frozen Slide · after this space resolves you slide")}{gameUi(" ")}
                  {gameUi(slideAt(map, inspected)!.path.length)}{gameUi(" spaces to Space")}{gameUi(" ")}
                  {gameUi(spaceNumber(slideDestination(map, inspected)!))}{gameUi(", which resolves once. ")}</p>
              ))}
              {map.transports
                ?.filter((t) => t.endpoints.includes(inspected))
                .map((t) => (
                  <p key={t.id}>
                    {gameUi(t.icon)} {gameUi(t.endpointNames[t.endpoints.indexOf(inspected)])}{gameUi(" · ride to")}{gameUi(" ")}
                    {gameUi(t.endpointNames[1 - t.endpoints.indexOf(inspected)])}{gameUi(" (Space")}{gameUi(" ")}
                    {gameUi(spaceNumber(t.endpoints[1 - t.endpoints.indexOf(inspected)]))}{gameUi(") when you land here. ")}{gameUi(transportRoundsOut(match, t.id) > 0 && " Currently closed.")}
                  </p>
                ))}
              {gameUi(irradiated.has(inspected) && !map.cleansingNodeIds?.includes(inspected) && (
                <p className="pp-inspect-radiation">{gameUi(" ☢ Irradiated · ")}{gameUi(radiationRoundsLeft(match, inspected))}{gameUi(" round ")}{gameUi(radiationRoundsLeft(match, inspected) === 1 ? "" : "s")}{gameUi(" left (including this one). Landing here gives Radiation: −10 HP per turn for 3 turns and no items. ")}</p>
              ))}
              {match.animals
                .filter((a) => a.currentNodeId === inspected)
                .map((a) => (
                  <p key={a.id}>
                    {gameUi(animalRegistry.get(a.type).icon)}{gameUi(" ")}
                    {match.players.find((p) => p.id === a.ownerPlayerId)?.name}
                    ’s {gameUi(animalRegistry.get(a.type).name)} · {gameUi(a.movementPerPhase)}{gameUi(" ")}{gameUi(" spaces/phase · ")}{gameUi(a.damage)}{gameUi(" dmg · ")}{gameUi(a.remainingRounds)}{gameUi(" rounds left ")}</p>
                ))}
              {gameUi(inspectedProperty && (
                <PropertyDetails
                  match={match}
                  property={inspectedProperty}
                  name={map.propertyName}
                />
              ))}
            </div>
          )}

        </aside>}
      </div>
      {gameUi(pickingItem && me && (
        <TargetPicker
          match={match}
          me={me}
          definition={itemRegistry.get(pickingItem.itemId)}
          onCancel={() => setPicking(null)}
          onConfirm={(targetPlayerId, wager) => targetPlayerWith(pickingItem, targetPlayerId, wager)}
        />
      ))}
      {gameUi(aim && mine && online && (
        <AimOverlay
          key={`${aim.itemInstanceId}-${aim.startedAt}`}
          match={match}
          aim={aim}
          onFire={(aimX, aimY, elapsedMs) =>
            send({ type: "ACTION", action: { type: "FIRE_ITEM", aimX, aimY, elapsedMs } })
          }
          onCancel={() => send({ type: "ACTION", action: { type: "CANCEL_AIM" } })}
        />
      ))}
      {targetingItem && (
        <div
          className={`pp-target-bar ${fallout ? "fallout" : ""}`}
          role="dialog"
          aria-label={gameUi(fallout ? "Target Fallout Core" : "Aim Comet Melon")}
        >
          <div>
            <strong>{gameUi(fallout ? "☢️ Fallout Core · ★ RARE" : "🍉 Comet Melon")}</strong>
            <small>
              {gameUi(fallout
                ? blastNodes
                  ? `Blast: centre + ${blastNodes.length - 1} connected spaces, irradiated for 3 full rounds. You are immune to the blast.`
                  : "Tap a space on the board. The blast covers it and every directly connected space."
                : targetingItem.target
                  ? "Blast zone shown on the board: 15 at the target, 10 one space away, 5 two away."
                  : "Tap a space on the board to aim.")}
            </small>
            {fallout && blastNodes && (
              <small className="pp-fallout-warning">
                {gameUi(falloutVictims.length
                  ? `⚠ KO: ${falloutVictims.map((p) => p.name).join(", ")} — they respawn at Start with Radiation.`
                  : "No opponent is inside the blast right now.")}
              </small>
            )}
            {preview.length > 0 && (
              <small>
                {gameUi(preview
                  .map((v) =>
                    v.damage
                      ? `${v.player.name} −${v.damage}`
                      : `${v.player.name} safe`,
                  )
                  .join(" · "))}
              </small>
            )}
          </div>
          <button
            className="pp-primary"
            disabled={!targetingItem.target}
            onClick={() => {
              send({
                type: "ACTION",
                action: {
                  type: "USE_ITEM",
                  itemInstanceId: targetingItem.item.instanceId,
                  targetNodeId: targetingItem.target!,
                },
              });
              setAiming(null);
            }}
          >
            {gameUi(fallout ? "☢ Detonate" : "Confirm")}
          </button>
          <button onClick={() => setAiming(null)}>{gameUi("Cancel")}</button>
        </div>
      )}
    </section>
  );
}
