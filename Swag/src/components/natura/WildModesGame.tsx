import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult, Player, PlayMode } from "../../games/natura/naturaData";
import { PATTERN_NAMES, SNAP_LEVELS, snapPlatforms, createSnapGame, WILD_H, WILD_W, camouflageMatches, createWildGame, habitatAt,
  idleWildInput, setCuttleSkin, updateWildGame } from "../../games/natura/wildModes";
import type { Pattern, WildGame, WildInput, WildKind } from "../../games/natura/wildModes";
import { drawWildGame } from "../../games/natura/wildModesDrawing";
import DidYouKnow from "./DidYouKnow";
import "./wildModes.css";

type Action = "left" | "right" | "up" | "down" | "action" | "secondary";
const BINDINGS: [Record<Action, string>, Record<Action, string>] = [
  { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS", action: "Space", secondary: "ShiftLeft" },
  { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", action: "Enter", secondary: "ShiftRight" },
];
const USED_KEYS = new Set(BINDINGS.flatMap(binding => Object.values(binding)));
const name = (player: Player, mode: PlayMode) => mode === "ai" ? player === 0 ? "You" : "AI" : `Player ${player + 1}`;
const titles = { trapjaw: "Snap Launch", cuttlefish: "Hide in Plain Sight" };

function HoldButton({ label, title, disabled, press, release }: {
  label: string; title: string; disabled: boolean; press: (id: number) => void; release: (id: number) => void;
}) {
  return <button type="button" aria-label={title} title={title} disabled={disabled}
    onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); press(event.pointerId); }}
    onPointerUp={event => release(event.pointerId)} onPointerCancel={event => release(event.pointerId)}
    onLostPointerCapture={event => release(event.pointerId)}
    onKeyDown={event => { if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); press(-1); } }}
    onKeyUp={event => { if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); release(-1); } }}
    onBlur={() => release(-1)}>{label}</button>;
}

