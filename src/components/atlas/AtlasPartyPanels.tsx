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
  if (question.promptShape) return <AtlasCountryShape topology={topology} geometryId={question.promptShape.geometryId} label={question.promptShape.label} showLabel={false} />;
  return question.promptFlagAsset ? <img className="atlas-flag-hero" src={question.promptFlagAsset} alt="Flag to identify" /> : null;
}

export function FlagChoices({ question, disabled, selected, correctId, onAnswer }: { question: ChoiceDisplay; disabled: boolean; selected?: string | null; correctId?: string | null; onAnswer: (id: string) => void }) {
  const flags = question.choices.some((choice) => choice.flagAsset);
  return (
    <div className={`atlas-flag-choices ${flags ? "is-flags" : "is-names"}`}>
      {question.choices.map((choice) => {
        const state = correctId && choice.id === correctId ? "is-correct" : correctId && choice.id === selected ? "is-wrong" : choice.id === selected ? "selected" : "";
        return (
          <button type="button" key={choice.id} className={state} disabled={disabled} aria-label={choice.label} onClick={() => onAnswer(choice.id)}>
            {choice.flagAsset ? <img src={choice.flagAsset} alt="" /> : choice.label}
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
  const { stat } = question, first = question.first, second = question.second;
  const counts = stat.key === "countryCount";
  return (
    <div className="atlas-versus-cards">
      <article className="atlas-stat-card">
        <span className="atlas-stat-kind">{kindIcon(first?.kind)}{first ? kindLabel[first.kind] : "Reference"}</span>
        <strong>{first?.label ?? "Reference"}</strong>
        {first?.detail && <small>{first.detail}</small>}
        <b>{formatStat(stat.key, stat.firstValue, stat.unit)}</b>
        {stat.key === "areaKm2" && <AtlasAreaReference values={[stat.firstValue]} />}
        <em>{stat.label}{first?.note ? ` · ${first.note}` : ""}</em>
      </article>
      <div className="atlas-versus-mark" aria-hidden="true">VS</div>
      <article className={`atlas-stat-card is-challenger ${revealed && correct !== null && correct !== undefined ? correct ? "is-correct" : "is-wrong" : ""}`}>
        <span className="atlas-stat-kind">{kindIcon(second?.kind)}{second ? kindLabel[second.kind] : "Challenger"}</span>
        <strong>{second?.label ?? question.prompt}</strong>
        {second?.detail && <small>{second.detail}</small>}
        {revealed && stat.secondValue !== undefined
          ? <b>{formatStat(stat.key, stat.secondValue, stat.unit)}</b>
          : <div className="atlas-hl-buttons">
            <button type="button" className={chosen === "higher" ? "selected" : ""} disabled={disabled} onClick={() => onAnswer("higher")}><ArrowUp />{counts ? "More" : "Higher"}</button>
            <button type="button" className={chosen === "lower" ? "selected" : ""} disabled={disabled} onClick={() => onAnswer("lower")}><ArrowDown />{counts ? "Fewer" : "Lower"}</button>
          </div>}
        <em>{stat.label}{revealed && second?.note ? ` · ${second.note}` : ""}</em>
      </article>
    </div>
  );
}

export function GuessClueList({ clues, total, entityId, excludeIds = [] }: { clues: GuessClue[]; total: number; entityId?: string; excludeIds?: string[] }) {
  return (
    <>
    <ol className="atlas-clues">
      {clues.map((clue, index) => (
        <li key={index} className={index === clues.length - 1 ? "is-new" : ""}>
          <span><Lightbulb size={14} />Tip {index + 1}</span>
          <p>{clue.text}</p>
          {clue.flagAsset && <img src={clue.flagAsset} alt="Flag of the mystery country" />}
        </li>
      ))}
      {total > clues.length && <li className="is-locked"><p>{total - clues.length} more {total - clues.length === 1 ? "tip" : "tips"}, revealed one per round while nobody solves it</p></li>}
    </ol>
    <AtlasAreaReference values={clues.flatMap(clue => areaValuesFromText(clue.text))} excludeIds={[...excludeIds, ...(entityId ? [entityId] : [])]} />
    </>
  );
}

/** Type-ahead picker over UN member names; the map can also set `selectedId`. */
export function CountryGuessInput({ entities, selectedId, disabled, excluded = [], onSelect, onSubmit }: { entities: GeographicEntity[]; selectedId: string | null; disabled: boolean; excluded?: string[]; onSelect: (id: string | null) => void; onSubmit: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const options = useMemo(() => entities.filter((entity) => entity.status === "un195").sort((left, right) => left.shortName.localeCompare(right.shortName)), [entities]);
  const normalized = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const matches = query.trim() ? options.filter((entity) => [entity.shortName, entity.canonicalName, ...entity.aliases].some((name) => normalized(name).includes(normalized(query.trim())))).slice(0, 6) : [];
  const selected = options.find((entity) => entity.id === selectedId);
  const submit = () => { if (selectedId && !disabled) { onSubmit(selectedId); setQuery(""); } };
  return (
    <div className="atlas-guess-input">
      <label><Search size={16} /><input value={query} disabled={disabled} placeholder="Search for a country…" aria-label="Search for a country"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (matches[0] && matches[0].id !== selectedId) { onSelect(matches[0].id); setQuery(matches[0].shortName); } else submit(); } }} /></label>
      {matches.length > 0 && selected?.shortName !== query && <div className="atlas-guess-suggestions">{matches.map((entity) => <button type="button" key={entity.id} disabled={disabled || excluded.includes(entity.id)} onClick={() => { onSelect(entity.id); setQuery(entity.shortName); }}>{entity.shortName}</button>)}</div>}
      <button type="button" className="atlas-submit" disabled={disabled || !selectedId || excluded.includes(selectedId)} onClick={submit}>{selected ? `Guess ${selected.shortName}` : "Pick a country to guess"}</button>
    </div>
  );
}
