import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { GameResult, Player, PlayMode, Vec } from "../../games/natura/naturaData";
import { ARCHER_HEIGHT, ARCHER_SECONDS, ARCHER_TARGET, ARCHER_WIDTH, DASH_COOLDOWN, WATERLINE, createArcherGame, emptyArcherInput, updateArcherGame } from "../../games/natura/archerfish";
import type { ArcherGame, ArcherInput } from "../../games/natura/archerfish";
import { drawArcherGame } from "../../games/natura/archerfishDrawing";
import "./archerfish.css";

type Action = "left" | "right" | "aimLeft" | "aimRight" | "shoot" | "dash";
type HeldControl = { player: Player; action: Action };
const KEY_BINDINGS: [Record<Action, string>, Record<Action, string>] = [
  { left: "KeyA", right: "KeyD", aimLeft: "KeyW", aimRight: "KeyS", shoot: "Space", dash: "ShiftLeft" },
  { left: "ArrowLeft", right: "ArrowRight", aimLeft: "ArrowUp", aimRight: "ArrowDown", shoot: "Enter", dash: "ShiftRight" },
];
const GAME_KEYS = new Set(Object.values(KEY_BINDINGS).flatMap(Object.values));
const fishName = (player: Player, mode: PlayMode) => mode === "ai" ? (player === 0 ? "You" : "AI") : `Player ${player + 1}`;
const snapshot = (game: ArcherGame) => ({
  phase: game.phase, time: Math.ceil(game.time), winner: game.winner,
  fish: game.fish.map(fish => ({ catches: fish.catches, shots: fish.shots, hits: fish.hits, dash: fish.dashCooldown })),
  notice: game.noticeTime > 0 ? game.notice : "A shot sets the race in motion. Either fish can take the catch.",
});

function HoldControl({ label, title, disabled, onHold, onRelease }: {
  label: string; title: string; disabled: boolean;
  onHold: (id: number) => void; onRelease: (id: number) => void;
}) {
  return <button type="button" disabled={disabled} aria-label={title} title={title}
    onPointerDown={event => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      onHold(event.pointerId);
    }}
    onPointerUp={event => onRelease(event.pointerId)}
    onPointerCancel={event => onRelease(event.pointerId)}
    onLostPointerCapture={event => onRelease(event.pointerId)}
    onKeyDown={event => { if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); onHold(-1); } }}
    onKeyUp={event => { if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); onRelease(-1); } }}
    onBlur={() => onRelease(-1)}>{label}</button>;
}

