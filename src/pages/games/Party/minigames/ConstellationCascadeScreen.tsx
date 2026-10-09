import { useCallback, useEffect, useRef } from 'react';
import { COLORS } from '../../../../games/party/config.ts';
import { CASCADE_COLUMNS, CASCADE_ROWS, MOON_GLYPHS, type CascadeAction, type CascadeView } from '../../../../games/party/minigames/arcadeAdditions/cascade.ts';
import type { MinigameViewProps } from './views.ts';
const GLYPH_COLORS = ['#ffd493', '#b8aceb', '#8dddd2'];
function Moon({ glyph, x, y, falling = false }: { glyph: number; x: number; y: number; falling?: boolean }) { return <g transform={`translate(${x} ${y})`}><circle cy=".45" r="3.3" fill="#0e162ccc"/><circle r="3.15" fill={GLYPH_COLORS[glyph - 1]} stroke={falling ? '#fff9e3' : '#f8eede80'} strokeWidth={falling ? '.65' : '.2'}/><circle cx="-.9" cy="-1" r=".65" fill="#ffffff66"/><text y="1.25" textAnchor="middle" fontSize="3.7" fill="#243546" fontWeight="800">{MOON_GLYPHS[glyph - 1]}</text></g>; }
export default function ConstellationCascadeScreen({ minigame, match, playerId, now, online, sendInput }: MinigameViewProps) {
  const s = minigame.state as CascadeView, p = s.player, active = online && !!p && now >= s.startedAt && now < s.endsAt && now >= p.resetUntil;
  const send = useRef(sendInput), enabled = useRef(active), last = useRef(0);
  useEffect(() => { send.current = sendInput; enabled.current = active; }, [sendInput, active]);
  const action = useCallback((move: CascadeAction) => { if (!enabled.current || performance.now() - last.current < 85) return; last.current = performance.now(); send.current({ type: 'CASCADE_ACTION', action: move }); }, []);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return; const key: Record<string, CascadeAction> = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'swap', ArrowUp: 'swap', KeyS: 'down', ArrowDown: 'down', Space: 'drop' }; const move = key[e.code]; if (!move || !enabled.current) return; e.preventDefault(); if (e.repeat && (move === 'drop' || move === 'swap')) return; action(move); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [action]);
  const point = (column: number, row: number) => ({ x: 14 + column * 9, y: 10 + row * 8 + column % 2 * 4 });
  return <div className="pp-new-game pp-cascade-game"><header className="pp-new-header"><div><span className="pp-eyebrow">BUILD A MATCHING CONSTELLATION</span><h2>Constellation Cascade</h2></div><strong className="pp-new-timer">{Math.max(0, Math.ceil((s.endsAt - now) / 1000))}<small>SECONDS</small></strong></header>
    <div className="pp-new-standings">{match.players.filter((q) => s.standings[q.id]).map((q) => <span key={q.id} className={q.id === playerId ? 'me' : ''} style={{ borderColor: COLORS[q.avatarId] }}><b>{q.name}</b><strong>{s.standings[q.id].score} pts</strong></span>)}</div>
    <svg className="pp-new-arena" viewBox="0 0 100 100" role="img" aria-label="Your private honeycomb moon puzzle"><rect width="100" height="100" rx="18" fill="#101d35"/>{Array.from({ length: 35 }, (_, i) => <circle key={i} cx={(i * 37) % 100} cy={(i * 23) % 100} r=".25" fill="#c3b9dd"/>)}<path d="M9 6Q50 -1 91 6Q99 50 91 92Q50 101 9 92Q1 50 9 6Z" fill="#263450" stroke="#7585b6" strokeWidth=".7"/>
      {Array.from({ length: CASCADE_COLUMNS * CASCADE_ROWS }, (_, n) => { const q = point(n % CASCADE_COLUMNS, Math.floor(n / CASCADE_COLUMNS)); return <path key={n} d={`M${q.x} ${q.y - 4.2}l4.25 2.1v4.2l-4.25 2.1 -4.25 -2.1v-4.2Z`} fill={p?.flashUntil && p.flashUntil > now && p.flash.includes(n) ? '#829d9966' : '#1a2942'} stroke="#445775" strokeWidth=".25"/>; })}
      {p?.board.map((glyph, n) => glyph ? <Moon key={n} glyph={glyph} {...point(n % CASCADE_COLUMNS, Math.floor(n / CASCADE_COLUMNS))}/> : null)}
      {p && now < s.endsAt && now >= p.resetUntil && p.pair.map((glyph, i) => <Moon key={i} glyph={glyph} {...point(p.column, p.row + i)} falling/>)}
      {!p && <text x="50" y="50" textAnchor="middle" fill="#fff1cd" fontSize="4">Watching the scores</text>}
      {p && now < p.resetUntil && <g><rect x="20" y="40" width="60" height="20" rx="5" fill="#19233aee"/><text x="50" y="49" textAnchor="middle" fill="#ffc7a7" fontSize="4">SKY OVERFLOW · −5</text><text x="50" y="56" textAnchor="middle" fill="#e8eaff" fontSize="3">A fresh constellation is arriving…</text></g>}
    </svg>
    <p className="pp-new-status" role="status">{now >= s.endsAt ? 'Time! Your constellation score is final.' : p && p.chain > 1 && p.flashUntil > now ? `${p.chain}× CHAIN REACTION!` : 'Match four connected moon glyphs. Any direction counts.'}</p>
    <div className="pp-new-controls pp-cascade-controls">{([['left', '← Left'], ['swap', '⇅ Swap'], ['right', 'Right →'], ['down', '↓ Lower'], ['drop', 'Drop ↓↓']] as const).map(([move, label]) => <button type="button" key={move} disabled={!active || (move === 'drop' && !!p && now < p.nextDropAt)} onClick={() => action(move)}>{label}</button>)}</div>
    <small className="pp-new-help">A/D or ←/→ move · W/↑ swap · S/↓ lower · Space drop{!online ? ' · Reconnecting…' : ''}</small>
  </div>;
}
