import { useCallback, useEffect, useRef } from "react";
import { RHYTHM_KEYS, RHYTHM_WINDOW, type RhythmView } from "../../../../games/party/minigames/rhythm/index.ts";
import { COLORS } from "../../../../games/party/config.ts";
import type { MinigameViewProps } from "./views.ts";
import { useServerOffset } from "./useServerClock.ts";

const KEY_LANE: Record<string, number> = { KeyW: 0, KeyA: 1, KeyS: 2, KeyD: 3, Space: 4, ShiftLeft: 5, ShiftRight: 5 };
export default function RhythmScreen({ minigame, match, playerId, now, online, sendInput }: MinigameViewProps) {
  const s = minigame.state as RhythmView, me = s.players[playerId], board = useRef<HTMLDivElement>(null), nodes = useRef(new Map<number, HTMLDivElement>());
  const offset = useServerOffset(minigame.serverNow), live = useRef(s), pads = useRef(new Map<number, HTMLButtonElement>());
  useEffect(() => { live.current = s; }, [s]);
  const tap = useCallback((lane: number) => {
    if (!online || now < s.startedAt || now >= s.endsAt || !me) return;
    pads.current.get(lane)?.animate([{ background: "#b4ffea", transform: "scale(.93)" }, { background: "#183349", transform: "scale(1)" }], { duration: 180 });
    sendInput({ type: "RHYTHM_TAP", lane });
  }, [online, now, s.startedAt, s.endsAt, me, sendInput]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { const lane = KEY_LANE[e.code]; if (lane === undefined || e.target instanceof HTMLInputElement) return; e.preventDefault(); if (!e.repeat) tap(lane); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [tap]);
  useEffect(() => {
    let frame: number;
    const update = () => {
      const time = Date.now() + (offset.current ?? 0), height = board.current?.clientHeight ?? 400;
      // One full circle diameter travels during the scoring window, matching the authority's overlap.
      const diameter = Math.min(58, Math.max(32, (board.current?.clientWidth ?? 420) / 6 - 12));
      board.current?.style.setProperty("--diameter", diameter + "px");
      for (const note of live.current.notes) {
        const element = nodes.current.get(note.id);
        if (element) { element.style.transform = "translate(-50%, " + (height - 82 - diameter / 2 - (note.at - time) / RHYTHM_WINDOW * diameter) + "px)"; element.style.opacity = live.current.judged.includes(note.id) ? "0" : "1"; }
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update); return () => cancelAnimationFrame(frame);
  }, [offset]);
  const last = me?.last && now - me.last.at < 1000 ? me.last : null;
  return <div className="rhythm-game new-minigame">
    <header className="new-game-header"><div><span className="pp-eyebrow">SAME CHART · EVERY PLAYER</span><h2>Pluto Pulse</h2></div><strong>{Math.max(0, Math.ceil((s.endsAt - now) / 1000))}s</strong></header>
    <div className="rhythm-feedback" aria-live="polite">{last ? <><b>{Math.round(last.overlap * 100)}% overlap</b><span>{last.value ? "+" + last.points.toFixed(2) + " points · ×" + last.value : "Miss · find the beat"}</span></> : <><b>Feel the pulse</b><span>Overlap × note value = your points</span></>}</div>
    <div className="rhythm-track" ref={board}>
      {RHYTHM_KEYS.map((key, lane) => <div className="rhythm-lane" key={key} style={{ left: (lane * 100 / 6) + "%", width: (100 / 6) + "%" }}><span className="rhythm-lane-name">{key}</span></div>)}
      {s.notes.map((note) => <div key={note.id} className={"rhythm-note value-" + note.value} ref={(element) => { if (element) nodes.current.set(note.id, element); else nodes.current.delete(note.id); }} style={{ left: ((note.lane + .5) * 100 / 6) + "%" }}>{note.value}</div>)}
      <div className="rhythm-targets">{RHYTHM_KEYS.map((key, lane) => <button key={key} aria-label={"Play " + key} disabled={!online || !me} ref={(el) => { if (el) pads.current.set(lane, el); else pads.current.delete(lane); }} onPointerDown={(e) => { e.preventDefault(); tap(lane); }}><span className="rhythm-target-circle"/><b>{key}</b></button>)}</div>
    </div>
    <div className="new-game-scores">{match.players.filter((p) => s.players[p.id]).map((p) => <div key={p.id}><i style={{ background: COLORS[p.avatarId] }}/><span>{p.name}{p.id === playerId ? " · YOU" : ""}</span><b>{s.players[p.id].score.toFixed(2)}</b></div>)}</div>
    <p className="new-game-tip">1 point · gold 3 · rare violet 5 · hit each circle at the target · touch the matching key below</p>
  </div>;
}
