import { gameUi, useGameLanguage } from "../../../../i18n/gameUi.ts";
import { useEffect } from "react";
import { COLORS } from "../../../../games/party/config.ts";
import type { MinigameDefinition } from "../../../../games/party/minigames/types.ts";
import type { Match, MinigameRuntime } from "../../../../games/party/types.ts";
import Portrait from "../PartyPortrait.tsx";
import MinigamePractice from "./MinigamePractice.tsx";

export default function MinigameIntro({ definition, match, minigame, playerId, now, onReady, online = true }: {
  definition: MinigameDefinition; match: Match; minigame: MinigameRuntime; playerId: string; now: number; onReady?: () => void; online?: boolean;
}) {
  useGameLanguage();
  const ready = minigame.readyPlayerIds?.includes(playerId), participant = minigame.participants.includes(playerId);
  const awaiting = minigame.awaitingReady;
  useEffect(() => {
    if (!awaiting || ready || !participant || !online) return;
    const key = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      e.preventDefault(); e.stopImmediatePropagation(); onReady?.();
    };
    window.addEventListener("keydown", key, true); return () => window.removeEventListener("keydown", key, true);
  }, [awaiting, ready, participant, online, onReady]);
  const count = Math.max(0, Math.ceil((minigame.startedAt - now) / 1000));
  return <div className="mg-intro mg-ready-intro">
    <div className="mg-intro-copy"><span className="pp-eyebrow">{gameUi(match.duel ? "DUEL" : "MINIGAME")}{gameUi(" · ROUND ")}{gameUi(match.round)}{gameUi(match.roundLimit ? ` / ${match.roundLimit}` : "")}</span>
      <h2>{gameUi(definition.name)}</h2><p className="mg-lede">{gameUi(definition.description)}</p>
      {match.duel && <p className="mg-duel-stake">{gameUi(match.duel.kind === "pocket-duel" ? "Winner earns a Golden Pluto" : match.duel.wager?.type === "pluto" ? "1 Golden Pluto is at stake" : `${match.duel.pot} coins in the pot`)}</p>}
      {awaiting ? <div className="mg-ready-action">{participant && !ready ? <button className="pp-primary" disabled={!online} onClick={onReady}>{gameUi("I’m ready ")}<kbd>{gameUi("Space")}</kbd></button> : <b>✓ {gameUi(participant ? "You’re ready" : "Watching the ready check")}</b>}<p>{gameUi("Everyone must be ready before the shared 3–2–1 countdown.")}</p></div> : <div className="mg-countdown counting" aria-live="assertive" key={count}>{gameUi(count || "GO!")}</div>}
      <ol className="mg-rules">{definition.instructions.map((line, i) => <li key={line}><span className="mg-rule-number">{gameUi(i + 1)}</span><span>{gameUi(line)}</span></li>)}</ol>
      <div className="mg-controls"><b>{gameUi("Your controls")}</b><div className="mg-keycaps">{definition.controls.split(/ · | \/ | \+ /).map((key, i) => <kbd key={i}>{gameUi(key)}</kbd>)}</div></div>
      <ul className="mg-players" aria-label={gameUi("Player readiness")}>{minigame.participants.map((id) => { const p = match.players.find((p) => p.id === id)!; const done = minigame.readyPlayerIds?.includes(id) || p.isBot; return <li key={id} className={done ? "is-ready" : ""} style={{ "--pawn-color": COLORS[p.avatarId] } as React.CSSProperties}><Portrait player={p}/><span>{p.name}{gameUi(id === playerId ? " · you" : p.isBot ? " · bot" : "")}<small>{gameUi(done ? "✓ Ready" : "Practising…")}</small></span></li>; })}</ul>

    </div>
    {awaiting && participant && !ready && <MinigamePractice definition={definition} match={match} participants={minigame.participants} playerId={playerId}/>}
  </div>;
}
