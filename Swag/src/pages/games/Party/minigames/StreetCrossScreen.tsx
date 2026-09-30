import { useEffect, useRef, useState } from "react";
import { COLORS } from "../../../../games/party/config.ts";
import {
  FINISH_ROW,
  STREET_CROSS_CONFIG as CONFIG,
} from "../../../../games/party/minigames/streetCross/config.ts";
import {
  vehicleX,
  type StreetCrossView,
} from "../../../../games/party/minigames/streetCross/logic.ts";
import { useServerOffset } from "./useServerClock.ts";
import { useThrottledInput } from "./useThrottledInput.ts";
import type { MinigameViewProps } from "./views.ts";

const W = CONFIG.width,
  ROWS = CONFIG.rows.length,
  R = CONFIG.player.radius;
const ROW_FILL: Record<string, string> = {
  start: "#e9d8a6",
  safe: "#8fd18a",
  finish: "#f7f6ee",
  road: "#39474a",
};
const VEHICLE_FILL = { bike: "#ffb347", car: "#6fa8ff", truck: "#e86a5b", bus: "#f2c94c" };

// Virtual joystick: drag the knob; direction is sent as intent (up = forward on the course).
function Joystick({ onMove, disabled }: { onMove: (dx: number, dy: number) => void; disabled: boolean }) {
  const pad = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const update = (clientX: number, clientY: number) => {
    const rect = pad.current!.getBoundingClientRect(),
      radius = rect.width / 2;
    let x = (clientX - rect.left - radius) / radius,
      y = (clientY - rect.top - radius) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    setKnob({ x, y });
    // Dead zone, then snap small wobble to clean directions.
    const dx = Math.abs(x) < 0.25 ? 0 : Math.round(x * 100) / 100,
      dy = Math.abs(y) < 0.25 ? 0 : Math.round(-y * 100) / 100;
    onMove(dx, dy);
  };
  const release = () => {
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };
  return (
    <div
      ref={pad}
      className={`sc-joystick ${disabled ? "disabled" : ""}`}
      role="application"
      aria-label="Movement joystick"
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!disabled && e.buttons) update(e.clientX, e.clientY);
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span style={{ transform: `translate(${knob.x * 34}px, ${knob.y * 34}px)` }} />
    </div>
  );
}

