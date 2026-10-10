import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { AtlasCountryShape } from "../AtlasCountryShape";
import { HISTORY_BATTLE, HISTORY_KIND_LABELS, HISTORY_SOURCE, historyDeck, historyPoints } from "../../../games/atlas/trials/historyBattle";
import { GameOverPanel, TrialFeedback, TrialShell, type TrialModeProps } from "./TrialsUI";
import { useOptionHotkeys, useRecordWhenOver } from "./useTrialTimers";

export function HistoryBattleGame({ pool, byId, seed, difficulty, best, topology, history, onRecord, onRestart, onExit }: TrialModeProps) {
  useGameLanguage();
  const deck = useMemo(() => historyDeck(history, pool, seed, difficulty), [history, pool, seed, difficulty]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [points, setPoints] = useState(0);
  const over = index >= deck.length;
  const round = over ? null : deck[index];
  const subject = round?.subjectId ? byId.get(round.subjectId) : null;
  const country = round && picked !== null ? byId.get(round.countryId) : null;
  const answer = round?.options.find((option) => option.id === round.answerId);
  useRecordWhenOver(over, score, onRecord);
  const choose = (id: string) => {
    if (!round || picked !== null) return;
    setPicked(id);
    if (id !== round.answerId) { setStreak(0); setPoints(0); return; }
    const earned = historyPoints(streak);
    setPoints(earned); setScore((value) => value + earned); setCorrectCount((value) => value + 1);
    setStreak(streak + 1); setBestStreak((value) => Math.max(value, streak + 1));
  };
  useOptionHotkeys(round?.options.length ?? 0, (option) => { if (round) choose(round.options[option].id); }, !over && picked === null);
  const correct = picked !== null && picked === round?.answerId;
  return <TrialShell title={gameUi("History Battle")} accent="rose" roundLabel={`Question ${Math.min(index + 1, deck.length)} / ${deck.length}`} score={score} progress={index / deck.length * 100} onExit={onExit}>
    {round && <div className="language-layout history-layout">
      <div className="trial-panel history-battle"><span className="atlas-eyebrow">{gameUi(HISTORY_KIND_LABELS[round.kind])}</span>
        {subject && <p className="history-subject"><img src={subject.flag} alt="" />{gameUi(subject.name)}</p>}
        <h1 className="trial-title">{gameUi(round.prompt)}</h1>
        <div className="language-options history-options">{round.options.map((option, position) => {
          const flag = option.countryId ? byId.get(option.countryId)?.flag : null;
          return <button key={option.id} type="button" disabled={picked !== null} className={picked !== null ? option.id === round.answerId ? "is-correct" : option.id === picked ? "is-wrong" : "" : ""} onClick={() => choose(option.id)}>
            <kbd>{gameUi(position + 1)}</kbd>{flag && <img src={flag} alt="" />}<span>{gameUi(option.label)}{picked !== null && option.detail && <small>{gameUi(option.detail)}</small>}</span>
          </button>;
        })}</div>
        {picked !== null && <TrialFeedback tone={correct ? "good" : "bad"} title={gameUi(correct ? `Correct · +${points}` : `It was ${answer?.label}`)}
          detail={correct && streak > 1 ? `${streak} in a row` : undefined}
          action={<button type="button" className="trial-next" onClick={() => { setPicked(null); setIndex(index + 1); }}>{gameUi(index + 1 >= deck.length ? "Finish" : "Next")} <ChevronRight size={16} /></button>} />}
      </div>
      {picked !== null && country && <section className="language-reveal history-reveal" aria-label={gameUi("Answer details")}>
        <div className="language-country"><div><span className="atlas-eyebrow">{gameUi("On record")}</span><strong>{gameUi(country.name)}</strong><img src={country.flag} alt={gameUi(`Flag of ${country.name}`)} /></div>{country.geometryId && <AtlasCountryShape topology={topology} geometryId={country.geometryId} label={gameUi(country.name)} showLabel={false} />}</div>
        <p className="history-fact">{gameUi(round.fact)}</p>
        {history.countries[round.countryId]?.background && <div className="language-translation"><span className="atlas-eyebrow">{gameUi("Background")}</span><p>{gameUi(history.countries[round.countryId].background)}</p></div>}
        <small className="history-source">{gameUi("Source: ")}{round.source ?? HISTORY_SOURCE}</small>
      </section>}
    </div>}
    {over && <GameOverPanel title={gameUi("History complete")} score={score} best={best} stats={[{ label: "Correct", value: `${correctCount} / ${HISTORY_BATTLE.rounds}` }, { label: "Accuracy", value: `${Math.round(correctCount / HISTORY_BATTLE.rounds * 100)}%` }, { label: "Best streak", value: bestStreak }]} onRestart={onRestart} onExit={onExit} />}
  </TrialShell>;
}
