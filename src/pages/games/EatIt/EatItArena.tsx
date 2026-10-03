import { ABILITY_KEYS, activateAbility, abilityAvailable, type HeldAbility } from '../../../games/eat-it/abilities';
import { activateEscape, escapeAvailable } from '../../../games/eat-it/escape';
import { respawn, activateGrowth, liveLeaders } from '../../../games/eat-it/progression';
import { questAlert } from '../../../games/eat-it/quests';
import { inMouth, isChoking } from '../../../games/eat-it/rules';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

const coarsePointer = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
import { createPortal } from 'react-dom';
import { ArrowLeft, Maximize, Volume2, VolumeX, Trophy, Pause, Play, Settings2, ZoomIn, ZoomOut } from 'lucide-react';
import { ui, useUiLanguage } from '../../../i18n/ui';
import { EAT, POWER_KINDS, POWER_NAME, matchDuration, type PowerKind } from '../../../games/eat-it/config';
import { lastStanding, stepEpilogue, stepGame } from '../../../games/eat-it/engine';
import { ArenaRenderer, POWER_SYMBOL } from '../../../games/eat-it/renderer';
import { EatAudio } from '../../../games/eat-it/audio';
import { EatConnection } from '../../../games/eat-it/network';
import { getAudioSettings, setAudioSettings, subscribeAudioSettings } from '../../../games/chess/audio/chessAudio';
import type { GameState, Input, Player, Room } from '../../../games/eat-it/types';