// Presentation only: traffic is computed locally from the server's lane table (deterministic), runner
// positions are extrapolated from the last snapshot, and only a movement direction is ever sent.
export default function StreetCrossScreen({
  match,
  minigame,
  playerId,
  now,
  online,
  sendInput,
}: MinigameViewProps) {
  const view = minigame.state as StreetCrossView;
  const canvas = useRef<HTMLCanvasElement>(null);
  const offset = useServerOffset(minigame.serverNow);
  const latest = useRef(view);
  const intent = useRef({ dx: 0, dy: 0 });
  const push = useThrottledInput(sendInput, CONFIG.inputIntervalMs);
  const me = view.runners[playerId];
  // Effects below depend on this boolean, not on `me`, which is a new object in every snapshot:
  // re-subscribing listeners per snapshot would lose held keys and never send the stop.
  const isRunner = me !== undefined;
  useEffect(() => {
    latest.current = view;
  }, [view]);
  const colors = Object.fromEntries(
    match.players.map((p) => [p.id, COLORS[p.avatarId]] as const),
  );
  const colorsRef = useRef(colors);
  useEffect(() => {
    colorsRef.current = colors;
  });

  const move = (dx: number, dy: number) => {
    if (!isRunner || !online) return;
    intent.current = { dx, dy };
    push({ type: "MOVE", dx, dy });
  };
  const moveRef = useRef(move);
  useEffect(() => {
    moveRef.current = move;
  });

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      const el = canvas.current,
        ctx = el?.getContext("2d");
      if (!el || !ctx) return;
      const dpr = window.devicePixelRatio || 1,
        cssW = el.clientWidth,
        cssH = el.clientHeight;
      if (el.width !== Math.round(cssW * dpr)) el.width = Math.round(cssW * dpr);
      if (el.height !== Math.round(cssH * dpr)) el.height = Math.round(cssH * dpr);
      const s = (cssW / W) * dpr,
        v = latest.current,
        serverNow = Math.min(Date.now() + (offset.current ?? 0), v.endsAt),
        elapsed = serverNow - v.startedAt,
        dt = Math.max(0, Math.min(serverNow - v.simTime, 300)) / 1000;
      // Course y grows upward; canvas y grows downward.
      const cy = (y: number) => ROWS - y;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      CONFIG.rows.forEach((kind, row) => {
        ctx.fillStyle = ROW_FILL[kind];
        ctx.fillRect(0, cy(row + 1), W, 1);
        if (kind === "road" && CONFIG.rows[row + 1] === "road") {
          ctx.strokeStyle = "rgba(255,255,255,0.35)";
          ctx.lineWidth = 0.05;
          ctx.setLineDash([0.4, 0.4]);
          ctx.beginPath();
          ctx.moveTo(0, cy(row + 1));
          ctx.lineTo(W, cy(row + 1));
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (kind === "finish")
          for (let x = 0; x < W; x += 0.5)
            for (let y = 0; y < 2; y++)
              if ((x * 2 + y) % 2 === 0) {
                ctx.fillStyle = "#183e40";
                ctx.fillRect(x, cy(row + 1) + y * 0.5, 0.5, 0.5);
              }
      });
      for (const lane of v.lanes)
        for (const vehicle of lane.vehicles) {
          const x = vehicleX(lane, vehicle, elapsed);
          if (x > W || x + vehicle.length < 0) continue;
          const top = cy(lane.row + 1) + 0.14;
          ctx.fillStyle = VEHICLE_FILL[vehicle.kind];
          ctx.beginPath();
          ctx.roundRect(x, top, vehicle.length, 0.72, 0.18);
          ctx.fill();
          // Headlights show the driving direction.
          ctx.fillStyle = "#fff7c2";
          const front = lane.speed > 0 ? x + vehicle.length - 0.16 : x + 0.06;
          ctx.fillRect(front, top + 0.12, 0.1, 0.14);
          ctx.fillRect(front, top + 0.46, 0.1, 0.14);
        }
      for (const [id, runner] of Object.entries(v.runners)) {
        const moving = runner.finishedAt === null && serverNow >= runner.stunnedUntil;
        const dir = id === playerId ? intent.current : { dx: runner.dx, dy: runner.dy };
        const x = moving ? Math.min(W - R, Math.max(R, runner.x + dir.dx * CONFIG.player.speed * dt)) : runner.x;
        const y = moving ? Math.max(R, Math.min(FINISH_ROW + 0.5, runner.y + dir.dy * CONFIG.player.speed * dt)) : runner.y;
        const blink = serverNow < runner.invulnerableUntil && Math.floor(serverNow / 120) % 2 === 0;
        ctx.globalAlpha = blink ? 0.35 : 1;
        ctx.fillStyle = colorsRef.current[id] ?? "#fff";
        ctx.beginPath();
        ctx.arc(x, cy(y), R, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 0.07;
        ctx.strokeStyle = id === playerId ? "#fff" : "#183e40";
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [offset, playerId]);

  // Keyboard: WASD / arrow keys; the combined direction is sent whenever it changes.
  useEffect(() => {
    if (!isRunner || !online) return;
    const held = new Set<string>();
    const sync = () =>
      moveRef.current(
        (held.has("d") || held.has("ArrowRight") ? 1 : 0) - (held.has("a") || held.has("ArrowLeft") ? 1 : 0),
        (held.has("w") || held.has("ArrowUp") ? 1 : 0) - (held.has("s") || held.has("ArrowDown") ? 1 : 0),
      );
    const keys = ["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    const norm = (e: KeyboardEvent) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const down = (e: KeyboardEvent) => {
      if (!keys.includes(norm(e))) return;
      e.preventDefault();
      if (!held.has(norm(e))) {
        held.add(norm(e));
        sync();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (held.delete(norm(e))) sync();
    };
    const blur = () => {
      held.clear();
      sync();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [isRunner, online]);

  const secondsLeft = Math.max(0, Math.ceil((view.endsAt - now) / 1000));
  const runners = Object.entries(view.runners).map(([id, r]) => ({
    player: match.players.find((p) => p.id === id)!,
    runner: r,
  }));
  return (
    <div className="duel-game">
      <div className="duel-hud">
        {runners.map(({ player, runner }, i) => (
          <span
            key={player.id}
            className={`duel-side ${i ? "right" : ""}`}
            style={{ "--pawn-color": colors[player.id] } as React.CSSProperties}
          >
            <i /> {player.name}
            {player.id === playerId ? " · you" : ""}
            <b>{Math.min(100, Math.round((runner.bestY / FINISH_ROW) * 100))}%</b>
          </span>
        ))}
        <span className={`tp-timer ${secondsLeft <= 10 ? "urgent" : ""}`} role="timer">
          {secondsLeft}
          <small>s</small>
        </span>
      </div>
      <div className="sc-stage">
        <canvas
          ref={canvas}
          className="sc-course"
          aria-label="Street Cross course: reach the checkered finish at the top"
        />
        {me && <Joystick onMove={move} disabled={!online || me.finishedAt !== null} />}
      </div>
      <p className="duel-help">
        {me
          ? me.hits > 0
            ? `Hit ${me.hits}× — you restart on your last safe strip. Joystick or WASD / arrows.`
            : "Reach the checkered line first. Safe green strips are checkpoints. Joystick or WASD / arrows."
          : "Spectating the duel."}
      </p>
    </div>
  );
}
