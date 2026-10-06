import { useCallback, useEffect, useRef, useState } from "react";
import { COLORS } from "../../../../games/party/config.ts";
import { ARROW_SYMBOLS, DIRECTIONS, quadrantOrigin, type ArrowMemoryView, type Direction } from "../../../../games/party/minigames/arrowMemory/index.ts";
import type { MinigameViewProps } from "./views.ts";
import { MemoryWorld } from "./MemoryWorld.tsx";
import { CHARACTER_NAMES } from "./characterRoster.ts";

const KEY_DIRECTION: Record<string, Direction> = { ArrowLeft: "left", a: "left", ArrowUp: "up", w: "up", ArrowRight: "right", d: "right", ArrowDown: "down", s: "down" };
export default function ArrowMemoryScreen({ minigame, match, playerId, now, online, sendInput }: MinigameViewProps) {
  const state = minigame.state as ArrowMemoryView, me = state.players[playerId];
  const sent = useRef("");
  const [focused, setFocused] = useState(false);
  const token = `${state.startedAt}:${state.round}:${state.step}`;
  const canMove = online && state.phase === "move" && me?.alive && !me.moved;
  const move = useCallback((direction: Direction) => {
    if (!canMove || sent.current === token) return;
    const nextX = me.x + (direction === "right" ? 1 : direction === "left" ? -1 : 0);
    const nextZ = me.z + (direction === "down" ? 1 : direction === "up" ? -1 : 0);
    const origin = quadrantOrigin(me.quadrant);
    if (nextX < origin.x || nextX >= origin.x + 5 || nextZ < origin.z || nextZ >= origin.z + 5) return;
    sent.current = token;
    sendInput({ type: "MEMORY_STEP", direction, round: state.round, step: state.step });
  }, [canMove, me, token, state.round, state.step, sendInput]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const direction = KEY_DIRECTION[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (!direction || event.target instanceof HTMLInputElement) return;
      event.preventDefault(); if (!event.repeat) move(direction);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [move]);
  const seconds = Math.max(0, Math.ceil((state.phaseEndsAt - now) / 1000));
  return <div className={`memory-game memory-${state.map}`}>
    <header className="memory-header">
      <div><span className="pp-eyebrow">{state.map === "ice" ? "FROZEN RECALL" : "HELL'S FOOTSTEPS"}</span>
        <h2>One Wrong Step</h2><p>Round {state.heat} / 3 · sequence {state.level} · {state.arrowCount} arrows · {Object.values(state.players).filter((p) => p.alive).length} standing</p></div>
      <strong className="memory-clock">{seconds}<small>seconds</small></strong>
    </header>
    <div className="memory-prompt" aria-live="polite">
      <b>{state.phase === "intermission" ? "Round complete · everyone returns next round!" : state.phase === "finished" ? "Three rounds complete · totals decide the winner!" : !me?.alive ? "You fell! Back in the next round." : state.phase === "memorize" ? "Remember your private path" : state.phase === "move" ? me.moved ? "Step locked · brace yourself" : `Your turn · arrow ${state.step + 1} of ${state.arrowCount}` : state.phase === "restore" ? "Platforms returning…" : "Hold on!"}</b>
      <div className="memory-sequence" aria-label={state.sequence.length ? state.sequence.join(", ") : "Arrows hidden"}>
        {state.sequence.length ? state.sequence.map((d, i) => <span key={i}>{ARROW_SYMBOLS[d]}</span>) :
          Array.from({ length: state.arrowCount }, (_, i) => <span className={i < state.step ? "complete" : i === state.step ? "current" : ""} key={i}>{i < state.step ? "✓" : "?"}</span>)}
      </div>
    </div>
    <div className="memory-view-controls" role="group" aria-label="Camera view">
      <button aria-pressed={!focused} onClick={() => setFocused(false)}>Full map</button>
      <button aria-pressed={focused} disabled={!me} onClick={() => setFocused(true)}>Your quadrant</button>
    </div>
    <MemoryWorld state={state} players={match.players} playerId={playerId} serverNow={minigame.serverNow} focused={focused}/>
    {(state.phase === "intermission" || state.phase === "finished") && <div className="memory-round-results"><b>ROUND {state.heat} RESULTS</b>{state.heatResults.at(-1)?.ranking.map((id, i) => <p key={id}>{i + 1}. {match.players.find((p) => p.id === id)?.name} <strong>+{state.heatResults.at(-1)?.points[id]} points</strong></p>)}</div>}
    <div className="memory-controls" role="group" aria-label="Move one square">
      {DIRECTIONS.map((d) => <button key={d} disabled={!canMove} onClick={() => move(d)} aria-label={`Step ${d}`}>{ARROW_SYMBOLS[d]}</button>)}
    </div>
    <div className="memory-scores">{match.players.filter((p) => state.players[p.id]).map((p) => <span key={p.id} className={state.players[p.id].alive ? "" : "out"}>
      <i style={{ background: COLORS[p.avatarId] }}/><span><b>{p.name}{p.id === playerId && " · YOU"}</b><small>{CHARACTER_NAMES[p.avatarId % 4]} · quadrant {state.players[p.id].quadrant + 1}</small></span><strong>{state.players[p.id].score}{!state.players[p.id].alive && " · OUT"}</strong></span>)}</div>
    <p className="memory-tip">Three rounds · 1st: 3 points · 2nd: 2 · 3rd: 1 · private arrows · {state.map === "ice" ? "Icicles strike wrong squares." : "Wrong platforms fall into lava."}</p>
  </div>;
}
