import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GameResult, Player, PlayMode } from "../../games/natura/naturaData";
import { createToolGame, idleToolInput, updateToolGame, toolGoal, TOOL_W, TOOL_H } from "../../games/natura/toolAnimals";
import type { ToolGame, ToolInput, ToolKind } from "../../games/natura/toolAnimals";
import { drawToolGame } from "../../games/natura/toolAnimalsDrawing";
import DidYouKnow from "./DidYouKnow";
import "./wildModes.css";

type Action = "left" | "right" | "up" | "down" | "action" | "secondary";
const BINDINGS: [Record<Action, string>, Record<Action, string>] = [
  { left: "KeyA", right: "KeyD", up: "KeyW", down: "KeyS", action: "Space", secondary: "ShiftLeft" },
  { left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown", action: "Enter", secondary: "ShiftRight" },
];
const USED_KEYS = new Set(BINDINGS.flatMap(binding => Object.values(binding)));
const name = (player: Player, mode: PlayMode) => mode === "ai" ? player === 0 ? "You" : "AI" : `Player ${player + 1}`;
const titles = { bolas: "Midnight Lasso", coconut: "Carry Your Cover" };

function HoldButton({ label, title, disabled, press, release }: {
  label: string; title: string; disabled: boolean; press: (id: number) => void; release: (id: number) => void;
}) {
  useGameLanguage();
  return <button type="button" aria-label={gameUi(title)} title={gameUi(title)} disabled={disabled}
    onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); press(event.pointerId); }}
    onPointerUp={event => release(event.pointerId)} onPointerCancel={event => release(event.pointerId)}
    onLostPointerCapture={event => release(event.pointerId)}
    onKeyDown={event => { if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); press(-1); } }}
    onKeyUp={event => { if (event.code === "Space" || event.code === "Enter") { event.preventDefault(); release(-1); } }}
    onBlur={() => release(-1)}>{gameUi(label)}</button>;
}

