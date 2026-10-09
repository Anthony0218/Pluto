import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useState } from "react";
import { COLORS, DUEL_CONFIG } from "../../../games/party/config.ts";
import { tropical } from "../../../games/party/content/maps.ts";
import {
  canChallenge,
  canWagerCoins,
  canWagerPluto,
  maxCoinWager,
} from "../../../games/party/duels/wager.ts";
import type { ItemDefinition } from "../../../games/party/items/types.ts";
import type { DuelWager, Match, Player } from "../../../games/party/types.ts";
import Portrait from "./PartyPortrait.tsx";

// Legality shown here mirrors the server rules for convenience; the server re-validates everything.
function targetStatus(
  match: Match,
  definition: ItemDefinition,
  me: Player,
  target: Player,
): { legal: boolean; note: string } {
  if (definition.id === "pocket-duel")
    return { legal: true, note: "No wager · winner gets +1 new Golden Pluto" };
  if (definition.id === "duel-saber")
    return canChallenge(me, target)
      ? { legal: true, note: `Can stake up to ${maxCoinWager(me, target)} coins` }
      : { legal: false, note: "Neither of you can cover a wager" };
  const range = definition.aim?.range(match, tropical, me.id, target.id);
  if (!range) return { legal: false, note: "Out of range (more than 5 spaces)" };
  if (range.band === "global") return { legal: true, note: "Any distance" };
  return {
    legal: true,
    note: `${range.band.toUpperCase()} · ${range.distance} space${range.distance === 1 ? "" : "s"} away`,
  };
}

function WagerPicker({
  me,
  target,
  onBack,
  onConfirm,
}: {
  me: Player;
  target: Player;
  onBack: () => void;
  onConfirm: (wager: DuelWager) => void;
}) {
  useGameLanguage();
  const max = maxCoinWager(me, target);
  const [wager, setWager] = useState<DuelWager | null>(null);
  // Custom mode is explicit, so stepping the custom amount onto 5/10/20 keeps the custom controls open.
  const [isCustom, setIsCustom] = useState(false);
  const [custom, setCustom] = useState(Math.max(1, Math.min(max, 15)));
  const setCustomAmount = (value: number) => {
    const amount = Math.max(DUEL_CONFIG.minCustomCoins, Math.min(max, Math.round(value) || 1));
    setCustom(amount);
    setWager({ type: "coins", amount });
  };
  const selected = (w: DuelWager) =>
    !isCustom && wager?.type === w.type && wager.amount === w.amount ? "selected" : "";
  const customLegal = max >= DUEL_CONFIG.minCustomCoins;
  const choose = (w: DuelWager) => {
    setIsCustom(false);
    setWager(w);
  };
  return (
    <>
      <span className="pp-eyebrow">{gameUi("CHALLENGE ")}{target.name.toUpperCase()}</span>
      <h2>{gameUi("Choose wager")}</h2>
      <p className="pp-sheet-note">{gameUi(" Both duelists stake the same amount; the winner takes the whole pot. ")}{target.name}{gameUi(" has 🪙")}{gameUi(" ")}
        {gameUi(target.coins)}{gameUi(" and ✦ ")}{gameUi(target.goldenPlutos)}{gameUi(". They cannot refuse. ")}</p>
      <div className="pp-wagers" role="radiogroup" aria-label={gameUi("Wager")}>
        {DUEL_CONFIG.coinPresets.map((amount) => {
          const legal = canWagerCoins(me, target, amount);
          return (
            <button
              key={amount}
              role="radio"
              aria-checked={!!selected({ type: "coins", amount })}
              className={selected({ type: "coins", amount })}
              disabled={!legal}
              onClick={() => choose({ type: "coins", amount })}
            >
              <b>{gameUi(amount)}</b>{gameUi(" coins ")}{!legal && <small>{gameUi("not covered")}</small>}
            </button>
          );
        })}
        <button
          role="radio"
          aria-checked={isCustom}
          className={isCustom ? "selected" : ""}
          disabled={!customLegal}
          onClick={() => {
            setIsCustom(true);
            setCustomAmount(custom);
          }}
        >
          <b>{gameUi("Custom")}</b>
          <small>1–{gameUi(max)}</small>
        </button>
        <button
          role="radio"
          aria-checked={wager?.type === "pluto"}
          className={wager?.type === "pluto" ? "selected pluto" : "pluto"}
          disabled={!canWagerPluto(me, target)}
          onClick={() => choose({ type: "pluto", amount: 1 })}
        >
          <b>✦ 1</b>{gameUi(" Golden Pluto ")}{!canWagerPluto(me, target) && <small>{gameUi("both need one")}</small>}
        </button>
      </div>
      {gameUi(isCustom && (
        <div className="pp-custom-wager">
          <button aria-label={gameUi("One coin less")} onClick={() => setCustomAmount(custom - 1)} disabled={custom <= 1}>
            −
          </button>
          <label>
            <span className="sr-only">{gameUi("Custom coin wager")}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={max}
              value={custom}
              onChange={(e) => setCustomAmount(Number(e.target.value))}
            />
          </label>
          <button aria-label={gameUi("One coin more")} onClick={() => setCustomAmount(custom + 1)} disabled={custom >= max}>
            +
          </button>
          <input
            type="range"
            min={1}
            max={max}
            value={custom}
            aria-label={gameUi("Custom coin wager slider")}
            onChange={(e) => setCustomAmount(Number(e.target.value))}
          />
        </div>
      ))}
      <div className="pp-sheet-actions">
        <button onClick={onBack}>{gameUi("Back")}</button>
        <button className="pp-primary" disabled={!wager} onClick={() => wager && onConfirm(wager)}>{gameUi(" ⚔️ Duel! ")}</button>
      </div>
    </>
  );
}

