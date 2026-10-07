import { useCallback, useEffect, useRef, useState } from "react";
import { ui, useUiLanguage } from "@/i18n/ui";
import { EAT } from "@/games/eat-it/config";
import { createGame, fillBots, stepGame } from "@/games/eat-it/engine";
import { ArenaRenderer } from "@/games/eat-it/renderer";
import type { GameState, Input } from "@/games/eat-it/types";
import { useCopy } from "../copy";
import { useInView } from "../useInView";
import DemoFrame from "./DemoFrame";

const LOCAL = "local";
const keyOf: Record<string, Input> = { w: { x: 0, y: -1 }, a: { x: -1, y: 0 }, s: { x: 0, y: 1 }, d: { x: 1, y: 0 }, arrowup: { x: 0, y: -1 }, arrowleft: { x: -1, y: 0 }, arrowdown: { x: 0, y: 1 }, arrowright: { x: 1, y: 0 } };

/** A short, solo round on the City map, with three bots and one life, so the demo ends when the player is eaten. */
const newRound = () => createGame("city", fillBots([{ id: LOCAL, name: ui("You") }], 4), crypto.getRandomValues(new Uint32Array(1))[0], crypto.randomUUID(),
  { mode: "solo", botsEnabled: true, botDifficulty: "easy", livesEnabled: false, hellEnabled: false, animalsEnabled: false, matchDuration: 120 });

type Phase = "ready" | "playing" | "over";
type Hud = { growth: number; alive: number; total: number };

