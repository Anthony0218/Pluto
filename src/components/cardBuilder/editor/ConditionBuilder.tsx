import { describeCondition, getConditionType, listConditionTypes, type ConditionCategory } from "@/games/cards/engine/conditions";
import type { ConditionNode } from "@/games/cards/engine/types";
import { useCardEditor } from "./editorContext";
import { newCondition } from "./factories";
import { ParamField, smallInput } from "./fields";

const CATEGORY_LABELS: Record<ConditionCategory, string> = { card: "Cards", player: "Players", game: "Game", logic: "Logic" };


function TypeSelect({ value, onChange }: { value: string; onChange: (type: string) => void }) {
  const groups = (["card", "player", "game"] as ConditionCategory[]).map((category) => ({ category, types: listConditionTypes().filter((type) => type.category === category) }));
  return (
    <select aria-label="Condition" value={value} onChange={(event) => onChange(event.target.value)} className={`${smallInput} cursor-pointer font-semibold`}>
      {!getConditionType(value) && <option value={value}>⚠ unknown “{value}”</option>}
      {groups.map((group) => (
        <optgroup key={group.category} label={CATEGORY_LABELS[group.category]} className="bg-zinc-900">
          {group.types.map((type) => (
            <option key={type.type} value={type.type} className="bg-zinc-900">
              {type.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/**
 * Visual IF builder: nested ALL (AND) / ANY (OR) groups, NOT, and primitive
 * conditions whose fields come from the condition registry.
 */
export default function ConditionBuilder({ value, onChange, compact = false, depth = 0 }: { value: ConditionNode; onChange: (value: ConditionNode) => void; compact?: boolean; depth?: number }) {
  const { def } = useCardEditor();
  const tone = depth % 2 === 0 ? "border-sky-400/25 bg-sky-400/[0.03]" : "border-violet-400/25 bg-violet-400/[0.03]";

  if (value.type === "and" || value.type === "or") {
    const children = (value.children as ConditionNode[]) ?? [];
    const set = (next: ConditionNode[]) => onChange({ ...value, children: next });
    return (
      <div className={`rounded-xl border ${tone} p-2`}>
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <div role="radiogroup" aria-label="Combine conditions" className="inline-flex rounded-md border border-white/10 bg-black/30 p-0.5 text-[11px] font-bold">
            {(["and", "or"] as const).map((type) => (
              <button key={type} type="button" role="radio" aria-checked={value.type === type} onClick={() => onChange({ ...value, type })} className={`rounded px-2 py-0.5 ${value.type === type ? "bg-amber-300 text-zinc-950" : "text-zinc-400"}`}>
                {type === "and" ? "ALL of (AND)" : "ANY of (OR)"}
              </button>
            ))}
          </div>
          {depth > 0 && children.length <= 1 && (
            <button type="button" className="text-[11px] text-zinc-500 hover:text-amber-200" onClick={() => onChange(children[0] ?? { type: "and", children: [] })}>
              ungroup
            </button>
          )}
        </div>
        <ul className="space-y-1.5">
          {children.map((child, index) => (
            <li key={index} className="flex items-start gap-1.5">
              <span className="mt-1.5 w-8 shrink-0 text-right text-[10px] font-black uppercase text-zinc-500">{index === 0 ? "" : value.type}</span>
              <div className="min-w-0 flex-1">
                <ConditionBuilder value={child} depth={depth + 1} onChange={(next) => set(children.map((entry, i) => (i === index ? next : entry)))} compact={compact} />
              </div>
              <button type="button" aria-label="Remove condition" className="mt-1 text-xs text-zinc-600 hover:text-red-300" onClick={() => set(children.filter((_, i) => i !== index))}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        {!children.length && <p className="px-1 text-xs text-zinc-500">{value.type === "and" ? "No conditions yet — always true." : "No options yet — never true."}</p>}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button type="button" className="rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-amber-300/40" onClick={() => set([...children, newCondition("rankEquals")])}>
            + condition
          </button>
          {depth < 6 && (
            <button type="button" className="rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-amber-300/40" onClick={() => set([...children, { type: value.type === "and" ? "or" : "and", children: [] }])}>
              + {value.type === "and" ? "OR" : "AND"} group
            </button>
          )}
          <button type="button" className="rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-amber-300/40" onClick={() => onChange({ type: "not", child: value })}>
            NOT
          </button>
        </div>
        {depth === 0 && !compact && <p className="mt-2 text-xs italic text-zinc-400">IF {describeCondition(value, { def })}</p>}
      </div>
    );
  }

  if (value.type === "not") {
    return (
      <div className="rounded-xl border border-red-400/25 bg-red-400/[0.03] p-2">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[11px] font-black uppercase text-red-200">NOT</span>
          <button type="button" className="text-[11px] text-zinc-500 hover:text-amber-200" onClick={() => onChange(value.child as ConditionNode)}>
            remove NOT
          </button>
        </div>
        <ConditionBuilder value={value.child as ConditionNode} depth={depth + 1} onChange={(child) => onChange({ type: "not", child })} compact={compact} />
      </div>
    );
  }

  const definition = getConditionType(value.type);
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/20 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeSelect value={value.type} onChange={(type) => onChange(newCondition(type))} />
        {definition?.params.map((param) => (
          <span key={param.key} className="inline-flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-wide text-zinc-500">{param.label}</span>
            <ParamField spec={param} value={(value as Record<string, unknown>)[param.key]} onChange={(next) => onChange({ ...value, [param.key]: next } as ConditionNode)} />
          </span>
        ))}
        {depth === 0 && (
          <button type="button" className="text-[11px] text-zinc-500 hover:text-amber-200" onClick={() => onChange({ type: "and", children: [value] })}>
            make group
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] italic text-zinc-500">{describeCondition(value, { def })}</p>
    </div>
  );
}
