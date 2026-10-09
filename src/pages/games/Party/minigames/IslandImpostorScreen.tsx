import { useCallback, useEffect, useRef } from "react";
import type { ImpostorView } from "../../../../games/party/minigames/expansionGames/islandImpostor.ts";
import type { MinigameViewProps } from "./views.ts";
import { COLORS } from "../../../../games/party/config.ts";

const OBJECT_NAMES = ["palm", "shell", "boat", "flower", "starfish", "tiki mask", "umbrella", "compass"];
const COLOR_NAMES = ["coral", "violet", "mint", "gold"];
const SOUVENIR_COLORS = ["#ffa9a7", "#c4a6ff", "#9ee1b4", "#f8d38a"];
function Souvenir({ symbol, color }: { symbol: number; color: number }) {
  const fill = SOUVENIR_COLORS[color];
  return <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="#265e70"/><ellipse cx="50" cy="76" rx="36" ry="13" fill="#e2c798"/><g fill={fill} stroke="#183342" strokeWidth="2" strokeLinejoin="round">
    {symbol === 0 ? <><path d="M48 77 53 38 60 77Z" fill="#b18361"/><path d="M54 39Q30 16 17 41Q34 34 53 44Q25 33 21 59Q35 44 54 44Q77 21 86 45Q70 34 57 44Q84 43 78 65Q68 49 56 44Z"/><circle cx="55" cy="45" r="5"/></> : symbol === 1 ? <><path d="M24 70Q7 35 50 21Q93 35 76 70Z"/><path d="M50 24V68M33 29 44 68M67 29 56 68M23 39 39 69M77 39 61 69" fill="none"/><path d="M40 70H60V78H40Z"/></> : symbol === 2 ? <><path d="M14 63H86L74 78H30Z"/><path d="M51 20V62M47 24 23 56H47ZM56 28 78 56H56Z"/></> : symbol === 3 ? <><path d="M50 54V79M50 70Q25 54 30 74Q40 80 50 74" fill="none" stroke="#a7d1a2" strokeWidth="4"/>{[0, 60, 120, 180, 240, 300].map((angle) => <ellipse key={angle} cx="50" cy="33" rx="10" ry="17" transform={`rotate(${angle} 50 50)`}/>)}<circle cx="50" cy="50" r="11" fill="#ffeeac"/></> : symbol === 4 ? <><path d="M50 18 60 40 83 36 67 54 76 79 50 65 24 79 33 54 17 36 40 40Z"/>{[32, 50, 68].map((x) => <circle key={x} cx={x} cy="51" r="2" fill="#fff1cb" stroke="none"/>)}</> : symbol === 5 ? <><rect x="26" y="19" width="48" height="60" rx="14"/><path d="M34 37 45 43 34 46M66 37 55 43 66 46M50 42 44 57H56M36 64H64" fill="none" strokeWidth="4"/></> : symbol === 6 ? <><path d="M16 49Q50 1 84 49Z"/><path d="M50 49V74Q50 85 38 78" fill="none" strokeWidth="4"/><path d="M50 25Q32 37 33 49M50 25Q68 37 67 49" fill="none"/></> : <><circle cx="50" cy="50" r="29"/><path d="M50 22 59 50 50 77 41 50Z" fill="#f4f0d7"/><path d="M50 25 58 50H42Z" fill="#bd5c70"/><circle cx="50" cy="50" r="3" fill="#203e50"/></>}
  </g></svg>;
}
export default function IslandImpostorScreen({ match, minigame, playerId, online, now, sendInput }: MinigameViewProps) {
  const s = minigame.state as ImpostorView, me = s.players[playerId];
  const active = online && !!me && !me.answered && s.phase === "answer" && now < s.phaseEndsAt;
  const guess = useCallback((tile: number) => { if (active) sendInput({ type: "IMPOSTOR_GUESS", tile, round: s.round }); }, [active, s.round, sendInput]);
  const handler = useRef(guess);
  useEffect(() => { handler.current = guess; }, [guess]);
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return; if (/^[1-6]$/.test(e.key)) { e.preventDefault(); handler.current(Number(e.key) - 1); } }; window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key); }, []);
  const cue = s.phase === "watch" ? "MEMORIZE · remember shapes and colors" : s.phase === "blackout" ? "BLACKOUT · keep the island in your mind" : s.phase === "answer" ? me?.answered ? "GUESS LOCKED · wait for the reveal" : "SPOT THE CHANGE · choose one souvenir" : s.phase === "reveal" ? s.yourCorrect === true ? "CORRECT! +2 points" : "The highlighted souvenir changed" : "All eight rounds complete";
  return <div className="pp-arcade-game pp-impostor-game new-minigame"><header className="pp-arcade-header"><div><span className="pp-eyebrow">OBSERVATION ROUND {s.round}/8</span><h2>Island Impostor</h2></div><strong>{Math.max(0, Math.ceil((s.phaseEndsAt - now) / 1000))}s</strong></header>
    <div className="pp-arcade-objective" role="status">{cue}</div>
    <div className={`pp-souvenir-grid ${s.phase === "blackout" ? "blackout" : ""}`}>
      {Array.from({ length: 6 }, (_, i) => { const object = s.objects[i]; return <button key={i} type="button" disabled={!active} onClick={() => guess(i)} aria-label={object ? `Souvenir ${i + 1}: ${COLOR_NAMES[object.color]} ${OBJECT_NAMES[object.symbol]}` : `Souvenir ${i + 1}: hidden`} className={`${s.changed === i ? "changed" : ""} ${s.yourChoice === i ? "chosen" : ""}`}>
        {object ? <Souvenir symbol={object.symbol} color={object.color}/> : <span className="pp-blackout-mark">?</span>}<span className="pp-souvenir-number">{i + 1}{s.changed === i ? " · CHANGED" : s.yourChoice === i ? " · YOUR GUESS" : ""}</span>
      </button>; })}
    </div>
    <p className="pp-arcade-hint">One guess per round · correct +2 · no speed bonus · everyone returns</p>
    <div className="pp-arcade-scores">{match.players.filter((p) => s.players[p.id]).map((p) => <div key={p.id} className={p.id === playerId ? "me" : ""}><i style={{ background: COLORS[p.avatarId] }}/><span>{p.name}{s.players[p.id].answered ? " ✓" : ""}</span><b>{s.players[p.id].score}</b></div>)}</div>
  </div>;
}
