import { gameUi } from "../../../i18n/gameUi.ts";
import ObjectCollection from './ObjectCollection';
import GameXpReward from '@/components/games/GameXpReward';
import { matchDuration } from '../../../games/eat-it/config';
import { reviewSettings, reviewStats, timelineLabel } from '../../../games/eat-it/review';
import { Link } from 'react-router-dom';
import { ArrowLeft, Crown, Play } from 'lucide-react';
import { ui, useUiLanguage } from '../../../i18n/ui';
import type { GameState } from '../../../games/eat-it/types';

type Props = { result: GameState; localId: string; online: boolean; isHost: boolean; busy: boolean; error: string; onReplay: () => void; onLobby: () => void };
export default function EatItResults({ result, localId, online, isHost, busy, error, onReplay, onLobby }: Props) {
  useUiLanguage();
  const local = result.players.find(p => p.id === localId)!, winner = result.players.find(p => p.id === result.winnerId);
  const stats = [
    ['Placement', local.placement === null ? '—' : `#${local.placement}`], ['Growth', Math.round(local.mass).toLocaleString()], ['Score', local.score],
    ['Players eaten', local.playersEaten], ['Food eaten', local.foodEaten], ['Power-ups collected', local.powerupsCollected],
    ['Match duration', `${Math.floor(result.time / 60)}:${String(Math.floor(result.time % 60)).padStart(2, '0')}`],
  ] as const;
  return <main className="eat-page eat-result-page">
    <Link className="eat-back" to="/games"><ArrowLeft size={16} />{ui('Return to Games')}</Link>
    <div className="eat-results">
      <div className="eat-result-crown"><Crown size={40} /></div>
      <span className="eat-eyebrow">{ui(result.result === 'tie' ? 'Tie' : result.winnerId === localId ? 'Winner' : 'Game Over')}</span>
      <h1>{gameUi(result.result === 'tie' ? ui('Tie') : winner?.name ?? ui('Game Over'))}</h1><p>{ui(result.hell ? 'Hell Sudden Death' : result.time >= matchDuration(result) ? 'Size ranking' : 'Last player standing')}</p>
      <div className="eat-result-stats">{stats.map(([label, value]) => <div key={label}><span>{ui(label)}</span><strong>{gameUi(value)}</strong></div>)}</div>
      <GameXpReward amount={online ? 100 : 0} />
      <ObjectCollection counts={local.stats?.collected ?? {}} />
      <div className="eat-finish-order">{[...result.players].sort((a, b) => (a.placement ?? 9) - (b.placement ?? 9)).map(p =>
        <div key={p.id} className={p.id === localId ? 'is-you' : ''}><span>#{gameUi(p.placement ?? '—')}</span><i style={{ background: p.color }} /><b>{p.name}</b><span>{gameUi(Math.round(p.mass).toLocaleString())}</span></div>,
      )}</div>
      <section className="eat-review"><h2>{ui('Match Settings')}</h2><dl>{reviewSettings(result.settings).map(([label, value]) => <div key={label} style={{ display: 'contents' }}><dt>{ui(label)}</dt><dd>{ui(value)}</dd></div>)}</dl></section><section className="eat-review"><h2>{ui('Game Review')}</h2>{result.players.map(p => <details key={p.id} open={p.id === localId}><summary>{p.name} · {ui('Placement')} #{gameUi(p.placement ?? '—')}</summary>{p.id !== localId && <ObjectCollection counts={p.stats?.collected ?? {}} />}<dl>{reviewStats(result, p).map(([label, value]) => <div key={label} style={{ display: 'contents' }}><dt>{ui(label)}</dt><dd>{ui(value)}</dd></div>)}</dl></details>)}
      <h3>{ui('Normal Phase')}</h3><ol className="eat-timeline">{(result.timeline ?? []).filter(e => e.at < (result.hell?.startedAt ?? Infinity) && timelineLabel[e.type]).map(e => <li key={e.id}>{gameUi(Math.floor(e.at))}s · {ui(timelineLabel[e.type])} {result.players.find(p => p.id === e.playerId)?.name}</li>)}</ol>
      {result.hell && <><h3>{ui('Hell Sudden Death')}</h3><ol className="eat-timeline">{(result.timeline ?? []).filter(e => e.at >= result.hell!.startedAt && timelineLabel[e.type]).map(e => <li key={e.id}>{gameUi(Math.max(0, Math.floor(e.at - result.hell!.startedAt)))}s · {ui(timelineLabel[e.type])} {result.players.find(p => p.id === e.playerId)?.name}</li>)}</ol></>}
      </section>
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
