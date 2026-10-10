import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { Check } from "lucide-react";

export function AtlasCategoryPicker<T extends string>({ options, selected, onChange, label = "Question categories" }: {
  options: { id: T; label: string }[];
  selected: T[];
  onChange: (selected: T[]) => void;
  label?: string;
}) {
  useGameLanguage();
  return <fieldset className="atlas-category-picker">
    <legend className="atlas-label">{gameUi(label)}</legend>
    <div className="atlas-chip-grid">{options.map(({ id, label: title }) => {
      const active = selected.includes(id);
      return <button type="button" key={id} aria-pressed={active} className={active ? "active" : ""}
        onClick={() => onChange(active ? selected.filter((item) => item !== id) : [...selected, id])}>
        {active && <Check size={14} />}{gameUi(title)}
      </button>;
    })}</div>
    {!selected.length && <p className="atlas-setup-note">{gameUi("Select at least one category to play.")}</p>}
  </fieldset>;
}
