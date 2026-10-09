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
import MinigameCatalog from "./MinigameCatalog.tsx";
import { FESTIVAL_PLACEMENT_POINTS } from "../../../games/party/minigames/festivalScoring.ts";
export default function PartyLobby({
  connection,
  lobby,
}: {
  connection: PartyConnection;
  lobby: Lobby;
}) {
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
          <span className="pp-eyebrow">THE CREW IS COMING TOGETHER</span>
          <h1>{lobby.name}</h1>
          <p>
            {lobby.public ? "Public lobby" : "Private lobby"} · {lobby.settings.mode === "festival" ? "Minigame Festival" : map.name} ·{" "}
            {lobby.players.length}/4 explorers
          </p>
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
          {copied ? "Copied!" : lobby.code}
        </button>
      </div>
      <fieldset className="pp-lobby-mode" disabled={!host || !online}>
        <legend>Choose how to play</legend>
        <div className="pp-mode-picker" role="radiogroup" aria-label="Party mode">
          {(["board", "festival"] as const).map((mode) => <button key={mode} type="button" role="radio" aria-checked={(lobby.settings.mode ?? "board") === mode} className={(lobby.settings.mode ?? "board") === mode ? "selected" : ""} onClick={() => {
            if ((lobby.settings.mode ?? "board") === mode) return;
            const lengths = mode === "festival" ? [3, 5, 8, 12] : [0, 8, 12, 16];
            updateSettings({ mode, roundLimit: lengths.includes(lobby.settings.roundLimit ?? 0) ? lobby.settings.roundLimit : mode === "festival" ? 5 : 12 });
          }}><b>{mode === "board" ? "🏝 Board Party" : "🎪 Minigames only"}</b><small>{mode === "board" ? "Explore, shop and compete" : "Minigame Festival · no board"}</small></button>)}
        </div>
      </fieldset>
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
                          {p.id === playerId ? " (you)" : ""}
                        </strong>
                        <small>
                          {p.id === lobby.hostId ? "Host · " : ""}
                          <PlayerStatus player={p} serverOffset={serverOffset} />
                        </small>
                      </div>
                      <span className={`pp-ready ${p.ready ? "yes" : ""}`}>
                        {p.ready ? (
                          <>
                            <Check size={14} /> Ready
                          </>
                        ) : (
                          "Not ready"
                        )}
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
                            <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
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
                        <strong>A seat for trouble</strong>
                        <small>Invite a friend with your lobby code</small>
                      </div>
                      <InviteFriendButton room={{ lobbyRoute: "/games/pluto-party", code: lobby.code }} />
                      {host && (
                        <button onClick={() => send({ type: "ADD_BOT" })}>
                          <Plus size={15} /> Add bot
                        </button>
                      )}
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
              {me?.ready ? "Unready" : "I’m ready"} <Check size={18} />
            </button>
            {host && (
              <button
                className="pp-primary pp-dark"
                disabled={!online || !!startBlocker || pending === "start"}
                aria-busy={pending === "start"}
                onClick={() => send({ type: "START" })}
              >
                {pending === "start" ? (
                  <>
                    <span className="pp-spinner small" aria-hidden="true" /> Starting…
                  </>
                ) : (
                  <>
                    {lobby.settings.mode === "festival" ? "Start festival" : "Set sail"} <ArrowRight size={18} />
                  </>
                )}
              </button>
            )}
            <button disabled={!online} onClick={() => send({ type: "LEAVE" })}>
              Leave lobby
            </button>
          </div>
          <p className="pp-help" role="status">
            {startBlocker ??
              (host
                ? lobby.settings.mode === "festival" ? "Everyone is ready. Start the festival when you like." : "Everyone is ready. Set sail when you like."
                : `Waiting for ${lobby.players.find((p) => p.id === lobby.hostId)?.name ?? "the host"} to start the match…`)}{" "}
            Changing match settings resets readiness.
          </p>
          {lobby.settings.mode === "festival" && <section className="pp-card pp-festival-scoring" aria-labelledby="pp-festival-scoring-title">
            <span className="pp-eyebrow">EVERY GAME COUNTS EQUALLY</span>
            <h2 id="pp-festival-scoring-title">Festival points</h2>
            <div className="pp-scoring-places">{FESTIVAL_PLACEMENT_POINTS.map((points, i) => <div key={points}><small>{["1st", "2nd", "3rd", "4th"][i]}</small><strong>{points}</strong><span>points</span></div>)}</div>
            <p><b>2v2:</b> 5 points per winning teammate, 1 per opponent. A draw gives everyone 3.</p>
            <p><b>Minotaur 1v3:</b> the winning side shares 12 points: 12 for the hunter or 4 per runner.</p>
            <p>Tied solo scores split the points for their places: two tied for first earn 5 each. Every round distributes 12 points.</p>
            <p>Most points after {lobby.settings.roundLimit} minigames wins. Equal final totals share victory.</p>
          </section>}
        </div>
        <aside className="pp-card pp-settings">
          <h2>Your party, your rules.</h2>
          <fieldset disabled={!host || !online}>
            <label>Match length<select value={lobby.settings.roundLimit ?? 0} onChange={(e) => updateSettings({ roundLimit: Number(e.target.value) })}>
              {(lobby.settings.mode !== "festival" ? [0, 8, 12, 16] : [3, 5, 8, 12]).map((n) => <option key={n} value={n}>{n ? `${n} rounds · fixed ending` : "Race to the target"}</option>)}
            </select></label>
            {lobby.settings.mode !== "festival" && <><div role="radiogroup" aria-label="Map" className="pp-map-picker">
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
                  <strong>{m.theme === "tropical" ? "TROPICAL ISLANDS" : m.name.toUpperCase()}</strong>
                  <small>{m.tagline}</small>
                  <small>
                    {m.goldenPlutoCount} active Golden Pluto
                    {m.goldenPlutoCount === 1 ? "" : "s"} · {m.nodes.length} spaces
                  </small>
                </button>
              ))}
            </div>
            <p className="pp-help">{map.description}</p>
            <label>
              {lobby.settings.roundLimit ? "Rank matches by" : "Victory condition"}
              <select
                value={lobby.settings.victory}
                onChange={(e) =>
                  updateSettings({
                    victory: e.target.value as Settings["victory"],
                  })
                }
              >
                <option value="plutos">Golden Plutos</option>
                <option value="coins">Coins</option>
              </select>
            </label>
            {!lobby.settings.roundLimit && (lobby.settings.victory === "plutos" ? (
              <label>
                Golden Pluto target
                <select
                  value={lobby.settings.plutoTarget}
                  onChange={(e) =>
                    updateSettings({ plutoTarget: Number(e.target.value) })
                  }
                >
                  {[3, 5, 7, 10].map((n) => (
                    <option key={n} value={n}>
                      {n} Golden Plutos
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label>
                Coin target
                <select
                  value={lobby.settings.coinTarget}
                  onChange={(e) =>
                    updateSettings({ coinTarget: Number(e.target.value) })
                  }
                >
                  {[100, 150, 200, 250, 300].map((n) => (
                    <option key={n} value={n}>
                      {n} coins
                    </option>
                  ))}
                </select>
              </label>
            ))}
            </>}
            <label>
              New bot difficulty
              <select
                value={lobby.settings.difficulty}
                onChange={(e) =>
                  updateSettings({ difficulty: e.target.value as Difficulty })
                }
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
                ))}
              </select>
            </label>
            <p className="pp-help">{DIFFICULTY_DESCRIPTIONS[lobby.settings.difficulty]}</p>
            <label className="pp-checkbox">
              <input
                type="checkbox"
                checked={lobby.settings.fillBots}
                onChange={(e) => updateSettings({ fillBots: e.target.checked })}
              />{" "}
              Fill empty seats with bots
            </label>
          </fieldset>
          <p className="pp-help">
            {lobby.settings.mode === "festival" ? "Jump straight into your chosen minigames. No board turns, dice or shopping. Choose your lineup in the Minigames box. Festival points decide the winner." : <>{map.goldenPlutoCount === 1
              ? "One Golden Pluto is hidden on the mountain."
              : `${map.goldenPlutoCount === 2 ? "Two" : map.goldenPlutoCount} Golden Plutos are hidden around the islands.`}{" "}
            Land on one and pay 20 coins to collect it. Choose Golden Plutos or coins to win. Item
            fields hand out heals, boosts, weapons and duels; the single Rare
            field hands out a Pocket Duel, Fallout Core or Wild Totem. {map.propertyName}s
            can be claimed for tolls. After every round, summoned animals hunt,
            then a minigame pays 10 / 5 / 3 / 0 coins and its winner goes first. Team minigames pay both partners equally. Buy one item per round, ready to use from the next round.</>}
          </p>
        </aside>
      </div>
      <MinigameCatalog selectedIds={lobby.settings.minigameIds} canSelect={host && online} onSelect={(minigameIds) => updateSettings({ minigameIds })} />
    </section>
  );
}