const powerName = POWER_NAME;
/** Held items (one charge each) a player is pressing their mouth against while already carrying one. */
const heldKind = (p: Player, kind: PowerKind) => kind === 'strike' ? !!p.storedStrike : kind === 'jump' ? !!p.storedJump : kind === 'multiplier' ? !!p.storedGrowth : false;
const blockedPickup = (s: GameState, p: Player) => p.alive && s.status === 'playing' ? s.powerups.find(item => heldKind(p, item.kind) && inMouth(p, item, EAT.powerups.radius, 10, s.time))?.kind ?? null : null;
const BLOCKED_NOTICE_SECONDS = 1.6;
type Hud = { blocked: { kind: PowerKind; until: number } | null; hellSince: number; jumpReady: boolean; strikeReady: boolean; soloRemaining: number; phase: GameState['phase']; escapeReady: boolean; helperName: string; escapeUntil: number; time: number; status: GameState['status']; winnerId: string | null; players: Player[]; event: string; quest: string; questVisible: boolean };
const hudFor = (s: GameState, localId: string, wasVisible = false, wasBlocked: Hud['blocked'] = null): Hud => {
  const event = [...s.events].reverse().find(e => (e.playerId === localId || e.victimId === localId) && ['eat','power','escape','respawn','hellAssist','fireball','blackHoleEaten'].includes(e.type) || e.playerId === localId && e.type === 'food' && e.food?.startsWith('pluto'));
  const player = s.players.find(p => p.id === localId)!, e = s.encounter;
  const questVisible = questAlert(s, player, wasVisible);
  let quest = '';
  if ((!s.phase || s.phase === 'normal') && player.alive) {
    if (isChoking(player, s.time)) quest = `${ui('Choking…')} ${Math.ceil((player.chokingUntil ?? 0) - s.time)}s`;
    else if (e && e.npc.targetId === localId && ['friendly', 'hostile', 'emerging', 'devoured'].includes(e.npc.phase)) {
      const key = e.npc.phase === 'friendly' ? e.npc.kind === 'pigeon' ? 'Friendly pigeon · bonus food' : 'Friendly cat · bonus food' : 'Revenge! Watch out for attacks';
      quest = `${ui(key)} · ${Math.max(0, Math.ceil(e.npc.until - s.time))}s`;
      if (e.npc.phase === 'friendly') quest = s.time - e.npc.since < 2 ? `${ui('Quest completed!')} ${ui(key)}` : '';
    } else if (e?.item.ownerId === localId) quest = ui(e.item.kind === 'scroll' ? 'Golden Scroll collected · bring it to the pigeon' : 'Cat Tree collected · bring it to the cat');
    else if (questVisible && e) quest = ui(e.npc.kind === 'pigeon' ? 'Bring the pigeon the Golden Scroll' : 'Bring the cat the Cat Tree');
  }
  const touching = blockedPickup(s, player);
  const blocked = touching ? { kind: touching, until: s.time + BLOCKED_NOTICE_SECONDS } : wasBlocked && wasBlocked.until > s.time ? wasBlocked : null;
  return { blocked, hellSince: s.hell?.readyAt ?? 0, jumpReady: abilityAvailable(s,player,'jump'), strikeReady: abilityAvailable(s,player,'strike'), soloRemaining: s.hell ? Math.max(0,EAT.hell.soloDuration-(s.time-s.hell.readyAt)) : 0, phase: s.phase ?? 'normal', escapeReady: escapeAvailable(s, player), helperName: (s.phase === 'hell' ? player.helper?.kind : e?.npc.kind) === 'cat' ? 'Cat' : 'Pigeon', escapeUntil: e?.npc.targetId === localId && e.npc.phase === 'friendly' ? e.npc.until : 0, quest, questVisible, time: s.time, status: s.status, winnerId: s.winnerId, players: s.players.map(p => ({ ...p, effects: { ...p.effects } })),
    event: event && event.type !== 'eat' ? ui(event.type === 'power' ? powerName[event.power!] : event.type === 'respawn' ? 'Respawning' : event.type === 'fireball' ? 'Fireball! You grew' : event.type === 'blackHoleEaten' ? 'You devoured a black hole!' : event.type === 'food' ? 'Pluto Bonus' : 'Escape') : event ? event.playerId === localId ? ui('You ate {player}').replace('{player}', s.players.find(p => p.id === event.victimId)?.name ?? '') : ui('{player} ate you').replace('{player}', s.players.find(p => p.id === event.playerId)?.name ?? '') : '' };
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
  const [graphicsError, setGraphicsError] = useState(false);
  // After the last rival is eaten the world keeps running for `EAT.match.victoryLap` seconds, then fades to results.
  const [victory, setVictory] = useState<{ until: number; name: string } | null>(null), [ending, setEnding] = useState(false);
  const [error, setError] = useState(''), [audioOpen, setAudioOpen] = useState(false), [help, setHelp] = useState(true);
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const zoomCommand = useRef<(factor: number) => void>(() => {});
  const abilityCommand = useRef<(kind: HeldAbility) => void>(() => {});
  const growthCommand = useRef<() => void>(() => {});
  const escapeCommand = useRef<() => void>(() => {}), respawnCommand = useRef<() => void>(() => {});
  const settings = useSyncExternalStore(subscribeAudioSettings, getAudioSettings);
  const callbacks = useRef({ onRoom, onFinished });
  useEffect(() => { callbacks.current = { onRoom, onFinished }; }, [onRoom, onFinished]);
  const you = useRef(ui('You')); useEffect(() => { you.current = ui('You'); }, [language]);
  const isOnline = !!room;
  const [touch] = useState(coarsePointer);
  useEffect(() => {
    if (!canvas.current || !container.current) return;
    let renderer: ArenaRenderer;
    try { renderer = new ArenaRenderer(canvas.current, initial.map); }
    catch { const notice = requestAnimationFrame(() => setGraphicsError(true)); return () => cancelAnimationFrame(notice); }
    const audio = new EatAudio();
    zoomCommand.current = factor => { renderer.zoomBy(factor); };
    const connection = room ? new EatConnection(room, r => callbacks.current.onRoom?.(r), setError) : null;
    abilityCommand.current = kind => { if (paused.current) return; if (connection && room) void connection.escape(room.room_code, kind); else { const p=source.current.players.find(p=>p.id===localId); if(p) activateAbility(source.current,p,kind); } };
    growthCommand.current = () => { if (paused.current) return; if (connection && room) void connection.escape(room.room_code, 'growth'); else { const p = source.current.players.find(p => p.id === localId); if (p) activateGrowth(source.current, p); } };
    respawnCommand.current = () => { if (paused.current) return; if (connection && room) void connection.escape(room.room_code, 'respawn'); else { const p = source.current.players.find(p => p.id === localId); if (p) respawn(source.current, p); } };
    escapeCommand.current = () => { if (paused.current) return; if (connection && room) void connection.escape(room.room_code); else { const p = source.current.players.find(p => p.id === localId); if (p) activateEscape(source.current, p); } };
    const node = container.current, keys = new Set<string>();
    const shell = document.querySelector<HTMLElement>('.app-shell'), wasInert = shell?.inert;
    if (shell) shell.inert = true;
    let frame = 0, previous = performance.now(), accumulator = 0, lastHud = 0, finishedAt: number | null = null, fadeAt: number | null = null, debug = false;
    // `result` freezes the decided match; `lap` is the world the winner keeps playing in meanwhile.
    let result: GameState | null = null, lap: GameState | null = null;
    const heard = new Set<number>();
    const observer = new ResizeObserver(entries => renderer.resize(entries[0].contentRect.width, entries[0].contentRect.height)); observer.observe(node);
    const validKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    const stop = () => { keys.clear(); input.current = { x: 0, y: 0 }; if (connection) connection.input = { x: 0, y: 0 }; };
    const keydown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input,select,textarea,[contenteditable="true"]')) return;
      if (validKeys.includes(event.key.toLowerCase())) { event.preventDefault(); keys.add(event.key.toLowerCase()); audio.unlock(); }
      for (const kind of ['jump','strike'] as const) if (event.code === ABILITY_KEYS[kind]) { event.preventDefault(); if(!event.repeat) { audio.unlock(); abilityCommand.current(kind); } }
      if (['+', '=', '-', '_'].includes(event.key) && !event.metaKey && !event.ctrlKey) { event.preventDefault(); zoomCommand.current(['+', '='].includes(event.key) ? 1.15 : 1 / 1.15); }
      if (event.key === 'Escape' && !room) { paused.current = !paused.current; setPaused(paused.current); stop(); }
      if (import.meta.env.DEV && event.key === 'F3') { event.preventDefault(); debug = !debug; }
    };
    const keyup = (event: KeyboardEvent) => { keys.delete(event.key.toLowerCase()); };
    const visibility = () => { stop(); if (document.hidden && !room) { paused.current = true; setPaused(true); } };
    const unlock = () => audio.unlock();
    // Trackpad pinches arrive as ctrl+wheel; both zoom the arena instead of the page.
    const wheel = (event: WheelEvent) => { event.preventDefault(); zoomCommand.current(Math.exp(-Math.max(-120, Math.min(120, event.deltaY)) * (event.ctrlKey ? .01 : .0015))); };
    node.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', visibility); node.addEventListener('pointerdown', unlock);
    const run = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.1); previous = now;
      if (connection && !lap) source.current = connection.source.current;
      const state = source.current;
      const keyboard = { x: Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')), y: Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')) };
      const intent = keys.size ? keyboard : input.current;
      if (connection && !lap) connection.input = intent;
      else if (!paused.current) {
        const player = state.players.find(p => p.id === localId); if (player) player.input = intent;
        accumulator += dt;
        while (accumulator >= 1 / EAT.network.tickRate) { if (lap) stepEpilogue(state); else stepGame(state); accumulator -= 1 / EAT.network.tickRate; }
      }
      renderer.draw(connection && !lap ? connection.presentation(now, localId) : state, localId, dt, you.current, debug, !!connection);
      for (const e of state.events) if (!heard.has(e.id)) {
        heard.add(e.id);
        if (e.playerId === localId || !e.playerId) audio.play(e.type);
        else if (e.victimId === localId && e.type === 'eat') audio.play('eliminated');
      }
      if (heard.size > 200) { heard.clear(); state.events.forEach(e => heard.add(e.id)); }
      if (!paused.current) audio.ambient(state.hell ? 'hell' : state.map, state.time);
      // Growth after the decision doesn't count: the lap's HUD keeps the final standings.
      if (now - lastHud > EAT.visuals.hudIntervalMs) { const shown = lap && result ? { ...state, players: result.players } : state; setHud(previousHud => hudFor(shown, localId, previousHud.questVisible, previousHud.blocked)); lastHud = now; }
      if (state.status === 'finished' && !result) {
        result = structuredClone(state); finishedAt = now;
        if (lastStanding(state)) {
          // Online, the server has stopped: the lap runs locally on a copy, with idle rivals' humans.
          lap = connection ? structuredClone(state) : state;
          if (connection) { lap.players.forEach(p => { if (!p.bot && p.id !== localId) p.input = { x: 0, y: 0 }; }); source.current = lap; accumulator = 0; }
          const winner = state.players.find(p => p.id === state.winnerId)!;
          setVictory({ until: state.time + EAT.match.victoryLap, name: winner.id === localId ? '' : winner.name });
        }
      }
      if (result && fadeAt === null && (lap ? state.time >= result.time + EAT.match.victoryLap : now - (finishedAt ?? now) > 1100)) { fadeAt = now; setEnding(true); }
      if (result && fadeAt !== null && now - fadeAt > EAT.match.resultsFadeMs) { callbacks.current.onFinished(result); return; }
      frame = requestAnimationFrame(run);
    };
    frame = requestAnimationFrame(run); canvas.current.focus();
    const helpTimer = setTimeout(() => setHelp(false), 10000);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); renderer.dispose(); connection?.close(); audio.close(); clearTimeout(helpTimer);
      if (shell) shell.inert = wasInert ?? false;
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', visibility); node.removeEventListener('pointerdown', unlock); node.removeEventListener('wheel', wheel); zoomCommand.current = () => {}; };
  // A game instance owns one loop. Parent callbacks are read through refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id, localId]);
  const local = hud.players.find(p => p.id === localId)!, alive = hud.players.filter(p => p.alive);
  const leaders = liveLeaders(hud.players);
  const shownLeaders = leaders;
  if (!shownLeaders.some(p => p.id === localId)) shownLeaders[shownLeaders.length - 1] = local;
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  // Two fingers pinch-zoom; the joystick is released while pinching.
  const touches = useRef(new Map<number, { x: number; y: number }>()), pinch = useRef<number | null>(null);
  const spread = () => { const [a, b] = [...touches.current.values()]; return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)); };
  const release = (id: number) => {
    touches.current.delete(id); if (touches.current.size < 2) pinch.current = null;
    if (pointer.current?.id === id) { pointer.current = null; input.current = { x: 0, y: 0 }; setStick(null); }
  };
  const pause = () => { paused.current = !paused.current; setPaused(paused.current); input.current = { x: 0, y: 0 }; canvas.current?.focus(); };
  return createPortal(<div className="eat-arena" ref={container}>
    <canvas ref={canvas} className="eat-canvas" tabIndex={0} onContextMenu={e => e.preventDefault()} aria-label={ui('Eat It arena. Move with WASD, arrow keys, or drag.')} onPointerDown={e => {
      if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.focus();
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size >= 2) { pinch.current = spread(); pointer.current = null; input.current = { x: 0, y: 0 }; setStick(null); return; }
      const bounds = e.currentTarget.getBoundingClientRect(); pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY }; setStick({ x: e.clientX - bounds.left, y: e.clientY - bounds.top, dx: 0, dy: 0 });
    }} onPointerMove={e => {
      if (touches.current.has(e.pointerId)) touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current !== null && touches.current.size >= 2) { const next = spread(); zoomCommand.current(next / pinch.current); pinch.current = next; return; }
      const p = pointer.current; if (!p || p.id !== e.pointerId) return;
      // A small dead zone stops thumb jitter from creeping the mouth around.
      const dx = e.clientX - p.x, dy = e.clientY - p.y, distance = Math.hypot(dx, dy), length = Math.max(48, distance);
      input.current = distance < 7 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length };
      setStick(s => s && ({ ...s, dx: dx / length * 32, dy: dy / length * 32 }));
    }} onPointerUp={e => release(e.pointerId)} onPointerCancel={e => release(e.pointerId)} />
    {graphicsError && <div className="eat-pause" role="alert"><h2>{ui('3D graphics unavailable')}</h2><p>{ui('Enable WebGL2 in your browser to play Eat It.')}</p><button className="eat-primary" onClick={onExit}>{ui('Return to Lobby')}</button></div>}
    {stick && <div className="eat-stick" style={{ left: stick.x, top: stick.y }}><i style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} /></div>}
    <div className="eat-top-left eat-glass"><button aria-label={ui('Return to Lobby')} onClick={onExit}><ArrowLeft size={18} /></button><strong>{ui('Eat It')}<small>{ui(hud.phase !== 'normal' ? 'Hell' : initial.map === 'city' ? 'City' : 'Nature')}</small></strong></div>
    <div className="eat-match-info eat-glass"><span className="eat-live-dot" /><strong>{alive.length}<span> / {hud.players.length}</span></strong><span>{ui('Players Remaining')}</span><i /><time>{hud.phase !== 'normal' ? ui('Sudden Death') : `${Math.floor(Math.max(0, Math.ceil(matchDuration(initial) - hud.time)) / 60)}:${String(Math.floor(Math.max(0, Math.ceil(matchDuration(initial) - hud.time)) % 60)).padStart(2, '0')}`}</time></div>
    <aside className="eat-leaderboard eat-glass" aria-label={ui('Leaderboard')}><h2><Trophy size={13} />{ui('Leaderboard')}</h2>{shownLeaders.map(p => <div key={p.id} className={p.id === localId ? 'is-you' : ''}><span>{leaders.indexOf(p) + 1}</span><i style={{ background: p.color }} /><span>{p.id === localId ? ui('You') : p.name}{!p.alive && ' ×'}</span><b>{Math.round(p.mass).toLocaleString()} <span key={p.lives} className="eat-life-change" aria-label={`${ui('Lives')}: ${p.lives ?? 0}`}>{'♥'.repeat(p.lives ?? 0) || '×'}</span></b></div>)}</aside>
    <div className="eat-game-buttons eat-glass"><button aria-label={ui(settings.muted ? 'Unmute' : 'Mute')} onClick={() => setAudioSettings({ muted: !settings.muted })}>{settings.muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button><button aria-label={ui('Audio settings')} onClick={() => setAudioOpen(!audioOpen)}><Settings2 size={17} /></button>{!isOnline && <button aria-label={ui(isPaused ? 'Resume' : 'Pause')} onClick={pause}>{isPaused ? <Play size={17} /> : <Pause size={17} />}</button>}<button aria-label={ui('Zoom in')} onClick={() => zoomCommand.current(1.25)}><ZoomIn size={17} /></button><button aria-label={ui('Zoom out')} onClick={() => zoomCommand.current(1 / 1.25)}><ZoomOut size={17} /></button><button aria-label={ui('Fullscreen')} onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void container.current?.requestFullscreen().catch(() => {}); }}><Maximize size={17} /></button></div>
    {audioOpen && <div className="eat-game-audio eat-glass"><AudioControls /></div>}
    <div className="eat-mass-card eat-glass"><div className="eat-mini-face" style={{ background: local.color }}>●</div><div><span>{ui('Growth')}</span><strong>{Math.round(local.mass).toLocaleString()}</strong></div><i /><div><span>{ui('Score')}</span><strong>{local.score.toLocaleString()}</strong></div></div>
    {hud.phase === 'normal' && <div className="eat-lives eat-glass" role="status">{ui('Lives')} <b key={local.lives} className="eat-life-change">{'♥'.repeat(local.lives ?? 0)}{'♡'.repeat(Math.max(0, (initial.settings?.livesEnabled === false ? 1 : 3) - (local.lives ?? 0)))}</b></div>}
    {(hud.escapeReady || local.escape || hud.escapeUntil > hud.time || (hud.phase === 'hell' && local.helper)) && local.alive && hud.status === 'playing' && <button className="eat-escape eat-primary" disabled={!hud.escapeReady || isPaused} onClick={() => escapeCommand.current()}>{ui('Escape')} – {ui(hud.helperName)}<small>{local.escape ? ui('Riding…') : hud.phase === 'hell' ? (local.helper?.used ? ui('Used') : ui('Final assist · {seconds}s · one use').replace('{seconds}',String(local.helper?.kind==='pigeon'?EAT.escape.pigeonHellDuration:EAT.escape.hellDuration))) : ui(local.helper?.used ? 'Used' : 'Ready')}</small></button>}
    {hud.phase === 'transition' && <div className="eat-hell-transition" role="status"><span>{ui('Sudden Death')}</span><strong>{ui('Hell')}</strong><p>{ui('Avoid lava and disappearing ground')}</p><p>{ui('Grab fireballs to grow and devour rivals')}</p></div>}
    {hud.phase === 'normal' && local.alive && hud.status === 'playing' && (local.storedGrowth || local.effects.multiplier > hud.time) && <button className="eat-growth-action eat-primary" disabled={isPaused || local.effects.multiplier > hud.time || !!local.escape} onClick={() => growthCommand.current()}><strong>{local.effects.multiplier > hud.time ? `${ui('2x Growth')} · ${Math.ceil(local.effects.multiplier - hud.time)}s` : ui('USE 2x NOW')}</strong><small>{ui(local.storedGrowth ? '2x Growth Ready' : '2x ACTIVE!')}</small></button>}
    {local.alive && hud.status === 'playing' && (local.storedJump || local.storedStrike) && <div className="eat-held-abilities">{(['strike','jump'] as const).filter(kind=>kind==='jump'?local.storedJump:local.storedStrike).map(kind=><button className={`eat-primary eat-held-${kind}`} key={kind} disabled={isPaused || !(kind==='jump'?hud.jumpReady:hud.strikeReady)} onPointerDown={e=>{e.preventDefault();abilityCommand.current(kind);}} onClick={e=>{if(e.detail===0)abilityCommand.current(kind);}}><b>{POWER_SYMBOL[kind]}</b><span>{ui(kind==='jump'?'Jump Ready':'Strike Ready')}<small>{kind==='jump'?'J':'SPACE'}</small></span></button>)}</div>}
    {hud.escapeUntil>hud.time && local.alive && <div className="eat-companion-timer eat-glass" role="status">{ui('{animal} ♥ {seconds}s').replace('{animal}',ui(hud.helperName)).replace('{seconds}',String(Math.ceil(hud.escapeUntil-hud.time)))}</div>}
    {hud.phase === 'hell' && local.alive && hud.time - hud.hellSince < 5 && (local.stats?.fireballs ?? 0) < EAT.hell.fireball.holeEatCount && <div className="eat-hell-goal" role="status"><b>🔥</b>{ui('Collect {count} fireballs to devour a black hole!').replace('{count}', String(EAT.hell.fireball.holeEatCount))}</div>}
    {initial.players.length === 1 && hud.phase === 'hell' && <div className="eat-solo-objective eat-glass" role="status">{ui('Survive Hell for {seconds}s').replace('{seconds}',String(Math.ceil(hud.soloRemaining)))}</div>}
    <div className="eat-effects">{hud.phase === 'hell' && local.alive && <div className="eat-effect eat-effect-fireball"><b>🔥</b><div>{ui('Fireballs')} {Math.min(local.stats?.fireballs ?? 0, EAT.hell.fireball.holeEatCount)}/{EAT.hell.fireball.holeEatCount}<small>{ui((local.stats?.fireballs ?? 0) >= EAT.hell.fireball.holeEatCount ? 'Devour a black hole!' : 'Collect 10 to devour a black hole')}</small></div></div>}{(local.growthModifier ?? 1) < 1 && <div className="eat-effect eat-effect-divider">{ui('Growth /2')}</div>}{(local.stunnedUntil ?? 0) > hud.time && <div className="eat-effect">{ui('Stunned')} · {((local.stunnedUntil ?? 0)-hud.time).toFixed(1)}s</div>}{POWER_KINDS.filter(k => local.effects[k] > hud.time).map(k => <div className={`eat-effect eat-effect-${k}`} key={k}><b>{POWER_SYMBOL[k]}</b><div>{ui(powerName[k])}<small>{`${(local.effects[k] - hud.time).toFixed(1)}s`}</small></div></div>)}</div>
    {help && local.alive && <div className="eat-control-hint eat-glass">{ui(touch ? 'Drag anywhere to move · Pinch to zoom' : 'WASD / arrows to move · Drag on touch screens · Scroll or pinch to zoom')}<span>{ui(touch ? 'Tap Strike to lunge · Jump in Hell' : 'SPACE: Strike · J: Jump in Hell')}</span><span>{ui(hud.phase === 'normal' ? 'Face your food. Watch your back.' : 'Avoid lava and disappearing ground')}</span></div>}
    {!initial.settings?.matchDuration && !initial.settings?.hellEnabled && hud.phase === 'normal' && hud.time > EAT.match.zoneStart && <div className="eat-zone-note">{ui('The arena is closing. Stay inside the ring!')}</div>}
    {hud.quest && <div className={`eat-quest-note eat-glass ${isChoking(local, hud.time) ? 'eat-choking' : ''}`} role="status">{hud.quest}</div>}
    <div className="eat-announcement" role="status">{hud.event}</div>
    {hud.blocked && local.alive && <div className="eat-pickup-blocked" role="status"><b>{POWER_SYMBOL[hud.blocked.kind]}</b>{ui('You already have a {item} — use it first!').replace('{item}', ui(powerName[hud.blocked.kind]))}</div>}
    {!local.alive && hud.phase === 'normal' && (local.lives ?? 0) > 0 && initial.settings?.livesEnabled !== false && <div className="eat-respawn eat-glass" role="status"><strong>{ui('Lives')}: {local.lives}</strong><p>{hud.time < (local.respawnAt ?? Infinity) ? ui('Respawn available in {seconds}').replace('{seconds}', String(Math.ceil((local.respawnAt ?? 0) - hud.time))) : ui('Ready to return')}</p><button className="eat-primary" disabled={isPaused || hud.time + 1e-6 < (local.respawnAt ?? Infinity)} onClick={() => respawnCommand.current()}>{ui('Respawn')}</button></div>}
    {!local.alive && (hud.phase !== 'normal' || !local.lives) && hud.status !== 'finished' && <div className="eat-spectating eat-glass"><strong>{ui('Placement')} #{local.placement}</strong><span>{ui('Spectating the survivors')}</span></div>}
    {error && <div className="eat-network-error" role="alert">{ui('Reconnecting…')} {ui(error)}</div>}
    {victory && <div className="eat-victory" role="status"><Trophy size={22} /><strong>{victory.name ? ui('{name} wins').replace('{name}', victory.name) : ui('You win')}</strong><small>{ui('Results in {seconds}s').replace('{seconds}', String(Math.max(0, Math.ceil(victory.until - hud.time))))}</small></div>}
    {ending && <div className="eat-ending" />}
    {isPaused && <div className="eat-pause"><h2>{ui('Paused')}</h2><button className="eat-primary" onClick={pause}><Play size={18} />{ui('Resume')}</button></div>}
  </div>, document.body);
}
