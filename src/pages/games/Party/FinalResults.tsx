import { rankedPlayers } from "../../../games/party/engine/economy.ts";
import { festivalWinners } from "../../../games/party/minigames/festivalScoring.ts";
import { COLORS } from "../../../games/party/config.ts";
import type { PartyConnection } from "../../../games/party/network/usePartyConnection.ts";
import type { Lobby, Match } from "../../../games/party/types.ts";
import Portrait from "./PartyPortrait.tsx";

// Board results retain their configured ranking; festival ties share places and victory.
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
  const festival = match.mode === "festival";
  const winners = festival ? festivalWinners(match) : match.winner ? [match.winner] : [];
  const shared = festival && winners.length > 1;
  const ranking = rankedPlayers(match, settings);
  const winnerNames = match.players.filter((p) => winners.includes(p.id)).map((p) => p.name).join(", ");
  return (
    <div className="pp-final" aria-labelledby="pp-final-title">
      <span className="pp-eyebrow">{festival ? "FESTIVAL CHAMPIONS" : alpine ? "SUMMIT REACHED" : "ISLAND ROYALTY"} · ROUND {match.round}</span>
      <h2 id="pp-final-title">
        {shared ? winners.includes(playerId) ? "You share the victory!" : "Shared victory!" : winner ? `${winner.id === playerId ? "You win" : `${winner.name} wins`}!` : "Match over"}
      </h2>
      <p>
        {shared ? `${winnerNames} share first place with ${match.festivalScores?.[winners[0]] ?? 0} points each.` : winner ? festival ? `${winner.name} won the festival with ${match.festivalScores?.[winner.id] ?? 0} points.` : match.roundLimit ? `${winner.name} leads after ${match.roundLimit} rounds.` : `${winner.name} reached ${target} first.` : "The match has ended."} Thanks for making a little
        trouble.
      </p>
      <ol className="pp-final-ranking">
        {ranking.map((p, i) => {
          const stats = match.stats?.[p.id],
            properties = match.properties.filter((pr) => pr.ownerPlayerId === p.id).length;
          const place = festival ? 1 + ranking.filter((other) => (match.festivalScores?.[other.id] ?? 0) > (match.festivalScores?.[p.id] ?? 0)).length : i + 1;
          return (
            <li
              key={p.id}
              className={winners.includes(p.id) ? "winner" : ""}
              style={{ "--pawn-color": COLORS[p.avatarId] } as React.CSSProperties}
            >
              <b className="pp-final-place" aria-label={`Place ${place}`}>
                {place}
              </b>
              <Portrait player={p} />
              <div>
                <strong>
                  {p.name}
                  {p.id === playerId ? " · you" : ""}
                  {winners.includes(p.id) ? shared ? " · 👑 joint winner" : " · 👑 winner" : ""}
                </strong>
                <small>
                  {match.mode === "festival" ? `★ ${match.festivalScores?.[p.id] ?? 0} festival points · ${stats?.minigameWins ?? 0} wins` : plutoGame
                    ? `✦ ${p.goldenPlutos} Golden Pluto${p.goldenPlutos === 1 ? "" : "s"} · 🪙 ${p.coins} coins`
                    : `🪙 ${p.coins} coins · ✦ ${p.goldenPlutos} Golden Pluto${p.goldenPlutos === 1 ? "" : "s"}`}
                </small>
                {!festival && <small className="pp-final-stats">
                  {stats ? `${stats.minigameWins} minigame win${stats.minigameWins === 1 ? "" : "s"} · ` : ""}
                  {stats ? `${stats.duelWins} duel win${stats.duelWins === 1 ? "" : "s"} · ` : ""}
                  {stats ? `KO’d ${stats.knockouts}× · ` : ""}
                  {properties} {properties === 1 ? "property" : "properties"}
                </small>}
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
