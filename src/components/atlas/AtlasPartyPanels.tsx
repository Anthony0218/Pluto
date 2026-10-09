import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { areaValuesFromText } from "@/games/atlas/areaReferences";
import AtlasAreaReference from "./AtlasAreaReference";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Building2, Check, Globe2, Lightbulb, Map as MapIcon, Mountain, Search, X } from "lucide-react";
import { AtlasCountryShape } from "./AtlasCountryShape";
import type { ChoiceQuestion, ComparableKind, GeographicEntity, GuessClue, HigherLowerQuestion } from "../../games/atlas/types";

type ChoiceDisplay = Pick<ChoiceQuestion,"choices"> & Partial<Pick<ChoiceQuestion,"promptShape"|"promptFlagAsset">>;
type ComparisonDisplay = Pick<HigherLowerQuestion,"prompt"|"first"|"second"> & {stat:Omit<HigherLowerQuestion["stat"],"secondValue"> & {secondValue?:number}};

/** Population reads best compact (8.1M); areas, heights and counts stay exact. */
function formatStat(key: HigherLowerQuestion["stat"]["key"], value: number, unit: string) {
  if (key === "population") return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  const exact = new Intl.NumberFormat("en").format(Math.round(value));
  return unit === "km²" || unit === "m" ? `${exact} ${unit}` : exact;
}

/** The flag to identify, or the lone country outline whose flag is asked for. */
export function FlagPrompt({ question, topology }: { question: ChoiceDisplay; topology: unknown }) {
  useGameLanguage();
  if (question.promptShape) return <AtlasCountryShape topology={topology} geometryId={question.promptShape.geometryId} label={gameUi(question.promptShape.label)} showLabel={false} />;
  return question.promptFlagAsset ? <img className="atlas-flag-hero" src={question.promptFlagAsset} alt={gameUi("Flag to identify")} /> : null;
}

export function FlagChoices({ question, disabled, selected, correctId, onAnswer }: { question: ChoiceDisplay; disabled: boolean; selected?: string | null; correctId?: string | null; onAnswer: (id: string) => void }) {
  useGameLanguage();
  const flags = question.choices.some((choice) => choice.flagAsset);
  return (
    <div className={`atlas-flag-choices ${flags ? "is-flags" : "is-names"}`}>
      {question.choices.map((choice) => {
        const state = correctId && choice.id === correctId ? "is-correct" : correctId && choice.id === selected ? "is-wrong" : choice.id === selected ? "selected" : "";
        return (
          <button type="button" key={choice.id} className={state} disabled={disabled} aria-label={gameUi(choice.label)} onClick={() => onAnswer(choice.id)}>
            {gameUi(choice.flagAsset ? <img src={choice.flagAsset} alt="" /> : choice.label)}
            {state === "is-correct" && <Check className="atlas-choice-mark" />}
            {state === "is-wrong" && <X className="atlas-choice-mark" />}
          </button>
        );
      })}
    </div>
  );
}

const kindIcon = (kind?: ComparableKind) => kind === "city" ? <Building2 /> : kind === "continent" ? <Globe2 /> : kind === "subregion" ? <MapIcon /> : <Mountain />;
const kindLabel: Record<ComparableKind, string> = { country: "Country", city: "City", continent: "Continent", subregion: "Subregion" };

/**
 * Two cards: the reference with its value, and the challenger whose value stays hidden until `revealed`.
 * `secondValue`/`note` may be absent in multiplayer snapshots, which hide them until the round resolves.
 */
