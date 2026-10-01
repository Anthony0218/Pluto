import { useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { RANKS, RANK_NAMES, SUITS, SUIT_NAMES, SUIT_SYMBOLS, deckSize, withRank, type Rank } from "@/games/cards/cards/card";
import { generateRulebookFacts } from "@/games/cards/engine/rulebook";
import type { GameSettingDefinition, Rulebook } from "@/games/cards/engine/types";
import { Button, Field, NumberField, Panel, Toggle, inputClass } from "@/components/chessCustom/ui";
import { useCardEditor } from "../editorContext";
import SectionShell from "../SectionShell";
import { CombinationsPanel, VariablesPanel } from "./ExtraPanels";

/* 1. Basic information */
export function BasicsSection() {
  const { def, edit } = useCardEditor();
  return (
    <SectionShell section="basics" eyebrow="1 · Basics" title="Basic information" description="Name your game and describe it in a sentence. Players see this on the game card.">
      <Panel>
        <div className="grid gap-4">
          <Field label="Name">
            <input className={inputClass} value={def.name} maxLength={80} onChange={(event) => edit((draft) => void (draft.name = event.target.value))} />
          </Field>
          <Field label="Short description">
            <textarea className={`${inputClass} min-h-20`} value={def.description} maxLength={600} onChange={(event) => edit((draft) => void (draft.description = event.target.value))} />
          </Field>
          {def.templateId && <p className="text-xs text-zinc-500">Started from the template “{def.templateId}”.</p>}
        </div>
      </Panel>
    </SectionShell>
  );
}

/* 2. Deck */
export function DeckSection() {
  const { def, edit, mode } = useCardEditor();
  const [dragging, setDragging] = useState<number | null>(null);
  const order = def.deck.rankOrder;
  const moveRank = (from: number, to: number) =>
    edit((draft) => {
      const next = [...draft.deck.rankOrder];
      const [rank] = next.splice(from, 1);
      next.splice(to, 0, rank);
      draft.deck.rankOrder = next;
    });
  const toggleRank = (rank: Rank) =>
    edit((draft) => {
      const included = draft.deck.ranks.includes(rank);
      draft.deck.ranks = included ? draft.deck.ranks.filter((entry) => entry !== rank) : RANKS.filter((entry) => entry === rank || draft.deck.ranks.includes(entry));
      draft.deck.rankOrder = withRank(draft.deck.rankOrder, rank);
    });
  return (
    <SectionShell section="deck" eyebrow="2 · Deck" title="Deck" description="The standard 32-card deck is 7 to Ace in four suits; add the 6s for a 36-card deck. Drag the ranks to set which beats which in your game.">
      <Panel title="Rank order" eyebrow="Weakest → strongest">
        <ol aria-label="Rank order, weakest first" className="flex flex-wrap items-center gap-2">
          {order.map((rank, index) => (
            <li
              key={rank}
              draggable
              onDragStart={() => setDragging(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragging !== null && dragging !== index) moveRank(dragging, index);
                setDragging(null);
              }}
              className={`flex items-center gap-1 rounded-xl border px-2 py-2 ${def.deck.ranks.includes(rank) ? "border-white/15 bg-[#fbf8f1] text-zinc-900" : "border-white/10 bg-white/5 text-zinc-500 line-through"} ${dragging === index ? "opacity-50" : ""}`}
            >
              <GripVertical size={14} className="cursor-grab text-zinc-400" aria-hidden />
              <span className="w-8 text-center text-lg font-black">{rank}</span>
              <span className="flex flex-col">
                <button type="button" aria-label={`Move ${RANK_NAMES[rank]} weaker`} disabled={index === 0} onClick={() => moveRank(index, index - 1)} className="text-[10px] leading-none text-zinc-500 disabled:opacity-20">
                  ◀
                </button>
                <button type="button" aria-label={`Move ${RANK_NAMES[rank]} stronger`} disabled={index === order.length - 1} onClick={() => moveRank(index, index + 1)} className="text-[10px] leading-none text-zinc-500 disabled:opacity-20">
                  ▶
                </button>
              </span>
              {index < order.length - 1 && <span className="ml-1 text-zinc-500">&lt;</span>}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-zinc-400">{order.filter((rank) => def.deck.ranks.includes(rank)).join(" < ")}</p>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Ranks in the deck">
          <div className="flex flex-wrap gap-2">
            {RANKS.map((rank) => (
              <button key={rank} type="button" aria-pressed={def.deck.ranks.includes(rank)} onClick={() => toggleRank(rank)} className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${def.deck.ranks.includes(rank) ? "border-amber-300/50 bg-amber-300/15 text-amber-100" : "border-white/10 text-zinc-500"}`}>
                {rank}
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Suits and copies">
          <div className="flex flex-wrap gap-2">
            {SUITS.map((suit) => {
              const on = def.deck.suits.includes(suit);
              return (
                <button key={suit} type="button" aria-pressed={on} onClick={() => edit((draft) => void (draft.deck.suits = on ? draft.deck.suits.filter((entry) => entry !== suit) : SUITS.filter((entry) => entry === suit || draft.deck.suits.includes(entry))))} className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${on ? "border-amber-300/50 bg-amber-300/15 text-amber-100" : "border-white/10 text-zinc-500"}`}>
                  {SUIT_SYMBOLS[suit]} {SUIT_NAMES[suit]}
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-zinc-300">Copies of each card</span>
            <NumberField value={def.deck.copies} min={1} max={4} label="Copies" onChange={(copies) => edit((draft) => void (draft.deck.copies = copies))} />
          </div>
          <p className="mt-3 text-sm font-semibold text-zinc-200">{deckSize(def.deck)} cards in total</p>
        </Panel>
      </div>
      {(mode === "advanced" || Boolean(def.combinations?.length)) && <CombinationsPanel />}
    </SectionShell>
  );
}

/* 3. Players */
export function PlayersSection() {
  const { def, edit, mode } = useCardEditor();
  const [role, setRole] = useState("");
  return (
    <SectionShell section="players" eyebrow="3 · Players" title="Players" description="How many people can sit at the table. Roles (like attacker and defender) are labels that rules and actions can refer to.">
      <Panel>
        <div className="flex flex-wrap gap-6">
          <Field label="Minimum">
            <NumberField value={def.players.min} min={1} max={def.players.max} label="Minimum players" onChange={(min) => edit((draft) => void (draft.players.min = min))} />
          </Field>
          <Field label="Maximum">
            <NumberField value={def.players.max} min={def.players.min} max={10} label="Maximum players" onChange={(max) => edit((draft) => void (draft.players.max = max))} />
          </Field>
        </div>
      </Panel>
      {mode === "advanced" && (
        <Panel title="Roles">
          <div className="flex flex-wrap items-center gap-2">
            {(def.roles ?? []).map((entry) => (
              <span key={entry} className="inline-flex items-center gap-1 rounded-full border border-sky-400/30 bg-sky-400/10 px-2.5 py-1 text-xs text-sky-100">
                {entry}
                <button type="button" aria-label={`Remove role ${entry}`} onClick={() => edit((draft) => void (draft.roles = (draft.roles ?? []).filter((item) => item !== entry)))}>
                  ✕
                </button>
              </span>
            ))}
            <input aria-label="New role" className={`${inputClass} !w-40 py-1`} placeholder="new role" value={role} onChange={(event) => setRole(event.target.value.replace(/[^A-Za-z0-9_-]/g, ""))} />
            <Button size="sm" disabled={!role} onClick={() => (edit((draft) => void (draft.roles = [...new Set([...(draft.roles ?? []), role])])), setRole(""))}>
              <Plus size={14} /> Add role
            </Button>
          </div>
        </Panel>
      )}
    </SectionShell>
  );
}

/* 10. Rulebook */
export function RulebookSection() {
  const { def, edit } = useCardEditor();
  const facts = generateRulebookFacts(def);
  const fields: { key: keyof Rulebook; label: string; hint: string }[] = [
    { key: "overview", label: "Overview", hint: "What is the game about, in two sentences?" },
    { key: "setup", label: "Setup", hint: "How do players get ready?" },
    { key: "gameplay", label: "Gameplay", hint: "What happens on a turn?" },
    { key: "winning", label: "Winning", hint: "How does the game end?" },
    { key: "notes", label: "Extra notes", hint: "Variants, tips, edge cases (optional)." },
  ];
  return (
    <SectionShell section="rulebook" eyebrow="10 · Rulebook" title="Rulebook" description="Explain your game in your own words. The facts on the right are generated from your configuration and always stay accurate — they are shown separately.">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel>
          <div className="space-y-4">
            {fields.map((field) => (
              <Field key={field.key} label={field.label} hint={field.hint}>
                <textarea className={`${inputClass} min-h-24`} maxLength={8000} value={def.rulebook[field.key] ?? ""} onChange={(event) => edit((draft) => void (draft.rulebook[field.key] = event.target.value))} />
              </Field>
            ))}
          </div>
        </Panel>
        <Panel title="Generated from your settings" eyebrow="Facts">
          <ul className="space-y-2 text-sm text-zinc-300">
            {facts.map((fact, index) => (
              <li key={index} className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
                <span className="mr-2 text-[10px] font-black uppercase tracking-wide text-zinc-500">{fact.topic}</span>
                {fact.text}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </SectionShell>
  );
}

/* 11. Game settings */
const newSetting = (type: GameSettingDefinition["type"], key: string): GameSettingDefinition => {
  switch (type) {
    case "integer":
      return { key, label: "New number", type, default: 1, min: 0, max: 10 };
    case "boolean":
      return { key, label: "New switch", type, default: false };
    case "select":
      return { key, label: "New choice", type, default: "a", options: [{ value: "a", label: "Option A" }, { value: "b", label: "Option B" }] };
    case "string":
      return { key, label: "New text", type, default: "", maxLength: 40 };
  }
};

export function SettingsSection() {
  const { def, edit, mode } = useCardEditor();
  const settings = def.settings ?? [];
  const update = (index: number, next: GameSettingDefinition) => edit((draft) => void (draft.settings = (draft.settings ?? []).map((entry, i) => (i === index ? next : entry))));
  return (
    <SectionShell
      section="settings"
      eyebrow="11 · Settings"
      title="Game settings"
      description="Options players choose in the lobby. Rules and effects can read them (value type “lobby setting”), so one game can cover many variants."
      actions={
        <select aria-label="Add setting" className={`${inputClass} !w-auto py-1.5`} value="" onChange={(event) => event.target.value && edit((draft) => void (draft.settings = [...(draft.settings ?? []), newSetting(event.target.value as GameSettingDefinition["type"], `setting${(draft.settings?.length ?? 0) + 1}`)]))}>
          <option value="">+ Add setting…</option>
          <option value="integer">Number</option>
          <option value="boolean">On / off</option>
          <option value="select">Choice</option>
          <option value="string">Text</option>
        </select>
      }
    >
      {!settings.length && <p className="text-sm text-zinc-500">No settings yet.</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {settings.map((setting, index) => (
          <Panel
            key={index}
            title={setting.label}
            eyebrow={`${setting.type} · ${setting.key}`}
            actions={
              <button type="button" aria-label={`Delete setting ${setting.label}`} className="text-zinc-500 hover:text-red-300" onClick={() => edit((draft) => void (draft.settings = (draft.settings ?? []).filter((_, i) => i !== index)))}>
                <Trash2 size={14} />
              </button>
            }
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Label">
                <input className={inputClass} value={setting.label} onChange={(event) => update(index, { ...setting, label: event.target.value })} />
              </Field>
              <Field label="Key (used by rules)">
                <input className={`${inputClass} font-mono`} value={setting.key} onChange={(event) => update(index, { ...setting, key: event.target.value.replace(/[^A-Za-z0-9_-]/g, "") })} />
              </Field>
              {setting.type === "integer" && (
                <>
                  <Field label="Default">
                    <NumberField value={setting.default} min={setting.min} max={setting.max} label="Default" onChange={(value) => update(index, { ...setting, default: value })} />
                  </Field>
                  <Field label="Range">
                    <span className="flex items-center gap-2">
                      <NumberField value={setting.min} min={-100} max={setting.max} label="Minimum" onChange={(value) => update(index, { ...setting, min: value, default: Math.max(value, setting.default) })} />
                      –
                      <NumberField value={setting.max} min={setting.min} max={1000} label="Maximum" onChange={(value) => update(index, { ...setting, max: value, default: Math.min(value, setting.default) })} />
                    </span>
                  </Field>
                </>
              )}
              {setting.type === "boolean" && <Toggle checked={setting.default} onChange={(value) => update(index, { ...setting, default: value })} label="On by default" />}
              {setting.type === "string" && (
                <Field label="Default">
                  <input className={inputClass} value={setting.default} onChange={(event) => update(index, { ...setting, default: event.target.value })} />
                </Field>
              )}
              {setting.type === "select" && (
                <div className="sm:col-span-2">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Choices (● = default)</p>
                  <ul className="space-y-1.5">
                    {setting.options.map((option, optionIndex) => (
                      <li key={optionIndex} className="flex items-center gap-2">
                        <input type="radio" aria-label="Default choice" checked={setting.default === option.value} onChange={() => update(index, { ...setting, default: option.value })} />
                        <input aria-label="Choice value" className={`${inputClass} !w-28 font-mono`} value={option.value} onChange={(event) => update(index, { ...setting, options: setting.options.map((entry, i) => (i === optionIndex ? { ...entry, value: event.target.value } : entry)) })} />
                        <input aria-label="Choice label" className={inputClass} value={option.label} onChange={(event) => update(index, { ...setting, options: setting.options.map((entry, i) => (i === optionIndex ? { ...entry, label: event.target.value } : entry)) })} />
                        <button type="button" aria-label="Remove choice" className="text-zinc-500 hover:text-red-300" onClick={() => update(index, { ...setting, options: setting.options.filter((_, i) => i !== optionIndex) })}>
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Button size="sm" className="mt-2" onClick={() => update(index, { ...setting, options: [...setting.options, { value: `option${setting.options.length + 1}`, label: "New choice" }] })}>
                    <Plus size={14} /> Choice
                  </Button>
                </div>
              )}
            </div>
          </Panel>
        ))}
      </div>
      {mode === "advanced" && <VariablesPanel />}
    </SectionShell>
  );
}
