import { gameUi, useGameLanguage } from "../../../../i18n/gameUi.ts";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { POKER_COMBINATIONS, type CombinationDefinition } from "@/games/cards/engine/combinations";
import type { Primitive, VariableDefinition } from "@/games/cards/engine/types";
import { Button, Panel, inputClass } from "@/components/chessCustom/ui";
import { useCardEditor } from "../editorContext";

const small = `${inputClass} !w-auto py-1 text-xs`;
const ident = (text: string) => text.replace(/[^A-Za-z0-9_-]/g, "").replace(/^[^A-Za-z]+/, "");

function describeCombination(combination: CombinationDefinition) {
  const parts: string[] = [];
  if (combination.groups?.length) parts.push(combination.groups.map((size) => `${size} of a rank`).join(" + "));
  if (combination.sameSuit) parts.push(`${combination.sameSuit} of one suit`);
  if (combination.run) parts.push(`${combination.run} in a row${combination.runSameSuit ? " in one suit" : ""}${combination.highCanBeLow ? " (top rank may be low)" : ""}`);
  return parts.join(", ") || "any cards (the fallback)";
}

/** Hand rankings used by “Find the best hand”, weakest first. */
export function CombinationsPanel() {
  useGameLanguage();
  const { def, edit } = useCardEditor();
  const list = def.combinations ?? [];
  const update = (index: number, patch: Partial<CombinationDefinition>) =>
    edit((draft) => {
      const next = { ...draft.combinations![index], ...patch };
      for (const key of Object.keys(patch) as (keyof CombinationDefinition)[]) if (patch[key] === undefined || patch[key] === false) delete next[key];
      draft.combinations![index] = next;
    });
  const move = (index: number, delta: number) =>
    edit((draft) => {
      const [item] = draft.combinations!.splice(index, 1);
      draft.combinations!.splice(index + delta, 0, item);
    });
  const number = (value: string) => (value ? Math.max(1, Math.min(12, Number(value) || 1)) : undefined);
  return (
    <Panel
      title={gameUi("Card combinations")}
      eyebrow="Hand rankings · weakest first"
      actions={
        <>
          {!list.length && (
            <Button size="sm" onClick={() => edit((draft) => void (draft.combinations = structuredClone(POKER_COMBINATIONS)))}>
              Load the poker ladder
            </Button>
          )}
          <Button size="sm" onClick={() => edit((draft) => void (draft.combinations = [...(draft.combinations ?? []), { id: `combo${(draft.combinations?.length ?? 0) + 1}`, name: "New combination", groups: [2] }]))}>
            <Plus size={14} /> Combination
          </Button>
        </>
      }
    >
      {gameUi(!list.length ? (
        <p className="text-sm text-zinc-500">{gameUi("No combinations. Add some to compare hands with the “Find the best hand” effect (pairs, runs, suits…).")}</p>
      ) : (
        <ol className="space-y-2">
          {list.map((combination, index) => (
            <li key={index} className="rounded-lg border border-white/[0.07] bg-black/20 p-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="w-5 font-mono text-zinc-600">{gameUi(index + 1)}</span>
                <input aria-label={gameUi("Combination name")} className={`${small} w-36 font-semibold`} value={combination.name} onChange={(event) => update(index, { name: event.target.value })} />{gameUi(" same rank ")}<input aria-label={gameUi("Same-rank groups")} className={`${small} w-16`} placeholder="e.g. 3,2" value={(combination.groups ?? []).join(",")} onChange={(event) => update(index, { groups: event.target.value.split(",").map((part) => Number(part.trim())).filter((size) => size >= 1 && size <= 8).slice(0, 4) || undefined })} />{gameUi(" one suit ")}<input aria-label={gameUi("Cards of one suit")} type="number" min={1} max={12} className={`${small} w-14`} value={combination.sameSuit ?? ""} onChange={(event) => update(index, { sameSuit: number(event.target.value) })} />{gameUi(" in a row ")}<input aria-label={gameUi("Cards in a row")} type="number" min={2} max={12} className={`${small} w-14`} value={combination.run ?? ""} onChange={(event) => update(index, { run: number(event.target.value) })} />
                <label className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={Boolean(combination.runSameSuit)} onChange={(event) => update(index, { runSameSuit: event.target.checked })} />{gameUi(" row in one suit ")}</label>
                <label className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={Boolean(combination.highCanBeLow)} onChange={(event) => update(index, { highCanBeLow: event.target.checked })} />{gameUi(" top rank may be low ")}</label>
                <span className="ml-auto inline-flex">
                  <button type="button" aria-label={gameUi("Make weaker")} disabled={index === 0} className="p-1 text-zinc-500 disabled:opacity-30" onClick={() => move(index, -1)}>
                    <ArrowUp size={12} />
                  </button>
                  <button type="button" aria-label={gameUi("Make stronger")} disabled={index === list.length - 1} className="p-1 text-zinc-500 disabled:opacity-30" onClick={() => move(index, 1)}>
                    <ArrowDown size={12} />
                  </button>
                  <button type="button" aria-label={gameUi(`Delete ${combination.name}`)} className="p-1 text-zinc-500 hover:text-red-300" onClick={() => edit((draft) => void draft.combinations!.splice(index, 1))}>
                    <Trash2 size={12} />
                  </button>
                </span>
              </div>
              <p className="mt-1 pl-7 text-[11px] italic text-zinc-500">{gameUi(describeCombination(combination))}</p>
            </li>
          ))}
        </ol>
      ))}
    </Panel>
  );
}

