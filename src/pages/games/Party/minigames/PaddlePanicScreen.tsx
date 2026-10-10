import { gameUi, useGameLanguage } from "../../../../i18n/gameUi.ts";
import { useEffect, useRef } from "react";
import { COLORS } from "../../../../games/party/config.ts";
import { PADDLE_PANIC_CONFIG as CONFIG } from "../../../../games/party/minigames/paddlePanic/config.ts";
import {
  paddleX,
  type Ball,
  type PaddlePanicView,
} from "../../../../games/party/minigames/paddlePanic/logic.ts";
import { useServerOffset } from "./useServerClock.ts";
import { useThrottledInput } from "./useThrottledInput.ts";
import type { MinigameViewProps } from "./views.ts";

const { width: W, height: H } = CONFIG.field;
const HALF = CONFIG.paddle.height / 2;
const clampPaddle = (y: number) => Math.min(H - HALF, Math.max(HALF, y));

// Ball position `dt` ms after the snapshot, folding wall bounces (paddles are resolved by the server).
function extrapolate(ball: Ball, dtMs: number): { x: number; y: number } {
  const t = Math.max(0, Math.min(dtMs, 250)) / 1000,
    r = CONFIG.ball.radius,
    span = H - 2 * r,
    raw = ball.y - r + ball.vy * t,
    folded = ((raw % (2 * span)) + 2 * span) % (2 * span);
  return { x: ball.x + ball.vx * t, y: r + (folded <= span ? folded : 2 * span - folded) };
}

// Presentation only. The server simulates the ball and paddles; this canvas extrapolates the latest
// snapshot each animation frame and shows the local paddle moving toward the finger immediately.
export default function PaddlePanicScreen({
  match,
  minigame,
  playerId,
  now,
  online,
  sendInput,
}: MinigameViewProps) {
  useGameLanguage();
  const view = minigame.state as PaddlePanicView;
  const canvas = useRef<HTMLCanvasElement>(null);
  const offset = useServerOffset(minigame.serverNow);
  const latest = useRef(view);
  const localTarget = useRef<number | null>(null);
  const mine = view.paddles[playerId];
  // Effects depend on this boolean, not on `mine` (a new object in every snapshot).
  const isPlayer = mine !== undefined;
  const push = useThrottledInput(sendInput, CONFIG.inputIntervalMs);
  useEffect(() => {
    latest.current = view;
  }, [view]);
  const colorOf = (id: string) =>
    COLORS[match.players.find((p) => p.id === id)?.avatarId ?? 0];
  const left = match.players.find((p) => p.id === view.sides.left)!,
    right = match.players.find((p) => p.id === view.sides.right)!;
  const leftColor = colorOf(left.id),
    rightColor = colorOf(right.id);

  // Draw loop: one rAF chain for the lifetime of the screen, cancelled on unmount.
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
      const s = (cssW / W) * dpr;
      const v = latest.current,
        serverNow = Date.now() + (offset.current ?? 0),
        dt = serverNow - v.simTime;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.fillStyle = "#123b3d";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 0.08;
      ctx.setLineDash([0.4, 0.4]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const [id, paddle] of Object.entries(v.paddles)) {
        let y = paddle.y;
        const target = id === playerId && localTarget.current !== null ? localTarget.current : paddle.targetY;
        const step = (CONFIG.paddle.maxSpeed * Math.max(0, Math.min(dt, 250))) / 1000;
        y = clampPaddle(y + Math.max(-step, Math.min(step, target - y)));
        ctx.fillStyle = id === v.sides.left ? leftColor : rightColor;
        const x = paddleX(paddle.side) - CONFIG.paddle.width / 2;
        ctx.beginPath();
        ctx.roundRect(x, y - HALF, CONFIG.paddle.width, CONFIG.paddle.height, 0.2);
        ctx.fill();
        if (id === playerId) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 0.08;
          ctx.stroke();
        }
      }
      const ball = v.serveAt === null && !v.winnerId ? extrapolate(v.ball, dt) : v.ball;
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, CONFIG.ball.radius, 0, Math.PI * 2);
      ctx.fill();
      if (v.serveAt !== null && serverNow < v.serveAt) {
        const left = (v.serveAt - serverNow) / CONFIG.ball.serveDelayMs;
        ctx.strokeStyle = "rgba(255,226,122,0.7)";
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 0.7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
        ctx.stroke();
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [offset, playerId, leftColor, rightColor]);

  // Keyboard is optional (↑/↓ or W/S); held keys nudge the target every frame.
  useEffect(() => {
    if (!isPlayer || !online) return;
    const held = new Set<string>();
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const dir =
        (held.has("ArrowDown") || held.has("s") ? 1 : 0) -
        (held.has("ArrowUp") || held.has("w") ? 1 : 0);
      if (!dir) return;
      const current = localTarget.current ?? latest.current.paddles[playerId]?.targetY ?? H / 2;
      localTarget.current = clampPaddle(current + dir * 0.22);
      push({ type: "PADDLE", y: Math.round((localTarget.current / H) * 1000) / 1000 });
    };
    const down = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (["ArrowUp", "ArrowDown", "w", "s"].includes(key)) {
        held.add(key);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) =>
      held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    frame = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      cancelAnimationFrame(frame);
    };
  }, [isPlayer, online, playerId, push]);

  const aimAt = (clientY: number) => {
    const el = canvas.current;
    if (!el || !isPlayer || !online) return;
    const rect = el.getBoundingClientRect(),
      y = clampPaddle(((clientY - rect.top) / rect.height) * H);
    localTarget.current = y;
    push({ type: "PADDLE", y: Math.round((y / H) * 1000) / 1000 });
  };
  const secondsLeft = Math.max(0, Math.ceil((view.endsAt - now) / 1000));
  const scorer = view.lastPoint && now - view.lastPoint.at < 1200 ? view.lastPoint.scorerId : null;
  return (
    <div className="duel-game">
      <div className="duel-hud">
        <span className="duel-side" style={{ "--pawn-color": leftColor } as React.CSSProperties}>
          <i /> {gameUi(left.name)}
          {gameUi(left.id === playerId ? " · you" : "")}
          <b>{gameUi(view.scores[left.id])}</b>
        </span>
        <span className={`tp-timer ${secondsLeft <= 10 ? "urgent" : ""}`} role="timer">
          {gameUi(secondsLeft)}
          <small>s</small>
        </span>
        <span className="duel-side right" style={{ "--pawn-color": rightColor } as React.CSSProperties}>
          <b>{gameUi(view.scores[right.id])}</b>
          {gameUi(right.name)}
          {gameUi(right.id === playerId ? " · you" : "")} <i />
        </span>
      </div>
      <canvas
        ref={canvas}
        className="pp-paddle-court"
        aria-label={gameUi(`Paddle Panic court. ${left.name} ${view.scores[left.id]}, ${right.name} ${view.scores[right.id]}. First to ${CONFIG.pointsToWin}.`)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          aimAt(e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.pointerType === "mouse" || e.buttons) aimAt(e.clientY);
        }}
      />
      <p className="duel-help">
        {gameUi(mine
          ? `You are ${mine.side.toUpperCase()}. Drag up and down anywhere on the court. First to ${CONFIG.pointsToWin}.`
          : "Spectating the duel.")}
      </p>
      {scorer && (
        <div className="tp-banner duel-point" key={view.lastPoint!.at}>{gameUi(" POINT ")}{gameUi(match.players.find((p) => p.id === scorer)?.name.toUpperCase())}
        </div>
      )}
    </div>
  );
}
