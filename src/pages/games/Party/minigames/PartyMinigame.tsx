import { useState } from "react";
import type { PartyConnection } from "../../../../games/party/network/usePartyConnection.ts";
import ItemShop from "../ItemShop.tsx";
import OrientationHint from "../OrientationHint.tsx";
import { minigameRegistry } from "../../../../games/party/minigames/index.ts";
import type {
  Lobby,
  Match,
  MinigameRuntime,
} from "../../../../games/party/types.ts";
import MinigameIntro from "./MinigameIntro.tsx";
import MinigameResults from "./MinigameResults.tsx";
import { DuelResults } from "./DuelScreens.tsx";
import { useServerClock } from "./useServerClock.ts";
import { minigameViews } from "./views.ts";

// Wide realtime courts that play better with the phone turned sideways (tip only, never enforced).
const LANDSCAPE_GAMES = new Set(["paddle-panic", "pickup-arena"]);
// Replaces the board screen during MINIGAME_INTRO → MINIGAME → MINIGAME_RESULTS and during a Duel Saber
// duel (DUEL_INTRO → DUEL_MINIGAME → DUEL_RESULTS). The board HUD, inventory, property and roll controls
// are not mounted here at all.
export default function PartyMinigame({
  connection,
  lobby,
  match,
  minigame,
}: {
  connection: PartyConnection;
  lobby: Lobby;
  match: Match;
  minigame: MinigameRuntime;
}) {
  const { status, playerId, send } = connection;
  const now = useServerClock(minigame.serverNow);
  const definition = minigameRegistry.get(minigame.minigameId);
  const View = minigameViews[minigame.minigameId];
  const duel = match.duel;
  const [confirmLeave, setConfirmLeave] = useState(false);
  const participant = minigame.participants.includes(playerId);
  const intro = match.phase === "MINIGAME_INTRO" || match.phase === "DUEL_INTRO",
    playing = match.phase === "MINIGAME" || match.phase === "DUEL_MINIGAME";
  return (
    <section className="pp-match mg-screen">
      <div className="mg-topbar">
        <span className="pp-eyebrow">
          ROUND {match.round} ·{duel ? " DUEL ·" : ""}{" "}
          {match.mode === "festival" ? `MINIGAME FESTIVAL · ${match.round} / ${match.roundLimit}` : match.roundLimit ? `FINAL ROUND ${match.roundLimit} · MOST ${lobby.settings.victory === "coins" ? "COINS" : "PLUTOS"} WINS` : lobby.settings.victory === "coins"
            ? `FIRST TO ${lobby.settings.coinTarget} COINS`
            : `FIRST TO ${lobby.settings.plutoTarget} GOLDEN PLUTOS`}
        </span>
        {confirmLeave ? (
          <span className="pp-leave-confirm" role="group" aria-label="Leave the match?">
            <button className="pp-danger" onClick={() => send({ type: "LEAVE" })}>
              Leave · a bot takes your seat
            </button>
            <button onClick={() => setConfirmLeave(false)}>Stay</button>
          </span>
        ) : (
          <button onClick={() => setConfirmLeave(true)}>Leave</button>
        )}
      </div>
      {match.mode !== "festival" && match.players.find((p) => p.id === playerId) && <ItemShop match={match} player={match.players.find((p) => p.id === playerId)!} connection={connection}/>}
      {playing && participant && LANDSCAPE_GAMES.has(minigame.minigameId) && <OrientationHint />}
      <div className="pp-card mg-stage">
        {intro ? (
          <MinigameIntro definition={definition} match={match} minigame={minigame} playerId={playerId} now={now} online={status === "online"} onReady={() => send({ type: "ACTION", action: { type: "MINIGAME_READY" } })}/>
        ) : playing && View ? (
          <View
            match={match}
            minigame={minigame}
            playerId={playerId}
            now={now}
            online={status === "online"}
            sendInput={(input) =>
              send({ type: "ACTION", action: { type: "MINIGAME_INPUT", input } })
            }
          />
        ) : playing ? (
          <p role="alert" className="mg-unsupported">
            This minigame is not supported by this version of the game. Reload the page to update.
          </p>
        ) : duel ? (
          <DuelResults match={match} duel={duel} playerId={playerId} />
        ) : (
          <MinigameResults
            definition={definition}
            match={match}
            minigame={minigame}
            playerId={playerId}
          />
        )}
      </div>
    </section>
  );
}
