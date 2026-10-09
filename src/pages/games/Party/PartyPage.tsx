import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import FinalResults from "./FinalResults.tsx";
import { useInviteAutoCreate } from "@/hooks/useInviteAutoCreate";
import { recordCreatedGameInviteCode, useCreatedGameInvite } from "@/components/social/GameInviteDelivery";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Settings2, Sparkles, X } from "lucide-react";
import { usePartyConnection } from "../../../games/party/network/usePartyConnection.ts";
import PartyHome from "./PartyHome.tsx";
import PartyLobby from "./PartyLobby.tsx";
import PartyMatch from "./PartyMatch.tsx";
import PartyMinigame from "./minigames/PartyMinigame.tsx";
import PartyErrorBoundary from "./PartyErrorBoundary.tsx";
import PartySettings from "./PartySettings.tsx";
import { usePreferences } from "./usePreferences.ts";
import ConnectionOverlay from "./ConnectionOverlay.tsx";
import { usePartyAudio } from "./usePartyAudio.ts";
import { prefersReducedMotion } from "../../../games/party/client/preferences.ts";
import { isMinigameScreenPhase } from "../../../games/party/minigames/flow.ts";
import { mapRegistry } from "../../../games/party/content/maps.ts";
import "./party.css";
export default function PartyPage() {
  return (
    <PartyErrorBoundary>
      <PartyApp />
    </PartyErrorBoundary>
  );
}
const STATUS_LABEL = {
  online: "Connected",
  connecting: "Connecting…",
  reconnecting: "Reconnecting…",
  offline: "Connection lost",
  replaced: "Open elsewhere",
} as const;
// Safe-area insets (notch, home indicator) only exist with viewport-fit=cover. Scoped to this page so
// the rest of the site keeps its viewport unchanged.
function useViewportFitCover() {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    const previous = meta.content;
    if (!previous.includes("viewport-fit")) meta.content = `${previous}, viewport-fit=cover`;
    return () => {
      meta.content = previous;
    };
  }, []);
}
function PartyApp() {
  useGameLanguage();
  const connection = usePartyConnection();
  const [params] = useSearchParams();
  const configuredRoom = useRef<string | null>(null);
  useInviteAutoCreate(() => connection.send({ type: "CREATE", name: "Friends party", playerName: "Explorer", public: false }), connection.status === "online" && !connection.lobby);
  useEffect(() => {
    const lobby = connection.lobby, mapId = params.get("map"), victory = params.get("victory");
    if (!lobby || lobby.match || lobby.hostId !== connection.playerId || connection.status !== "online" || configuredRoom.current === lobby.code || !mapRegistry.all().some(map => map.id === mapId)) return;
    configuredRoom.current = lobby.code;
    connection.send({ type: "SETTINGS", settings: { ...lobby.settings, mapId: mapId!, ...(victory === "plutos" || victory === "coins" ? { victory } : {}) } });
  }, [connection, params]);
  useEffect(() => {
    if (connection.lobby && connection.lobby.hostId === connection.playerId) recordCreatedGameInviteCode(connection.lobby.code, "/games/pluto-party");
  }, [connection.lobby, connection.playerId]);
  const createdInvite = useCreatedGameInvite(connection.lobby ? { lobbyRoute: "/games/pluto-party", code: connection.lobby.code } : null);
  const invitedCode = params.get("code");
  const inviteStarted = useRef(false);
  useEffect(() => {
    if (connection.status !== "online" || connection.lobby || inviteStarted.current || params.get("join") !== "1" || !invitedCode) return;
    inviteStarted.current = true;
    let playerName = "Explorer";
    try { playerName = localStorage.getItem("pluto-party-name") || playerName; } catch { /* The default name still joins. */ }
    connection.send({ type: "JOIN", code: invitedCode, playerName });
  }, [connection, invitedCode, params]);
  const { status, lobby, error, errorCode, clearError, playerId, serverOffset, retry } = connection;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const prefs = usePreferences();
  useViewportFitCover();
  usePartyAudio(lobby, playerId, serverOffset);
  const online = status === "online";
  const reduced = prefersReducedMotion();
  return (
    <main
      className={"pp-page" + (lobby?.match ? " pp-immersive" : "")}
      data-motion={reduced ? "reduce" : "full"}
      data-hints={prefs.controlHints ? "on" : "off"}
    >
      {createdInvite.status && <div className="pp-alert" role={createdInvite.failed ? "alert" : "status"}>{gameUi(createdInvite.status)}{createdInvite.failed && <button onClick={createdInvite.retry}>{gameUi("Retry invite")}</button>}</div>}
      <header className="pp-header">
        <Link to="/games" className="pp-back">
          <ArrowLeft size={17} />{gameUi(" Games ")}</Link>
        <a href="/games/pluto-party" className="pp-wordmark">{gameUi(" pluto")}<span>{gameUi("party")}</span>
          <Sparkles size={18} aria-hidden="true" />
        </a>
        <div className="pp-header-tools">
          <span className={`pp-connection is-${status}`} role="status">
            <i aria-hidden="true" />
            {gameUi(STATUS_LABEL[status])}
          </span>
          <button
            className="pp-icon-button"
            onClick={() => setSettingsOpen(true)}
            aria-label={gameUi("Settings")}
            aria-haspopup="dialog"
          >
            <Settings2 size={19} />
          </button>
        </div>
      </header>
      {gameUi(error && errorCode !== "SESSION_REPLACED" && (
        <div className={`pp-alert ${errorCode === "RATE_LIMITED" ? "is-warning" : ""}`} role="alert">
          {gameUi(error)}
          <button onClick={clearError} aria-label={gameUi("Dismiss message")}>
            <X size={18} />
          </button>
        </div>
      ))}
      {gameUi(!lobby && !online && (
        <div className="pp-notice" role="status">
          {gameUi(status === "connecting" ? (
            <>
              <span className="pp-spinner small" aria-hidden="true" />{gameUi(" Connecting to the party server… ")}</>
          ) : status === "replaced" ? (
            <>{gameUi(" Pluto Party is open in another tab.")}{gameUi(" ")}
              <button className="pp-link-button" onClick={retry}>{gameUi(" Use this tab ")}</button>
            </>
          ) : (
            <>
              {gameUi(status === "offline"
                ? "Can’t reach the party server. Retrying automatically…"
                : "Reconnecting to the party server…")}{gameUi(" ")}
              {gameUi(import.meta.env.DEV && status === "offline" && (
                <span>{gameUi("(Local play: start it with npm run party:server.)")}</span>
              ))}{gameUi(" ")}
              <button className="pp-link-button" onClick={retry}>{gameUi(" Retry now ")}</button>
            </>
          ))}
        </div>
      ))}
      {gameUi(!lobby ? (
        <PartyHome connection={connection} />
      ) : !lobby.match ? (
        <PartyLobby connection={connection} lobby={lobby} />
      ) : lobby.match.minigame && isMinigameScreenPhase(lobby.match.phase) ? (
        <PartyMinigame
          connection={connection}
          lobby={lobby}
          match={lobby.match}
          minigame={lobby.match.minigame}
        />
      ) : lobby.match.mode === "festival" ? (
        <section className="pp-match pp-festival-results">{lobby.match.phase === "GAME_OVER" ? <FinalResults connection={connection} lobby={lobby} match={lobby.match} alpine={false}/> : <div className="mg-results"><h2>{gameUi("Next minigame…")}</h2></div>}</section>
      ) : (
        <PartyMatch connection={connection} lobby={lobby} match={lobby.match} />
      ))}
      {lobby && <ConnectionOverlay connection={connection} />}
      {settingsOpen && <PartySettings onClose={closeSettings} />}
    </main>
  );
}
