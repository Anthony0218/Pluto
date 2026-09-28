import { Link } from 'react-router-dom';
import { ArrowLeft, Crown, Play } from 'lucide-react';
import { ui, useUiLanguage } from '../../../i18n/ui';
import type { GameState } from '../../../games/eat-it/types';

type Props = { result: GameState; localId: string; online: boolean; isHost: boolean; busy: boolean; error: string; onReplay: () => void; onLobby: () => void };
export default function EatItResults({ result, localId, online, isHost, busy, error, onReplay, onLobby }: Props) {
  useUiLanguage();
  const local = result.players.find(p => p.id === localId)!, winner = result.players.find(p => p.id === result.winnerId);
  const stats = [
    ['Placement', `#${local.placement}`], ['Final mass', `${Math.round(local.mass)}g`], ['Score', local.score],
    ['Players eaten', local.playersEaten], ['Food eaten', local.foodEaten], ['Power-ups collected', local.powerupsCollected],
    ['Match duration', `${Math.floor(result.time / 60)}:${String(Math.floor(result.time % 60)).padStart(2, '0')}`],
  ] as const;
  return <main className="eat-page eat-result-page">
    <Link className="eat-back" to="/games"><ArrowLeft size={16} />{ui('Return to Games')}</Link>
    <div className="eat-results">
      <div className="eat-result-crown"><Crown size={40} /></div>
      <span className="eat-eyebrow">{ui(local.placement === 1 ? 'Winner' : 'Game Over')}</span>
      <h1>{winner?.name}</h1><p>{ui('Last player standing')}</p>
      <div className="eat-result-stats">{stats.map(([label, value]) => <div key={label}><span>{ui(label)}</span><strong>{value}</strong></div>)}</div>
      <div className="eat-finish-order">{[...result.players].sort((a, b) => (a.placement ?? 9) - (b.placement ?? 9)).map(p =>
        <div key={p.id} className={p.id === localId ? 'is-you' : ''}><span>#{p.placement}</span><i style={{ background: p.color }} /><b>{p.name}</b><span>{Math.round(p.mass)}g</span></div>,
      )}</div>
      <div className="eat-result-actions">
        {!online ? <button className="eat-primary" onClick={onReplay}><Play size={17} />{ui('Play Again')}</button>
          : isHost ? <button className="eat-primary" disabled={busy} onClick={onReplay}>{ui('Return to Lobby')}</button>
            : <p>{ui('Waiting for the host to start a rematch')}</p>}
        <button className="eat-secondary" disabled={busy} onClick={onLobby}>{ui(online ? 'Leave room' : 'Return to Lobby')}</button>
      </div>
      {!online && <small className="eat-result-note">{ui('Bot matches are practice. Online results appear in your profile.')}</small>}
      {error && <p role="alert">{ui(error)}</p>}
    </div>
  </main>;
}