export function HigherLowerCards({ question, revealed, disabled, chosen, correct, onAnswer }: { question: ComparisonDisplay; revealed: boolean; disabled: boolean; chosen?: string | null; correct?: boolean | null; onAnswer: (answer: "higher" | "lower") => void }) {
  useGameLanguage();
  const { stat } = question, first = question.first, second = question.second;
  const counts = stat.key === "countryCount";
  return (
    <div className="atlas-versus-cards">
      <article className="atlas-stat-card">
        <span className="atlas-stat-kind">{gameUi(kindIcon(first?.kind))}{gameUi(first ? kindLabel[first.kind] : "Reference")}</span>
        <strong>{gameUi(first?.label ?? "Reference")}</strong>
        {first?.detail && <small>{gameUi(first.detail)}</small>}
        <b>{gameUi(formatStat(stat.key, stat.firstValue, stat.unit))}</b>
        {stat.key === "areaKm2" && <AtlasAreaReference values={[stat.firstValue]} />}
        <em>{gameUi(stat.label)}{gameUi(first?.note ? ` · ${first.note}` : "")}</em>
      </article>
      <div className="atlas-versus-mark" aria-hidden="true">{gameUi("VS")}</div>
      <article className={`atlas-stat-card is-challenger ${revealed && correct !== null && correct !== undefined ? correct ? "is-correct" : "is-wrong" : ""}`}>
        <span className="atlas-stat-kind">{gameUi(kindIcon(second?.kind))}{gameUi(second ? kindLabel[second.kind] : "Challenger")}</span>
        <strong>{gameUi(second?.label ?? question.prompt)}</strong>
        {second?.detail && <small>{gameUi(second.detail)}</small>}
        {revealed && stat.secondValue !== undefined
          ? <b>{gameUi(formatStat(stat.key, stat.secondValue, stat.unit))}</b>
          : <div className="atlas-hl-buttons">
            <button type="button" className={chosen === "higher" ? "selected" : ""} disabled={disabled} onClick={() => onAnswer("higher")}><ArrowUp />{gameUi(counts ? "More" : "Higher")}</button>
            <button type="button" className={chosen === "lower" ? "selected" : ""} disabled={disabled} onClick={() => onAnswer("lower")}><ArrowDown />{gameUi(counts ? "Fewer" : "Lower")}</button>
          </div>}
        <em>{gameUi(stat.label)}{gameUi(revealed && second?.note ? ` · ${second.note}` : "")}</em>
      </article>
    </div>
  );
}

export function GuessClueList({ clues, total, entityId }: { clues: GuessClue[]; total: number; entityId?: string }) {
  useGameLanguage();
  return (
    <>
    <ol className="atlas-clues">
      {clues.map((clue, index) => (
        <li key={index} className={index === clues.length - 1 ? "is-new" : ""}>
          <span><Lightbulb size={14} />{gameUi("Tip ")}{gameUi(index + 1)}</span>
          <p>{gameUi(clue.text)}</p>
          {clue.flagAsset && <img src={clue.flagAsset} alt={gameUi("Flag of the mystery country")} />}
        </li>
      ))}
      {total > clues.length && <li className="is-locked"><p>{gameUi(total - clues.length)}{gameUi(" more ")}{gameUi(total - clues.length === 1 ? "tip" : "tips")}{gameUi(", revealed one per round while nobody solves it")}</p></li>}
    </ol>
    <AtlasAreaReference values={clues.flatMap(clue => areaValuesFromText(clue.text))} excludeIds={entityId ? [entityId] : []} />
    </>
  );
}

/** Type-ahead picker over UN member names; the map can also set `selectedId`. */
export function CountryGuessInput({ entities, selectedId, disabled, excluded = [], onSelect, onSubmit }: { entities: GeographicEntity[]; selectedId: string | null; disabled: boolean; excluded?: string[]; onSelect: (id: string | null) => void; onSubmit: (id: string) => void }) {
  const { language } = useGameLanguage();
  const [query, setQuery] = useState("");
  const options = useMemo(() => entities.filter((entity) => entity.status === "un195").sort((left, right) => gameUi(left.shortName).localeCompare(gameUi(right.shortName), language === "bar" ? "de" : language)), [entities, language]);
  const normalized = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const matches = query.trim() ? options.filter((entity) => [entity.shortName, entity.canonicalName, gameUi(entity.shortName), gameUi(entity.canonicalName), ...entity.aliases].some((name) => normalized(name).includes(normalized(query.trim())))).slice(0, 6) : [];
  const selected = options.find((entity) => entity.id === selectedId);
  const submit = () => { if (selectedId && !disabled) { onSubmit(selectedId); setQuery(""); } };
  return (
    <div className="atlas-guess-input">
      <label><Search size={16} /><input value={query} disabled={disabled} placeholder={gameUi("Type a country or click the map…")} aria-label={gameUi("Search for a country")}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (matches[0] && matches[0].id !== selectedId) { onSelect(matches[0].id); setQuery(gameUi(matches[0].shortName)); } else submit(); } }} /></label>
      {matches.length > 0 && (!selected || gameUi(selected.shortName) !== query) && <div className="atlas-guess-suggestions">{matches.map((entity) => <button type="button" key={entity.id} disabled={disabled || excluded.includes(entity.id)} onClick={() => { onSelect(entity.id); setQuery(gameUi(entity.shortName)); }}>{gameUi(entity.shortName)}</button>)}</div>}
      <button type="button" className="atlas-submit" disabled={disabled || !selectedId || excluded.includes(selectedId)} onClick={submit}>{gameUi(selected ? `Guess ${selected.shortName}` : "Pick a country to guess")}</button>
    </div>
  );
}