// Bottom sheet for opponent-targeted items: pick a legal opponent, then (Duel Saber) a wager.
export default function TargetPicker({
  match,
  me,
  definition,
  onCancel,
  onConfirm,
}: {
  match: Match;
  me: Player;
  definition: ItemDefinition;
  onCancel: () => void;
  onConfirm: (targetPlayerId: string, wager?: DuelWager) => void;
}) {
  useGameLanguage();
  const [targetId, setTargetId] = useState<string | null>(null);
  const target = match.players.find((p) => p.id === targetId);
  const isDuel = definition.id === "duel-saber",
    isPocket = definition.id === "pocket-duel";
  return (
    <div className="pp-sheet" role="dialog" aria-label={gameUi(`${definition.name} target`)}>
      {isDuel && target ? (
        <WagerPicker
          me={me}
          target={target}
          onBack={() => setTargetId(null)}
          onConfirm={(wager) => onConfirm(target.id, wager)}
        />
      ) : (
        <>
          <span className="pp-eyebrow">
            {gameUi(definition.icon)} {gameUi(definition.rarity === "rare" ? "★ RARE · " : "")}
            {gameUi(definition.name.toUpperCase())}
          </span>
          <h2>{gameUi(isDuel || isPocket ? "Who do you challenge?" : "Choose a target")}</h2>
          <p className="pp-sheet-note">{gameUi(definition.description)}</p>
          <ul className="pp-targets">
            {match.players
              .filter((p) => p.id !== me.id)
              .map((p) => {
                const status = targetStatus(match, definition, me, p);
                return (
                  <li key={p.id}>
                    <button
                      disabled={!status.legal}
                      className={targetId === p.id ? "selected" : ""}
                      aria-pressed={targetId === p.id}
                      onClick={() => setTargetId(p.id)}
                      style={{ "--pawn-color": COLORS[p.avatarId] } as React.CSSProperties}
                    >
                      <Portrait player={p} />
                      <span>
                        <strong>{p.name}</strong>
                        <small>{gameUi(status.note)}</small>
                      </span>
                      <span className="pp-target-stats">
                        {gameUi(isDuel || isPocket ? (
                          <>
                            🪙 {gameUi(p.coins)} · ✦ {gameUi(p.goldenPlutos)}
                          </>
                        ) : (
                          <>❤️ {gameUi(p.hp)}</>
                        ))}
                        <small>{gameUi("Space ")}{gameUi(Number(p.currentNodeId.split("-")[1]) + 1)}</small>
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
          <div className="pp-sheet-actions">
            <button onClick={onCancel}>{gameUi("Cancel")}</button>
            {gameUi(!isDuel && (
              <button
                className="pp-primary"
                disabled={!targetId}
                onClick={() => targetId && onConfirm(targetId)}
              >
                {gameUi(isPocket ? "🎮 Start duel" : "Take aim")}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
