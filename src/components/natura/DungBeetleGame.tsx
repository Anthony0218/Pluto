import { useEffect, useRef, useState } from "react";
import {
  createDungBeetleGame,
  DUNG_H,
  DUNG_W,
  type BeetleGame,
  type BeetleInput,
  idleBeetleInput,
  updateDungBeetleGame,
} from "../../games/natura/dungBeetle";
import type {
  GameResult,
  PlayMode,
  Player,
} from "../../games/natura/naturaData";
import DidYouKnow from "./DidYouKnow";

const BINDINGS: [Record<string, string>, Record<string, string>] = [
  {
    left: "KeyA",
    right: "KeyD",
    accelerate: "KeyW",
    brake: "KeyS",
    recenter: "Space",
  },
  {
    left: "ArrowLeft",
    right: "ArrowRight",
    accelerate: "ArrowUp",
    brake: "ArrowDown",
    recenter: "Enter",
  },
];
const name = (player: Player, mode: PlayMode) =>
  mode === "ai" ? (player === 0 ? "You" : "AI") : `Player ${player + 1}`;

export default function DungBeetleGame({
  mode,
  rulesOpen = false,
  onComplete,
}: {
  mode: PlayMode;
  rulesOpen?: boolean;
  onComplete: (result: GameResult) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<BeetleGame>(createDungBeetleGame());
  const keys = useRef(new Set<string>());
  const [view, setView] = useState<BeetleGame>(() =>
    structuredClone(gameRef.current),
  );

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        if (gameRef.current.phase === "playing") {
          gameRef.current.phase = "paused";
          setView(structuredClone(gameRef.current));
        }
        return;
      }
      if (rulesOpen || gameRef.current.phase !== "playing") return;
      if (
        Object.values(BINDINGS[0])
          .concat(Object.values(BINDINGS[1]))
          .includes(event.code)
      ) {
        event.preventDefault();
        keys.current.add(event.code);
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const blur = () => keys.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [rulesOpen]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.04);
      last = now;
      if (!rulesOpen) {
        const input = (player: Player): BeetleInput => ({
          left: keys.current.has(BINDINGS[player].left),
          right: keys.current.has(BINDINGS[player].right),
          accelerate: keys.current.has(BINDINGS[player].accelerate),
          brake: keys.current.has(BINDINGS[player].brake),
          recenter: keys.current.has(BINDINGS[player].recenter),
        });
        updateDungBeetleGame(
          gameRef.current,
          [input(0), mode === "ai" ? idleBeetleInput() : input(1)],
          dt,
          mode === "ai",
        );
      }
      ctx.clearRect(0, 0, DUNG_W, DUNG_H);
      ctx.fillStyle = "#1c2c34";
      ctx.fillRect(0, 0, DUNG_W, DUNG_H);
      ctx.fillStyle = "#86d6ef";
      for (const cloud of gameRef.current.clouds) {
        ctx.globalAlpha = cloud.opacity;
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, 28 * cloud.scale, 0, Math.PI * 2);
        ctx.arc(cloud.x + 24, cloud.y + 10, 22 * cloud.scale, 0, Math.PI * 2);
        ctx.arc(cloud.x - 20, cloud.y + 10, 18 * cloud.scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      for (const obstacle of gameRef.current.obstacles) {
        ctx.fillStyle = "#817a5f";
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
      }
      for (const [index, player] of gameRef.current.players.entries()) {
        ctx.fillStyle = index === 0 ? "#d1a16a" : "#8d654a";
        ctx.beginPath();
        ctx.arc(player.x, player.y, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      setView(structuredClone(gameRef.current));
      if (gameRef.current.phase === "finished")
        onComplete({
          winner: gameRef.current.winner,
          detail: `Milky Way Express: ${gameRef.current.players[0].score} vs ${gameRef.current.players[1].score}.`,
        });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, onComplete, rulesOpen]);

  const start = () => {
    if (
      gameRef.current.phase === "ready" ||
      gameRef.current.phase === "paused"
    ) {
      gameRef.current.phase = "playing";
      setView(structuredClone(gameRef.current));
    }
  };

  const active = view.phase === "playing" && !rulesOpen;

  return (
    <section className="nw-game" aria-label="Milky Way Express game">
      <header className="nw-heading">
        <p className="natura-eyebrow">03 / THE NIGHT SKY</p>
        <h1>
          Milky Way Express<span>.</span>
        </h1>
        <p>
          Roll the ball with a steady heading, then recover quickly after a
          detour.
        </p>
      </header>
      <div className="nw-layout">
        <div className="nw-play">
          <div className="nw-arena">
            <div className="nw-hud">
              <div className="nw-coral">
                <small>{name(0, mode)} / CORAL</small>
                <b>{view.players[0].score}</b>
              </div>
              <div className="nw-clock">
                <small>TIME LEFT</small>
                <b>
                  {Math.ceil(view.time)}
                  <em>s</em>
                </b>
              </div>
              <div className="nw-gold">
                <small>{name(1, mode)} / GOLD</small>
                <b>{view.players[1].score}</b>
              </div>
            </div>
            <div className="nw-stage">
              <canvas
                ref={canvasRef}
                width={DUNG_W}
                height={DUNG_H}
                aria-label="Dung beetle rolling through terrain while aiming at the Milky Way"
              />
              {!active && (
                <div className="nw-overlay">
                  <div className="nw-dialog">
                    <small>
                      {view.phase === "finished"
                        ? "ROUND COMPLETE"
                        : "HEAD INTO THE DUSK"}
                    </small>
                    <h2>
                      {view.phase === "finished"
                        ? "Track recovered."
                        : "Ready to roll?"}
                    </h2>
                    <p>
                      {view.phase === "finished"
                        ? `Final score: ${view.players[0].score} – ${view.players[1].score}.`
                        : `Keep the little sky view aligned with the Milky Way. Clouds briefly hide your stars, so corrections matter.`}
                    </p>
                    {!rulesOpen && (
                      <button className="natura-primary" onClick={start}>
                        {view.phase === "ready"
                          ? "Start the run →"
                          : "Resume →"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="nw-status">
              <p role="status">{view.notice}</p>
            </div>
          </div>
        </div>
        <aside className="nw-guide">
          <div className="nw-tip">
            <small>FIELD GUIDE</small>
            <h3>Loose heading is the enemy.</h3>
            <p>
              Use the Milky Way as a compass and keep the ball moving in a
              straight line. A quick detour around an obstacle is easy;
              recovering the original course after the bend is the real
              challenge. Cloud cover makes the drift more noticeable, so
              re-centre before the route gets wild.
            </p>
            <small>
              Esc pauses. Use A/D or arrows to steer; W/Up accelerates, S/Down
              brakes, Space/Enter re-centres.
            </small>
          </div>
          <DidYouKnow scenario="dungbeetle" />
        </aside>
      </div>
    </section>
  );
}
