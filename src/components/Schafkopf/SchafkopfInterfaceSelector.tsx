import type { SchafkopfInterface } from "./useSchafkopfInterface";

export default function SchafkopfInterfaceSelector({ value, onChange }: {
  value: SchafkopfInterface; onChange: (value: SchafkopfInterface) => void;
}) {
  return <label className="sk-toggle sk-interface-selector">
    <span className="sk-toggle-copy">Schlicht</span>
    <input type="checkbox" role="switch" checked={value === "simple"} onChange={event => onChange(event.target.checked ? "simple" : "scene")} />
    <span className="sk-toggle-track" aria-hidden="true" />
  </label>;
}
