import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { AtlasCountryShape } from "../AtlasCountryShape";
import { LANGUAGE_GUESSER, languageRound } from "../../../games/atlas/trials/languageGuesser";
import { GameOverPanel, TrialFeedback, TrialShell, type TrialModeProps } from "./TrialsUI";
import type { TrialCountry } from "../../../games/atlas/trials/countryStats";
import { useOptionHotkeys, useRecordWhenOver } from "./useTrialTimers";

function representativeCountry(language: string, countries: Iterable<TrialCountry>) {
  return [...countries]
    .filter((country) => country.geometryId && country.officialLanguages.includes(language))
    .sort((left, right) => {
      const leftPrimary = Number(left.officialLanguages[0] === language), rightPrimary = Number(right.officialLanguages[0] === language);
      return rightPrimary - leftPrimary || (right.stats.population ?? 0) - (left.stats.population ?? 0);
    })[0] ?? null;
}

export function LanguageGuesserGame({ seed, difficulty, best, byId, topology, onRecord, onRestart, onExit }: TrialModeProps) {
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const over = index >= LANGUAGE_GUESSER.rounds;
  const round = over ? null : languageRound(seed, index, difficulty);
  const country = round && picked !== null ? representativeCountry(round.language, byId.values()) : null;
  useRecordWhenOver(over, score, onRecord);
  const answer = (language: string) => {
    if (!round || picked !== null) return;
    setPicked(language);
    if (language === round.language) { setScore((value) => value + LANGUAGE_GUESSER.correct); setCorrectCount((value) => value + 1); }
  };
  useOptionHotkeys(round?.options.length ?? 0, (option) => { if (round) answer(round.options[option]); }, !over && picked === null);
  return <TrialShell title="Language Guesser" accent="violet" roundLabel={`Sentence ${Math.min(index + 1, LANGUAGE_GUESSER.rounds)} / ${LANGUAGE_GUESSER.rounds}`} score={score} progress={index / LANGUAGE_GUESSER.rounds * 100} onExit={onExit}>
    {round && <div className="trial-panel language-guesser">
      <span className="atlas-eyebrow">Identify the language</span>
      <h1 className="trial-title">Which language is this?</h1>
      <blockquote lang="und">{round.sentence}</blockquote>
      <div className="language-options">{round.options.map((language, option) =>
        <button key={language} type="button" disabled={picked !== null} className={picked !== null ? language === round.language ? "is-correct" : language === picked ? "is-wrong" : "" : ""} onClick={() => answer(language)}><kbd>{option + 1}</kbd>{language}</button>)}</div>
      {picked !== null && <>
        <section className="language-reveal" aria-label="Answer details">
          <div className="language-translation"><span className="atlas-eyebrow">English translation</span><p>{round.translation}</p></div>
          {country && <div className="language-country"><div><span className="atlas-eyebrow">A country where it is spoken</span><strong>{country.name}</strong><img src={country.flag} alt={`Flag of ${country.name}`} /></div><AtlasCountryShape topology={topology} geometryId={country.geometryId!} label={country.name} showLabel={false} /></div>}
        </section>
        <TrialFeedback tone={picked === round.language ? "good" : "bad"} title={picked === round.language ? `Correct · +${LANGUAGE_GUESSER.correct}` : `That was ${round.language}`} detail={country ? `${round.language} is spoken in ${country.name}.` : "The sentence is an everyday greeting."} action={<button type="button" className="trial-next" onClick={() => { setPicked(null); setIndex(index + 1); }}>Next <ChevronRight size={16} /></button>} />
      </>}
    </div>}
    {over && <GameOverPanel title="Languages complete" score={score} best={best} stats={[{ label: "Correct", value: `${correctCount} / ${LANGUAGE_GUESSER.rounds}` }, { label: "Accuracy", value: `${Math.round(correctCount / LANGUAGE_GUESSER.rounds * 100)}%` }]} onRestart={onRestart} onExit={onExit} />}
  </TrialShell>;
}
