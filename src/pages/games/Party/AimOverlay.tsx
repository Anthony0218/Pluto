import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect, useRef, useState } from "react";
import { COLORS } from "../../../games/party/config.ts";
import { aimTargetPosition } from "../../../games/party/items/aim.ts";
import { itemRegistry } from "../../../games/party/items/registry.ts";
import type { AimChallenge, Match } from "../../../games/party/types.ts";
import Portrait from "./PartyPortrait.tsx";
import { useServerOffset } from "./minigames/useServerClock.ts";

// Touch fingers would hide the reticle, so on touch the reticle sits this far above the finger.
const TOUCH_LIFT_PX = 56;

// Short aiming overlay for Scatterblaster / Lucky Six. The target sways on the server-seeded path;
// drag to place the reticle and release to fire. Only the normalized reticle position and elapsed time
// are sent; the server decides hit quality and damage.
export default function AimOverlay({
  match,
  aim,
  onFire,
  onCancel,
}: {
  match: Match;
  aim: AimChallenge;
  onFire: (aimX: number, aimY: number, elapsedMs: number) => void;
  onCancel: () => void;
}) {
  useGameLanguage();
  const definition = itemRegistry.get(aim.itemId),
    geometry = definition.aim!.geometry(aim.band);
  const target = match.players.find((p) => p.id === aim.targetPlayerId)!;
  const field = useRef<HTMLDivElement>(null),
    marker = useRef<HTMLDivElement>(null),
    timer = useRef<HTMLSpanElement>(null);
  const offset = useServerOffset(aim.serverNow);
  const [reticle, setReticle] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [fired, setFired] = useState(false);
  const windowMs = aim.expiresAt - aim.startedAt;
  const serverElapsed = () => Date.now() + (offset.current ?? 0) - aim.startedAt;

  // Moves the target marker and the timer bar every frame without re-rendering React.
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const elapsed = Math.min(
        windowMs,
        Math.max(0, Date.now() + (offset.current ?? 0) - aim.startedAt),
      );
      const { x, y } = aimTargetPosition(aim, elapsed);
      if (marker.current) {
        marker.current.style.left = `${((x + 1) / 2) * 100}%`;
        marker.current.style.top = `${((y + 1) / 2) * 100}%`;
      }
      if (timer.current) timer.current.style.transform = `scaleX(${1 - elapsed / windowMs})`;
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [aim, windowMs, offset]);

  const toField = (clientX: number, clientY: number, touch: boolean) => {
    const rect = field.current!.getBoundingClientRect();
    const lift = touch ? TOUCH_LIFT_PX : 0;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 2 - 1),
      y: clamp(((clientY - lift - rect.top) / rect.height) * 2 - 1),
    };
  };
  const fire = (x: number, y: number) => {
    if (fired) return;
    setFired(true);
    onFire(
      Math.round(x * 1000) / 1000,
      Math.round(y * 1000) / 1000,
      Math.max(0, Math.round(serverElapsed())),
    );
  };
  const pct = (v: number) => `${((v + 1) / 2) * 100}%`;
  const scale = (r: number) => `${r * 50}%`;
  const color = COLORS[target.avatarId];
  const bandLabel =
    aim.band === "global"
      ? "ANY RANGE"
      : `${aim.band.toUpperCase()} · ${aim.distance} SPACE${aim.distance === 1 ? "" : "S"}`;
  return (
    <div className="pp-aim" role="dialog" aria-label={gameUi(`Aim ${definition.name} at ${target.name}`)}>
      <div className="pp-aim-card">
        <header>
          <span className="pp-eyebrow">
            {gameUi(definition.icon)} {gameUi(definition.name.toUpperCase())} → {target.name.toUpperCase()}
          </span>
          <b className="pp-aim-band">{gameUi(bandLabel)}</b>
          <span className="pp-aim-timer" aria-hidden="true">
            <span ref={timer} />
          </span>
        </header>
        <div
          ref={field}
          className={`pp-aim-field ${dragging ? "dragging" : ""}`}
          onPointerDown={(e) => {
            if (fired) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
            setReticle(toField(e.clientX, e.clientY, e.pointerType === "touch"));
          }}
          onPointerMove={(e) => {
            if (dragging) setReticle(toField(e.clientX, e.clientY, e.pointerType === "touch"));
          }}
          onPointerUp={(e) => {
            if (!dragging) return;
            setDragging(false);
            const at = toField(e.clientX, e.clientY, e.pointerType === "touch");
            setReticle(at);
            fire(at.x, at.y);
          }}
          onPointerCancel={() => setDragging(false)}
        >
          <div
            ref={marker}
            className="pp-aim-target"
            style={
              {
                width: scale(geometry.targetRadius * 2),
                "--pawn-color": color,
              } as React.CSSProperties
            }
          >
            <Portrait player={target} />
          </div>
          {/* Rings are sized in % of the square field: radius r (normalized) spans r × 50% of it. */}
          {gameUi(geometry.hitRadius > geometry.centerRadius && (
            <i
              className="pp-aim-ring spread"
              style={{ left: pct(reticle.x), top: pct(reticle.y), width: scale(geometry.hitRadius * 2) }}
            />
          ))}
          <i
            className={`pp-aim-ring core ${aim.itemId === "lucky-six" ? "precise" : ""}`}
            style={{ left: pct(reticle.x), top: pct(reticle.y), width: scale(geometry.centerRadius * 2) }}
          />
          <i className="pp-aim-cross" style={{ left: pct(reticle.x), top: pct(reticle.y) }} />
        </div>
        <p className="pp-aim-help">
          {gameUi(fired
            ? "Shot fired…"
            : aim.itemId === "lucky-six"
              ? "Drag the crosshair onto the moving target and release to fire. Hit = 20, miss = 0."
              : "Drag to aim, release to fire. Target inside the inner ring = centered; inside the outer spread = partial.")}
        </p>
        <div className="pp-sheet-actions">
          <button onClick={onCancel} disabled={fired}>{gameUi(" Lower weapon ")}</button>
          <button className="pp-primary" disabled={fired} onClick={() => fire(reticle.x, reticle.y)}>{gameUi(" Fire here ")}</button>
        </div>
      </div>
    </div>
  );
}
