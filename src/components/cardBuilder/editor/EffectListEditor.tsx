import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { describeEffect, getEffectType, listEffectTypes, type EffectCategory } from "@/games/cards/engine/effects";
import type { EffectDefinition } from "@/games/cards/engine/types";
import { useCardEditor } from "./editorContext";
import { newEffect } from "./factories";
import { ParamField, smallInput } from "./fields";

const CATEGORY_LABELS: Record<EffectCategory, string> = { cards: "Cards", players: "Players", flow: "Game flow", values: "Scores & variables", logic: "Logic" };


/** THEN-list: ordered effects with registry-driven parameter fields. */
export default function EffectListEditor({ value, onChange, compact = false }: { value: EffectDefinition[]; onChange: (value: EffectDefinition[]) => void; compact?: boolean }) {
  const { def } = useCardEditor();
  const types = listEffectTypes();
  const set = (index: number, next: EffectDefinition) => onChange(value.map((entry, i) => (i === index ? next : entry)));
  const move = (index: number, delta: number) => {
    const next = [...value];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      {value.map((effect, index) => {
        const definition = getEffectType(effect.type);
        return (
          <div key={index} className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.03] px-2 py-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] text-zinc-600">{index + 1}</span>
              <select aria-label="Effect" value={effect.type} onChange={(event) => set(index, newEffect(event.target.value))} className={`${smallInput} cursor-pointer font-semibold`}>
                {!definition && <option value={effect.type}>⚠ unknown “{effect.type}”</option>}
                {(Object.keys(CATEGORY_LABELS) as EffectCategory[]).map((category) => (
                  <optgroup key={category} label={CATEGORY_LABELS[category]} className="bg-zinc-900">
                    {types
                      .filter((type) => type.category === category)
                      .map((type) => (
                        <option key={type.type} value={type.type} className="bg-zinc-900">
                          {type.label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              {definition?.params
                .filter((param) => param.kind !== "effects" && param.kind !== "condition")
                .map((param) => (
                  <span key={param.key} className="inline-flex items-center gap-1">
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500">{param.label}</span>
                    <ParamField spec={param} value={effect[param.key]} onChange={(next) => set(index, { ...effect, [param.key]: next })} />
                  </span>
                ))}
              <span className="ml-auto inline-flex gap-0.5">
                <button type="button" aria-label="Move effect up" disabled={index === 0} className="p-1 text-zinc-500 hover:text-white disabled:opacity-30" onClick={() => move(index, -1)}>
                  <ArrowUp size={12} />
                </button>
                <button type="button" aria-label="Move effect down" disabled={index === value.length - 1} className="p-1 text-zinc-500 hover:text-white disabled:opacity-30" onClick={() => move(index, 1)}>
                  <ArrowDown size={12} />
                </button>
                <button type="button" aria-label="Delete effect" className="p-1 text-zinc-500 hover:text-red-300" onClick={() => onChange(value.filter((_, i) => i !== index))}>
                  <Trash2 size={12} />
                </button>
              </span>
            </div>
            {/* Nested conditions and effect lists get their own rows. */}
            {definition?.params
              .filter((param) => param.kind === "effects" || param.kind === "condition")
              .map((param) => (
                <div key={param.key} className="mt-1.5 flex gap-2 pl-4">
                  <span className="mt-1 w-16 shrink-0 text-[10px] font-black uppercase tracking-wide text-zinc-500">{param.label}</span>
                  <div className="min-w-0 flex-1">
                    <ParamField spec={param} value={effect[param.key]} onChange={(next) => set(index, { ...effect, [param.key]: next })} />
                  </div>
                </div>
              ))}
            {!compact && <p className="mt-1 text-[11px] italic text-zinc-500">{describeEffect(effect, { def })}</p>}
          </div>
        );
      })}
      <select
        aria-label="Add an effect"
        value=""
        onChange={(event) => event.target.value && onChange([...value, newEffect(event.target.value)])}
        className={`${smallInput} cursor-pointer border-dashed text-zinc-400`}
      >
        <option value="">+ add effect…</option>
        {(Object.keys(CATEGORY_LABELS) as EffectCategory[]).map((category) => (
          <optgroup key={category} label={CATEGORY_LABELS[category]} className="bg-zinc-900">
            {types
              .filter((type) => type.category === category)
              .map((type) => (
                <option key={type.type} value={type.type} className="bg-zinc-900">
                  {type.label}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
