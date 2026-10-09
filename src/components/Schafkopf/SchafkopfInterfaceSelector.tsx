import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import type { SchafkopfInterface } from "./useSchafkopfInterface";

export default function SchafkopfInterfaceSelector({ value, onChange }: {
  value: SchafkopfInterface; onChange: (value: SchafkopfInterface) => void;
}) {
  useGameLanguage();
  return <label className="sk-toggle sk-interface-selector">
    <span className="sk-toggle-copy">{gameUi("Schlicht")}</span>
    <input type="checkbox" role="switch" checked={value === "simple"} onChange={event => onChange(event.target.checked ? "simple" : "scene")} />
    <span className="sk-toggle-track" aria-hidden="true" />
  </label>;
}
