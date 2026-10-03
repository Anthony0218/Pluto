import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ArrowDown, ChevronDown, ChevronRight, ChevronUp, GripVertical, Lock } from "lucide-react";
import { STAT_RANKING } from "../../../games/atlas/trials/config";
import { formatCountryStat, getCountryStat, STATS } from "../../../games/atlas/trials/countryStats";
import { createRankingRun, lockInRanking, nextRankingRound, reorderRanking } from "../../../games/atlas/trials/statRanking";
import { CountryFlag, GameOverPanel, ScoreBurst, TrialFeedback, TrialShell, type TrialModeProps } from "./TrialsUI";
import { useRecordWhenOver } from "./useTrialTimers";

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const move = (order: string[], from: number, to: number) => { const next = [...order]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; };

/**
 * Pointer-driven reorderable list (mouse, pen and touch share one code path). Rows have a fixed height, so the
 * slot under the dragged row is simple arithmetic; other rows glide to their new slot with a FLIP animation.
 */
function SortableList({ order, onReorder, disabled, renderRow, label }: { order: string[]; onReorder: (order: string[]) => void; disabled: boolean; renderRow: (id: string, index: number) => ReactNode; label: string }) {
  const listRef = useRef<HTMLOListElement>(null);
  const positions = useRef(new Map<string, number>());
  const settle = useRef<{ id: string; offset: number } | null>(null);
  /** `top` follows the pointer; `first`/`pitch` describe the fixed slot grid measured when the drag began. */
  type Drag = { id: string; first: number; pitch: number; top: number };
  const [dragging, setDragging] = useState<Drag | null>(null);
  // Pointer events can outrun React renders, so handlers read the live drag and order from refs.
  const live = useRef<(Drag & { pointerId: number; grab: number }) | null>(null);
  const liveOrder = useRef(order);
  useLayoutEffect(() => { liveOrder.current = order; }, [order]);
  const offsetOf = (drag: Drag | null, index: number) => drag ? drag.top - (drag.first + index * drag.pitch) : 0;

  useLayoutEffect(() => {
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-sort-id]") ?? [])];
    const animate = !reducedMotion();
    for (const row of rows) {
      const id = row.dataset.sortId!, previous = positions.current.get(id), now = row.offsetTop;
      if (animate && settle.current?.id === id) row.animate([{ transform: `translateY(${settle.current.offset}px)` }, { transform: "translateY(0)" }], { duration: 180, easing: "cubic-bezier(.2,.8,.2,1)" });
      else if (animate && previous !== undefined && previous !== now && id !== dragging?.id) row.animate([{ transform: `translateY(${previous - now}px)` }, { transform: "translateY(0)" }], { duration: 320, easing: "cubic-bezier(.2,.8,.2,1)" });
      positions.current.set(id, now);
    }
    settle.current = null;
  }, [order, dragging]);

  const start = (event: PointerEvent<HTMLLIElement>, id: string) => {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0) || (event.target as HTMLElement).closest("button")) return;
    const rows = [...listRef.current!.querySelectorAll<HTMLElement>("[data-sort-id]")];
    const first = rows[0].offsetTop, pitch = rows.length > 1 ? (rows[rows.length - 1].offsetTop - first) / (rows.length - 1) : 1;
    const row = event.currentTarget;
    try { row.setPointerCapture(event.pointerId); } catch { /* pointer already released */ }
    live.current = { id, pointerId: event.pointerId, grab: event.clientY - row.getBoundingClientRect().top, first, pitch, top: row.offsetTop };
    setDragging({ id, first, pitch, top: row.offsetTop });
  };
  const moveTo = (event: PointerEvent<HTMLLIElement>) => {
    const drag = live.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.top = event.clientY - listRef.current!.getBoundingClientRect().top - drag.grab;
    const current = liveOrder.current, from = current.indexOf(drag.id);
    const target = Math.max(0, Math.min(current.length - 1, Math.round((drag.top - drag.first) / drag.pitch)));
    if (target !== from) { liveOrder.current = move(current, from, target); onReorder(liveOrder.current); }
    setDragging({ id: drag.id, first: drag.first, pitch: drag.pitch, top: drag.top });
  };
  const end = (event: PointerEvent<HTMLLIElement>) => {
    const drag = live.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    settle.current = { id: drag.id, offset: offsetOf(drag, liveOrder.current.indexOf(drag.id)) };
    live.current = null;
    setDragging(null);
  };
  const nudge = (id: string, delta: number) => {
    const from = order.indexOf(id), to = from + delta;
    if (!disabled && to >= 0 && to < order.length) onReorder(move(order, from, to));
  };
  const keyMove = (event: KeyboardEvent<HTMLLIElement>, id: string) => {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); nudge(id, event.key === "ArrowUp" ? -1 : 1); }
  };

  return (
    <ol className={`trial-sortable ${dragging ? "is-dragging" : ""}`} ref={listRef} aria-label={label}>
      {order.map((id, index) => {
        // The dragged row follows the pointer relative to the slot it currently occupies.
        const isDragged = dragging?.id === id, offset = isDragged ? offsetOf(dragging, index) : 0;
        return (
          <li key={id} data-sort-id={id} tabIndex={disabled ? -1 : 0} className={`trial-sort-row ${isDragged ? "is-lifted" : ""}`} style={isDragged ? { transform: `translateY(${offset}px) scale(1.02)` } : undefined}
            onPointerDown={(event) => start(event, id)} onPointerMove={moveTo} onPointerUp={end} onPointerCancel={end} onKeyDown={(event) => keyMove(event, id)}
            aria-roledescription="sortable item" aria-label={`Position ${index + 1}. Use arrow keys to move.`}>
            <span className="trial-sort-rank">{index + 1}</span>
            {!disabled && <GripVertical className="trial-sort-grip" size={18} aria-hidden />}
            {renderRow(id, index)}
            {!disabled && (
              <span className="trial-sort-buttons">
                <button type="button" onClick={() => nudge(id, -1)} disabled={index === 0} aria-label="Move up"><ChevronUp size={16} /></button>
                <button type="button" onClick={() => nudge(id, 1)} disabled={index === order.length - 1} aria-label="Move down"><ChevronDown size={16} /></button>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function StatRankingGame({ pool, byId, seed, difficulty, best, onRecord, onRestart, onExit }: TrialModeProps) {
  const [run, setRun] = useState(() => createRankingRun(pool, seed, difficulty));
  useRecordWhenOver(run.phase === "over", run.score, onRecord);
  const stat = STATS[run.round.statId], revealed = run.phase !== "ordering" && run.result !== null;
  // After lock-in the list re-sorts itself into the true order, and every row shows where the player had it.
  const displayOrder = revealed ? run.round.correctOrder : run.order;
  const placement = (id: string) => run.result?.placements.find((item) => item.id === id);

  return (
    <TrialShell title="Stat Ranking" accent="sky" roundLabel={`Round ${run.roundIndex + 1} / ${STAT_RANKING.rounds}`} score={run.score} progress={(run.roundIndex + Number(revealed)) / STAT_RANKING.rounds * 100} onExit={onExit}>
      <section className="trial-panel trial-ranking" aria-labelledby="ranking-title">
        <div className="trial-category-banner is-compact" key={run.roundIndex}>
          <span className="atlas-eyebrow">Rank by</span>
          <h1 id="ranking-title" className="trial-title">{stat.label}</h1>
          <span className="trial-direction is-highest"><ArrowDown size={15} aria-hidden /> Highest → Lowest</span>
        </div>
        <p className="trial-hint">{revealed ? "True order revealed." : "Drag the cards (or use the arrows) so the highest value is on top, then lock in."}</p>
        <SortableList key={run.roundIndex} order={displayOrder} disabled={revealed} label={`${stat.label}, highest to lowest`} onReorder={(order) => setRun((current) => reorderRanking(current, order))}
          renderRow={(id) => {
            const country = byId.get(id)!, result = placement(id);
            const offset = result ? Math.abs(result.correctIndex - result.guessedIndex) : 0;
            return <>
              <CountryFlag country={country} />
              <span className="trial-sort-name"><strong>{country.name}</strong><small>{country.continent}</small></span>
              {result && <span className={`trial-sort-result ${offset === 0 ? "is-exact" : offset === 1 ? "is-near" : "is-off"}`}>
                <b>{formatCountryStat(run.round.statId, getCountryStat(country, run.round.statId))}</b>
                <small>{offset === 0 ? "✓ exact" : `you: #${result.guessedIndex + 1}`} · +{result.points}</small>
              </span>}
            </>;
          }} />
        <div className="trial-feedback-slot">
          {!revealed && <button type="button" className="atlas-start trial-lock" onClick={() => setRun((current) => lockInRanking(current))}><Lock size={17} /> Lock in</button>}
          {revealed && run.result && run.phase !== "over" && <>
            <ScoreBurst points={run.result.total} id={run.roundIndex} />
            <TrialFeedback tone={run.result.perfect ? "good" : run.result.total > 0 ? "neutral" : "bad"} title={run.result.perfect ? `Perfect ranking! +${run.result.total}` : `+${run.result.total} points`}
              detail={run.result.perfect ? `Includes the ${STAT_RANKING.perfectBonus} perfect bonus.` : `${run.result.placements.filter((item) => item.points === STAT_RANKING.exact).length} exact, ${run.result.placements.filter((item) => item.points === STAT_RANKING.offByOne).length} one off, ${run.result.placements.filter((item) => item.points === STAT_RANKING.offByTwo).length} two off · ${stat.source}`}
              action={<button type="button" className="trial-next" onClick={() => setRun((current) => nextRankingRound(current, pool))} autoFocus>{run.roundIndex + 1 >= STAT_RANKING.rounds ? "Finish" : "Next"} <ChevronRight size={16} /></button>} />
          </>}
        </div>
      </section>
      {run.phase === "over" && <GameOverPanel title="Rankings complete" score={run.score} best={best} stats={[{ label: "Perfect rounds", value: `${run.perfects} / ${STAT_RANKING.rounds}` }, { label: "Avg. per round", value: Math.round(run.score / STAT_RANKING.rounds) }]} onRestart={onRestart} onExit={onExit} />}
    </TrialShell>
  );
}
