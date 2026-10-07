import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { modeById } from "../../games/atlas/modeCatalog";
import { gameWinner, seriesLabel, seriesWins, type SeriesResult } from "../../games/atlas/randomSeries";

export function AtlasRandomSeriesResults({ order, results, players, complete, solo = false, onNext, onAgain }: {
  order: string[]; results: SeriesResult[]; players: { id: string; name: string }[]; complete: boolean; solo?: boolean; onNext: () => void; onAgain: () => void;
}) {
  const wins = seriesWins(results, players.map(player => player.id));
  const winner = gameWinner(wins);
  const nameOf = (id: string) => players.find(player => player.id === id)?.name ?? "Player";
  return <main className="atlas-page atlas-center atlas-random-results">
    <div className="atlas-result-orbit"><Trophy /></div>
    <span className="atlas-eyebrow">Random modes · {seriesLabel(order.length)}</span>
    <h1>{complete ? solo ? "Expedition complete" : winner ? `${nameOf(winner)} wins the series` : "Series drawn" : `Game ${results.length} complete`}</h1>
    {!solo && <p className="atlas-result-score" aria-label="Series score">{players.map(player => wins[player.id]).join(" – ")} <small>game wins</small></p>}
    <section className="atlas-series" aria-label="Random mode series results">
      <div className="atlas-series-players">{players.map(player => <div key={player.id}><strong>{player.name}</strong><span>{solo ? `${results.reduce((sum, result) => sum + (result.scores[player.id] ?? 0), 0).toLocaleString()} total points` : `${wins[player.id]} game wins`}</span></div>)}</div>
      <ol className="atlas-series-order">{order.map((id, index) => {
        const result = results[index];
        return <li key={id} className={!complete && index === results.length ? "is-current" : ""}><span><small>Game {index + 1}</small><strong>{modeById(id)?.title}</strong>{result && <small>{players.map(player => `${player.name}: ${(result.scores[player.id] ?? 0).toLocaleString()}`).join(" · ")}</small>}</span><em>{result ? solo ? "Completed" : result.winnerId ? `${nameOf(result.winnerId)} won` : "Draw" : complete ? "Not needed" : "Up next"}</em></li>;
      })}</ol>
    </section>
    <div className="atlas-result-actions">{complete ? <button type="button" onClick={onAgain}>Play another series</button> : <button type="button" onClick={onNext}>Next game · {modeById(order[results.length])?.title}</button>}<Link to="/games/atlas-arena">Atlas Arena</Link></div>
  </main>;
}
