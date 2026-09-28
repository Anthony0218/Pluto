import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Copy, Leaf, Play, Plus, Shield, Sparkles, Trophy, Users, Zap } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { ui, useUiLanguage } from '../../../i18n/ui';
import { supabase } from '../../../lib/supabase';
import { EAT } from '../../../games/eat-it/config';
import { createGame, fillBots } from '../../../games/eat-it/engine';
import { roomAction } from '../../../games/eat-it/network';
import type { GameState, MapId, Room } from '../../../games/eat-it/types';
import EatItArena from './EatItArena';
import EatItResults from './EatItResults';
import './eat-it.css';

export default function EatItPage() {
  const { roomCode } = useParams(), { user } = useAuth();
  const normalizedCode = roomCode?.toUpperCase();
  return <EatItSession key={`${normalizedCode ?? 'solo'}:${normalizedCode ? user?.id ?? 'guest' : 'local'}`} roomCode={normalizedCode} />;
}

function EatItSession({ roomCode }: { roomCode?: string }) {
  useUiLanguage();
  const { user, profile, loading } = useAuth(), navigate = useNavigate();
  const [map, setMap] = useState<MapId>('city'), [count, setCount] = useState(4), [mode, setMode] = useState<'solo' | 'online'>('solo');
  const [game, setGame] = useState<GameState | null>(null), [result, setResult] = useState<GameState | null>(null);
  const [room, setRoom] = useState<Room | null>(null), [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false);
  const name = profile?.display_name || profile?.username || ui('You');
  const localId = roomCode ? user?.id ?? 'local' : 'local';
  useEffect(() => {
    if (!roomCode || !user || game) return;
    let stopped = false, pending = false;
    const refresh = async () => {
      if (pending) return; pending = true;
      try {
        const next = await roomAction({ op: 'join', code: roomCode });
        if (stopped) return;
        setRoom(next); setError('');
        if (next.status === 'waiting') setResult(null);
        if (next.game_state && (next.status === 'playing' || next.status === 'finished') && next.game_state.id !== result?.id) {
          if (next.status === 'finished') setResult(next.game_state); else { setResult(null); setGame(next.game_state); }
        }
      } catch (cause) { if (!stopped) setError(cause instanceof Error ? cause.message : ui('Room unavailable')); }
      finally { pending = false; }
    };
    void refresh();
    const channel = supabase.channel(`eat-it-lobby-${roomCode}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'eat_it_matches', filter: `room_code=eq.${roomCode}` }, () => void refresh()).subscribe();
    const timer = setInterval(() => void refresh(), EAT.network.lobbyPollMs);
    return () => { stopped = true; clearInterval(timer); void supabase.removeChannel(channel); };
  }, [roomCode, user, game, result?.id]);
  const act = async (op: string) => {
    setBusy(true); setError('');
    try {
      const next = await roomAction({ op, code: roomCode, map, count }); setRoom(next);
      if (next.game_state && next.status === 'playing') { setResult(null); setGame(next.game_state); }
      if (op === 'rematch') { setGame(null); setResult(null); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : ui('Room unavailable')); }
    finally { setBusy(false); }
  };
  const solo = () => { setResult(null); setGame(createGame(map, fillBots([{ id: 'local', name }], count), crypto.getRandomValues(new Uint32Array(1))[0], crypto.randomUUID())); };
  const createRoom = async () => {
    setBusy(true); setError('');
    try { const next = await roomAction({ op: 'create', map, count }); setRoom(next); navigate(`/games/eat-it/multiplayer/${next.room_code}`); }
    catch (cause) { setError(cause instanceof Error ? cause.message : ui('Room unavailable')); } finally { setBusy(false); }
  };
  const leave = async () => {
    if (roomCode) {
      setBusy(true);
      try { await roomAction({ op: 'leave', code: roomCode }); }
      catch (cause) { setError(cause instanceof Error ? cause.message : ui('Room unavailable')); }
      setBusy(false); navigate('/games/eat-it');
    }
    setGame(null); setResult(null); setRoom(null);
  };
  if (game) return <EatItArena key={game.id} initial={game} localId={localId} room={roomCode ? room ?? undefined : undefined} onRoom={setRoom} onExit={() => void leave()} onFinished={state => { setResult(state); setGame(null); }} />;
  if (result) return <EatItResults result={result} localId={localId} online={!!roomCode} isHost={room?.host_id === user?.id} busy={busy} error={error} onReplay={roomCode ? () => void act('rematch') : solo} onLobby={() => void leave()} />;
  if (roomCode) return <main className="eat-page eat-room-page"><button className="eat-back" disabled={busy} onClick={() => void leave()}><ArrowLeft size={16} />{ui('Return to Lobby')}</button>
    {loading ? <p>{ui('Loading…')}</p> : !user ? <div className="eat-room-card"><Users size={32} /><h1>{ui('Sign in to play multiplayer')}</h1><Link className="eat-primary" to="/login">{ui('Sign in')}</Link></div> : !room ? <div className="eat-room-card"><h1>{ui('Joining room…')}</h1>{error && <p role="alert">{ui(error)}</p>}</div> : <section className="eat-room-card">
      <span className="eat-eyebrow">{ui('Eat It')} · {ui('Multiplayer')}</span><h1>{ui('Room')} <span className="eat-room-code">{room.room_code}</span></h1><p>{ui(room.settings.map === 'city' ? 'City' : 'Nature')} · {room.settings.count} {ui('Players')} · {ui('Last player standing')}</p>
      <div className="eat-room-share"><button className="eat-secondary" onClick={() => { void navigator.clipboard.writeText(`${location.origin}/games/eat-it/multiplayer/${room.room_code}`).then(() => setCopied(true)).catch(() => setError(ui('Copy the room code above to invite friends.'))); }}>{copied ? <Check size={16} /> : <Copy size={16} />}{ui(copied ? 'Copied' : 'Copy invite link')}</button><button className="eat-secondary" onClick={() => window.dispatchEvent(new Event('open-room-friends'))}><Users size={16} />{ui('Invite friends')}</button></div>
      <div className="eat-seats">{Array.from({ length: room.settings.count }, (_, i) => { const p = room.players[i]; return <div key={i}><div className={`eat-seat-avatar ${p ? '' : 'is-bot'}`}>{p ? p.name.slice(0, 1) : <Plus size={20} />}</div><strong>{p?.name ?? ui('Bot slot')}</strong><small>{p ? p.id === room.host_id ? ui('Host') : ui(p.ready ? 'Ready' : 'Not ready') : ui('Filled when the match starts')}</small></div>; })}</div>
      <p className="eat-lobby-note">{ui('Invite friends or start now. Empty seats become bots.')}</p>
      <div className="eat-result-actions"><button className="eat-secondary" disabled={busy} onClick={() => void act('ready')}><Check size={17} />{ui(room.players.find(p => p.id === user.id)?.ready ? 'Not ready' : 'Ready')}</button>{room.host_id === user.id && <button className="eat-primary" disabled={busy || !room.players.every(p => p.ready)} onClick={() => void act('start')}><Play size={17} />{ui('Start match')}</button>}</div>{error && <p className="eat-error" role="alert">{ui(error)}</p>}
    </section>}</main>;
  return <main className="eat-page"><div className="eat-menu-nav"><Link className="eat-back" to="/games"><ArrowLeft size={16} />{ui('All games')}</Link><span><span className="eat-live-dot" />{ui('2–8 players')}<i />{ui('Arcade survival')}</span></div>
    <section className="eat-hero"><div className="eat-hero-copy"><span className="eat-eyebrow"><Sparkles size={13} />{ui('Small circle. Big appetite.')}</span><h1>EAT<span>IT<span className="eat-title-dot">.</span></span></h1><p>{ui('A little snack. A bigger bite. A whole lot of trouble.')}<br /><span>{ui('Eat, grow, and be the last circle standing.')}</span></p><div className="eat-hero-tags"><span><Users size={14} />{ui('Friends & bots')}</span><span><Leaf size={14} />{ui('Two worlds')}</span><span><Trophy size={14} />{ui('One survivor')}</span></div></div>
      <div className="eat-hero-art"><img src="/images/eat-it.svg" alt={ui('Colorful circles chasing snacks in a city plaza')} /><div className="eat-art-label"><span className="eat-live-dot" />{ui('Your next snack is waiting.')}<ArrowUpRight size={17} /></div></div></section>
    <div className="eat-menu-grid"><section className="eat-setup"><div className="eat-section-title"><span>01</span><h2>{ui('Pick your playground')}</h2></div><div className="eat-map-options">{(['city', 'nature'] as const).map(id => <button key={id} onClick={() => setMap(id)} aria-pressed={map === id} className={`eat-map-card eat-map-${id} ${map === id ? 'selected' : ''}`}><div className="eat-map-preview"><span className="map-road" /><span className="map-building one" /><span className="map-building two" /><span className="map-building three" /><span className="map-snack">✦</span><span className="map-token" /><span className="eat-map-selected">{map === id ? <Check size={15} /> : <Plus size={15} />}</span></div><div><strong>{ui(id === 'city' ? 'City' : 'Nature')}</strong><span>{ui(id === 'city' ? 'Sidewalk snacks & street-side feasts' : 'Fresh fruit & forest adventures')}</span></div></button>)}</div>
      <div className="eat-section-title"><span>02</span><h2>{ui('Bring an appetite')}</h2></div><div className="eat-mode-switch"><button className={mode === 'solo' ? 'selected' : ''} aria-pressed={mode === 'solo'} onClick={() => setMode('solo')}><Play size={16} />{ui('Singleplayer')}</button><button className={mode === 'online' ? 'selected' : ''} aria-pressed={mode === 'online'} onClick={() => setMode('online')}><Users size={16} />{ui('Multiplayer')}</button></div>
      <div className="eat-count"><label htmlFor="eat-count">{ui('Players')}<small>{ui(mode === 'solo' ? 'You + a hungry bunch of bots' : 'Friends join first. Bots fill the rest.')}</small></label><select id="eat-count" value={count} onChange={e => setCount(Number(e.target.value))}>{Array.from({ length: 7 }, (_, i) => <option key={i} value={i + 2}>{i + 2}</option>)}</select></div>
      {mode === 'solo' ? <button className="eat-primary eat-start" onClick={solo}>{ui('Let’s eat')}<ChevronRight size={21} /></button> : user ? <><button className="eat-primary eat-start" onClick={() => void createRoom()} disabled={busy}>{ui('Create room')}<ArrowUpRight size={19} /></button><form className="eat-join" onSubmit={e => { e.preventDefault(); navigate(`/games/eat-it/multiplayer/${code}`); }}><input aria-label={ui('Room code')} placeholder={ui('Room code')} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} minLength={6} maxLength={6} required /><button className="eat-secondary" disabled={code.length !== 6}>{ui('Join room')}</button></form></> : <Link className="eat-primary eat-start" to="/login">{ui('Sign in to play multiplayer')}<ArrowUpRight size={18} /></Link>}
      {error && <p className="eat-error" role="alert">{ui(error)}</p>}<p className="eat-setup-foot">{ui('Last player standing · No respawns · Plenty of snacks')}</p>
    </section><aside className="eat-guide"><div className="eat-section-title"><span>?</span><h2>{ui('A bite-sized guide')}</h2></div><div className="eat-guide-item"><b>01</b><div><h3>{ui('Follow your mouth')}</h3><p>{ui('Move with WASD, arrow keys, or drag. Face a snack to pull it into your mouth.')}</p></div></div><div className="eat-guide-item"><b>02</b><div><h3>{ui('Snack. Grow. Repeat.')}</h3><p>{ui('Start small. Bigger bites unlock as you grow. Large circles move a little slower.')}</p></div></div><div className="eat-guide-item"><b>03</b><div><h3>{ui('Make the big bite')}</h3><p>{ui('Be {percent}% larger in radius to eat another player. Only the mouth is dangerous. Dodge behind it!').replace('{percent}', String(Math.round((EAT.eating.playerEatRadiusRatio - 1) * 100)))}</p></div></div>
      <div className="eat-power-guide"><h3>{ui('A little extra advantage')}</h3><div><span><Zap />{ui('Speed Boost')}<small>{EAT.powerups.speed.duration}s</small></span><span><Shield />{ui('Shield')}<small>{EAT.powerups.shield.duration}s</small></span><span><b>∩</b>{ui('Magnet')}<small>{EAT.powerups.magnet.duration}s</small></span><span><Sparkles />{ui('Growth Boost')}<small>{ui('Permanent +{mass} mass').replace('{mass}', String(EAT.powerups.growth.mass))}</small></span></div></div><p className="eat-ring-tip">{ui('After {seconds} seconds, the arena slowly closes. Stay inside the ring.').replace('{seconds}', String(EAT.match.zoneStart))}</p>
    </aside></div><footer className="eat-menu-footer"><span>{ui('Good things come to those who eat.')}</span><span>◔ EAT IT</span></footer>
  </main>;
}
