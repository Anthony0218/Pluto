import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pause, Play, ScanSearch, X } from "lucide-react";
import { applyGoMove, isLegalGoMove, type GoState } from "../../games/go/rules";
import { analyzeGo, goCoordinate, goMoveQuality, goPointLoss, parseGoCoordinate, replayGo, type GoAnalysis } from "../../games/go/analysis";
import { canReviewGoGame } from "../../games/go/reviewAvailability";
import GoBoard from "./GoBoard";

export default function GoGameReview({ game }: { game: GoState }) {
  if (!canReviewGoGame(game)) return <section className="go-review" role="status"><h2>Game Review</h2><p className="go-muted">Analysis is available after the game ends.</p></section>;
  return <FinishedGoGameReview game={game} />;
}

function FinishedGoGameReview({ game }: { game: GoState }) {
  const frames = useMemo(() => replayGo(game), [game]);
  const [index, setIndex] = useState(0), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(1000);
  const [analyses, setAnalyses] = useState<Record<number, GoAnalysis>>({});
  const [running, setRunning] = useState(false), [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [variation, setVariation] = useState<string[] | null>(null), [variationStep, setVariationStep] = useState(0);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!playing) return;
    if (index >= frames.length - 1) return;
    const timer = window.setTimeout(() => { setIndex(value => value + 1); if (index + 1 >= frames.length - 1) setPlaying(false); }, speed);
    return () => window.clearTimeout(timer);
  }, [playing, index, frames.length, speed]);
  const variationFrames = useMemo(() => {
    if (!variation) return [];
    const result = [frames[Math.max(0, index - 1)]];
    for (const coordinate of variation) {
      try {
        const move = parseGoCoordinate(coordinate, game.boardSize);
        if (!isLegalGoMove(result.at(-1)!, move)) break;
        result.push(applyGoMove(result.at(-1)!, move));
      } catch { break; }
    }
    return result;
  }, [variation, frames, index, game.boardSize]);
  useEffect(() => {
    if (!variation || variationStep >= variationFrames.length - 1) return;
    const timer = window.setTimeout(() => setVariationStep(value => value + 1), speed);
    return () => window.clearTimeout(timer);
  }, [variation, variationStep, variationFrames.length, speed]);
  function select(value: number) { setIndex(value); setPlaying(false); setVariation(null); }
  async function analyze() {
    controller.current?.abort();
    const task = new AbortController(); controller.current = task;
    setError(""); setRunning(true);
    try {
      for (let turn = 0; turn < frames.length; turn++) {
        if (task.signal.aborted) return;
        if (analyses[turn]) continue;
        const result = await analyzeGo(frames[turn], task.signal);
        if (!task.signal.aborted) setAnalyses(current => ({ ...current, [turn]: result }));
      }
    } catch (reason) { if (!task.signal.aborted) setError(reason instanceof Error ? reason.message : "Analysis failed."); }
    finally { if (controller.current === task) setRunning(false); }
  }
  const rows = game.moveHistory.map((move, turn) => {
    const before = analyses[turn], after = analyses[turn + 1];
    const loss = before && after && move.type !== "resign" ? goPointLoss(before, after, move.player) : null;
    return { move, turn: turn + 1, loss, quality: loss === null ? null : goMoveQuality(loss) };
  });
  const selected = rows[index - 1], evaluation = analyses[index];
  const alternatives = analyses[Math.max(0, index - 1)]?.moveInfos.slice().sort((a, b) => a.order - b.order).slice(0, 3) ?? [];
  const board = variation ? variationFrames[Math.min(variationStep, variationFrames.length - 1)] : frames[index];
  const filtered = rows.filter(row => filter === "all" || (filter === "mistakes" ? row.loss !== null && row.loss >= 5 : filter === "captures" ? !!row.move.captured : row.move.player === filter));
  return <div className="go-review">
    <div className="go-review-grid">
      <aside className="go-review-overview">
        <h2>Game Review</h2>
        {(["black", "white"] as const).map(color => {
          const evaluated = rows.filter(row => row.move.player === color && row.loss !== null);
          return <div key={color} className="go-review-summary"><span className="capitalize">{color}</span><strong>{evaluated.length ? (evaluated.reduce((sum, row) => sum + row.loss!, 0) / evaluated.length).toFixed(1) : "--"}</strong><span>Average points lost · {evaluated.length} moves reviewed</span></div>;
        })}
        <div className="go-review-summary"><strong>{game.boardSize} × {game.boardSize}</strong><span>Chinese area · 6.5 komi · Positional superko</span><p className="go-muted">{game.result ?? "Game in progress"}</p></div>
        <div>
          <button className="go-action" disabled={running || !game.moveHistory.length} onClick={() => void analyze()}><ScanSearch size={16} />{running ? `Analysing ${Object.keys(analyses).length}/${frames.length}` : "Analyse game"}</button>
          {running && <button className="go-action" onClick={() => { controller.current?.abort(); setRunning(false); }}><X size={16} /> Cancel</button>}
          <p className="go-muted">Browser KataGo · b10 · Up to 64 visits / 3 seconds</p>
          <p className="go-muted">Lightweight analysis. Estimates may differ from full-strength KataGo.</p>
          {error && <p role="alert" className="go-engine-error">{error}</p>}
          {!game.moveHistory.length && <p className="go-muted">Play a game to review its moves.</p>}
        </div>
      </aside>
      <section>
        <GoBoard state={board} disabled onMove={() => {}} help />
        <div className="go-controls">
          <button aria-label="First move" title="First move" onClick={() => select(0)} disabled={!index}><ChevronsLeft size={18} /></button>
          <button aria-label="Previous move" title="Previous move" onClick={() => select(index - 1)} disabled={!index}><ChevronLeft size={18} /></button>
          <button aria-label={playing ? "Pause replay" : "Play replay"} title={playing ? "Pause replay" : "Play replay"} disabled={frames.length === 1} onClick={() => { setVariation(null); if (index === frames.length - 1) setIndex(0); setPlaying(!playing); }}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
          <button aria-label="Next move" title="Next move" onClick={() => select(index + 1)} disabled={index === frames.length - 1}><ChevronRight size={18} /></button>
          <button aria-label="Last move" title="Last move" onClick={() => select(frames.length - 1)} disabled={index === frames.length - 1}><ChevronsRight size={18} /></button>
          <select aria-label="Playback speed" value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={2000}>0.5×</option><option value={1000}>1×</option><option value={500}>2×</option></select>
        </div>
        <input type="range" aria-label="Review move" min={0} max={frames.length - 1} value={index} onChange={event => select(Number(event.target.value))} />
        <p className="go-muted">Move {index} / {game.moveHistory.length}{variation ? ` · Alternative ${variationStep}/${variationFrames.length - 1}` : ""}</p>
        {variation && <button className="go-action" onClick={() => setVariation(null)}>Return to played move</button>}
        <div className="go-chart" aria-label="Black win probability by move">{frames.map((_, turn) => <button key={turn} aria-label={`Move ${turn}: ${analyses[turn] ? Math.round(analyses[turn].rootInfo.winrate * 100) + "% Black" : "not analysed"}`} aria-current={turn === index} onClick={() => select(turn)}><i style={{ height: analyses[turn] ? (analyses[turn].rootInfo.winrate * 100) + "%" : "0%" }} /></button>)}</div>
        <p className="go-muted">Black win probability</p>
      </section>
      <aside>
        <h2>{index ? `${selected.move.player === "black" ? "Black" : "White"} · ${goCoordinate(selected.move, game.boardSize)}` : "Starting position"}</h2>
        {selected && <p><span className="go-quality" data-quality={selected.quality}>{selected.quality ?? "Not analysed"}</span>{selected.loss !== null && <span className="go-muted"> · {selected.loss.toFixed(1)} points lost</span>}</p>}
        <p className="go-muted">{selected?.move.type === "resign" ? "Game ended by resignation." : selected?.move.type === "pass" ? "The player passed." : selected?.move.captured ? `${selected.move.captured} stone(s) captured on this move.` : index ? "No captures on this move." : "Black plays first."}</p>
        {evaluation && <><h3>Estimated lead: {evaluation.rootInfo.scoreLead >= 0 ? "Black" : "White"} +{Math.abs(evaluation.rootInfo.scoreLead).toFixed(1)}</h3><div className="go-winbar"><span style={{ width: (evaluation.rootInfo.winrate * 100) + "%" }} /></div><p className="go-muted">Black {Math.round(evaluation.rootInfo.winrate * 100)}% · White {Math.round((1 - evaluation.rootInfo.winrate) * 100)}%</p></>}
        <h3>{index ? "Alternatives before this move" : "Opening candidates"}</h3>
        {alternatives.length ? alternatives.map(line => <button key={line.move} className="go-move-row" onClick={() => { setPlaying(false); setVariation(line.pv.length ? line.pv : [line.move]); setVariationStep(0); }}><Play size={14} /><span>{line.move}</span><small>{line.visits} visits</small></button>) : <p className="go-muted">Run analysis to see candidate moves.</p>}
        <h3>Moves</h3>
        <select aria-label="Filter moves" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All moves</option><option value="black">Black</option><option value="white">White</option><option value="mistakes">Mistakes</option><option value="captures">Captures</option></select>
        <div className="go-move-list">{filtered.map(row => <button key={row.turn} className="go-move-row" aria-current={index === row.turn} onClick={() => select(row.turn)}><small>{row.turn}</small><span>{row.move.player === "black" ? "B" : "W"} {goCoordinate(row.move, game.boardSize)}</span><span className="go-quality" data-quality={row.quality}>{row.quality ?? (row.move.captured ? `+${row.move.captured}` : "--")}</span></button>)}</div>
      </aside>
    </div>
  </div>;
}