export default function ArcherfishGame({ mode, rulesOpen = false, onComplete }: {
  mode: PlayMode; rulesOpen?: boolean; onComplete: (result: GameResult) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<ArcherGame>(createArcherGame());
  const keys = useRef(new Set<string>());
  const held = useRef(new Map<number, HeldControl>());
  const pointerAim = useRef<Vec | undefined>(undefined);
  const tapShot = useRef(false);
  const completed = useRef(false);
  const [view, setView] = useState(() => snapshot(createArcherGame()));
  const [canvasUnavailable, setCanvasUnavailable] = useState(false);
  const clearControls = useCallback(() => {
    keys.current.clear(); held.current.clear(); tapShot.current = false; pointerAim.current = undefined;
  }, []);
  const pause = useCallback(() => {
    clearControls();
    if (gameRef.current.phase !== "playing") return;
    gameRef.current.phase = "paused";
    setView(snapshot(gameRef.current));
  }, [clearControls]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Escape") { pause(); return; }
      if (event.target instanceof HTMLElement && event.target.closest("button, input, textarea, select, summary, a, [contenteditable=true]")) return;
      if (!GAME_KEYS.has(event.code) || gameRef.current.phase !== "playing" || rulesOpen) return;
      event.preventDefault();
      keys.current.add(event.code);
      if (event.code === "KeyW" || event.code === "KeyS") pointerAim.current = undefined;
    };
    const up = (event: KeyboardEvent) => { keys.current.delete(event.code); };
    const visibility = () => { if (document.hidden) pause(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      window.removeEventListener("blur", pause); document.removeEventListener("visibilitychange", visibility);
      clearControls();
    };
  }, [clearControls, pause, rulesOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let frame = 0, last = performance.now(), lastUi = 0;
    const inputFor = (player: Player): ArcherInput => {
      const pressed = (action: Action) => keys.current.has(KEY_BINDINGS[player][action]) ||
        [...held.current.values()].some(control => control.player === player && control.action === action);
      return {
        move: Number(pressed("right")) - Number(pressed("left")),
        aim: Number(pressed("aimRight")) - Number(pressed("aimLeft")),
        shoot: pressed("shoot") || (player === 0 && tapShot.current), dash: pressed("dash"),
        target: player === 0 ? pointerAim.current : undefined,
      };
    };
    const tick = (now: number) => {
      const game = gameRef.current;
      const previousPhase = game.phase;
      if (!rulesOpen) updateArcherGame(game, [inputFor(0), mode === "ai" ? emptyArcherInput() : inputFor(1)], (now - last) / 1000, mode === "ai");
      last = now;
      tapShot.current = false;
      drawArcherGame(context, game, mode === "ai");
      if (now - lastUi > 80 || game.phase !== previousPhase) {
        setView(snapshot(game)); lastUi = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, rulesOpen]);

  const start = () => {
    if (!canvasRef.current?.getContext("2d")) { setCanvasUnavailable(true); return; }
    clearControls();
    if (gameRef.current.phase === "ready" || gameRef.current.phase === "paused") {
      gameRef.current.phase = "playing";
      setView(snapshot(gameRef.current));
      canvasRef.current.focus();
    }
  };
  const aimAt = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (gameRef.current.phase !== "playing" || rulesOpen) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) * ARCHER_WIDTH / bounds.width, y: (event.clientY - bounds.top) * ARCHER_HEIGHT / bounds.height };
    if (point.y < WATERLINE - 15) pointerAim.current = point;
  };
  const finish = () => {
    const game = gameRef.current;
    if (completed.current || game.phase !== "finished") return;
    completed.current = true;
    onComplete({ winner: game.winner, detail: `Archerfish food: ${game.fish[0].catches} – ${game.fish[1].catches}. ${game.time > 0 ? "The food target was reached." : "Time expired."}` });
  };
  const active = view.phase === "playing" && !rulesOpen;
  const overlay = view.phase !== "playing" || rulesOpen;

  return <section className="af-game" aria-label="Spit and Sprint archerfish game">
    <header className="af-heading"><div><p className="natura-eyebrow">05 / THE MANGROVES</p><h1>Spit &amp; Sprint<span>.</span></h1><p>One perfect shot. Two hungry fish.</p></div>
      <span className="af-badge">AIM · SPIT · INTERCEPT</span></header>
    <div className="af-arena">
      <div className="af-hud" aria-label="Archerfish round scores">
        <div className="af-coral"><small>{fishName(0, mode)} / CORAL</small><strong>{view.fish[0].catches}<span> food</span></strong></div>
        <div className="af-clock"><small>FIRST TO {ARCHER_TARGET}</small><strong>{view.time}<span>s</span></strong></div>
        <div className="af-gold"><small>{fishName(1, mode)} / GOLD</small><strong>{view.fish[1].catches}<span> food</span></strong></div>
      </div>
      <div className="af-stage">
        <canvas ref={canvasRef} width={ARCHER_WIDTH} height={ARCHER_HEIGHT} tabIndex={0}
          aria-label="Two archerfish below insect-covered mangrove branches. Aim a water jet above the surface, then swim to the falling insect."
          aria-describedby="archer-controls"
          onPointerMove={aimAt} onPointerDown={event => {
            event.preventDefault(); event.currentTarget.focus(); aimAt(event);
            const bounds = event.currentTarget.getBoundingClientRect();
            if ((event.clientY - bounds.top) * ARCHER_HEIGHT / bounds.height < WATERLINE - 15 && active) tapShot.current = true;
          }} onPointerLeave={() => { pointerAim.current = undefined; }} />
        {overlay && <div className="af-overlay"><div className="af-dialog">
          {view.phase === "finished" ? <>
            <span className="af-kicker">THE ESTUARY SETTLES</span>
            <h2>{view.winner === null ? "A shared victory." : `${fishName(view.winner, mode)} ${mode === "ai" && view.winner === 0 ? "win" : "wins"}!`}</h2>
            <p>{view.fish[0].catches} – {view.fish[1].catches} food · {view.time > 0 ? "Target reached" : "Time’s up"}</p>
            <p className="af-result-detail">Accurate shots: {view.fish[0].hits}/{view.fish[0].shots} · {view.fish[1].hits}/{view.fish[1].shots}</p>
            <button className="natura-primary" onClick={finish}>Continue to animal quiz →</button>
          </> : <>
            <span className="af-kicker">{view.phase === "ready" ? "SURFACE TENSION" : "TAKE A BREATHER"}</span>
            <h2>{view.phase === "ready" ? "Make your shot count." : "The pond is paused."}</h2>
            <p>{rulesOpen ? "Close the animal rules above to return to the pond." : view.phase === "ready" ? `Knock insects down. Race to the landing rings. First to ${ARCHER_TARGET} food, or the most after ${ARCHER_SECONDS} seconds, wins.` : "Your fish and the timer are waiting for you."}</p>
            {!rulesOpen && <button className="natura-primary" onClick={start}>{view.phase === "ready" ? "Enter the estuary →" : "Resume the hunt →"}</button>}
            {canvasUnavailable && <p role="alert">This browser could not start the canvas. Try a browser with canvas support.</p>}
          </>}
        </div></div>}
      </div>
      <div className="af-status"><p role="status">{view.notice}</p><button disabled={!active} onClick={pause}>Ⅱ Pause</button></div>
    </div>
    <div id="archer-controls" className="af-controls">
      {([0, 1] as const).filter(player => mode !== "ai" || player === 0).map(player => <div key={player} className={`af-control-card ${player === 0 ? "af-coral" : "af-gold"}`}>
        <div className="af-control-title"><strong>{fishName(player, mode)} · {player === 0 ? "Coral" : "Gold"}</strong><span>{view.fish[player].dash <= 0 ? "DASH READY" : `DASH ${view.fish[player].dash.toFixed(1)}s`}</span></div>
        <p>{player === 0 ? "A / D swim · W / S aim left / right · Space spit · Left Shift dash" : "← / → swim · ↑ / ↓ aim left / right · Enter spit · Right Shift dash"}</p>
        <div className="af-touch" role="group" aria-label={`${fishName(player, mode)} touch controls`}>
          {([
            ["left", "←", "Swim left"], ["right", "→", "Swim right"], ["aimLeft", "↖", "Aim left"],
            ["aimRight", "↗", "Aim right"], ["shoot", "Spit", "Spit water"], ["dash", "Dash", "Dash while swimming"],
          ] as const).map(([action, label, title]) => <HoldControl key={action} label={label} title={`${fishName(player, mode)}: ${title}`} disabled={!active}
            onHold={id => {
              held.current.set(id, { player, action });
              if (player === 0 && (action === "aimLeft" || action === "aimRight")) pointerAim.current = undefined;
            }} onRelease={id => held.current.delete(id)} />)}
        </div>
        <div className="af-dash-meter" role="progressbar" aria-label={`${fishName(player, mode)} dash recharge`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((1 - view.fish[player].dash / DASH_COOLDOWN) * 100)}>
          <span style={{ width: `${(1 - view.fish[player].dash / DASH_COOLDOWN) * 100}%` }} />
        </div>
      </div>)}
      <aside className="af-field-note"><span className="af-kicker">A HUNTER’S HEAD START</span><h3>Watch where it falls.</h3><p>Archerfish predict where dislodged prey will land. Your landing ring makes that skill visible: swim toward it as soon as the insect falls.</p><small>Coral can also aim with a pointer and click or tap above the water to spit. Hold the controls to keep moving. Esc pauses.</small></aside>
    </div>
  </section>;
}
