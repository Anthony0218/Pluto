import { Link } from "react-router-dom";
import { useRef, useState } from "react";
import { AtlasResultHero } from "./AtlasResultHero";
import { modeById } from "../../games/atlas/modeCatalog";
import { gameWinner, seriesLabel, seriesWins, type SeriesResult } from "../../games/atlas/randomSeries";

export function AtlasRandomSeriesProgress({ length, index }: { length: number; index: number }) {
  return <div className="atlas-random-progress" role="status"><strong>Random series · {seriesLabel(length)}</strong><span>Game {index + 1} of {length}</span></div>;
}

export function AtlasRandomSeriesResults({ order, results, players, complete, solo = false, onNext, onAgain }: {
  order: string[]; results: SeriesResult[]; players: { id: string; name: string }[]; complete: boolean; solo?: boolean; onNext: () => void; onAgain: () => void;
}) {
  const [continued, setContinued] = useState<string[]>([]);
  const continuedRef = useRef(continued);
  const wins = seriesWins(results, players.map(player => player.id));
  const winner = gameWinner(wins);
  const last = results.at(-1);
  const nameOf = (id: string) => players.find(player => player.id === id)?.name ?? "Player";
  const continuePlayer = (id: string) => {
    if (continuedRef.current.includes(id)) return;
    const next = [...continuedRef.current, id];
    continuedRef.current = next;
    setContinued(next);
    if (next.length === players.length) onNext();
  };
  return <main className="atlas-page atlas-center atlas-random-results">
    <AtlasResultHero eyebrow={`Random modes · ${seriesLabel(order.length)}`} title={complete ? solo ? "Expedition complete" : winner ? `${nameOf(winner)} wins${order.length === 1 ? "" : " the series"}` : order.length === 1 ? "Game drawn" : "Series drawn" : solo ? `Game ${results.length} complete` : last?.winnerId ? `${nameOf(last.winnerId)} wins game ${results.length}` : `Game ${results.length} drawn`} />
    {!solo && <p className="atlas-result-score" aria-label="Series score">{players.map(player => wins[player.id]).join(" – ")} <small>game wins</small></p>}
    {!complete && <><p>Next game · {modeById(order[results.length])?.title}</p>{!solo && <p className="atlas-ready-count" role="status">{continued.length}/{players.length} are ready · Both players must press Continue.</p>}</>}
    <div className="atlas-result-actions">{complete ? <button type="button" onClick={onAgain}>Replay</button> : solo ? <button type="button" onClick={onNext}>Continue</button> : players.map(player => <button key={player.id} type="button" disabled={continued.includes(player.id)} onClick={() => continuePlayer(player.id)}>{continued.includes(player.id) ? `${player.name} is ready` : `Continue · ${player.name}`}</button>)}<Link to="/games/atlas-arena">Back to menu</Link></div>
    <section className="atlas-series" aria-label="Random mode series results">
      <div className="atlas-series-players">{players.map(player => <div key={player.id}><strong>{player.name}</strong><span>{solo ? `${results.reduce((sum, result) => sum + (result.scores[player.id] ?? 0), 0).toLocaleString()} total points` : `${wins[player.id]} game wins`}</span></div>)}</div>
      <ol className="atlas-series-order">{order.map((id, index) => {
        const result = results[index];
        return <li key={id} className={!complete && index === results.length ? "is-current" : ""}><span><small>Game {index + 1}</small><strong>{modeById(id)?.title}</strong>{result && <small>{players.map(player => `${player.name}: ${(result.scores[player.id] ?? 0).toLocaleString()}`).join(" · ")}</small>}</span><em>{result ? solo ? "Completed" : result.winnerId ? `${nameOf(result.winnerId)} won` : "Draw" : complete ? "Not needed" : "Up next"}</em></li>;
      })}</ol>
    </section>
  </main>;
}
