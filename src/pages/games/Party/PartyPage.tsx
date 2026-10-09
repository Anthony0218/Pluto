import FinalResults from "./FinalResults.tsx";
import { useInviteAutoCreate } from "@/hooks/useInviteAutoCreate";
import { recordCreatedGameInviteCode } from "@/components/social/GameInviteDelivery";
import { usePublishRoom } from "@/components/social/currentRoom";
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
import { normalizeLobbyCode } from "../../../games/party/network/protocol.ts";
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
  const connection = usePartyConnection();
  const [params, setParams] = useSearchParams();
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
  // The open lobby is the room friends are invited to. Accepting an invite elsewhere gives the seat up
  // right away; a seat in a running match stays, so the player can still come back to it.
  usePublishRoom(connection.lobby ? { lobbyRoute: "/games/pluto-party", code: connection.lobby.code } : null, () => {
    if (connection.lobby && !connection.lobby.match) connection.send({ type: "LEAVE" });
  });
  const invitedCode = params.get("code");
  const inviteStarted = useRef(false);
  const leftForInvite = useRef(false);
  useEffect(() => {
    if (connection.status !== "online" || inviteStarted.current || params.get("join") !== "1" || !invitedCode) return;
    const sameLobby = connection.lobby?.code === normalizeLobbyCode(invitedCode);
    if (connection.lobby && !sameLobby) {
      // A session sits in one lobby: the one it resumed is left for the invited lobby.
      if (!leftForInvite.current) { leftForInvite.current = true; connection.send({ type: "LEAVE" }); }
      return;
    }
    inviteStarted.current = true;
    // The invite is used up, so a refresh never leaves a later lobby for this one.
    setParams((current) => { const next = new URLSearchParams(current); next.delete("join"); return next; }, { replace: true });
    if (sameLobby) return;
    let playerName = "Explorer";
    try { playerName = localStorage.getItem("pluto-party-name") || playerName; } catch { /* The default name still joins. */ }
    connection.send({ type: "JOIN", code: invitedCode, playerName });
  }, [connection, invitedCode, params, setParams]);
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
      <header className="pp-header">
        <Link to="/games" className="pp-back">
          <ArrowLeft size={17} /> Games
        </Link>
        <a href="/games/pluto-party" className="pp-wordmark">
          pluto<span>party</span>
          <Sparkles size={18} aria-hidden="true" />
        </a>
        <div className="pp-header-tools">
          <span className={`pp-connection is-${status}`} role="status">
            <i aria-hidden="true" />
            {STATUS_LABEL[status]}
          </span>
          <button
            className="pp-icon-button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            aria-haspopup="dialog"
          >
            <Settings2 size={19} />
          </button>
        </div>
      </header>
      {error && errorCode !== "SESSION_REPLACED" && (
        <div className={`pp-alert ${errorCode === "RATE_LIMITED" ? "is-warning" : ""}`} role="alert">
          {error}
          <button onClick={clearError} aria-label="Dismiss message">
            <X size={18} />
          </button>
        </div>
      )}
      {!lobby && !online && (
        <div className="pp-notice" role="status">
          {status === "connecting" ? (
            <>
              <span className="pp-spinner small" aria-hidden="true" /> Connecting to the party server…
            </>
          ) : status === "replaced" ? (
            <>
              Pluto Party is open in another tab.{" "}
              <button className="pp-link-button" onClick={retry}>
                Use this tab
              </button>
            </>
          ) : (
            <>
              {status === "offline"
                ? "Can’t reach the party server. Retrying automatically…"
                : "Reconnecting to the party server…"}{" "}
              {import.meta.env.DEV && status === "offline" && (
                <span>(Local play: start it with npm run party:server.)</span>
              )}{" "}
              <button className="pp-link-button" onClick={retry}>
                Retry now
              </button>
            </>
          )}
        </div>
      )}
      {!lobby ? (
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
        <section className="pp-match pp-festival-results">{lobby.match.phase === "GAME_OVER" ? <FinalResults connection={connection} lobby={lobby} match={lobby.match} alpine={false}/> : <div className="mg-results"><h2>Next minigame…</h2></div>}</section>
      ) : (
        <PartyMatch connection={connection} lobby={lobby} match={lobby.match} />
      )}
      {lobby && <ConnectionOverlay connection={connection} />}
      {settingsOpen && <PartySettings onClose={closeSettings} />}
    </main>
  );
}
