import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useState } from "react";
import { createRegionRun, nextRegionRound, pickRegionCountry, regionById } from "../../../games/atlas/trials/regionBuilder";
import { CountryOptionCard, GameOverPanel, ScoreBurst, TrialFeedback, TrialShell, type CardState, type TrialModeProps } from "./TrialsUI";
import { useRecordWhenOver, useTrialTimers } from "./useTrialTimers";

/** Region Builder plays on cards, never the map, and the first wrong card ends the whole run. */
export function RegionBuilderGame({ pool, byId, seed, best, onRecord, onRestart, onExit }: TrialModeProps) {
  useGameLanguage();
  const [run, setRun] = useState(() => createRegionRun(pool, seed));
  const { schedule } = useTrialTimers();
  const region = regionById(run.round.regionId);
  useRecordWhenOver(run.phase === "over", run.score, onRecord);

  const pick = (id: string) => {
    const next = pickRegionCountry(run, id);
    if (next === run) return;
    setRun(next);
    if (next.phase === "complete") schedule(() => setRun((current) => nextRegionRound(current, pool)), 1700);
  };
  const stateOf = (id: string): CardState => {
    if (run.found.includes(id)) return run.phase === "complete" ? "correct" : "locked";
    if (run.phase === "over") return id === run.wrongId ? "wrong" : run.round.targetIds.includes(id) ? "missed" : "dim";
    return "idle";
  };

  return (
    <TrialShell title={gameUi("Region Builder")} accent="violet" roundLabel={`Region ${run.roundIndex + 1} · ${run.regionsCompleted} completed`} score={run.score} progress={run.found.length / run.round.targetIds.length * 100} onExit={onExit} wide>
      <section className="trial-panel trial-region-head" aria-live="polite">
        <span className="atlas-eyebrow">{gameUi("Select every country in")}</span>
        <h1 className="trial-title trial-region-name" key={region.id}>{gameUi(region.name)}</h1>
        <p className="trial-region-definition">{gameUi(region.definition)}{gameUi(run.round.targetIds.length < region.members.length ? ` Only ${run.round.targetIds.length} of its ${region.members.length} members are among these cards.` : "")}</p>
        <div className="trial-region-progress" aria-label={gameUi(`${run.found.length} of ${run.round.targetIds.length} found`)}>
          {run.round.targetIds.map((id, index) => <i key={id} className={index < run.found.length ? "is-found" : ""} />)}
          <strong>{gameUi(run.found.length)} / {gameUi(run.round.targetIds.length)}{gameUi(" found")}</strong>
        </div>
        <p className="trial-rule-note">{gameUi("One wrong country ends the run.")}</p>
      </section>
      <div className="trial-option-grid is-region" key={run.roundIndex}>
        {run.round.optionIds.map((id, index) => (
          <CountryOptionCard key={id} index={index} country={byId.get(id)!} state={stateOf(id)} disabled={run.phase !== "picking" || run.found.includes(id)} onSelect={() => pick(id)} />
        ))}
      </div>
      <div className="trial-feedback-slot">
        <ScoreBurst points={run.lastPoints} id={`${run.roundIndex}-${run.found.length}`} />
        {run.phase === "complete" && <TrialFeedback tone="good" title={gameUi(`${region.name} complete`)} detail={`All ${run.round.targetIds.length} found · +${run.lastPoints} including the region bonus. Next region incoming…`} />}
      </div>
      {gameUi(run.phase === "over" && (
        <GameOverPanel title={gameUi(`${byId.get(run.wrongId!)?.name} isn't in ${region.name.replace(/^The /, "the ")}`)} subtitle={gameUi("The highlighted cards were the ones still missing.")} score={run.score} best={best}
          stats={[{ label: "Regions completed", value: run.regionsCompleted }, { label: "Correct picks", value: run.correctPicks }, { label: "Found this round", value: `${run.found.length} / ${run.round.targetIds.length}` }]} onRestart={onRestart} onExit={onExit} />
      ))}
    </TrialShell>
  );
}
