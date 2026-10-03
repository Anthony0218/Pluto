import { useState } from "react";
import { ChevronRight, Eye, Lock } from "lucide-react";
import { COUNTRY_GUESSER } from "../../../games/atlas/trials/config";
import { createGuesserRun, guesserPoints, nextGuesserRound, revealGuesserClue, submitGuesserGuess } from "../../../games/atlas/trials/countryGuesser";
import { CountryOptionCard, GameOverPanel, ScoreBurst, TrialFeedback, TrialShell, type CardState, type TrialModeProps } from "./TrialsUI";
import { useOptionHotkeys, useRecordWhenOver, useTrialTimers } from "./useTrialTimers";

export function CountryGuesserGame({ pool, byId, seed, best, onRecord, onRestart, onExit }: TrialModeProps) {
  const [run, setRun] = useState(() => createGuesserRun(pool, seed));
  const { schedule, clear } = useTrialTimers();
  const answer = byId.get(run.round.answerId)!;

  useRecordWhenOver(run.phase === "over", run.score, onRecord);
  const advance = () => { clear(); setRun((current) => nextGuesserRound(current, pool)); };
  const guess = (id: string) => {
    const next = submitGuesserGuess(run, id);
    if (next === run) return;
    setRun(next);
    if (next.phase === "solved") schedule(() => setRun((current) => nextGuesserRound(current, pool)), 2600);
  };
  useOptionHotkeys(run.round.optionIds.length, (index) => guess(run.round.optionIds[index]), run.phase === "guessing");

  const stateOf = (id: string): CardState => {
    if (run.wrong.includes(id)) return "wrong";
    if (run.phase === "solved") return id === answer.id ? "correct" : "dim";
    if (run.phase === "over") return id === answer.id ? "missed" : "dim";
    return "idle";
  };
  const allClues = run.phase !== "guessing";
  const canReveal = run.phase === "guessing" && run.revealed < run.round.clues.length;

  return (
    <TrialShell title="Country Guesser" accent="cyan" roundLabel={`Country ${run.roundIndex + 1} / ${COUNTRY_GUESSER.rounds}`} score={run.score} lives={run.lives} maxLives={COUNTRY_GUESSER.lives} progress={(run.roundIndex + Number(run.phase !== "guessing")) / COUNTRY_GUESSER.rounds * 100} onExit={onExit}>
      <div className="trial-split">
        <section className="trial-panel trial-clue-panel" aria-labelledby="guesser-clue-title">
          <span className="atlas-eyebrow">Clue {run.revealed} of {run.round.clues.length}</span>
          <h1 id="guesser-clue-title" className="trial-title">Which country is it?</h1>
          <ol className="trial-clues">
            {run.round.clues.map((clue, index) => {
              const shown = index < run.revealed || allClues;
              return (
                <li key={`${run.roundIndex}-${index}`} className={shown ? `is-shown ${index >= run.revealed ? "is-late" : ""}` : "is-hidden"}>
                  <span className="trial-clue-index">{index + 1}</span>
                  {shown ? <p>{clue.text}</p> : <p><Lock size={14} aria-hidden /> Hidden clue · worth {guesserPoints(index + 1).toLocaleString("en")} if solved now</p>}
                </li>
              );
            })}
          </ol>
          <button type="button" className="trial-reveal" disabled={!canReveal} onClick={() => setRun((current) => revealGuesserClue(current))}>
            <Eye size={17} aria-hidden /> {canReveal ? `Reveal clue ${run.revealed + 1}` : "All clues revealed"}
            <small>{canReveal ? `Solve value ${guesserPoints(run.revealed).toLocaleString("en")} → ${guesserPoints(run.revealed + 1).toLocaleString("en")}` : `Solve value ${guesserPoints(run.revealed)}`}</small>
          </button>
        </section>
        <section className="trial-panel" aria-label="Country options">
          <div className="trial-option-grid is-two">
            {run.round.optionIds.map((id, index) => (
              <CountryOptionCard key={`${run.roundIndex}-${id}`} index={index} country={byId.get(id)!} state={stateOf(id)} disabled={run.phase !== "guessing" || run.wrong.includes(id)} onSelect={() => guess(id)} detail={<kbd>{index + 1}</kbd>} />
            ))}
          </div>
          <div className="trial-feedback-slot">
            <ScoreBurst points={run.lastPoints} id={`${run.roundIndex}-${run.score}`} />
            {run.phase === "solved" && <TrialFeedback tone="good" title={`${answer.name} — +${run.lastPoints.toLocaleString("en")}`} detail={`Solved with ${run.revealed} clue${run.revealed === 1 ? "" : "s"}.`} action={<button type="button" className="trial-next" onClick={advance}>Next <ChevronRight size={16} /></button>} />}
            {run.phase === "guessing" && run.wrong.length > 0 && <TrialFeedback tone="bad" title={`Not ${byId.get(run.wrong.at(-1)!)!.name}`} detail={`${run.lives} ${run.lives === 1 ? "life" : "lives"} left — reveal another clue or guess again.`} />}
          </div>
        </section>
      </div>
      {run.phase === "over" && (
        <GameOverPanel title={run.lives <= 0 ? `It was ${answer.name}` : "Run complete"} subtitle={run.lives <= 0 ? "Out of lives." : `All ${COUNTRY_GUESSER.rounds} countries played.`} score={run.score} best={best}
          stats={[{ label: "Solved", value: run.solved }, { label: "Lives left", value: run.lives }, { label: "Avg. points", value: run.solved ? Math.round(run.score / run.solved) : 0 }]} onRestart={onRestart} onExit={onExit} />
      )}
    </TrialShell>
  );
}
