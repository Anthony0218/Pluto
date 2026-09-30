import { COLORS, MINIGAME_FLOW } from "../../../../games/party/config.ts";
import type { MinigameDefinition } from "../../../../games/party/minigames/types.ts";
import type {
  Match,
  MinigameRuntime,
} from "../../../../games/party/types.ts";
import Portrait from "../PartyPortrait.tsx";

export default function MinigameIntro({
  definition,
  match,
  minigame,
  playerId,
  now,
}: {
  definition: MinigameDefinition;
  match: Match;
  minigame: MinigameRuntime;
  playerId: string;
  now: number;
}) {
  const remaining = minigame.startedAt - now;
  const counting = remaining <= MINIGAME_FLOW.countdownMs;
  const count = Math.ceil(remaining / 1000);
  return (
    <div className="mg-intro">
      <span className="pp-eyebrow">MINIGAME · ROUND {match.round}</span>
      <h2>{definition.name}</h2>
      <p className="mg-lede">{definition.description}</p>
      <ul className="mg-rules">
        {definition.instructions.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mg-controls">
        <b>Controls</b> {definition.controls}
      </p>
      <ul className="mg-players" aria-label="Players">
        {minigame.participants.map((id) => {
          const p = match.players.find((player) => player.id === id)!;
          return (
            <li
              key={id}
              style={
                { "--pawn-color": COLORS[p.avatarId] } as React.CSSProperties
              }
            >
              <Portrait player={p} />
              <span>
                {p.name}
                {p.id === playerId ? " · you" : p.isBot ? " · bot" : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <div
        className={`mg-countdown ${counting ? "counting" : ""}`}
        aria-live="assertive"
        key={counting ? count : "ready"}
      >
        {!counting ? (
          <small>Get ready…</small>
        ) : count > 0 ? (
          count
        ) : (
          "GO!"
        )}
      </div>
    </div>
  );
}
