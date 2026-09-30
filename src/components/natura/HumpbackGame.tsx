import { useEffect, useRef, useState } from "react";
import {
  createHumpbackGame,
  HUMPBACK_H,
  HUMPBACK_W,
  type HumpbackGame,
  type HumpbackInput,
  idleHumpbackInput,
  updateHumpbackGame,
} from "../../games/natura/humpback";
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
    up: "KeyW",
    down: "KeyS",
    bubble: "Space",
    dive: "ShiftLeft",
  },
  {
    left: "ArrowLeft",
    right: "ArrowRight",
    up: "ArrowUp",
    down: "ArrowDown",
    bubble: "Enter",
    dive: "ShiftRight",
  },
];
const name = (player: Player, mode: PlayMode) =>
  mode === "ai" ? (player === 0 ? "You" : "AI") : `Player ${player + 1}`;

export default function HumpbackGame({
  mode,
  rulesOpen = false,
  onComplete,
}: {
  mode: PlayMode;
  rulesOpen?: boolean;
  onComplete: (result: GameResult) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<HumpbackGame>(createHumpbackGame());
  const keys = useRef(new Set<string>());
  const [view, setView] = useState<HumpbackGame>(() =>
    structuredClone(gameRef.current),
  );
  const [ready, setReady] = useState(false);

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
        event.target instanceof HTMLElement &&
        event.target.closest(
          "button, input, textarea, select, summary, a, [contenteditable=true]",
        )
      )
        return;
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
        const input = (player: Player): HumpbackInput => ({
          x:
            Number(keys.current.has(BINDINGS[player].right)) -
            Number(keys.current.has(BINDINGS[player].left)),
          y:
            Number(keys.current.has(BINDINGS[player].down)) -
            Number(keys.current.has(BINDINGS[player].up)),
          bubble: keys.current.has(BINDINGS[player].bubble),
          dive: keys.current.has(BINDINGS[player].dive),
        });
        updateHumpbackGame(
          gameRef.current,
          [input(0), mode === "ai" ? idleHumpbackInput() : input(1)],
          dt,
          mode === "ai",
        );
      }
      // render
      ctx.clearRect(0, 0, HUMPBACK_W, HUMPBACK_H);
      ctx.fillStyle = "#0b3b4d";
      ctx.fillRect(0, 0, HUMPBACK_W, HUMPBACK_H);
      ctx.fillStyle = "#6ec7d4";
      for (const bubble of gameRef.current.bubbles) {
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const fish of gameRef.current.fish) {
        ctx.fillStyle = "#f9d57a";
        ctx.beginPath();
        ctx.arc(fish.x, fish.y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const [index, player] of gameRef.current.players.entries()) {
        ctx.fillStyle = index === 0 ? "#f5d3a7" : "#d8ba78";
        ctx.beginPath();
        ctx.arc(player.x, player.y, 18, 0, Math.PI * 2);
        ctx.fill();
      }
      setView(structuredClone(gameRef.current));
      if (gameRef.current.phase === "finished") {
        const winner = gameRef.current.winner;
        onComplete({
          winner,
          detail: `Bubble Corral: ${gameRef.current.players[0].score} vs ${gameRef.current.players[1].score}.`,
        });
      }
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
      setReady(true);
      setView(structuredClone(gameRef.current));
    }
  };

  const active = view.phase === "playing" && !rulesOpen;

  return (
    <section className="nw-game" aria-label="Bubble Corral game">
      <header className="nw-heading">
        <p className="natura-eyebrow">02 / THE OPEN OCEAN</p>
        <h1>
          Bubble Corral<span>.</span>
        </h1>
        <p>
          Circle the school, bubble it in, then dive through the tight patch.
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
                width={HUMPBACK_W}
                height={HUMPBACK_H}
                aria-label="Bubble corral whale gameplay"
              />
              {(!active || !ready) && (
                <div className="nw-overlay">
                  <div className="nw-dialog">
                    <small>
                      {view.phase === "finished"
                        ? "ROUND COMPLETE"
                        : "THE SCHOOL IS SPREAD OUT"}
                    </small>
                    <h2>
                      {view.phase === "finished"
                        ? "Bubble rush complete."
                        : "Ready to start?"}
                    </h2>
                    <p>
                      {view.phase === "finished"
                        ? `Score: ${view.players[0].score} – ${view.players[1].score}.`
                        : `Swim around the packed school, leave a bubble trail, and dive when the shoal is tight enough.`}
                    </p>
                    {!rulesOpen && (
                      <button className="natura-primary" onClick={start}>
                        {view.phase === "ready"
                          ? "Enter the shoal →"
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
            <h3>Keep the school compact.</h3>
            <p>
              Bubble around the fish, then dive as the shoal tightens. A rapid
              lunge gives a smaller catch; waiting for a dense patch can pay
              off. Wide loops give prey more room, and the time limit punishes
              slow circling.
            </p>
            <small>
              Esc pauses. Move with WASD or arrows, bubble with Space/Enter,
              dive with Shift.
            </small>
          </div>
          <DidYouKnow scenario="humpback" />
        </aside>
      </div>
    </section>
  );
}
