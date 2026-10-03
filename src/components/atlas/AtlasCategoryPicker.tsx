import { Check } from "lucide-react";

export function AtlasCategoryPicker<T extends string>({ options, selected, onChange, label = "Question categories" }: {
  options: { id: T; label: string }[];
  selected: T[];
  onChange: (selected: T[]) => void;
  label?: string;
}) {
  return <fieldset className="atlas-category-picker">
    <legend className="atlas-label">{label}</legend>
    <div className="atlas-chip-grid">{options.map(({ id, label: title }) => {
      const active = selected.includes(id);
      return <button type="button" key={id} aria-pressed={active} className={active ? "active" : ""}
        onClick={() => onChange(active ? selected.filter((item) => item !== id) : [...selected, id])}>
        {active && <Check size={14} />}{title}
      </button>;
    })}</div>
    {!selected.length && <p className="atlas-setup-note">Select at least one category to play.</p>}
  </fieldset>;
}
