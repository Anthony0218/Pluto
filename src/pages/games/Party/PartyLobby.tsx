import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { minigameRegistry } from "../../../games/party/minigames/index.ts";
import { DIFFICULTIES, DIFFICULTY_LABELS, DIFFICULTY_DESCRIPTIONS } from "../../../games/party/difficulty.ts";
import InviteFriendButton from "@/components/chess/InviteFriendButton";
import { useState } from "react";
import { ArrowRight, Check, Copy, Plus, X } from "lucide-react";
import type { PartyConnection } from "../../../games/party/network/usePartyConnection.ts";
import type {
  Lobby,
  Difficulty,
  Settings,
} from "../../../games/party/types.ts";
import { mapRegistry } from "../../../games/party/content/maps.ts";
import Portrait from "./PartyPortrait.tsx";
import PlayerStatus from "./PlayerStatus.tsx";
export default function PartyLobby({
  connection,
  lobby,
}: {
  connection: PartyConnection;
  lobby: Lobby;
}) {
  useGameLanguage();
  const { status, playerId, send, pending, serverOffset } = connection;
  const online = status === "online",
    host = lobby.hostId === playerId,
    me = lobby.players.find((p) => p.id === playerId);
  const [copied, setCopied] = useState(false);
  const map = mapRegistry.get(lobby.settings.mapId);
  // Why "Set sail" is disabled, in words (not only a greyed-out button).
  const notReady = lobby.players.filter((p) => !p.isBot && !p.ready && p.connected),
    away = lobby.players.filter((p) => !p.isBot && !p.connected),
    needsSeats = !lobby.settings.fillBots && lobby.players.length < 4;
  const startBlocker = away.length
    ? `Waiting for ${away.map((p) => p.name).join(", ")} to reconnect…`
    : me && !me.ready
      ? "Tap “I’m ready” when you are."
      : notReady.length
        ? `Waiting for ${notReady.map((p) => p.name).join(", ")} to get ready…`
      : needsSeats
        ? "Add bots or turn on “Fill empty seats with bots” to start."
        : null;
  const updateSettings = (patch: Partial<Settings>) =>
    send({ type: "SETTINGS", settings: { ...lobby.settings, ...patch } });
  return (
    <section className="pp-lobby-screen">
      <div className="pp-title-row">
        <div>
          <span className="pp-eyebrow">{gameUi("THE CREW IS COMING TOGETHER")}</span>
          <h1>{lobby.name}</h1>
          <p>
            {gameUi(lobby.public ? "Public lobby" : "Private lobby")} · {gameUi(lobby.settings.mode === "festival" ? "Minigame Festival" : map.name)} ·{gameUi(" ")}
            {gameUi(lobby.players.length)}{gameUi("/4 explorers ")}</p>
        </div>
        <button
          className="pp-code"
          aria-label={`Lobby code ${lobby.code}. Copy to clipboard`}
          onClick={() => {
            // The Clipboard API is missing on insecure origins; the code stays visible either way.
            navigator.clipboard
              ?.writeText(lobby.code)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })
              .catch(() => setCopied(false));
          }}
        >
          <Copy size={16} aria-hidden="true" />
          {gameUi(copied ? "Copied!" : lobby.code)}
        </button>
      </div>
      <div className="pp-lobby-columns">
        <div>
          <div className="pp-slots">
            {Array.from({ length: 4 }, (_, i) => {
              const p = lobby.players[i];
              return (
                <article
                  className={`pp-slot ${p ? "" : "empty"}`}
                  key={p?.id ?? i}
                >
                  {p ? (
                    <>
                      <Portrait player={p} />
                      <div>
                        <strong>
                          {p.name}
                          {gameUi(p.id === playerId ? " (you)" : "")}
                        </strong>
                        <small>
                          {gameUi(p.id === lobby.hostId ? "Host · " : "")}
                          <PlayerStatus player={p} serverOffset={serverOffset} />
                        </small>
                      </div>
                      <span className={`pp-ready ${p.ready ? "yes" : ""}`}>
                        {gameUi(p.ready ? (
                          <>
                            <Check size={14} />{gameUi(" Ready ")}</>
                        ) : (
                          "Not ready"
                        ))}
                      </span>
                      {p.isBot && host && (
                        <select
                          aria-label={`${p.name} difficulty`}
                          value={p.difficulty}
                          onChange={(e) =>
                            send({
                              type: "BOT_DIFFICULTY",
                              playerId: p.id,
                              difficulty: e.target.value as Difficulty,
                            })
                          }
                        >
                          {DIFFICULTIES.map((d) => (
                            <option key={d} value={d}>{gameUi(DIFFICULTY_LABELS[d])}</option>
                          ))}
                        </select>
                      )}
                      {host && p.id !== playerId && (
                        <button
                          className="pp-icon"
                          aria-label={`Remove ${p.name}`}
                          onClick={() =>
                            send({ type: "REMOVE", playerId: p.id })
                          }
                        >
                          <X size={16} />
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="pp-empty-avatar">+</span>
                      <div>
                        <strong>{gameUi("A seat for trouble")}</strong>
                        <small>{gameUi("Invite a friend with your lobby code")}</small>
                      </div>
                      <InviteFriendButton room={{ lobbyRoute: "/games/pluto-party", code: lobby.code }} />
                      {gameUi(host && (
                        <button onClick={() => send({ type: "ADD_BOT" })}>
                          <Plus size={15} />{gameUi(" Add bot ")}</button>
                      ))}
                    </>
                  )}
                </article>
              );
            })}
          </div>
          <div className="pp-lobby-actions">
            <button
              disabled={!online}
              className="pp-primary"
              onClick={() => send({ type: "READY", ready: !me?.ready })}
            >
              {gameUi(me?.ready ? "Unready" : "I’m ready")} <Check size={18} />
            </button>
            {gameUi(host && (
              <button
                className="pp-primary pp-dark"
                disabled={!online || !!startBlocker || pending === "start"}
                aria-busy={pending === "start"}
                onClick={() => send({ type: "START" })}
              >
                {gameUi(pending === "start" ? (
                  <>
                    <span className="pp-spinner small" aria-hidden="true" />{gameUi(" Starting… ")}</>
                ) : (
                  <>
                    {gameUi(lobby.settings.mode === "festival" ? "Start festival" : "Set sail")} <ArrowRight size={18} />
                  </>
                ))}
              </button>
            ))}
            <button disabled={!online} onClick={() => send({ type: "LEAVE" })}>{gameUi(" Leave lobby ")}</button>
          </div>
          <p className="pp-help" role="status">
            {gameUi(startBlocker ??
              (host
                ? lobby.settings.mode === "festival" ? "Everyone is ready. Start the festival when you like." : "Everyone is ready. Set sail when you like."
                : `Waiting for ${lobby.players.find((p) => p.id === lobby.hostId)?.name ?? "the host"} to start the match…`))}{gameUi(" ")}{gameUi(" Changing match settings resets readiness. ")}</p>
        </div>
        <aside className="pp-card pp-settings">
          <h2>{gameUi("Your island, your rules.")}</h2>
          <fieldset disabled={!host || !online}>
            <div className="pp-mode-picker" role="radiogroup" aria-label={gameUi("Party mode")}>
              {(["board", "festival"] as const).map((mode) => <button key={mode} type="button" role="radio" aria-checked={(lobby.settings.mode ?? "board") === mode} className={(lobby.settings.mode ?? "board") === mode ? "selected" : ""} onClick={() => {
                const lengths = mode === "festival" ? [3, 5, 8, 12] : [0, 8, 12, 16];
                updateSettings({ mode, roundLimit: lengths.includes(lobby.settings.roundLimit ?? 0) ? lobby.settings.roundLimit : mode === "festival" ? 5 : 12 });
              }}><b>{gameUi(mode === "board" ? "🏝 Board Party" : "🎪 Minigame Festival")}</b><small>{gameUi(mode === "board" ? "Explore, shop and compete" : "Only minigames · choose your lineup")}</small></button>)}
            </div>
            <label>{gameUi("Match length")}<select value={lobby.settings.roundLimit ?? 0} onChange={(e) => updateSettings({ roundLimit: Number(e.target.value) })}>
              {(lobby.settings.mode !== "festival" ? [0, 8, 12, 16] : [3, 5, 8, 12]).map((n) => <option key={n} value={n}>{gameUi(n ? `${n} rounds · fixed ending` : "Race to the target")}</option>)}
            </select></label>
            <details className="pp-lineup" open={lobby.settings.mode === "festival"}>
              <summary>{gameUi("Minigame lineup · ")}{gameUi(lobby.settings.minigameIds?.length || "all")}{gameUi(" selected")}</summary>
              <p>{gameUi("All games play once before repeating. An empty selection includes every game.")}</p>
              {minigameRegistry.pool("main").map((game) => <label key={game.id} className="pp-checkbox"><input type="checkbox" checked={lobby.settings.minigameIds?.includes(game.id) ?? false} onChange={(e) => updateSettings({ minigameIds: e.target.checked ? [...(lobby.settings.minigameIds ?? []), game.id] : (lobby.settings.minigameIds ?? []).filter((id) => id !== game.id) })}/><span>{gameUi(game.name)}<small>{gameUi(game.durationSeconds)}s · {gameUi(game.description)}</small></span></label>)}
            </details>
            {lobby.settings.mode !== "festival" && <><div role="radiogroup" aria-label={gameUi("Map")} className="pp-map-picker">
              {mapRegistry.all().map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={lobby.settings.mapId === m.id}
                  className={`pp-map-card pp-map-${m.theme} ${lobby.settings.mapId === m.id ? "selected" : ""}`}
                  onClick={() => lobby.settings.mapId !== m.id && updateSettings({ mapId: m.id })}
                >
                  <span className="pp-map-thumb" aria-hidden="true" />
                  <strong>{gameUi(m.theme === "tropical" ? "TROPICAL ISLANDS" : m.name.toUpperCase())}</strong>
                  <small>{gameUi(m.tagline)}</small>
                  <small>
                    {gameUi(m.goldenPlutoCount)}{gameUi(" active Golden Pluto ")}{gameUi(m.goldenPlutoCount === 1 ? "" : "s")} · {gameUi(m.nodes.length)}{gameUi(" spaces ")}</small>
                </button>
              ))}
            </div>
            <p className="pp-help">{gameUi(map.description)}</p>
            <label>
              {gameUi(lobby.settings.roundLimit ? "Rank matches by" : "Victory condition")}
              <select
                value={lobby.settings.victory}
                onChange={(e) =>
                  updateSettings({
                    victory: e.target.value as Settings["victory"],
                  })
                }
              >
                <option value="plutos">{gameUi("Golden Plutos")}</option>
                <option value="coins">{gameUi("Coins")}</option>
              </select>
            </label>
            {gameUi(!lobby.settings.roundLimit && (lobby.settings.victory === "plutos" ? (
              <label>{gameUi(" Golden Pluto target ")}<select
                  value={lobby.settings.plutoTarget}
                  onChange={(e) =>
                    updateSettings({ plutoTarget: Number(e.target.value) })
                  }
                >
                  {[3, 5, 7, 10].map((n) => (
                    <option key={n} value={n}>
                      {gameUi(n)}{gameUi(" Golden Plutos ")}</option>
                  ))}
                </select>
              </label>
            ) : (
              <label>{gameUi(" Coin target ")}<select
                  value={lobby.settings.coinTarget}
                  onChange={(e) =>
                    updateSettings({ coinTarget: Number(e.target.value) })
                  }
                >
                  {[100, 150, 200, 250, 300].map((n) => (
                    <option key={n} value={n}>
                      {gameUi(n)}{gameUi(" coins ")}</option>
                  ))}
                </select>
              </label>
            )))}
            </>}
            <label>{gameUi(" New bot difficulty ")}<select
                value={lobby.settings.difficulty}
                onChange={(e) =>
                  updateSettings({ difficulty: e.target.value as Difficulty })
                }
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>{gameUi(DIFFICULTY_LABELS[d])}</option>
                ))}
              </select>
            </label>
            <p className="pp-help">{gameUi(DIFFICULTY_DESCRIPTIONS[lobby.settings.difficulty])}</p>
            <label className="pp-checkbox">
              <input
                type="checkbox"
                checked={lobby.settings.fillBots}
                onChange={(e) => updateSettings({ fillBots: e.target.checked })}
              />{gameUi(" ")}{gameUi(" Fill empty seats with bots ")}</label>
          </fieldset>
          <p className="pp-help">
            {gameUi(lobby.settings.mode === "festival" ? "Jump straight into your chosen minigames. Individual games award 3 / 2 / 1 / 0 festival points; team games award 3 to each winner and 1 to each opponent (2 each for a draw). The player with the most festival points after the final round wins." : <>{gameUi(map.goldenPlutoCount === 1
              ? "One Golden Pluto is hidden on the mountain."
              : `${map.goldenPlutoCount === 2 ? "Two" : map.goldenPlutoCount} Golden Plutos are hidden around the islands.`)}{gameUi(" ")}{gameUi(" Land on one and pay 20 coins to collect it. Choose Golden Plutos or coins to win. Item fields hand out heals, boosts, weapons and duels; the single Rare field hands out a Pocket Duel, Fallout Core or Wild Totem. ")}{gameUi(map.propertyName)}{gameUi("s can be claimed for tolls. After every round, summoned animals hunt, then a minigame pays 10 / 5 / 3 / 0 coins and its winner goes first. Team minigames pay both partners equally. Buy one item per round, ready to use from the next round.")}</>)}
          </p>
        </aside>
      </div>
    </section>
  );
}
