import { useState, type CSSProperties } from "react";
import { ChevronRight, ScanSearch } from "lucide-react";
import { STAT_DETECTIVE } from "../../../games/atlas/trials/config";
import { formatCountryStat, getCountryStat, STATS } from "../../../games/atlas/trials/countryStats";
import { createDetectiveRun, nextDetectiveRound, submitDetectiveGuess } from "../../../games/atlas/trials/statDetective";
import { CountryOptionCard, GameOverPanel, ScoreBurst, TrialFeedback, TrialShell, type CardState, type TrialModeProps } from "./TrialsUI";
import { useOptionHotkeys, useRecordWhenOver, useTrialTimers } from "./useTrialTimers";

export function StatDetectiveGame({ pool, byId, seed, difficulty, best, onRecord, onRestart, onExit }: TrialModeProps) {
  const [run, setRun] = useState(() => createDetectiveRun(pool, seed, difficulty));
  const { schedule, clear } = useTrialTimers();
  const answer = byId.get(run.round.answerId)!;
  useRecordWhenOver(run.phase === "over", run.score, onRecord);

  const advance = () => { clear(); setRun((current) => nextDetectiveRound(current, pool)); };
  const guess = (id: string) => {
    const next = submitDetectiveGuess(run, id);
    if (next === run) return;
    setRun(next);
    // A miss stays on screen longer so the player can compare the real figures.
    schedule(() => setRun((current) => nextDetectiveRound(current, pool)), next.correct ? 2000 : 3600);
  };
  useOptionHotkeys(run.round.optionIds.length, (index) => guess(run.round.optionIds[index]), run.phase === "guessing");

  const revealed = run.phase !== "guessing";
  const stateOf = (id: string): CardState => !revealed ? "idle" : id === answer.id ? (run.correct ? "correct" : "missed") : id === run.picked ? "wrong" : "dim";
  const [lead] = run.round.statIds;

  return (
    <TrialShell title="Stat Detective" accent="emerald" roundLabel={`Case ${run.roundIndex + 1} / ${STAT_DETECTIVE.rounds}`} score={run.score} lives={run.lives} maxLives={STAT_DETECTIVE.lives} progress={(run.roundIndex + Number(revealed)) / STAT_DETECTIVE.rounds * 100} onExit={onExit}>
      <div className="trial-split">
        <section className="trial-panel trial-case-file" aria-labelledby="detective-title">
          <span className="atlas-eyebrow"><ScanSearch size={13} aria-hidden /> Case file #{String(run.roundIndex + 1).padStart(2, "0")}{run.streak > 1 ? ` · streak ${run.streak}` : ""}</span>
          <h1 id="detective-title" className="trial-title">Identify the mystery country</h1>
          <dl className="trial-stat-sheet" key={run.roundIndex}>
            {run.round.statIds.map((statId, index) => (
              <div key={statId} style={{ "--i": index } as CSSProperties}>
                <dt>{STATS[statId].label}</dt><dd>{formatCountryStat(statId, getCountryStat(answer, statId))}</dd>
              </div>
            ))}
            {run.round.showRegion && <div style={{ "--i": run.round.statIds.length } as CSSProperties}><dt>Continent</dt><dd>{answer.continent}</dd></div>}
          </dl>
          <p className="trial-source-note">Sources: {[...new Set(run.round.statIds.map((statId) => STATS[statId].source))].join(" · ")}</p>
        </section>
        <section className="trial-panel" aria-label="Suspects">
          <div className="trial-option-grid is-two">
            {run.round.optionIds.map((id, index) => {
              const country = byId.get(id)!;
              return <CountryOptionCard key={`${run.roundIndex}-${id}`} index={index} country={country} state={stateOf(id)} disabled={revealed} onSelect={() => guess(id)}
                detail={revealed ? `${STATS[lead].label}: ${formatCountryStat(lead, getCountryStat(country, lead))}` : <kbd>{index + 1}</kbd>} />;
            })}
          </div>
          <div className="trial-feedback-slot">
            <ScoreBurst points={run.lastPoints} id={`${run.roundIndex}-${run.score}`} />
            {revealed && run.phase !== "over" && (
              <TrialFeedback tone={run.correct ? "good" : "bad"} title={run.correct ? `Case closed: ${answer.name} — +${run.lastPoints}` : `It was ${answer.name}`}
                detail={run.correct ? (run.streak > 1 ? `${run.streak} in a row — streak bonus active.` : "Correct deduction.") : `${run.lives} ${run.lives === 1 ? "life" : "lives"} left.`}
                action={<button type="button" className="trial-next" onClick={advance}>Next <ChevronRight size={16} /></button>} />
            )}
          </div>
        </section>
      </div>
      {run.phase === "over" && <GameOverPanel title={run.lives <= 0 ? "Case files closed" : "Every case solved"} subtitle={run.lives <= 0 ? `Out of lives — the last one was ${answer.name}.` : undefined} score={run.score} best={best}
        stats={[{ label: "Solved", value: `${run.solved} / ${run.roundIndex + 1}` }, { label: "Best streak", value: run.bestStreak }, { label: "Lives left", value: run.lives }]} onRestart={onRestart} onExit={onExit} />}
    </TrialShell>
  );
}
