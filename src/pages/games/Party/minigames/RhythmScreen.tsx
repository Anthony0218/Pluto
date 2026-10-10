import { gameUi, useGameLanguage } from "../../../../i18n/gameUi.ts";
import { useCallback, useEffect, useRef } from "react";
import { partyAudio } from "../../../../games/party/client/audio.ts";
import { RHYTHM_KEYS, nextRhythmNote, rhythmNoteTop, type RhythmView } from "../../../../games/party/minigames/rhythm/index.ts";
import { COLORS } from "../../../../games/party/config.ts";
import type { MinigameViewProps } from "./views.ts";
import { useServerOffset } from "./useServerClock.ts";

const KEY_INDEX: Record<string, number> = Object.fromEntries(RHYTHM_KEYS.map((key, index) => ["Key" + key, index]));
export default function RhythmScreen({ minigame, match, playerId, now, online, sendInput }: MinigameViewProps) {
  useGameLanguage();
  const s = minigame.state as RhythmView, me = s.players[playerId];
  const hitAt = me?.last?.at, hitPoints = me?.last?.points, combo = me?.combo ?? 0;
  useEffect(() => {
    if (hitAt !== undefined) partyAudio.play(hitPoints ? combo >= 5 && combo % 5 === 0 ? "combo" : "hit" : "miss");
  }, [hitAt, hitPoints, combo]);
  const board = useRef<HTMLDivElement>(null), nodes = useRef(new Map<number, HTMLDivElement>());
  const offset = useServerOffset(minigame.serverNow), live = useRef(s);
  const pad = useRef<HTMLButtonElement>(null), prompt = useRef<HTMLSpanElement>(null);
  const displayed = useRef<{ at: number; lane: number | null } | null>(null);
  useEffect(() => { live.current = s; }, [s]);
  const tap = useCallback((lane: number) => {
    const frame = displayed.current, state = live.current;
    const key = lane;
    if (!online || !frame || key === null || key === undefined || frame.at < state.startedAt || frame.at >= state.endsAt || !state.players[playerId]) return;
    pad.current?.animate([{ background: "#b4ffea", transform: "scale(.95)" }, { background: "#183349", transform: "scale(1)" }], { duration: 180 });
    sendInput({ type: "RHYTHM_TAP", lane: key, elapsedMs: frame.at - state.startedAt });
  }, [online, playerId, sendInput]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const index = KEY_INDEX[e.code];
      if (index === undefined || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLElement && e.target.isContentEditable)) return;
      e.preventDefault(); if (!e.repeat) tap(index);
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [tap]);
  useEffect(() => {
    let frame: number;
    const update = () => {
      const at = Date.now() + (offset.current ?? 0), height = board.current?.clientHeight ?? 440;
      const state = live.current, next = nextRhythmNote(state, at);
      displayed.current = { at, lane: next?.lane ?? null };
      const letter = next ? RHYTHM_KEYS[next.lane] : null;
      if (prompt.current) prompt.current.textContent = letter ? "Tap " + letter : "Next beat incoming";

      for (const note of state.notes) {
        const element = nodes.current.get(note.id);
        if (element) {
          element.style.transform = `translate(-50%, ${rhythmNoteTop(note.at, at, height - 110)}px)`;
          element.style.opacity = state.judged.includes(note.id) ? "0" : "1";
        }
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update); return () => cancelAnimationFrame(frame);
  }, [offset]);
  const last = me?.last && now - me.last.at < 1000 ? me.last : null;
  return <div className="rhythm-game new-minigame">
    <header className="new-game-header"><div><span className="pp-eyebrow">{gameUi("100 BPM · FOLLOW THE LETTER")}</span><h2>{gameUi("Pluto Pulse")}</h2></div><strong>{gameUi(Math.max(0, Math.ceil((s.endsAt - now) / 1000)))}s</strong></header>
    <div className={"rhythm-feedback" + (last ? " has-hit" : "")} aria-live="polite">{last ? <><b className="rhythm-comic" key={last.at}>{gameUi(Math.round(last.overlap * 100))}%<small>{gameUi(last.overlap >= .9 ? "PERFECT!" : last.overlap >= .65 ? "NICE!" : last.points > 0 ? "KEEP GOING!" : "MISSED!")}</small></b><span>{gameUi(last.value ? "+" + last.points.toFixed(2) + " points · ×" + last.value : "Match the letter at the line")} <strong>{gameUi(me?.combo ?? 0)}{gameUi(" COMBO")}</strong></span></> : <><b>{gameUi("One letter at a time")}</b><span>{gameUi("Press J, K or L when it reaches the line")}</span></>}</div>
    <div className="rhythm-track" ref={board} role="group" aria-label={gameUi("Single rhythm lane")}>
      <div className="rhythm-lane" aria-hidden="true"/>
      {s.notes.map((note) => <div key={note.id} className={"rhythm-note value-" + note.value} aria-label={gameUi(RHYTHM_KEYS[note.lane] + ", " + note.value + " points")} ref={(element) => { if (element) nodes.current.set(note.id, element); else nodes.current.delete(note.id); }}><b>{gameUi(RHYTHM_KEYS[note.lane])}</b><small>×{gameUi(note.value)}</small></div>)}
      <div className="rhythm-hit-line" aria-hidden="true"><span>{gameUi("HIT HERE")}</span></div>
      <div className="rhythm-key-pads" role="group" aria-label={gameUi("Choose the matching rhythm key")}>{RHYTHM_KEYS.map((key, lane) => <button key={key} ref={lane === 0 ? pad : undefined} disabled={!online || !me || now >= s.endsAt} aria-label={gameUi("Play " + key)} onPointerDown={(e) => { e.preventDefault(); tap(lane); }} onClick={(e) => { if (e.detail === 0) tap(lane); }}><kbd>{gameUi(key)}</kbd></button>)}</div><span className="rhythm-next-key" ref={prompt}>{gameUi("Next beat incoming")}</span>
    </div>
    <div className="new-game-scores">{match.players.filter((p) => s.players[p.id]).map((p) => <div key={p.id}><i style={{ background: COLORS[p.avatarId] }}/><span>{p.name}{gameUi(p.id === playerId ? " · YOU" : "")}</span><b>{gameUi(s.players[p.id].score.toFixed(2))}</b></div>)}</div>
    <p className="new-game-tip">{gameUi("Follow the letter down one lane · press it at the line · white ×1, gold ×3, violet ×5")}</p>
  </div>;
}
