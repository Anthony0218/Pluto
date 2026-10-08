import { useEffect, useRef, useState } from "react";
import { NATURA_FACTS } from "@/games/natura/naturaFacts";
import { ARCHER_TARGET, createArcherGame, updateArcherGame, emptyArcherInput } from "@/games/natura/archerfish";
import { NaturaScene } from "@/games/natura/scene3d";
import type { Vec } from "@/games/natura/naturaData";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useInView } from "../useInView";
import { useCopy } from "../copy";
import DemoFrame from "./DemoFrame";

const facts = NATURA_FACTS.archerfish;
const controls = ["KeyA", "KeyD", "ArrowLeft", "ArrowRight", "Space", "ShiftLeft"];

/** The actual archerfish habitat, simulation, aiming and rival AI, with local preview controls. */
export default function NaturaDemo() {
  useUiLanguage();
  const text = useCopy();
  const root = useRef<HTMLDivElement>(null);
  const visible = useInView(root);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<NaturaScene | null>(null);
  const game = useRef(createArcherGame());
  const keys = useRef(new Set<string>());
  const held = useRef(new Map<number, string>());
  const aim = useRef<Vec | undefined>(undefined);
  const shot = useRef(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(false);
  const [view, setView] = useState({ catches: 0, rival: 0, time: 60, finished: false, started: false });
  const [factIndex, setFactIndex] = useState(0);
  const fact = facts[factIndex % facts.length];
  const clear = () => { keys.current.clear(); held.current.clear(); shot.current = false; };

  useEffect(() => {
    if (!canvas.current) return;
    let renderer: NaturaScene;
    try {
      renderer = new NaturaScene(canvas.current, "archerfish", () => { setError(true); setRunning(false); });
      scene.current = renderer;
      renderer.draw({ kind: "archerfish", game: game.current }, true);
    } catch {
      const frame = requestAnimationFrame(() => setError(true));
      return () => cancelAnimationFrame(frame);
    }
    return () => { renderer.dispose(); scene.current = null; };
  }, []);

  useEffect(() => {
    const pause = () => { clear(); setRunning(false); };
    const visibility = () => { if (document.hidden) pause(); };
    window.addEventListener("blur", pause);
    document.addEventListener("visibilitychange", visibility);
    return () => { window.removeEventListener("blur", pause); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  useEffect(() => {
    if (!running || !visible || error) return;
    let frame = 0, last = performance.now(), lastUi = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const pressed = new Set([...keys.current, ...held.current.values()]);
      const input = {
        move: Number(pressed.has("KeyD") || pressed.has("ArrowRight")) - Number(pressed.has("KeyA") || pressed.has("ArrowLeft")),
        aim: 0, shoot: shot.current || pressed.has("Space"), dash: pressed.has("ShiftLeft"), target: aim.current,
      };
      updateArcherGame(game.current, [input, emptyArcherInput()], dt, true, "normal");
      shot.current = false;
      scene.current?.draw({ kind: "archerfish", game: game.current }, true);
      if (now - lastUi > 100 || game.current.phase === "finished") {
        const [player, rival] = game.current.fish;
        setView({ catches: player.catches, rival: rival.catches, time: Math.ceil(game.current.time), finished: game.current.phase === "finished", started: true });
        lastUi = now;
      }
      if (game.current.phase === "finished") { clear(); setRunning(false); }
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); clear(); };
  }, [running, visible, error]);

  const start = () => {
    clear();
    if (game.current.phase === "finished") game.current = createArcherGame();
    game.current.phase = "playing";
    const [player, rival] = game.current.fish;
    setView({ catches: player.catches, rival: rival.catches, time: Math.ceil(game.current.time), finished: false, started: true });
    setRunning(true);
    canvas.current?.focus({ preventScroll: true });
  };
  return <DemoFrame tone="natura" title={ui("Natura")} href="/games/natura" action={text("playNatura")}>
    <div ref={root} className="natura-demo">
      <div className="natura-scene natura-scene--game">
        <canvas ref={canvas} tabIndex={0} aria-label={text("shootInsect")}
          onKeyDown={event => { if (controls.includes(event.code) && running) { event.preventDefault(); keys.current.add(event.code); } }}
          onKeyUp={event => { if (controls.includes(event.code)) { event.preventDefault(); keys.current.delete(event.code); } }}
          onBlur={clear}
          onPointerMove={event => { aim.current = scene.current?.aim(event.clientX, event.clientY); }}
          onPointerDown={event => { if (!running) return; event.currentTarget.focus({ preventScroll: true }); aim.current = scene.current?.aim(event.clientX, event.clientY); shot.current = true; }} />
        <div className="natura-game-hud" aria-live="off"><span>{ui("You")} <b>{view.catches}/{ARCHER_TARGET}</b></span><span>{view.time}s</span><span>{ui("AI")} <b>{view.rival}/{ARCHER_TARGET}</b></span></div>
        {(!running || error) && <div className="natura-game-overlay">
          <strong>{ui("Archerfish")}</strong>
          <p>{ui("Aim at an insect. Catch it before your rival does.")}</p>
          {error ? <p role="status">{ui("This browser could not start WebGL. Enable hardware acceleration, then retry the habitat.")}</p>
            : <button type="button" className="lp-btn lp-btn--primary" onClick={start}>{ui(view.finished ? "Play again" : !view.started ? "Start game" : "Resume")}</button>}
        </div>}
      </div>
      <div className="natura-preview-controls">
        {[["KeyA", "Left"], ["KeyD", "Right"], ["ShiftLeft", "Dash"]].map(([code, label]) => <button key={code} type="button" disabled={!running || error}
          onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); held.current.set(event.pointerId, code); }}
          onPointerUp={event => held.current.delete(event.pointerId)} onPointerCancel={event => held.current.delete(event.pointerId)} onLostPointerCapture={event => held.current.delete(event.pointerId)}
          onKeyDown={event => { if (["Enter", "Space"].includes(event.code)) { event.preventDefault(); keys.current.add(code); } }}
          onKeyUp={event => { if (["Enter", "Space"].includes(event.code)) { event.preventDefault(); keys.current.delete(code); } }} onBlur={() => keys.current.delete(code)}>{ui(label)}</button>)}
        <button type="button" disabled={!running || error} onClick={() => { shot.current = true; }}>{ui("Spit")}</button>
        <button type="button" disabled={!running} onClick={() => { clear(); setRunning(false); }}>{ui("Pause")}</button>
      </div>
      <p className="demo-hint">{ui("A / D or arrow keys to swim · Click to aim and spit · Space to spit · Shift to dash")}</p>
      <aside className="natura-fact" aria-label={ui("Did you know? Animal facts")}>
        <small>{ui("✦ Did you know?")}</small><strong>{fact.title}</strong><p>{fact.text}</p>
        <button type="button" onClick={() => setFactIndex(value => value + 1)}>{ui("Next fact →")}</button>
      </aside>
    </div>
  </DemoFrame>;
}