function parseInitial(text: string): Primitive {
  if (text === "") return null;
  if (text === "true" || text === "false") return text === "true";
  return Number.isFinite(Number(text)) ? Number(text) : text;
}

function VariableList({ kind }: { kind: "variables" | "playerVariables" }) {
  useGameLanguage();
  const { def, edit } = useCardEditor();
  const list = def[kind] ?? [];
  const update = (index: number, patch: Partial<VariableDefinition>) => edit((draft) => void (draft[kind]![index] = { ...draft[kind]![index], ...patch }));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{gameUi(kind === "variables" ? "Game variables" : "Player variables (one per player)")}</p>
        <Button size="sm" onClick={() => edit((draft) => void (draft[kind] = [...(draft[kind] ?? []), { key: `${kind === "variables" ? "value" : "playerValue"}${(draft[kind]?.length ?? 0) + 1}`, initial: 0 }]))}>
          <Plus size={14} />{gameUi(" Variable ")}</Button>
      </div>
      {!list.length && <p className="text-xs text-zinc-500">{gameUi("None.")}</p>}
      <ul className="space-y-1.5">
        {list.map((variable, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            <input aria-label={gameUi("Variable key")} className={`${small} w-32 font-mono`} value={variable.key} onChange={(event) => update(index, { key: ident(event.target.value) })} />
            <input aria-label={gameUi("Variable label")} className={`${small} w-44`} placeholder={gameUi("label")} value={variable.label ?? ""} onChange={(event) => update(index, { label: event.target.value || undefined })} />{gameUi(" starts at ")}<input aria-label={gameUi("Initial value")} className={`${small} w-20`} placeholder={gameUi("empty")} value={variable.initial === null ? "" : String(variable.initial)} onChange={(event) => update(index, { initial: parseInitial(event.target.value) })} />
            {gameUi(kind === "variables" && (
              <label className="inline-flex items-center gap-1">
                <input type="checkbox" checked={Boolean(variable.visible)} onChange={(event) => update(index, { visible: event.target.checked || undefined })} />{gameUi(" show on table ")}</label>
            ))}
            <button type="button" aria-label={gameUi(`Delete variable ${variable.key}`)} className="ml-auto p-1 text-zinc-500 hover:text-red-300" onClick={() => edit((draft) => void draft[kind]!.splice(index, 1))}>
              <Trash2 size={12} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Values the rules can remember (pot, current bet, “took the cards”…). */
export function VariablesPanel() {
  useGameLanguage();
  const { def, edit } = useCardEditor();
  return (
    <Panel title={gameUi("Variables")} eyebrow="Remembered values">
      <div className="space-y-4">
        <label className="flex flex-wrap items-center gap-2 text-sm text-zinc-300">{gameUi(" A player's score is called ")}<input aria-label={gameUi("Score label")} className={`${small} w-28`} placeholder={gameUi("Score")} maxLength={20} value={def.scoreLabel ?? ""} onChange={(event) => edit((draft) => void (event.target.value ? (draft.scoreLabel = event.target.value) : delete draft.scoreLabel))} />
        </label>
        <VariableList kind="variables" />
        <VariableList kind="playerVariables" />
      </div>
    </Panel>
  );
}
