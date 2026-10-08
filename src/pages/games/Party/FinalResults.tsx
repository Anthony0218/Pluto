import { rankedPlayers } from "../../../games/party/engine/economy.ts";
import { COLORS } from "../../../games/party/config.ts";
import type { PartyConnection } from "../../../games/party/network/usePartyConnection.ts";
import type { Lobby, Match } from "../../../games/party/types.ts";
import Portrait from "./PartyPortrait.tsx";

// GAME_OVER screen. Ranking is factual: the active win metric first (Plutos or coins), the other one as
// the secondary display, then seat order. The match ends the moment someone reaches the target, so that
// player is always listed first.
export default function FinalResults({
  connection,
  lobby,
  match,
  alpine,
}: {
  connection: PartyConnection;
  lobby: Lobby;
  match: Match;
  alpine: boolean;
}) {
  const { playerId, send, status, pending } = connection;
  const settings = lobby.settings,
    plutoGame = settings.victory === "plutos",
    winner = match.players.find((p) => p.id === match.winner),
    host = lobby.hostId === playerId,
    hostName = lobby.players.find((p) => p.id === lobby.hostId)?.name ?? "the host",
    online = status === "online";
  const target = plutoGame ? `${settings.plutoTarget} Golden Plutos` : `${settings.coinTarget} coins`;
  return (
    <div className="pp-final" aria-labelledby="pp-final-title">
      <span className="pp-eyebrow">{alpine ? "SUMMIT REACHED" : "ISLAND ROYALTY"} · ROUND {match.round}</span>
      <h2 id="pp-final-title">
        {winner ? `${winner.id === playerId ? "You win" : `${winner.name} wins`}!` : "Match over"}
      </h2>
      <p>
        {winner ? match.mode === "festival" ? `${winner.name} won the festival with ${match.festivalScores?.[winner.id] ?? 0} points.` : match.roundLimit ? `${winner.name} leads after ${match.roundLimit} rounds.` : `${winner.name} reached ${target} first.` : "The match has ended."} Thanks for making a little
        trouble.
      </p>
      <ol className="pp-final-ranking">
        {rankedPlayers(match, settings).map((p, i) => {
          const stats = match.stats?.[p.id],
            properties = match.properties.filter((pr) => pr.ownerPlayerId === p.id).length;
          return (
            <li
              key={p.id}
              className={p.id === match.winner ? "winner" : ""}
              style={{ "--pawn-color": COLORS[p.avatarId] } as React.CSSProperties}
            >
              <b className="pp-final-place" aria-label={`Place ${i + 1}`}>
                {i + 1}
              </b>
              <Portrait player={p} />
              <div>
                <strong>
                  {p.name}
                  {p.id === playerId ? " · you" : ""}
                  {p.id === match.winner ? " · 👑 winner" : ""}
                </strong>
                <small>
                  {match.mode === "festival" ? `★ ${match.festivalScores?.[p.id] ?? 0} festival points · ${stats?.minigameWins ?? 0} wins` : plutoGame
                    ? `✦ ${p.goldenPlutos} Golden Pluto${p.goldenPlutos === 1 ? "" : "s"} · 🪙 ${p.coins} coins`
                    : `🪙 ${p.coins} coins · ✦ ${p.goldenPlutos} Golden Pluto${p.goldenPlutos === 1 ? "" : "s"}`}
                </small>
                <small className="pp-final-stats">
                  {stats ? `${stats.minigameWins} minigame win${stats.minigameWins === 1 ? "" : "s"} · ` : ""}
                  {stats ? `${stats.duelWins} duel win${stats.duelWins === 1 ? "" : "s"} · ` : ""}
                  {stats ? `KO’d ${stats.knockouts}× · ` : ""}
                  {properties} {properties === 1 ? "property" : "properties"}
                </small>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="pp-final-actions">
        {host ? (
          <button
            className="pp-primary"
            disabled={!online || pending === "return"}
            onClick={() => send({ type: "RETURN_TO_LOBBY" })}
          >
            {pending === "return" ? "Returning…" : "Return to lobby"}
          </button>
        ) : (
          <p role="status">Waiting for {hostName} to return everyone to the lobby…</p>
        )}
        <button disabled={!online} onClick={() => send({ type: "LEAVE" })}>
          Back to home
        </button>
      </div>
    </div>
  );
}
