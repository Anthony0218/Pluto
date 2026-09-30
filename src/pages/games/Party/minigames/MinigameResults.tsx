import { useEffect, useState } from "react";
import { COLORS } from "../../../../games/party/config.ts";
import type { MinigameDefinition } from "../../../../games/party/minigames/types.ts";
import type {
  Match,
  MinigameRuntime,
} from "../../../../games/party/types.ts";
import Portrait from "../PartyPortrait.tsx";

const ORDINAL = ["1st", "2nd", "3rd", "4th"];

// Counts from the pre-reward total up to the authoritative total. Display only.
function CoinCount({ to, gained }: { to: number; gained: number }) {
  const [shown, setShown] = useState(to - gained);
  useEffect(() => {
    if (gained <= 0) return;
    let frame = 0;
    const start = performance.now();
    const step = (t: number) => {
      const progress = Math.min(1, (t - start - 900) / 700);
      setShown(to - gained + Math.round(gained * Math.max(0, progress)));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to, gained]);
  return <>{shown}</>;
}

export default function MinigameResults({
  definition,
  match,
  minigame,
  playerId,
}: {
  definition: MinigameDefinition;
  match: Match;
  minigame: MinigameRuntime;
  playerId: string;
}) {
  const results = minigame.results ?? [];
  const leader = match.players.find((p) => p.id === results[0]?.playerId);
  const champion = match.players.find((p) => p.id === match.winner);
  return (
    <div className="mg-results">
      <span className="pp-eyebrow">RESULTS</span>
      <h2>{definition.name}</h2>
      <ol className="mg-podium">
        {results.map((r, i) => {
          const p = match.players.find((player) => player.id === r.playerId)!;
          const gained = minigame.rewards?.[r.playerId] ?? 0;
          return (
            <li
              key={r.playerId}
              className={`${r.playerId === playerId ? "me" : ""} place-${r.position}`}
              style={
                {
                  "--pawn-color": COLORS[p.avatarId],
                  "--delay": `${i * 120}ms`,
                } as React.CSSProperties
              }
            >
              <b className="mg-place">{ORDINAL[r.position - 1]}</b>
              <Portrait player={p} />
              <span className="mg-name">
                {p.name}
                <small>{r.score ?? 0} pts</small>
              </span>
              <span className={`mg-reward ${gained ? "" : "none"}`}>
                +{gained}
              </span>
              <span className="mg-total" aria-label={`${p.coins} coins`}>
                🪙 <CoinCount to={p.coins} gained={gained} />
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mg-next">
        {champion
          ? `${champion.name} reached the coin goal!`
          : leader
            ? `${leader.name} goes first next round.`
            : ""}
      </p>
    </div>
  );
}
