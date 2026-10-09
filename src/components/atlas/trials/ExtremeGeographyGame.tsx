import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Crown, Flame, Timer } from "lucide-react";
import { EXTREME_GEOGRAPHY } from "../../../games/atlas/trials/config";
import { formatCountryStat, getCountryStat, STATS } from "../../../games/atlas/trials/countryStats";
import { answerExtreme, categoryById, createExtremeRun, nextExtremeRound } from "../../../games/atlas/trials/extremeGeography";
import { CountryOptionCard, GameOverPanel, ScoreBurst, TrialFeedback, TrialShell, type CardState, type TrialModeProps } from "./TrialsUI";
import { useOptionHotkeys, useRecordWhenOver, useTrialTimers } from "./useTrialTimers";

export function ExtremeGeographyGame({ pool, byId, seed, difficulty, best, onRecord, onRestart, onExit }: TrialModeProps) {
  useGameLanguage();
  const [run, setRun] = useState(() => createExtremeRun(pool, seed, difficulty));
  // Tagged with its round, so a new question starts on a full clock instead of the last round's leftovers.
  const [clock, setClock] = useState({ round: 0, ms: EXTREME_GEOGRAPHY.timeLimitMs as number });
  const startedAt = useRef(0);
  const { schedule } = useTrialTimers();
  const category = categoryById(run.round.categoryId), stat = STATS[category.statId];
  useRecordWhenOver(run.phase === "over", run.score, onRecord);

  const queueNext = () => schedule(() => setRun((current) => nextExtremeRound(current, pool)), 1900);
  // The clock starts when a round is on screen and stops the moment it is answered or runs out.
  useEffect(() => {
    if (run.phase !== "answering") return;
    startedAt.current = performance.now();
    const interval = window.setInterval(() => {
      const left = Math.max(0, EXTREME_GEOGRAPHY.timeLimitMs - (performance.now() - startedAt.current));
      setClock({ round: run.roundIndex, ms: left });
      if (left <= 0) {
        window.clearInterval(interval);
        setRun((current) => answerExtreme(current, null, EXTREME_GEOGRAPHY.timeLimitMs));
        queueNext();
      }
    }, 100);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one clock per round
  }, [run.roundIndex, run.phase]);

  const answer = (id: string) => {
    const next = answerExtreme(run, id, performance.now() - startedAt.current);
    if (next === run) return;
    setRun(next);
    queueNext();
  };
  useOptionHotkeys(run.round.countryIds.length, (index) => answer(run.round.countryIds[index]), run.phase === "answering");

  const revealed = run.phase !== "answering";
  const remainingMs = clock.round === run.roundIndex ? clock.ms : EXTREME_GEOGRAPHY.timeLimitMs;
  const stateOf = (id: string): CardState => !revealed ? "idle" : id === run.round.answerId ? (run.correct ? "correct" : "missed") : id === run.picked ? "wrong" : "dim";
  const seconds = Math.ceil((revealed ? 0 : remainingMs) / 1000);

  return (
    <TrialShell title={gameUi("Extreme Geography")} accent={run.round.extreme ? "rose" : "amber"} roundLabel={`Question ${run.roundIndex + 1} / ${EXTREME_GEOGRAPHY.rounds}`} score={run.score} progress={(run.roundIndex + Number(revealed)) / EXTREME_GEOGRAPHY.rounds * 100} onExit={onExit}>
      <section className={`trial-panel trial-extreme ${run.round.extreme ? "is-extreme" : ""}`} aria-labelledby="extreme-title">
        <div className="trial-extreme-head" key={run.roundIndex}>
          {run.round.extreme && <span className="trial-extreme-badge"><Flame size={15} aria-hidden />{gameUi(" Extreme round · ×")}{gameUi(EXTREME_GEOGRAPHY.extremeMultiplier)}{gameUi(" points")}</span>}
          <span className={`trial-direction is-${category.direction}`}>{category.direction === "highest" ? <ArrowUp size={15} aria-hidden /> : <ArrowDown size={15} aria-hidden />} {gameUi(category.direction === "highest" ? "Highest wins" : "Lowest wins")}</span>
          <h1 id="extreme-title" className="trial-title">{gameUi(category.question)}</h1>
          <div className={`trial-timer ${seconds <= 3 && !revealed ? "is-urgent" : ""}`} aria-label={gameUi(`${seconds} seconds left`)}>
            <Timer size={15} aria-hidden /><span>{gameUi(seconds)}s</span>
            <i style={{ transform: `scaleX(${revealed ? 0 : remainingMs / EXTREME_GEOGRAPHY.timeLimitMs})` }} />
          </div>
        </div>
        <div className={`trial-option-grid ${run.round.countryIds.length > 4 ? "is-three" : "is-four"}`}>
          {run.round.countryIds.map((id, index) => {
            const country = byId.get(id)!;
            return (
              <CountryOptionCard key={`${run.roundIndex}-${id}`} index={index} country={country} state={stateOf(id)} disabled={revealed} onSelect={() => answer(id)}
                detail={revealed ? <span className="trial-reveal-value">{gameUi(formatCountryStat(category.statId, getCountryStat(country, category.statId)))}</span> : <kbd>{gameUi(index + 1)}</kbd>}>
                {revealed && id === run.round.answerId && <Crown className="trial-crown" size={18} aria-hidden />}
              </CountryOptionCard>
            );
          })}
        </div>
        <div className="trial-feedback-slot">
          <ScoreBurst points={run.lastPoints} id={run.roundIndex} />
          {revealed && run.phase !== "over" && <TrialFeedback tone={run.correct ? "good" : "bad"}
            title={gameUi(run.correct ? `Correct — +${run.lastPoints}` : run.picked ? `It was ${byId.get(run.round.answerId)!.name}` : `Time's up — it was ${byId.get(run.round.answerId)!.name}`)}
            detail={`${stat.label} · ${stat.source}. Only the countries shown are compared.`} />}
        </div>
      </section>
      {run.phase === "over" && <GameOverPanel title={gameUi("Expedition to the extremes complete")} score={run.score} best={best}
        stats={[{ label: "Correct", value: `${run.correctCount} / ${EXTREME_GEOGRAPHY.rounds}` }, { label: "Best streak", value: run.bestStreak }]} onRestart={onRestart} onExit={onExit} />}
    </TrialShell>
  );
}
