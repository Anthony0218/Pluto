import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Pause, Play, ScanSearch, X } from "lucide-react";
import { applyGoMove, isLegalGoMove, type GoState } from "../../games/go/rules";
import { analyzeGo, goCoordinate, goMoveQuality, goPointLoss, parseGoCoordinate, replayGo, type GoAnalysis } from "../../games/go/analysis";
import { ReviewQualityIcon } from "../chess/singleplayer/ReviewQualityBadge";
import GoBoard from "./GoBoard";

export default function GoGameReview({ game }: { game: GoState }) {
  useGameLanguage();
  if (!game.moveHistory.length) return <section className="go-review" role="status"><h2>{gameUi("Game Review")}</h2><p className="go-muted">{gameUi("Play a move before reviewing the game.")}</p></section>;
  return <FinishedGoGameReview game={game} />;
}

function FinishedGoGameReview({ game }: { game: GoState }) {
  useGameLanguage();
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
    // The second pass ends the game and is scored exactly, rather than by the
    // engine. Comparing that exact score with an estimate is not a move review.
    const loss = before && after && move.type !== "resign" && !(move.type === "pass" && frames[turn + 1].status === "finished") ? goPointLoss(before, after, move.player) : null;
    const topMove = before?.moveInfos.find(candidate => candidate.order === 0)?.move;
    return { move, turn: turn + 1, loss, quality: loss === null ? null : goMoveQuality(loss, topMove === goCoordinate(move, game.boardSize)) };
  });
  const selected = rows[index - 1], evaluation = analyses[index];
  const alternatives = analyses[Math.max(0, index - 1)]?.moveInfos.slice().sort((a, b) => a.order - b.order).slice(0, 3) ?? [];
  const recommended = alternatives[0]?.move;
  const critical = rows.filter(row => row.loss !== null && row.loss >= 5).sort((a, b) => b.loss! - a.loss!).slice(0, 5);
  const board = variation ? variationFrames[Math.min(variationStep, variationFrames.length - 1)] : frames[index];
  const filtered = rows.filter(row => filter === "all" || (filter === "mistakes" ? row.loss !== null && row.loss >= 5 : filter === "captures" ? !!row.move.captured : row.move.player === filter));
  return <div className="go-review">
    <div className="go-review-grid">
      <aside className="go-review-overview">
        <h2>{gameUi("Game Review")}</h2>
        {(["black", "white"] as const).map(color => {
          const evaluated = rows.filter(row => row.move.player === color && row.loss !== null);
          return <div key={color} className="go-review-summary"><span className="capitalize">{gameUi(color)}</span><strong>{gameUi(evaluated.length ? (evaluated.reduce((sum, row) => sum + row.loss!, 0) / evaluated.length).toFixed(1) : "--")}</strong><span>{gameUi("Average points lost · ")}{gameUi(evaluated.length)}{gameUi(" moves reviewed")}</span></div>;
        })}
        <div className="go-review-summary"><strong>{gameUi(game.boardSize)} × {gameUi(game.boardSize)}</strong><span>{gameUi("Chinese area · ")}{gameUi(game.komi)}{gameUi(" komi · Positional superko")}</span><p className="go-muted">{gameUi(game.result ?? "Game in progress")}</p></div>
        <div>
          <button className="go-action" disabled={running || !game.moveHistory.length} onClick={() => void analyze()}><ScanSearch size={16} />{gameUi(running ? `Analysing ${Object.keys(analyses).length}/${frames.length}` : "Analyse game")}</button>
          {running && <button className="go-action" onClick={() => { controller.current?.abort(); setRunning(false); }}><X size={16} />{gameUi(" Cancel")}</button>}
          <p className="go-muted">{gameUi("Browser KataGo · b10 · Up to 64 visits / 3 seconds")}</p>
          <p className="go-muted">{gameUi("Lightweight analysis. Estimates may differ from full-strength KataGo.")}</p>
          {error && <p role="alert" className="go-engine-error">{gameUi(error)}</p>}
          {!game.moveHistory.length && <p className="go-muted">{gameUi("Play a game to review its moves.")}</p>}
          <p className="go-muted">{gameUi("Go-style review: AI Move matches KataGo’s top choice. Other moves use estimated points lost: Good <2 · Inaccuracy <5 · Mistake <10 · Blunder ≥10. The final scoring pass is unlabelled.")}</p>
        </div>
        {critical.length > 0 && <div><h3>{gameUi("Critical moments")}</h3>{critical.map(row => <button className="go-move-row" key={row.turn} onClick={() => select(row.turn)}><small>{gameUi(row.turn)}</small><span>{gameUi(goCoordinate(row.move, game.boardSize))}</span><span className="go-quality" data-quality={row.quality}><ReviewQualityIcon quality={row.quality === "AI Move" ? "Best" : row.quality!} /> {gameUi(row.quality)}</span></button>)}</div>}
      </aside>
      <section>
        <GoBoard state={board} disabled onMove={() => {}} help />
        <div className="go-controls">
          <button aria-label={gameUi("First move")} title={gameUi("First move")} onClick={() => select(0)} disabled={!index}><ChevronsLeft size={18} /></button>
          <button aria-label={gameUi("Previous move")} title={gameUi("Previous move")} onClick={() => select(index - 1)} disabled={!index}><ChevronLeft size={18} /></button>
          <button aria-label={gameUi(playing ? "Pause replay" : "Play replay")} title={gameUi(playing ? "Pause replay" : "Play replay")} disabled={frames.length === 1} onClick={() => { setVariation(null); if (index === frames.length - 1) setIndex(0); setPlaying(!playing); }}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
          <button aria-label={gameUi("Next move")} title={gameUi("Next move")} onClick={() => select(index + 1)} disabled={index === frames.length - 1}><ChevronRight size={18} /></button>
          <button aria-label={gameUi("Last move")} title={gameUi("Last move")} onClick={() => select(frames.length - 1)} disabled={index === frames.length - 1}><ChevronsRight size={18} /></button>
          <select aria-label={gameUi("Playback speed")} value={speed} onChange={event => setSpeed(Number(event.target.value))}><option value={2000}>0.5×</option><option value={1000}>1×</option><option value={500}>2×</option></select>
        </div>
        <input type="range" aria-label={gameUi("Review move")} min={0} max={frames.length - 1} value={index} onChange={event => select(Number(event.target.value))} />
        <p className="go-muted">{gameUi("Move ")}{gameUi(index)} / {gameUi(game.moveHistory.length)}{gameUi(variation ? ` · Alternative ${variationStep}/${variationFrames.length - 1}` : "")}</p>
        {variation && <button className="go-action" onClick={() => setVariation(null)}>{gameUi("Return to played move")}</button>}
        <div className="go-chart" aria-label={gameUi("Black win probability by move")}>{frames.map((_, turn) => <button key={turn} aria-label={gameUi(`Move ${turn}: ${analyses[turn] ? Math.round(analyses[turn].rootInfo.winrate * 100) + "% Black" : "not analysed"}`)} aria-current={turn === index} onClick={() => select(turn)}><i style={{ height: analyses[turn] ? (analyses[turn].rootInfo.winrate * 100) + "%" : "0%" }} /></button>)}</div>
        <p className="go-muted">{gameUi("Black win probability")}</p>
      </section>
      <aside>
        <h2>{gameUi(index ? `${selected.move.player === "black" ? "Black" : "White"} · ${goCoordinate(selected.move, game.boardSize)}` : "Starting position")}</h2>
        {selected && <p><span className="go-quality" data-quality={selected.quality}>{selected.quality && <ReviewQualityIcon quality={selected.quality === "AI Move" ? "Best" : selected.quality} />} {gameUi(selected.quality ?? "Not analysed")}</span>{selected.loss !== null && <span className="go-muted"> · {gameUi(selected.loss.toFixed(1))}{gameUi(" estimated points lost")}</span>}</p>}
        {selected && <button type="button" className="go-move-row" aria-pressed={!variation} onClick={() => { setPlaying(false); setVariation(null); }}><span>{gameUi("Current move · ")}{gameUi(goCoordinate(selected.move, game.boardSize))}</span><small>{gameUi(variation ? "Click to show" : "On the board")}</small></button>}
        {selected && recommended && <p className="go-muted">{gameUi("Recommended: ")}{gameUi(recommended)}</p>}
        <p className="go-muted">{gameUi(selected?.move.type === "resign" ? "Game ended by resignation." : selected?.move.type === "pass" ? "The player passed." : selected?.move.captured ? `${selected.move.captured} stone(s) captured on this move.` : index ? "No captures on this move." : "Black plays first.")}</p>
        {evaluation && <><h3>{gameUi("Estimated lead: ")}{gameUi(evaluation.rootInfo.scoreLead >= 0 ? "Black" : "White")} +{gameUi(Math.abs(evaluation.rootInfo.scoreLead).toFixed(1))}</h3><div className="go-winbar"><span style={{ width: (evaluation.rootInfo.winrate * 100) + "%" }} /></div><p className="go-muted">{gameUi("Black ")}{gameUi(Math.round(evaluation.rootInfo.winrate * 100))}{gameUi("% · White ")}{gameUi(Math.round((1 - evaluation.rootInfo.winrate) * 100))}%</p></>}
        <h3>{gameUi(index ? "Alternatives before this move" : "Opening candidates")}</h3>
        {gameUi(alternatives.length ? alternatives.map((line, rank) => <button key={line.move} type="button" className="go-move-row" aria-pressed={variation?.[0] === line.move} onClick={() => { setPlaying(false); setVariation(line.pv[0] === line.move ? line.pv : [line.move, ...line.pv]); setVariationStep(1); }}><span>{gameUi(rank + 1)}. {gameUi(line.move)}</span><small>{gameUi(variation?.[0] === line.move ? "On the board" : "Click to show")} · {gameUi(line.visits)}{gameUi(" visits")}</small></button>) : <p className="go-muted">{gameUi("Run analysis to see candidate moves.")}</p>)}
        {variation && <div className="go-controls"><button type="button" aria-label={gameUi("Previous variation move")} disabled={variationStep <= 1} onClick={() => setVariationStep(step => step - 1)}><ChevronLeft size={16} /></button><span>{gameUi("Alternative ")}{gameUi(variationStep)}/{gameUi(variationFrames.length - 1)}</span><button type="button" aria-label={gameUi("Next variation move")} disabled={variationStep >= variationFrames.length - 1} onClick={() => setVariationStep(step => step + 1)}><ChevronRight size={16} /></button></div>}
        <h3>{gameUi("Moves")}</h3>
        <select aria-label={gameUi("Filter moves")} value={filter} onChange={event => setFilter(event.target.value)}><option value="all">{gameUi("All moves")}</option><option value="black">{gameUi("Black")}</option><option value="white">{gameUi("White")}</option><option value="mistakes">{gameUi("Mistakes")}</option><option value="captures">{gameUi("Captures")}</option></select>
        <div className="go-move-list">{filtered.map(row => <button key={row.turn} className="go-move-row" aria-current={index === row.turn} onClick={() => select(row.turn)}><small>{gameUi(row.turn)}</small><span>{gameUi(row.move.player === "black" ? "B" : "W")} {gameUi(goCoordinate(row.move, game.boardSize))}</span><span className="go-quality" data-quality={row.quality}>{row.quality && <ReviewQualityIcon quality={row.quality === "AI Move" ? "Best" : row.quality} />}{gameUi(row.quality ?? (row.move.captured ? `+${row.move.captured}` : "--"))}</span></button>)}</div>
      </aside>
    </div>
  </div>;
}