export default function ToolAnimalsGame({ kind, mode, rulesOpen = false, onComplete }: {
  kind: ToolKind; mode: PlayMode; round?: number; rulesOpen?: boolean; onComplete: (result: GameResult) => void;
}) {
  useGameLanguage();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [initial] = useState(() => createToolGame(kind));
  const game = useRef<ToolGame>(initial);
  const keys = useRef(new Set<string>());
  const held = useRef(new Map<number, { player: Player; action: Action }>());
  const completed = useRef(false);
  const [view, setView] = useState<ToolGame>(() => structuredClone(initial));
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
    const input = (player: Player): ToolInput => {
      const pressed = (action: Action) => keys.current.has(BINDINGS[player][action]) ||
        [...held.current.values()].some(control => control.player === player && control.action === action);
      return { x: Number(pressed("right")) - Number(pressed("left")), y: Number(pressed("down")) - Number(pressed("up")),
        action: pressed("action"), secondary: pressed("secondary") };
    };
    const tick = (now: number) => {
      const before = game.current.phase;
      if (!rulesOpen) updateToolGame(game.current, [input(0), mode === "ai" ? idleToolInput() : input(1)], (now - last) / 1000, mode === "ai");
      last = now;
      drawToolGame(ctx, game.current, mode === "ai");
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
    onComplete({ winner: current.winner, detail: `${titles[kind]}: ${current.players[0].food} vs ${current.players[1].food} food${kind === "coconut" ? `; hearts ${current.players[0].lives} vs ${current.players[1].lives}` : ""}.` });
  };
  const active = view.phase === "playing" && !rulesOpen;
  const controls: [Action, string, string][] = [
    ["left", "←", "Move left"], ["right", "→", "Move right"],
    ["up", "↑", kind === "bolas" ? "Aim left" : "Move up"], ["down", "↓", kind === "bolas" ? "Aim right" : "Move down"],
    ["action", kind === "bolas" ? "Swing" : "Pick / drop", "Primary action"],
    ["secondary", kind === "bolas" ? "Lure" : "Cover / emerge", "Secondary action"],
  ];
  return <section className="nw-game" aria-label={gameUi(`${titles[kind]} game`)}>
    <header className="nw-heading"><p className="natura-eyebrow">{gameUi(kind === "bolas" ? "09 / AFTER DARK" : "10 / THE OPEN SEABED")}</p><h1>{gameUi(titles[kind])}<span>.</span></h1>
      <p>{gameUi(kind === "bolas" ? "A scent lure. One sticky thread. Perfect timing." : "Bring your shelter. Choose when to slow down.")}</p></header>
    <div className="nw-layout"><div className="nw-play"><div className="nw-arena">
      <div className="nw-hud">{([0, 1] as const).map(player => <div className={player === 0 ? "nw-coral" : "nw-gold"} key={player}>
        <small>{gameUi(name(player, mode))}</small><b>{gameUi(view.players[player].food)} / {gameUi(toolGoal(kind))} {gameUi(kind === "bolas" ? "moths" : "food")}</b>
        {kind === "coconut" && <span>{gameUi("♥".repeat(view.players[player].lives))}{gameUi("♡".repeat(3 - view.players[player].lives))}</span>}
      </div>)}<div className="nw-clock"><small>{gameUi("TIME LEFT")}</small><b>{gameUi(Math.ceil(view.time))}<em>s</em></b></div></div>
      <div className="nw-stage"><canvas ref={canvas} width={TOOL_W} height={TOOL_H} tabIndex={0} onPointerDown={event => event.currentTarget.focus()}
        aria-label={gameUi(kind === "bolas" ? "Spiders on a branch swing sticky threads at passing moths." : "Octopuses carry shells between food markers while predators patrol.")} aria-describedby="tool-mode-controls" />
        {!active && <div className="nw-overlay"><div className="nw-dialog">
          {view.phase === "finished" ? <><small>{gameUi("FIELD CHALLENGE COMPLETE")}</small><h2>{gameUi(view.winner === null ? "A draw in the wild." : `${name(view.winner, mode)} ${view.winner === 0 && mode === "ai" ? "win" : "wins"}!`)}</h2>
            <p>{gameUi("Food collected: ")}{gameUi(view.players[0].food)} – {gameUi(view.players[1].food)}.</p><button className="natura-primary" onClick={finish}>{gameUi("Continue to animal quiz →")}</button></> : <>
            <h2>{gameUi(rulesOpen || view.phase === "paused" ? "The habitat is paused." : "Ready for the challenge?")}</h2>
            <p>{gameUi(rulesOpen ? "Close the rules to return." : kind === "bolas" ? "Lure moths closer, aim, then swing. First to eight catches wins." : "Collect six food. Carry a shell for safety, and assemble it before a patrol reaches you.")}</p>
            {!rulesOpen && <button className="natura-primary" onClick={start}>{gameUi(view.phase === "ready" ? "Enter the habitat →" : "Resume →")}</button>}
            {canvasError && <p role="alert">{gameUi("This browser could not start the canvas.")}</p>}</>}
        </div></div>}
      </div><div className="nw-status"><p role="status">{gameUi(view.notice)}</p><button onClick={pause} disabled={!active}>{gameUi("Ⅱ Pause")}</button></div>
    </div><div className="nw-controls" id="tool-mode-controls">{([0, 1] as const).filter(player => mode !== "ai" || player === 0).map(player => <div className={`nw-control nw-player-${player}`} key={player}>
      <strong>{gameUi(name(player, mode))} · {gameUi(player === 0 ? "Coral" : "Gold")}</strong>
      <p>{gameUi(kind === "bolas" ? player === 0 ? "A/D move · W/S aim · Space swing · Left Shift lure" : "←/→ move · ↑/↓ aim · Enter swing · Right Shift lure" : player === 0 ? "WASD move · Space pick/drop · Left Shift cover/emerge" : "Arrows move · Enter pick/drop · Right Shift cover/emerge")}</p>
      <div className="nw-hold-buttons">{controls.map(([action, label, title]) => <HoldButton key={action} label={gameUi(label)} title={gameUi(`${name(player, mode)}: ${title}`)} disabled={!active} press={id => held.current.set(id, { player, action })} release={id => held.current.delete(id)} />)}</div>
      <p className="nw-control-state">{gameUi(kind === "bolas" ? `Aim ${Math.round(view.players[player].angle)}° · Lure ${view.players[player].lureCooldown > 0 ? `ready in ${Math.ceil(view.players[player].lureCooldown)}s` : "ready"}` : view.players[player].hidden ? view.players[player].coverTime > 0 ? "Assembling shelter…" : "Covered · emerge to forage" : view.players[player].carrying ? "Carrying shelter · slower movement" : "Moving freely · shell left behind")}</p>
    </div>)}</div></div><aside className="nw-guide"><div className="nw-tip"><small>{gameUi("FIELD GUIDE")}</small>
      <h3>{gameUi(kind === "bolas" ? "Let the prey come closer." : "Safety has a carrying cost.")}</h3>
      <p>{gameUi(kind === "bolas" ? "The sticky ball at the end of the thread catches prey. Move along the branch and aim with up/down before swinging. A scent lure draws nearby moths toward you for a few seconds; it needs time to recharge. Release the action key between swings." : "Follow your numbered food rings. Pick up your numbered shell within reach. Carrying slows you down; dropping it lets you travel faster. Cover takes a moment to assemble, and you cannot move or collect food while hidden. Emerge and pick up the shell again after danger passes.")}</p>
      <p>{gameUi(kind === "bolas" ? "One moth per swing. Simultaneous catches split the point. After 60 seconds, most catches wins." : "Patrol lanes light up before predators arrive. Take cover early or move out of the lanes. Three hits end your run. After 60 seconds, compare food, then hearts.")}</p>
      <small>{gameUi("Esc pauses · on-screen buttons support touch")}</small></div><DidYouKnow scenario={kind} /></aside></div>
  </section>;
}