/** The real Eat It: the same rules engine, bots and 3D arena as /games/eat-it, trimmed to one two-minute City round. */
export default function EatItDemo() {
  useUiLanguage();
  const text = useCopy();
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<GameState | null>(null);
  const input = useRef<Input>({ x: 0, y: 0 });
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const keys = useRef(new Set<string>());
  const visible = useInView(frame);
  const [phase, setPhase] = useState<Phase>("ready");
  const [unavailable, setUnavailable] = useState(false);
  const [hud, setHud] = useState<Hud>({ growth: 0, alive: 4, total: 4 });
  const [best, setBest] = useState(0);
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const stageRun = useRef<{ run: () => void; stop: () => void } | null>(null);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const start = useCallback(() => {
    game.current = newRound();
    input.current = { x: 0, y: 0 };
    setHud({ growth: Math.round(EAT.player.startingMass), alive: game.current.players.length, total: game.current.players.length });
    setPhase("playing");
    canvas.current?.focus({ preventScroll: true });
  }, []);

  // One renderer and one loop for the demo's lifetime; the loop idles while the demo is off screen.
  useEffect(() => {
    const element = canvas.current;
    const stage = frame.current;
    if (!element || !stage) return;
    game.current ??= newRound();
    let renderer: ArenaRenderer;
    try { renderer = new ArenaRenderer(element, "city"); } catch { const notice = requestAnimationFrame(() => setUnavailable(true)); return () => cancelAnimationFrame(notice); }
    const observer = new ResizeObserver(([entry]) => renderer.resize(entry.contentRect.width, entry.contentRect.height));
    observer.observe(stage);
    renderer.resize(stage.clientWidth, stage.clientHeight);
    let id = 0;
    let last = performance.now();
    let accumulator = 0;
    let hudAt = 0;
    const tick = (now: number) => {
      id = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const state = game.current!;
      const me = state.players.find(player => player.id === LOCAL)!;
      if (phaseRef.current === "playing") {
        const held = [...keys.current].reduce<Input>((sum, key) => ({ x: sum.x + keyOf[key].x, y: sum.y + keyOf[key].y }), { x: 0, y: 0 });
        me.input = keys.current.size ? held : input.current;
        accumulator += dt;
        while (accumulator >= 1 / EAT.network.tickRate) { stepGame(state); accumulator -= 1 / EAT.network.tickRate; }
        if (now - hudAt > EAT.visuals.hudIntervalMs) {
          hudAt = now;
          const growth = Math.round(me.mass);
          setHud(current => current.growth === growth && current.alive === state.players.filter(player => player.alive).length ? current : { growth, alive: state.players.filter(player => player.alive).length, total: state.players.length });
        }
        if (!me.alive || state.status === "finished") {
          const growth = Math.round(me.mass);
          setBest(top => Math.max(top, growth));
          setHud(current => ({ ...current, growth }));
          me.input = { x: 0, y: 0 };
          setPhase("over");
        }
      }
      renderer.draw(state, LOCAL, dt, ui("You"), false);
    };
    const run = () => { cancelAnimationFrame(id); last = performance.now(); id = requestAnimationFrame(tick); };
    run();
    stageRun.current = { run, stop: () => cancelAnimationFrame(id) };
    return () => { cancelAnimationFrame(id); observer.disconnect(); renderer.dispose(); stageRun.current = null; };
  }, []);
  useEffect(() => { if (visible) stageRun.current?.run(); else stageRun.current?.stop(); }, [visible]);

  const release = (pointerId: number) => {
    if (pointer.current?.id !== pointerId) return;
    pointer.current = null;
    input.current = { x: 0, y: 0 };
    setStick(null);
  };
  const press = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    const bounds = event.currentTarget.getBoundingClientRect();
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    setStick({ x: event.clientX - bounds.left, y: event.clientY - bounds.top, dx: 0, dy: 0 });
  };
  // Like the real arena: drag anywhere to steer with a floating joystick.
  const drag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const origin = pointer.current;
    if (!origin || origin.id !== event.pointerId) return;
    const dx = event.clientX - origin.x, dy = event.clientY - origin.y, distance = Math.hypot(dx, dy), length = Math.max(48, distance);
    input.current = distance < 7 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length };
    setStick(current => current && { ...current, dx: dx / length * 32, dy: dy / length * 32 });
  };

  return <DemoFrame tone="eatit" title={ui("Eat It")} href="/games/eat-it" action={text("playEatIt")}>
    <div className="eat-demo">
      <div ref={frame} className="eat-stage">
        <canvas ref={canvas} tabIndex={0} aria-label={text("eatAria")} onContextMenu={event => event.preventDefault()}
          onPointerDown={press} onPointerMove={drag} onPointerUp={event => release(event.pointerId)} onPointerCancel={event => release(event.pointerId)}
          onBlur={() => { keys.current.clear(); }}
          onKeyDown={event => { const key = event.key.toLowerCase(); if (key in keyOf) { event.preventDefault(); keys.current.add(key); } }}
          onKeyUp={event => { keys.current.delete(event.key.toLowerCase()); }} />
        {stick && phase === "playing" && <div className="eat-stick" style={{ left: stick.x, top: stick.y }}><i style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} /></div>}
        {phase === "playing" && <p className="eat-hud" aria-live="off">
          <span>{ui("Growth")} <b>{hud.growth}</b></span>
          <span>{ui("Players Remaining")} <b>{hud.alive} / {hud.total}</b></span>
        </p>}
        {phase !== "playing" && !unavailable && <div className="eat-overlay">
          <strong>{phase === "over" ? text("eatEaten") : text("eatReady")}</strong>
          {phase === "over" && <span>{ui("Growth")} <b>{hud.growth}</b> · {text("bestLabel")} <b>{best}</b></span>}
          <span>{text("eatHint")}</span>
          <button type="button" className="eat-start" onClick={start}>{phase === "over" ? text("cardAgain") : text("eatStart")}</button>
        </div>}
        {unavailable && <div className="eat-overlay" role="alert">
          <strong>{ui("3D graphics unavailable")}</strong>
          <span>{ui("Enable WebGL2 in your browser to play Eat It.")}</span>
        </div>}
      </div>
    </div>
  </DemoFrame>;
}
