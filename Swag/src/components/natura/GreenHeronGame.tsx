import { useEffect, useRef, useState } from "react";
import {
  createHeronGame,
  HERON_H,
  HERON_W,
  type HeronGame,
  type HeronInput,
  idleHeronInput,
  updateHeronGame,
} from "../../games/natura/greenHeron";
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
    bait: "Space",
    strike: "ShiftLeft",
  },
  {
    left: "ArrowLeft",
    right: "ArrowRight",
    up: "ArrowUp",
    down: "ArrowDown",
    bait: "Enter",
    strike: "ShiftRight",
  },
];
const name = (player: Player, mode: PlayMode) =>
  mode === "ai" ? (player === 0 ? "You" : "AI") : `Player ${player + 1}`;

export default function GreenHeronGame({
  mode,
  rulesOpen = false,
  onComplete,
}: {
  mode: PlayMode;
  rulesOpen?: boolean;
  onComplete: (result: GameResult) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<HeronGame>(createHeronGame());
  const keys = useRef(new Set<string>());
  const [view, setView] = useState<HeronGame>(() =>
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
        const input = (player: Player): HeronInput => ({
          x:
            Number(keys.current.has(BINDINGS[player].right)) -
            Number(keys.current.has(BINDINGS[player].left)),
          y:
            Number(keys.current.has(BINDINGS[player].down)) -
            Number(keys.current.has(BINDINGS[player].up)),
          bait: keys.current.has(BINDINGS[player].bait),
          strike: keys.current.has(BINDINGS[player].strike),
        });
        updateHeronGame(
          gameRef.current,
          [input(0), mode === "ai" ? idleHeronInput() : input(1)],
          dt,
          mode === "ai",
        );
      }
      ctx.clearRect(0, 0, HERON_W, HERON_H);
      ctx.fillStyle = "#8ebabd";
      ctx.fillRect(0, 0, HERON_W, HERON_H);
      ctx.fillStyle = "#4e6d36";
      ctx.fillRect(0, 420, HERON_W, 120);
      for (const fish of gameRef.current.fish) {
        ctx.fillStyle = "#d9a059";
        ctx.beginPath();
        ctx.ellipse(
          fish.x,
          fish.y,
          fish.size,
          fish.size * 0.7,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      if (gameRef.current.bait) {
        ctx.fillStyle = "#e8d4a9";
        ctx.beginPath();
        ctx.arc(
          gameRef.current.bait.x,
          gameRef.current.bait.y,
          10,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      for (const [index, player] of gameRef.current.players.entries()) {
        ctx.fillStyle = index === 0 ? "#305b54" : "#705f52";
        ctx.fillRect(player.x - 18, player.y - 10, 36, 20);
        ctx.fillRect(player.x + player.facing * 14, player.y - 4, 14, 6);
      }
      setView(structuredClone(gameRef.current));
      if (gameRef.current.phase === "finished")
        onComplete({
          winner: gameRef.current.winner,
          detail: `Bait & Wait: ${gameRef.current.players[0].score} vs ${gameRef.current.players[1].score}.`,
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
    <section className="nw-game" aria-label="Bait & Wait game">
      <header className="nw-heading">
        <p className="natura-eyebrow">04 / THE POND EDGE</p>
        <h1>
          Bait &amp; Wait<span>.</span>
        </h1>
        <p>Drop a lure, read the drift, then strike at the right moment.</p>
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
                width={HERON_W}
                height={HERON_H}
                aria-label="Green heron baiting and striking fish in a pond"
              />
              {!active && (
                <div className="nw-overlay">
                  <div className="nw-dialog">
                    <small>
                      {view.phase === "finished"
                        ? "ROUND COMPLETE"
                        : "WAIT FOR THE RIGHT MOMENT"}
                    </small>
                    <h2>
                      {view.phase === "finished"
                        ? "Lure set."
                        : "Ready to fish?"}
                    </h2>
                    <p>
                      {view.phase === "finished"
                        ? `Final score: ${view.players[0].score} – ${view.players[1].score}.`
                        : `Place the bait, let the drift do its work, then strike before the fish slip away from the lure.`}
                    </p>
                    {!rulesOpen && (
                      <button className="natura-primary" onClick={start}>
                        {view.phase === "ready"
                          ? "Enter the pond →"
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
            <h3>Patience cuts both ways.</h3>
            <p>
              Drop the lure, then read the fish as they drift in. A quick strike
              can earn a smaller catch; waiting yields a better opportunity but
              risks losing the bait as it floats away. The challenge is to
              choose when the lure is worth the risk and when to commit.
            </p>
            <small>
              Esc pauses. Use WASD or arrows to move; Space/Enter sets bait and
              Shift strikes.
            </small>
          </div>
          <DidYouKnow scenario="greenheron" />
        </aside>
      </div>
    </section>
  );
}
