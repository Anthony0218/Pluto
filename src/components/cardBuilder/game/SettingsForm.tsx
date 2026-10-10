import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import type { GameDefinition, SettingValue } from "@/games/cards/engine/types";
import { Field, NumberField, Toggle, inputClass } from "@/components/chessCustom/ui";

/** Lobby form generated from a definition's settings. */
export default function SettingsForm({ def, values, onChange }: { def: GameDefinition; values: Record<string, SettingValue>; onChange: (values: Record<string, SettingValue>) => void }) {
  useGameLanguage();
  const set = (key: string, value: SettingValue) => onChange({ ...values, [key]: value });
  return (
    <div className="space-y-3">
      {(def.settings ?? []).map((setting) => {
        const value = values[setting.key] ?? setting.default;
        switch (setting.type) {
          case "integer":
            return (
              <Field key={setting.key} label={gameUi(setting.label)} hint={setting.description}>
                <NumberField value={Number(value)} min={setting.min} max={setting.max} label={gameUi(setting.label)} onChange={(next) => set(setting.key, next)} />
              </Field>
            );
          case "boolean":
            return <Toggle key={setting.key} checked={Boolean(value)} onChange={(next) => set(setting.key, next)} label={gameUi(setting.label)} description={gameUi(setting.description)} />;
          case "select":
            return (
              <Field key={setting.key} label={gameUi(setting.label)} hint={setting.description}>
                <select className={inputClass} value={String(value)} onChange={(event) => set(setting.key, event.target.value)}>
                  {setting.options.map((option) => (
                    <option key={option.value} value={option.value} className="bg-zinc-900">
                      {gameUi(option.label)}
                    </option>
                  ))}
                </select>
              </Field>
            );
          case "string":
            return (
              <Field key={setting.key} label={gameUi(setting.label)} hint={setting.description}>
                <input className={inputClass} value={String(value)} maxLength={setting.maxLength ?? 120} onChange={(event) => set(setting.key, event.target.value)} />
              </Field>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
