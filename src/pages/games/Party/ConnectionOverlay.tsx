import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import type { PartyConnection } from "../../../games/party/network/usePartyConnection.ts";

// Shown over the lobby, board or minigame whenever the live connection is gone. The last authoritative
// state stays visible underneath, but every action is blocked until the server has re-sent the state.
export default function ConnectionOverlay({ connection }: { connection: PartyConnection }) {
  useGameLanguage();
  const { status, reconnectGraceMs, retry } = connection;
  if (status === "online") return null;
  const seconds = Math.round(reconnectGraceMs / 1000);
  return (
    <div className={`pp-connection-overlay is-${status}`} role="alertdialog" aria-live="assertive" aria-label={gameUi("Connection status")}>
      <div className="pp-card">
        {gameUi(status === "replaced" ? (
          <>
            <span className="pp-eyebrow">{gameUi("OPEN SOMEWHERE ELSE")}</span>
            <h2>{gameUi("This game is open in another tab.")}</h2>
            <p>{gameUi("Only one window can control your explorer at a time.")}</p>
            <button className="pp-primary" onClick={retry}>{gameUi(" Play here instead ")}</button>
          </>
        ) : (
          <>
            <span className="pp-eyebrow">{gameUi(status === "offline" ? "CONNECTION LOST" : "RECONNECTING…")}</span>
            <h2>{gameUi(status === "offline" ? "Can’t reach the party server." : "Hang tight, reconnecting.")}</h2>
            <p>{gameUi(" Your seat is reserved for about ")}{gameUi(seconds)}{gameUi(" seconds. After that a bot keeps playing it, and you can still take it back when you return. ")}</p>
            <div className="pp-spinner" aria-hidden="true" />
            <button onClick={retry}>{gameUi("Retry now")}</button>
          </>
        ))}
      </div>
    </div>
  );
}