export default function WildModesGame({ kind, mode, round = 1, rulesOpen = false, onComplete }: {
  kind: WildKind; mode: PlayMode; round?: number; rulesOpen?: boolean; onComplete: (result: GameResult) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [initial] = useState(() => createWildGame(kind, (round - 1) % SNAP_LEVELS.length, Math.floor(Math.random() * 0x100000000)));
  const game = useRef<WildGame>(initial);
  const keys = useRef(new Set<string>());
  const held = useRef(new Map<number, { player: Player; action: Action }>());
  const completed = useRef(false);
  const [view, setView] = useState<WildGame>(() => structuredClone(initial));
  const [canvasError, setCanvasError] = useState(false);
  const clearInput = useCallback(() => { keys.current.clear(); held.current.clear(); }, []);
  const pause = useCallback(() => {
    clearInput();
    if (game.current.phase !== "playing") return;
    game.current.phase = "paused"; setView(structuredClone(game.current));
  }, [clearInput]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Escape") { pause(); return; }
      if (game.current.phase !== "playing" || rulesOpen || !USED_KEYS.has(event.code)) return;
      if (event.target instanceof HTMLElement && event.target.closest("button, input, textarea, select, summary, a, [contenteditable=true]")) return;
      event.preventDefault(); keys.current.add(event.code);
    };
    const up = (event: KeyboardEvent) => { keys.current.delete(event.code); };
    const visibility = () => { if (document.hidden) pause(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    window.addEventListener("blur", pause); document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("keydown", down); window.removeEventListener("keyup", up);
      window.removeEventListener("blur", pause); document.removeEventListener("visibilitychange", visibility); clearInput();
    };
  }, [clearInput, pause, rulesOpen]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let frame = 0, last = performance.now(), ui = 0;
    const input = (player: Player): WildInput => {
      const pressed = (action: Action) => keys.current.has(BINDINGS[player][action]) ||
        [...held.current.values()].some(control => control.player === player && control.action === action);
      return { x: Number(pressed("right")) - Number(pressed("left")), y: Number(pressed("down")) - Number(pressed("up")),
        action: pressed("action"), secondary: pressed("secondary") };
    };
    const tick = (now: number) => {
      const before = game.current.phase;
      if (!rulesOpen) updateWildGame(game.current, [input(0), mode === "ai" ? idleWildInput() : input(1)], (now - last) / 1000, mode === "ai");
      last = now;
      drawWildGame(ctx, game.current, mode === "ai");
      if (now - ui > 80 || before !== game.current.phase) { setView(structuredClone(game.current)); ui = now; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, rulesOpen]);

  const start = () => {
    if (!canvas.current?.getContext("2d")) { setCanvasError(true); return; }
    if (rulesOpen || (game.current.phase !== "ready" && game.current.phase !== "paused")) return;
    clearInput(); game.current.actionHeld = [false, false]; game.current.secondaryHeld = [false, false];
    game.current.phase = "playing"; setView(structuredClone(game.current)); canvas.current.focus();
  };
  const finish = () => {
    const current = game.current;
    if (current.phase !== "finished" || completed.current) return;
    completed.current = true;
    const scores = current.kind === "trapjaw" ? current.players.map(p => `ledge ${p.checkpoint + 1}, ${p.lives} hearts`) : current.players.map(p => `${p.food} shrimp, ${p.lives} hearts`);
    onComplete({ winner: current.winner, detail: `${titles[kind]}${current.kind === "trapjaw" ? ` / ${SNAP_LEVELS[current.level].name}` : ""}: ${scores[0]} vs ${scores[1]}.` });
  };
  const active = view.phase === "playing" && !rulesOpen;
  const controls: [Action, string, string][] = kind === "trapjaw" ? [
    ["left", "←", "Walk left"], ["right", "→", "Walk right"], ["up", "↗", "Aim steeper"],
    ["down", "↘", "Aim flatter"], ["action", "Snap", "Snap jaws to launch"],
  ] : [["left", "←", "Swim left"], ["right", "→", "Swim right"], ["up", "↑", "Swim up"], ["down", "↓", "Swim down"]];
  const skin = (player: Player, pattern?: Pattern, bumpy?: boolean) => {
    if (!active) return;
    setCuttleSkin(game.current, player, pattern, bumpy); setView(structuredClone(game.current)); canvas.current?.focus();
  };

  return <section className="nw-game" aria-label={`${titles[kind]} game`}>
    <header className="nw-heading"><p className="natura-eyebrow">{kind === "trapjaw" ? "07 / THE FOREST FLOOR" : "08 / THE COASTAL SEABED"}</p>
      <h1>{titles[kind]}<span>.</span></h1><p>{kind === "trapjaw" ? "Tiny jaws. Extraordinary lift." : "Change your skin. Read your surroundings."}</p></header>
    <div className="nw-layout"><div className="nw-play">
      {view.kind === "trapjaw" && <div className="nw-course-picker">
        <label htmlFor="snap-course">Course {view.level + 1} / {SNAP_LEVELS.length}</label>
        <select id="snap-course" value={view.level} disabled={view.phase !== "ready"}
          onChange={event => { clearInput(); game.current = createSnapGame(Number(event.target.value)); setView(structuredClone(game.current)); }}>
          {SNAP_LEVELS.map((level, index) => <option key={level.name} value={index}>{index + 1}. {level.name} · {level.platforms.length} ledges</option>)}
        </select>
        <small>Choose a course before starting.</small>
      </div>}
      <div className="nw-arena">
        <div className="nw-hud">
          <div className="nw-coral"><small>{name(0, mode)} / CORAL</small><b>{view.kind === "trapjaw" ? `${view.players[0].checkpoint + 1} / ${snapPlatforms(view).length} ledges` : `${view.players[0].food} / 6 food`}</b><span aria-label={`${view.players[0].lives} hearts`}>{"♥".repeat(view.players[0].lives)}{"♡".repeat(3 - view.players[0].lives)}</span></div>
          <div className="nw-clock"><small>TIME LEFT</small><b>{Math.ceil(view.time)}<em>s</em></b></div>
          <div className="nw-gold"><small>{name(1, mode)} / GOLD</small><b>{view.kind === "trapjaw" ? `${view.players[1].checkpoint + 1} / ${snapPlatforms(view).length} ledges` : `${view.players[1].food} / 6 food`}</b><span aria-label={`${view.players[1].lives} hearts`}>{"♥".repeat(view.players[1].lives)}{"♡".repeat(3 - view.players[1].lives)}</span></div>
        </div>
        <div className="nw-stage"><canvas ref={canvas} width={WILD_W} height={WILD_H} tabIndex={0}
          onPointerDown={event => event.currentTarget.focus()}
          aria-label={kind === "trapjaw" ? `Course ${view.kind === "trapjaw" ? view.level + 1 : 1}: ants launch across forest ledges toward a nest.` : "Cuttlefish forage across 24 irregular patches with six camouflage patterns. Three fast predators patrol the seabed."}
          aria-describedby="wild-mode-controls" />
          {(!active) && <div className="nw-overlay"><div className="nw-dialog">
            {view.phase === "finished" ? <>
              <small>FIELD CHALLENGE COMPLETE</small><h2>{view.winner === null ? "A draw in the wild." : `${name(view.winner, mode)} ${view.winner === 0 && mode === "ai" ? "win" : "wins"}!`}</h2>
              <p>{view.kind === "trapjaw" ? `Highest ledges: ${view.players[0].checkpoint + 1} – ${view.players[1].checkpoint + 1}.` : `Shrimp collected: ${view.players[0].food} – ${view.players[1].food}.`} Hearts: {view.players[0].lives} – {view.players[1].lives}.</p>
              <button className="natura-primary" onClick={finish}>Continue to animal quiz →</button>
            </> : <>
              <small>{view.phase === "ready" ? "NATURE HAS A FEW TRICKS" : "TAKE YOUR TIME"}</small>
              <h2>{rulesOpen || view.phase === "paused" ? "The habitat is paused." : kind === "trapjaw" ? "Ready to take the leap?" : "Can you disappear?"}</h2>
              <p>{rulesOpen ? "Close the rules above to return to the habitat." : view.phase === "paused" ? "Your animals and the timer are waiting." : kind === "trapjaw" ? `Aim, snap, land. ${view.kind === "trapjaw" ? SNAP_LEVELS[view.level].name : ""}: reach the nest before your rival.` : "Collect six shrimp. Match pattern AND texture, then stay still to fool a passing predator."}</p>
              {!rulesOpen && <button className="natura-primary" onClick={start}>{view.phase === "ready" ? "Enter the habitat →" : "Resume →"}</button>}
              {canvasError && <p role="alert">This browser could not start the canvas.</p>}
            </>}
          </div></div>}
        </div>
        <div className="nw-status"><p role="status">{view.notice}</p><button onClick={pause} disabled={!active}>Ⅱ Pause</button></div>
      </div>
      <div className="nw-controls" id="wild-mode-controls">
        {([0, 1] as const).filter(player => mode !== "ai" || player === 0).map(player => <div className={`nw-control nw-player-${player}`} key={player}>
          <strong>{name(player, mode)} · {player === 0 ? "Coral" : "Gold"}</strong>
          <p>{kind === "trapjaw" ? player === 0 ? "A/D walk · W/S aim steeper/flatter · Space snap" : "←/→ walk · ↑/↓ aim steeper/flatter · Enter snap" : player === 0 ? "WASD swim · Space pattern · Left Shift texture" : "Arrows swim · Enter pattern · Right Shift texture"}</p>
          <div className="nw-hold-buttons" role="group" aria-label={`${name(player, mode)} movement controls`}>
            {controls.map(([action, text, title]) => <HoldButton key={action} label={text} title={`${name(player, mode)}: ${title}`} disabled={!active}
              press={id => held.current.set(id, { player, action })} release={id => held.current.delete(id)} />)}
          </div>
          {view.kind === "trapjaw" ? <p className="nw-control-state">Launch angle {Math.round(view.players[player].angle)}° · {view.players[player].grounded ? view.players[player].cooldown > 0 ? "Jaws resetting" : "Ready to snap" : "Airborne · wait to land"}</p> : <>
            <div className="nw-skins" role="group" aria-label={`${name(player, mode)} skin pattern`}>
              {PATTERN_NAMES.map((pattern, index) => <button key={pattern} disabled={!active} aria-pressed={view.players[player].pattern === index} onClick={() => skin(player, index as Pattern)}>{pattern}</button>)}
              <button disabled={!active} aria-pressed={view.players[player].bumpy} onClick={() => skin(player, undefined, !view.players[player].bumpy)}>{view.players[player].bumpy ? "Bumpy" : "Smooth"} ↔</button>
            </div>
            <p className="nw-control-state">{habitatAt(view.players[player].x, view.players[player].y, view.patches).name} · {camouflageMatches(view.players[player], view.patches) ? view.players[player].moving ? "Matched, but moving" : "Blending in" : "Change your disguise"}</p>
            <label className="nw-detection">Detection: {Math.round(view.players[player].exposure)}%<progress max={100} value={view.players[player].exposure} /></label>
          </>}
        </div>)}
      </div>
    </div><aside className="nw-guide">
      <div className="nw-tip"><small>FIELD GUIDE</small><h3>{kind === "trapjaw" ? "A launch, not a flight." : "Stillness is a skill."}</h3>
        <p>{kind === "trapjaw" ? "Set your direction on the ledge. A steeper launch trades horizontal distance for height. You cannot steer in the air, so check the dotted path before snapping." : "Read the label inside your current patch. Each new map has 24 irregular patches and six disguises. Match both the pattern and the texture. A moving cuttlefish can still draw attention, so stop when a predator’s cone crosses you."}</p>
        <p>{kind === "trapjaw" ? "Choose among five courses before starting. Each ledge saves a checkpoint. Falls cost a heart; three falls end your run." : "Your numbered rings mark your next shrimp. Detection drains when you leave a search cone or blend in while still."}</p>
        <small>Esc pauses · on-screen buttons support touch</small>
      </div>
      <DidYouKnow key={kind} scenario={kind} />
    </aside></div>
  </section>;
}
