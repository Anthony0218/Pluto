import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Maximize, Volume2, VolumeX, Trophy, Pause, Play, Settings2 } from 'lucide-react';
import { ui, useUiLanguage } from '../../../i18n/ui';
import { EAT, POWER_KINDS } from '../../../games/eat-it/config';
import { stepGame } from '../../../games/eat-it/engine';
import { ArenaRenderer, POWER_SYMBOL } from '../../../games/eat-it/renderer';
import { EatAudio } from '../../../games/eat-it/audio';
import { EatConnection } from '../../../games/eat-it/network';
import { getAudioSettings, setAudioSettings, subscribeAudioSettings } from '../../../games/chess/audio/chessAudio';
import type { GameState, Input, Player, Room } from '../../../games/eat-it/types';

const powerName = { speed: 'Speed Boost', shield: 'Shield', magnet: 'Magnet', growth: 'Growth Boost' };
type Hud = { time: number; status: GameState['status']; winnerId: string | null; players: Player[]; event: string };
const hudFor = (s: GameState, localId: string): Hud => {
  const event = [...s.events].reverse().find(e => e.type === 'eat' && (e.playerId === localId || e.victimId === localId));
  return { time: s.time, status: s.status, winnerId: s.winnerId, players: s.players.map(p => ({ ...p, effects: { ...p.effects } })),
    event: event ? event.playerId === localId ? ui('You ate {player}').replace('{player}', s.players.find(p => p.id === event.victimId)?.name ?? '') : ui('{player} ate you').replace('{player}', s.players.find(p => p.id === event.playerId)?.name ?? '') : '' };
};
export function AudioControls() {
  useUiLanguage(); const audio = useSyncExternalStore(subscribeAudioSettings, getAudioSettings);
  return <div className="eat-audio-panel">
    {([['masterVolume', 'Master volume'], ['effectsVolume', 'Sound effects volume'], ['musicVolume', 'Music volume']] as const).map(([key, label]) => <label key={key}>{ui(label)}<input type="range" min="0" max="1" step="0.05" value={audio[key]} onChange={e => setAudioSettings({ [key]: Number(e.target.value) })} /></label>)}
    <label>{ui('Ambient sound')}<input type="checkbox" checked={audio.backgroundMusic && audio.musicCategory !== 'off'} onChange={e => setAudioSettings({ backgroundMusic: e.target.checked, musicCategory: e.target.checked ? 'ambient' : 'off' })} /></label>
  </div>;
}
export default function EatItArena({ initial, localId, room, onRoom, onExit, onFinished }: { initial: GameState; localId: string; room?: Room; onRoom?: (room: Room) => void; onExit: () => void; onFinished: (state: GameState) => void }) {
  const { language } = useUiLanguage(); const canvas = useRef<HTMLCanvasElement>(null), container = useRef<HTMLDivElement>(null);
  const input = useRef<Input>({ x: 0, y: 0 }), paused = useRef(false), source = useRef(initial);
  const [hud, setHud] = useState(() => hudFor(initial, localId)), [isPaused, setPaused] = useState(false);
  const [error, setError] = useState(''), [audioOpen, setAudioOpen] = useState(false), [help, setHelp] = useState(true);
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const settings = useSyncExternalStore(subscribeAudioSettings, getAudioSettings);
  const callbacks = useRef({ onRoom, onFinished });
  useEffect(() => { callbacks.current = { onRoom, onFinished }; }, [onRoom, onFinished]);
  const you = useRef(ui('You')); useEffect(() => { you.current = ui('You'); }, [language]);
  const isOnline = !!room;
  useEffect(() => {
    if (!canvas.current || !container.current) return;
    const renderer = new ArenaRenderer(canvas.current, initial.map), audio = new EatAudio();
    const connection = room ? new EatConnection(room, r => callbacks.current.onRoom?.(r), setError) : null;
    const node = container.current, keys = new Set<string>();
    const shell = document.querySelector<HTMLElement>('.app-shell'), wasInert = shell?.inert;
    if (shell) shell.inert = true;
    let frame = 0, previous = performance.now(), accumulator = 0, lastHud = 0, finishedAt: number | null = null, debug = false;
    const heard = new Set<number>();
    const observer = new ResizeObserver(entries => renderer.resize(entries[0].contentRect.width, entries[0].contentRect.height)); observer.observe(node);
    const validKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    const stop = () => { keys.clear(); input.current = { x: 0, y: 0 }; if (connection) connection.input = { x: 0, y: 0 }; };
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input,select,textarea,[contenteditable="true"]')) return;
      if (validKeys.includes(event.key.toLowerCase())) { event.preventDefault(); keys.add(event.key.toLowerCase()); audio.unlock(); }
      if (event.key === 'Escape' && !room) { paused.current = !paused.current; setPaused(paused.current); stop(); }
      if (import.meta.env.DEV && event.key === 'F3') { event.preventDefault(); debug = !debug; }
    };
    const keyup = (event: KeyboardEvent) => { keys.delete(event.key.toLowerCase()); };
    const visibility = () => { stop(); if (document.hidden && !room) { paused.current = true; setPaused(true); } };
    const unlock = () => audio.unlock();
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', visibility); node.addEventListener('pointerdown', unlock);
    const run = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.1); previous = now;
      if (connection) source.current = connection.source.current;
      const state = source.current;
      const keyboard = { x: Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')), y: Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')) };
      const intent = keys.size ? keyboard : input.current;
      if (connection) connection.input = intent;
      else if (!paused.current) {
        const player = state.players.find(p => p.id === localId); if (player) player.input = intent;
        accumulator += dt;
        while (accumulator >= 1 / EAT.network.tickRate) { stepGame(state); accumulator -= 1 / EAT.network.tickRate; }
      }
      renderer.draw(connection ? connection.presentation(now, localId) : state, localId, dt, you.current, debug, !!connection);
      for (const e of state.events) if (!heard.has(e.id)) {
        heard.add(e.id);
        if (e.playerId === localId) audio.play(e.type);
        else if (e.victimId === localId && e.type === 'eat') audio.play('eliminated');
      }
      if (heard.size > 200) { heard.clear(); state.events.forEach(e => heard.add(e.id)); }
      if (!paused.current) audio.ambient(state.map, state.time);
      if (now - lastHud > EAT.visuals.hudIntervalMs) { setHud(hudFor(state, localId)); lastHud = now; }
      if (state.status === 'finished') {
        finishedAt ??= now;
        if (now - finishedAt > 1100) { callbacks.current.onFinished(structuredClone(state)); return; }
      }
      frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run); canvas.current.focus();
    const helpTimer = setTimeout(() => setHelp(false), 10000);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); connection?.close(); audio.close(); clearTimeout(helpTimer);
      if (shell) shell.inert = wasInert ?? false;
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', visibility); node.removeEventListener('pointerdown', unlock); };
  // A game instance owns one loop. Parent callbacks are read through refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id, localId]);
  const local = hud.players.find(p => p.id === localId)!, alive = hud.players.filter(p => p.alive);
  const leaders = [...hud.players].sort((a, b) => Number(b.alive) - Number(a.alive) || b.mass - a.mass);
  const shownLeaders = leaders.slice(0, 5);
  if (!shownLeaders.some(p => p.id === localId)) shownLeaders[shownLeaders.length - 1] = local;
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const pause = () => { paused.current = !paused.current; setPaused(paused.current); input.current = { x: 0, y: 0 }; canvas.current?.focus(); };
  return createPortal(<div className="eat-arena" ref={container}>
    <canvas ref={canvas} className="eat-canvas" tabIndex={0} aria-label={ui('Eat It arena. Move with WASD, arrow keys, or drag.')} onPointerDown={e => {
      if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.focus();
      const bounds = e.currentTarget.getBoundingClientRect(); pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; setStick({ x: e.clientX - bounds.left, y: e.clientY - bounds.top, dx: 0, dy: 0 });
    }} onPointerMove={e => {
      const p = pointer.current; if (!p || p.id !== e.pointerId) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y, length = Math.max(48, Math.hypot(dx, dy)); input.current = { x: dx / length, y: dy / length };
      setStick(s => s && ({ ...s, dx: dx / length * 32, dy: dy / length * 32 }));
    }} onPointerUp={() => { pointer.current = null; input.current = { x: 0, y: 0 }; setStick(null); }} onPointerCancel={() => { pointer.current = null; input.current = { x: 0, y: 0 }; setStick(null); }} />
    {stick && <div className="eat-stick" style={{ left: stick.x, top: stick.y }}><i style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} /></div>}
    <div className="eat-top-left eat-glass"><button aria-label={ui('Return to Lobby')} onClick={onExit}><ArrowLeft size={18} /></button><strong>{ui('Eat It')}<small>{ui(initial.map === 'city' ? 'City' : 'Nature')}</small></strong></div>
    <div className="eat-match-info eat-glass"><span className="eat-live-dot" /><strong>{alive.length}<span> / {hud.players.length}</span></strong><span>{ui('Players Remaining')}</span><i /><time>{Math.floor(hud.time / 60)}:{String(Math.floor(hud.time % 60)).padStart(2, '0')}</time></div>
    <aside className="eat-leaderboard eat-glass" aria-label={ui('Leaderboard')}><h2><Trophy size={13} />{ui('Leaderboard')}</h2>{shownLeaders.map(p => <div key={p.id} className={p.id === localId ? 'is-you' : ''}><span>{leaders.indexOf(p) + 1}</span><i style={{ background: p.color }} /><span>{p.id === localId ? ui('You') : p.name}{!p.alive && ' ×'}</span><b>{Math.round(p.mass)}</b></div>)}</aside>
    <div className="eat-game-buttons eat-glass"><button aria-label={ui(settings.muted ? 'Unmute' : 'Mute')} onClick={() => setAudioSettings({ muted: !settings.muted })}>{settings.muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button><button aria-label={ui('Audio settings')} onClick={() => setAudioOpen(!audioOpen)}><Settings2 size={17} /></button>{!isOnline && <button aria-label={ui(isPaused ? 'Resume' : 'Pause')} onClick={pause}>{isPaused ? <Play size={17} /> : <Pause size={17} />}</button>}<button aria-label={ui('Fullscreen')} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void container.current?.requestFullscreen().catch(() => {}); }}><Maximize size={17} /></button></div>
    {audioOpen && <div className="eat-game-audio eat-glass"><AudioControls /></div>}
    <div className="eat-mass-card eat-glass"><div className="eat-mini-face" style={{ background: local.color }}>●</div><div><span>{ui('Mass')}</span><strong>{Math.round(local.mass)}<small>g</small></strong></div><i /><div><span>{ui('Score')}</span><strong>{local.score.toLocaleString()}</strong></div></div>
    <div className="eat-effects">{POWER_KINDS.filter(k => local.effects[k] > hud.time).map(k => <div className={`eat-effect eat-effect-${k}`} key={k}><b>{POWER_SYMBOL[k]}</b><div>{ui(powerName[k])}<small>{k === 'growth' ? ui('Permanent +{mass} mass').replace('{mass}', String(EAT.powerups.growth.mass)) : `${(local.effects[k] - hud.time).toFixed(1)}s`}</small></div></div>)}</div>
    {help && local.alive && <div className="eat-control-hint eat-glass">{ui('WASD / arrows to move · Drag on touch screens')}<span>{ui('Face your food. Watch your back.')}</span></div>}
    {hud.time > EAT.match.zoneStart && <div className="eat-zone-note">{ui('The arena is closing. Stay inside the ring!')}</div>}
    <div className="eat-announcement" role="status">{hud.event}</div>
    {!local.alive && hud.status !== 'finished' && <div className="eat-spectating eat-glass"><strong>{ui('Placement')} #{local.placement}</strong><span>{ui('Spectating the survivors')}</span></div>}
    {error && <div className="eat-network-error" role="alert">{ui('Reconnecting…')} {ui(error)}</div>}
    {isPaused && <div className="eat-pause"><h2>{ui('Paused')}</h2><button className="eat-primary" onClick={pause}><Play size={18} />{ui('Resume')}</button></div>}
  </div>, document.body);
}
