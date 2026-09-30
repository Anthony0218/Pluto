import { useState } from "react";
import { COLORS } from "../../../../games/party/config.ts";
import {
  TARGET_PANIC_CONFIG,
  targetValue,
} from "../../../../games/party/minigames/targetPanic/config.ts";
import type {
  PanicTarget,
  TargetPanicView,
} from "../../../../games/party/minigames/targetPanic/logic.ts";
import type { MinigameViewProps } from "./views.ts";

interface Pop {
  key: string;
  x: number;
  y: number;
  kind: PanicTarget["kind"];
}
// Pure presentation: targets and scores come from the authority's public view. A tap is sent as intent
// and hidden locally at once for responsiveness; the score shown is always the server's.
export default function TargetPanicScreen({
  match,
  minigame,
  playerId,
  now,
  online,
  sendInput,
}: MinigameViewProps) {
  const view = minigame.state as TargetPanicView;
  const [tapped, setTapped] = useState<Set<string>>(() => new Set());
  const [pops, setPops] = useState<Pop[]>([]);
  const mine = view.players[playerId];
  const claimed = new Set(mine?.claimed ?? []);
  const running = now >= view.startedAt && now < view.endsAt;
  const visible = running
    ? view.targets.filter(
        (t) =>
          t.spawnAt <= now &&
          t.expiresAt > now &&
          !claimed.has(t.id) &&
          !tapped.has(t.id),
      )
    : [];
  const secondsLeft = Math.max(0, Math.ceil((view.endsAt - now) / 1000));
  const standings = match.players
    .filter((p) => view.players[p.id])
    .map((p) => ({ player: p, score: view.players[p.id].score }))
    .sort((a, b) => b.score - a.score);
  const tap = (target: PanicTarget) => {
    if (!mine || tapped.has(target.id)) return;
    setTapped((current) => new Set(current).add(target.id));
    setPops((current) => [
      ...current.slice(-8),
      { key: target.id, x: target.x, y: target.y, kind: target.kind },
    ]);
    sendInput({ type: "TARGET_HIT", targetId: target.id });
  };
  return (
    <div
      className="tp-game"
      style={
        {
          "--tp-size": `min(${TARGET_PANIC_CONFIG.targetSizePx}px, 19vmin)`,
        } as React.CSSProperties
      }
    >
      <div className="tp-hud">
        <div
          className={`tp-timer ${secondsLeft <= 10 ? "urgent" : ""}`}
          role="timer"
          aria-label={`${secondsLeft} seconds left`}
        >
          {secondsLeft}
          <small>s</small>
        </div>
        <div className="tp-myscore" aria-live="polite">
          <small>{mine ? "YOUR SCORE" : "SPECTATING"}</small>
          <b>{mine?.score ?? "–"}</b>
        </div>
        <ol className="tp-standings" aria-label="Live standings">
          {standings.map(({ player, score }) => (
            <li
              key={player.id}
              className={player.id === playerId ? "me" : ""}
              style={
                {
                  "--pawn-color": COLORS[player.avatarId],
                } as React.CSSProperties
              }
            >
              <i />
              <span>{player.name}</span>
              <b>{score}</b>
            </li>
          ))}
        </ol>
      </div>
      <div className="tp-field" aria-label="Target Panic play field">
        {visible.map((t) => (
          <button
            key={t.id}
            className={`tp-target tp-${t.kind}`}
            style={
              {
                "--x": t.x,
                "--y": t.y,
                "--life": `${TARGET_PANIC_CONFIG.targetLifetimeMs}ms`,
                "--age": `${Math.min(0, t.spawnAt - now)}ms`,
              } as React.CSSProperties
            }
            disabled={!online || !mine}
            aria-label={`${t.kind} target, ${targetValue(t.kind) > 0 ? "+" : ""}${targetValue(t.kind)}`}
            onPointerDown={(e) => {
              e.preventDefault();
              tap(t);
            }}
            // Keyboard activation only (detail 0); pointer taps are handled on pointerdown.
            onClick={(e) => {
              if (e.detail === 0) tap(t);
            }}
          >
            <span />
          </button>
        ))}
        {pops.map((p) => (
          <span
            key={p.key}
            className={`tp-pop tp-pop-${p.kind}`}
            style={{ "--x": p.x, "--y": p.y } as React.CSSProperties}
            onAnimationEnd={() =>
              setPops((current) => current.filter((c) => c.key !== p.key))
            }
          >
            {targetValue(p.kind) > 0 ? "+" : "−"}
            {Math.abs(targetValue(p.kind))}
          </span>
        ))}
        {now >= view.endsAt && <div className="tp-banner">TIME!</div>}
        {now < view.startedAt && <div className="tp-banner">GO!</div>}
      </div>
      <p className="tp-legend">
        <span className="tp-key tp-standard" /> +{TARGET_PANIC_CONFIG.normalScore}
        <span className="tp-key tp-golden" /> +{TARGET_PANIC_CONFIG.goldenScore}
        <span className="tp-key tp-danger" /> −{TARGET_PANIC_CONFIG.dangerPenalty}
      </p>
    </div>
  );
}
